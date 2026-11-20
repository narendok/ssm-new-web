-- Atomic, authenticated consumption of assigned component stock at BOM kit issue.
-- BOM lines must explicitly carry canonical inventory Part IDs in fields.inventoryLines:
-- [{"partId":"<uuid>","quantityPerUnit":1,"unit":"pcs"}]. A released BOM
-- without exact links is not eligible. This migration is TEST-only by design.

ALTER TABLE public.shared_inventory_events
  ADD COLUMN IF NOT EXISTS source_record_id uuid REFERENCES public.operational_records(id) ON DELETE RESTRICT;

ALTER TABLE public.shared_inventory_events
  DROP CONSTRAINT IF EXISTS shared_inventory_events_event_kind_check;
ALTER TABLE public.shared_inventory_events
  ADD CONSTRAINT shared_inventory_events_event_kind_check
  CHECK (event_kind IN ('opening','receipt','adjustment','hold','release_hold','assign','return','consume','kit_issue'));

ALTER TABLE public.shared_inventory_events
  DROP CONSTRAINT IF EXISTS shared_inventory_assignment_event;
ALTER TABLE public.shared_inventory_events
  ADD CONSTRAINT shared_inventory_assignment_event CHECK (
    (event_kind IN ('assign','return','consume','kit_issue') AND assignment_id IS NOT NULL
      AND project_id IS NOT NULL AND assignment_role_id IS NOT NULL)
    OR (event_kind NOT IN ('assign','return','consume','kit_issue') AND assignment_id IS NULL
      AND assignment_role_id IS NULL AND assigned_member_id IS NULL)
  );

ALTER TABLE public.shared_inventory_events
  DROP CONSTRAINT IF EXISTS shared_inventory_event_shape;
ALTER TABLE public.shared_inventory_events
  ADD CONSTRAINT shared_inventory_event_shape CHECK (
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
    OR (event_kind='kit_issue' AND fixture_key IS NULL AND actor_id IS NOT NULL
      AND source_record_id IS NOT NULL AND held_delta=0
      AND allocated_delta<0 AND on_hand_delta=allocated_delta)
  );

CREATE TABLE IF NOT EXISTS public.shared_inventory_kit_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  bom_record_id uuid NOT NULL REFERENCES public.operational_records(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES public.operational_records(id) ON DELETE RESTRICT,
  build_quantity integer NOT NULL CHECK (build_quantity > 0 AND build_quantity <= 1000000),
  request_id uuid NOT NULL,
  request_hash text NOT NULL,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (organization_id, actor_id, request_id)
);
ALTER TABLE public.shared_inventory_events
  ADD COLUMN IF NOT EXISTS kit_issue_id uuid REFERENCES public.shared_inventory_kit_issues(id) ON DELETE RESTRICT;
ALTER TABLE public.shared_inventory_events
  ADD CONSTRAINT shared_inventory_kit_issue_event_link CHECK (
    (event_kind='kit_issue' AND kit_issue_id IS NOT NULL AND source_record_id IS NOT NULL)
    OR (event_kind<>'kit_issue' AND kit_issue_id IS NULL)
  );
ALTER TABLE public.shared_inventory_kit_issues ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shared_inventory_kit_issues FROM PUBLIC, anon, authenticated;

