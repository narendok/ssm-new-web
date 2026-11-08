-- SOURCE ONLY. Do not apply until this SQL and the target's migration preconditions
-- have been reviewed. Intended only for isolated staging project jiqbxcqlywvvmhbgirzl;
-- never apply to production or the separate Lovable Cloud database.
-- Requires the existing shared TEST membership/visibility helpers and approved
-- project_input_sheets/project_input_events contract. It does not create notifications.
CREATE TABLE public.customer_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  project_record_id uuid NOT NULL REFERENCES public.operational_records(id),
  input_sheet_id uuid NOT NULL REFERENCES public.project_input_sheets(id),
  requested_by uuid NOT NULL REFERENCES public.organization_members(id),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 150),
  customer_reference text NOT NULL DEFAULT '' CHECK (length(customer_reference) <= 200),
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 5 AND 4000),
  rationale text NOT NULL CHECK (length(trim(rationale)) BETWEEN 5 AND 4000),
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Impact review', 'Pending approval', 'Returned', 'Approved', 'Rejected')),
  baseline_revision integer NOT NULL CHECK (baseline_revision > 0),
  baseline_version integer NOT NULL CHECK (baseline_version > 0),
  before_values jsonb NOT NULL CHECK (jsonb_typeof(before_values) = 'object'),
  proposed_values jsonb NOT NULL CHECK (jsonb_typeof(proposed_values) = 'object'),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  decision_notes text NOT NULL DEFAULT '',
  approved_revision integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (approved_revision IS NULL OR approved_revision > baseline_revision)
);

CREATE INDEX customer_change_requests_project_idx
  ON public.customer_change_requests (organization_id, project_record_id, created_at DESC);

CREATE TABLE public.customer_change_impacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.customer_change_requests(id),
  department_id uuid NOT NULL REFERENCES public.departments(id),
  impact_scope jsonb NOT NULL CHECK (jsonb_typeof(impact_scope) = 'object'),
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Assessed')),
  assessment text NOT NULL DEFAULT '',
  outcome text NOT NULL DEFAULT '',
  assessed_by uuid REFERENCES public.organization_members(id),
  assessed_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, department_id),
  CHECK (
    (status = 'Pending' AND assessed_by IS NULL AND assessed_at IS NULL)
    OR (status = 'Assessed' AND assessed_by IS NOT NULL AND assessed_at IS NOT NULL)
  )
);

CREATE INDEX customer_change_impacts_department_idx
  ON public.customer_change_impacts (department_id, status, request_id);

CREATE TABLE public.customer_change_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.customer_change_requests(id),
  actor_id uuid NOT NULL REFERENCES public.organization_members(id),
  operation_id uuid NOT NULL UNIQUE,
  operation_action text NOT NULL,
  operation_payload jsonb NOT NULL,
  action text NOT NULL,
  request_version integer NOT NULL CHECK (request_version > 0),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX customer_change_events_request_idx
  ON public.customer_change_events (request_id, created_at, id);

