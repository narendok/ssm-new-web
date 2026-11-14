-- Validate Project associations for Shared TEST operational records. Existing
-- untouched legacy aliases are preserved; only an explicit link change is
-- normalized or rejected.
CREATE OR REPLACE FUNCTION private.validate_project_record_master_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alias_key text;
  alias_value text;
  project_record public.operational_records%ROWTYPE;
  canonical_project_id uuid;
  project_match_count integer;
  link_changed boolean := TG_OP = 'INSERT';
  project_aliases constant text[] := ARRAY[
    'projectId', 'project_id', 'linkedProjectId',
    'projectCode', 'project_code', 'projectReference', 'project'
  ];
BEGIN
  IF NEW.record_type = 'Project' OR NOT private.is_shared_test_org(NEW.organization_id) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOREACH alias_key IN ARRAY project_aliases LOOP
      IF NULLIF(BTRIM(NEW.fields->>alias_key), '') IS DISTINCT FROM
         NULLIF(BTRIM(OLD.fields->>alias_key), '') THEN
        link_changed := true;
        EXIT;
      END IF;
    END LOOP;
    IF NOT link_changed THEN RETURN NEW; END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM jsonb_each_text(COALESCE(NEW.fields, '{}'::jsonb)) AS alias(key, value)
    WHERE alias.key = ANY(project_aliases) AND NULLIF(BTRIM(alias.value), '') IS NOT NULL
  ) THEN
    NEW.fields := COALESCE(NEW.fields, '{}'::jsonb) - project_aliases
      - ARRAY['projectName', 'project_name']::text[];
    RETURN NEW;
  END IF;

  FOREACH alias_key IN ARRAY project_aliases LOOP
    alias_value := NULLIF(BTRIM(NEW.fields->>alias_key), '');
    IF alias_value IS NULL THEN CONTINUE; END IF;

    SELECT count(*) INTO project_match_count
    FROM public.operational_records AS p
    WHERE p.organization_id = NEW.organization_id
      AND p.record_type = 'Project'
      AND p.archived_at IS NULL
      AND lower(p.status::text) NOT IN ('archived', 'obsolete', 'rejected', 'inactive', 'cancelled', 'canceled', 'retired', 'disabled')
      AND (p.id::text = alias_value OR p.reference = alias_value);
    IF project_match_count <> 1 THEN
      RAISE EXCEPTION 'PROJECT_LINK_INVALID';
    END IF;
    SELECT p.* INTO project_record
    FROM public.operational_records AS p
    WHERE p.organization_id = NEW.organization_id
      AND p.record_type = 'Project'
      AND p.archived_at IS NULL
      AND lower(p.status::text) NOT IN ('archived', 'obsolete', 'rejected', 'inactive', 'cancelled', 'canceled', 'retired', 'disabled')
      AND (p.id::text = alias_value OR p.reference = alias_value);
    IF NOT private.shared_test_record_visible(project_record.id) THEN RAISE EXCEPTION 'PROJECT_LINK_INVALID'; END IF;
    IF canonical_project_id IS NOT NULL AND canonical_project_id <> project_record.id THEN
      RAISE EXCEPTION 'PROJECT_LINK_INVALID';
    END IF;
    canonical_project_id := project_record.id;
  END LOOP;

  IF canonical_project_id IS NULL THEN RAISE EXCEPTION 'PROJECT_LINK_INVALID'; END IF;
  SELECT p.* INTO project_record
  FROM public.operational_records AS p
  WHERE p.id = canonical_project_id AND p.organization_id = NEW.organization_id;

  NEW.fields := COALESCE(NEW.fields, '{}'::jsonb) || jsonb_build_object(
    'projectId', project_record.id,
    'project_id', project_record.id,
    'linkedProjectId', project_record.id,
    'projectCode', project_record.reference,
    'project_code', project_record.reference,
    'projectReference', project_record.reference,
    'project', project_record.reference,
    'projectName', project_record.title,
    'project_name', project_record.title
  );
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION private.validate_project_record_master_link() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS validate_project_record_master_link ON public.operational_records;
CREATE TRIGGER validate_project_record_master_link
BEFORE INSERT OR UPDATE OF fields, organization_id, record_type
ON public.operational_records
FOR EACH ROW EXECUTE FUNCTION private.validate_project_record_master_link();