-- Add one inert, clearly fictional, released Shared TEST BOM so the kit issue path
-- can be tried after an Admin creates a role allocation for its exact Part ID.
-- A demo BOM is inserted only when the project is visible to the actual Admin
-- used for the seed. The record-link trigger reads auth.uid(), so set the
-- transaction-local claim to that existing Admin while inserting the fixture.
DO $seed$
DECLARE fixture record;
BEGIN
  FOR fixture IN
    SELECT org.id AS organization_id, admin.user_id AS admin_user_id, ehw.id AS department_id,
      project.id AS project_id, part.id AS part_id, part.fields AS part_fields
    FROM public.organizations AS org
    JOIN LATERAL (
      SELECT member.user_id FROM public.organization_members AS member
      WHERE member.organization_id=org.id AND member.active AND member.role::text='admin'
      ORDER BY member.user_id LIMIT 1
    ) AS admin ON true
    JOIN public.departments AS ehw ON ehw.organization_id=org.id AND ehw.active AND ehw.code='EHW'
    JOIN LATERAL (
      SELECT record.id FROM public.operational_records AS record
      WHERE record.organization_id=org.id AND record.record_type='Project'
        AND record.archived_at IS NULL AND record.is_demo
      ORDER BY record.reference LIMIT 1
    ) AS project ON true
    JOIN LATERAL (
      SELECT record.id,record.fields FROM public.operational_records AS record
      WHERE record.organization_id=org.id AND record.record_type='Part'
        AND record.archived_at IS NULL AND record.is_demo AND record.reference='HLPL-DEMO-INV-ELE-01'
      LIMIT 1
    ) AS part ON true
    WHERE private.is_shared_test_org(org.id)
  LOOP
    PERFORM pg_catalog.set_config('request.jwt.claim.sub',fixture.admin_user_id::text,true);
    INSERT INTO public.operational_records(
      organization_id,department_id,area,record_type,reference,title,status,fields,notes,
      created_by,updated_by,is_demo
    ) VALUES (
      fixture.organization_id,fixture.department_id,'ehw','BOM','HLPL-DEMO-KIT-BOM-01',
      'TEST ONLY · Single-part controller build kit','released',
      pg_catalog.jsonb_build_object(
        'projectId',fixture.project_id,'revision','01','inventoryLines',pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object('partId',fixture.part_id,'quantityPerUnit',1,
            'unit',COALESCE(NULLIF(fixture.part_fields->>'unit',''),'pcs'))
        ),'demoFixtureKey','shared-test-kit-bom-v1'
      ),
      'Fictional Shared TEST BOM fixture. One controller Part per build unit; no real production authorization or shipment.',
      fixture.admin_user_id,fixture.admin_user_id,true
    ) ON CONFLICT (organization_id,reference) DO NOTHING;
  END LOOP;
  PERFORM pg_catalog.set_config('request.jwt.claim.sub','',true);
END
$seed$;

