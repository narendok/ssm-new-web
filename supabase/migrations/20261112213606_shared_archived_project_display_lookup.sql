-- Preserve project labels for visible records that remain linked to archived
-- projects. These display-only lookups are not added to the selectable records
-- array, so archived projects cannot be selected for new work.
DO $migration$
DECLARE
  definition text := pg_get_functiondef('public.get_shared_test_workspace()'::regprocedure);
  marker constant text := $marker$'records',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC) FROM operational_records r WHERE r.organization_id=a.organization_id AND r.archived_at IS NULL AND private.shared_test_record_visible(r.id)),'[]'::jsonb),$marker$;
  replacement constant text := $replacement$'projectOptions',COALESCE((
   SELECT jsonb_agg(jsonb_build_object(
     'id',p.id,'reference',p.reference,'title',p.title,'status',p.status::text,'archived',true
   ) ORDER BY p.reference)
   FROM operational_records p
   WHERE p.organization_id=a.organization_id AND p.record_type='Project' AND p.archived_at IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM operational_records linked
       WHERE linked.organization_id=a.organization_id AND linked.archived_at IS NULL
         AND private.shared_test_record_visible(linked.id)
         AND (
           linked.fields->>'projectId'=p.id::text OR linked.fields->>'project_id'=p.id::text
           OR linked.fields->>'linkedProjectId'=p.id::text OR linked.fields->>'project'=p.id::text
           OR linked.fields->>'projectCode'=p.reference OR linked.fields->>'project_code'=p.reference
           OR linked.fields->>'projectReference'=p.reference
         )
     )
 ),'[]'::jsonb),
 'records',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC) FROM operational_records r WHERE r.organization_id=a.organization_id AND r.archived_at IS NULL AND private.shared_test_record_visible(r.id)),'[]'::jsonb),$replacement$;
BEGIN
  IF length(definition) - length(replace(definition, marker, '')) <> length(marker) THEN
    RAISE EXCEPTION 'SHARED_ARCHIVED_PROJECT_LOOKUP_PATCH_PRECONDITION';
  END IF;
  EXECUTE replace(definition, marker, replacement);
END
$migration$;

REVOKE ALL ON FUNCTION public.get_shared_test_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shared_test_workspace() TO authenticated;
