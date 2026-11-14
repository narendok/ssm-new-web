-- Authenticated, append-only inventory ledger for synthetic Shared TEST parts.
-- All seeded balances are explicitly fictional filter/demo fixtures.
CREATE TABLE public.shared_inventory_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  part_id uuid NOT NULL REFERENCES public.operational_records(id) ON DELETE RESTRICT,
  department_id uuid REFERENCES public.departments(id) ON DELETE RESTRICT,
  event_kind text NOT NULL CHECK (event_kind IN (
    'opening', 'receipt', 'adjustment', 'hold', 'release_hold', 'assign', 'return', 'consume'
  )),
  on_hand_delta numeric(14,3) NOT NULL DEFAULT 0,
  held_delta numeric(14,3) NOT NULL DEFAULT 0,
  allocated_delta numeric(14,3) NOT NULL DEFAULT 0,
  location text NOT NULL,
  bin text NOT NULL DEFAULT '',
  project_id uuid REFERENCES public.operational_records(id) ON DELETE RESTRICT,
  supplier_id uuid REFERENCES public.operational_records(id) ON DELETE RESTRICT,
  purchase_order_id uuid REFERENCES public.operational_records(id) ON DELETE RESTRICT,
  assignment_id uuid,
  assignment_role_id uuid REFERENCES public.department_roles(id) ON DELETE RESTRICT,
  assigned_member_id uuid REFERENCES public.organization_members(id) ON DELETE RESTRICT,
  lot_code text,
  date_code text,
  note text NOT NULL,
  request_id uuid,
  request_hash text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  is_demo boolean NOT NULL DEFAULT false,
  fixture_key text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT shared_inventory_nonzero_event CHECK (
    on_hand_delta <> 0 OR held_delta <> 0 OR allocated_delta <> 0
  ),
  CONSTRAINT shared_inventory_assignment_event CHECK (
    (event_kind IN ('assign','return','consume') AND assignment_id IS NOT NULL
      AND project_id IS NOT NULL AND assignment_role_id IS NOT NULL)
    OR (event_kind NOT IN ('assign','return','consume') AND assignment_id IS NULL
      AND assignment_role_id IS NULL AND assigned_member_id IS NULL)
  ),
  CONSTRAINT shared_inventory_fixture_is_demo CHECK (
    fixture_key IS NULL OR (is_demo AND event_kind='opening' AND actor_id IS NULL)
  ),
  CONSTRAINT shared_inventory_event_shape CHECK (
    (event_kind='opening' AND fixture_key IS NOT NULL AND on_hand_delta>0)
    OR (event_kind='receipt' AND fixture_key IS NULL AND actor_id IS NOT NULL
      AND purchase_order_id IS NOT NULL AND supplier_id IS NOT NULL
      AND on_hand_delta>0 AND held_delta=on_hand_delta AND allocated_delta=0)
    OR (event_kind='adjustment' AND fixture_key IS NULL AND actor_id IS NOT NULL
      AND on_hand_delta<>0 AND held_delta=0 AND allocated_delta=0)
    OR (event_kind='hold' AND fixture_key IS NULL AND actor_id IS NOT NULL
      AND on_hand_delta=0 AND held_delta>0 AND allocated_delta=0)
    OR (event_kind='release_hold' AND fixture_key IS NULL AND actor_id IS NOT NULL
      AND on_hand_delta=0 AND held_delta<0 AND allocated_delta=0)
    OR (event_kind='assign' AND fixture_key IS NULL AND actor_id IS NOT NULL
      AND on_hand_delta=0 AND held_delta=0 AND allocated_delta>0)
    OR (event_kind='return' AND fixture_key IS NULL AND actor_id IS NOT NULL
      AND held_delta=0 AND allocated_delta<0 AND on_hand_delta IN (0,allocated_delta))
    OR (event_kind='consume' AND fixture_key IS NULL AND actor_id IS NOT NULL
      AND held_delta=0 AND allocated_delta<0 AND on_hand_delta=allocated_delta)
  )
);

CREATE UNIQUE INDEX shared_inventory_fixture_key_unique
  ON public.shared_inventory_events(organization_id, fixture_key) WHERE fixture_key IS NOT NULL;
