-- Persist department sub-roles, permissions and multi-role assignments in Shared TEST.
-- The EOL Testing lead is an EMF role; legacy TST history is left untouched.
INSERT INTO public.department_roles(organization_id,department_id,name,role_key,active)
SELECT d.organization_id,d.id,'EOL Testing lead','eol_testing_lead',true
FROM public.departments d
WHERE d.code='EMF' AND d.active AND private.is_shared_test_org(d.organization_id)
ON CONFLICT (organization_id,department_id,role_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_shared_department_role_configuration()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a record;
BEGIN
 SELECT * INTO a FROM public.resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client OR NOT private.is_shared_test_org(a.organization_id) THEN
  RAISE EXCEPTION 'ROLE_CONFIGURATION_READ_DENIED';
 END IF;
 RETURN jsonb_build_object(
  'canManage',a.role='admin',
  'departments',COALESCE((
   SELECT jsonb_agg(jsonb_build_object('id',d.id,'code',d.code,'name',d.name,'active',d.active,'leadMemberId',d.lead_member_id) ORDER BY d.sort_order,d.name)
   FROM public.departments d WHERE d.organization_id=a.organization_id AND d.active AND d.code<>'CLIENT'
  ),'[]'::jsonb),
  'members',COALESCE((
   SELECT jsonb_agg(jsonb_build_object('id',m.id,'name',COALESCE(m.display_name,'Unnamed member'),'role',m.role,'departmentId',private.shared_test_member_department(m.id)) ORDER BY m.display_name,m.id)
   FROM public.organization_members m WHERE m.organization_id=a.organization_id AND m.active AND m.role IN ('department_lead','member')
  ),'[]'::jsonb),
  'roles',COALESCE((
   SELECT jsonb_agg(jsonb_build_object(
    'id',r.id,'departmentId',d.id,'departmentCode',d.code,'departmentName',d.name,'name',r.name,'roleKey',r.role_key,'active',r.active,'updatedAt',r.updated_at,
    'permissions',COALESCE((SELECT jsonb_agg(p.permission_key ORDER BY p.permission_key) FROM public.role_permissions p WHERE p.role_id=r.id AND p.allowed),'[]'::jsonb),
    'memberIds',COALESCE((SELECT jsonb_agg(ra.member_id ORDER BY ra.member_id) FROM public.department_role_assignments ra WHERE ra.role_id=r.id AND ra.active),'[]'::jsonb)
   ) ORDER BY d.sort_order,r.name)
   FROM public.department_roles r JOIN public.departments d ON d.id=r.department_id AND d.organization_id=r.organization_id
   WHERE r.organization_id=a.organization_id AND d.code<>'CLIENT'
  ),'[]'::jsonb)
 );
END $$;
REVOKE ALL ON FUNCTION public.get_shared_department_role_configuration() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_shared_department_role_configuration() TO authenticated;

CREATE OR REPLACE FUNCTION public.save_shared_department_role(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; d public.departments%ROWTYPE; r public.department_roles%ROWTYPE; saved_role_id uuid; supplied_id uuid; expected timestamptz; role_name text; role_key text; role_active boolean; member_ids uuid[]; permission_keys text[];
BEGIN
 SELECT * INTO a FROM public.resolve_test_membership();
 IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.role<>'admin' OR a.is_client OR NOT private.is_shared_test_org(a.organization_id) THEN
  RAISE EXCEPTION 'ROLE_CONFIGURATION_ADMIN_REQUIRED';
 END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR jsonb_typeof(p_payload->'permissions')<>'array' OR jsonb_typeof(p_payload->'memberIds')<>'array' THEN
  RAISE EXCEPTION 'INVALID_ROLE_CONFIGURATION';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a.organization_id::text,0));
 SELECT * INTO d FROM public.departments WHERE id=(p_payload->>'departmentId')::uuid AND organization_id=a.organization_id AND active AND code<>'CLIENT' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_DEPARTMENT_REQUIRED'; END IF;
 role_name:=trim(p_payload->>'name'); role_key:=trim(p_payload->>'roleKey'); role_active:=(p_payload->>'active')::boolean;
 IF length(COALESCE(role_name,'')) NOT BETWEEN 2 AND 100 OR role_key IS NULL OR role_key !~ '^[a-z][a-z0-9_]{1,63}$' OR role_active IS NULL THEN RAISE EXCEPTION 'INVALID_ROLE_DETAILS'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_payload->'permissions') x WHERE x NOT IN ('records:view','records:create','records:edit','tasks:assign','approvals:decide','documents:manage','settings:manage','audit:manage','documents:approve')) THEN
  RAISE EXCEPTION 'INVALID_ROLE_PERMISSION';
 END IF;
 SELECT COALESCE(array_agg(DISTINCT x::uuid),'{}'::uuid[]) INTO member_ids FROM jsonb_array_elements_text(p_payload->'memberIds') x;
 IF EXISTS(SELECT 1 FROM unnest(member_ids) member_id LEFT JOIN public.organization_members m ON m.id=member_id AND m.organization_id=a.organization_id AND m.active AND m.role IN ('department_lead','member') WHERE m.id IS NULL) THEN
  RAISE EXCEPTION 'ACTIVE_ORGANIZATION_MEMBER_REQUIRED';
 END IF;
 SELECT COALESCE(array_agg(DISTINCT x),'{}'::text[]) INTO permission_keys FROM jsonb_array_elements_text(p_payload->'permissions') x;
 IF role_active AND cardinality(member_ids)>0 AND NOT ('records:view'=ANY(permission_keys)) THEN RAISE EXCEPTION 'ROLE_VIEW_PERMISSION_REQUIRED'; END IF;
 supplied_id:=NULLIF(p_payload->>'id','')::uuid;
 IF supplied_id IS NULL THEN
  INSERT INTO public.department_roles(organization_id,department_id,name,role_key,active) VALUES(a.organization_id,d.id,role_name,role_key,role_active) RETURNING * INTO r;
 ELSE
  SELECT * INTO r FROM public.department_roles WHERE id=supplied_id AND organization_id=a.organization_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ROLE_NOT_FOUND'; END IF;
  expected:=NULLIF(p_payload->>'expectedUpdatedAt','')::timestamptz;
  IF expected IS NULL OR r.updated_at IS DISTINCT FROM expected THEN RAISE EXCEPTION 'STALE_ROLE_CONFIGURATION'; END IF;
  IF r.department_id IS DISTINCT FROM d.id OR r.role_key IS DISTINCT FROM role_key THEN RAISE EXCEPTION 'ROLE_IDENTITY_IMMUTABLE'; END IF;
  UPDATE public.department_roles SET name=role_name,active=role_active,updated_at=now() WHERE id=r.id RETURNING * INTO r;
 END IF;
 saved_role_id:=r.id;
 DELETE FROM public.role_permissions WHERE role_id=saved_role_id;
 INSERT INTO public.role_permissions(role_id,permission_key,allowed) SELECT saved_role_id,x,true FROM unnest(permission_keys) x;
 UPDATE public.department_role_assignments SET active=false WHERE role_id=saved_role_id AND active AND NOT (member_id=ANY(member_ids));
 INSERT INTO public.department_role_assignments(role_id,member_id,assigned_by,active)
 SELECT saved_role_id,x,auth.uid(),true FROM unnest(member_ids) x
 ON CONFLICT(role_id,member_id) DO UPDATE SET active=true,assigned_by=auth.uid(),updated_at=now();
 INSERT INTO public.audit_events(organization_id,actor_id,entity_type,entity_id,action,detail)
 VALUES(a.organization_id,auth.uid(),'department_role',saved_role_id,'Department role configuration saved',jsonb_build_object('department_id',d.id,'role_key',role_key,'active',role_active,'permissions',permission_keys,'member_ids',member_ids));
 RETURN public.get_shared_department_role_configuration();
