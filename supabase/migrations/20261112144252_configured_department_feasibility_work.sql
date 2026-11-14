-- Let a lead work across the departments explicitly assigned to them in the
-- organization chart. Their primary department remains the default; every
-- selected department is re-authorized by the server.

CREATE OR REPLACE FUNCTION private.can_manage_department_feasibility(
  p_organization uuid,
  p_department uuid,
  p_member uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.departments d
    WHERE d.id=p_department AND d.organization_id=p_organization AND d.active
      AND d.lead_member_id=p_member
  ) OR EXISTS (
    SELECT 1
    FROM public.department_role_assignments assignment
    JOIN public.department_roles role ON role.id=assignment.role_id AND role.active
    JOIN public.role_permissions permission ON permission.role_id=role.id AND permission.allowed
    JOIN public.organization_members member ON member.id=assignment.member_id
      AND member.organization_id=role.organization_id AND member.active AND member.role IN ('department_lead','member')
    WHERE role.organization_id=p_organization AND role.department_id=p_department
      AND (role.hierarchy_level IS NULL OR role.hierarchy_level=1)
      AND assignment.member_id=p_member AND assignment.active
      AND permission.permission_key='records:edit'
  );
$$;
REVOKE ALL ON FUNCTION private.can_manage_department_feasibility(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;

DO $migration$
DECLARE
  definition text := pg_get_functiondef('public.get_project_input_sheets()'::regprocedure);
  old_case constant text := $old$WHEN a.role = 'admin' OR a.department_code = 'FIN' THEN to_jsonb(s)
          ELSE jsonb_set(
            to_jsonb(s), '{department_estimates}',
            CASE WHEN a.department_code IS NOT NULL AND s.department_estimates ? a.department_code
              THEN jsonb_build_object(a.department_code, s.department_estimates->a.department_code)
              ELSE '{}'::jsonb END,
            true
          )$old$;
  new_case constant text := $new$WHEN a.role = 'admin' OR a.department_code = 'FIN' THEN to_jsonb(s)
          ELSE jsonb_set(
            to_jsonb(s), '{department_estimates}',
            COALESCE((
              SELECT jsonb_object_agg(entry.key, entry.value)
              FROM jsonb_each(s.department_estimates) entry
              JOIN departments d ON d.organization_id=s.organization_id AND d.code=entry.key AND d.active
              WHERE private.can_manage_department_feasibility(a.organization_id,d.id,a.membership_id)
            ),'{}'::jsonb),
            true
          )$new$;
BEGIN
  IF length(definition)-length(replace(definition,old_case,''))<>length(old_case) THEN
    RAISE EXCEPTION 'FEASIBILITY_DEPARTMENT_VISIBILITY_PATCH_PRECONDITION';
  END IF;
  EXECUTE replace(definition,old_case,new_case);
END $migration$;

DO $migration$
DECLARE
  definition text := pg_get_functiondef('public.mutate_project_input_sheet(text,jsonb)'::regprocedure);
  department_check constant text := $old$IF a.department_code IS DISTINCT FROM review_dept THEN RAISE EXCEPTION 'INPUT_DEPARTMENT_DENIED'; END IF;$old$;
  scoped_department_check constant text := $new$IF NOT EXISTS(
       SELECT 1 FROM departments d WHERE d.organization_id=a.organization_id AND d.code=review_dept
         AND d.active AND private.can_manage_department_feasibility(a.organization_id,d.id,a.membership_id)
     ) THEN RAISE EXCEPTION 'INPUT_DEPARTMENT_DENIED'; END IF;$new$;
  review_role_check constant text := $role$IF a.role<>'department_lead' THEN RAISE EXCEPTION 'INPUT_REVIEW_LEAD_REQUIRED'; END IF;$role$;
  review_permission_check constant text := $permission$IF NOT EXISTS(
       SELECT 1 FROM departments d WHERE d.organization_id=a.organization_id AND d.code=review_dept
         AND d.active AND public.has_department_permission(a.organization_id,d.id,'records:edit')
     ) THEN RAISE EXCEPTION 'INPUT_REVIEW_LEAD_REQUIRED'; END IF;$permission$;
  owner_check constant text := $owner$AND private.shared_test_member_department(m.id)=private.shared_test_member_department(a.membership_id)$owner$;
  owner_check_scoped constant text := $owner_new$AND private.shared_test_member_department(m.id)=(SELECT d.id FROM departments d WHERE d.organization_id=a.organization_id AND d.code=review_dept AND d.active)$owner_new$;
BEGIN
  IF length(definition)-length(replace(definition,department_check,''))<>length(department_check)
     OR length(definition)-length(replace(definition,review_role_check,''))<>length(review_role_check)
     OR length(definition)-length(replace(definition,owner_check,''))<>length(owner_check) THEN
    RAISE EXCEPTION 'FEASIBILITY_ROLE_ROUTING_PATCH_PRECONDITION department=% review=% owner=%',
      strpos(definition,department_check),strpos(definition,review_role_check),strpos(definition,owner_check);
  END IF;
  definition:=replace(definition,department_check,scoped_department_check);
  definition:=replace(definition,review_role_check,review_permission_check);
  definition:=replace(definition,owner_check,owner_check_scoped);
  EXECUTE definition;
END $migration$;

DO $migration$
DECLARE
  definition text := pg_get_functiondef('public.save_project_department_feasibility_estimate(uuid,integer,jsonb)'::regprocedure);
  old_authority constant text := $old$IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client
     OR a.role <> 'department_lead' OR a.department_code IS NULL THEN
    RAISE EXCEPTION 'FEASIBILITY_ESTIMATE_LEAD_REQUIRED';
  END IF;$old$;
  new_authority constant text := $new$IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client
     OR a.role <> 'department_lead' THEN
    RAISE EXCEPTION 'FEASIBILITY_ESTIMATE_LEAD_REQUIRED';
  END IF;$new$;
  old_department constant text := $old$dept := a.department_code;$old$;
  new_department constant text := $new$dept := COALESCE(NULLIF(p_estimate->>'departmentCode',''),a.department_code);
  IF dept IS NULL OR NOT EXISTS(
    SELECT 1 FROM departments d WHERE d.organization_id=a.organization_id AND d.code=dept AND d.active AND d.code<>'CLIENT'
      AND private.can_manage_department_feasibility(a.organization_id,d.id,a.membership_id)
  ) THEN RAISE EXCEPTION 'FEASIBILITY_ESTIMATE_DEPARTMENT_DENIED'; END IF;$new$;
  old_store constant text := $old$s.department_estimates := COALESCE(s.department_estimates,'{}'::jsonb)
    || jsonb_build_object(dept, p_estimate);$old$;
  new_store constant text := $new$s.department_estimates := COALESCE(s.department_estimates,'{}'::jsonb)
    || jsonb_build_object(dept, p_estimate - 'departmentCode');$new$;
  old_return constant text := $old$RETURN jsonb_set(response,'{department_estimates}',jsonb_build_object(dept,p_estimate),true);$old$;
  new_return constant text := $new$RETURN jsonb_set(response,'{department_estimates}',jsonb_build_object(dept,p_estimate-'departmentCode'),true);$new$;
BEGIN
  IF length(definition)-length(replace(definition,old_authority,''))<>length(old_authority)
     OR length(definition)-length(replace(definition,old_department,''))<>length(old_department)
     OR length(definition)-length(replace(definition,old_store,''))<>length(old_store)
     OR length(definition)-length(replace(definition,old_return,''))<>length(old_return) THEN
    RAISE EXCEPTION 'FEASIBILITY_ESTIMATE_ROLE_SCOPE_PATCH_PRECONDITION';
  END IF;
  definition:=replace(definition,old_authority,new_authority);
  definition:=replace(definition,old_department,new_department);
  definition:=replace(definition,old_store,new_store);
  definition:=replace(definition,old_return,new_return);
  EXECUTE definition;
END $migration$;
