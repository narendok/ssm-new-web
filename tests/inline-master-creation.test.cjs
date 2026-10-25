const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");

const root = path.resolve(__dirname, "..");
const uuid = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("§14.12: Inline master modal exports and canonical draft safeguards", () => {
  const filePath = path.resolve(__dirname, "../src/components/InlineMasterModals.tsx");
  assert.ok(fs.existsSync(filePath), "InlineMasterModals.tsx must exist");
  const content = fs.readFileSync(filePath, "utf8");

  assert.ok(content.includes("export function InlineSupplierModal"), "InlineSupplierModal must be exported");
  assert.ok(content.includes("export function InlinePartModal"), "InlinePartModal must be exported");
  assert.ok(content.includes("Pending_Verification"), "Inline supplier master produces draft / pending verification status");
  assert.ok(content.includes("Engineering_Only"), "Inline component master produces engineering-only draft status");

  // Rule: Verified source facts rather than invented master data (§14.12 & Review Finding 22)
  // Must NOT invent synthetic emails, fake phone numbers, "Generic", or "Surface Mount"
  assert.ok(!content.includes('|| "Generic"'), "Must never synthesize 'Generic' manufacturer fallback");
  assert.ok(!content.includes('|| "Surface Mount"'), "Must never synthesize 'Surface Mount' package fallback");
  assert.ok(!content.includes('|| "@supplier.example"'), "Must never synthesize fake supplier email");
  assert.ok(!content.includes('|| "+91 90000 00000"'), "Must never synthesize fake supplier phone");
});

test("§14.12: Capability gating and canonical ID bindings in RecordForm and SharedOperationalWorkspace", () => {
  const indexContent = fs.readFileSync(path.resolve(__dirname, "../src/routes/index.tsx"), "utf8");
  const sharedContent = fs.readFileSync(path.resolve(__dirname, "../src/components/SharedOperationalWorkspace.tsx"), "utf8");

  // Capability guards in RecordForm (index.tsx)
  assert.ok(indexContent.includes('canAddCustomer = ["sales", "sal", "admin"].includes(area)'), "Customer creation restricted to Sales & Admin");
  assert.ok(indexContent.includes('canAddSupplier = ["pur", "admin"].includes(area)'), "Supplier creation restricted to Purchasing & Admin");
  assert.ok(indexContent.includes('canAddPart = ["ehw", "esw", "mech", "pur", "rnd", "admin"].includes(area)'), "Part creation restricted to Engineering/Purchasing & Admin");

  // Capability guards in SharedOperationalWorkspace.tsx
  assert.ok(sharedContent.includes('canAddSupplier = actor.role === "admin" || actor.department_code === "PUR"'), "Shared workspace restricts supplier creation to PUR & Admin");
  assert.ok(sharedContent.includes('canAddPart = actor.role === "admin" || ["EHW", "FW", "SW", "MECH", "PUR"].includes(actor.department_code || "")'), "Shared workspace restricts part creation to Engineering/PUR & Admin");

  // Shared workspace renders modals and binds canonical IDs
  assert.ok(sharedContent.includes("<InlineSupplierModal"), "SharedOperationalWorkspace renders InlineSupplierModal");
  assert.ok(sharedContent.includes("<InlinePartModal"), "SharedOperationalWorkspace renders InlinePartModal");
  assert.ok(sharedContent.includes("supplierId: createdId"), "SharedOperationalWorkspace binds canonical supplierId");
  assert.ok(sharedContent.includes("partId: createdId"), "SharedOperationalWorkspace binds canonical partId");
  assert.ok(sharedContent.includes("No canonical UUID was returned by the database"), "Shared workspace rejects missing returned ID");
});

