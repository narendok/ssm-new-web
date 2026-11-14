-- Allow an explicitly configured department role to maintain only its own
-- default task templates. Phase definitions, stage ownership, RACI and other
-- departments' task defaults remain protected by the current revision.
CREATE OR REPLACE FUNCTION private.member_can_manage_department_settings(p_organization uuid,p_department uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(
  SELECT 1 FROM public.departments d
  JOIN public.organization_members m ON m.id=d.lead_member_id AND m.active AND m.user_id=auth.uid()
  WHERE d.organization_id=p_organization AND d.id=p_department AND d.active AND d.code<>'CLIENT'
 ) OR EXISTS(
  SELECT 1 FROM public.department_roles r
  JOIN public.department_role_assignments a ON a.role_id=r.id AND a.active
  JOIN public.role_permissions p ON p.role_id=r.id AND p.allowed AND p.permission_key='settings:manage'
  JOIN public.organization_members m ON m.id=a.member_id AND m.active AND m.user_id=auth.uid()
  WHERE r.organization_id=p_organization AND r.department_id=p_department AND r.active
 )
$$;
REVOKE ALL ON FUNCTION private.member_can_manage_department_settings(uuid,uuid) FROM PUBLIC,anon,authenticated;

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
    OR (p_current-'stages') IS DISTINCT FROM (p_proposed-'stages') THEN
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

DO $patch$
DECLARE definition text; needle text; replacement text;
BEGIN
 definition:=pg_get_functiondef('public.mutate_lifecycle_workspace(text,jsonb,uuid)'::regprocedure);
 needle:='IF a.role<>''admin'' THEN RAISE EXCEPTION ''LIFECYCLE_SETTINGS_ADMIN_REQUIRED''; END IF;';
 replacement:='IF a.role<>''admin'' AND NOT EXISTS(SELECT 1 FROM public.departments d WHERE d.organization_id=a.organization_id AND d.active AND d.code<>''CLIENT'' AND private.member_can_manage_department_settings(a.organization_id,d.id)) THEN RAISE EXCEPTION ''LIFECYCLE_SETTINGS_PERMISSION_REQUIRED''; END IF;';
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'DEPARTMENT_LIFECYCLE_SETTINGS_PATCH_PRECONDITION'; END IF;
 definition:=replace(definition,needle,replacement);
 needle:='definition:=p_payload->''definition''; PERFORM private.validate_lifecycle_definition(definition);';
 replacement:=needle||' IF a.role<>''admin'' THEN PERFORM private.assert_department_task_settings_scope(a.organization_id,(SELECT current_revision.definition FROM private.lifecycle_revisions current_revision WHERE current_revision.id=latest),definition); END IF;';
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'DEPARTMENT_TASK_SCOPE_PATCH_PRECONDITION'; END IF;
 definition:=replace(definition,needle,replacement);
 EXECUTE definition;
END $patch$;
