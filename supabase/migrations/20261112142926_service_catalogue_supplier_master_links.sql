-- Link configured services to the canonical Supplier master.
DO $migration$
DECLARE
  definition text := pg_get_functiondef('public.get_expense_catalogue(uuid)'::regprocedure);
  marker constant text := $marker$'services',coalesce(chosen->'services',root->'services','[]'::jsonb),$marker$;
  replacement constant text := $replacement$'services',coalesce(chosen->'services',root->'services','[]'::jsonb),
  'suppliers',CASE WHEN a.role<>'viewer' AND NOT a.is_client THEN coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id',r.id,'reference',r.reference,'title',r.title,'status',r.status::text
  ) ORDER BY r.reference) FROM public.operational_records r
   WHERE r.organization_id=a.organization_id AND r.record_type='Supplier' AND r.archived_at IS NULL
     AND lower(r.status::text) NOT IN ('archived','obsolete','rejected')),'[]'::jsonb) ELSE '[]'::jsonb END,$replacement$;
BEGIN
  IF length(definition)-length(replace(definition,marker,''))<>length(marker) THEN
    RAISE EXCEPTION 'EXPENSE_CATALOGUE_SUPPLIER_OPTIONS_PATCH_PRECONDITION';
  END IF;
  EXECUTE replace(definition,marker,replacement);
END $migration$;

DO $migration$
DECLARE
  definition text := pg_get_functiondef('public.save_expense_catalogue(uuid,jsonb,integer)'::regprocedure);
  marker constant text := $marker$ persist:=jsonb_build_object($marker$;
  replacement constant text := $replacement$
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_value->'services') s
   WHERE NULLIF(s->>'supplierId','') IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.operational_records r
     WHERE r.id=(s->>'supplierId')::uuid AND r.organization_id=a.organization_id
       AND r.record_type='Supplier' AND r.archived_at IS NULL
       AND lower(r.status::text) NOT IN ('archived','obsolete','rejected')))
 THEN RAISE EXCEPTION 'EXPENSE_SERVICE_SUPPLIER_INVALID'; END IF;
 IF service_manager AND p_value ? 'services' THEN
  p_value:=jsonb_set(p_value,'{services}',coalesce((
   SELECT jsonb_agg(CASE WHEN supplier.id IS NULL THEN rows.service
     ELSE rows.service||jsonb_build_object('provider',supplier.title) END ORDER BY rows.ordinality)
   FROM jsonb_array_elements(p_value->'services') WITH ORDINALITY AS rows(service,ordinality)
   LEFT JOIN public.operational_records supplier ON supplier.id=NULLIF(rows.service->>'supplierId','')::uuid
    AND supplier.organization_id=a.organization_id AND supplier.record_type='Supplier'
    AND supplier.archived_at IS NULL AND lower(supplier.status::text) NOT IN ('archived','obsolete','rejected')
  ),'[]'::jsonb),true);
 END IF;
 persist:=jsonb_build_object($replacement$;
BEGIN
  IF length(definition)-length(replace(definition,marker,''))<>length(marker) THEN
    RAISE EXCEPTION 'EXPENSE_SERVICE_SUPPLIER_SNAPSHOT_PATCH_PRECONDITION';
  END IF;
  EXECUTE replace(definition,marker,replacement);
END $migration$;
