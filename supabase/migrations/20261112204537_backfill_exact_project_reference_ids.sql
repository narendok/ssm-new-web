WITH exact_project_references AS (
  SELECT
    organization_id,
    reference,
    (array_agg(id))[1] AS project_id
  FROM public.operational_records
  WHERE record_type = 'Project'
    AND archived_at IS NULL
  GROUP BY organization_id, reference
  HAVING count(*) = 1
)
UPDATE public.operational_records AS linked_record
SET fields = linked_record.fields || jsonb_build_object(
  'projectId', project.project_id::text,
  'project_id', project.project_id::text
)
FROM exact_project_references AS project
WHERE linked_record.organization_id = project.organization_id
  AND linked_record.record_type <> 'Project'
  AND linked_record.fields->>'projectId' = project.reference
  AND (
    NULLIF(BTRIM(linked_record.fields->>'project_id'), '') IS NULL
    OR linked_record.fields->>'project_id' = project.reference
    OR linked_record.fields->>'project_id' = project.project_id::text
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.operational_records AS id_match
    WHERE id_match.organization_id = linked_record.organization_id
      AND id_match.record_type = 'Project'
      AND id_match.archived_at IS NULL
      AND id_match.id::text = linked_record.fields->>'projectId'
  );
