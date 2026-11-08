-- Retire the known pre-canonical TEST fixture run when an authenticated TEST admin
-- resets the current canonical sample pack. Only rows explicitly owned by that
-- manifest are retired; uploaded file bytes and unrelated TEST records are kept.

CREATE OR REPLACE FUNCTION private.retire_legacy_test_fixture_run(p_org uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  legacy_run constant text := 'TEST-LIFECYCLE-20261025-001';
  legacy_records uuid[];
  retired_count integer;
BEGIN
  IF NOT private.is_shared_test_org(p_org) THEN
    RAISE EXCEPTION 'TEST_ORGANIZATION_REQUIRED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.scenario_fixture_manifests current_run
    JOIN public.scenario_fixture_manifests other_run
      ON other_run.organization_id = current_run.organization_id
     AND other_run.canonical_id = current_run.canonical_id
     AND other_run.run_id <> current_run.run_id
    WHERE current_run.organization_id = p_org AND current_run.run_id = legacy_run
  ) THEN
    RAISE EXCEPTION 'FIXTURE_RUN_SHARED';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT canonical_id), '{}'::uuid[])
    INTO legacy_records
  FROM public.scenario_fixture_manifests
  WHERE organization_id = p_org AND run_id = legacy_run
    AND entity_type IN ('project', 'record');
  retired_count := pg_catalog.cardinality(legacy_records);

  IF retired_count > 0 THEN
    DELETE FROM public.canonical_stage_reviews
    WHERE organization_id = p_org
      AND (record_id = ANY(legacy_records) OR project_id = ANY(legacy_records));

    IF pg_catalog.to_regclass('public.project_input_events') IS NOT NULL
       AND pg_catalog.to_regclass('public.project_input_sheets') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.project_input_events event USING public.project_input_sheets sheet
        WHERE event.sheet_id = sheet.id AND sheet.organization_id = $1
          AND (sheet.source_record_id = ANY($2) OR sheet.project_record_id = ANY($2))'
        USING p_org, legacy_records;
      EXECUTE 'DELETE FROM public.project_input_sheets WHERE organization_id = $1
        AND (source_record_id = ANY($2) OR project_record_id = ANY($2))'
        USING p_org, legacy_records;
    END IF;
    IF pg_catalog.to_regclass('public.decision_entries') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.decision_entries WHERE organization_id = $1 AND project_id = ANY($2)'
        USING p_org, legacy_records;
    END IF;
    IF pg_catalog.to_regclass('public.customer_change_events') IS NOT NULL
       AND pg_catalog.to_regclass('public.customer_change_impacts') IS NOT NULL
       AND pg_catalog.to_regclass('public.customer_change_requests') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.customer_change_events event USING public.customer_change_requests request
        WHERE event.request_id = request.id AND request.organization_id = $1 AND request.project_record_id = ANY($2)'
        USING p_org, legacy_records;
      EXECUTE 'DELETE FROM public.customer_change_impacts impact USING public.customer_change_requests request
        WHERE impact.request_id = request.id AND request.organization_id = $1 AND request.project_record_id = ANY($2)'
        USING p_org, legacy_records;
      EXECUTE 'DELETE FROM public.customer_change_requests WHERE organization_id = $1 AND project_record_id = ANY($2)'
        USING p_org, legacy_records;
    END IF;

    DELETE FROM public.approvals
    WHERE organization_id = p_org AND record_id = ANY(legacy_records);
    DELETE FROM public.tasks
    WHERE organization_id = p_org AND (
      id IN (SELECT canonical_id FROM public.scenario_fixture_manifests
        WHERE organization_id = p_org AND run_id = legacy_run AND entity_type = 'task')
      OR (record_id = ANY(legacy_records) AND template_task_key LIKE legacy_run || ':%')
    );
    DELETE FROM public.documents document
    WHERE document.id IN (SELECT canonical_id FROM public.scenario_fixture_manifests
      WHERE organization_id = p_org AND run_id = legacy_run AND entity_type = 'document')
      AND NOT EXISTS (SELECT 1 FROM public.controlled_document_files file WHERE file.document_id = document.id);
    DELETE FROM public.record_links
    WHERE organization_id = p_org
      AND (source_record_id = ANY(legacy_records) OR target_record_id = ANY(legacy_records));
  END IF;

  DELETE FROM public.scenario_fixture_manifests
  WHERE organization_id = p_org AND run_id = legacy_run;
  DELETE FROM public.operational_records
  WHERE organization_id = p_org AND id = ANY(legacy_records);

  RETURN pg_catalog.jsonb_build_object(
    'status', CASE WHEN retired_count > 0 THEN 'legacy_fixture_retired' ELSE 'no_legacy_fixture' END,
    'run_id', legacy_run,
    'retired_record_count', retired_count,
    'binary_files_preserved', true
  );
END;
$$;

REVOKE ALL ON FUNCTION private.retire_legacy_test_fixture_run(uuid) FROM PUBLIC, anon, authenticated;

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
  legacy_result jsonb;
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

  legacy_result := private.retire_legacy_test_fixture_run(member.organization_id);
  result := private.reset_canonical_sample_pack(member.organization_id, p_run_id)
    || pg_catalog.jsonb_build_object('legacy_fixture', legacy_result);
  INSERT INTO public.audit_events(organization_id, actor_id, entity_type, entity_id, action, detail)
  VALUES(member.organization_id, auth.uid(), 'canonical_sample_pack', NULL, 'reset_and_restore',
    pg_catalog.jsonb_build_object('run_id', p_run_id, 'request_id', p_request_id,
      'fictional_test_data', true, 'legacy_fixture', legacy_result));
  INSERT INTO private.shared_test_requests(organization_id, actor_id, request_id, request_hash, response)
  VALUES(member.organization_id, auth.uid(), p_request_id, request_hash, result);
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_shared_test_sample_pack(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_shared_test_sample_pack(text, uuid) TO authenticated;
