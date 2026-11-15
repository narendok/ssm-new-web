const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");

const root = path.resolve(__dirname, "..");
const uuid = (n) => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("Account-backed Shared TEST Upload Flow: Technical, Quote, Invoice, Receipt, Role & SOP", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());

  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO authenticated, anon, service_role;
    CREATE SCHEMA storage;
    CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(), bucket_id text, name text);
    CREATE PUBLICATION supabase_realtime;
  `);

  const initialMigrations = [
    "20260927075123_ac4fb50c-cb14-4750-a34f-24a69522d4b0",
    "20260927075232_f91de181-c465-45aa-948c-2fd7979633e6",
    "20260927090641_a22d2778-36cf-4d5a-9317-87ec60e24b1e",
    "20260927171219_adbe39cb-1238-47c9-ba7c-69ad4ac4dc2d",
    "20260927171247_b0c6d9a3-9521-4fcb-bf96-260d6f79035d",
    "20260927171349_e3fade41-b2b3-4f0e-8a0b-12796c1261fd",
    "20261020010000_operational_stage_gate_contract",
    "20261020014346_bind_stage_gate_approval_revisions",
    "20261020025329_enforce_operational_gate_write_boundary",
    "20261020034857_shared_test_workspace",
    "20261021134427_business_workspace_contract",
    "20261024084915_business_workspace_validation_guards",
    "20261025091500_harden_downstream_master_guards",
    "20261025103000_saved_lifecycle_coordination",
    "20261025110000_saved_lifecycle_disposition",
    "20261025111644_project_input_feasibility_sheet",
    "20261025152001_link_approved_input_baseline",
    "20261101023755_customer_requirement_change_workflow",
    "20261026090000_preproject_sales_intake",
    "20261026100000_atomic_sales_intake",
    "20261026110000_shared_document_registration",
    "20261027010000_shared_decision_log",
    "20261027155020_shared_chat_threads",
    "20261106041141_allow_test_member_document_drafts",
    "20261111162011_role_scoped_document_registration",
    "20261111162044_shared_document_draft_snapshots",
    "20261113044537_exact_document_project_link_aliases",
    "20261115143646_shared_workspace_snapshot_set_based",
  ];

  for (const name of initialMigrations) {
    const file = path.join(root, "supabase/migrations", `${name}.sql`);
    await db.exec(fs.readFileSync(file, "utf8"));
  }

  // Set up actors
  const admin = uuid(1);
  const hwLead = uuid(2);
  const finLead = uuid(3);
  const purLead = uuid(4);
  const qaLead = uuid(5);
  const clientUser = uuid(6);

  const org = uuid(10);
  const dEhw = uuid(11);
  const dFin = uuid(12);
  const dPur = uuid(13);
  const dQa = uuid(14);
  const dClient = uuid(15);

  for (const [id, email] of [
    [admin, "admin@example.com"],
    [hwLead, "avery.vale@example.com"],
    [finLead, "priya.voss@example.com"],
    [purLead, "morgan.reed@example.com"],
    [qaLead, "jordan.blake@example.com"],
    [clientUser, "rohan.verma@example.com"],
  ]) {
    await db.query("INSERT INTO auth.users VALUES($1, $2)", [id, email]);
  }

  // Create organization
  await db.query(
    "INSERT INTO organizations(id, name, main_location, created_by) VALUES($1, 'TEST ONLY · SSM-new1 synthetic workspace', 'Noida', $2)",
    [org, admin],
  );

  const mids = {};
  mids[admin] = (await db.query("SELECT id FROM organization_members WHERE user_id=$1", [admin])).rows[0].id;

  for (const [id, role] of [
    [hwLead, "department_lead"],
    [finLead, "department_lead"],
    [purLead, "department_lead"],
    [qaLead, "department_lead"],
    [clientUser, "member"],
  ]) {
    mids[id] = (
      await db.query(
        "INSERT INTO organization_members(organization_id, user_id, role, display_name) VALUES($1, $2, $3::text::app_role, $3::text) RETURNING id",
        [org, id, role],
      )
    ).rows[0].id;
  }

  // Create departments
  for (const [id, code, lead] of [
    [dEhw, "EHW", hwLead],
    [dFin, "FIN", finLead],
    [dPur, "PUR", purLead],
    [dQa, "QA", qaLead],
    [dClient, "CLIENT", clientUser],
  ]) {
    await db.query(
      "INSERT INTO departments(id, organization_id, name, department_type, code, lead_member_id) VALUES($1, $2, $3, $3, $3, $4)",
      [id, org, code, mids[lead]],
    );
  }

  // Seed sample Project
  const project = uuid(50);
  await db.query(
    "INSERT INTO operational_records(id, organization_id, department_id, area, record_type, title, reference, status, fields, created_by, updated_by) VALUES($1, $2, $3, 'hardware', 'Project', 'Northstar Field Gateway', 'HLPL-AI4T-01', 'open', $4, $5, $5)",
    [project, org, dEhw, JSON.stringify({ currentStage: "HW_01", companyPhase: "TG_1" }), admin],
  );

  async function asUser(user, callback) {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
    await db.exec("SET ROLE authenticated");
    try {
      return await callback();
    } finally {
      await db.exec("RESET ROLE");
    }
  }

  const registerDoc = (user, payload, key = crypto.randomUUID()) =>
    asUser(user, async () => {
      const res = await db.query(
        "SELECT register_controlled_document($1::jsonb, $2) result",
        [JSON.stringify(payload), key],
      );
      return res.rows[0].result;
    });

  // =========================================================================
  // SECTION 1: Connect Technical files, Quotes, Invoices, Receipts, Role Docs & SOPs
  // =========================================================================

  // 1. Technical file: Schematic PDF (EHW)
  const schKey = crypto.randomUUID();
  const schDoc = await registerDoc(hwLead, {
    title: "Field Gateway Mainboard Schematic",
    documentType: "Schematic",
    scope: "internal",
    projectId: project,
    departmentId: dEhw,
  }, schKey);
  assert.equal(schDoc.status, "Draft", "Schematic must register as Draft");
  assert.match(schDoc.reference, /HLPL-AI4T-01-EHW-DOC-/, "Reference must bind project and department");

  // 2. Commercial: Supplier Quotation (PUR)
  const quoteKey = crypto.randomUUID();
  const quoteDoc = await registerDoc(purLead, {
    title: "Quectel EG915N Cellular Module Supplier Quotation",
    documentType: "Supplier quotation",
    scope: "internal",
    projectId: project,
    departmentId: dPur,
  }, quoteKey);
  assert.equal(quoteDoc.status, "Draft", "Supplier quote must register as Draft");

  // 3. Finance: Supplier Invoice (FIN)
  const invKey = crypto.randomUUID();
  const invDoc = await registerDoc(finLead, {
    title: "Mouser Electronics Prototype Sample Tax Invoice",
    documentType: "Supplier invoice",
    scope: "internal",
    projectId: project,
    departmentId: dFin,
  }, invKey);
  assert.equal(invDoc.status, "Draft", "Supplier invoice must register as Draft");

  // 4. Logistics: Delivery Receipt / Goods Delivery Evidence (PUR/STR)
  const rcptKey = crypto.randomUUID();
  const rcptDoc = await registerDoc(purLead, {
    title: "Inbound Delivery Challan & Inward Gate Receipt",
    documentType: "Goods receipt / delivery evidence",
    scope: "internal",
    projectId: project,
    departmentId: dPur,
  }, rcptKey);
  assert.equal(rcptDoc.status, "Draft", "Receipt must register as Draft");

  // 5. Operating Standards: Standard Operating Procedure (SOP) (EHW)
  const sopKey = crypto.randomUUID();
  const sopDoc = await registerDoc(hwLead, {
    title: "Hardware Board Bring-Up & Power-On SOP",
    documentType: "Standard Operating Procedure (SOP / WI)",
    scope: "common",
    departmentId: dEhw,
  }, sopKey);
  assert.equal(sopDoc.status, "Draft", "SOP must register as Draft in common scope");

  // 6. Role / Audit Supporting Document (QA)
  const roleDocKey = crypto.randomUUID();
  const roleDoc = await registerDoc(qaLead, {
    title: "ISO 9001:2015 Internal Process Audit Checklist & Findings",
    documentType: "Role / audit supporting document",
    scope: "common",
    departmentId: dQa,
  }, roleDocKey);
  assert.equal(roleDoc.status, "Draft", "Role document must register as Draft");

  // =========================================================================
  // SECTION 2: Physical File Binding in controlled_document_files & Storage
  // =========================================================================
  const testFileBytes = Buffer.from("SAMPLE BRING-UP SOP CONTENT - FIRST POWER ON VERIFICATION", "utf8");
  const testDigest = crypto.createHash("sha256").update(testFileBytes).digest("hex");
  const fileId = crypto.randomUUID();
  const storagePath = `${org}/${dEhw}/${sopDoc.id}/01/sop_bringup.docx`;

  await db.query(
    "INSERT INTO controlled_document_files(id, organization_id, department_id, document_id, revision, storage_path, original_name, content_type, size_bytes, checksum, uploaded_by) VALUES($1, $2, $3, $4, '01', $5, 'sop_bringup.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', $6, $7, $8)",
    [fileId, org, dEhw, sopDoc.id, storagePath, testFileBytes.length, testDigest, hwLead],
  );
  await db.query("INSERT INTO storage.objects(bucket_id, name) VALUES('controlled-documents', $1)", [storagePath]);

  // Verify access as hwLead (owner department)
  const hwAccess = await asUser(hwLead, async () => {
    return (await db.query("SELECT * FROM get_controlled_file_access($1)", [fileId])).rows;
  });
  assert.equal(hwAccess.length, 1);
  assert.equal(hwAccess[0].file_id, fileId);
  assert.equal(hwAccess[0].checksum, testDigest);

  // =========================================================================
  // SECTION 3: Preserve Current Safeguards
  // =========================================================================
  // Invariant 1: Document status is strictly Draft
  const allSavedDocs = (await db.query("SELECT id, title, document_type, metadata FROM documents WHERE organization_id=$1", [org])).rows;
  for (const doc of allSavedDocs) {
    assert.equal(doc.metadata.status, "Draft", `Document ${doc.title} must be Draft`);
    assert.equal(doc.metadata.approved, undefined, `Document ${doc.title} must not have approved flag`);
  }

  // Invariant 2: No automatic PO / Payment creation occurred
  const poCount = (await db.query("SELECT count(*) c FROM operational_records WHERE organization_id=$1 AND record_type IN ('PO','PurchaseOrder','Payment')", [org])).rows[0].c;
  assert.equal(Number(poCount), 0, "Upload must NEVER create purchase orders or payments automatically");

  // Invariant 3: No stock movement or inventory adjustments
  const stockMovements = (await db.query("SELECT count(*) c FROM operational_records WHERE organization_id=$1 AND record_type IN ('StockMovement','InventoryAdjustment')", [org])).rows[0].c;
  assert.equal(Number(stockMovements), 0, "Upload must NEVER alter inventory balances automatically");

  // Invariant 4: Lifecycle stage gate has NOT advanced
  const projRow = (await db.query("SELECT fields FROM operational_records WHERE id=$1", [project])).rows[0];
  assert.equal(projRow.fields.currentStage, "HW_01", "Project current stage must remain unchanged");

  // =========================================================================
  // SECTION 4: Department Isolation & Role Gating
  // =========================================================================

  // 1. QA Lead CANNOT access EHW's controlled file
  await assert.rejects(
    asUser(qaLead, () => db.query("SELECT * FROM get_controlled_file_access($1)", [fileId])),
    /FILE_ACCESS_DENIED/,
    "QA Lead must be denied access to EHW controlled file",
  );

  // 2. Finance Lead CANNOT access EHW's controlled file
  await assert.rejects(
    asUser(finLead, () => db.query("SELECT * FROM get_controlled_file_access($1)", [fileId])),
    /FILE_ACCESS_DENIED/,
    "Finance Lead must be denied access to EHW controlled file",
  );

  // 3. Admin CAN access any department's controlled file
  const adminAccess = await asUser(admin, async () => {
    return (await db.query("SELECT * FROM get_controlled_file_access($1)", [fileId])).rows;
  });
  assert.equal(adminAccess.length, 1, "Admin has master access to controlled files");

  // 4. Client account CANNOT register documents
  await assert.rejects(
    registerDoc(clientUser, {
      title: "Client Unauthorized Document",
      documentType: "Schematic",
      scope: "internal",
      projectId: project,
      departmentId: dEhw,
    }),
    /DOCUMENT_REGISTER_DENIED|DOCUMENT_DEPARTMENT_REQUIRED/,
    "Client accounts must be strictly blocked from registering controlled documents",
  );

  // =========================================================================
  // SECTION 5: Demonstrate Save & Reload in Shared TEST Workspace
  // =========================================================================
  // Reload as EHW Lead: can see EHW documents, but NOT FIN or QA documents
  const hwWorkspace = await asUser(hwLead, async () => {
    return (await db.query("SELECT get_shared_test_workspace() ws")).rows[0].ws;
  });
  const hwVisibleDocTitles = (hwWorkspace.documents || []).map((d) => d.title);
  assert.ok(hwVisibleDocTitles.includes("Field Gateway Mainboard Schematic"), "EHW must see its own schematic");
  assert.ok(hwVisibleDocTitles.includes("Hardware Board Bring-Up & Power-On SOP"), "EHW must see its bring-up SOP");
  assert.ok(!hwVisibleDocTitles.includes("Mouser Electronics Prototype Sample Tax Invoice"), "EHW must NOT see Finance invoices");
  assert.ok(!hwVisibleDocTitles.includes("ISO 9001:2015 Internal Process Audit Checklist & Findings"), "EHW must NOT see QA audit docs");

  // Reload as Finance Lead: can see FIN documents, but NOT EHW schematic
  const finWorkspace = await asUser(finLead, async () => {
    return (await db.query("SELECT get_shared_test_workspace() ws")).rows[0].ws;
  });
  const finVisibleDocTitles = (finWorkspace.documents || []).map((d) => d.title);
  assert.ok(finVisibleDocTitles.includes("Mouser Electronics Prototype Sample Tax Invoice"), "FIN must see its invoice");
  assert.ok(!finVisibleDocTitles.includes("Field Gateway Mainboard Schematic"), "FIN must NOT see EHW schematic");

  // Reload as Admin: can see ALL department documents
  const adminWorkspace = await asUser(admin, async () => {
    return (await db.query("SELECT get_shared_test_workspace() ws")).rows[0].ws;
  });
  const adminVisibleDocTitles = (adminWorkspace.documents || []).map((d) => d.title);
  assert.ok(adminVisibleDocTitles.includes("Field Gateway Mainboard Schematic"), "Admin sees EHW schematic");
  assert.ok(adminVisibleDocTitles.includes("Mouser Electronics Prototype Sample Tax Invoice"), "Admin sees FIN invoice");
  assert.ok(adminVisibleDocTitles.includes("Quectel EG915N Cellular Module Supplier Quotation"), "Admin sees PUR quote");
  assert.ok(adminVisibleDocTitles.includes("Hardware Board Bring-Up & Power-On SOP"), "Admin sees SOP");

  // Reload as Client: Draft documents are completely hidden from Client
  const clientWorkspace = await asUser(clientUser, async () => {
    return (await db.query("SELECT get_shared_test_workspace() ws")).rows[0].ws;
  });
  const clientVisibleDocs = clientWorkspace.documents || [];
  assert.equal(clientVisibleDocs.length, 0, "Client must not see any internal unreleased Draft documents");

  // =========================================================================
  // SECTION 6: Confirm Android Parity
  // =========================================================================
  // Android's SharedAccess.sharedDocuments parses snapshot.documents from get_shared_test_workspace():
  // Verify that the JSON structure matches Android expectations exactly:
  // - id, title, document_type, department_id, record_id, created_at
  for (const doc of hwWorkspace.documents) {
    assert.ok(doc.id, "Android requires doc.id");
    assert.ok(doc.title, "Android requires doc.title");
    assert.ok(doc.document_type, "Android requires doc.document_type");
    assert.ok(doc.department_id, "Android requires doc.department_id");
    assert.ok(doc.created_at, "Android requires doc.created_at");
  }
});
