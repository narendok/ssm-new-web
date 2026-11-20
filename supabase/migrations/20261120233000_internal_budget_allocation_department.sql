-- Budget allocations are for internal departments only. Keep this rule at the
-- mutation boundary so callers cannot bypass the allocation form's options.
DO $migration$
DECLARE
  fn text;
  old_department_check text := $old$IF NOT EXISTS(SELECT 1 FROM departments WHERE id=dept AND organization_id=org AND active) THEN RAISE EXCEPTION 'INVALID_DEPARTMENT'; END IF;$old$;
  new_department_check text := $new$IF NOT EXISTS(SELECT 1 FROM departments WHERE id=dept AND organization_id=org AND active AND upper(code)<>'CLIENT') THEN RAISE EXCEPTION 'INVALID_DEPARTMENT'; END IF;$new$;
BEGIN
  fn := pg_get_functiondef('public.mutate_business_workspace(text,jsonb,uuid)'::regprocedure);
  IF length(fn)-length(replace(fn,old_department_check,''))<>length(old_department_check) THEN
    RAISE EXCEPTION 'ALLOCATION_DEPARTMENT_PATCH_PRECONDITION';
  END IF;
  fn := replace(fn,old_department_check,new_department_check);
  IF position('active AND upper(code)<>'||quote_literal('CLIENT') in fn)=0 THEN
    RAISE EXCEPTION 'ALLOCATION_DEPARTMENT_PATCH_FAILED';
  END IF;
  EXECUTE fn;
END $migration$;

REVOKE ALL ON FUNCTION public.mutate_business_workspace(text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_business_workspace(text,jsonb,uuid) TO authenticated;