test("§14.12 & §14.14: Transactional PGlite behavioral verification of inline masters and downstream fail-closed gates", async (t) => {
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
  ];

  for (const name of initialMigrations) {
    const file = path.join(root, "supabase/migrations", `${name}.sql`);
    await db.exec(fs.readFileSync(file, "utf8"));
  }

  const admin = uuid(1),
    purLead = uuid(2),
    hwLead = uuid(3),
    qaLead = uuid(4),
    salLead = uuid(5),
    emp = uuid(6),
    org = uuid(10),
    dPur = uuid(11),
    dEhw = uuid(12),
    dQa = uuid(13),
    dSal = uuid(14);

  for (const [id, email] of [
    [admin, "admin@example.com"],
    [purLead, "pur@example.com"],
    [hwLead, "hw@example.com"],
    [qaLead, "qa@example.com"],
    [salLead, "sal@example.com"],
    [emp, "emp@example.com"],
  ]) {
    await db.query("INSERT INTO auth.users VALUES($1, $2)", [id, email]);
  }

  await db.query(
    "INSERT INTO organizations(id, name, main_location, created_by) VALUES($1, 'TEST ONLY · SSM-new1 synthetic workspace', 'Synthetic', $2)",
    [org, admin]
  );

  const mids = {};
  mids[admin] = (
    await db.query("SELECT id FROM organization_members WHERE user_id=$1", [admin])
  ).rows[0].id;

  for (const [id, role] of [
    [purLead, "department_lead"],
    [hwLead, "department_lead"],
    [qaLead, "department_lead"],
    [salLead, "department_lead"],
    [emp, "member"],
  ]) {
    mids[id] = (
      await db.query(
        "INSERT INTO organization_members(organization_id, user_id, role, display_name) VALUES($1, $2, $3::text::app_role, $3::text) RETURNING id",
        [org, id, role]
      )
    ).rows[0].id;
  }

  for (const [id, code, lead] of [
    [dPur, "PUR", purLead],
    [dEhw, "EHW", hwLead],
    [dQa, "QA", qaLead],
    [dSal, "SAL", salLead],
  ]) {
    await db.query(
      "INSERT INTO departments(id, organization_id, name, department_type, code, lead_member_id) VALUES($1, $2, $3,$3,$3, $4)",
      [id, org, code, mids[lead]]
    );
  }

  async function asUser(user, callback) {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
    await db.exec("SET ROLE authenticated");
    try {
      return await callback();
    } finally {
      await db.exec("RESET ROLE");
    }
  }

  async function call(user, action, payload, key = crypto.randomUUID()) {
    return asUser(user, async () => {
      const res = await db.query(
        "SELECT mutate_shared_test_workspace($1, $2::jsonb, $3) result",
        [action, JSON.stringify(payload), key]
      );
      return res.rows[0].result;
    });
  }

  // 1. Setup shared project for downstream orders
  const project = (
    await call(salLead, "create_project", {
      title: "Rugged Fleet Tracker Mass Production",
      reference: "HLPL-RFT-01",
    })
  ).id;
  assert.ok(project, "Project must be created");

  // 2. Behavioral verification: Authenticated Supplier creation by PUR
  const supplierResult = await call(purLead, "create_record", {
    title: "Mouser Electronics India",
    reference: "HLPL-SUP-0001",
    record_type: "Supplier",
    fields: {
      name: "Mouser Electronics India",
      category: "Semiconductors & ICs",
      spocName: "Rajiv Menon",
      spocEmail: "", // Rule: Unspecified email must remain empty, never invented
      spocPhone: "", // Rule: Unspecified phone must remain empty, never invented
      verification_status: "Pending_Verification",
      revision: "01",
    },
    notes: "Inline registered vendor · Pending Verification",
  });

  assert.ok(supplierResult.id, "Canonical UUID must be returned for created supplier");
  assert.equal(supplierResult.record_type, "Supplier");
  assert.equal(supplierResult.reference, "HLPL-SUP-0001");

  // Verify persistence in operational_records without fabricated data
  const persistedSup = (
    await db.query("SELECT * FROM operational_records WHERE id = $1", [supplierResult.id])
  ).rows[0];
  assert.equal(persistedSup.record_type, "Supplier");
  assert.equal(persistedSup.fields.verification_status, "Pending_Verification");
  assert.equal(persistedSup.fields.spocEmail, "");
  assert.equal(persistedSup.fields.spocPhone, "");

  // 3. Behavioral verification: Unauthorized supplier creation by non-PUR fails closed
  await assert.rejects(
    call(hwLead, "create_record", {
      title: "Unauthorized Supplier Attempt",
      reference: "HLPL-SUP-0002",
      record_type: "Supplier",
      fields: { revision: "01", name: "Denied Vendor" },
    }),
    /SUPPLIER_CREATE_DENIED/
  );

  await assert.rejects(
    call(salLead, "create_record", {
      title: "Unauthorized Supplier Attempt",
      reference: "HLPL-SUP-0003",
      record_type: "Supplier",
      fields: { revision: "01", name: "Denied Vendor" },
    }),
    /SUPPLIER_CREATE_DENIED/
  );

  // 4. Behavioral verification: Authenticated Part creation by Engineering (EHW)
  const partResult = await call(hwLead, "create_record", {
    title: "STM32F405RGT6 · Microcontroller",
    reference: "HLPL-PRT-0001",
    record_type: "Part",
    fields: {
      mpn: "STM32F405RGT6",
      description: "ARM Cortex-M4 32-bit MCU 168MHz",
      manufacturer: "", // Rule: Unspecified manufacturer must remain empty, never invented as 'Generic'
      packageFootprint: "", // Rule: Unspecified footprint must remain empty, never invented as 'Surface Mount'
      category: "Microcontrollers & Processors",
      release_status: "Engineering_Only",
      revision: "01",
    },
    notes: "Inline registered component · Engineering Only",
  });

  assert.ok(partResult.id, "Canonical UUID must be returned for created part");
  assert.equal(partResult.record_type, "Part");
  assert.equal(partResult.reference, "HLPL-PRT-0001");

  // Verify persistence in operational_records without fabricated defaults
  const persistedPart = (
    await db.query("SELECT * FROM operational_records WHERE id = $1", [partResult.id])
  ).rows[0];
  assert.equal(persistedPart.record_type, "Part");
  assert.equal(persistedPart.fields.release_status, "Engineering_Only");
  assert.equal(persistedPart.fields.manufacturer, "");
  assert.equal(persistedPart.fields.packageFootprint, "");

  // 5. Behavioral verification: Unauthorized part creation by non-engineering fails closed
  await assert.rejects(
    call(salLead, "create_record", {
      title: "Unauthorized Part Attempt",
      reference: "HLPL-PRT-0002",
      record_type: "Part",
      fields: { revision: "01", mpn: "DENIED-PART" },
    }),
    /PART_CREATE_DENIED/
  );

  // 6. Fail-closed Downstream Gate 1: Missing supplier blocks PO
  await assert.rejects(
    call(purLead, "create_record", {
      project_id: project,
      title: "PO with missing supplier",
      reference: "HLPL-RFT-PUR-PO-00",
      record_type: "Purchase order",
      fields: {
        revision: "01",
        quantity: "100",
      },
    }),
    /SUPPLIER_REQUIRED/
  );

  // 7. Fail-closed Downstream Gate 1: Non-existent supplier blocks PO
  await assert.rejects(
    call(purLead, "create_record", {
      project_id: project,
      title: "PO with nonexistent supplier",
      reference: "HLPL-RFT-PUR-PO-01-FAIL",
      record_type: "Purchase order",
      fields: {
        revision: "01",
        supplier: "nonexistent-supplier",
        quantity: "100",
      },
    }),
    /SUPPLIER_NOT_FOUND/
  );

  // 8. Fail-closed Downstream Gate 1: Pending_Verification supplier blocks production PO
  await assert.rejects(
    call(purLead, "create_record", {
      project_id: project,
      title: "Production Lot 1 PO with pending supplier",
      reference: "HLPL-RFT-PUR-PO-01",
      record_type: "Purchase order",
      fields: {
        revision: "01",
        supplier: supplierResult.id,
        quantity: "500",
      },
    }),
    /SUPPLIER_VERIFICATION_REQUIRED/
  );

  // 9. Fail-closed Downstream Gate 2: Missing component part blocks released BOM
  await assert.rejects(
    call(hwLead, "create_record", {
      project_id: project,
      title: "Released BOM with missing part",
      reference: "HLPL-RFT-EHW-BOM-00",
      record_type: "BOM",
      stage: "released",
      fields: {
        revision: "01",
        stage: "released",
      },
    }),
    /PART_REQUIRED/
  );

  // 10. Fail-closed Downstream Gate 2: Non-existent component part blocks released BOM
  await assert.rejects(
    call(hwLead, "create_record", {
      project_id: project,
      title: "Released BOM with nonexistent part",
      reference: "HLPL-RFT-EHW-BOM-01-FAIL",
      record_type: "BOM",
      stage: "released",
      fields: {
        revision: "01",
        stage: "released",
        part: "nonexistent-part",
      },
    }),
    /PART_NOT_FOUND/
  );

  // 11. Fail-closed Downstream Gate 2: Engineering_Only part blocks mass production release / BOM
  await assert.rejects(
    call(hwLead, "create_record", {
      project_id: project,
      title: "Mass Production Released BOM Rev 01",
      reference: "HLPL-RFT-EHW-BOM-01",
      record_type: "BOM",
      stage: "released",
      fields: {
        revision: "01",
        stage: "released",
        part: partResult.id,
      },
    }),
    /PART_RELEASE_REQUIRED/
  );

  // 12. Downstream Gate Unlocked: Once supplier is Approved, production PO succeeds
  await db.query(
    "UPDATE operational_records SET status = 'approved', fields = fields || '{\"verification_status\":\"Approved\"}'::jsonb WHERE id = $1",
    [supplierResult.id]
  );

  const poSuccess = await call(purLead, "create_record", {
    project_id: project,
    title: "Production Lot 1 PO",
    reference: "HLPL-RFT-PUR-PO-01-OK",
    record_type: "Purchase order",
    fields: {
      revision: "01",
      supplier: supplierResult.id,
      quantity: "500",
    },
  });
  assert.ok(poSuccess.id, "Production PO succeeds with verified supplier");
  assert.equal(poSuccess.record_type, "Purchase order");

  // 13. Downstream Gate Unlocked: Once part is Released, mass production BOM succeeds
  await db.query(
    "UPDATE operational_records SET status = 'released', fields = fields || '{\"release_status\":\"Released\"}'::jsonb WHERE id = $1",
    [partResult.id]
  );

  const bomSuccess = await call(hwLead, "create_record", {
    project_id: project,
    title: "Mass Production Released BOM Rev 01",
    reference: "HLPL-RFT-EHW-BOM-01-OK",
    record_type: "BOM",
    stage: "released",
    fields: {
      revision: "01",
      stage: "released",
      part: partResult.id,
    },
  });
  assert.ok(bomSuccess.id, "Mass production BOM succeeds with released part");
  assert.equal(bomSuccess.record_type, "BOM");

  // 14. Downstream Gate Enforcement on update_record: Updating PO with invalid/missing supplier fails closed
  await assert.rejects(
    call(purLead, "update_record", {
      record_id: poSuccess.id,
      expected_updated_at: (await db.query("SELECT updated_at FROM operational_records WHERE id=$1", [poSuccess.id])).rows[0].updated_at.toISOString(),
      fields: {
        revision: "02",
        supplier: "nonexistent-supplier-update",
      },
    }),
    /SUPPLIER_NOT_FOUND/
  );

  // 15. Downstream Gate Enforcement on update_record: Updating BOM with invalid/unreleased part fails closed
  await assert.rejects(
    call(hwLead, "update_record", {
      record_id: bomSuccess.id,
      expected_updated_at: (await db.query("SELECT updated_at FROM operational_records WHERE id=$1", [bomSuccess.id])).rows[0].updated_at.toISOString(),
      fields: {
        revision: "02",
        stage: "released",
        part: "nonexistent-part-update",
      },
    }),
    /PART_NOT_FOUND/
  );
});
