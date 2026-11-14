-- Make configured department permissions drive cross-department record and task actions.
-- Existing primary-department employee task creation remains compatible; using a
-- secondary role requires the matching explicit permission.
DO $patch$
DECLARE d text; old text; replacement text; pos integer;
BEGIN
 d:=pg_get_functiondef('private.mutate_workspace_before_lifecycle_start(text,jsonb,uuid)'::regprocedure);

 old:='IF a.role IN (''admin'',''department_lead'') THEN dept:=NULLIF(p_payload->>''department_id'','''')::uuid; END IF;';
 replacement:=$target$IF a.role IN ('admin','department_lead') THEN dept:=NULLIF(p_payload->>'department_id','')::uuid;
 ELSIF a.role='member' AND p_action IN ('create_record','create_task','create_custom_task')
   AND NULLIF(p_payload->>'department_id','') IS NOT NULL
   AND ((p_action='create_record' AND public.has_department_permission(org,NULLIF(p_payload->>'department_id','')::uuid,'records:create'))
     OR (p_action IN ('create_task','create_custom_task') AND public.has_department_permission(org,NULLIF(p_payload->>'department_id','')::uuid,'tasks:assign'))) THEN
  dept:=NULLIF(p_payload->>'department_id','')::uuid;
 END IF;$target$;
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'ROLE_ACTION_DEPARTMENT_PATCH_PRECONDITION'; END IF;
 d:=replace(d,old,replacement);

 -- Keep a secondary department selected by the permission gate above; only use
 -- the primary department as a fallback when no explicit authorized scope exists.
 old:='dept:=private.shared_test_member_department(a.membership_id);';
 pos:=strpos(d,old);
 IF pos=0 THEN RAISE EXCEPTION 'ROLE_ACTION_PRIMARY_DEPARTMENT_PATCH_PRECONDITION'; END IF;
 d:=substr(d,1,pos-1)||old||$check$
 IF a.role='member' AND p_action IN ('create_record','create_task','create_custom_task')
   AND NULLIF(p_payload->>'department_id','') IS NOT NULL
   AND NULLIF(p_payload->>'department_id','')::uuid IS DISTINCT FROM dept
   AND ((p_action='create_record' AND NOT public.has_department_permission(org,NULLIF(p_payload->>'department_id','')::uuid,'records:create'))
     OR (p_action IN ('create_task','create_custom_task') AND NOT public.has_department_permission(org,NULLIF(p_payload->>'department_id','')::uuid,'tasks:assign'))) THEN
  RAISE EXCEPTION 'ROLE_ACTION_PERMISSION_REQUIRED';
 END IF;
 $check$||substr(d,pos+length(old));

 old:='IF a.role=''member'' THEN assignee:=a.membership_id; END IF;';
 replacement:='IF a.role=''member'' AND NOT public.has_department_permission(org,dept,''tasks:assign'') THEN assignee:=a.membership_id; END IF;';
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'ROLE_TASK_ASSIGNMENT_PATCH_PRECONDITION'; END IF;
 d:=replace(d,old,replacement);

 old:=$source$IF a.role NOT IN ('admin', 'department_lead') THEN$source$;
 replacement:=$target$IF a.role<>'admin' AND NOT public.has_department_permission(org,dept,'tasks:assign') THEN$target$;
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'ROLE_CUSTOM_TASK_PERMISSION_PATCH_PRECONDITION'; END IF;
 d:=replace(d,old,replacement);
 d:=replace(d,'CUSTOM_TASK_CREATE_DENIED: Only Admin or Department Lead can create custom tasks','CUSTOM_TASK_CREATE_DENIED: Assign tasks permission is required in this department');

 old:='IF a.role<>''admin'' AND COALESCE(a.department_code,'''')<>''PUR'' THEN';
 replacement:='IF a.role<>''admin'' AND COALESCE(a.department_code,'''')<>''PUR'' AND NOT public.has_department_permission(org,(SELECT id FROM departments WHERE organization_id=org AND code=''PUR'' AND active),''records:create'') THEN';
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'ROLE_SUPPLIER_PERMISSION_PATCH_PRECONDITION'; END IF;
 d:=replace(d,old,replacement);
 old:='IF a.role<>''admin'' AND COALESCE(a.department_code,'''')<>''SAL'' THEN';
 replacement:='IF a.role<>''admin'' AND COALESCE(a.department_code,'''')<>''SAL'' AND NOT public.has_department_permission(org,(SELECT id FROM departments WHERE organization_id=org AND code=''SAL'' AND active),''records:create'') THEN';
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'ROLE_CUSTOMER_PERMISSION_PATCH_PRECONDITION'; END IF;
 d:=replace(d,old,replacement);
 old:='IF a.role<>''admin'' AND COALESCE(a.department_code,'''') NOT IN (''EHW'',''FW'',''SW'',''MECH'',''PUR'',''RND'') THEN';
 replacement:='IF a.role<>''admin'' AND COALESCE(a.department_code,'''') NOT IN (''EHW'',''FW'',''SW'',''MECH'',''PUR'',''RND'') AND NOT EXISTS(SELECT 1 FROM departments allowed WHERE allowed.id=dept AND allowed.organization_id=org AND allowed.active AND allowed.code IN (''EHW'',''FW'',''SW'',''MECH'',''PUR'',''RND'') AND public.has_department_permission(org,allowed.id,''records:create'')) THEN';
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'ROLE_PART_PERMISSION_PATCH_PRECONDITION'; END IF;
 d:=replace(d,old,replacement);

 EXECUTE d;
END
$patch$;
