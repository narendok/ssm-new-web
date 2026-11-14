-- The following customer identity is limited to the named Shared TEST workspace.
-- Its label and TESTORION code come from an explicitly fictional Opportunity,
-- and the Project is linked to that exact Opportunity by sourceOpportunityId.
DO $test_customer$
DECLARE
  target_org uuid;
  opportunity public.operational_records%ROWTYPE;
  linked_project public.operational_records%ROWTYPE;
  customer public.operational_records%ROWTYPE;
  sales_department uuid;
  customer_name constant text := 'Orion Controls Private Limited (fictional)';
  customer_reference constant text := 'HLPL-CUS-TESTORION';
  linked_projects integer;
BEGIN
  SELECT id INTO target_org
  FROM public.organizations
  WHERE name = 'TEST ONLY · SSM-new1 synthetic workspace';

  IF target_org IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO opportunity
  FROM public.operational_records
  WHERE organization_id = target_org
    AND record_type = 'Opportunity'
    AND reference = 'HLPL-GEN-SAL-ENQ-19B263D68FB14FE38955B28519B6BBDF-01'
    AND fields->>'customer' = customer_name
    AND fields->>'customerCode' = 'TESTORION'
    AND archived_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT count(*) INTO linked_projects
  FROM public.operational_records
  WHERE organization_id = target_org
    AND record_type = 'Project'
    AND archived_at IS NULL
    AND fields->>'sourceOpportunityId' = opportunity.id::text;

  IF linked_projects > 1 THEN
    RAISE EXCEPTION 'TEST_ORION_PROJECT_LINK_AMBIGUOUS';
  END IF;

  IF linked_projects = 1 THEN
    SELECT * INTO linked_project
    FROM public.operational_records
    WHERE organization_id = target_org
      AND record_type = 'Project'
      AND archived_at IS NULL
      AND fields->>'sourceOpportunityId' = opportunity.id::text
    FOR UPDATE;

    IF linked_project.fields->>'customer' IS DISTINCT FROM customer_name
       OR COALESCE(NULLIF(BTRIM(linked_project.fields->>'customerCode'), ''), 'TESTORION') <> 'TESTORION' THEN
      RAISE EXCEPTION 'TEST_ORION_PROJECT_IDENTITY_CONFLICT';
    END IF;
  END IF;

  SELECT * INTO customer
  FROM public.operational_records
  WHERE organization_id = target_org
    AND record_type = 'Customer'
    AND (reference = customer_reference OR title = customer_name)
    AND archived_at IS NULL;

  IF FOUND AND customer.title <> customer_name THEN
    RAISE EXCEPTION 'TEST_ORION_CUSTOMER_REFERENCE_CONFLICT';
  END IF;

  IF NOT FOUND THEN
    SELECT id INTO sales_department
    FROM public.departments
    WHERE organization_id = target_org AND code = 'SAL' AND active;

    IF sales_department IS NULL THEN
      RAISE EXCEPTION 'TEST_ORION_SALES_DEPARTMENT_REQUIRED';
    END IF;

    INSERT INTO public.operational_records(
      organization_id, department_id, area, record_type, reference, title,
      status, fields, notes, created_by, updated_by, is_demo
    ) VALUES (
      target_org, sales_department, 'sales', 'Customer', customer_reference,
      customer_name, 'draft',
      jsonb_build_object(
        'name', customer_name,
        'revision', '01',
        'demoOnly', true,
        'sourceOpportunityReference', opportunity.reference,
        'sourceCustomerCode', 'TESTORION'
      ),
      'Fictional Shared TEST customer linked from its exact Opportunity identity; no real contact details recorded.',
      opportunity.created_by, opportunity.created_by, true
    ) RETURNING * INTO customer;
  END IF;

  IF customer.reference <> customer_reference
     OR customer.title <> customer_name
     OR lower(BTRIM(customer.status::text)) IN ('archived', 'obsolete', 'rejected', 'inactive', 'cancelled', 'canceled', 'retired', 'disabled') THEN
    RAISE EXCEPTION 'TEST_ORION_CUSTOMER_NOT_SELECTABLE';
  END IF;

  IF COALESCE(NULLIF(BTRIM(opportunity.fields->>'customerId'), ''), customer.id::text) <> customer.id::text
     OR COALESCE(NULLIF(BTRIM(opportunity.fields->>'customer_id'), ''), customer.id::text) <> customer.id::text THEN
    RAISE EXCEPTION 'TEST_ORION_OPPORTUNITY_CUSTOMER_CONFLICT';
  END IF;

  UPDATE public.operational_records
  SET fields = fields || jsonb_build_object(
    'customerId', customer.id::text,
    'customer_id', customer.id::text,
    'customer', customer.title,
    'customerCode', customer.reference
  )
  WHERE id = opportunity.id;

  IF linked_projects = 1 THEN
    IF COALESCE(NULLIF(BTRIM(linked_project.fields->>'customerId'), ''), customer.id::text) <> customer.id::text
       OR COALESCE(NULLIF(BTRIM(linked_project.fields->>'customer_id'), ''), customer.id::text) <> customer.id::text THEN
      RAISE EXCEPTION 'TEST_ORION_PROJECT_CUSTOMER_CONFLICT';
    END IF;

    UPDATE public.operational_records
    SET fields = fields || jsonb_build_object(
      'customerId', customer.id::text,
      'customer_id', customer.id::text,
      'customer', customer.title,
      'customerCode', customer.reference
    )
    WHERE id = linked_project.id;
  END IF;
END
$test_customer$;