CREATE UNIQUE INDEX shared_inventory_request_unique
  ON public.shared_inventory_events(organization_id, actor_id, request_id)
  WHERE request_id IS NOT NULL AND actor_id IS NOT NULL;
CREATE INDEX shared_inventory_part_time_idx
  ON public.shared_inventory_events(organization_id, part_id, created_at DESC);
CREATE INDEX shared_inventory_assignment_idx
  ON public.shared_inventory_events(organization_id, assignment_id, created_at)
  WHERE assignment_id IS NOT NULL;

ALTER TABLE public.shared_inventory_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shared_inventory_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.prevent_shared_inventory_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  RAISE EXCEPTION 'INVENTORY_LEDGER_APPEND_ONLY';
END
$function$;

REVOKE ALL ON FUNCTION private.prevent_shared_inventory_event_mutation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER shared_inventory_events_append_only
  BEFORE UPDATE OR DELETE ON public.shared_inventory_events
  FOR EACH ROW EXECUTE FUNCTION private.prevent_shared_inventory_event_mutation();

-- Fictional opening balances are keyed by the already-created synthetic Part masters.
-- They are not receipts, commitments, accepted specifications, or Production stock.
INSERT INTO public.shared_inventory_events (
  organization_id, part_id, department_id, event_kind, on_hand_delta, held_delta,
  location, bin, note, is_demo, fixture_key
)
SELECT
  r.organization_id,
  r.id,
  department.id,
  'opening',
  CASE r.reference
    WHEN 'HLPL-DEMO-INV-CON-01' THEN 48 WHEN 'HLPL-DEMO-INV-CON-02' THEN 17
    WHEN 'HLPL-DEMO-INV-CON-03' THEN 6 WHEN 'HLPL-DEMO-INV-CON-04' THEN 24
    WHEN 'HLPL-DEMO-INV-ELE-01' THEN 96 WHEN 'HLPL-DEMO-INV-ELE-02' THEN 32
    WHEN 'HLPL-DEMO-INV-ENC-01' THEN 20 WHEN 'HLPL-DEMO-INV-ENC-02' THEN 11
    WHEN 'HLPL-DEMO-INV-MEC-01' THEN 36 WHEN 'HLPL-DEMO-INV-MEC-02' THEN 18
    WHEN 'HLPL-DEMO-INV-PKG-01' THEN 72 WHEN 'HLPL-DEMO-INV-TOOL-01' THEN 8
    WHEN 'HLPL-DEMO-INV-CAB-01' THEN 120 WHEN 'HLPL-DEMO-INV-CAB-02' THEN 44
    WHEN 'HLPL-DEMO-INV-HAR-01' THEN 14 WHEN 'HLPL-DEMO-INV-HAR-02' THEN 22
    WHEN 'HLPL-DEMO-INV-HAR-03' THEN 9 WHEN 'HLPL-DEMO-INV-HAR-04' THEN 31
    WHEN 'HLPL-DEMO-INV-HAR-05' THEN 16 WHEN 'HLPL-DEMO-INV-HAR-06' THEN 7
    ELSE 0
  END,
  CASE WHEN r.reference IN (
    'HLPL-DEMO-INV-CON-04','HLPL-DEMO-INV-ENC-02','HLPL-DEMO-INV-HAR-05'
  ) THEN 3 ELSE 0 END,
  'Fictional TEST stockroom',
  'TEST-' || upper(split_part(r.reference, '-', 4)),
  'Fictional opening balance for Shared TEST category, department, availability, and hold filters; not a real receipt, supplier commitment, or Production quantity.',
  true,
  'shared-test-opening:' || r.reference
FROM public.operational_records AS r
LEFT JOIN public.departments AS department
  ON department.organization_id=r.organization_id
  AND department.active
  AND department.code=NULLIF(r.fields->>'primaryDepartment','')
WHERE private.is_shared_test_org(r.organization_id)
  AND r.record_type='Part'
  AND r.archived_at IS NULL
  AND r.is_demo
  AND r.reference LIKE 'HLPL-DEMO-INV-%'
  AND NULLIF(r.fields->>'category','') IS NOT NULL
ON CONFLICT (organization_id, fixture_key) WHERE fixture_key IS NOT NULL DO NOTHING;

