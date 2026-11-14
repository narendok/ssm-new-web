ALTER TABLE public.departments ADD COLUMN ticket_groups jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(ticket_groups)='array'), ADD COLUMN workspace_department_id uuid REFERENCES public.departments(id);
UPDATE public.departments SET ticket_groups='["service","it"]'::jsonb WHERE code='SIT' AND private.is_shared_test_org(organization_id);
-- Use the existing organization department master for portal settings and all read views.
CREATE OR REPLACE FUNCTION public.get_organization_configuration() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record;
BEGIN
 SELECT * INTO a FROM public.resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client OR NOT private.is_shared_test_org(a.organization_id) THEN RAISE EXCEPTION 'CONFIGURATION_READ_DENIED'; END IF;
 RETURN jsonb_build_object('canManage',a.role='admin',
 'departments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'code',d.code,'name',d.name,'type',d.department_type,'active',d.active,'sortOrder',d.sort_order,'leadMemberId',d.lead_member_id,'updatedAt',d.updated_at,'ticketGroups',d.ticket_groups,'workspaceDepartmentId',d.workspace_department_id) ORDER BY d.sort_order,d.name) FROM public.departments d WHERE d.organization_id=a.organization_id AND d.code<>'CLIENT'),'[]'::jsonb),
 'leads',coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'name',coalesce(m.display_name,'Unnamed lead'),'departmentId',private.shared_test_member_department(m.id))) FROM public.organization_members m WHERE m.organization_id=a.organization_id AND m.active AND m.role='department_lead'),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.get_organization_configuration() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_organization_configuration() TO authenticated;

CREATE OR REPLACE FUNCTION public.update_organization_department(p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; d public.departments%ROWTYPE; next_lead uuid; next_active boolean; next_name text; next_type text;
BEGIN
 SELECT * INTO a FROM public.resolve_test_membership();
 IF auth.uid() IS NULL OR a.role<>'admin' OR a.is_client OR NOT private.is_shared_test_org(a.organization_id) THEN RAISE EXCEPTION 'DEPARTMENT_CONFIGURATION_ADMIN_REQUIRED'; END IF;
 SELECT * INTO d FROM public.departments WHERE id=(p_payload->>'id')::uuid AND organization_id=a.organization_id AND code<>'CLIENT' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DEPARTMENT_NOT_FOUND'; END IF;
 IF nullif(p_payload->>'expectedUpdatedAt','') IS NULL OR d.updated_at IS DISTINCT FROM (p_payload->>'expectedUpdatedAt')::timestamptz THEN RAISE EXCEPTION 'STALE_DEPARTMENT_CONFIGURATION'; END IF;
 next_name:=trim(p_payload->>'name');next_type:=trim(p_payload->>'type');next_lead:=nullif(p_payload->>'leadMemberId','')::uuid;next_active:=(p_payload->>'active')::boolean;
 IF length(coalesce(next_name,'')) NOT BETWEEN 1 AND 160 OR length(coalesce(next_type,'')) NOT BETWEEN 1 AND 160 OR next_active IS NULL OR (p_payload->>'sortOrder')::integer NOT BETWEEN 0 AND 999 THEN RAISE EXCEPTION 'INVALID_DEPARTMENT_CONFIGURATION'; END IF;
 IF next_lead IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.organization_members m WHERE m.id=next_lead AND m.organization_id=a.organization_id AND m.active AND m.role='department_lead' AND (private.shared_test_member_department(m.id) IS NULL OR private.shared_test_member_department(m.id)=d.id)) THEN RAISE EXCEPTION 'CHOOSE_ACTIVE_LEAD_IN_THIS_DEPARTMENT'; END IF;
 IF NOT next_active AND d.active AND (
  EXISTS(SELECT 1 FROM public.tasks WHERE organization_id=a.organization_id AND department_id=d.id AND lower(status) NOT IN ('complete','cancelled'))
  OR EXISTS(SELECT 1 FROM public.approvals WHERE organization_id=a.organization_id AND reviewer_department_id=d.id AND outcome='pending')
  OR EXISTS(SELECT 1 FROM private.lifecycle_revisions l CROSS JOIN LATERAL jsonb_array_elements(l.definition->'stages') s WHERE l.id=(SELECT id FROM private.lifecycle_revisions WHERE organization_id=a.organization_id ORDER BY version DESC LIMIT 1) AND (s->>'department'=d.code OR EXISTS(SELECT 1 FROM jsonb_array_elements(s->'tasks') t WHERE t->>'department'=d.code) OR EXISTS(SELECT 1 FROM jsonb_each(coalesce(s->'raci','{}'::jsonb)) role WHERE role.value ? d.code)))) THEN RAISE EXCEPTION 'DEPARTMENT_HAS_ACTIVE_WORK_OR_LIFECYCLE_DEFAULTS'; END IF;
 IF p_payload ? 'ticketGroups' AND (jsonb_typeof(p_payload->'ticketGroups') <> 'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_payload->'ticketGroups') g WHERE g NOT IN ('service','it'))) THEN RAISE EXCEPTION 'INVALID_WORKSPACE_RESPONSIBILITIES'; END IF;
 IF nullif(p_payload->>'workspaceDepartmentId','') IS NOT NULL AND (EXISTS(SELECT 1 FROM public.departments child WHERE child.workspace_department_id=d.id) OR NOT EXISTS(SELECT 1 FROM public.departments parent WHERE parent.id=(p_payload->>'workspaceDepartmentId')::uuid AND parent.id<>d.id AND parent.organization_id=a.organization_id AND parent.active AND parent.code<>'CLIENT' AND parent.workspace_department_id IS NULL)) THEN RAISE EXCEPTION 'CHOOSE_ACTIVE_MAIN_WORKSPACE'; END IF;
 UPDATE public.departments SET ticket_groups=CASE WHEN p_payload ? 'ticketGroups' THEN p_payload->'ticketGroups' ELSE ticket_groups END,workspace_department_id=CASE WHEN p_payload ? 'workspaceDepartmentId' THEN nullif(p_payload->>'workspaceDepartmentId','')::uuid ELSE workspace_department_id END,name=next_name,department_type=next_type,lead_member_id=next_lead,active=next_active,sort_order=(p_payload->>'sortOrder')::integer,updated_at=now() WHERE id=d.id;
 INSERT INTO public.audit_events(organization_id,actor_id,entity_type,entity_id,action,detail) VALUES(a.organization_id,auth.uid(),'department',d.id,'Department configuration updated',jsonb_build_object('code',d.code,'name',next_name,'active',next_active,'leadChanged',next_lead IS DISTINCT FROM d.lead_member_id));
 RETURN public.get_organization_configuration();
END $$;
REVOKE ALL ON FUNCTION public.update_organization_department(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_organization_department(jsonb) TO authenticated;
