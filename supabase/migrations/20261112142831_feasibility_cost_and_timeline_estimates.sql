ALTER TABLE public.project_input_sheets
  ADD COLUMN IF NOT EXISTS department_estimates jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.project_input_sheets
  DROP CONSTRAINT IF EXISTS project_input_department_estimates_object;

ALTER TABLE public.project_input_sheets
  ADD CONSTRAINT project_input_department_estimates_object
  CHECK (jsonb_typeof(department_estimates) = 'object');

-- Department leads see and edit only their own feasibility estimate. Finance and
-- Admin can see the consolidated estimates for the same shared TEST sheet.
CREATE OR REPLACE FUNCTION public.get_project_input_sheets()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM resolve_test_membership();
  IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client THEN
    RAISE EXCEPTION 'INPUT_ACCESS_DENIED';
  END IF;
  RETURN jsonb_build_object(
    'sheets', COALESCE((
      SELECT jsonb_agg(
        CASE
          WHEN a.role = 'admin' OR a.department_code = 'FIN' THEN to_jsonb(s)
          ELSE jsonb_set(
            to_jsonb(s), '{department_estimates}',
            CASE WHEN a.department_code IS NOT NULL AND s.department_estimates ? a.department_code
              THEN jsonb_build_object(a.department_code, s.department_estimates->a.department_code)
              ELSE '{}'::jsonb END,
            true
          )
        END
      )
      FROM project_input_sheets s
      WHERE s.organization_id = a.organization_id AND private.project_input_visible(s.id)
    ), '[]'::jsonb),
    'events', COALESCE((
      SELECT jsonb_agg(e) FROM (
        SELECT e.*, m.display_name AS actor_name
        FROM project_input_events e
        JOIN organization_members m ON m.id=e.actor_id
        WHERE private.project_input_visible(e.sheet_id)
        ORDER BY e.created_at DESC LIMIT 100
      ) e
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_project_input_sheets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_input_sheets() TO authenticated;

CREATE OR REPLACE FUNCTION public.save_project_department_feasibility_estimate(
  p_sheet uuid,
  p_expected_version integer,
  p_estimate jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE a record; s project_input_sheets%ROWTYPE; dept text; task_row jsonb; task_key text; response jsonb; plan_phase text; phase_days numeric; min_days numeric; max_days numeric; lifecycle_id uuid; lifecycle_def jsonb; stage_def jsonb;
BEGIN
  SELECT * INTO a FROM resolve_test_membership();
  IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client
     OR a.role <> 'department_lead' OR a.department_code IS NULL THEN
    RAISE EXCEPTION 'FEASIBILITY_ESTIMATE_LEAD_REQUIRED';
  END IF;
  IF p_estimate IS NULL OR jsonb_typeof(p_estimate) <> 'object'
     OR octet_length(p_estimate::text) > 65536 THEN
    RAISE EXCEPTION 'INVALID_FEASIBILITY_ESTIMATE';
  END IF;
  dept := a.department_code;
  PERFORM pg_advisory_xact_lock(hashtextextended(a.organization_id::text || p_sheet::text, 0));
  SELECT * INTO s FROM project_input_sheets
  WHERE id=p_sheet AND organization_id=a.organization_id FOR UPDATE;
  IF s.id IS NULL OR NOT private.project_input_visible(s.id) THEN RAISE EXCEPTION 'INPUT_ACCESS_DENIED'; END IF;
  IF s.status <> 'Draft' THEN RAISE EXCEPTION 'INPUT_BASELINE_LOCKED'; END IF;
  IF s.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'INPUT_STALE_VERSION'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM departments d WHERE d.organization_id=a.organization_id
      AND d.code=dept AND d.active AND d.code<>'CLIENT'
  ) THEN RAISE EXCEPTION 'FEASIBILITY_ESTIMATE_DEPARTMENT_UNAVAILABLE'; END IF;
  SELECT id,definition INTO lifecycle_id,lifecycle_def FROM private.lifecycle_revisions
    WHERE organization_id=a.organization_id ORDER BY version DESC LIMIT 1;
  IF lifecycle_id IS NULL OR p_estimate->>'lifecycleRevisionId' IS DISTINCT FROM lifecycle_id::text THEN
    RAISE EXCEPTION 'FEASIBILITY_LIFECYCLE_REVISION_STALE';
  END IF;
  IF COALESCE(p_estimate->>'currency','') NOT IN ('INR','USD','EUR','GBP')
     OR jsonb_typeof(p_estimate->'taskPlan') <> 'object'
     OR jsonb_typeof(p_estimate->'stageDurationDays') <> 'object'
     OR jsonb_typeof(p_estimate->'plannedDurationDays') <> 'number' THEN
    RAISE EXCEPTION 'FEASIBILITY_ESTIMATE_FIELDS_REQUIRED';
  END IF;
  IF (p_estimate->>'plannedDurationDays')::numeric < 1 OR (p_estimate->>'plannedDurationDays')::numeric > 365
     OR COALESCE((p_estimate->>'preliminaryBomCost')::numeric,0) < 0
     OR COALESCE((p_estimate->>'reusableMaterialValue')::numeric,0) < 0
     OR COALESCE((p_estimate->>'consumableCost')::numeric,0) < 0
     OR COALESCE((p_estimate->>'labCertificationFees')::numeric,0) < 0
     OR COALESCE((p_estimate->>'toolingCapex')::numeric,0) < 0 THEN
    RAISE EXCEPTION 'FEASIBILITY_ESTIMATE_OUT_OF_RANGE';
  END IF;
  FOR plan_phase IN SELECT key FROM jsonb_each(p_estimate->'stageDurationDays') LOOP
    IF plan_phase !~ '^TG_[0-9]$' OR jsonb_typeof(p_estimate->'stageDurationDays'->plan_phase)<>'number'
       OR (p_estimate->'stageDurationDays'->>plan_phase)::numeric < 1
       OR (p_estimate->'stageDurationDays'->>plan_phase)::numeric > 365 THEN
      RAISE EXCEPTION 'FEASIBILITY_PHASE_DURATION_INVALID';
    END IF;
    min_days:=NULLIF(lifecycle_def->'phaseDurations'->plan_phase->>'minWorkingDays','')::numeric;
    max_days:=NULLIF(lifecycle_def->'phaseDurations'->plan_phase->>'maxWorkingDays','')::numeric;
    IF min_days IS NOT NULL AND max_days IS NOT NULL AND ((p_estimate->'stageDurationDays'->>plan_phase)::numeric < min_days OR (p_estimate->'stageDurationDays'->>plan_phase)::numeric > max_days) THEN
      RAISE EXCEPTION 'FEASIBILITY_PHASE_DURATION_OUTSIDE_ADMIN_RANGE: %',plan_phase;
    END IF;
  END LOOP;
  FOR task_key,task_row IN SELECT key,value FROM jsonb_each(p_estimate->'taskPlan') LOOP
    IF jsonb_typeof(task_row)<>'object' OR NULLIF(task_row->>'stageCode','') IS NULL THEN RAISE EXCEPTION 'FEASIBILITY_TASK_PHASE_REQUIRED'; END IF;
    SELECT value INTO stage_def FROM jsonb_array_elements(lifecycle_def->'stages') WHERE value->>'code'=task_row->>'stageCode';
    IF stage_def IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(stage_def->'tasks','[]'::jsonb)) task WHERE task->>'department'=dept AND task->>'id'=substring(task_key from length(task_row->>'stageCode')+2)) THEN
      RAISE EXCEPTION 'FEASIBILITY_TASK_NOT_IN_CURRENT_DEPARTMENT_PLAN';
    END IF;
    plan_phase:=stage_def->>'phase';
    IF task_row->>'phase' IS DISTINCT FROM plan_phase THEN RAISE EXCEPTION 'FEASIBILITY_TASK_PHASE_MISMATCH'; END IF;
    phase_days:=NULLIF(p_estimate->'stageDurationDays'->>plan_phase,'')::numeric;
    IF plan_phase !~ '^TG_[0-9]$' THEN
      RAISE EXCEPTION 'FEASIBILITY_TASK_PHASE_REQUIRED';
    END IF;
    IF phase_days IS NULL AND plan_phase='TG_0' THEN phase_days:=(p_estimate->>'plannedDurationDays')::numeric; END IF;
    IF phase_days IS NULL THEN RAISE EXCEPTION 'FEASIBILITY_PHASE_DURATION_REQUIRED'; END IF;
    IF jsonb_typeof(task_row) <> 'object'
       OR jsonb_typeof(task_row->'effortHours') <> 'number'
       OR jsonb_typeof(task_row->'startOffsetDays') <> 'number'
       OR jsonb_typeof(task_row->'durationDays') <> 'number'
       OR (task_row->>'effortHours')::numeric <= 0
       OR (task_row->>'startOffsetDays')::numeric < 0
       OR (task_row->>'durationDays')::numeric <= 0
       OR (task_row->>'startOffsetDays')::numeric + (task_row->>'durationDays')::numeric > phase_days THEN
      RAISE EXCEPTION 'FEASIBILITY_TASK_TIMELINE_INVALID';
    END IF;
  END LOOP;
  s.department_estimates := COALESCE(s.department_estimates,'{}'::jsonb)
    || jsonb_build_object(dept, p_estimate);
  s.version := s.version + 1;
  s.updated_at := clock_timestamp();
  UPDATE project_input_sheets SET department_estimates=s.department_estimates,version=s.version,updated_at=s.updated_at WHERE id=s.id;
  INSERT INTO project_input_events(sheet_id,actor_id,action,revision,details)
    VALUES(s.id,a.membership_id,'save_department_estimate',s.revision,jsonb_build_object('department',dept,'version',s.version));
  response := to_jsonb(s);
  RETURN jsonb_set(response,'{department_estimates}',jsonb_build_object(dept,p_estimate),true);
END;
$$;
REVOKE ALL ON FUNCTION public.save_project_department_feasibility_estimate(uuid,integer,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_project_department_feasibility_estimate(uuid,integer,jsonb) TO authenticated;
