-- Allow Sales/Admin to repair canonical Customer links on existing draft Projects.
-- The action changes only Customer aliases, uses optimistic locking/idempotency,
-- and never rewrites lifecycle or historical fields.
CREATE OR REPLACE FUNCTION private.set_shared_project_customer_link(
  p_project_id uuid,
  p_customer_id uuid,
  p_expected_updated_at timestamptz,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  actor record;
  sales_department uuid;
  project_record public.operational_records%ROWTYPE;
  customer_record public.operational_records%ROWTYPE;
  source_opportunity public.operational_records%ROWTYPE;
  prior_request record;
  request_hash text;
  old_customer_id text;
  source_customer_id text;
  result jsonb;
BEGIN
  SELECT * INTO actor FROM public.resolve_test_membership();
  IF auth.uid() IS NULL OR actor.membership_id IS NULL OR actor.is_client
     OR NOT private.is_shared_test_org(actor.organization_id) THEN
    RAISE EXCEPTION 'TEST_MEMBERSHIP_REQUIRED';
  END IF;

  SELECT id INTO sales_department
  FROM public.departments
  WHERE organization_id = actor.organization_id AND code = 'SAL' AND active;

  IF actor.role <> 'admin' AND NOT (
    actor.role = 'department_lead'
    AND sales_department IS NOT NULL
    AND private.shared_test_member_has_department(actor.membership_id, sales_department)
  ) THEN
    RAISE EXCEPTION 'PROJECT_CUSTOMER_LINK_EDIT_DENIED';
  END IF;

  IF p_project_id IS NULL OR p_expected_updated_at IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'PROJECT_CUSTOMER_LINK_INPUT_REQUIRED';
  END IF;

  request_hash := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(
      pg_catalog.jsonb_build_object(
        'project_id', p_project_id,
        'customer_id', p_customer_id,
        'expected_updated_at', p_expected_updated_at
      )::text,
      'UTF8'
    )),
    'hex'
  );

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor.organization_id::text, 0));
  SELECT * INTO prior_request
  FROM private.shared_test_requests
  WHERE organization_id = actor.organization_id
    AND actor_id = auth.uid()
    AND request_id = p_request_id;
  IF FOUND THEN
    IF prior_request.request_hash <> request_hash THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF;
    RETURN prior_request.response;
  END IF;

  SELECT * INTO project_record
  FROM public.operational_records
  WHERE id = p_project_id
    AND organization_id = actor.organization_id
    AND record_type = 'Project'
    AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
  IF project_record.status::text <> 'draft' THEN
    RAISE EXCEPTION 'PROJECT_CUSTOMER_LINK_DRAFT_ONLY';
  END IF;
  IF project_record.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'STALE_PROJECT: Reload before saving';
  END IF;

  source_customer_id := NULLIF(pg_catalog.btrim(project_record.fields->>'sourceOpportunityId'), '');
  IF source_customer_id IS NOT NULL THEN
    SELECT * INTO source_opportunity
    FROM public.operational_records
    WHERE id::text = source_customer_id
      AND organization_id = actor.organization_id
      AND record_type = 'Opportunity'
      AND archived_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'SOURCE_OPPORTUNITY_NOT_FOUND'; END IF;

    source_customer_id := COALESCE(
      NULLIF(pg_catalog.btrim(source_opportunity.fields->>'customerId'), ''),
      NULLIF(pg_catalog.btrim(source_opportunity.fields->>'customer_id'), '')
    );
    IF source_customer_id IS DISTINCT FROM p_customer_id::text THEN
      RAISE EXCEPTION 'PROJECT_CUSTOMER_MUST_MATCH_SOURCE_OPPORTUNITY';
    END IF;
  END IF;

  IF p_customer_id IS NOT NULL THEN
    SELECT * INTO customer_record
    FROM public.operational_records
    WHERE id = p_customer_id
      AND organization_id = actor.organization_id
      AND record_type = 'Customer'
      AND archived_at IS NULL
      AND pg_catalog.lower(status::text) NOT IN ('archived','obsolete','rejected','inactive','cancelled','canceled','retired','disabled');
    IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOMER_LINK_INVALID'; END IF;
  END IF;

  old_customer_id := COALESCE(
    NULLIF(pg_catalog.btrim(project_record.fields->>'customerId'), ''),
    NULLIF(pg_catalog.btrim(project_record.fields->>'customer_id'), '')
  );

  IF p_customer_id IS NULL THEN
    UPDATE public.operational_records
    SET fields = COALESCE(fields, '{}'::pg_catalog.jsonb) - ARRAY[
      'customerId','customer_id','customerCode','customer_code',
      'customer','customerName','customer_name'
    ]::text[],
        updated_at = pg_catalog.now(),
        updated_by = auth.uid()
    WHERE id = p_project_id;
  ELSE
    UPDATE public.operational_records
    SET fields = COALESCE(fields, '{}'::pg_catalog.jsonb) || pg_catalog.jsonb_build_object(
          'customerId', customer_record.id,
          'customer_id', customer_record.id,
          'customerCode', customer_record.reference,
          'customer_code', customer_record.reference,
          'customer', customer_record.title,
          'customerName', customer_record.title,
          'customer_name', customer_record.title
        ),
        updated_at = pg_catalog.now(),
        updated_by = auth.uid()
    WHERE id = p_project_id;
  END IF;

  INSERT INTO public.audit_events(organization_id, actor_id, entity_type, entity_id, action, detail)
  VALUES (
    actor.organization_id,
    auth.uid(),
    'project_customer_link',
    p_project_id,
    'project_customer_link_updated',
    pg_catalog.jsonb_build_object(
      'previous_customer_id', old_customer_id,
      'customer_id', p_customer_id,
      'source_opportunity_id', source_opportunity.id,
      'membership_id', actor.membership_id
    )
  );

  result := pg_catalog.jsonb_build_object('projectId', p_project_id, 'customerId', p_customer_id);
  INSERT INTO private.shared_test_requests(organization_id, actor_id, request_id, request_hash, response)
  VALUES (actor.organization_id, auth.uid(), p_request_id, request_hash, result);
  RETURN result;
END
$function$;

REVOKE ALL ON FUNCTION private.set_shared_project_customer_link(uuid,uuid,timestamptz,uuid) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.set_shared_project_customer_link(uuid,uuid,timestamptz,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_shared_project_customer_link(
  p_project_id uuid,
  p_customer_id uuid,
  p_expected_updated_at timestamptz,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT private.set_shared_project_customer_link(
    p_project_id,
    p_customer_id,
    p_expected_updated_at,
    p_request_id
  )
$function$;

REVOKE ALL ON FUNCTION public.set_shared_project_customer_link(uuid,uuid,timestamptz,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_shared_project_customer_link(uuid,uuid,timestamptz,uuid) TO authenticated;
