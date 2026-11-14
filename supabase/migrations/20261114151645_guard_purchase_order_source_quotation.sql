-- Bind a PO's source quote to one current, approved revision and the exact
-- canonical supplier/project. Recheck at review/approval/release boundaries.
CREATE OR REPLACE FUNCTION private.validate_purchase_order_source_quotation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  source_id_text text;
  source_id uuid;
  source_revision text;
  source_quote public.operational_records%ROWTYPE;
  quote_supplier_id text;
  purchase_supplier_id text;
  quote_project_id text;
  purchase_project_id text;
  alias_key text;
  alias_value text;
  canonical_project public.operational_records%ROWTYPE;
  canonical_supplier public.operational_records%ROWTYPE;
BEGIN
  IF NEW.record_type NOT IN ('Purchase order', 'Purchase Order')
     OR NOT private.is_shared_test_org(NEW.organization_id) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NULLIF(BTRIM(NEW.fields->>'sourceQuotationId'), '') IS NOT DISTINCT FROM
         NULLIF(BTRIM(OLD.fields->>'sourceQuotationId'), '')
       AND NULLIF(BTRIM(NEW.fields->>'sourceQuotationRevision'), '') IS NOT DISTINCT FROM
         NULLIF(BTRIM(OLD.fields->>'sourceQuotationRevision'), '')
       AND NOT (
         NEW.status::text IN ('in_review', 'approved', 'released')
         AND OLD.status::text IS DISTINCT FROM NEW.status::text
       ) THEN
      RETURN NEW;
    END IF;
  END IF;

  source_id_text := NULLIF(BTRIM(NEW.fields->>'sourceQuotationId'), '');
  source_revision := NULLIF(BTRIM(NEW.fields->>'sourceQuotationRevision'), '');
  IF source_id_text IS NULL THEN
    IF source_revision IS NOT NULL THEN
      RAISE EXCEPTION 'SOURCE_QUOTATION_LINK_INVALID';
    END IF;
    RETURN NEW;
  END IF;
  IF source_revision IS NULL THEN
    RAISE EXCEPTION 'SOURCE_QUOTATION_LINK_INVALID';
  END IF;

  BEGIN
    source_id := source_id_text::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'SOURCE_QUOTATION_LINK_INVALID';
  END;

  SELECT q.* INTO source_quote
  FROM public.operational_records AS q
  WHERE q.id = source_id
    AND q.organization_id = NEW.organization_id
    AND q.record_type = 'Supplier quotation'
    AND q.archived_at IS NULL
  FOR SHARE;
  IF NOT FOUND OR source_quote.status::text NOT IN ('approved', 'released') THEN
    RAISE EXCEPTION 'SOURCE_QUOTATION_NOT_APPROVED';
  END IF;
  IF NULLIF(BTRIM(source_quote.fields->>'revision'), '') IS DISTINCT FROM source_revision THEN
    RAISE EXCEPTION 'SOURCE_QUOTATION_REVISION_STALE';
  END IF;

  quote_supplier_id := NULLIF(BTRIM(source_quote.fields->>'supplierId'), '');
  purchase_supplier_id := NULLIF(BTRIM(NEW.fields->>'supplierId'), '');
  quote_project_id := NULLIF(BTRIM(source_quote.fields->>'projectId'), '');
  purchase_project_id := NULLIF(BTRIM(NEW.fields->>'projectId'), '');
  IF quote_supplier_id IS NULL OR purchase_supplier_id IS NULL
     OR quote_project_id IS NULL OR purchase_project_id IS NULL
     OR quote_supplier_id IS DISTINCT FROM purchase_supplier_id
     OR quote_project_id IS DISTINCT FROM purchase_project_id THEN
    RAISE EXCEPTION 'SOURCE_QUOTATION_MASTER_MISMATCH';
  END IF;

  -- Fail closed if another populated canonical-ID alias disagrees.
  FOREACH alias_key IN ARRAY ARRAY['supplier_id']::text[] LOOP
    alias_value := NULLIF(BTRIM(source_quote.fields->>alias_key), '');
    IF alias_value IS NOT NULL AND alias_value IS DISTINCT FROM quote_supplier_id THEN
      RAISE EXCEPTION 'SOURCE_QUOTATION_MASTER_MISMATCH';
    END IF;
    alias_value := NULLIF(BTRIM(NEW.fields->>alias_key), '');
    IF alias_value IS NOT NULL AND alias_value IS DISTINCT FROM purchase_supplier_id THEN
      RAISE EXCEPTION 'SOURCE_QUOTATION_MASTER_MISMATCH';
    END IF;
  END LOOP;
  FOREACH alias_key IN ARRAY ARRAY['project_id', 'linkedProjectId']::text[] LOOP
    alias_value := NULLIF(BTRIM(source_quote.fields->>alias_key), '');
    IF alias_value IS NOT NULL AND alias_value IS DISTINCT FROM quote_project_id THEN
      RAISE EXCEPTION 'SOURCE_QUOTATION_MASTER_MISMATCH';
    END IF;
    alias_value := NULLIF(BTRIM(NEW.fields->>alias_key), '');
    IF alias_value IS NOT NULL AND alias_value IS DISTINCT FROM purchase_project_id THEN
      RAISE EXCEPTION 'SOURCE_QUOTATION_MASTER_MISMATCH';
    END IF;
  END LOOP;

  -- Confirm both IDs still identify the canonical records in this TEST org.
  SELECT p.* INTO canonical_project
  FROM public.operational_records AS p
  WHERE p.id::text = quote_project_id
    AND p.organization_id = NEW.organization_id
    AND p.record_type = 'Project'
    AND p.archived_at IS NULL
    AND private.is_selectable_master_status(p.status::text);
  IF NOT FOUND THEN RAISE EXCEPTION 'SOURCE_QUOTATION_MASTER_MISMATCH'; END IF;
  SELECT s.* INTO canonical_supplier
  FROM public.operational_records AS s
  WHERE s.id::text = quote_supplier_id
    AND s.organization_id = NEW.organization_id
    AND s.record_type = 'Supplier'
    AND s.archived_at IS NULL
    AND lower(s.status::text) = 'approved';
  IF NOT FOUND THEN RAISE EXCEPTION 'SOURCE_QUOTATION_MASTER_MISMATCH'; END IF;

  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION private.validate_purchase_order_source_quotation() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS validate_supplier_source_quotation ON public.operational_records;
CREATE TRIGGER validate_supplier_source_quotation
BEFORE INSERT OR UPDATE OF fields, status, organization_id, record_type
ON public.operational_records
FOR EACH ROW EXECUTE FUNCTION private.validate_purchase_order_source_quotation();
