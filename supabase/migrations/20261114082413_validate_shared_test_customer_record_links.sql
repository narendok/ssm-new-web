-- Keep Shared TEST Customer aliases consistent when an authorized editor
-- explicitly changes a linked Customer. Legacy untouched rows remain intact.
CREATE OR REPLACE FUNCTION private.validate_shared_test_customer_record_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alias_key text;
  alias_value text;
  customer_record public.operational_records%ROWTYPE;
  canonical_customer_id uuid;
  customer_match_count integer;
  customer_id_supplied boolean := false;
  link_changed boolean := TG_OP = 'INSERT';
  identity_aliases constant text[] := ARRAY[
    'customerId', 'customer_id', 'customerCode', 'customer_code'
  ];
  customer_aliases constant text[] := ARRAY[
    'customerId', 'customer_id', 'customerCode', 'customer_code',
    'customer', 'customerName', 'customer_name'
  ];
BEGIN
  IF NEW.record_type = 'Customer' OR NOT private.is_shared_test_org(NEW.organization_id) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOREACH alias_key IN ARRAY identity_aliases LOOP
      IF NULLIF(BTRIM(NEW.fields->>alias_key), '') IS DISTINCT FROM
         NULLIF(BTRIM(OLD.fields->>alias_key), '') THEN
        link_changed := true;
        EXIT;
      END IF;
    END LOOP;
    IF NOT link_changed THEN RETURN NEW; END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM jsonb_each_text(COALESCE(NEW.fields, '{}'::jsonb)) AS alias(key, value)
    WHERE alias.key = ANY(identity_aliases) AND NULLIF(BTRIM(alias.value), '') IS NOT NULL
  ) THEN
    -- A label-only value on a new/legacy record is not an identity. On an
    -- explicit update that removes a previously linked master, clear its labels.
    IF TG_OP = 'UPDATE' THEN
      NEW.fields := COALESCE(NEW.fields, '{}'::jsonb) - customer_aliases;
    END IF;
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM jsonb_each_text(COALESCE(NEW.fields, '{}'::jsonb)) AS alias(key, value)
    WHERE alias.key = ANY(ARRAY['customerId', 'customer_id']) AND NULLIF(BTRIM(alias.value), '') IS NOT NULL
  ) INTO customer_id_supplied;

  FOREACH alias_key IN ARRAY identity_aliases LOOP
    alias_value := NULLIF(BTRIM(NEW.fields->>alias_key), '');
    IF alias_value IS NULL THEN CONTINUE; END IF;

    SELECT count(*) INTO customer_match_count
    FROM public.operational_records AS c
    WHERE c.organization_id = NEW.organization_id
      AND c.record_type = 'Customer'
      AND c.archived_at IS NULL
      AND lower(c.status::text) NOT IN ('archived', 'obsolete', 'rejected', 'inactive', 'cancelled', 'canceled', 'retired', 'disabled')
      AND (c.id::text = alias_value OR c.reference = alias_value);
    IF customer_match_count <> 1 THEN
      -- A legacy code without a Customer ID remains plain, unlinked text when
      -- it has no unique current master. An explicit selected ID stays strict.
      IF alias_key IN ('customerCode', 'customer_code') AND NOT customer_id_supplied THEN RETURN NEW; END IF;
      RAISE EXCEPTION 'CUSTOMER_LINK_INVALID';
    END IF;

    SELECT c.* INTO customer_record
    FROM public.operational_records AS c
    WHERE c.organization_id = NEW.organization_id
      AND c.record_type = 'Customer'
      AND c.archived_at IS NULL
      AND lower(c.status::text) NOT IN ('archived', 'obsolete', 'rejected', 'inactive', 'cancelled', 'canceled', 'retired', 'disabled')
      AND (c.id::text = alias_value OR c.reference = alias_value);
    IF canonical_customer_id IS NOT NULL AND canonical_customer_id <> customer_record.id THEN
      RAISE EXCEPTION 'CUSTOMER_LINK_INVALID';
    END IF;
    canonical_customer_id := customer_record.id;
  END LOOP;

  IF canonical_customer_id IS NULL THEN RAISE EXCEPTION 'CUSTOMER_LINK_INVALID'; END IF;
  SELECT c.* INTO customer_record
  FROM public.operational_records AS c
  WHERE c.id = canonical_customer_id AND c.organization_id = NEW.organization_id;

  NEW.fields := COALESCE(NEW.fields, '{}'::jsonb) || jsonb_build_object(
    'customerId', customer_record.id,
    'customer_id', customer_record.id,
    'customerCode', customer_record.reference,
    'customer_code', customer_record.reference,
    'customer', customer_record.title,
    'customerName', customer_record.title,
    'customer_name', customer_record.title
  );
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION private.validate_shared_test_customer_record_link() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS validate_00_shared_test_customer_record_link ON public.operational_records;
CREATE TRIGGER validate_00_shared_test_customer_record_link
BEFORE INSERT OR UPDATE OF fields, organization_id, record_type
ON public.operational_records
FOR EACH ROW EXECUTE FUNCTION private.validate_shared_test_customer_record_link();
