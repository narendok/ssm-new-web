-- An unclassified department role must not inherit feasibility-lead authority.
-- Direct department leads retain their explicit department assignment.
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
      AND role.hierarchy_level=1
      AND assignment.member_id=p_member AND assignment.active
      AND permission.permission_key='records:edit'
  );
$$;
REVOKE ALL ON FUNCTION private.can_manage_department_feasibility(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
