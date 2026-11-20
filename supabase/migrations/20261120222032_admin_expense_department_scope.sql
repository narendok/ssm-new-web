-- Admins may create an expense for an explicitly selected active department.
-- Non-admin callers remain bound to their authenticated department and cannot
-- override it through a forged departmentId payload.
DO $migration$
DECLARE
  fn text;
  old_assignment text := $old$dept:=private.shared_test_member_department(mid); IF dept IS NULL THEN dept:=NULLIF(data->>'departmentId','')::uuid; END IF;$old$;
  new_assignment text := $new$IF a.role='admin' THEN
   dept:=COALESCE(NULLIF(data->>'departmentId','')::uuid,private.shared_test_member_department(mid));
  ELSE
   dept:=private.shared_test_member_department(mid);
   IF NULLIF(data->>'departmentId','') IS NOT NULL AND data->>'departmentId' IS DISTINCT FROM dept::text THEN
    RAISE EXCEPTION 'EXPENSE_DEPARTMENT_OVERRIDE_DENIED';
   END IF;
  END IF;$new$;
  old_validation text := $old$IF dept IS NULL OR NOT EXISTS(SELECT 1 FROM departments WHERE id=dept AND organization_id=org AND active) THEN RAISE EXCEPTION 'DEPARTMENT_REQUIRED'; END IF;$old$;
  new_validation text := $new$IF dept IS NULL OR NOT EXISTS(SELECT 1 FROM departments WHERE id=dept AND organization_id=org AND active AND code<>'CLIENT') THEN RAISE EXCEPTION 'DEPARTMENT_REQUIRED'; END IF;$new$;
BEGIN
  fn := pg_get_functiondef('public.mutate_business_workspace(text,jsonb,uuid)'::regprocedure);
  IF length(fn)-length(replace(fn,old_assignment,''))<>length(old_assignment) THEN
    RAISE EXCEPTION 'EXPENSE_DEPARTMENT_ASSIGNMENT_PRECONDITION';
  END IF;
  fn := replace(fn,old_assignment,new_assignment);
  IF length(fn)-length(replace(fn,old_validation,''))<>length(old_validation) THEN
    RAISE EXCEPTION 'EXPENSE_DEPARTMENT_VALIDATION_PRECONDITION';
  END IF;
  fn := replace(fn,old_validation,new_validation);
  IF position('EXPENSE_DEPARTMENT_OVERRIDE_DENIED' in fn)=0
    OR position('code<>'||quote_literal('CLIENT') in fn)=0 THEN
    RAISE EXCEPTION 'EXPENSE_DEPARTMENT_SCOPE_PATCH_FAILED';
  END IF;
  EXECUTE fn;
END $migration$;

REVOKE ALL ON FUNCTION public.mutate_business_workspace(text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_business_workspace(text,jsonb,uuid) TO authenticated;
