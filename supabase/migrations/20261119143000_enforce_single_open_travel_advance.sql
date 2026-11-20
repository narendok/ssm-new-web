-- Enforce the published one-open-advance rule in the shared mutation transaction.
-- Amount caps remain unimplemented until employee band, location tier, and
-- itemized travel amounts are supplied as authoritative server-side inputs.
DO $$
DECLARE
  fn text;
  before text;
  marker text := '  INSERT INTO business_items(organization_id,kind,owner_id,department_id,project_id,payload) VALUES(org,''expense'',mid,dept,project,';
  declaration_marker text := ' amount numeric; actual numeric; available numeric; next_state text;';
  guard text := $guard$  IF COALESCE(data->>'requestType','travel')='travel' THEN
   SELECT COALESCE(dp.published_value,cp.published_value,private.default_travel_policy()) INTO travel_policy
   FROM (SELECT 1) seed
   LEFT JOIN private.travel_policies cp ON cp.organization_id=org AND cp.scope='company'
   LEFT JOIN private.travel_policies dp ON dp.organization_id=org AND dp.scope=dept::text;
   IF COALESCE((travel_policy->>'oneOpenAdvance')::boolean,false) THEN
    SELECT id INTO existing_advance FROM public.business_items
    WHERE organization_id=org AND owner_id=mid AND kind='expense'
      AND payload->>'requestType'='travel'
      AND COALESCE(payload->>'status','') NOT IN ('Settled','Rejected','Cancelled')
    LIMIT 1;
    IF existing_advance IS NOT NULL THEN RAISE EXCEPTION 'ACTIVE_TRAVEL_ADVANCE_EXISTS'; END IF;
   END IF;
  END IF;$guard$;
BEGIN
  fn := pg_get_functiondef('public.mutate_business_workspace(text,jsonb,uuid)'::regprocedure);
  before := fn;
  IF position(marker in fn)=0 THEN RAISE EXCEPTION 'TRAVEL_GUARD_INSERT_POINT_NOT_FOUND'; END IF;
  IF position(declaration_marker in fn)=0 THEN RAISE EXCEPTION 'TRAVEL_GUARD_DECLARATION_POINT_NOT_FOUND'; END IF;
  fn := replace(fn,declaration_marker,' amount numeric; actual numeric; available numeric; next_state text; travel_policy jsonb; existing_advance uuid;');
  fn := replace(fn,marker,guard||E'\n'||marker);
  IF fn=before THEN RAISE EXCEPTION 'TRAVEL_GUARD_NOT_APPLIED'; END IF;
  EXECUTE fn;
END $$;

REVOKE ALL ON FUNCTION public.mutate_business_workspace(text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_business_workspace(text,jsonb,uuid) TO authenticated;