CREATE OR REPLACE FUNCTION private.shared_inventory_can(
  p_organization_id uuid,
  p_department_id uuid,
  p_permission text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.resolve_test_membership() AS actor
    WHERE actor.organization_id=p_organization_id
      AND actor.role='admin'
  ) OR EXISTS (
    SELECT 1
    FROM public.resolve_test_membership() AS actor
    JOIN public.department_role_assignments AS assignment
      ON assignment.member_id=actor.membership_id AND assignment.active
    JOIN public.department_roles AS role
      ON role.id=assignment.role_id AND role.organization_id=p_organization_id
      AND role.department_id=p_department_id AND role.active
    JOIN public.role_permissions AS permission
      ON permission.role_id=role.id AND permission.allowed
      AND permission.permission_key=p_permission
    WHERE actor.organization_id=p_organization_id AND actor.role<>'viewer'
      AND NOT actor.is_client
  )
$function$;

REVOKE ALL ON FUNCTION private.shared_inventory_can(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.shared_inventory_can(uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION private.read_shared_inventory_part_catalog()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE actor record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'TEST_MEMBERSHIP_REQUIRED'; END IF;
  SELECT * INTO actor FROM public.resolve_test_membership();
  IF actor.membership_id IS NULL THEN RAISE EXCEPTION 'TEST_MEMBERSHIP_REQUIRED'; END IF;
  IF actor.role='viewer' OR actor.is_client THEN
    RETURN pg_catalog.jsonb_build_object(
      'items','[]'::pg_catalog.jsonb,'stockLedgerAvailable',false,
      'assignments','[]'::pg_catalog.jsonb,'movements','[]'::pg_catalog.jsonb,
      'projects','[]'::pg_catalog.jsonb,'roles','[]'::pg_catalog.jsonb,'receiptOptions','[]'::pg_catalog.jsonb
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'items', COALESCE((
      SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id',r.id,'reference',r.reference,'title',r.title,'status',r.status::text,
        'mpn',NULLIF(r.fields->>'mpn',''),'category',NULLIF(r.fields->>'category',''),
        'subcategory',NULLIF(r.fields->>'subcategory',''),
        'primaryDepartment',NULLIF(r.fields->>'primaryDepartment',''),
        'departmentViews',CASE WHEN pg_catalog.jsonb_typeof(r.fields->'departmentViews')='array'
          THEN r.fields->'departmentViews' ELSE '[]'::pg_catalog.jsonb END,
        'sampleDataNotice',CASE WHEN stock.has_demo_balance THEN
          replace(NULLIF(r.fields->>'sampleDataNotice',''),
            'stock, supplier, cost, location, receipt and release are not recorded.',
            'supplier, cost, accepted receipt, purchase commitment and Production usage are not recorded.')
          ELSE NULLIF(r.fields->>'sampleDataNotice','') END,
        'isDemo',r.is_demo,
        'onHand',COALESCE(stock.on_hand,0),'held',COALESCE(stock.held,0),
        'allocated',COALESCE(stock.allocated,0),
        'available',COALESCE(stock.on_hand,0)-COALESCE(stock.held,0)-COALESCE(stock.allocated,0),
        'unit',COALESCE(NULLIF(r.fields->>'unit',''),'units'),
        'stockNotice',CASE WHEN stock.has_demo_balance THEN
          'Fictional Shared TEST sample balance; not a real stock, receipt, or commitment.'
          ELSE 'No shared quantity recorded.' END
      ) ORDER BY r.reference,r.id)
      FROM public.operational_records AS r
      LEFT JOIN LATERAL (
        SELECT sum(e.on_hand_delta) AS on_hand,sum(e.held_delta) AS held,
          sum(e.allocated_delta) AS allocated,bool_or(e.is_demo) AS has_demo_balance
        FROM public.shared_inventory_events AS e
        WHERE e.organization_id=r.organization_id AND e.part_id=r.id
      ) AS stock ON true
      WHERE r.organization_id=actor.organization_id AND r.record_type='Part'
        AND r.archived_at IS NULL AND private.is_selectable_master_status(r.status::text)
    ),'[]'::pg_catalog.jsonb),
    'stockLedgerAvailable',true,
    'projects',COALESCE((
      SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id',project.id,'reference',project.reference,'title',project.title
      ) ORDER BY project.reference,project.id)
      FROM public.operational_records AS project
      WHERE project.organization_id=actor.organization_id AND project.record_type='Project'
        AND project.archived_at IS NULL AND project.is_demo
        AND private.is_selectable_master_status(project.status::text)
    ),'[]'::pg_catalog.jsonb),
    'roles',COALESCE((
      SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id',role.id,'name',role.name,'departmentCode',department.code,
        'hierarchyLevel',role.hierarchy_level
      ) ORDER BY department.code,role.hierarchy_level,role.name,role.id)
      FROM public.department_roles AS role
      JOIN public.departments AS department ON department.id=role.department_id
        AND department.organization_id=role.organization_id AND department.active
      WHERE role.organization_id=actor.organization_id AND role.active
        AND role.hierarchy_level BETWEEN 1 AND 4
        AND (actor.role='admin' OR EXISTS (
          SELECT 1 FROM public.department_role_assignments AS assignment
          JOIN public.role_permissions AS permission ON permission.role_id=role.id
            AND permission.allowed AND permission.permission_key='inventory:issue'
          WHERE assignment.role_id=role.id AND assignment.member_id=actor.membership_id AND assignment.active
        ))
    ),'[]'::pg_catalog.jsonb),
    'receiptOptions',COALESCE((
      SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'purchaseOrderId',purchase_order.id,'purchaseOrderReference',purchase_order.reference,
        'supplierId',supplier.id,'supplierReference',supplier.reference,'supplierName',supplier.title,
        'projectId',project.id,'projectReference',project.reference,'partId',part_line.part_id,
        'partReference',part.reference,'orderedQuantity',part_line.ordered_quantity,
        'receivedQuantity',COALESCE(received.quantity,0),
        'remainingQuantity',part_line.ordered_quantity-COALESCE(received.quantity,0)
      ) ORDER BY purchase_order.reference,part.reference)
      FROM public.operational_records AS purchase_order
      JOIN LATERAL (
        SELECT NULLIF(COALESCE(purchase_order.fields->>'supplierId',purchase_order.fields->>'supplier_id'),'')::uuid AS supplier_id,
          NULLIF(COALESCE(purchase_order.fields->>'projectId',purchase_order.fields->>'project_id'),'')::uuid AS project_id
      ) AS links ON true
      JOIN public.operational_records AS supplier ON supplier.id=links.supplier_id
        AND supplier.organization_id=actor.organization_id AND supplier.record_type='Supplier'
        AND supplier.archived_at IS NULL
      JOIN public.operational_records AS project ON project.id=links.project_id
        AND project.organization_id=actor.organization_id AND project.record_type='Project'
        AND project.archived_at IS NULL
      CROSS JOIN LATERAL (
        SELECT NULLIF(COALESCE(line->>'partId',line->>'part_id'),'')::uuid AS part_id,
          NULLIF(COALESCE(line->>'quantity',line->>'qty'),'')::numeric AS ordered_quantity
        FROM pg_catalog.jsonb_array_elements(
          CASE WHEN pg_catalog.jsonb_typeof(purchase_order.fields->'items')='array'
            THEN purchase_order.fields->'items' ELSE '[]'::pg_catalog.jsonb END
        ) AS line
      ) AS part_line
      JOIN public.operational_records AS part ON part.id=part_line.part_id
        AND part.organization_id=actor.organization_id AND part.record_type='Part'
        AND part.archived_at IS NULL AND part.is_demo AND part.reference LIKE 'HLPL-DEMO-INV-%'
      LEFT JOIN LATERAL (
        SELECT COALESCE(sum(event.on_hand_delta),0) AS quantity
        FROM public.shared_inventory_events AS event
        WHERE event.organization_id=actor.organization_id AND event.purchase_order_id=purchase_order.id
          AND event.part_id=part.id AND event.event_kind='receipt'
      ) AS received ON true
      WHERE purchase_order.organization_id=actor.organization_id
        AND lower(purchase_order.record_type)='purchase order' AND purchase_order.archived_at IS NULL
        AND lower(purchase_order.status::text) IN ('approved','released')
        AND part_line.ordered_quantity>COALESCE(received.quantity,0)
        AND private.shared_inventory_can(actor.organization_id,
          (SELECT department.id FROM public.departments AS department
            WHERE department.organization_id=actor.organization_id AND department.active AND department.code='PUR'),
          'inventory:receive')
    ),'[]'::pg_catalog.jsonb),
    'assignments',COALESCE((
      SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id',opened.assignment_id,'partId',opened.part_id,
        'partReference',part.reference,'partTitle',part.title,
        'projectId',opened.project_id,'projectReference',project.reference,
        'roleId',opened.assignment_role_id,'roleName',role.name,
        'departmentCode',department.code,'hierarchyLevel',role.hierarchy_level,
        'quantity',remaining.quantity,'assignedAt',opened.created_at,
        'location',opened.location,'bin',opened.bin,'note',opened.note
      ) ORDER BY opened.created_at DESC)
      FROM public.shared_inventory_events AS opened
      JOIN public.operational_records AS part ON part.id=opened.part_id
        AND part.organization_id=opened.organization_id
      JOIN public.operational_records AS project ON project.id=opened.project_id
        AND project.organization_id=opened.organization_id
      JOIN public.department_roles AS role ON role.id=opened.assignment_role_id
        AND role.organization_id=opened.organization_id
      JOIN public.departments AS department ON department.id=role.department_id
        AND department.organization_id=role.organization_id
      CROSS JOIN LATERAL (
        SELECT sum(event.allocated_delta) AS quantity
        FROM public.shared_inventory_events AS event
        WHERE event.organization_id=opened.organization_id
          AND event.assignment_id=opened.assignment_id
      ) AS remaining
      WHERE opened.organization_id=actor.organization_id AND opened.event_kind='assign'
        AND remaining.quantity>0
        AND (actor.role='admin' OR private.shared_test_scope(actor.organization_id,department.id))
    ),'[]'::pg_catalog.jsonb),
    'movements',COALESCE((
      SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id',event.id,'partId',event.part_id,'partReference',part.reference,
        'eventKind',event.event_kind,'onHandDelta',event.on_hand_delta,
        'heldDelta',event.held_delta,'allocatedDelta',event.allocated_delta,
        'location',event.location,'bin',event.bin,'lotCode',event.lot_code,
        'dateCode',event.date_code,'createdAt',event.created_at,
        'note',event.note,'isDemo',event.is_demo
      ) ORDER BY event.created_at DESC)
      FROM (SELECT * FROM public.shared_inventory_events
        WHERE organization_id=actor.organization_id
          AND (actor.role='admin' OR private.shared_test_scope(actor.organization_id,department_id))
        ORDER BY created_at DESC LIMIT 200) AS event
      JOIN public.operational_records AS part ON part.id=event.part_id
        AND part.organization_id=event.organization_id
    ),'[]'::pg_catalog.jsonb)
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

