-- Register the exact customer label/code already present on one demo-marked
-- Shared TEST Opportunity. Do not copy contact or commercial details.
DO $test_tata_customer$
DECLARE
  target_org uuid;
  opportunity public.operational_records%ROWTYPE;
  customer public.operational_records%ROWTYPE;
  sales_department uuid;
  customer_name constant text := 'Tata Motors Limited · EV Fleet Division';
  customer_reference constant text := 'TATA-EV';
  matches integer;
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
    AND reference = 'HLPL-GEN-SAL-OPP-AB1E826904DE413E8BD73511FCA134E5-01'
    AND fields->>'customer' = customer_name
    AND fields->>'customerCode' = customer_reference
    AND is_demo = true
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

  IF linked_projects > 0 THEN
    RAISE EXCEPTION 'TEST_TATA_PROJECT_LINK_REQUIRES_SEPARATE_REVIEW';
  END IF;

  SELECT count(*) INTO matches
  FROM public.operational_records
  WHERE organization_id = target_org
    AND record_type = 'Customer'
    AND (reference = customer_reference OR title = customer_name);

  IF matches > 1 THEN
    RAISE EXCEPTION 'TEST_TATA_CUSTOMER_IDENTITY_AMBIGUOUS';
  END IF;

  IF matches = 1 THEN
    SELECT * INTO customer
    FROM public.operational_records
    WHERE organization_id = target_org
      AND record_type = 'Customer'
      AND (reference = customer_reference OR title = customer_name)
    FOR UPDATE;

    IF customer.reference <> customer_reference
       OR customer.title <> customer_name
       OR customer.archived_at IS NOT NULL
       OR lower(btrim(customer.status::text)) IN ('archived','obsolete','rejected','inactive','cancelled','canceled','retired','disabled') THEN
      RAISE EXCEPTION 'TEST_TATA_CUSTOMER_MASTER_CONFLICT';
    END IF;
  ELSE
    SELECT id INTO sales_department
    FROM public.departments
    WHERE organization_id = target_org AND code = 'SAL' AND active;

    IF sales_department IS NULL THEN
      RAISE EXCEPTION 'TEST_TATA_SALES_DEPARTMENT_REQUIRED';
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
        'sourceCustomerCode', customer_reference
      ),
      'Draft Shared TEST master copied from the exact customer label and code on a demo-marked Opportunity; no contact details copied.',
      opportunity.created_by, opportunity.created_by, true
    ) RETURNING * INTO customer;
  END IF;

  IF COALESCE(NULLIF(btrim(opportunity.fields->>'customerId'), ''), customer.id::text) <> customer.id::text
     OR COALESCE(NULLIF(btrim(opportunity.fields->>'customer_id'), ''), customer.id::text) <> customer.id::text THEN
    RAISE EXCEPTION 'TEST_TATA_OPPORTUNITY_CUSTOMER_CONFLICT';
  END IF;

  UPDATE public.operational_records
  SET fields = fields || jsonb_build_object(
    'customerId', customer.id::text,
    'customer_id', customer.id::text,
    'customer', customer.title,
    'customerCode', customer.reference
  )
  WHERE id = opportunity.id;
END
$test_tata_customer$;
