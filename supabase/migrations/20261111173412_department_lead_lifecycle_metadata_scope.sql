-- Lead task edits may mint a new revision id/time, but must preserve all other
-- lifecycle metadata, stages, RACI and tasks outside the lead's departments.
CREATE OR REPLACE FUNCTION private.assert_department_task_settings_scope(
 p_organization uuid, p_current jsonb, p_proposed jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE allowed_codes text[]; stage_count integer; i integer; old_stage jsonb; new_stage jsonb; old_tasks jsonb; new_tasks jsonb;
BEGIN
 SELECT COALESCE(array_agg(d.code),'{}'::text[]) INTO allowed_codes
 FROM public.departments d
 WHERE d.organization_id=p_organization AND d.active AND d.code<>'CLIENT'
   AND private.member_can_manage_department_settings(p_organization,d.id);
 IF cardinality(allowed_codes)=0 THEN RAISE EXCEPTION 'LIFECYCLE_SETTINGS_PERMISSION_REQUIRED'; END IF;
 IF p_current IS NULL OR p_proposed IS NULL OR jsonb_typeof(p_current->'stages') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_proposed->'stages') IS DISTINCT FROM 'array'
    OR (p_current-'stages'-'id'-'createdAt') IS DISTINCT FROM (p_proposed-'stages'-'id'-'createdAt') THEN
   RAISE EXCEPTION 'DEPARTMENT_LIFECYCLE_SCOPE_DENIED';
 END IF;
 stage_count:=jsonb_array_length(p_current->'stages');
 IF stage_count<>jsonb_array_length(p_proposed->'stages') THEN RAISE EXCEPTION 'DEPARTMENT_LIFECYCLE_SCOPE_DENIED'; END IF;
 IF stage_count>0 THEN
  FOR i IN 0..stage_count-1 LOOP
   old_stage:=p_current->'stages'->i; new_stage:=p_proposed->'stages'->i;
   IF (old_stage-'tasks') IS DISTINCT FROM (new_stage-'tasks') THEN
    RAISE EXCEPTION 'DEPARTMENT_LIFECYCLE_SCOPE_DENIED';
   END IF;
   SELECT COALESCE(jsonb_agg(task_row.task ORDER BY task_row.ordinality),'[]'::jsonb) INTO old_tasks
   FROM jsonb_array_elements(COALESCE(old_stage->'tasks','[]'::jsonb)) WITH ORDINALITY task_row(task,ordinality)
   WHERE NOT COALESCE(task_row.task->>'department'=ANY(allowed_codes),false);
   SELECT COALESCE(jsonb_agg(task_row.task ORDER BY task_row.ordinality),'[]'::jsonb) INTO new_tasks
   FROM jsonb_array_elements(COALESCE(new_stage->'tasks','[]'::jsonb)) WITH ORDINALITY task_row(task,ordinality)
   WHERE NOT COALESCE(task_row.task->>'department'=ANY(allowed_codes),false);
   IF old_tasks IS DISTINCT FROM new_tasks THEN RAISE EXCEPTION 'DEPARTMENT_LIFECYCLE_SCOPE_DENIED'; END IF;
  END LOOP;
 END IF;
END $$;
REVOKE ALL ON FUNCTION private.assert_department_task_settings_scope(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
