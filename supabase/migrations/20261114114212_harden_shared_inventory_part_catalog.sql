-- Keep the elevated lookup behind a private helper; expose only an invoker RPC.
CREATE OR REPLACE FUNCTION private.read_shared_inventory_part_catalog()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  actor record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'TEST_MEMBERSHIP_REQUIRED';
  END IF;

  SELECT * INTO actor FROM public.resolve_test_membership();
  IF actor.membership_id IS NULL THEN
    RAISE EXCEPTION 'TEST_MEMBERSHIP_REQUIRED';
  END IF;

  IF actor.role = 'viewer' OR actor.is_client THEN
    RETURN pg_catalog.jsonb_build_object(
      'items', '[]'::pg_catalog.jsonb,
      'stockLedgerAvailable', false
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'items', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', r.id,
          'reference', r.reference,
          'title', r.title,
          'status', r.status::text,
          'mpn', NULLIF(r.fields->>'mpn', ''),
          'category', NULLIF(r.fields->>'category', ''),
          'subcategory', NULLIF(r.fields->>'subcategory', ''),
          'primaryDepartment', NULLIF(r.fields->>'primaryDepartment', ''),
          'departmentViews', CASE
            WHEN pg_catalog.jsonb_typeof(r.fields->'departmentViews') = 'array'
              THEN r.fields->'departmentViews'
            ELSE '[]'::pg_catalog.jsonb
          END,
          'sampleDataNotice', NULLIF(r.fields->>'sampleDataNotice', ''),
          'isDemo', r.is_demo
        ) ORDER BY r.reference, r.id
      )
      FROM public.operational_records AS r
      WHERE r.organization_id = actor.organization_id
        AND r.record_type = 'Part'
        AND r.archived_at IS NULL
        AND private.is_selectable_master_status(r.status::text)
    ), '[]'::pg_catalog.jsonb),
    'stockLedgerAvailable', false
  );
END
$function$;

REVOKE ALL ON FUNCTION private.read_shared_inventory_part_catalog() FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.read_shared_inventory_part_catalog() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_shared_inventory_part_catalog()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT private.read_shared_inventory_part_catalog()
$function$;

REVOKE ALL ON FUNCTION public.get_shared_inventory_part_catalog() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shared_inventory_part_catalog() TO authenticated;