CREATE OR REPLACE FUNCTION private.issue_shared_inventory_bom_kit(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  actor record;
  bom public.operational_records%ROWTYPE;
  project public.operational_records%ROWTYPE;
  request_key uuid;
  bom_key uuid;
  project_key uuid;
  build_qty integer;
  issue_id uuid;
  digest text;
  existing_digest text;
  line record;
  allocation record;
  remaining numeric(14,3);
  total_hand numeric(14,3);
  total_held numeric(14,3);
  total_allocated numeric(14,3);
  inserted_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'TEST_MEMBERSHIP_REQUIRED'; END IF;
  SELECT * INTO actor FROM public.resolve_test_membership();
  IF actor.membership_id IS NULL OR actor.role='viewer' OR actor.is_client THEN
    RAISE EXCEPTION 'TEST_MEMBERSHIP_REQUIRED';
  END IF;
  IF NOT private.is_shared_test_org(actor.organization_id) THEN RAISE EXCEPTION 'SHARED_TEST_ONLY'; END IF;

  request_key := NULLIF(p_payload->>'requestId','')::uuid;
  bom_key := NULLIF(p_payload->>'bomId','')::uuid;
  project_key := NULLIF(p_payload->>'projectId','')::uuid;
  build_qty := NULLIF(p_payload->>'buildQuantity','')::integer;
  IF request_key IS NULL OR bom_key IS NULL OR project_key IS NULL
    OR build_qty IS NULL OR build_qty<=0 OR build_qty>1000000
    OR pg_catalog.jsonb_typeof(p_payload->'allocations') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_array_length(p_payload->'allocations')=0 THEN
    RAISE EXCEPTION 'INVENTORY_KIT_ISSUE_INVALID_REQUEST';
  END IF;
  digest := pg_catalog.md5(p_payload::text);
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor.organization_id::text || ':' || auth.uid()::text || ':kit:' || request_key::text,1)
  );
  SELECT * INTO STRICT bom FROM public.operational_records AS r
  WHERE r.id=bom_key AND r.organization_id=actor.organization_id AND lower(r.record_type)='bom'
    AND r.archived_at IS NULL AND r.is_demo AND lower(r.status::text)='released'
    AND NULLIF(COALESCE(r.fields->>'projectId',r.fields->>'project_id'),'')::uuid=project_key
    AND pg_catalog.jsonb_typeof(r.fields->'inventoryLines')='array'
  FOR SHARE;
  SELECT * INTO project FROM public.operational_records AS r
  WHERE r.id=project_key AND r.organization_id=actor.organization_id AND r.record_type='Project'
    AND r.archived_at IS NULL AND r.is_demo
  FOR SHARE;
  IF project.id IS NULL THEN RAISE EXCEPTION 'INVENTORY_KIT_PROJECT_NOT_SELECTABLE'; END IF;

  SELECT id,request_hash INTO issue_id,existing_digest FROM public.shared_inventory_kit_issues
  WHERE organization_id=actor.organization_id AND actor_id=auth.uid() AND request_id=request_key;
  IF FOUND THEN
    IF existing_digest IS DISTINCT FROM digest THEN
      RAISE EXCEPTION 'INVENTORY_IDEMPOTENCY_KEY_REUSED';
    END IF;
    RETURN pg_catalog.jsonb_build_object('kitIssueId',issue_id,'idempotent',true);
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(bom.fields->'inventoryLines') AS b(line)
    WHERE NULLIF(b.line->>'partId','') IS NULL
      OR NULLIF(b.line->>'quantityPerUnit','') IS NULL
      OR (b.line->>'quantityPerUnit')::numeric<=0
  ) OR NOT EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(bom.fields->'inventoryLines')) THEN
    RAISE EXCEPTION 'INVENTORY_BOM_CANONICAL_LINKS_REQUIRED';
  END IF;

  -- Lock affected stock rows in deterministic ID order before validating assignments.
  FOR line IN
    SELECT part_id FROM (
      SELECT DISTINCT NULLIF(b.line->>'partId','')::uuid AS part_id
      FROM pg_catalog.jsonb_array_elements(bom.fields->'inventoryLines') AS b(line)
    ) AS parts ORDER BY part_id
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(actor.organization_id::text || ':' || line.part_id::text,0)
    );
  END LOOP;

  IF pg_catalog.jsonb_array_length(p_payload->'allocations') < 1 THEN
    RAISE EXCEPTION 'INVENTORY_KIT_ALLOCATIONS_REQUIRED';
  END IF;
  FOR allocation IN
    SELECT NULLIF(a.value->>'partId','')::uuid AS part_id,
      NULLIF(a.value->>'assignmentId','')::uuid AS assignment_id
    FROM pg_catalog.jsonb_array_elements(p_payload->'allocations') AS a(value)
    ORDER BY NULLIF(a.value->>'partId','')::uuid
  LOOP
    IF allocation.part_id IS NULL OR allocation.assignment_id IS NULL THEN
      RAISE EXCEPTION 'INVENTORY_KIT_ALLOCATIONS_REQUIRED';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(bom.fields->'inventoryLines') AS b(line)
      WHERE NULLIF(b.line->>'partId','')::uuid=allocation.part_id
    ) OR (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_payload->'allocations') AS a(value)
      WHERE NULLIF(a.value->>'partId','')::uuid=allocation.part_id)<>1 THEN
      RAISE EXCEPTION 'INVENTORY_KIT_ALLOCATION_BOM_MISMATCH';
    END IF;
    SELECT opened.* INTO line FROM public.shared_inventory_events AS opened
    WHERE opened.organization_id=actor.organization_id AND opened.assignment_id=allocation.assignment_id
      AND opened.event_kind='assign' AND opened.part_id=allocation.part_id
      AND opened.project_id=project_key
    ORDER BY opened.created_at,opened.id LIMIT 1 FOR SHARE;
    IF line.id IS NULL THEN RAISE EXCEPTION 'INVENTORY_KIT_ASSIGNMENT_MISMATCH'; END IF;
    SELECT COALESCE(sum(e.allocated_delta),0) INTO remaining FROM public.shared_inventory_events AS e
    WHERE e.organization_id=actor.organization_id AND e.assignment_id=allocation.assignment_id;
    IF remaining < (
      SELECT sum((b.line->>'quantityPerUnit')::numeric)*build_qty
      FROM pg_catalog.jsonb_array_elements(bom.fields->'inventoryLines') AS b(line)
      WHERE NULLIF(b.line->>'partId','')::uuid=allocation.part_id
    ) THEN RAISE EXCEPTION 'INVENTORY_KIT_EXCEEDS_ALLOCATION'; END IF;
    IF NOT private.shared_inventory_can(actor.organization_id,line.department_id,'inventory:issue') THEN
      RAISE EXCEPTION 'INVENTORY_PERMISSION_DENIED';
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_payload->'allocations')) <>
    (SELECT count(DISTINCT NULLIF(b.line->>'partId','')::uuid)
      FROM pg_catalog.jsonb_array_elements(bom.fields->'inventoryLines') AS b(line)) THEN
    RAISE EXCEPTION 'INVENTORY_KIT_ALLOCATIONS_REQUIRED';
  END IF;

  INSERT INTO public.shared_inventory_kit_issues(
    organization_id,bom_record_id,project_id,build_quantity,request_id,request_hash,actor_id
  ) VALUES (actor.organization_id,bom.id,project.id,build_qty,request_key,digest,auth.uid())
  RETURNING id INTO issue_id;

  FOR allocation IN
    SELECT NULLIF(a.value->>'partId','')::uuid AS part_id,
      NULLIF(a.value->>'assignmentId','')::uuid AS assignment_id
    FROM pg_catalog.jsonb_array_elements(p_payload->'allocations') AS a(value)
    ORDER BY NULLIF(a.value->>'partId','')::uuid
  LOOP
    SELECT * INTO line FROM public.shared_inventory_events AS opened
    WHERE opened.organization_id=actor.organization_id AND opened.assignment_id=allocation.assignment_id
      AND opened.event_kind='assign' AND opened.part_id=allocation.part_id
    ORDER BY opened.created_at,opened.id LIMIT 1;
    SELECT COALESCE(sum(e.on_hand_delta),0),COALESCE(sum(e.held_delta),0),
      COALESCE(sum(e.allocated_delta),0) INTO total_hand,total_held,total_allocated
    FROM public.shared_inventory_events AS e
    WHERE e.organization_id=actor.organization_id AND e.part_id=allocation.part_id;
    remaining := (SELECT sum((b.line->>'quantityPerUnit')::numeric)*build_qty
      FROM pg_catalog.jsonb_array_elements(bom.fields->'inventoryLines') AS b(line)
      WHERE NULLIF(b.line->>'partId','')::uuid=allocation.part_id);
    IF remaining>0 THEN
      INSERT INTO public.shared_inventory_events(
        organization_id,part_id,department_id,event_kind,on_hand_delta,held_delta,allocated_delta,
        location,bin,project_id,assignment_id,assignment_role_id,assigned_member_id,
        note,actor_id,is_demo,source_record_id,kit_issue_id
      ) VALUES (
        actor.organization_id,allocation.part_id,line.department_id,'kit_issue',-remaining,0,-remaining,
        line.location,line.bin,project_key,allocation.assignment_id,line.assignment_role_id,
        line.assigned_member_id,'Kit issue '||bom.reference||' · '||build_qty||' build unit(s)',
        auth.uid(),true,bom.id,issue_id
      );
      inserted_count := inserted_count+1;
    END IF;
  END LOOP;
  RETURN pg_catalog.jsonb_build_object('kitIssueId',issue_id,'idempotent',false,'lineCount',inserted_count,
    'bomId',bom.id,'projectId',project.id,'buildQuantity',build_qty);
