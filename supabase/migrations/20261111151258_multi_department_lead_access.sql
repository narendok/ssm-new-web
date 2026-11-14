-- Allow one active department lead to own multiple department roles.
-- Preserve department-level authorization: each extra scope is granted only
-- when that member is the configured lead or has a role assignment there.
CREATE OR REPLACE FUNCTION private.shared_test_member_has_department(p_member uuid,p_department uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(
  SELECT 1 FROM organization_members m JOIN departments d ON d.organization_id=m.organization_id AND d.id=p_department AND d.active
  WHERE m.id=p_member AND m.active AND private.is_shared_test_org(m.organization_id) AND (
   d.lead_member_id=m.id OR EXISTS(
    SELECT 1 FROM department_role_assignments a JOIN department_roles r ON r.id=a.role_id
    WHERE a.member_id=m.id AND a.active AND r.active AND r.organization_id=m.organization_id AND r.department_id=d.id
   )
  )
 )
$$;
REVOKE ALL ON FUNCTION private.shared_test_member_has_department(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.shared_test_scope(p_org uuid,p_department uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(
  SELECT 1 FROM organization_members m
  WHERE m.organization_id=p_org AND private.is_shared_test_org(m.organization_id) AND m.user_id=auth.uid() AND m.active AND m.role<>'viewer'
    AND (m.role='admin' OR private.shared_test_member_has_department(m.id,p_department))
 )
$$;
REVOKE ALL ON FUNCTION private.shared_test_scope(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.shared_test_scope(uuid,uuid) TO authenticated;

-- Department settings may point multiple departments at the same active lead.
DO $patch$
DECLARE d text; old text; replacement text;
BEGIN
 d:=pg_get_functiondef('public.update_organization_department(jsonb)'::regprocedure);
 old:='AND (private.shared_test_member_department(m.id) IS NULL OR private.shared_test_member_department(m.id)=d.id)';
 replacement:='';
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'MULTI_DEPT_LEAD_CONFIGURATION_PATCH_PRECONDITION'; END IF;
 d:=replace(d,old,replacement);
 EXECUTE d;
END $patch$;

-- Keep lifecycle stage actions at the public RPC boundary after the original
-- shared-workspace function was wrapped for reviewed opportunity starts.
CREATE OR REPLACE FUNCTION public.mutate_shared_test_workspace(p_action text,p_payload jsonb,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; entity uuid; digest text; replay record; result jsonb;
BEGIN
 IF p_action='create_project' THEN RAISE EXCEPTION 'USE_REVIEWED_OPPORTUNITY_TO_START_PROJECT';
 ELSIF p_action IN ('request_stage_completion','advance_stage','decide_approval') AND (
  p_action<>'decide_approval' OR EXISTS(
  SELECT 1 FROM public.canonical_stage_reviews cr JOIN public.approvals ap ON ap.record_id=cr.record_id
  WHERE ap.id=(p_payload->>'id')::uuid
  )
 ) THEN
  SELECT * INTO a FROM public.resolve_test_membership();
  IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client THEN RAISE EXCEPTION 'TEST_MEMBERSHIP_REQUIRED'; END IF;
  IF p_request_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(a.organization_id::text,0));
  digest:=encode(sha256(convert_to(p_action||p_payload::text,'UTF8')),'hex');
  SELECT * INTO replay FROM private.shared_test_requests WHERE organization_id=a.organization_id AND actor_id=auth.uid() AND request_id=p_request_id;
  IF FOUND THEN IF replay.request_hash<>digest THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF; RETURN replay.response; END IF;
  IF p_action='request_stage_completion' THEN entity:=private.request_canonical_stage_review(p_payload);
  ELSIF p_action='advance_stage' THEN entity:=private.activate_canonical_stage(p_payload);
  ELSE entity:=private.decide_canonical_stage_review((p_payload->>'id')::uuid,p_payload);
  END IF;
  result:=jsonb_build_object('ok',true,'id',entity);
  INSERT INTO private.shared_test_requests(organization_id,actor_id,request_id,request_hash,response)
  VALUES(a.organization_id,auth.uid(),p_request_id,digest,result);
  RETURN result;
 ELSE RETURN private.mutate_workspace_before_lifecycle_start(p_action,p_payload,p_request_id);
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.mutate_shared_test_workspace(text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_shared_test_workspace(text,jsonb,uuid) TO authenticated;

-- Let a mapped lead choose one of their departments for creation, and manage
-- tasks in every department they lead. Admin and member boundaries remain.
DO $patch$
DECLARE d text; next_definition text; pattern text; action_pos integer;
BEGIN
 d:=pg_get_functiondef('private.mutate_workspace_before_lifecycle_start(text,jsonb,uuid)'::regprocedure);
 pattern:=$re$IF a[.]role[[:space:]]*=[[:space:]]*'admin'[[:space:]]*THEN[[:space:]]*dept[[:space:]]*:=[[:space:]]*NULLIF[(]p_payload->>'department_id',''[)][[:space:]]*::uuid;[[:space:]]*END IF;$re$;
 next_definition:=regexp_replace(d,pattern,$rep$IF a.role IN ('admin','department_lead') THEN dept:=NULLIF(p_payload->>'department_id','')::uuid; END IF;$rep$,'g');
 IF next_definition=d THEN RAISE EXCEPTION 'MULTI_DEPT_LEAD_CREATE_PATCH_PRECONDITION'; END IF;
 d:=next_definition;
 action_pos:=strpos(d,'IF p_action=''create_project'' THEN');
 IF action_pos=0 THEN RAISE EXCEPTION 'MULTI_DEPT_LEAD_SCOPE_PATCH_PRECONDITION'; END IF;
 d:=substr(d,1,action_pos-1)||'IF a.role=''department_lead'' AND p_action IN (''create_task'',''create_custom_task'',''create_record'') AND NOT private.shared_test_scope(org,dept) THEN RAISE EXCEPTION ''DEPARTMENT_SCOPE_DENIED''; END IF;'||chr(10)||substr(d,action_pos);
 pattern:=$re$IF a[.]role[[:space:]]*<>[[:space:]]*'admin'[[:space:]]+AND[[:space:]]+NOT [(]a[.]role[[:space:]]*=[[:space:]]*'department_lead'[[:space:]]+AND[[:space:]]+a[.]department_code[[:space:]]*=[[:space:]]*'SAL'[)][[:space:]]+THEN$re$;
 next_definition:=regexp_replace(d,pattern,$rep$IF a.role<>'admin' AND NOT (a.role='department_lead' AND EXISTS(SELECT 1 FROM departments sales WHERE sales.organization_id=org AND sales.code='SAL' AND sales.active AND private.shared_test_scope(org,sales.id))) THEN$rep$);
 IF next_definition=d THEN RAISE EXCEPTION 'MULTI_DEPT_SALES_PATCH_PRECONDITION'; END IF;
 d:=next_definition;
 pattern:=$re$NOT [(]a[.]role[[:space:]]*=[[:space:]]*'department_lead'[[:space:]]+AND[[:space:]]+t[.]department_id[[:space:]]*=[[:space:]]*dept[)]$re$;
 next_definition:=regexp_replace(d,pattern,$rep$NOT (a.role='department_lead' AND private.shared_test_scope(org,t.department_id))$rep$);
 IF next_definition=d THEN RAISE EXCEPTION 'MULTI_DEPT_TASK_UPDATE_PATCH_PRECONDITION'; END IF;
 d:=next_definition;
 d:=replace(d,'private.shared_test_member_department(id)=dept','private.shared_test_member_has_department(id,dept)');
 d:=replace(d,'private.shared_test_member_department(id)=t.department_id','private.shared_test_member_has_department(id,t.department_id)');
 EXECUTE d;
END $patch$;

-- Stage review is still driven by the pinned RACI. A lead may act for any R
-- department assigned to them; A remains an independent department review.
DO $patch$
DECLARE d text; old text; replacement text;
BEGIN
 d:=pg_get_functiondef('private.request_canonical_stage_review(jsonb)'::regprocedure);
 old:='NOT ((private.project_stage_responsibility(r.id,stage)->''R'') ? a.department_code)';
 replacement:='NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(private.project_stage_responsibility(r.id,stage)->''R'') rc(code) JOIN public.departments dep ON dep.organization_id=a.organization_id AND dep.code=rc.code WHERE private.shared_test_scope(a.organization_id,dep.id))';
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'MULTI_DEPT_RACI_REVIEW_PATCH_PRECONDITION'; END IF;
 d:=replace(d,old,replacement);
 EXECUTE d;

 d:=pg_get_functiondef('private.decide_canonical_stage_review(uuid,jsonb)'::regprocedure);
 old:='private.shared_test_member_department(a.membership_id)=ap.reviewer_department_id';
 replacement:='private.shared_test_scope(a.organization_id,ap.reviewer_department_id)';
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'MULTI_DEPT_REVIEW_SIGN_PATCH_PRECONDITION'; END IF;
 d:=replace(d,old,replacement);
 EXECUTE d;

 d:=pg_get_functiondef('private.activate_canonical_stage(jsonb)'::regprocedure);
 old:='private.shared_test_member_department(a.membership_id) IS DISTINCT FROM owner_id';
 replacement:='NOT private.shared_test_scope(a.organization_id,owner_id)';
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'MULTI_DEPT_STAGE_ADVANCE_PATCH_PRECONDITION'; END IF;
 d:=replace(d,old,replacement);
 EXECUTE d;
END $patch$;
