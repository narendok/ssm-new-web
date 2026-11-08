-- Admin-only reset for the shared, fictional TEST sample pack.
-- This function is source-only until the complete migration set is reviewed and
-- deliberately applied to an isolated TEST environment. Never apply to production.

CREATE OR REPLACE FUNCTION private.canonical_sample_test_text(p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE value text := COALESCE(p_value, '');
BEGIN
  value := replace(value, 'Internal Hexense Labs — Plant Tooling Division', 'Northstar Engineering Lab · Tooling');
  value := replace(value, 'Hexense Internal IT & Service', 'Northstar Engineering Lab · Internal Service');
  value := replace(value, 'Tata Motors Limited · EV Fleet Division', 'Northstar Mobility Systems · EV Fleet Program');
  value := replace(value, 'Bharat Heavy Logistics Ltd', 'Harborline Transit Systems');
  value := replace(value, 'City Delivery Express', 'Copperfield Transit Works');
  value := replace(value, 'FastCargo Logistics', 'Meridian Fleet Devices');
  value := regexp_replace(value, 'production', 'pilot', 'gi');
  value := regexp_replace(value, 'accepted', 'planned', 'gi');
  value := regexp_replace(value, 'approved', 'unverified TEST', 'gi');
  value := regexp_replace(value, 'released', 'not released TEST', 'gi');
  RETURN value;
END;
$$;

CREATE OR REPLACE FUNCTION private.canonical_sample_test_json(p_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE value_type text;
BEGIN
  IF p_value IS NULL THEN RETURN NULL; END IF;
  value_type := jsonb_typeof(p_value);
  IF value_type = 'string' THEN
    RETURN to_jsonb(private.canonical_sample_test_text(p_value #>> '{}'));
  ELSIF value_type = 'array' THEN
    RETURN COALESCE((SELECT jsonb_agg(private.canonical_sample_test_json(item))
      FROM jsonb_array_elements(p_value) AS item), '[]'::jsonb);
  ELSIF value_type = 'object' THEN
    RETURN COALESCE((SELECT jsonb_object_agg(key, private.canonical_sample_test_json(item))
      FROM jsonb_each(p_value) AS entry(key, item)), '{}'::jsonb);
  END IF;
  RETURN p_value;
END;
$$;

CREATE OR REPLACE FUNCTION private.reset_canonical_sample_pack(p_org uuid, p_run_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  sample_records uuid[];
  sync_result jsonb;
  refreshed_records uuid[];
BEGIN
  IF p_run_id IS DISTINCT FROM 'LC2-2026-10-28' THEN
    RAISE EXCEPTION 'FIXTURE_RUN_NOT_SUPPORTED';
  END IF;
  IF NOT private.is_shared_test_org(p_org) THEN RAISE EXCEPTION 'TEST_ORGANIZATION_REQUIRED'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_org::text || ':' || p_run_id, 881));

  -- A fixture cannot be reset while another named run also claims its rows.
  IF EXISTS (
    SELECT 1
    FROM public.scenario_fixture_manifests current_run
    JOIN public.scenario_fixture_manifests other_run
      ON other_run.organization_id = current_run.organization_id
     AND other_run.canonical_id = current_run.canonical_id
     AND other_run.run_id <> current_run.run_id
    WHERE current_run.organization_id = p_org AND current_run.run_id = p_run_id
  ) THEN RAISE EXCEPTION 'FIXTURE_RUN_SHARED'; END IF;

  -- Include the manifest records and only their linked deliverable/review records.
  WITH RECURSIVE related(id) AS (
    SELECT manifest.canonical_id
    FROM public.scenario_fixture_manifests manifest
    WHERE manifest.organization_id = p_org AND manifest.run_id = p_run_id
      AND manifest.entity_type IN ('project', 'record')
    UNION
    SELECT link.target_record_id
    FROM public.record_links link
    JOIN related parent ON parent.id = link.source_record_id
    WHERE link.organization_id = p_org AND link.relationship IN ('deliverable', 'stage_completion')
  )
  SELECT COALESCE(array_agg(DISTINCT id), '{}'::uuid[]) INTO sample_records FROM related;

  IF pg_catalog.cardinality(sample_records) > 0 THEN
    DELETE FROM public.canonical_stage_reviews
    WHERE organization_id = p_org AND (record_id = ANY(sample_records) OR project_id = ANY(sample_records));
    IF pg_catalog.to_regclass('public.project_input_events') IS NOT NULL
       AND pg_catalog.to_regclass('public.project_input_sheets') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.project_input_events event USING public.project_input_sheets sheet
        WHERE event.sheet_id = sheet.id AND sheet.organization_id = $1
          AND (sheet.source_record_id = ANY($2) OR sheet.project_record_id = ANY($2))'
        USING p_org, sample_records;
      EXECUTE 'DELETE FROM public.project_input_sheets WHERE organization_id = $1
        AND (source_record_id = ANY($2) OR project_record_id = ANY($2))'
        USING p_org, sample_records;
    END IF;
    IF pg_catalog.to_regclass('public.decision_entries') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.decision_entries WHERE organization_id = $1 AND project_id = ANY($2)'
        USING p_org, sample_records;
    END IF;
    IF pg_catalog.to_regclass('public.customer_change_events') IS NOT NULL
       AND pg_catalog.to_regclass('public.customer_change_impacts') IS NOT NULL
       AND pg_catalog.to_regclass('public.customer_change_requests') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.customer_change_events event USING public.customer_change_requests request
        WHERE event.request_id = request.id AND request.organization_id = $1 AND request.project_record_id = ANY($2)'
        USING p_org, sample_records;
      EXECUTE 'DELETE FROM public.customer_change_impacts impact USING public.customer_change_requests request
        WHERE impact.request_id = request.id AND request.organization_id = $1 AND request.project_record_id = ANY($2)'
        USING p_org, sample_records;
      EXECUTE 'DELETE FROM public.customer_change_requests WHERE organization_id = $1 AND project_record_id = ANY($2)'
        USING p_org, sample_records;
    END IF;
    DELETE FROM public.approvals
    WHERE organization_id = p_org AND record_id = ANY(sample_records);
    DELETE FROM public.tasks
    WHERE organization_id = p_org AND (
      id IN (SELECT canonical_id FROM public.scenario_fixture_manifests
        WHERE organization_id = p_org AND run_id = p_run_id AND entity_type = 'task')
      OR (record_id = ANY(sample_records) AND template_task_key LIKE p_run_id || ':%')
    );
    -- Uploaded file bytes and their file metadata are user evidence, not seed rows.
    DELETE FROM public.documents document
    WHERE document.id IN (SELECT canonical_id FROM public.scenario_fixture_manifests
      WHERE organization_id = p_org AND run_id = p_run_id AND entity_type = 'document')
      AND NOT EXISTS (SELECT 1 FROM public.controlled_document_files file WHERE file.document_id = document.id);
    DELETE FROM public.record_links
    WHERE organization_id = p_org AND (source_record_id = ANY(sample_records) OR target_record_id = ANY(sample_records));
  END IF;

  DELETE FROM public.scenario_fixture_manifests WHERE organization_id = p_org AND run_id = p_run_id;
  DELETE FROM public.operational_records WHERE organization_id = p_org AND id = ANY(sample_records);

  sync_result := public.sync_canonical_sample_pack(p_run_id);

  SELECT COALESCE(array_agg(DISTINCT canonical_id), '{}'::uuid[])
    INTO refreshed_records
  FROM public.scenario_fixture_manifests
  WHERE organization_id = p_org AND run_id = p_run_id AND entity_type IN ('project', 'record');

  UPDATE public.operational_records record
  SET title = private.canonical_sample_test_text(record.title),
      notes = private.canonical_sample_test_text(record.notes),
      fields = (private.canonical_sample_test_json(record.fields)
        - ARRAY['acceptedUnits','heldUnits','pendingInspectionUnits','remainingPlannedUnits']::text[])
        || jsonb_build_object('sampleDataNotice', 'Fictional TEST fixture · unverified · no customer acceptance or release recorded'),
      record_type = CASE WHEN record.record_type = 'Production order' THEN 'Pilot work order' ELSE record.record_type END,
      status = CASE WHEN record.status IN ('approved', 'released') THEN 'in_review'::public.portal_record_status ELSE record.status END,
      updated_at = clock_timestamp()
  WHERE record.organization_id = p_org AND record.id = ANY(refreshed_records);

  -- Replace customer labels by scenario so no real-world customer names survive the reset.
  UPDATE public.operational_records record SET fields = record.fields || jsonb_build_object('customer', CASE record.reference
    WHEN 'PRJ-INT-001' THEN 'Northstar Engineering Lab · fictional internal team'
    WHEN 'PRJ-POC-001' THEN 'Northstar Mobility Systems · fictional TEST customer'
    WHEN 'PRJ-PROD-001' THEN 'Harborline Transit Systems · fictional TEST customer'
    WHEN 'PRJ-APP-001' THEN 'Northstar Engineering Lab · fictional internal team'
    WHEN 'PRJ-RM-001' THEN 'Copperfield Transit Works · fictional TEST customer'
    WHEN 'PRJ-UPG-001' THEN 'Meridian Fleet Devices · fictional TEST customer'
    ELSE COALESCE(record.fields->>'customer', 'Fictional TEST customer') END)
  WHERE record.organization_id = p_org AND record.id = ANY(refreshed_records) AND record.record_type = 'Project';

  UPDATE public.tasks task
  SET title = private.canonical_sample_test_text(task.title),
      blocker = CASE WHEN task.blocker IS NULL THEN NULL ELSE private.canonical_sample_test_text(task.blocker) END,
      status = 'Open',
      updated_at = clock_timestamp()
  WHERE task.organization_id = p_org AND (
    task.id IN (SELECT canonical_id FROM public.scenario_fixture_manifests
      WHERE organization_id = p_org AND run_id = p_run_id AND entity_type = 'task')
    OR (task.record_id = ANY(refreshed_records) AND task.template_task_key LIKE p_run_id || ':%')
  );

  UPDATE public.documents document
  SET title = private.canonical_sample_test_text(document.title),
      reference_url = 'test-fixture/' || document.id::text,
      updated_at = clock_timestamp()
  WHERE document.organization_id = p_org AND document.id IN (
    SELECT canonical_id FROM public.scenario_fixture_manifests
    WHERE organization_id = p_org AND run_id = p_run_id AND entity_type = 'document'
  );

  RETURN sync_result || jsonb_build_object(
    'status', 'reset_and_restored',
    'run_id', p_run_id,
    'fictional_test_data', true,
    'binary_files_preserved', true,
    'reset_record_count', pg_catalog.cardinality(sample_records)
  );
END;
$$;

REVOKE ALL ON FUNCTION private.canonical_sample_test_text(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.canonical_sample_test_json(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.reset_canonical_sample_pack(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reset_shared_test_sample_pack(p_run_id text, p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  member record;
  prior private.shared_test_requests%ROWTYPE;
  request_hash text;
  result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  SELECT * INTO member FROM public.resolve_test_membership();
  IF NOT FOUND OR member.membership_id IS NULL THEN RAISE EXCEPTION 'SHARED_TEST_MEMBERSHIP_REQUIRED'; END IF;
  IF member.role <> 'admin' THEN RAISE EXCEPTION 'SAMPLE_RESET_ADMIN_REQUIRED'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'REQUEST_ID_REQUIRED'; END IF;
  IF p_run_id IS DISTINCT FROM 'LC2-2026-10-28' THEN RAISE EXCEPTION 'FIXTURE_RUN_NOT_SUPPORTED'; END IF;

  request_hash := pg_catalog.md5('reset_canonical_sample_pack:' || p_run_id);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(member.organization_id::text || ':' || p_run_id, 881));
  SELECT * INTO prior FROM private.shared_test_requests
  WHERE organization_id = member.organization_id AND actor_id = auth.uid() AND request_id = p_request_id;
  IF FOUND THEN
    IF prior.request_hash <> request_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED'; END IF;
    RETURN prior.response;
  END IF;

  result := private.reset_canonical_sample_pack(member.organization_id, p_run_id);
  INSERT INTO public.audit_events(organization_id, actor_id, entity_type, entity_id, action, detail)
  VALUES(member.organization_id, auth.uid(), 'canonical_sample_pack', NULL, 'reset_and_restore',
    pg_catalog.jsonb_build_object('run_id', p_run_id, 'request_id', p_request_id, 'fictional_test_data', true));
  INSERT INTO private.shared_test_requests(organization_id, actor_id, request_id, request_hash, response)
  VALUES(member.organization_id, auth.uid(), p_request_id, request_hash, result);
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_shared_test_sample_pack(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_shared_test_sample_pack(text, uuid) TO authenticated;
