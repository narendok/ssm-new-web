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
  assert.ok(content.includes("operationId"), "Inline modals produce stable operationId for idempotent retries");

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

  // Shared workspace renders modals and binds canonical IDs with stable request identity
  assert.ok(sharedContent.includes("<InlineSupplierModal"), "SharedOperationalWorkspace renders InlineSupplierModal");
  assert.ok(sharedContent.includes("<InlinePartModal"), "SharedOperationalWorkspace renders InlinePartModal");
  assert.ok(sharedContent.includes("supplier.operationId"), "Shared workspace preserves stable supplier operationId on retry");
  assert.ok(sharedContent.includes("part.operationId"), "Shared workspace preserves stable part operationId on retry");
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
    "20261025103000_saved_lifecycle_coordination",
    "20261025110000_saved_lifecycle_disposition",
    "20261025111644_project_input_feasibility_sheet",
    "20261025152001_link_approved_input_baseline",
    "20261026090000_preproject_sales_intake",
    "20261026100000_atomic_sales_intake",
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

  const mechLead=uuid(20), fwLead=uuid(21), swLead=uuid(22), finLead=uuid(23), sitLead=uuid(24), emfLead=uuid(25);
  for (const [id, email] of [
    [admin, "admin@example.com"],
    [purLead, "pur@example.com"],
    [hwLead, "hw@example.com"],
    [qaLead, "qa@example.com"],
    [salLead, "sal@example.com"],
    [emp, "emp@example.com"],
    [mechLead,"mech.fixture@example.test"],[fwLead,"fw.fixture@example.test"],[swLead,"sw.fixture@example.test"],[finLead,"fin.fixture@example.test"],[sitLead,"sit.fixture@example.test"],[emfLead,"emf.fixture@example.test"],
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
    [mechLead,"department_lead"],[fwLead,"department_lead"],[swLead,"department_lead"],[finLead,"department_lead"],[sitLead,"department_lead"],[emfLead,"department_lead"],
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
    [uuid(30),"MECH",mechLead],[uuid(31),"FW",fwLead],[uuid(32),"SW",swLead],[uuid(33),"FIN",finLead],[uuid(34),"SIT",sitLead],[uuid(35),"EMF",emfLead],
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

  // Pre-project intake must remain independent of project creation, with Sales authority enforced.
  const preProjectPayload = {record_type:"Opportunity",title:"Pre-project feasibility intake",reference:"HLPL-GEN-SAL-OPP-PREPROJECT-01",project_id:null,fields:{revision:"01"}};
  const projectCount = Number((await db.query("SELECT count(*) AS n FROM operational_records WHERE record_type='Project'")).rows[0].n);
  const opportunity = await call(salLead,"create_record",preProjectPayload,uuid(1101));
  assert.ok(opportunity.id);
  assert.equal((await call(salLead,"create_record",preProjectPayload,uuid(1101))).id,opportunity.id,"Retry returns original opportunity");
  assert.equal(Number((await db.query("SELECT count(*) AS n FROM operational_records WHERE record_type='Project'")).rows[0].n),projectCount,"Intake creates no dummy project");
  await assert.rejects(call(hwLead,"create_record",{...preProjectPayload,reference:"HLPL-GEN-SAL-OPP-DENIED-01"}),/PREPROJECT_SALES_AUTHORITY_REQUIRED/);
  await assert.rejects(call(hwLead,"create_record",{...preProjectPayload,record_type:"Schematic",reference:"HLPL-GEN-EHW-SCH-DENIED-01"}),/PROJECT_REQUIRED/);

  async function salesCall(user,payload,key=crypto.randomUUID()) {
    return asUser(user,async()=> (await db.query('SELECT public.mutate_sales_intake($1::jsonb,$2) AS result',[JSON.stringify(payload),key])).rows[0].result);
  }
  const intakePayload={mode:'enquiry',title:'Atomic enquiry',scopeSummary:'Actual intake values, pending review',targetVolume:'20 pilot units',track:'turnkey',dispatchFeasibility:false,parameterValues:{system_voltage:'12 V'},status:'approved'};
  for(const user of [hwLead,purLead,emp,null]) await assert.rejects(salesCall(user,intakePayload),/SALES_INTAKE_DENIED|permission denied/);
  const intakeRequest=crypto.randomUUID(),intake=await salesCall(salLead,intakePayload,intakeRequest);
  assert.equal((await salesCall(salLead,intakePayload,intakeRequest)).id,intake.id);
  await assert.rejects(salesCall(salLead,{...intakePayload,title:'Different'},intakeRequest),/REQUEST_ID_REUSED/);
  let intakeRow=(await db.query('SELECT * FROM operational_records WHERE id=$1',[intake.id])).rows[0];
  assert.equal(intakeRow.status,'draft','Caller approval flags are ignored');assert.equal(intakeRow.record_type,'Enquiry');
  const oldReference=intakeRow.reference;
  const convert={...intakePayload,mode:'convert',sourceId:intake.id,expectedUpdatedAt:new Date(intakeRow.updated_at).toISOString(),dispatchFeasibility:true,feasibilityDepts:['EHW','QA']};
  const converted=await salesCall(salLead,convert);
  assert.equal(converted.id,intake.id,'Conversion preserves source UUID');assert.equal(converted.reference,oldReference,'Conversion preserves controlled source reference');assert.equal(converted.sheetId,intake.sheetId,'Conversion preserves sheet');assert.equal(converted.reviewCount,2);
  intakeRow=(await db.query('SELECT * FROM operational_records WHERE id=$1',[intake.id])).rows[0];
  assert.equal(intakeRow.record_type,'Opportunity');assert.equal(intakeRow.status,'in_review');
  assert.equal(Number((await db.query('SELECT count(*) AS n FROM approvals WHERE record_id=$1',[intake.id])).rows[0].n),2);
  assert.equal(Number((await db.query('SELECT count(*) AS n FROM tasks WHERE record_id=$1',[intake.id])).rows[0].n),2);
  const atomicSheet=(await db.query('SELECT * FROM project_input_sheets WHERE id=$1',[intake.sheetId])).rows[0];
  assert.equal(atomicSheet.project_record_id,null);assert.equal(atomicSheet.parameter_values.system_voltage.finalValue,'');assert.deepEqual(atomicSheet.parameter_values.system_voltage.responses,{});
  await assert.rejects(salesCall(salLead,{mode:'dispatch',sourceId:intake.id,expectedUpdatedAt:new Date(intakeRow.updated_at).toISOString(),feasibilityDepts:['EHW']}),/ALREADY_DISPATCHED_OR_CLOSED/);
  const recordsBeforeFailure=Number((await db.query('SELECT count(*) AS n FROM operational_records')).rows[0].n);
  await assert.rejects(salesCall(salLead,{...intakePayload,mode:'opportunity',dispatchFeasibility:true,feasibilityDepts:['EHW'],parameterValues:{unknown_parameter:'12 V'}}),/PARAMETER/);
  assert.equal(Number((await db.query('SELECT count(*) AS n FROM operational_records')).rows[0].n),recordsBeforeFailure,'A late input error rolls back the created source and sheet');
  await assert.rejects(salesCall(salLead,{...intakePayload,mode:'opportunity',dispatchFeasibility:true,feasibilityDepts:['EHW','EHW']}),/DEPARTMENTS_INVALID/);
  await assert.rejects(salesCall(salLead,{...intakePayload,customerId:crypto.randomUUID()}),/CUSTOMER_INVALID/);
  const staleIntake=await salesCall(salLead,{...intakePayload,title:'Stale conversion probe'});
  await assert.rejects(salesCall(salLead,{...intakePayload,mode:'convert',sourceId:staleIntake.id,expectedUpdatedAt:'2000-01-01T00:00:00Z'}),/STALE_SALES_INTAKE/);
  const staleRow=(await db.query('SELECT * FROM operational_records WHERE id=$1',[staleIntake.id])).rows[0];
  await assert.rejects(salesCall(salLead,{...intakePayload,mode:'convert',sourceId:staleIntake.id,expectedUpdatedAt:new Date(staleRow.updated_at).toISOString(),parameterValues:{system_voltage:'24 V'}}),/EXISTING_INPUT_PRESERVED/);
  assert.equal((await db.query('SELECT record_type FROM operational_records WHERE id=$1',[staleIntake.id])).rows[0].record_type,'Enquiry','Failed conversion leaves original enquiry unchanged');
  assert.equal(Number((await db.query("SELECT count(*) AS n FROM operational_records WHERE record_type='Project'")).rows[0].n),projectCount,'Enquiry conversion never creates a dummy project');

  // 2. Behavioral verification: Authenticated Supplier creation by PUR with stable request ID
  const stableSupplierRequestId = uuid(101);
  const supplierPayload = {
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
  };

  const supplierResult = await call(purLead, "create_record", supplierPayload, stableSupplierRequestId);

  assert.ok(supplierResult.id, "Canonical UUID must be returned for created supplier");
  assert.equal(supplierResult.record_type, "Supplier");
  assert.equal(supplierResult.reference, "HLPL-SUP-0001");

  // 2b. Retry identity & idempotency test: Resending with the same request ID returns cached response
  const retrySupplierResult = await call(purLead, "create_record", supplierPayload, stableSupplierRequestId);
  assert.equal(retrySupplierResult.id, supplierResult.id, "Retry with same requestId must return identical canonical ID");

  // Verify that duplicate record was NOT created in operational_records
  const supCount = (
    await db.query("SELECT COUNT(*) FROM operational_records WHERE reference = 'HLPL-SUP-0001'")
  ).rows[0].count;
  assert.equal(Number(supCount), 1, "Idempotent retry must not duplicate supplier record");

  // 2c. Request ID reuse with changed payload must be rejected
  await assert.rejects(
    call(purLead, "create_record", { ...supplierPayload, title: "Tampered Title" }, stableSupplierRequestId),
    /REQUEST_ID_REUSED/
  );

  // Verify persistence in operational_records without fabricated data
  const persistedSup = (
    await db.query("SELECT * FROM operational_records WHERE id = $1", [supplierResult.id])
  ).rows[0];
  assert.equal(persistedSup.record_type, "Supplier");
  assert.equal(persistedSup.fields.verification_status, "Pending_Verification");
  assert.equal(persistedSup.fields.spocEmail, "");
  assert.equal(persistedSup.fields.spocPhone, "");

  // Customer inline creation uses the same durable, capability-gated contract.
  const customerPayload={title:"Test customer",reference:"HLPL-CUS-INLINE-01",record_type:"Customer",fields:{name:"Test customer",spocEmail:"",revision:"01"}};
  const customerRequest=crypto.randomUUID();
  const customer=await call(salLead,"create_record",customerPayload,customerRequest);
  assert.ok(customer.id);
  assert.equal((await call(salLead,"create_record",customerPayload,customerRequest)).id,customer.id);
  assert.equal((await db.query("SELECT fields FROM operational_records WHERE id=$1",[customer.id])).rows[0].fields.spocEmail,"");
  await assert.rejects(call(purLead,"create_record",{...customerPayload,reference:"HLPL-CUS-DENIED"}),/CUSTOMER_CREATE_DENIED/);

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

  // 3b. Anti-tampering check: non-admin attempting to self-approve supplier on creation is forced to Pending_Verification
  const selfApproveAttempt = await call(purLead, "create_record", {
    title: "Self-Approve Attempt Vendor",
    reference: "HLPL-SUP-0004",
    record_type: "Supplier",
    fields: {
      name: "Self-Approve Attempt Vendor",
      category: "Semiconductors & ICs",
      verification_status: "Approved", // Tampering attempt on creation
      revision: "01",
    },
  });
  const tamperedPersisted = (
    await db.query("SELECT fields FROM operational_records WHERE id=$1", [selfApproveAttempt.id])
  ).rows[0];
  assert.equal(tamperedPersisted.fields.verification_status, "Pending_Verification", "Backend anti-tampering forces Pending_Verification");

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

  // 6. Fail-closed Downstream Gate 1a: Missing supplier blocks PO
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

  // 7. Fail-closed Downstream Gate 1b: Non-existent supplier blocks PO
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

  // 8. Fail-closed Downstream Gate 1c: Pending_Verification supplier blocks production PO
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

  // 8b. Finding 2 Review Probe: Open unapproved supplier with absent verification_status MUST be rejected!
  await db.query(
    "UPDATE operational_records SET status = 'open', fields = fields - 'verification_status' WHERE id = $1",
    [supplierResult.id]
  );
  await assert.rejects(
    call(purLead, "create_record", {
      project_id: project,
      title: "PO with unapproved open supplier",
      reference: "HLPL-RFT-PUR-PO-PROBE-FAIL",
      record_type: "Purchase order",
      fields: {
        revision: "01",
        supplier: supplierResult.id,
        quantity: "100",
      },
    }),
    /SUPPLIER_VERIFICATION_REQUIRED/,
    "Positive approval check must reject open unapproved supplier with absent verification_status"
  );

  // 9. Fail-closed Downstream Gate 2a: Missing component part blocks released BOM
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

  // 10. Fail-closed Downstream Gate 2b: Non-existent component part blocks released BOM
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

  // 11. Fail-closed Downstream Gate 2c: Engineering_Only part blocks mass production release / BOM
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

  // 11b. Positive check: Open unreleased part with absent release_status MUST be rejected!
  await db.query(
    "UPDATE operational_records SET status = 'open', fields = fields - 'release_status' WHERE id = $1",
    [partResult.id]
  );
  await assert.rejects(
    call(hwLead, "create_record", {
      project_id: project,
      title: "BOM with unreleased open part",
      reference: "HLPL-RFT-EHW-BOM-PROBE-FAIL",
      record_type: "BOM",
      stage: "released",
      fields: {
        revision: "01",
        stage: "released",
        part: partResult.id,
      },
    }),
    /PART_RELEASE_REQUIRED/,
    "Positive release check must reject open unreleased part with absent release_status"
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

  // 16. Finding 5: Anti-tampering on update_record (Non-admin cannot self-approve or release)
  await db.query(
    "UPDATE operational_records SET status = 'draft', fields = jsonb_set(fields, '{verification_status}', '\"Pending_Verification\"') WHERE id = $1",
    [supplierResult.id]
  );
  await assert.rejects(
    call(purLead, "update_record", {
      record_id: supplierResult.id,
      expected_updated_at: (await db.query("SELECT updated_at FROM operational_records WHERE id=$1", [supplierResult.id])).rows[0].updated_at.toISOString(),
      fields: {
        revision: "02",
        name: "Tampering Update Vendor",
        verification_status: "Approved",
      },
    }),
    /SUPPLIER_APPROVAL_DENIED/,
    "Non-admin cannot update supplier verification_status to Approved"
  );

  await db.query(
    "UPDATE operational_records SET status = 'draft', fields = jsonb_set(fields, '{release_status}', '\"Engineering_Only\"') WHERE id = $1",
    [partResult.id]
  );
  await assert.rejects(
    call(hwLead, "update_record", {
      record_id: partResult.id,
      expected_updated_at: (await db.query("SELECT updated_at FROM operational_records WHERE id=$1", [partResult.id])).rows[0].updated_at.toISOString(),
      fields: {
        revision: "02",
        mpn: "STM32F405RGT6",
        release_status: "Released",
      },
    }),
    /PART_RELEASE_DENIED/,
    "Non-admin cannot update part release_status to Released"
  );

  // 17. Finding 2: Part release gate check on request_approval for released BOM
  const unreleasedBom = await call(hwLead, "create_record", {
    project_id: project,
    title: "Draft BOM with unreleased part",
    reference: "HLPL-RFT-EHW-BOM-DRAFT",
    record_type: "BOM",
    stage: "draft",
    fields: {
      revision: "01",
      stage: "draft",
      part: partResult.id,
    },
  });
  // Update BOM stage to released
  await db.query(
    "UPDATE operational_records SET stage = 'released', fields = jsonb_set(fields, '{stage}', '\"released\"') WHERE id = $1",
    [unreleasedBom.id]
  );
  // Attempt to request approval on released BOM referencing unreleased part
  await assert.rejects(
    call(hwLead, "request_approval", {
      record_id: unreleasedBom.id,
      reviewer_department_id: dQa,
    }),
    /PART_RELEASE_REQUIRED/,
    "request_approval on released BOM fails closed if component part is not released"
  );

  // 18. Finding 4: Connected TEST Fixture Synchronization (§14.13 & §14.14)
  await assert.rejects(asUser(purLead, () => db.query("SELECT sync_scenario_test_fixtures($1)", ["TEST-DENIED"])), /FIXTURE_ADMIN_REQUIRED/);
  await assert.rejects(call(admin, "sync_scenario_test_fixtures", {p_run_id:"production"}), /INVALID_TEST_RUN_ID/);
  const syncResult = await call(admin, "sync_scenario_test_fixtures", {
    p_run_id: "TEST-RUN-20261025-001",
  });
  assert.equal(syncResult.status, "created", "First fixture sync creates genuine records");
  assert.ok(syncResult.persisted_count >= 18, `Persisted count ${syncResult.persisted_count} >= 18`);

  // Verify S01-S06 in scenario_fixture_manifests
  const manifestRows = (
    await db.query("SELECT scenario_id, entity_type, record_type, reference, stage FROM scenario_fixture_manifests WHERE organization_id = $1 AND run_id = $2", [org, "TEST-RUN-20261025-001"])
  ).rows;
  assert.ok(manifestRows.some(r => r.scenario_id === "S01" && r.reference === "TEST-JIG-01"), "S01 Project TEST-JIG-01 persisted");
  assert.ok(manifestRows.some(r => r.scenario_id === "S01" && r.reference === "HLPL-JIG-EHW-SCH-01"), "S01 Schematic persisted");
  
  // Verify §14.14 S02 Invariant: Strictly NO project created for S02
  const s02Projects = manifestRows.filter(r => r.scenario_id === "S02" && r.entity_type === "project");
  assert.equal(s02Projects.length, 0, "§14.14 Invariant: Strictly NO project created for S02 DECLINED-ENQUIRY");
  assert.ok(manifestRows.some(r => r.scenario_id === "S02" && r.reference === "ENQ-2026-EXT-01"), "S02 Enquiry ENQ-2026-EXT-01 persisted");
  assert.ok(manifestRows.some(r => r.scenario_id === "S02" && r.reference === "HLPL-EXT-PUR-FEAS-01"), "S02 Feasibility HLPL-EXT-PUR-FEAS-01 persisted");

  // Verify S06 Bulk Production and arithmetic reconciliation
  assert.ok(manifestRows.some(r => r.scenario_id === "S06" && r.reference === "TEST-RFT-01"), "S06 Project TEST-RFT-01 persisted");
  const s06Inspection = (
    await db.query("SELECT fields FROM operational_records WHERE organization_id = $1 AND reference = 'HLPL-RFT-QA-IQC-01'", [org])
  ).rows[0];
  assert.ok(s06Inspection, "S06 Inspection record persisted in operational_records");
  const f = s06Inspection.fields;
  assert.equal(f.acceptedUnits, 150, "S06: 150 accepted units");
  assert.equal(f.heldUnits, 5, "S06: 5 held units");
  assert.equal(f.pendingInspectionUnits, 45, "S06: 45 pending inspection units");
  assert.equal(f.acceptedUnits + f.heldUnits + f.pendingInspectionUnits, f.lotQuantity, "150 + 5 + 45 === 200 lot 1 units");
  assert.equal(f.totalPlannedUnits - f.lotQuantity, f.remainingPlannedUnits, "500 - 200 === 300 remaining planned units");
  assert.equal(f.reconciliationCheckPassed, true, "Arithmetic reconciliation verified");

  // 19. Finding 4 Idempotency: Second call reuses existing fixtures without duplication
  const recordCountBefore = Number((await db.query("SELECT count(*) as c FROM operational_records WHERE organization_id = $1", [org])).rows[0].c);
  const syncReplay = await call(admin, "sync_scenario_test_fixtures", {
    p_run_id: "TEST-RUN-20261025-001",
  });
  assert.equal(syncReplay.status, "already_synced", "Second call reports already_synced");
  assert.equal(syncReplay.persisted_count, syncResult.persisted_count, "Persisted count matches");
  const recordCountAfter = Number((await db.query("SELECT count(*) as c FROM operational_records WHERE organization_id = $1", [org])).rows[0].c);
  assert.equal(recordCountBefore, recordCountAfter, "Zero duplicate records inserted on replay");
  const connectedSQL = fs.readFileSync(path.join(root,"supabase/fixtures/connected_lifecycle_examples.sql"),"utf8").replaceAll("TEST-LIFECYCLE-20261025-001","TEST-RUN-20261025-001");
  await db.exec(connectedSQL);
  const taskCount=await db.query("SELECT count(*)::int AS n FROM scenario_fixture_manifests WHERE run_id=$1 AND entity_type='task'",["TEST-RUN-20261025-001"]);
  assert.equal(taskCount.rows[0].n,17);
  await db.exec(connectedSQL);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM scenario_fixture_manifests WHERE run_id=$1 AND entity_type='task'",["TEST-RUN-20261025-001"])).rows[0].n,17,"Connected setup replay does not duplicate tasks");
  const coordination=await asUser(admin,async()=> (await db.query("SELECT get_project_coordination() AS result")).rows[0].result);
  const jig=coordination.records.find(record=>record.reference==="TEST-JIG-01");
  assert.ok(jig.fields.stageHistory.includes("Requirements & Feasibility"));
  assert.ok(jig.fields.nextAction.includes("clearance"));
  const linksSQL=fs.readFileSync(path.join(root,"supabase/fixtures/connected_lifecycle_links.sql"),"utf8").replaceAll("TEST-LIFECYCLE-20261025-001","TEST-RUN-20261025-001");
  await db.exec(linksSQL);
  await db.exec(linksSQL);
  assert.equal((await db.query("SELECT stage FROM operational_records WHERE reference=$1",["TEST-RFT-01"])).rows[0].stage,"Stage 8");
  assert.ok((await db.query("SELECT fields FROM operational_records WHERE reference=$1",["HLPL-EXT-PUR-FEAS-01"])).rows[0].fields.enquiryId);


  // Walk every current catalogue entry against the real migration contract in an isolated database.
  const ts=require("typescript"); const catalogue={exports:{}};
  new Function("module","exports",ts.transpileModule(fs.readFileSync(path.join(root,"src/lib/record-form-catalogue.ts"),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(catalogue,catalogue.exports);
  const {formSpecs,recordFields,recordFieldValues}=catalogue.exports;
  const verifiedSupplier=await call(admin,"create_record",{record_type:"Supplier",title:"Catalogue verified supplier",reference:"HLPL-CAT-SUP-01",fields:{revision:"01",verification_status:"Approved"}});
  let coverage=0;
  for(const [area,spec] of Object.entries(formSpecs)) {
    for(const type of spec.types) {
      const label=`${area}/${type}`; const ref=`HLPL-CAT-REC-${++coverage}`;
      if(type==="Project") {
        const created=await call(admin,"create_project",{title:label,reference:ref,department_id:dEhw});assert.ok(created.id,label);continue;
      }
      if(type==="Task") {
        const created=await call(admin,"create_task",{project_id:project,title:label,department_id:dEhw,assignee_id:mids[hwLead],priority:"Normal"});assert.ok(created.id,label);continue;
      }
      const input={revision:"01",supplier:verifiedSupplier.id,supplierId:verifiedSupplier.id};
      for(const field of recordFields(spec,type))if(field.required)input[field.key]=field.options?.[0] || (field.kind==="date"?"2026-10-25":"TEST");
      const fields=recordFieldValues(spec,type,input);
      const created=await call(admin,"create_record",{project_id:project,title:label,reference:ref,record_type:type,department_id:dEhw,fields,notes:"Isolated catalogue creation probe"});
      const saved=(await db.query("SELECT * FROM operational_records WHERE id=$1",[created.id])).rows[0];
      assert.equal(saved.record_type,type,label);assert.equal(saved.reference,ref,label);
      for(const [key,value] of Object.entries(fields))assert.equal(saved.fields[key],value,`${label}/${key}`);
      await call(admin,"update_record",{record_id:created.id,expected_updated_at:new Date(saved.updated_at).toISOString(),fields:saved.fields,notes:"Verified edit roundtrip"});
      assert.equal((await db.query("SELECT notes FROM operational_records WHERE id=$1",[created.id])).rows[0].notes,"Verified edit roundtrip",label);
    }
  }
  assert.equal(coverage,88,"All current catalogue entries exercised; changing catalogue requires deliberate coverage update");

  async function sheetCall(user,action,payload){return asUser(user,async()=> (await db.query("SELECT mutate_project_input_sheet($1,$2::jsonb) result",[action,JSON.stringify(payload)])).rows[0].result);}
  let sheet=await sheetCall(salLead,"create",{sourceId:project,scope:"Client"});
  assert.equal((await sheetCall(salLead,"create",{sourceId:project,scope:"Client"})).id,sheet.id,"Opening again does not duplicate sheet");
  await assert.rejects(sheetCall(hwLead,"input",{sheetId:sheet.id,expectedVersion:sheet.version,parameterId:"system_voltage",input:"Tamper"}),/INPUT_OWNER_REQUIRED/);
  await assert.rejects(sheetCall(purLead,"respond",{sheetId:sheet.id,expectedVersion:sheet.version,parameterId:"system_voltage",department:"EHW",status:"Feasible",remarks:"Tamper"}),/INPUT_DEPARTMENT_DENIED/);
  await assert.rejects(sheetCall(admin,"approve",{sheetId:sheet.id,expectedVersion:sheet.version}),/CLIENT_APPROVAL_EVIDENCE_REQUIRED/);
  const params=JSON.parse(fs.readFileSync(path.join(root,"src/lib/project-input-template.json"),"utf8"));
  for(const parameter of params){sheet=await sheetCall(salLead,"input",{sheetId:sheet.id,expectedVersion:sheet.version,parameterId:parameter.id,input:parameter.id==="system_voltage"?"12 V":"",finalValue:parameter.id==="system_voltage"?"12 V":"",required:parameter.id==="system_voltage",exclusionReason:parameter.id==="system_voltage"?"":"Not applicable to this isolated test scope"});}
  const oldVersion=sheet.version;
  sheet=await sheetCall(hwLead,"respond",{sheetId:sheet.id,expectedVersion:sheet.version,parameterId:"system_voltage",department:"EHW",status:"Feasible",remarks:"Design assessment recorded",ownerId:mids[hwLead]});
  await assert.rejects(sheetCall(qaLead,"respond",{sheetId:sheet.id,expectedVersion:oldVersion,parameterId:"system_voltage",department:"QA",status:"Feasible",remarks:"Stale"}),/INPUT_STALE_VERSION/);
  sheet=await sheetCall(hwLead,"review_response",{sheetId:sheet.id,expectedVersion:sheet.version,parameterId:"system_voltage",department:"EHW"});
  sheet=await sheetCall(qaLead,"respond",{sheetId:sheet.id,expectedVersion:sheet.version,parameterId:"system_voltage",department:"QA",status:"Feasible",remarks:"Test requirements reviewed"});
  sheet=await sheetCall(qaLead,"review_response",{sheetId:sheet.id,expectedVersion:sheet.version,parameterId:"system_voltage",department:"QA"});
  sheet=await sheetCall(salLead,"client_evidence",{sheetId:sheet.id,expectedVersion:sheet.version,evidence:"Isolated test approval evidence reference"});
  sheet=await sheetCall(qaLead,"respond",{sheetId:sheet.id,expectedVersion:sheet.version,parameterId:"system_voltage",department:"QA",status:"Conditional",remarks:"Open transient test condition"});
  sheet=await sheetCall(qaLead,"review_response",{sheetId:sheet.id,expectedVersion:sheet.version,parameterId:"system_voltage",department:"QA"});
  await assert.rejects(sheetCall(admin,"approve",{sheetId:sheet.id,expectedVersion:sheet.version}),/INPUT_REVIEW_PENDING/);
  sheet=await sheetCall(qaLead,"respond",{sheetId:sheet.id,expectedVersion:sheet.version,parameterId:"system_voltage",department:"QA",status:"Feasible",remarks:"Condition resolved with recorded evidence"});
  await assert.rejects(sheetCall(admin,"approve",{sheetId:sheet.id,expectedVersion:sheet.version}),/INPUT_REVIEW_PENDING/);
  sheet=await sheetCall(qaLead,"review_response",{sheetId:sheet.id,expectedVersion:sheet.version,parameterId:"system_voltage",department:"QA"});
  sheet=await sheetCall(admin,"approve",{sheetId:sheet.id,expectedVersion:sheet.version});assert.equal(sheet.status,"Approved");
  await assert.rejects(sheetCall(salLead,"input",{sheetId:sheet.id,expectedVersion:sheet.version,parameterId:"system_voltage",input:"24 V"}),/INPUT_BASELINE_LOCKED/);
  const baseline=(await db.query("SELECT details FROM project_input_events WHERE sheet_id=$1 AND action='approve'",[sheet.id])).rows[0].details;
  assert.equal(baseline.baseline.system_voltage.input,"12 V");
  sheet=await sheetCall(salLead,"revise",{sheetId:sheet.id,expectedVersion:sheet.version,reason:"Client requested new power range"});assert.equal(sheet.revision,2);assert.equal(sheet.parameter_values.system_voltage.responses.EHW.reviewedBy,"");
  await assert.rejects(asUser(hwLead,()=>db.query("UPDATE project_input_sheets SET status='Approved' WHERE id=$1",[sheet.id])),/permission denied/);
  const readable=await asUser(hwLead,async()=> (await db.query("SELECT get_project_input_sheets() result")).rows[0].result);assert.ok(readable.sheets.some(s=>s.id===sheet.id));

  sheet=await sheetCall(hwLead,"add_parameter",{sheetId:sheet.id,expectedVersion:sheet.version,label:"Extra sensor isolation",hint:"Confirm isolation voltage and evidence",reviewers:"QA"});
  const custom=sheet.custom_parameters[0];assert.equal(custom.lead,"EHW");assert.deepEqual(custom.reviewers,["QA"]);
  await assert.rejects(sheetCall(purLead,"respond",{sheetId:sheet.id,expectedVersion:sheet.version,parameterId:custom.id,department:"PUR",status:"Feasible",remarks:"Unauthorized"}),/INPUT_DEPARTMENT_NOT_ASSIGNED/);
  await assert.rejects(sheetCall(salLead,"assign_owner",{sheetId:sheet.id,expectedVersion:sheet.version,ownerId:mids[hwLead]}),/INPUT_OWNER_ASSIGNMENT_DENIED/);
  const client=uuid(990);await db.query("INSERT INTO auth.users VALUES($1,'client.input@example.test')",[client]);await db.query("INSERT INTO organization_members(organization_id,user_id,role,display_name) VALUES($1,$2,'viewer','Client')",[org,client]);
  await assert.rejects(asUser(client,()=>db.query("SELECT get_project_input_sheets()")),/INPUT_ACCESS_DENIED/);
  await assert.rejects(asUser(null,()=>db.query("SELECT get_project_input_sheets()")),/INPUT_ACCESS_DENIED/);

  const intakeId=(await db.query("INSERT INTO operational_records(organization_id,department_id,area,record_type,reference,title,fields,created_by,updated_by,is_demo) VALUES($1,$2,'sales','Enquiry','HLPL-INPUT-ENQ-01','Input sheet pre-project test','{\"revision\":\"01\"}'::jsonb,$3,$3,true) RETURNING id",[org,dSal,salLead])).rows[0].id;
  let pre=await sheetCall(salLead,"create",{sourceId:intakeId,scope:"Internal"});assert.equal(pre.project_record_id,null);
  for(const p of params)pre=await sheetCall(salLead,"input",{sheetId:pre.id,expectedVersion:pre.version,parameterId:p.id,required:false,exclusionReason:"Explicitly excluded in isolated linkage test"});
  pre=await sheetCall(admin,"approve",{sheetId:pre.id,expectedVersion:pre.version});
  const accepted=await call(salLead,"create_project",{title:"Accepted after input approval",reference:"HLPL-INPUT-ACCEPTED-01"});
  pre=await sheetCall(salLead,"link_project",{sheetId:pre.id,expectedVersion:pre.version,projectId:accepted.id});assert.equal(pre.project_record_id,accepted.id);assert.equal(pre.status,"Approved");
  await assert.rejects(sheetCall(salLead,"input",{sheetId:pre.id,expectedVersion:pre.version,parameterId:"system_voltage",input:"Unauthorized baseline rewrite"}),/INPUT_BASELINE_LOCKED/);

});
