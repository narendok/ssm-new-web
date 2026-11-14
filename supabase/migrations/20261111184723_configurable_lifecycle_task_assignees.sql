-- Optional task assignees are stored on lifecycle defaults by stable organization
-- member id. Null keeps the existing dynamic department-lead assignment.
CREATE OR REPLACE FUNCTION private.validate_lifecycle_task_assignees(
  p_organization uuid,
  p_definition jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  stage_row jsonb;
  task_row jsonb;
  assignee uuid;
  department_id uuid;
BEGIN
  FOR stage_row IN SELECT value FROM jsonb_array_elements(p_definition->'stages') LOOP
    FOR task_row IN SELECT value FROM jsonb_array_elements(coalesce(stage_row->'tasks','[]'::jsonb)) LOOP
      IF nullif(task_row->>'assigneeMemberId','') IS NULL THEN CONTINUE; END IF;
      assignee := (task_row->>'assigneeMemberId')::uuid;
      SELECT d.id INTO department_id
      FROM public.departments d
      WHERE d.organization_id=p_organization AND d.code=task_row->>'department'
        AND d.active AND d.code<>'CLIENT';
      IF department_id IS NULL OR NOT EXISTS(
        SELECT 1
        FROM public.organization_members m
        WHERE m.id=assignee AND m.organization_id=p_organization AND m.active
          AND m.role IN ('department_lead','member')
          AND (
            EXISTS(SELECT 1 FROM public.departments d WHERE d.id=department_id AND d.lead_member_id=m.id)
            OR EXISTS(
              SELECT 1 FROM public.department_role_assignments a
              JOIN public.department_roles r ON r.id=a.role_id AND r.active
              WHERE a.member_id=m.id AND a.active AND r.organization_id=p_organization
                AND r.department_id=department_id
            )
          )
      ) THEN
        RAISE EXCEPTION 'LIFECYCLE_TASK_ASSIGNEE_NOT_IN_DEPARTMENT: %', task_row->>'department';
      END IF;
    END LOOP;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION private.validate_lifecycle_task_assignees(uuid,jsonb) FROM PUBLIC,anon,authenticated;

-- Validate chosen assignees before accepting a new shared lifecycle revision.
DO $patch$
DECLARE definition text; needle text; replacement text;
BEGIN
  definition:=pg_get_functiondef('public.mutate_lifecycle_workspace(text,jsonb,uuid)'::regprocedure);
  needle:='definition:=p_payload->''definition''; PERFORM private.validate_lifecycle_definition(definition);';
  replacement:=needle||' PERFORM private.validate_lifecycle_task_assignees(a.organization_id,definition);';
  IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'LIFECYCLE_ASSIGNEE_VALIDATION_PATCH_PRECONDITION'; END IF;
  definition:=replace(definition,needle,replacement);
  EXECUTE definition;
END;
$patch$;

-- Use an explicitly configured member for newly generated tasks. Existing tasks
-- and their assignments are never changed by this trigger replacement.
CREATE OR REPLACE FUNCTION private.sync_pinned_lifecycle_work()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  prerequisites jsonb;
  baseline jsonb;
  stage jsonb;
  task jsonb;
  prerequisite text;
  target text;
  track text;
  dept uuid;
  assignee uuid;
  previous text;
  required_type text;
  idx int:=0;
  completed jsonb;
BEGIN
  IF NEW.record_type<>'Project' OR NOT private.is_shared_test_org(NEW.organization_id)
     OR nullif(NEW.fields->>'lifecycleBaseline','') IS NULL THEN RETURN NEW; END IF;
  baseline:=(NEW.fields->>'lifecycleBaseline')::jsonb;
  IF NOT EXISTS(
    SELECT 1 FROM private.lifecycle_revisions
    WHERE organization_id=NEW.organization_id AND definition=baseline
  ) THEN RAISE EXCEPTION 'UNREGISTERED_PROJECT_BASELINE'; END IF;
  target:=coalesce(NEW.fields->>'currentStage',NEW.stage,'CM_01');
  IF TG_OP='UPDATE' THEN
    IF NEW.fields->>'lifecycleBaseline' IS DISTINCT FROM OLD.fields->>'lifecycleBaseline' THEN
      RAISE EXCEPTION 'BASELINE_MIGRATION_REQUIRES_REVIEW';
    END IF;
    previous:=coalesce(OLD.fields->>'currentStage',OLD.stage,'CM_01');
    IF previous=target THEN RETURN NEW; END IF;
    IF EXISTS(
      SELECT 1 FROM public.tasks WHERE record_id=NEW.id AND stage_code=previous
        AND lower(status) NOT IN ('complete','completed','done','approved','cancelled')
    ) THEN RAISE EXCEPTION 'CURRENT_STAGE_WORK_INCOMPLETE'; END IF;
    FOR required_type IN
      SELECT jsonb_array_elements_text(s->'exitTypes')
      FROM jsonb_array_elements(baseline->'stages') s WHERE s->>'code'=previous
    LOOP
      IF NOT EXISTS(
        SELECT 1 FROM public.operational_records r
        WHERE r.organization_id=NEW.organization_id AND r.record_type=required_type
          AND lower(r.status::text) IN ('approved','released') AND r.archived_at IS NULL
          AND r.fields->>'projectId' IN (NEW.id::text,NEW.reference)
          AND coalesce(r.fields->>'lifecycleStage',r.stage)=previous
      ) THEN RAISE EXCEPTION 'REQUIRED_EXIT_EVIDENCE_MISSING: %',required_type; END IF;
    END LOOP;
  END IF;
  SELECT value INTO stage FROM jsonb_array_elements(baseline->'stages') WHERE value->>'code'=target;
  IF stage IS NULL THEN RAISE EXCEPTION 'PINNED_STAGE_MISSING'; END IF;
  track:=coalesce(NEW.fields->>'track',NEW.fields->>'projectTrack');
  IF NOT public.is_stage_applicable_to_track(target,track) THEN RAISE EXCEPTION 'PINNED_STAGE_NOT_APPLICABLE'; END IF;
  completed:=coalesce(NEW.fields->'completedStages','[]'::jsonb);
  SELECT CASE WHEN to_jsonb(c.prerequisites)=stage->'prerequisites'
    THEN to_jsonb(public.resolve_canonical_stage_prerequisites(target,track))
    ELSE stage->'prerequisites' END INTO prerequisites
  FROM public.canonical_stage_templates c WHERE c.stage_code=target;
  FOR prerequisite IN SELECT jsonb_array_elements_text(prerequisites) LOOP
    IF public.is_stage_applicable_to_track(prerequisite,track) AND NOT (completed ? prerequisite) THEN
      RAISE EXCEPTION 'PINNED_PREREQUISITE_INCOMPLETE: %',prerequisite;
    END IF;
  END LOOP;
  FOR task IN SELECT value FROM jsonb_array_elements(stage->'tasks') LOOP
    idx:=idx+1;
    SELECT id INTO dept FROM public.departments
    WHERE organization_id=NEW.organization_id AND code=task->>'department' AND active;
    IF dept IS NULL THEN RAISE EXCEPTION 'TASK_OWNER_DEPARTMENT_MISSING'; END IF;
    assignee:=nullif(task->>'assigneeMemberId','')::uuid;
    IF assignee IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM public.organization_members m
      WHERE m.id=assignee AND m.organization_id=NEW.organization_id AND m.active
        AND m.role IN ('department_lead','member')
        AND (
          EXISTS(SELECT 1 FROM public.departments d WHERE d.id=dept AND d.lead_member_id=m.id)
          OR EXISTS(
            SELECT 1 FROM public.department_role_assignments a
            JOIN public.department_roles r ON r.id=a.role_id AND r.active
            WHERE a.member_id=m.id AND a.active AND r.organization_id=NEW.organization_id
              AND r.department_id=dept
          )
        )
    ) THEN RAISE EXCEPTION 'LIFECYCLE_TASK_ASSIGNEE_NOT_IN_DEPARTMENT'; END IF;
    INSERT INTO public.tasks(
      organization_id,department_id,record_id,title,task_type,status,priority,stage_code,
      is_custom,order_index,template_task_key,created_by,assignee_id
    )
    SELECT NEW.organization_id,dept,NEW.id,task->>'title','Lifecycle','Open','Normal',target,
      false,idx,'LC-TG:'||(baseline->>'id')||':'||target||':'||(task->>'id'),NEW.created_by,assignee
    WHERE NOT EXISTS(
      SELECT 1 FROM public.tasks WHERE record_id=NEW.id
        AND template_task_key='LC-TG:'||(baseline->>'id')||':'||target||':'||(task->>'id')
    );
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.sync_pinned_lifecycle_work() FROM PUBLIC,anon,authenticated;
