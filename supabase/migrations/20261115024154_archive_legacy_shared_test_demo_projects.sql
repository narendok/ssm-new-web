-- Archive only the three reviewed, unmanifested fictional Shared TEST projects.
-- This is deliberately separate from the broad sample-pack reset: children stay intact.
CREATE OR REPLACE FUNCTION public.archive_legacy_shared_test_demo_projects(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  member record;
  prior private.shared_test_requests%ROWTYPE;
  request_hash text := pg_catalog.md5('archive_legacy_shared_test_demo_projects:v1');
  target_refs text[] := ARRAY[
    'HLPL-GEN-EHW-P10',
    'HLPL-TEST-ORION-PHASES-20261107',
    'HLPL-TEST-RACI-20261106'
  ];
  target_ids uuid[];
  target record;
  preserved jsonb;
  results jsonb := '[]'::jsonb;
  inventory_linked boolean := false;
  archived_count integer := 0;
  result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'REQUEST_ID_REQUIRED'; END IF;

  SELECT * INTO member FROM public.resolve_test_membership();
  IF member.membership_id IS NULL THEN RAISE EXCEPTION 'SHARED_TEST_MEMBERSHIP_REQUIRED'; END IF;
  IF member.role <> 'admin' THEN RAISE EXCEPTION 'LEGACY_PROJECT_ARCHIVE_ADMIN_REQUIRED'; END IF;
  IF NOT private.is_shared_test_org(member.organization_id) THEN RAISE EXCEPTION 'TEST_ORGANIZATION_REQUIRED'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(member.organization_id::text || ':legacy-project-archive:v1', 881)
  );
  SELECT * INTO prior FROM private.shared_test_requests
  WHERE organization_id = member.organization_id AND actor_id = auth.uid() AND request_id = p_request_id;
  IF FOUND THEN
    IF prior.request_hash <> request_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED'; END IF;
    RETURN prior.response;
  END IF;

  -- Exact reference, type and is_demo checks make this unusable as a general archive API.
  SELECT pg_catalog.array_agg(record.id ORDER BY record.reference)
    INTO target_ids
  FROM public.operational_records AS record
  WHERE record.organization_id = member.organization_id
    AND record.reference = ANY(target_refs)
    AND record.record_type = 'Project'
    AND record.is_demo;
  IF COALESCE(pg_catalog.cardinality(target_ids), 0) <> pg_catalog.cardinality(target_refs) THEN
    RAISE EXCEPTION 'LEGACY_DEMO_PROJECT_SET_CHANGED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.scenario_fixture_manifests AS manifest
    WHERE manifest.organization_id = member.organization_id AND manifest.canonical_id = ANY(target_ids)
  ) THEN RAISE EXCEPTION 'MANIFEST_OWNED_PROJECT'; END IF;

  -- Never archive a project carrying inventory history.
  IF pg_catalog.to_regclass('public.shared_inventory_events') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.shared_inventory_events event
      WHERE event.organization_id = $1 AND event.project_id = ANY($2))'
      INTO inventory_linked USING member.organization_id, target_ids;
    IF inventory_linked THEN RAISE EXCEPTION 'PROJECT_HAS_INVENTORY_HISTORY'; END IF;
  END IF;

  FOR target IN
    SELECT record.* FROM public.operational_records AS record
    WHERE record.id = ANY(target_ids)
    ORDER BY record.reference
    FOR UPDATE
  LOOP
    SELECT pg_catalog.jsonb_build_object(
      'tasks', (SELECT pg_catalog.count(*) FROM public.tasks task WHERE task.organization_id = member.organization_id AND task.record_id = target.id),
      'approvals', (SELECT pg_catalog.count(*) FROM public.approvals approval WHERE approval.organization_id = member.organization_id AND approval.record_id = target.id),
      'documents', (SELECT pg_catalog.count(*) FROM public.documents document WHERE document.organization_id = member.organization_id AND document.record_id = target.id),
      'recordLinks', (SELECT pg_catalog.count(*) FROM public.record_links link WHERE link.organization_id = member.organization_id AND (link.source_record_id = target.id OR link.target_record_id = target.id)),
      'stageReviews', (SELECT pg_catalog.count(*) FROM public.canonical_stage_reviews review WHERE review.organization_id = member.organization_id AND review.project_id = target.id)
    ) INTO preserved;

    IF target.archived_at IS NULL THEN
      UPDATE public.operational_records
      SET status = 'archived'::public.portal_record_status,
          archived_at = pg_catalog.now(),
          updated_by = auth.uid()
      WHERE id = target.id;
      archived_count := archived_count + 1;
    END IF;
    results := results || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'reference', target.reference,
      'wasArchived', target.archived_at IS NOT NULL,
      'previousStatus', target.status,
      'preservedChildren', preserved
    ));
  END LOOP;

  result := pg_catalog.jsonb_build_object(
    'status', 'legacy_demo_projects_archived',
    'organization', member.organization_name,
    'archivedCount', archived_count,
    'projects', results,
    'childrenDeleted', false,
    'inventoryHistoryChanged', false
  );
  INSERT INTO public.audit_events(organization_id, actor_id, entity_type, entity_id, action, detail)
  VALUES(member.organization_id, auth.uid(), 'shared_test_legacy_project_archive', NULL,
    'archive_exact_demo_projects', result || pg_catalog.jsonb_build_object('request_id', p_request_id));
  INSERT INTO private.shared_test_requests(organization_id, actor_id, request_id, request_hash, response)
  VALUES(member.organization_id, auth.uid(), p_request_id, request_hash, result);
  RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.archive_legacy_shared_test_demo_projects(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_legacy_shared_test_demo_projects(uuid) TO authenticated;