END
$function$;

REVOKE ALL ON FUNCTION private.issue_shared_inventory_bom_kit(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.issue_shared_inventory_bom_kit(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.issue_shared_inventory_bom_kit(p_payload jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT private.issue_shared_inventory_bom_kit(p_payload)
$function$;
REVOKE ALL ON FUNCTION public.issue_shared_inventory_bom_kit(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_shared_inventory_bom_kit(jsonb) TO authenticated;

-- A released BOM becomes eligible only after every component is linked by exact canonical Part ID.
CREATE OR REPLACE FUNCTION private.read_shared_inventory_kit_boms()
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
  IF actor.role='viewer' OR actor.is_client OR NOT private.is_shared_test_org(actor.organization_id) THEN
    RETURN '[]'::jsonb;
  END IF;
  RETURN COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',bom.id,'reference',bom.reference,'title',bom.title,'projectId',project.id,
      'projectReference',project.reference,'revision',COALESCE(bom.fields->>'revision',''),
      'lines',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'partId',parts.part_id,'partReference',parts.reference,'partTitle',parts.title,
        'quantityPerUnit',parts.quantity_per_unit,'unit',parts.unit
      ) ORDER BY parts.reference)
      FROM (
        SELECT part.id AS part_id,part.reference,part.title,
          sum((line.value->>'quantityPerUnit')::numeric) AS quantity_per_unit,
          COALESCE(max(NULLIF(line.value->>'unit','')),NULLIF(part.fields->>'unit',''),'units') AS unit
        FROM pg_catalog.jsonb_array_elements(bom.fields->'inventoryLines') AS line(value)
        JOIN public.operational_records AS part ON part.id=NULLIF(line.value->>'partId','')::uuid
          AND part.organization_id=actor.organization_id AND part.record_type='Part' AND part.archived_at IS NULL
          AND part.is_demo AND part.reference LIKE 'HLPL-DEMO-INV-%'
        GROUP BY part.id,part.reference,part.title,part.fields
      ) AS parts
      WHERE actor.role='admin' OR EXISTS (
        SELECT 1 FROM public.shared_inventory_events AS assignment
        JOIN public.department_roles AS role ON role.id=assignment.assignment_role_id
        WHERE assignment.organization_id=actor.organization_id AND assignment.project_id=project.id
          AND assignment.part_id=parts.part_id AND assignment.event_kind='assign'
          AND private.shared_inventory_can(actor.organization_id,role.department_id,'inventory:issue')
      ))
    ) ORDER BY bom.reference)
    FROM public.operational_records AS bom
    JOIN public.operational_records AS project ON project.id=NULLIF(COALESCE(bom.fields->>'projectId',bom.fields->>'project_id'),'')::uuid
      AND project.organization_id=bom.organization_id AND project.record_type='Project'
      AND project.archived_at IS NULL AND project.is_demo
    WHERE bom.organization_id=actor.organization_id AND lower(bom.record_type)='bom'
      AND lower(bom.status::text)='released' AND bom.archived_at IS NULL AND bom.is_demo
      AND pg_catalog.jsonb_typeof(bom.fields->'inventoryLines')='array'
      AND jsonb_array_length(bom.fields->'inventoryLines')>0
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.jsonb_array_elements(bom.fields->'inventoryLines') AS line(value)
        LEFT JOIN public.operational_records AS part ON part.id=NULLIF(line.value->>'partId','')::uuid
          AND part.organization_id=actor.organization_id AND part.record_type='Part' AND part.archived_at IS NULL
          AND part.is_demo AND part.reference LIKE 'HLPL-DEMO-INV-%'
        WHERE part.id IS NULL OR NULLIF(line.value->>'quantityPerUnit','') IS NULL
          OR (line.value->>'quantityPerUnit')::numeric<=0
      )
      AND (actor.role='admin' OR NOT EXISTS (
        SELECT 1 FROM pg_catalog.jsonb_array_elements(bom.fields->'inventoryLines') AS line(value)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.shared_inventory_events AS opened
          JOIN public.department_roles AS role ON role.id=opened.assignment_role_id
          WHERE opened.organization_id=actor.organization_id AND opened.event_kind='assign'
            AND opened.part_id=NULLIF(line.value->>'partId','')::uuid AND opened.project_id=project.id
            AND private.shared_inventory_can(actor.organization_id,role.department_id,'inventory:issue')
            AND (SELECT sum(event.allocated_delta) FROM public.shared_inventory_events AS event
              WHERE event.organization_id=opened.organization_id AND event.assignment_id=opened.assignment_id)>0
        )
      ))
  ),'[]'::jsonb);
