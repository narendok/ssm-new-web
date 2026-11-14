-- A department's explicitly configured lead may manage that department's
-- lifecycle default tasks. Delegated non-lead roles still need settings:manage.
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
