CREATE FUNCTION private.expense_service_snapshot(p_department uuid, p_service_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE selected_service jsonb;
BEGIN
  SELECT service INTO selected_service
  FROM jsonb_array_elements(public.get_expense_catalogue(p_department)->'services') AS entries(service)
  WHERE service->>'id' = p_service_id;

  IF selected_service IS NULL THEN
    RAISE EXCEPTION 'EXPENSE_SERVICE_CATALOGUE_ENTRY_REQUIRED';
  END IF;
  RETURN jsonb_build_object(
    'serviceCatalogueId', selected_service->>'id',
    'serviceCatalogueName', selected_service->>'name'
  );
END $$;

REVOKE ALL ON FUNCTION private.expense_service_snapshot(uuid,text) FROM PUBLIC, anon, authenticated;

DO $migration$
DECLARE
  definition text := pg_get_functiondef('public.mutate_business_workspace(text,jsonb,uuid)'::regprocedure);
  marker constant text := $marker$'receiptReference',data->>'receiptReference','status',next_state,'createdAt',now(),'updatedAt',now())) RETURNING id INTO item_id;$marker$;
  replacement constant text := $replacement$'receiptReference',data->>'receiptReference','status',next_state,'createdAt',now(),'updatedAt',now())
   || CASE WHEN data->>'requestType'='purchase' AND data->>'purchaseKind'='service'
      THEN private.expense_service_snapshot(dept, data->>'serviceCatalogueId')
      ELSE '{}'::jsonb END) RETURNING id INTO item_id;$replacement$;
BEGIN
  IF length(definition) - length(replace(definition, marker, '')) <> length(marker) THEN
    RAISE EXCEPTION 'EXPENSE_SERVICE_ROUTING_BASELINE_MISMATCH';
  END IF;
  EXECUTE replace(definition, marker, replacement);
END $migration$;