END $$;
REVOKE ALL ON FUNCTION public.save_shared_department_role(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_shared_department_role(jsonb) TO authenticated;

-- Role assignments are useful only when their saved permissions authorize the
-- corresponding RACI action. Preserve direct department-lead behavior while
-- enabling explicitly assigned member roles in Shared TEST.
DO $role_gate$
DECLARE d text; old text; replacement text;
BEGIN
 IF to_regprocedure('private.shared_test_member_has_department(uuid,uuid)') IS NULL THEN RETURN; END IF;

 d:=pg_get_functiondef('private.request_canonical_stage_review(jsonb)'::regprocedure);
 old:='IF auth.uid() IS NULL OR a.role NOT IN (''admin'',''department_lead'') THEN RAISE EXCEPTION ''STAGE_REVIEW_DENIED''; END IF;';
 replacement:='IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client THEN RAISE EXCEPTION ''STAGE_REVIEW_DENIED''; END IF;';
 IF strpos(d,old)>0 THEN d:=replace(d,old,replacement); END IF;
 old:=$source$IF a.role<>'admin' AND ((private.project_stage_responsibility(r.id,stage) IS NULL AND private.shared_test_member_department(a.membership_id) IS DISTINCT FROM owner_id) OR (private.project_stage_responsibility(r.id,stage) IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(private.project_stage_responsibility(r.id,stage)->'R') rc(code) JOIN public.departments dep ON dep.organization_id=a.organization_id AND dep.code=rc.code WHERE private.shared_test_scope(a.organization_id,dep.id)))) THEN RAISE EXCEPTION 'STAGE_REVIEW_DENIED'; END IF;$source$;
 replacement:=$target$IF a.role<>'admin' AND ((private.project_stage_responsibility(r.id,stage) IS NULL AND (NOT private.shared_test_scope(a.organization_id,owner_id) OR NOT public.has_department_permission(a.organization_id,owner_id,'records:edit'))) OR (private.project_stage_responsibility(r.id,stage) IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(private.project_stage_responsibility(r.id,stage)->'R') rc(code) JOIN public.departments dep ON dep.organization_id=a.organization_id AND dep.code=rc.code WHERE private.shared_test_scope(a.organization_id,dep.id) AND public.has_department_permission(a.organization_id,dep.id,'records:edit')))) THEN RAISE EXCEPTION 'STAGE_REVIEW_DENIED'; END IF;$target$;
 IF strpos(d,old)>0 THEN d:=replace(d,old,replacement);
 ELSE
  old:='IF a.role<>''admin'' AND NOT private.shared_test_scope(a.organization_id,owner_id) THEN RAISE EXCEPTION ''STAGE_REVIEW_DENIED''; END IF;';
  replacement:='IF a.role<>''admin'' AND (NOT private.shared_test_scope(a.organization_id,owner_id) OR NOT public.has_department_permission(a.organization_id,owner_id,''records:edit'')) THEN RAISE EXCEPTION ''STAGE_REVIEW_DENIED''; END IF;';
  IF strpos(d,old)=0 THEN RAISE EXCEPTION 'ROLE_RACI_REQUEST_PATCH_PRECONDITION'; END IF;
  d:=replace(d,old,replacement);
 END IF;
 EXECUTE d;

 d:=pg_get_functiondef('private.decide_canonical_stage_review(uuid,jsonb)'::regprocedure);
 old:='IF a.role<>''admin'' AND NOT (a.role=''department_lead'' AND private.shared_test_scope(a.organization_id,ap.reviewer_department_id)) THEN RAISE EXCEPTION ''SIGNING_AUTHORITY_DENIED''; END IF;';
 replacement:='IF a.role<>''admin'' AND (a.membership_id IS NULL OR NOT private.shared_test_scope(a.organization_id,ap.reviewer_department_id) OR NOT public.has_department_permission(a.organization_id,ap.reviewer_department_id,''approvals:decide'')) THEN RAISE EXCEPTION ''SIGNING_AUTHORITY_DENIED''; END IF;';
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'ROLE_RACI_DECISION_PATCH_PRECONDITION'; END IF;
 d:=replace(d,old,replacement);
 EXECUTE d;

 d:=pg_get_functiondef('private.activate_canonical_stage(jsonb)'::regprocedure);
 old:='IF auth.uid() IS NULL OR a.role NOT IN (''admin'',''department_lead'') THEN RAISE EXCEPTION ''STAGE_ADVANCE_DENIED''; END IF;';
 replacement:='IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client THEN RAISE EXCEPTION ''STAGE_ADVANCE_DENIED''; END IF;';
 IF strpos(d,old)>0 THEN d:=replace(d,old,replacement); END IF;
 old:='IF a.role<>''admin'' AND private.shared_test_member_department(a.membership_id) IS DISTINCT FROM owner_id THEN RAISE EXCEPTION ''STAGE_ADVANCE_DENIED''; END IF;';
 replacement:='IF a.role<>''admin'' AND (NOT private.shared_test_scope(a.organization_id,owner_id) OR NOT public.has_department_permission(a.organization_id,owner_id,''approvals:decide'')) THEN RAISE EXCEPTION ''STAGE_ADVANCE_DENIED''; END IF;';
 IF strpos(d,old)>0 THEN d:=replace(d,old,replacement);
 ELSE
  old:='IF a.role<>''admin'' AND NOT private.shared_test_scope(a.organization_id,owner_id) THEN RAISE EXCEPTION ''STAGE_ADVANCE_DENIED''; END IF;';
  IF strpos(d,old)=0 THEN RAISE EXCEPTION 'ROLE_RACI_ADVANCE_PATCH_PRECONDITION'; END IF;
  d:=replace(d,old,replacement);
 END IF;
 EXECUTE d;
END
$role_gate$;
