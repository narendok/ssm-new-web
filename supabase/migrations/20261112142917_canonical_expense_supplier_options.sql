-- Return only the shared supplier master fields needed by expense requests.
-- Commercial, banking and qualification details remain in the Purchasing view.
DO $migration$
DECLARE
  definition text := pg_get_functiondef('public.get_business_workspace()'::regprocedure);
  marker constant text := $marker$'surveyResults',$marker$;
  replacement constant text := $replacement$'suppliers',COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id',r.id,'reference',r.reference,'title',r.title,'status',r.status::text
    ) ORDER BY r.reference)
    FROM operational_records r
    WHERE r.organization_id=a.organization_id AND r.record_type='Supplier'
      AND a.role<>'viewer' AND r.archived_at IS NULL
      AND lower(r.status::text) NOT IN ('archived','obsolete','rejected')
  ),'[]'::jsonb), 'surveyResults',$replacement$;
BEGIN
  IF length(definition) - length(replace(definition, marker, '')) <> length(marker) THEN
    RAISE EXCEPTION 'BUSINESS_SUPPLIER_OPTIONS_PATCH_PRECONDITION';
  END IF;
  EXECUTE replace(definition, marker, replacement);
END $migration$;

-- Persist the canonical supplier UUID and take its display snapshot from the
-- selected Supplier record, never from client-submitted display text.
DO $migration$
DECLARE
  definition text := pg_get_functiondef('public.mutate_business_workspace(text,jsonb,uuid)'::regprocedure);
  validation_block constant text := $block$
  IF NULLIF(data->>'supplierId','') IS NOT NULL THEN
   SELECT jsonb_build_object('id',r.id,'reference',r.reference,'title',r.title)
    INTO answer FROM operational_records r WHERE r.id=(data->>'supplierId')::uuid
      AND r.organization_id=org AND r.record_type='Supplier' AND r.archived_at IS NULL
      AND lower(r.status::text) NOT IN ('archived','obsolete','rejected');
   IF answer IS NULL THEN RAISE EXCEPTION 'INVALID_SUPPLIER'; END IF;
   data:=data||jsonb_build_object('supplierName',answer->>'title','supplierReference',answer->>'reference');
  END IF;
  $block$;
  marker_position integer;
  expense_marker constant text := $marker$ELSE '{}'::jsonb END) RETURNING id INTO item_id;$marker$;
  expense_replacement constant text := $replacement$ELSE '{}'::jsonb END || jsonb_strip_nulls(jsonb_build_object(
     'supplierId',NULLIF(data->>'supplierId','')::uuid,
     'supplierReference',NULLIF(data->>'supplierReference',''),
     'supplierName',NULLIF(data->>'supplierName','')
   ))) RETURNING id INTO item_id;$replacement$;
BEGIN
  marker_position:=strpos(definition,'next_state:=CASE WHEN data->>');
  IF marker_position=0 OR strpos(substr(definition,marker_position+1),'next_state:=CASE WHEN data->>')>0 THEN
    RAISE EXCEPTION 'BUSINESS_EXPENSE_SUPPLIER_VALIDATION_PATCH_PRECONDITION';
  END IF;
  definition:=substr(definition,1,marker_position-1)||validation_block||substr(definition,marker_position);
  IF length(definition) - length(replace(definition, expense_marker, '')) <> length(expense_marker) THEN
    RAISE EXCEPTION 'BUSINESS_EXPENSE_SUPPLIER_SNAPSHOT_PATCH_PRECONDITION';
  END IF;
  EXECUTE replace(definition,expense_marker,expense_replacement);
END $migration$;
