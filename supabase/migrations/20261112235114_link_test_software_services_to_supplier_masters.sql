-- Seed only the exact software provider names already present in the company TEST catalogue.
-- Draft/demo supplier masters carry no legal, contact, payment, or commercial details.
DO $test_service_supplier_links$
DECLARE
  target_org uuid;
  purchaser uuid;
  actor uuid;
  catalogue private.expense_catalogues%ROWTYPE;
  github_supplier public.operational_records%ROWTYPE;
  zoho_supplier public.operational_records%ROWTYPE;
  matches integer;
  exact_services integer;
  linked_services jsonb;
  supplier_id_text text;
BEGIN
  SELECT id, created_by INTO target_org, actor
  FROM public.organizations
  WHERE name = 'TEST ONLY · SSM-new1 synthetic workspace';

  IF target_org IS NULL THEN
    RAISE EXCEPTION 'TEST_SOFTWARE_SUPPLIER_ORGANIZATION_NOT_FOUND';
  END IF;

  SELECT id INTO purchaser
  FROM public.departments
  WHERE organization_id = target_org AND code = 'PUR' AND active;

  IF purchaser IS NULL THEN
    RAISE EXCEPTION 'TEST_SOFTWARE_SUPPLIER_PURCHASING_DEPARTMENT_NOT_FOUND';
  END IF;

  SELECT * INTO catalogue
  FROM private.expense_catalogues
  WHERE organization_id = target_org AND scope = 'company'
  FOR UPDATE;

  IF NOT FOUND OR jsonb_typeof(catalogue.value->'services') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'TEST_SOFTWARE_SERVICE_CATALOGUE_NOT_FOUND';
  END IF;

  SELECT count(*) INTO exact_services
  FROM jsonb_array_elements(catalogue.value->'services') AS entry(service)
  WHERE (service->>'id' = 'github'
      AND service->>'name' = 'GitHub subscription'
      AND service->>'provider' = 'GitHub')
     OR (service->>'id' = 'zoho'
      AND service->>'name' = 'Zoho business software'
      AND service->>'provider' = 'Zoho');

  IF exact_services <> 2 THEN
    RAISE EXCEPTION 'TEST_SOFTWARE_SERVICE_IDENTITY_CHANGED';
  END IF;

  SELECT count(*) INTO matches
  FROM public.operational_records
  WHERE organization_id = target_org AND record_type = 'Supplier'
    AND (reference = 'HLPL-SUP-TEST-GITHUB' OR title = 'GitHub');

  IF matches > 1 THEN RAISE EXCEPTION 'TEST_GITHUB_SUPPLIER_IDENTITY_AMBIGUOUS'; END IF;

  IF matches = 1 THEN
    SELECT * INTO github_supplier
    FROM public.operational_records
    WHERE organization_id = target_org AND record_type = 'Supplier'
      AND (reference = 'HLPL-SUP-TEST-GITHUB' OR title = 'GitHub')
    FOR UPDATE;
    IF github_supplier.reference <> 'HLPL-SUP-TEST-GITHUB'
       OR github_supplier.title <> 'GitHub'
       OR github_supplier.archived_at IS NOT NULL
       OR github_supplier.status::text <> 'draft'
       OR github_supplier.is_demo IS DISTINCT FROM true
       OR github_supplier.fields->>'sourceServiceId' <> 'github' THEN
      RAISE EXCEPTION 'TEST_GITHUB_SUPPLIER_IDENTITY_CONFLICT';
    END IF;
  ELSE
    INSERT INTO public.operational_records(
      organization_id, department_id, area, record_type, reference, title,
      status, fields, notes, created_by, updated_by, is_demo
    ) VALUES (
      target_org, purchaser, 'pur', 'Supplier', 'HLPL-SUP-TEST-GITHUB',
      'GitHub', 'draft',
      jsonb_build_object(
        'name', 'GitHub', 'revision', '01', 'demoOnly', true,
        'sourceServiceId', 'github', 'verification_status', 'unverified'
      ),
      'Draft TEST provider identity copied from the exact company expense catalogue label. Legal entity, contact, payment, and commercial details are unverified and intentionally blank.',
      actor, actor, true
    ) RETURNING * INTO github_supplier;
  END IF;

  SELECT count(*) INTO matches
  FROM public.operational_records
  WHERE organization_id = target_org AND record_type = 'Supplier'
    AND (reference = 'HLPL-SUP-TEST-ZOHO' OR title = 'Zoho');

  IF matches > 1 THEN RAISE EXCEPTION 'TEST_ZOHO_SUPPLIER_IDENTITY_AMBIGUOUS'; END IF;

  IF matches = 1 THEN
    SELECT * INTO zoho_supplier
    FROM public.operational_records
    WHERE organization_id = target_org AND record_type = 'Supplier'
      AND (reference = 'HLPL-SUP-TEST-ZOHO' OR title = 'Zoho')
    FOR UPDATE;
    IF zoho_supplier.reference <> 'HLPL-SUP-TEST-ZOHO'
       OR zoho_supplier.title <> 'Zoho'
       OR zoho_supplier.archived_at IS NOT NULL
       OR zoho_supplier.status::text <> 'draft'
       OR zoho_supplier.is_demo IS DISTINCT FROM true
       OR zoho_supplier.fields->>'sourceServiceId' <> 'zoho' THEN
      RAISE EXCEPTION 'TEST_ZOHO_SUPPLIER_IDENTITY_CONFLICT';
    END IF;
  ELSE
    INSERT INTO public.operational_records(
      organization_id, department_id, area, record_type, reference, title,
      status, fields, notes, created_by, updated_by, is_demo
    ) VALUES (
      target_org, purchaser, 'pur', 'Supplier', 'HLPL-SUP-TEST-ZOHO',
      'Zoho', 'draft',
      jsonb_build_object(
        'name', 'Zoho', 'revision', '01', 'demoOnly', true,
        'sourceServiceId', 'zoho', 'verification_status', 'unverified'
      ),
      'Draft TEST provider identity copied from the exact company expense catalogue label. Legal entity, contact, payment, and commercial details are unverified and intentionally blank.',
      actor, actor, true
    ) RETURNING * INTO zoho_supplier;
  END IF;

  FOR supplier_id_text IN
    SELECT service->>'supplierId'
    FROM jsonb_array_elements(catalogue.value->'services') AS entry(service)
    WHERE service->>'id' = 'github'
  LOOP
    IF NULLIF(supplier_id_text, '') IS NOT NULL AND supplier_id_text <> github_supplier.id::text THEN
      RAISE EXCEPTION 'TEST_GITHUB_SERVICE_SUPPLIER_CONFLICT';
    END IF;
  END LOOP;

  FOR supplier_id_text IN
    SELECT service->>'supplierId'
    FROM jsonb_array_elements(catalogue.value->'services') AS entry(service)
    WHERE service->>'id' = 'zoho'
  LOOP
    IF NULLIF(supplier_id_text, '') IS NOT NULL AND supplier_id_text <> zoho_supplier.id::text THEN
      RAISE EXCEPTION 'TEST_ZOHO_SERVICE_SUPPLIER_CONFLICT';
    END IF;
  END LOOP;

  SELECT jsonb_agg(
    CASE service->>'id'
      WHEN 'github' THEN service || jsonb_build_object('supplierId', github_supplier.id::text, 'provider', github_supplier.title)
      WHEN 'zoho' THEN service || jsonb_build_object('supplierId', zoho_supplier.id::text, 'provider', zoho_supplier.title)
      ELSE service
    END ORDER BY ordinality
  ) INTO linked_services
  FROM jsonb_array_elements(catalogue.value->'services') WITH ORDINALITY AS entries(service, ordinality);

  UPDATE private.expense_catalogues
  SET value = jsonb_set(value, '{services}', linked_services, false),
      version = version + 1,
      updated_by = actor,
      updated_at = now()
  WHERE organization_id = target_org AND scope = 'company';
END
$test_service_supplier_links$;
