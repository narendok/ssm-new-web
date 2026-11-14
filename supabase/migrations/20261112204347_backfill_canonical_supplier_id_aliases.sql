UPDATE public.operational_records AS record
SET fields = record.fields || jsonb_build_object(
  'supplierId', supplier.id::text,
  'supplier_id', supplier.id::text
)
FROM public.operational_records AS supplier
WHERE record.organization_id = supplier.organization_id
  AND supplier.record_type = 'Supplier'
  AND record.fields->>'supplier' = supplier.id::text
  AND COALESCE(NULLIF(BTRIM(record.fields->>'supplierId'), ''), supplier.id::text) = supplier.id::text
  AND COALESCE(NULLIF(BTRIM(record.fields->>'supplier_id'), ''), supplier.id::text) = supplier.id::text
  AND (
    NULLIF(BTRIM(record.fields->>'supplierId'), '') IS NULL
    OR NULLIF(BTRIM(record.fields->>'supplier_id'), '') IS NULL
  );
