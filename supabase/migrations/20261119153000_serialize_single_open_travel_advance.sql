-- Serialize per-requester travel submissions so concurrent calls cannot both
-- pass the active-advance check before either one inserts its expense row.
DO $$
DECLARE
  fn text;
  before text;
  old_guard text := $old$  IF travel_policy->>'status'='Active' AND COALESCE((travel_policy->>'oneOpenAdvance')::boolean,false) THEN
    SELECT id INTO existing_advance FROM public.business_items
    WHERE organization_id=org AND owner_id=mid AND kind='expense'
      AND payload->>'requestType'='travel'
      AND COALESCE(payload->>'status','') NOT IN ('Settled','Rejected','Cancelled')
    LIMIT 1;
    IF existing_advance IS NOT NULL THEN RAISE EXCEPTION 'ACTIVE_TRAVEL_ADVANCE_EXISTS'; END IF;
   END IF;$old$;
  new_guard text := $new$  IF travel_policy->>'status'='Active' AND COALESCE((travel_policy->>'oneOpenAdvance')::boolean,false) THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(org::text || ':' || mid::text, 0));
    SELECT id INTO existing_advance FROM public.business_items
    WHERE organization_id=org AND owner_id=mid AND kind='expense'
      AND payload->>'requestType'='travel'
      AND COALESCE(payload->>'status','') NOT IN ('Settled','Rejected','Cancelled')
    LIMIT 1;
    IF existing_advance IS NOT NULL THEN RAISE EXCEPTION 'ACTIVE_TRAVEL_ADVANCE_EXISTS'; END IF;
   END IF;$new$;
BEGIN
  fn := pg_get_functiondef('public.mutate_business_workspace(text,jsonb,uuid)'::regprocedure);
  IF (length(fn)-length(replace(fn,old_guard,'')))/length(old_guard) <> 1 THEN
    RAISE EXCEPTION 'EXPECTED_SINGLE_OPEN_ADVANCE_GUARD_NOT_FOUND';
  END IF;
  before := fn;
  fn := replace(fn,old_guard,new_guard);
  IF fn=before THEN RAISE EXCEPTION 'TRAVEL_ADVANCE_SERIALIZATION_PATCH_FAILED'; END IF;
  EXECUTE fn;
END $$;

REVOKE ALL ON FUNCTION public.mutate_business_workspace(text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_business_workspace(text,jsonb,uuid) TO authenticated;
