-- Stage defaults are set by Admin. Department leads plan tasks within each
-- configured stage window during feasibility; phase targets remain roll-ups.

ALTER FUNCTION private.validate_lifecycle_definition(jsonb)
  RENAME TO validate_lifecycle_definition_before_stage_duration;

CREATE FUNCTION private.validate_lifecycle_definition(d jsonb) RETURNS void
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE s jsonb;
BEGIN
  PERFORM private.validate_lifecycle_definition_before_stage_duration(d);
  FOR s IN SELECT value FROM jsonb_array_elements(d->'stages') LOOP
    IF s ? 'durationDays' AND (
      jsonb_typeof(s->'durationDays') IS DISTINCT FROM 'number'
      OR (s->>'durationDays')::numeric < 1
      OR (s->>'durationDays')::numeric > 365
      OR (s->>'durationDays')::numeric <> trunc((s->>'durationDays')::numeric)
    ) THEN
      RAISE EXCEPTION 'INVALID_LIFECYCLE_STAGE_DURATION: %', s->>'code';
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION private.validate_lifecycle_definition(jsonb),
  private.validate_lifecycle_definition_before_stage_duration(jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_project_department_feasibility_estimate(
  p_sheet uuid,
  p_expected_version integer,
  p_estimate jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  a record;
  s project_input_sheets%ROWTYPE;
  dept text;
  task_row jsonb;
  task_key text;
  response jsonb;
  stage_code text;
  phase_code text;
  stage_days numeric;
  configured_days numeric;
  min_days numeric;
  max_days numeric;
  stage_count numeric;
  lifecycle_id uuid;
  lifecycle_def jsonb;
  stage_def jsonb;
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
  IF (p_estimate->>'plannedDurationDays')::numeric < 1
     OR (p_estimate->>'plannedDurationDays')::numeric > 365
     OR COALESCE((p_estimate->>'preliminaryBomCost')::numeric,0) < 0
     OR COALESCE((p_estimate->>'reusableMaterialValue')::numeric,0) < 0
     OR COALESCE((p_estimate->>'consumableCost')::numeric,0) < 0
     OR COALESCE((p_estimate->>'labCertificationFees')::numeric,0) < 0
     OR COALESCE((p_estimate->>'toolingCapex')::numeric,0) < 0 THEN
    RAISE EXCEPTION 'FEASIBILITY_ESTIMATE_OUT_OF_RANGE';
  END IF;

  -- The submitted duration map is a snapshot of the active Admin stage defaults,
  -- never a client-editable substitute for them. Older revisions without a saved
  -- stage duration use the same phase midpoint / stage-count fallback as the UI.
  FOR stage_code IN SELECT key FROM jsonb_each(p_estimate->'stageDurationDays') LOOP
    SELECT value INTO stage_def FROM jsonb_array_elements(lifecycle_def->'stages')
      WHERE value->>'code'=stage_code;
    IF stage_def IS NULL THEN RAISE EXCEPTION 'FEASIBILITY_STAGE_DURATION_UNKNOWN: %',stage_code; END IF;
    IF jsonb_typeof(p_estimate->'stageDurationDays'->stage_code) IS DISTINCT FROM 'number'
       OR (p_estimate->'stageDurationDays'->>stage_code)::numeric < 1
       OR (p_estimate->'stageDurationDays'->>stage_code)::numeric > 365
       OR (p_estimate->'stageDurationDays'->>stage_code)::numeric <> trunc((p_estimate->'stageDurationDays'->>stage_code)::numeric) THEN
      RAISE EXCEPTION 'FEASIBILITY_STAGE_DURATION_INVALID: %',stage_code;
    END IF;
    phase_code:=stage_def->>'phase';
    configured_days:=NULLIF(stage_def->>'durationDays','')::numeric;
    IF configured_days IS NULL THEN
      min_days:=NULLIF(lifecycle_def->'phaseDurations'->phase_code->>'minWorkingDays','')::numeric;
      max_days:=NULLIF(lifecycle_def->'phaseDurations'->phase_code->>'maxWorkingDays','')::numeric;
      SELECT count(*) INTO stage_count FROM jsonb_array_elements(lifecycle_def->'stages') item
        WHERE item->>'phase'=phase_code;
      configured_days:=greatest(1,round((coalesce(min_days,1)+coalesce(max_days,min_days,1))/2/greatest(stage_count,1)));
    END IF;
    IF (p_estimate->'stageDurationDays'->>stage_code)::numeric IS DISTINCT FROM configured_days THEN
      RAISE EXCEPTION 'FEASIBILITY_STAGE_DURATION_STALE: %',stage_code;
    END IF;
  END LOOP;

  FOR task_key,task_row IN SELECT key,value FROM jsonb_each(p_estimate->'taskPlan') LOOP
    IF jsonb_typeof(task_row)<>'object' OR NULLIF(task_row->>'stageCode','') IS NULL THEN
      RAISE EXCEPTION 'FEASIBILITY_TASK_PHASE_REQUIRED';
    END IF;
    SELECT value INTO stage_def FROM jsonb_array_elements(lifecycle_def->'stages')
      WHERE value->>'code'=task_row->>'stageCode';
    IF stage_def IS NULL OR NOT EXISTS(
      SELECT 1 FROM jsonb_array_elements(COALESCE(stage_def->'tasks','[]'::jsonb)) task
      WHERE task->>'department'=dept
        AND task->>'id'=substring(task_key from length(task_row->>'stageCode')+2)
    ) THEN RAISE EXCEPTION 'FEASIBILITY_TASK_NOT_IN_CURRENT_DEPARTMENT_PLAN'; END IF;
    phase_code:=stage_def->>'phase';
    IF task_row->>'phase' IS DISTINCT FROM phase_code THEN RAISE EXCEPTION 'FEASIBILITY_TASK_PHASE_MISMATCH'; END IF;
    stage_code:=stage_def->>'code';
    stage_days:=NULLIF(p_estimate->'stageDurationDays'->>stage_code,'')::numeric;
    IF stage_days IS NULL THEN RAISE EXCEPTION 'FEASIBILITY_STAGE_DURATION_REQUIRED: %',stage_code; END IF;
    IF jsonb_typeof(task_row->'effortHours') IS DISTINCT FROM 'number'
       OR jsonb_typeof(task_row->'startOffsetDays') IS DISTINCT FROM 'number'
       OR jsonb_typeof(task_row->'durationDays') IS DISTINCT FROM 'number'
       OR (task_row->>'effortHours')::numeric <= 0
       OR (task_row->>'startOffsetDays')::numeric < 0
       OR (task_row->>'durationDays')::numeric <= 0
       OR (task_row->>'startOffsetDays')::numeric <> trunc((task_row->>'startOffsetDays')::numeric)
       OR (task_row->>'durationDays')::numeric <> trunc((task_row->>'durationDays')::numeric)
       OR (task_row->>'startOffsetDays')::numeric + (task_row->>'durationDays')::numeric > stage_days THEN
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