END
$function$;
REVOKE ALL ON FUNCTION private.read_shared_inventory_kit_boms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.read_shared_inventory_kit_boms() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_shared_inventory_kit_boms()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT private.read_shared_inventory_kit_boms()
$function$;
REVOKE ALL ON FUNCTION public.get_shared_inventory_kit_boms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shared_inventory_kit_boms() TO authenticated;

CREATE OR REPLACE FUNCTION private.read_shared_inventory_catalog_with_kit_issues()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE catalog jsonb;
BEGIN
  catalog := private.read_shared_inventory_part_catalog();
  RETURN catalog || pg_catalog.jsonb_build_object(
    'kitBoms',private.read_shared_inventory_kit_boms(),
    'movements',COALESCE((
      SELECT pg_catalog.jsonb_agg(
        m.value || pg_catalog.jsonb_build_object(
          'kitIssueId',event.kit_issue_id,
          'sourceRecordId',event.source_record_id,
          'sourceRecordReference',source.reference
        ) ORDER BY m.ordinality
      )
      FROM pg_catalog.jsonb_array_elements(COALESCE(catalog->'movements','[]'::jsonb)) WITH ORDINALITY AS m(value,ordinality)
      LEFT JOIN public.shared_inventory_events AS event ON event.id=NULLIF(m.value->>'id','')::uuid
      LEFT JOIN public.operational_records AS source ON source.id=event.source_record_id
        AND source.organization_id=event.organization_id
    ),'[]'::jsonb)
  );
END
$function$;
REVOKE ALL ON FUNCTION private.read_shared_inventory_catalog_with_kit_issues() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.read_shared_inventory_catalog_with_kit_issues() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_shared_inventory_part_catalog()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT private.read_shared_inventory_catalog_with_kit_issues()
$function$;
REVOKE ALL ON FUNCTION public.get_shared_inventory_part_catalog() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shared_inventory_part_catalog() TO authenticated;