CREATE OR REPLACE FUNCTION private.record_shared_inventory_event(
  p_action text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  actor record;
  part public.operational_records%ROWTYPE;
  target_role public.department_roles%ROWTYPE;
  target_project public.operational_records%ROWTYPE;
  source_order public.operational_records%ROWTYPE;
  original_assignment public.shared_inventory_events%ROWTYPE;
  existing_event public.shared_inventory_events%ROWTYPE;
  req uuid;
  qty numeric(14,3);
  delta_on_hand numeric(14,3) := 0;
  delta_held numeric(14,3) := 0;
  delta_allocated numeric(14,3) := 0;
  new_assignment uuid;
  assignment_key uuid;
  project_key uuid;
  requested_role_id uuid;
  member_key uuid;
  supplier_key uuid;
  order_key uuid;
  department_key uuid;
  event_department uuid;
  current_on_hand numeric(14,3);
  current_held numeric(14,3);
  current_allocated numeric(14,3);
  assigned_remaining numeric(14,3);
  note_text text;
  place text;
  bin_text text;
  request_digest text;
  disposition text;
  permission_key text;
  ordered_qty numeric(14,3);
  already_received numeric(14,3);
  inserted_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'TEST_MEMBERSHIP_REQUIRED'; END IF;
  SELECT * INTO actor FROM public.resolve_test_membership();
  IF actor.membership_id IS NULL OR actor.role='viewer' OR actor.is_client THEN
    RAISE EXCEPTION 'TEST_MEMBERSHIP_REQUIRED';
  END IF;
  IF NOT private.is_shared_test_org(actor.organization_id) THEN
    RAISE EXCEPTION 'SHARED_TEST_ONLY';
  END IF;

  req := NULLIF(p_payload->>'requestId','')::uuid;
  qty := NULLIF(p_payload->>'quantity','')::numeric;
  note_text := btrim(COALESCE(p_payload->>'note',''));
  place := btrim(COALESCE(p_payload->>'location','Fictional TEST stockroom'));
  bin_text := btrim(COALESCE(p_payload->>'bin',''));
  IF req IS NULL OR qty IS NULL OR qty<=0 OR qty>1000000 THEN
    RAISE EXCEPTION 'INVENTORY_INVALID_REQUEST';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor.organization_id::text || ':' || auth.uid()::text || ':' || req::text,1)
  );
  IF char_length(note_text)<3 OR char_length(note_text)>500 OR char_length(place)>120 OR char_length(bin_text)>60 THEN
    RAISE EXCEPTION 'INVENTORY_INVALID_DETAILS';
  END IF;
  request_digest := pg_catalog.md5(p_action || ':' || p_payload::text);
  SELECT * INTO existing_event FROM public.shared_inventory_events AS event
  WHERE event.organization_id=actor.organization_id AND event.actor_id=auth.uid() AND event.request_id=req;
  IF FOUND THEN
    IF existing_event.request_hash IS DISTINCT FROM request_digest THEN
      RAISE EXCEPTION 'INVENTORY_IDEMPOTENCY_KEY_REUSED';
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'eventId',existing_event.id,'assignmentId',existing_event.assignment_id,'idempotent',true
    );
  END IF;

  SELECT * INTO part FROM public.operational_records AS record
  WHERE record.id=NULLIF(p_payload->>'partId','')::uuid
    AND record.organization_id=actor.organization_id AND record.record_type='Part'
    AND record.archived_at IS NULL AND record.is_demo
    AND record.reference LIKE 'HLPL-DEMO-INV-%'
  FOR SHARE;
  IF part.id IS NULL THEN RAISE EXCEPTION 'INVENTORY_PART_NOT_SELECTABLE'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor.organization_id::text || ':' || part.id::text,0)
  );
  SELECT COALESCE(sum(event.on_hand_delta),0),COALESCE(sum(event.held_delta),0),
    COALESCE(sum(event.allocated_delta),0)
  INTO current_on_hand,current_held,current_allocated
  FROM public.shared_inventory_events AS event
  WHERE event.organization_id=actor.organization_id AND event.part_id=part.id;

  IF p_action IN ('assign','return','consume') THEN
    assignment_key := NULLIF(p_payload->>'assignmentId','')::uuid;
    IF p_action='assign' THEN
      project_key := NULLIF(p_payload->>'projectId','')::uuid;
      requested_role_id := NULLIF(p_payload->>'roleId','')::uuid;
      member_key := NULLIF(p_payload->>'memberId','')::uuid;
      SELECT * INTO target_project FROM public.operational_records AS record
      WHERE record.id=project_key AND record.organization_id=actor.organization_id
        AND record.record_type='Project' AND record.archived_at IS NULL AND record.is_demo
      FOR SHARE;
      IF target_project.id IS NULL THEN RAISE EXCEPTION 'INVENTORY_PROJECT_NOT_SELECTABLE'; END IF;
      SELECT * INTO target_role FROM public.department_roles AS role
      WHERE role.id=requested_role_id AND role.organization_id=actor.organization_id
        AND role.active AND role.hierarchy_level BETWEEN 1 AND 4
      FOR SHARE;
      IF target_role.id IS NULL OR target_role.department_id IS NULL THEN
        RAISE EXCEPTION 'INVENTORY_ROLE_LEVEL_REQUIRED';
      END IF;
      department_key := target_role.department_id;
      event_department := target_role.department_id;
      IF member_key IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.department_role_assignments AS assignment
        JOIN public.organization_members AS member ON member.id=assignment.member_id
        WHERE assignment.role_id=target_role.id AND assignment.member_id=member_key
          AND assignment.active AND member.active AND member.organization_id=actor.organization_id
        FOR SHARE OF assignment,member
      ) THEN RAISE EXCEPTION 'INVENTORY_MEMBER_ROLE_MISMATCH'; END IF;
      permission_key := 'inventory:issue';
      delta_allocated := qty;
      new_assignment := gen_random_uuid();
      assignment_key := new_assignment;
    ELSE
      IF assignment_key IS NULL THEN RAISE EXCEPTION 'INVENTORY_ASSIGNMENT_REQUIRED'; END IF;
      SELECT * INTO original_assignment FROM public.shared_inventory_events AS event
      WHERE event.organization_id=actor.organization_id AND event.assignment_id=assignment_key
        AND event.event_kind='assign' AND event.part_id=part.id
      ORDER BY event.created_at,event.id LIMIT 1;
      IF original_assignment.id IS NULL THEN RAISE EXCEPTION 'INVENTORY_ASSIGNMENT_NOT_FOUND'; END IF;
      project_key := original_assignment.project_id;
      requested_role_id := original_assignment.assignment_role_id;
      department_key := (SELECT role.department_id FROM public.department_roles AS role WHERE role.id=requested_role_id);
      event_department := department_key;
      SELECT COALESCE(sum(event.allocated_delta),0) INTO assigned_remaining
      FROM public.shared_inventory_events AS event
      WHERE event.organization_id=actor.organization_id AND event.assignment_id=assignment_key;
      IF assigned_remaining<qty THEN RAISE EXCEPTION 'INVENTORY_RETURN_EXCEEDS_ASSIGNMENT'; END IF;
      permission_key := 'inventory:issue';
      delta_allocated := -qty;
      disposition := lower(COALESCE(p_payload->>'disposition','usable'));
      IF p_action='return' AND disposition NOT IN ('usable','scrap','rejected','unusable') THEN
        RAISE EXCEPTION 'INVENTORY_RETURN_DISPOSITION_INVALID';
      END IF;
      IF p_action='consume' OR (p_action='return' AND disposition IN ('scrap','rejected','unusable')) THEN
        delta_on_hand := -qty;
      ELSIF p_action NOT IN ('return','consume') THEN
        RAISE EXCEPTION 'INVENTORY_ACTION_NOT_SUPPORTED';
      END IF;
    END IF;
  ELSIF p_action='receipt' THEN
    order_key := NULLIF(p_payload->>'purchaseOrderId','')::uuid;
    supplier_key := NULLIF(p_payload->>'supplierId','')::uuid;
    SELECT * INTO source_order FROM public.operational_records AS record
    WHERE record.id=order_key AND record.organization_id=actor.organization_id
      AND lower(record.record_type)='purchase order' AND record.archived_at IS NULL
      AND lower(record.status::text) IN ('approved','released')
      AND NULLIF(COALESCE(record.fields->>'supplierId',record.fields->>'supplier_id'),'')::uuid=supplier_key
    FOR SHARE;
    IF source_order.id IS NULL THEN RAISE EXCEPTION 'INVENTORY_RECEIPT_REQUIRES_MATCHED_APPROVED_PO'; END IF;
    SELECT COALESCE(sum(NULLIF(COALESCE(line->>'quantity',line->>'qty'),'')::numeric),0)
    INTO ordered_qty
    FROM pg_catalog.jsonb_array_elements(
      CASE WHEN pg_catalog.jsonb_typeof(source_order.fields->'items')='array'
        THEN source_order.fields->'items' ELSE '[]'::pg_catalog.jsonb END
    ) AS line
    WHERE NULLIF(COALESCE(line->>'partId',line->>'part_id'),'')::uuid=part.id;
    SELECT COALESCE(sum(event.on_hand_delta),0) INTO already_received
    FROM public.shared_inventory_events AS event
    WHERE event.organization_id=actor.organization_id AND event.purchase_order_id=order_key
      AND event.part_id=part.id AND event.event_kind='receipt';
    IF ordered_qty<=0 OR qty>ordered_qty-already_received THEN
      RAISE EXCEPTION 'INVENTORY_RECEIPT_EXCEEDS_APPROVED_PO_LINE';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.operational_records AS supplier
      WHERE supplier.id=supplier_key AND supplier.organization_id=actor.organization_id
        AND supplier.record_type='Supplier' AND supplier.archived_at IS NULL FOR SHARE) THEN
      RAISE EXCEPTION 'INVENTORY_SUPPLIER_NOT_SELECTABLE';
    END IF;
    project_key := NULLIF(COALESCE(source_order.fields->>'projectId',source_order.fields->>'project_id'),'')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.operational_records AS project
      WHERE project.id=project_key AND project.organization_id=actor.organization_id
        AND project.record_type='Project' AND project.archived_at IS NULL FOR SHARE) THEN
      RAISE EXCEPTION 'INVENTORY_PO_PROJECT_NOT_SELECTABLE';
    END IF;
    department_key := (SELECT department.id FROM public.departments AS department
      WHERE department.organization_id=actor.organization_id AND department.active AND department.code='PUR');
    event_department := department_key;
    permission_key := 'inventory:receive';
    delta_on_hand := qty;
    delta_held := qty;
  ELSIF p_action IN ('hold','release_hold') THEN
    department_key := (SELECT department.id FROM public.departments AS department
      WHERE department.organization_id=actor.organization_id AND department.active AND department.code='QA');
    event_department := department_key;
    permission_key := CASE WHEN p_action='hold' THEN 'inventory:hold' ELSE 'inventory:release_hold' END;
    delta_held := CASE WHEN p_action='hold' THEN qty ELSE -qty END;
    IF p_action='release_hold' AND current_held<qty THEN RAISE EXCEPTION 'INVENTORY_RELEASE_EXCEEDS_HOLD'; END IF;
  ELSIF p_action='adjustment' THEN
    IF actor.role<>'admin' THEN RAISE EXCEPTION 'INVENTORY_ADJUSTMENT_ADMIN_ONLY'; END IF;
    IF lower(COALESCE(p_payload->>'direction','')) NOT IN ('increase','decrease') THEN
      RAISE EXCEPTION 'INVENTORY_ADJUSTMENT_DIRECTION_INVALID';
    END IF;
    delta_on_hand := CASE WHEN lower(p_payload->>'direction')='decrease' THEN -qty ELSE qty END;
    permission_key := 'inventory:adjust';
    event_department := NULL;
  ELSE
    RAISE EXCEPTION 'INVENTORY_ACTION_NOT_SUPPORTED';
  END IF;

  IF NOT private.shared_inventory_can(actor.organization_id,department_key,permission_key) THEN
    RAISE EXCEPTION 'INVENTORY_PERMISSION_DENIED';
  END IF;
  IF current_on_hand+delta_on_hand < current_held+delta_held+current_allocated+delta_allocated THEN
    RAISE EXCEPTION 'INVENTORY_INSUFFICIENT_AVAILABLE_STOCK';
  END IF;

  INSERT INTO public.shared_inventory_events (
    organization_id,part_id,department_id,event_kind,on_hand_delta,held_delta,allocated_delta,
    location,bin,project_id,supplier_id,purchase_order_id,assignment_id,
    assignment_role_id,assigned_member_id,lot_code,date_code,note,request_id,
    request_hash,actor_id,is_demo
  ) VALUES (
    actor.organization_id,part.id,event_department,p_action,delta_on_hand,delta_held,delta_allocated,
    place,bin_text,project_key,supplier_key,order_key,assignment_key,
    requested_role_id,member_key,NULLIF(p_payload->>'lotCode',''),NULLIF(p_payload->>'dateCode',''),
    note_text,req,request_digest,auth.uid(),true
  ) RETURNING id INTO inserted_id;

  RETURN pg_catalog.jsonb_build_object(
    'eventId',inserted_id,'assignmentId',assignment_key,'idempotent',false,
    'action',p_action,'partId',part.id,'quantity',qty
  );
END
$function$;

REVOKE ALL ON FUNCTION private.record_shared_inventory_event(text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.record_shared_inventory_event(text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_shared_inventory_event(p_action text,p_payload jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT private.record_shared_inventory_event(p_action,p_payload)
$function$;

REVOKE ALL ON FUNCTION public.record_shared_inventory_event(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_shared_inventory_event(text,jsonb) TO authenticated;
