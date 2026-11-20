-- The illustrative policy is Draft until Admin publishes it. Apply the
-- one-open-advance rule only when the effective published policy is Active.
DO $$
DECLARE
  fn text;
  old_guard text := 'IF COALESCE((travel_policy->>''oneOpenAdvance'')::boolean,false) THEN';
  new_guard text := 'IF travel_policy->>''status''=''Active'' AND COALESCE((travel_policy->>''oneOpenAdvance'')::boolean,false) THEN';
BEGIN
  fn := pg_get_functiondef('public.mutate_business_workspace(text,jsonb,uuid)'::regprocedure);
  IF position(old_guard in fn)=0 THEN RAISE EXCEPTION 'ACTIVE_POLICY_GUARD_SOURCE_NOT_FOUND'; END IF;
  IF position(old_guard in substring(fn from position(old_guard in fn)+length(old_guard)))>0 THEN RAISE EXCEPTION 'ACTIVE_POLICY_GUARD_NOT_UNIQUE'; END IF;
  fn := replace(fn,old_guard,new_guard);
  EXECUTE fn;
END $$;

REVOKE ALL ON FUNCTION public.mutate_business_workspace(text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_business_workspace(text,jsonb,uuid) TO authenticated;