ALTER TABLE public.customer_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_change_impacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_change_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_change_requests, public.customer_change_impacts, public.customer_change_events
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.customer_change_scope_valid(p_scope jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  category text;
  entry jsonb;
  has_reference boolean := false;
BEGIN
  IF p_scope IS NULL OR jsonb_typeof(p_scope) <> 'object'
     OR p_scope - ARRAY['tracks', 'stages', 'documents', 'bom', 'reusableAssets'] <> '{}'::jsonb THEN
    RETURN false;
  END IF;
  FOREACH category IN ARRAY ARRAY['tracks', 'stages', 'documents', 'bom', 'reusableAssets'] LOOP
    IF jsonb_typeof(p_scope->category) IS DISTINCT FROM 'array' THEN
      RETURN false;
    END IF;
    IF jsonb_array_length(p_scope->category) > 100 THEN
      RETURN false;
    END IF;
    FOR entry IN SELECT value FROM jsonb_array_elements(p_scope->category) LOOP
      IF jsonb_typeof(entry) <> 'string'
         OR length(trim(entry #>> '{}')) NOT BETWEEN 1 AND 200 THEN
        RETURN false;
      END IF;
      has_reference := true;
    END LOOP;
  END LOOP;
  RETURN has_reference;
END;
$$;
REVOKE ALL ON FUNCTION private.customer_change_scope_valid(jsonb) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.reject_customer_change_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'CUSTOMER_CHANGE_AUDIT_IMMUTABLE';
END;
$$;
REVOKE ALL ON FUNCTION private.reject_customer_change_event_mutation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER customer_change_events_immutable
  BEFORE UPDATE OR DELETE ON public.customer_change_events
  FOR EACH ROW EXECUTE FUNCTION private.reject_customer_change_event_mutation();

CREATE FUNCTION private.customer_change_visible(p_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.customer_change_requests r
    JOIN public.organization_members m
      ON m.organization_id = r.organization_id
     AND m.user_id = auth.uid()
     AND m.active
     AND m.role <> 'viewer'
    WHERE r.id = p_request_id
      AND private.is_shared_test_org(r.organization_id)
      AND private.shared_test_record_visible(r.project_record_id)
      AND (
        m.role = 'admin'
        OR m.id = r.requested_by
        OR EXISTS (
          SELECT 1
          FROM public.customer_change_impacts i
          WHERE i.request_id = r.id
            AND i.department_id = private.shared_test_member_department(m.id)
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION private.customer_change_visible(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.get_customer_change_requests(p_project_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a record;
BEGIN
  SELECT * INTO a FROM public.resolve_test_membership();
  IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client OR a.role = 'viewer' THEN
    RAISE EXCEPTION 'CUSTOMER_CHANGE_ACCESS_DENIED';
  END IF;
  IF p_project_id IS NOT NULL AND NOT private.shared_test_record_visible(p_project_id) THEN
    RAISE EXCEPTION 'CUSTOMER_CHANGE_PROJECT_DENIED';
  END IF;
  RETURN jsonb_build_object(
    'requests',
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'organization_id', r.organization_id,
          'project_record_id', r.project_record_id,
          'input_sheet_id', r.input_sheet_id,
          'requested_by', r.requested_by,
          'title', r.title,
          'customer_reference', r.customer_reference,
          'description', r.description,
          'rationale', r.rationale,
          'status', r.status,
          'baseline_revision', r.baseline_revision,
          'baseline_version', r.baseline_version,
          'before_values', r.before_values,
          'proposed_values', r.proposed_values,
          'version', r.version,
          'decision_notes', r.decision_notes,
          'approved_revision', r.approved_revision,
          'created_at', r.created_at,
          'updated_at', r.updated_at,
          'impacts', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', i.id,
              'department_id', i.department_id,
              'department_code', d.code,
              'impact_scope', i.impact_scope,
              'status', i.status,
              'assessment', i.assessment,
              'outcome', i.outcome,
              'assessed_by', i.assessed_by,
              'assessed_at', i.assessed_at,
              'version', i.version,
              'updated_at', i.updated_at
            ) ORDER BY d.code)
            FROM public.customer_change_impacts i
            JOIN public.departments d ON d.id = i.department_id
            WHERE i.request_id = r.id
              AND (a.role = 'admin' OR a.membership_id = r.requested_by
                   OR i.department_id = private.shared_test_member_department(a.membership_id))
          ), '[]'::jsonb),
          'events', CASE
            WHEN a.role = 'admin' OR a.membership_id = r.requested_by THEN COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'id', e.id,
                'actor_id', e.actor_id,
                'actor_name', m.display_name,
                'action', e.action,
                'request_version', e.request_version,
                'details', e.details,
                'created_at', e.created_at
              ) ORDER BY e.created_at, e.id)
              FROM public.customer_change_events e
              JOIN public.organization_members m ON m.id = e.actor_id
              WHERE e.request_id = r.id
            ), '[]'::jsonb)
            ELSE '[]'::jsonb
          END
        ) ORDER BY r.created_at DESC
      )
      FROM public.customer_change_requests r
      WHERE r.organization_id = a.organization_id
        AND (p_project_id IS NULL OR r.project_record_id = p_project_id)
        AND private.customer_change_visible(r.id)
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_customer_change_requests(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_change_requests(uuid) TO authenticated;

CREATE FUNCTION public.mutate_customer_change_request(
  p_action text,
  p_payload jsonb,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a record;
  r public.customer_change_requests%ROWTYPE;
  s public.project_input_sheets%ROWTYPE;
  i public.customer_change_impacts%ROWTYPE;
  d public.departments%ROWTYPE;
  prior public.customer_change_events%ROWTYPE;
  entry jsonb;
  row_value jsonb;
  response_value jsonb;
  parameter jsonb;
  parameter_id text;
  outcome_value text;
  action_event text;
  request_id uuid;
  next_revision integer;
  response_key text;
BEGIN
  SELECT * INTO a FROM public.resolve_test_membership();
  IF auth.uid() IS NULL OR a.membership_id IS NULL OR a.is_client OR a.role = 'viewer' THEN
    RAISE EXCEPTION 'CUSTOMER_CHANGE_WRITE_DENIED';
  END IF;
  IF p_operation_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
     OR octet_length(p_payload::text) > 131072 THEN
    RAISE EXCEPTION 'INVALID_CUSTOMER_CHANGE_REQUEST';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(a.organization_id::text || 'project_inputs', 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_operation_id::text, 0));
  SELECT * INTO prior FROM public.customer_change_events WHERE operation_id = p_operation_id;
  IF FOUND THEN
    IF prior.actor_id <> a.membership_id
       OR prior.operation_action <> p_action
       OR prior.operation_payload IS DISTINCT FROM p_payload THEN
      RAISE EXCEPTION 'CUSTOMER_CHANGE_RETRY_PAYLOAD_CHANGED';
    END IF;
    SELECT * INTO r FROM public.customer_change_requests WHERE id = prior.request_id;
    RETURN to_jsonb(r);
  END IF;

  IF p_action = 'create' THEN
    IF a.role <> 'admin' AND (a.role <> 'department_lead' OR a.department_code IS DISTINCT FROM 'SAL') THEN
      RAISE EXCEPTION 'CUSTOMER_CHANGE_CREATE_DENIED';
    END IF;
    SELECT * INTO s
    FROM public.project_input_sheets
    WHERE id = (p_payload->>'sheetId')::uuid
      AND organization_id = a.organization_id
    FOR UPDATE;
    IF s.id IS NULL OR s.project_record_id IS NULL
       OR s.project_record_id IS DISTINCT FROM (p_payload->>'projectId')::uuid
       OR NOT private.project_input_visible(s.id)
       OR NOT private.shared_test_record_visible(s.project_record_id) THEN
      RAISE EXCEPTION 'CUSTOMER_CHANGE_PROJECT_DENIED';
    END IF;
    IF s.status <> 'Approved' THEN
      RAISE EXCEPTION 'CUSTOMER_CHANGE_APPROVED_BASELINE_REQUIRED';
    END IF;
    IF (p_payload->>'expectedSheetVersion')::integer IS DISTINCT FROM s.version
       OR (p_payload->>'expectedSheetRevision')::integer IS DISTINCT FROM s.revision THEN
      RAISE EXCEPTION 'CUSTOMER_CHANGE_STALE_BASELINE';
    END IF;
    IF length(trim(COALESCE(p_payload->>'title', ''))) NOT BETWEEN 3 AND 150
       OR length(trim(COALESCE(p_payload->>'description', ''))) NOT BETWEEN 5 AND 4000
       OR length(trim(COALESCE(p_payload->>'rationale', ''))) NOT BETWEEN 5 AND 4000
       OR length(COALESCE(p_payload->>'customerReference', '')) > 200
       OR jsonb_typeof(p_payload->'proposedValues') IS DISTINCT FROM 'object'
       OR p_payload->'proposedValues' = s.parameter_values
       OR jsonb_typeof(p_payload->'impacts') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'CUSTOMER_CHANGE_DRAFT_INVALID';
    END IF;
    IF jsonb_array_length(p_payload->'impacts') NOT BETWEEN 1 AND 30 THEN
      RAISE EXCEPTION 'CUSTOMER_CHANGE_DRAFT_INVALID';
    END IF;

    INSERT INTO public.customer_change_requests(
      organization_id, project_record_id, input_sheet_id, requested_by,
      title, customer_reference, description, rationale,
      baseline_revision, baseline_version, before_values, proposed_values
    ) VALUES (
      a.organization_id, s.project_record_id, s.id, a.membership_id,
      trim(p_payload->>'title'), trim(COALESCE(p_payload->>'customerReference', '')),
      trim(p_payload->>'description'), trim(p_payload->>'rationale'),
      s.revision, s.version, s.parameter_values, p_payload->'proposedValues'
    ) RETURNING * INTO r;

    FOR entry IN SELECT value FROM jsonb_array_elements(p_payload->'impacts') LOOP
      IF jsonb_typeof(entry) <> 'object'
         OR length(trim(COALESCE(entry->>'departmentCode', ''))) = 0
         OR NOT private.customer_change_scope_valid(entry->'scope') THEN
        RAISE EXCEPTION 'CUSTOMER_CHANGE_IMPACT_INVALID';
      END IF;
      SELECT * INTO d
      FROM public.departments
      WHERE organization_id = a.organization_id
        AND active
        AND code = upper(trim(entry->>'departmentCode'))
        AND code <> 'CLIENT';
      IF d.id IS NULL THEN RAISE EXCEPTION 'CUSTOMER_CHANGE_DEPARTMENT_INVALID'; END IF;
      INSERT INTO public.customer_change_impacts(request_id, department_id, impact_scope)
      VALUES (r.id, d.id, entry->'scope');
    END LOOP;

    action_event := 'created';
    request_id := r.id;
    INSERT INTO public.customer_change_events(
      request_id, actor_id, operation_id, operation_action, operation_payload,
      action, request_version, details
    ) VALUES (
      r.id, a.membership_id, p_operation_id, p_action, p_payload,
      action_event, r.version,
      jsonb_build_object('baselineRevision', r.baseline_revision, 'baselineVersion', r.baseline_version)
    );
    RETURN to_jsonb(r);
  END IF;

  request_id := (p_payload->>'requestId')::uuid;
  SELECT * INTO r
  FROM public.customer_change_requests
  WHERE id = request_id AND organization_id = a.organization_id
  FOR UPDATE;
  IF r.id IS NULL OR NOT private.customer_change_visible(r.id) THEN
    RAISE EXCEPTION 'CUSTOMER_CHANGE_ACCESS_DENIED';
  END IF;
  IF (p_payload->>'expectedVersion')::integer IS DISTINCT FROM r.version THEN
    RAISE EXCEPTION 'CUSTOMER_CHANGE_STALE_VERSION';
  END IF;

  IF p_action = 'update_draft' THEN
    IF r.status NOT IN ('Draft', 'Returned')
       OR (a.membership_id <> r.requested_by AND a.role <> 'admin') THEN
      RAISE EXCEPTION 'CUSTOMER_CHANGE_DRAFT_DENIED';
    END IF;
    SELECT * INTO s FROM public.project_input_sheets WHERE id = r.input_sheet_id FOR UPDATE;
    IF s.revision <> r.baseline_revision OR s.version <> r.baseline_version
       OR s.status <> 'Approved' THEN
      RAISE EXCEPTION 'CUSTOMER_CHANGE_STALE_BASELINE';
    END IF;
    IF length(trim(COALESCE(p_payload->>'title', ''))) NOT BETWEEN 3 AND 150
       OR length(trim(COALESCE(p_payload->>'description', ''))) NOT BETWEEN 5 AND 4000
       OR length(trim(COALESCE(p_payload->>'rationale', ''))) NOT BETWEEN 5 AND 4000
       OR length(COALESCE(p_payload->>'customerReference', '')) > 200
       OR jsonb_typeof(p_payload->'proposedValues') IS DISTINCT FROM 'object'
       OR p_payload->'proposedValues' = r.before_values
       OR jsonb_typeof(p_payload->'impacts') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'CUSTOMER_CHANGE_DRAFT_INVALID';
    END IF;
    IF jsonb_array_length(p_payload->'impacts') NOT BETWEEN 1 AND 30 THEN
      RAISE EXCEPTION 'CUSTOMER_CHANGE_DRAFT_INVALID';
    END IF;
    UPDATE public.customer_change_requests
    SET title = trim(p_payload->>'title'),
        customer_reference = trim(COALESCE(p_payload->>'customerReference', '')),
        description = trim(p_payload->>'description'),
        rationale = trim(p_payload->>'rationale'),
        proposed_values = p_payload->'proposedValues',
        status = 'Draft',
        decision_notes = '',
        version = version + 1,
        updated_at = clock_timestamp()
    WHERE id = r.id
    RETURNING * INTO r;
    DELETE FROM public.customer_change_impacts impacts WHERE impacts.request_id = r.id;
    FOR entry IN SELECT value FROM jsonb_array_elements(p_payload->'impacts') LOOP
      IF jsonb_typeof(entry) <> 'object'
         OR length(trim(COALESCE(entry->>'departmentCode', ''))) = 0
         OR NOT private.customer_change_scope_valid(entry->'scope') THEN
        RAISE EXCEPTION 'CUSTOMER_CHANGE_IMPACT_INVALID';
      END IF;
      SELECT * INTO d
      FROM public.departments
      WHERE organization_id = a.organization_id
        AND active
        AND code = upper(trim(entry->>'departmentCode'))
        AND code <> 'CLIENT';
      IF d.id IS NULL THEN RAISE EXCEPTION 'CUSTOMER_CHANGE_DEPARTMENT_INVALID'; END IF;
      INSERT INTO public.customer_change_impacts(request_id, department_id, impact_scope)
      VALUES (r.id, d.id, entry->'scope');
    END LOOP;
    action_event := 'draft_updated';
    INSERT INTO public.customer_change_events(
      request_id, actor_id, operation_id, operation_action, operation_payload,
      action, request_version, details
    ) VALUES (r.id, a.membership_id, p_operation_id, p_action, p_payload,
              action_event, r.version, '{}'::jsonb);
    RETURN to_jsonb(r);
  ELSIF p_action = 'submit' THEN
    IF r.status <> 'Draft'
       OR (a.membership_id <> r.requested_by AND a.role <> 'admin') THEN
      RAISE EXCEPTION 'CUSTOMER_CHANGE_SUBMIT_DENIED';
    END IF;
    SELECT * INTO s FROM public.project_input_sheets WHERE id = r.input_sheet_id FOR UPDATE;
    IF s.revision <> r.baseline_revision OR s.version <> r.baseline_version
       OR s.status <> 'Approved' THEN
      RAISE EXCEPTION 'CUSTOMER_CHANGE_STALE_BASELINE';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.customer_change_impacts impacts WHERE impacts.request_id = r.id
    ) THEN
      RAISE EXCEPTION 'CUSTOMER_CHANGE_IMPACT_REQUIRED';
    END IF;
    UPDATE public.customer_change_requests
    SET status = 'Impact review', version = version + 1, updated_at = clock_timestamp()
    WHERE id = r.id
    RETURNING * INTO r;
    action_event := 'submitted';
    INSERT INTO public.customer_change_events(
      request_id, actor_id, operation_id, operation_action, operation_payload,
      action, request_version, details
    ) VALUES (r.id, a.membership_id, p_operation_id, p_action, p_payload,
              action_event, r.version, '{}'::jsonb);
    RETURN to_jsonb(r);
  ELSIF p_action = 'assess_impact' THEN
    IF a.role <> 'department_lead' OR r.status <> 'Impact review' THEN
      RAISE EXCEPTION 'CUSTOMER_CHANGE_IMPACT_REVIEW_DENIED';
    END IF;
    SELECT * INTO i
    FROM public.customer_change_impacts impacts
    WHERE impacts.request_id = r.id
      AND impacts.department_id = private.shared_test_member_department(a.membership_id)
    FOR UPDATE;
    IF i.id IS NULL THEN RAISE EXCEPTION 'CUSTOMER_CHANGE_DEPARTMENT_DENIED'; END IF;
    IF (p_payload->>'expectedImpactVersion')::integer IS DISTINCT FROM i.version THEN
      RAISE EXCEPTION 'CUSTOMER_CHANGE_STALE_IMPACT';
    END IF;
    outcome_value := p_payload->>'outcome';
    IF outcome_value IS DISTINCT FROM 'Impact identified'
       AND outcome_value IS DISTINCT FROM 'No impact'
       AND outcome_value IS DISTINCT FROM 'Return for rework' THEN
      RAISE EXCEPTION 'CUSTOMER_CHANGE_ASSESSMENT_INVALID';
    END IF;
    IF length(trim(COALESCE(p_payload->>'assessment', ''))) NOT BETWEEN 5 AND 4000 THEN
      RAISE EXCEPTION 'CUSTOMER_CHANGE_ASSESSMENT_INVALID';
    END IF;
    IF i.status <> 'Pending' THEN RAISE EXCEPTION 'CUSTOMER_CHANGE_IMPACT_ALREADY_ASSESSED'; END IF;
    UPDATE public.customer_change_impacts
    SET status = 'Assessed',
        assessment = trim(p_payload->>'assessment'),
        outcome = outcome_value,
        assessed_by = a.membership_id,
        assessed_at = clock_timestamp(),
        version = version + 1,
        updated_at = clock_timestamp()
    WHERE id = i.id;
    IF outcome_value = 'Return for rework' THEN
      UPDATE public.customer_change_requests
      SET status = 'Returned',
          decision_notes = trim(p_payload->>'assessment'),
          version = version + 1,
          updated_at = clock_timestamp()
      WHERE id = r.id
      RETURNING * INTO r;
      action_event := 'impact_returned_for_rework';
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.customer_change_impacts impacts
        WHERE impacts.request_id = r.id AND impacts.status <> 'Assessed'
      ) THEN
        UPDATE public.customer_change_requests
        SET status = 'Pending approval', version = version + 1, updated_at = clock_timestamp()
        WHERE id = r.id
        RETURNING * INTO r;
      ELSE
        UPDATE public.customer_change_requests
        SET version = version + 1, updated_at = clock_timestamp()
        WHERE id = r.id
        RETURNING * INTO r;
      END IF;
      action_event := 'impact_assessed';
    END IF;
    INSERT INTO public.customer_change_events(
      request_id, actor_id, operation_id, operation_action, operation_payload,
      action, request_version, details
    ) VALUES (
      r.id, a.membership_id, p_operation_id, p_action, p_payload,
      action_event, r.version,
      jsonb_build_object('departmentId', i.department_id, 'outcome', outcome_value,
                         'assessment', trim(p_payload->>'assessment'))
    );
    RETURN to_jsonb(r);
  ELSIF p_action = 'decide' THEN
    IF a.role <> 'admin' OR a.membership_id = r.requested_by
       OR r.status <> 'Pending approval' THEN
      RAISE EXCEPTION 'CUSTOMER_CHANGE_DECISION_DENIED';
    END IF;
    IF length(trim(COALESCE(p_payload->>'notes', ''))) NOT BETWEEN 5 AND 4000
       OR (p_payload->>'decision') IS DISTINCT FROM 'approve'
          AND (p_payload->>'decision') IS DISTINCT FROM 'return'
          AND (p_payload->>'decision') IS DISTINCT FROM 'reject' THEN
      RAISE EXCEPTION 'CUSTOMER_CHANGE_DECISION_INVALID';
    END IF;
    SELECT * INTO s FROM public.project_input_sheets WHERE id = r.input_sheet_id FOR UPDATE;
    IF s.revision <> r.baseline_revision OR s.version <> r.baseline_version
       OR s.status <> 'Approved' THEN
      RAISE EXCEPTION 'CUSTOMER_CHANGE_STALE_BASELINE';
    END IF;
    IF p_payload->>'decision' = 'approve' THEN
      next_revision := s.revision + 1;
      FOR parameter IN
        SELECT value FROM jsonb_array_elements(private.project_input_template() || s.custom_parameters)
      LOOP
        parameter_id := parameter->>'id';
        IF NOT (r.proposed_values ? parameter_id) THEN
          RAISE EXCEPTION 'CUSTOMER_CHANGE_PARAMETER_MISSING: %', parameter_id;
        END IF;
      END LOOP;
      FOR parameter_id, row_value IN
        SELECT key, value FROM jsonb_each(r.proposed_values)
      LOOP
        IF NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(private.project_input_template() || s.custom_parameters) p
          WHERE p->>'id' = parameter_id
        ) OR jsonb_typeof(row_value) <> 'object'
           OR jsonb_typeof(row_value->'responses') IS DISTINCT FROM 'object' THEN
          RAISE EXCEPTION 'CUSTOMER_CHANGE_PARAMETER_INVALID: %', parameter_id;
        END IF;
        FOR response_value IN SELECT value FROM jsonb_each(row_value->'responses') LOOP
          IF jsonb_typeof(response_value) <> 'object' THEN
            RAISE EXCEPTION 'CUSTOMER_CHANGE_RESPONSE_INVALID: %', parameter_id;
          END IF;
        END LOOP;
        row_value := jsonb_build_object(
          'input', left(COALESCE(row_value->>'input', ''), 4000),
          'source', left(COALESCE(row_value->>'source', ''), 2000),
          'finalValue', left(COALESCE(row_value->>'finalValue', ''), 4000),
          'required', COALESCE((row_value->>'required')::boolean, true),
          'exclusionReason', left(COALESCE(row_value->>'exclusionReason', ''), 2000),
          'responses', COALESCE(r.before_values->parameter_id->'responses', '{}'::jsonb)
        );
        FOR response_key IN SELECT jsonb_object_keys(row_value->'responses') LOOP
          row_value := jsonb_set(row_value, ARRAY['responses', response_key, 'reviewedBy'], '""'::jsonb, true);
        END LOOP;
        r.proposed_values := jsonb_set(r.proposed_values, ARRAY[parameter_id], row_value);
      END LOOP;
      UPDATE public.project_input_sheets
      SET parameter_values = r.proposed_values,
          revision = next_revision,
          version = version + 1,
          status = 'Draft',
          client_evidence = '',
          updated_at = clock_timestamp()
      WHERE id = s.id
      RETURNING * INTO s;
      INSERT INTO public.project_input_events(sheet_id, actor_id, action, revision, details)
      VALUES (
        s.id, a.membership_id, 'customer_change_approved', s.revision,
        jsonb_build_object(
          'requestId', r.id,
          'previousRevision', r.baseline_revision,
          'baseline', r.before_values,
          'parameters', private.project_input_template() || s.custom_parameters,
          'scope', s.scope,
          'sourceId', s.source_record_id,
          'projectId', s.project_record_id,
          'clientEvidenceCleared', true
        )
      );
      UPDATE public.customer_change_requests
      SET status = 'Approved',
          proposed_values = r.proposed_values,
          decision_notes = trim(p_payload->>'notes'),
          approved_revision = next_revision,
          version = version + 1,
          updated_at = clock_timestamp()
      WHERE id = r.id
      RETURNING * INTO r;
      action_event := 'approved';
    ELSIF p_payload->>'decision' = 'return' THEN
      UPDATE public.customer_change_requests
      SET status = 'Returned', decision_notes = trim(p_payload->>'notes'),
          version = version + 1, updated_at = clock_timestamp()
      WHERE id = r.id
      RETURNING * INTO r;
      action_event := 'returned_for_rework';
    ELSE
      UPDATE public.customer_change_requests
      SET status = 'Rejected', decision_notes = trim(p_payload->>'notes'),
          version = version + 1, updated_at = clock_timestamp()
      WHERE id = r.id
      RETURNING * INTO r;
      action_event := 'rejected';
    END IF;
    INSERT INTO public.customer_change_events(
      request_id, actor_id, operation_id, operation_action, operation_payload,
      action, request_version, details
    ) VALUES (
      r.id, a.membership_id, p_operation_id, p_action, p_payload,
      action_event, r.version,
      jsonb_build_object('decision', p_payload->>'decision', 'notes', trim(p_payload->>'notes'),
                         'approvedRevision', r.approved_revision)
    );
    RETURN to_jsonb(r);
  ELSE
    RAISE EXCEPTION 'CUSTOMER_CHANGE_ACTION_INVALID';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.mutate_customer_change_request(text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mutate_customer_change_request(text, jsonb, uuid) TO authenticated;
