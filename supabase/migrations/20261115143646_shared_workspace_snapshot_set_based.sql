-- Build the authenticated TEST workspace projection with set-based access checks.
-- The previous snapshot called shared_test_record_visible/shared_test_scope for
-- each record, task, approval, document, member, and archived-project link. Logs
-- implicated those nested authorization lookups in snapshot timeouts, but did
-- not prove them as the sole cause. Keep the same authorization predicates while
-- materializing them once for the request and retest with an authenticated user.
CREATE OR REPLACE FUNCTION public.get_shared_test_workspace()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  a record;
  result jsonb;
BEGIN
  SELECT * INTO a FROM public.resolve_test_membership();
  IF auth.uid() IS NULL OR a.membership_id IS NULL THEN
    RAISE EXCEPTION 'TEST_MEMBERSHIP_REQUIRED';
  END IF;

  WITH actor_members AS MATERIALIZED (
    SELECT m.id, m.organization_id, m.role
    FROM public.organization_members m
    WHERE m.organization_id = a.organization_id
      AND m.user_id = auth.uid()
      AND m.active
      AND private.is_shared_test_org(m.organization_id)
  ),
  actor_flags AS MATERIALIZED (
    SELECT
      COALESCE(bool_or(role = 'admin'), false) AS is_admin,
      COALESCE(bool_or(role <> 'viewer'), false) AS has_nonviewer
    FROM actor_members
  ),
  visible_departments AS MATERIALIZED (
    SELECT DISTINCT d.id
    FROM actor_members m
    JOIN public.departments d ON d.organization_id = m.organization_id AND d.active
    WHERE m.role <> 'viewer'
      AND (
        m.role = 'admin'
        OR d.lead_member_id = m.id
        OR EXISTS (
          SELECT 1
          FROM public.department_role_assignments assignment
          JOIN public.department_roles role ON role.id = assignment.role_id
          WHERE assignment.member_id = m.id
            AND assignment.active
            AND role.active
            AND role.organization_id = m.organization_id
            AND role.department_id = d.id
        )
      )
  ),
  member_departments AS MATERIALIZED (
    SELECT DISTINCT ON (m.id) m.id AS member_id, d.id AS department_id
    FROM public.organization_members m
    JOIN public.departments d ON d.organization_id = m.organization_id AND d.active
    WHERE m.organization_id = a.organization_id
      AND m.active
      AND (
        d.lead_member_id = m.id
        OR EXISTS (
          SELECT 1
          FROM public.department_role_assignments assignment
          JOIN public.department_roles role ON role.id = assignment.role_id
          WHERE assignment.member_id = m.id
            AND assignment.active
            AND role.active
            AND role.organization_id = m.organization_id
            AND role.department_id = d.id
        )
      )
    ORDER BY m.id, (d.lead_member_id = m.id) DESC, d.id
  ),
  visible_records AS MATERIALIZED (
    SELECT r.*
    FROM public.operational_records r
    CROSS JOIN actor_flags flags
    WHERE r.organization_id = a.organization_id
      AND r.archived_at IS NULL
      AND (
        flags.is_admin
        OR r.department_id IN (SELECT id FROM visible_departments)
        OR (r.record_type = 'Project' AND flags.has_nonviewer)
        OR EXISTS (
          SELECT 1
          FROM public.approvals approval
          WHERE approval.record_id = r.id
            AND approval.organization_id = r.organization_id
            AND (
              flags.is_admin
              OR COALESCE(approval.reviewer_department_id, approval.department_id)
                IN (SELECT id FROM visible_departments)
            )
        )
      )
  )
  SELECT jsonb_build_object(
    'membership', to_jsonb(a),
    'serverTime', now(),
    'departments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', d.id, 'code', d.code, 'name', d.name, 'lead_member_id', d.lead_member_id
      ) ORDER BY d.sort_order)
      FROM public.departments d
      WHERE d.organization_id = a.organization_id AND d.active AND d.code <> 'CLIENT'
    ), '[]'::jsonb),
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id,
        'display_name', m.display_name,
        'role', m.role,
        'department_id', md.department_id
      ))
      FROM public.organization_members m
      CROSS JOIN actor_flags flags
      LEFT JOIN member_departments md ON md.member_id = m.id
      WHERE m.organization_id = a.organization_id
        AND m.active
        AND (
          flags.is_admin
          OR md.department_id IN (SELECT id FROM visible_departments)
        )
    ), '[]'::jsonb),
    'customerOptions', CASE WHEN a.role <> 'viewer' AND NOT a.is_client THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'reference', r.reference, 'title', r.title, 'status', r.status::text
      ) ORDER BY r.reference)
      FROM public.operational_records r
      WHERE r.organization_id = a.organization_id AND r.record_type = 'Customer'
        AND r.archived_at IS NULL
        AND COALESCE(lower(btrim(r.status::text)), '') NOT IN
          ('archived', 'obsolete', 'rejected', 'inactive', 'cancelled', 'canceled', 'retired', 'disabled')
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'supplierOptions', CASE WHEN a.role <> 'viewer' AND NOT a.is_client THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'reference', r.reference, 'title', r.title, 'status', r.status::text
      ) ORDER BY r.reference)
      FROM public.operational_records r
      WHERE r.organization_id = a.organization_id AND r.record_type = 'Supplier'
        AND r.archived_at IS NULL
        AND COALESCE(lower(btrim(r.status::text)), '') NOT IN
          ('archived', 'obsolete', 'rejected', 'inactive', 'cancelled', 'canceled', 'retired', 'disabled')
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'partOptions', CASE WHEN a.role <> 'viewer' AND NOT a.is_client THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'reference', r.reference, 'title', r.title, 'status', r.status::text,
        'mpn', NULLIF(r.fields->>'mpn', '')
      ) ORDER BY r.reference)
      FROM public.operational_records r
      WHERE r.organization_id = a.organization_id AND r.record_type = 'Part'
        AND r.archived_at IS NULL
        AND COALESCE(lower(btrim(r.status::text)), '') NOT IN
          ('archived', 'obsolete', 'rejected', 'inactive', 'cancelled', 'canceled', 'retired', 'disabled')
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'productOptions', CASE WHEN a.role <> 'viewer' AND NOT a.is_client THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'reference', r.reference, 'title', r.title, 'status', r.status::text
      ) ORDER BY r.reference)
      FROM public.operational_records r
      WHERE r.organization_id = a.organization_id AND r.record_type = 'Product'
        AND r.archived_at IS NULL
        AND COALESCE(lower(btrim(r.status::text)), '') NOT IN
          ('archived', 'obsolete', 'rejected', 'inactive', 'cancelled', 'canceled', 'retired', 'disabled')
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'projectOptions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'reference', p.reference, 'title', p.title,
        'status', p.status::text, 'archived', true
      ) ORDER BY p.reference)
      FROM public.operational_records p
      WHERE p.organization_id = a.organization_id
        AND p.record_type = 'Project'
        AND p.archived_at IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM visible_records linked
          WHERE linked.fields->>'projectId' = p.id::text
            OR linked.fields->>'project_id' = p.id::text
            OR linked.fields->>'linkedProjectId' = p.id::text
            OR linked.fields->>'project' = p.id::text
            OR linked.fields->>'projectCode' = p.reference
            OR linked.fields->>'project_code' = p.reference
            OR linked.fields->>'projectReference' = p.reference
        )
    ), '[]'::jsonb),
    'records', COALESCE((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC) FROM visible_records r
    ), '[]'::jsonb),
    'tasks', COALESCE((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC)
      FROM public.tasks t
      CROSS JOIN actor_flags flags
      WHERE t.organization_id = a.organization_id
        AND (
          flags.is_admin
          OR t.department_id IN (SELECT id FROM visible_departments)
          OR t.assignee_id = a.membership_id
        )
    ), '[]'::jsonb),
    'approvals', COALESCE((
      SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC)
      FROM public.approvals p
      CROSS JOIN actor_flags flags
      WHERE p.organization_id = a.organization_id
        AND a.role <> 'viewer'
        AND (
          p.created_by = auth.uid()
          OR flags.is_admin
          OR p.department_id IN (SELECT id FROM visible_departments)
          OR p.reviewer_department_id IN (SELECT id FROM visible_departments)
        )
    ), '[]'::jsonb),
    'documents', COALESCE((
      SELECT jsonb_agg(to_jsonb(d) ORDER BY d.created_at DESC)
      FROM public.documents d
      CROSS JOIN actor_flags flags
      WHERE d.organization_id = a.organization_id
        AND (flags.is_admin OR d.department_id IN (SELECT id FROM visible_departments))
    ), '[]'::jsonb),
    'audit', COALESCE((
      SELECT jsonb_agg(to_jsonb(e))
      FROM (
        SELECT * FROM public.audit_events
        WHERE organization_id = a.organization_id
          AND (a.role = 'admin' OR actor_id = auth.uid())
        ORDER BY created_at DESC
        LIMIT 100
      ) e
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END
$function$;

REVOKE ALL ON FUNCTION public.get_shared_test_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shared_test_workspace() TO authenticated;
