const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");

const migration = fs.readFileSync(
  path.resolve(__dirname, "../supabase/migrations/20261114175021_shared_inventory_ledger.sql"),
  "utf8",
);
const orgId = "10000000-0000-4000-8000-000000000001";
const adminUser = "10000000-0000-4000-8000-000000000002";
const adminMember = "10000000-0000-4000-8000-000000000003";
const leadUser = "10000000-0000-4000-8000-000000000004";
const leadMember = "10000000-0000-4000-8000-000000000005";
const departmentId = "10000000-0000-4000-8000-000000000006";
const qaDepartmentId = "10000000-0000-4000-8000-000000000007";
const partId = "10000000-0000-4000-8000-000000000008";
const projectId = "10000000-0000-4000-8000-000000000009";
const supplierId = "10000000-0000-4000-8000-000000000010";
const orderId = "10000000-0000-4000-8000-000000000011";
const roleId = "10000000-0000-4000-8000-000000000012";
const qaRoleId = "10000000-0000-4000-8000-000000000013";

test("Shared TEST inventory ledger seeds fictional stock and enforces audited role-based movements", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE SCHEMA private;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES ('${adminUser}'),('${leadUser}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    CREATE TABLE public.organizations(id uuid PRIMARY KEY,name text NOT NULL);
    INSERT INTO public.organizations VALUES ('${orgId}','TEST ONLY · SSM-new1 synthetic workspace');
    CREATE TABLE public.departments(
      id uuid PRIMARY KEY,organization_id uuid NOT NULL,code text NOT NULL,active boolean NOT NULL DEFAULT true
    );
    INSERT INTO public.departments VALUES
      ('${departmentId}','${orgId}','EHW',true),('${qaDepartmentId}','${orgId}','QA',true);
    CREATE TABLE public.organization_members(
      id uuid PRIMARY KEY,organization_id uuid NOT NULL,user_id uuid NOT NULL,active boolean NOT NULL DEFAULT true
    );
    INSERT INTO public.organization_members VALUES
      ('${adminMember}','${orgId}','${adminUser}',true),('${leadMember}','${orgId}','${leadUser}',true);
    CREATE TABLE public.department_roles(
      id uuid PRIMARY KEY,organization_id uuid NOT NULL,department_id uuid,name text NOT NULL,
      role_key text NOT NULL,active boolean NOT NULL DEFAULT true,hierarchy_level integer
    );
    INSERT INTO public.department_roles VALUES
      ('${roleId}','${orgId}','${departmentId}','EHW associate','ehw_associate',true,3),
      ('${qaRoleId}','${orgId}','${qaDepartmentId}','QA lead','qa_lead',true,1),
      ('10000000-0000-4000-8000-000000000016','${orgId}','${departmentId}','Unclassified TEST employee','test_employee',true,NULL);
    CREATE TABLE public.role_permissions(role_id uuid NOT NULL,permission_key text NOT NULL,allowed boolean NOT NULL);
    CREATE TABLE public.department_role_assignments(
      role_id uuid NOT NULL,member_id uuid NOT NULL,active boolean NOT NULL DEFAULT true
    );
    INSERT INTO public.department_role_assignments VALUES ('${roleId}','${leadMember}',true);
    CREATE TABLE public.operational_records(
      id uuid PRIMARY KEY,organization_id uuid NOT NULL,record_type text NOT NULL,
      archived_at timestamptz,status text,reference text,title text,fields jsonb NOT NULL DEFAULT '{}'::jsonb,
      is_demo boolean NOT NULL DEFAULT false
    );
    INSERT INTO public.operational_records VALUES
      ('${partId}','${orgId}','Part',NULL,'draft','HLPL-DEMO-INV-ELE-01','Controller sample',
        '{"category":"Electronics","subcategory":"MCU","primaryDepartment":"EHW","departmentViews":["EHW","PUR","QA"],"unit":"pcs","sampleDataNotice":"Fictional part"}',true),
      ('${projectId}','${orgId}','Project',NULL,'active','DEMO-PROJ-01','Fictional TEST project','{}',true),
      ('${supplierId}','${orgId}','Supplier',NULL,'approved','DEMO-SUP-01','Fictional supplier','{}',true),
      ('${orderId}','${orgId}','Purchase order',NULL,'approved','DEMO-PO-01','Fictional approved order',
        '{"supplierId":"${supplierId}","projectId":"${projectId}","items":[{"partId":"${partId}","quantity":4}]}',true),
      ('10000000-0000-4000-8000-000000000014','${orgId}','Purchase order',NULL,'draft','DEMO-PO-02','Draft order',
        '{"supplierId":"${supplierId}","projectId":"${projectId}","items":[{"partId":"${partId}","quantity":4}]}',true),
      ('10000000-0000-4000-8000-000000000015','${orgId}','Part',NULL,'draft','HLPL-REAL-PART','Not a demo part','{}',false);
    CREATE TABLE public.test_actor(
      user_id uuid,organization_id uuid,membership_id uuid,role text,is_client boolean
    );
    INSERT INTO public.test_actor VALUES
      ('${adminUser}','${orgId}','${adminMember}','admin',false),
      ('${leadUser}','${orgId}','${leadMember}','member',false);
    CREATE FUNCTION public.resolve_test_membership()
    RETURNS TABLE(organization_id uuid,membership_id uuid,role text,is_client boolean)
    LANGUAGE sql STABLE AS $$
      SELECT a.organization_id,a.membership_id,a.role,a.is_client FROM public.test_actor a WHERE a.user_id=auth.uid()
    $$;
    CREATE FUNCTION private.is_shared_test_org(p_org uuid)
    RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT p_org='${orgId}'::uuid $$;
    CREATE FUNCTION private.is_selectable_master_status(p_status text)
    RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT lower(COALESCE(p_status,'')) NOT IN ('archived','inactive','retired') $$;
    CREATE FUNCTION private.shared_test_scope(p_org uuid,p_department uuid)
    RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT EXISTS(SELECT 1 FROM public.department_role_assignments a JOIN public.department_roles r ON r.id=a.role_id
        JOIN public.organization_members m ON m.id=a.member_id
        WHERE r.organization_id=p_org AND r.department_id=p_department AND a.active AND r.active AND m.active AND m.user_id=auth.uid())
    $$;
    CREATE FUNCTION private.read_shared_inventory_part_catalog()
    RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT '{}'::jsonb $$;
    CREATE FUNCTION public.get_shared_inventory_part_catalog()
    RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.read_shared_inventory_part_catalog() $$;
  `);
  await db.exec(migration);

  const seeded = await db.query(`
    SELECT e.on_hand_delta AS on_hand,e.held_delta AS held,e.is_demo,e.fixture_key
    FROM public.shared_inventory_events e WHERE e.part_id='${partId}'
  `);
  assert.deepEqual(seeded.rows, [{
    on_hand: "96.000", held: "0.000", is_demo: true,
    fixture_key: "shared-test-opening:HLPL-DEMO-INV-ELE-01",
  }]);

  await assert.rejects(db.query("SELECT public.record_shared_inventory_event('adjustment','{}'::jsonb)"), /TEST_MEMBERSHIP_REQUIRED/);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [adminUser]);
  await db.exec("SET ROLE authenticated");
  await assert.rejects(
    db.query(`INSERT INTO public.shared_inventory_events (organization_id,part_id,event_kind,on_hand_delta,location,note)
      VALUES ('${orgId}','${partId}','adjustment',1,'x','forbidden')`),
    /permission denied/,
  );
  const initial = await db.query("SELECT public.get_shared_inventory_part_catalog() AS catalog");
  assert.equal(initial.rows[0].catalog.stockLedgerAvailable, true);
  assert.equal(initial.rows[0].catalog.items[0].available, 96);
  assert.equal(initial.rows[0].catalog.projects.length, 1);
  assert.equal(initial.rows[0].catalog.roles.length, 2);
  assert.equal(initial.rows[0].catalog.receiptOptions.length, 1);
  assert.equal(initial.rows[0].catalog.receiptOptions[0].remainingQuantity, 4);

  const assignmentPayload = {
    requestId: "20000000-0000-4000-8000-000000000001",
    partId, projectId, roleId, quantity: 12, location: "Fictional TEST stockroom", bin: "TEST-ELE",
    note: "Allocate to fictional EHW associate profile",
  };
  const assigned = await db.query(
    "SELECT public.record_shared_inventory_event('assign',$1::jsonb) AS result",
    [JSON.stringify(assignmentPayload)],
  );
  const assignmentId = assigned.rows[0].result.assignmentId;
  assert.ok(assignmentId);
  assert.equal(assigned.rows[0].result.idempotent, false);
  const retry = await db.query(
    "SELECT public.record_shared_inventory_event('assign',$1::jsonb) AS result",
    [JSON.stringify(assignmentPayload)],
  );
  assert.equal(retry.rows[0].result.assignmentId, assignmentId);
  assert.equal(retry.rows[0].result.idempotent, true);
  const afterAssign = await db.query("SELECT public.get_shared_inventory_part_catalog() AS catalog");
  assert.equal(afterAssign.rows[0].catalog.items[0].allocated, 12);
  assert.equal(afterAssign.rows[0].catalog.items[0].available, 84);

  const excessive = { ...assignmentPayload, requestId: "20000000-0000-4000-8000-000000000002", quantity: 100 };
  await assert.rejects(
    db.query("SELECT public.record_shared_inventory_event('assign',$1::jsonb)", [JSON.stringify(excessive)]),
    /INVENTORY_INSUFFICIENT_AVAILABLE_STOCK/,
  );
  const realPart = { ...assignmentPayload, requestId: "20000000-0000-4000-8000-000000000003", partId: "10000000-0000-4000-8000-000000000015" };
  await assert.rejects(
    db.query("SELECT public.record_shared_inventory_event('assign',$1::jsonb)", [JSON.stringify(realPart)]),
    /INVENTORY_PART_NOT_SELECTABLE/,
  );
  const unclassifiedRole = { ...assignmentPayload, requestId: "20000000-0000-4000-8000-000000000004", roleId: "10000000-0000-4000-8000-000000000016" };
  await assert.rejects(
    db.query("SELECT public.record_shared_inventory_event('assign',$1::jsonb)", [JSON.stringify(unclassifiedRole)]),
    /INVENTORY_ROLE_LEVEL_REQUIRED/,
  );
  const keyReuse = { ...assignmentPayload, quantity: 11 };
  await assert.rejects(
    db.query("SELECT public.record_shared_inventory_event('assign',$1::jsonb)", [JSON.stringify(keyReuse)]),
    /INVENTORY_IDEMPOTENCY_KEY_REUSED/,
  );

  const receipt = {
    requestId: "20000000-0000-4000-8000-000000000005",
    partId, purchaseOrderId: orderId, supplierId, quantity: 4,
    location: "Fictional TEST stockroom", bin: "TEST-ELE", lotCode: "DEMO-LOT-01",
    note: "Fictional TEST receipt pending quality inspection",
  };
  const received = await db.query(
    "SELECT public.record_shared_inventory_event('receipt',$1::jsonb) AS result",
    [JSON.stringify(receipt)],
  );
  assert.equal(received.rows[0].result.action, "receipt");
  const afterReceipt = await db.query("SELECT public.get_shared_inventory_part_catalog() AS catalog");
  assert.equal(afterReceipt.rows[0].catalog.items[0].onHand, 100);
  assert.equal(afterReceipt.rows[0].catalog.items[0].held, 4);
  assert.equal(afterReceipt.rows[0].catalog.items[0].available, 84);
  assert.equal(afterReceipt.rows[0].catalog.receiptOptions.length, 0);

  await assert.rejects(
    db.query("SELECT public.record_shared_inventory_event('adjustment',$1::jsonb)", [JSON.stringify({
      requestId: "20000000-0000-4000-8000-000000000015", partId, quantity: 1,
      location: "Fictional TEST stockroom", bin: "TEST-ELE", direction: "sideways",
      note: "Reject unknown adjustment direction",
    })]),
    /INVENTORY_ADJUSTMENT_DIRECTION_INVALID/,
  );

  const release = {
    requestId: "20000000-0000-4000-8000-000000000009", partId, quantity: 4,
    location: "Fictional TEST stockroom", bin: "TEST-ELE", note: "QA sample hold released after test inspection",
  };
  await db.query("SELECT public.record_shared_inventory_event('release_hold',$1::jsonb)", [JSON.stringify(release)]);
  const afterRelease = await db.query("SELECT public.get_shared_inventory_part_catalog() AS catalog");
  assert.equal(afterRelease.rows[0].catalog.items[0].held, 0);
  assert.equal(afterRelease.rows[0].catalog.items[0].available, 88);

  const returned = {
    requestId: "20000000-0000-4000-8000-000000000010", partId, assignmentId, quantity: 4,
    location: "Fictional TEST stockroom", bin: "TEST-ELE", note: "Usable sample components returned",
  };
  await assert.rejects(
    db.query("SELECT public.record_shared_inventory_event('return',$1::jsonb)", [JSON.stringify({
      ...returned, requestId: "20000000-0000-4000-8000-000000000016", disposition: "unknown",
    })]),
    /INVENTORY_RETURN_DISPOSITION_INVALID/,
  );
  await db.query("SELECT public.record_shared_inventory_event('return',$1::jsonb)", [JSON.stringify(returned)]);
  const afterReturn = await db.query("SELECT public.get_shared_inventory_part_catalog() AS catalog");
  assert.equal(afterReturn.rows[0].catalog.items[0].allocated, 8);
  assert.equal(afterReturn.rows[0].catalog.items[0].available, 92);

  const consumed = { ...returned, requestId: "20000000-0000-4000-8000-000000000011", quantity: 1 };
  await db.query("SELECT public.record_shared_inventory_event('consume',$1::jsonb)", [JSON.stringify(consumed)]);
  const afterConsume = await db.query("SELECT public.get_shared_inventory_part_catalog() AS catalog");
  assert.equal(afterConsume.rows[0].catalog.items[0].onHand, 99);
  assert.equal(afterConsume.rows[0].catalog.items[0].allocated, 7);
  assert.equal(afterConsume.rows[0].catalog.items[0].available, 92);

  await assert.rejects(
    db.query("SELECT public.record_shared_inventory_event('receipt',$1::jsonb)", [JSON.stringify({
      ...receipt, requestId: "20000000-0000-4000-8000-000000000012", quantity: 1,
    })]),
    /INVENTORY_RECEIPT_EXCEEDS_APPROVED_PO_LINE/,
  );

  const draftReceipt = { ...receipt, requestId: "20000000-0000-4000-8000-000000000006", purchaseOrderId: "10000000-0000-4000-8000-000000000014" };
  await assert.rejects(
    db.query("SELECT public.record_shared_inventory_event('receipt',$1::jsonb)", [JSON.stringify(draftReceipt)]),
    /INVENTORY_RECEIPT_REQUIRES_MATCHED_APPROVED_PO/,
  );

  await db.exec("RESET ROLE");
  await db.query("DELETE FROM public.test_actor WHERE user_id=$1", [adminUser]);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [leadUser]);
  await db.exec("SET ROLE authenticated");
  await assert.rejects(
    db.query("SELECT public.record_shared_inventory_event('assign',$1::jsonb)", [JSON.stringify({ ...assignmentPayload, requestId: "20000000-0000-4000-8000-000000000013" })]),
    /INVENTORY_PERMISSION_DENIED/,
  );
  await db.exec("RESET ROLE");
  await db.exec(`INSERT INTO public.role_permissions VALUES ('${roleId}','inventory:issue',true);`);
  await db.exec("SET ROLE authenticated");
  const leadRequest = { ...assignmentPayload, requestId: "20000000-0000-4000-8000-000000000014", quantity: 2 };
  const leadAssigned = await db.query(
    "SELECT public.record_shared_inventory_event('assign',$1::jsonb) AS result",
    [JSON.stringify(leadRequest)],
  );
  assert.equal(leadAssigned.rows[0].result.action, "assign");
});
