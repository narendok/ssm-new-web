-- Honor configured multi-department document roles in the shared TEST vault.
-- A secondary department requires documents:manage; primary department access
-- remains compatible with the existing authenticated employee draft flow.
DO $patch$
DECLARE d text; old text; replacement text;
BEGIN
 d:=pg_get_functiondef('public.register_controlled_document(jsonb,uuid)'::regprocedure);
 old:=$source$department:=CASE WHEN a.role='admin' THEN NULLIF(p_payload->>'departmentId','')::uuid ELSE private.shared_test_member_department(a.membership_id) END;$source$;
 replacement:=$target$department:=CASE
  WHEN a.role='admin' THEN NULLIF(p_payload->>'departmentId','')::uuid
  WHEN NULLIF(p_payload->>'departmentId','') IS NOT NULL
    AND NULLIF(p_payload->>'departmentId','')::uuid IS DISTINCT FROM private.shared_test_member_department(a.membership_id)
    AND public.has_department_permission(org,NULLIF(p_payload->>'departmentId','')::uuid,'documents:manage')
   THEN NULLIF(p_payload->>'departmentId','')::uuid
  ELSE private.shared_test_member_department(a.membership_id)
 END;$target$;
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'ROLE_DOCUMENT_DEPARTMENT_PATCH_PRECONDITION'; END IF;
 d:=replace(d,old,replacement);
 old:=$source$IF NOT EXISTS(SELECT 1 FROM public.departments WHERE id=department AND organization_id=org AND active AND code<>'CLIENT') THEN RAISE EXCEPTION 'DOCUMENT_DEPARTMENT_REQUIRED'; END IF;$source$;
 replacement:=$target$IF NOT EXISTS(SELECT 1 FROM public.departments WHERE id=department AND organization_id=org AND active AND code<>'CLIENT') THEN RAISE EXCEPTION 'DOCUMENT_DEPARTMENT_REQUIRED'; END IF;
 IF a.role<>'admin' AND (department IS DISTINCT FROM private.shared_test_member_department(a.membership_id) AND NOT public.has_department_permission(org,department,'documents:manage')) THEN RAISE EXCEPTION 'DOCUMENT_REGISTER_DENIED'; END IF;$target$;
 IF strpos(d,old)=0 THEN RAISE EXCEPTION 'ROLE_DOCUMENT_PERMISSION_PATCH_PRECONDITION'; END IF;
 d:=replace(d,old,replacement);
 EXECUTE d;
END
$patch$;
