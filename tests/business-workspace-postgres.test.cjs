const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");
const root = path.resolve(__dirname, "..");
const uuid = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
test("business RPCs persist scope, serialize reservations, reject invalid identities and separate survey evidence", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
 CREATE SCHEMA storage;CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);CREATE PUBLICATION supabase_realtime;`);
  for (const name of [
    "20260927075123_ac4fb50c-cb14-4750-a34f-24a69522d4b0",
    "20260927075232_f91de181-c465-45aa-948c-2fd7979633e6",
    "20260927090641_a22d2778-36cf-4d5a-9317-87ec60e24b1e",
    "20260927171219_adbe39cb-1238-47c9-ba7c-69ad4ac4dc2d",
    "20260927171247_b0c6d9a3-9521-4fcb-bf96-260d6f79035d",
    "20260927171349_e3fade41-b2b3-4f0e-8a0b-12796c1261fd",
    "20261020010000_operational_stage_gate_contract",
    "20261020014346_bind_stage_gate_approval_revisions",
    "20261020025329_enforce_operational_gate_write_boundary",
  ])
    await db.exec(fs.readFileSync(path.join(root, "supabase/migrations", name + ".sql"), "utf8"));
  const admin = uuid(1),
    hw = uuid(2),
    qa = uuid(3),
    employee = uuid(4),
    fw = uuid(5),
    viewer = uuid(6),
    org = uuid(10),
    hd = uuid(11),
    qd = uuid(12),
    fd = uuid(13),
    sd = uuid(14);
  for (const [id, email] of [
    [admin, "admin@example.com"],
    [hw, "hw@example.com"],
    [qa, "qa@example.com"],
    [employee, "employee.ehw@example.com"],
    [fw, "fw@example.com"],
    [viewer, "client@example.com"],
    [uuid(7), "procurement@example.com"],
    [uuid(8), "service@example.com"],
  ])
    await db.query("INSERT INTO auth.users VALUES($1,$2)", [id, email]);
  await db.query(
    "INSERT INTO organizations(id,name,main_location,created_by) VALUES($1,'TEST ONLY · SSM-new1 synthetic workspace','Synthetic',$2)",
    [org, admin],
  );
  const mids = {};
  mids[admin] = (
    await db.query("SELECT id FROM organization_members WHERE user_id=$1", [admin])
  ).rows[0].id;
  for (const [id, role] of [
    [hw, "department_lead"],
    [qa, "department_lead"],
    [fw, "department_lead"],
    [employee, "member"],
    [viewer, "viewer"],
    [uuid(7), "department_lead"],
    [uuid(8), "department_lead"],
  ])
    mids[id] = (
      await db.query(
        "INSERT INTO organization_members(organization_id,user_id,role,display_name) VALUES($1,$2,$3::text::app_role,$3::text) RETURNING id",
        [org, id, role],
      )
    ).rows[0].id;
  for (const [id, code, lead] of [
    [hd, "EHW", hw],
    [qd, "QA", qa],
    [fd, "FW", fw],
    [sd, "SAL", admin],
    [uuid(15), "PUR", uuid(7)],
    [uuid(17), "SIT", uuid(8)],
  ])
    await db.query(
      "INSERT INTO departments(id,organization_id,name,department_type,code,lead_member_id) VALUES($1,$2,$3,$3,$3,$4)",
      [id, org, code, mids[lead]],
    );
  await db.exec(
    fs.readFileSync(
      path.join(root, "supabase/migrations/20261020034857_shared_test_workspace.sql"),
      "utf8",
    ),
  );

  await db.exec(
    fs.readFileSync(
      path.join(root, "supabase/migrations/20261021134427_business_workspace_contract.sql"),
      "utf8",
    ),
  );
  await db.exec(
    fs.readFileSync(
      path.join(
        root,
        "supabase/migrations/20261024084915_business_workspace_validation_guards.sql",
      ),
      "utf8",
    ),
  );
  await db.exec(fs.readFileSync(path.join(root,"supabase/migrations/20261104174216_expense_request_routing.sql"),"utf8"));
  await db.exec(fs.readFileSync(path.join(root,"supabase/migrations/20261104174711_repair_expense_request_routing_patch.sql"),"utf8"));
  await db.exec(fs.readFileSync(path.join(root,"supabase/migrations/20261104175534_validate_expense_request_details.sql"),"utf8"));
  for (const migration of [
    "20261104171344_shared_expense_catalogue.sql",
    "20261106050628_shared_department_service_catalogue.sql",
    "20261106051636_validate_shared_service_catalogue.sql",
    "20261111162055_link_expense_service_catalogue.sql",
    "20261112142917_canonical_expense_supplier_options.sql",
    "20261112142926_service_catalogue_supplier_master_links.sql",
  ]) await db.exec(fs.readFileSync(path.join(root, "supabase/migrations", migration), "utf8"));
  await db.exec(fs.readFileSync(path.join(root, "supabase/migrations/20261112225842_shared_ticket_department_help.sql"), "utf8"));
  const patchedBusinessFn=(await db.query("SELECT pg_get_functiondef('mutate_business_workspace(text,jsonb,uuid)'::regprocedure) AS definition")).rows[0].definition;
  assert.match(patchedBusinessFn,/Pending_Procurement/);
  assert.match(patchedBusinessFn,/COALESCE\(data->>'requestType','travel'\)/);
  async function as(user, callback) {
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user ?? ""]);
    await db.exec("SET ROLE authenticated");
    try {
      return await callback();
    } finally {
      await db.exec("RESET ROLE");
    }
  }
  async function call(user, action, payload, key = crypto.randomUUID()) {
    return as(
      user,
      async () =>
        (
          await db.query("SELECT mutate_business_workspace($1,$2::jsonb,$3) result", [
            action,
            JSON.stringify(payload),
            key,
          ])
        ).rows[0].result,
    );
  }
  async function load(user) {
    return as(
      user,
      async () => (await db.query("SELECT get_business_workspace() result")).rows[0].result,
    );
  }
  async function loadExpenseCatalogue(user) {
    return as(user, async () => (await db.query("SELECT get_expense_catalogue(NULL) result")).rows[0].result);
  }
  await assert.rejects(load(null), /MEMBERSHIP_REQUIRED/);
  const supplierMasterId=uuid(30);
  await db.query("INSERT INTO operational_records(id,organization_id,department_id,area,record_type,reference,title,created_by,updated_by) VALUES($1,$2,$3,'procurement','Supplier','SUP-TEST-001','TEST approved component supplier',$4,$4)",[supplierMasterId,org,uuid(15),admin]);
  assert.ok((await load(employee)).suppliers.some(supplier=>supplier.id===supplierMasterId&&supplier.title==='TEST approved component supplier'),'expense requester sees only the supplier master fields needed to link a request');
  const projectMasterId=uuid(31);
  await db.query("INSERT INTO operational_records(id,organization_id,department_id,area,record_type,reference,title,stage,created_by,updated_by) VALUES($1,$2,$3,'engineering','Project','TEST-PROJECT-001','TEST linked project','HW_01',$4,$4)",[projectMasterId,org,hd,admin]);
  assert.ok((await load(employee)).projects.some(project=>project.id===projectMasterId&&project.reference==='TEST-PROJECT-001'&&project.currentStage==='HW_01'),'expense request project choices come from the organization project records with their current lifecycle stage');
  const expenseCatalogue=await loadExpenseCatalogue(admin);
  assert.ok(expenseCatalogue.suppliers.some(supplier=>supplier.id===supplierMasterId),'service settings use the same canonical Supplier master');
  await assert.rejects(loadExpenseCatalogue(viewer),/EXPENSE_SETTINGS_ACCESS_DENIED/,'viewer/client memberships cannot read the service supplier selector');
  const linkedServices=expenseCatalogue.services.map(service=>service.id==='github'?{...service,supplierId:supplierMasterId,provider:'Forged display name'}:service);
  await assert.rejects(as(admin,()=>db.query("SELECT save_expense_catalogue(NULL,$1::jsonb,$2)",[JSON.stringify({categories:expenseCatalogue.categories,purposes:expenseCatalogue.purposes,operationsEnabled:expenseCatalogue.operationsEnabled,services:expenseCatalogue.services.map(service=>service.id==='github'?{...service,supplierId:uuid(33)}:service)}),expenseCatalogue.version])),/EXPENSE_SERVICE_SUPPLIER_INVALID/);
  await as(admin,()=>db.query("SELECT save_expense_catalogue(NULL,$1::jsonb,$2)",[JSON.stringify({categories:expenseCatalogue.categories,purposes:expenseCatalogue.purposes,operationsEnabled:expenseCatalogue.operationsEnabled,services:linkedServices}),expenseCatalogue.version]));
  const savedExpenseCatalogue=await loadExpenseCatalogue(employee);
  const linkedService=savedExpenseCatalogue.services.find(service=>service.id==='github');
  assert.equal(linkedService.supplierId,supplierMasterId,'service catalogue stores the canonical supplier ID');
  assert.equal(linkedService.provider,'TEST approved component supplier','service provider display is derived from the Supplier master');
  await assert.rejects(call(viewer, "allocate", { data: {} }), /FINANCE_AUTHORITY_REQUIRED/);
  await assert.rejects(
    as(employee, () => db.query("select * from business_items")),
    /permission denied/,
  );
  const now = new Date(),
    start = new Date(now.getTime() - 86400000).toISOString().slice(0, 10),
    end = new Date(now.getTime() + 86400000 * 30).toISOString().slice(0, 10);
  await assert.rejects(
    call(admin, "allocate", {
      data: { departmentId: hd, category: "Travel", allocatedAmount: 1000, currency: "INR" },
    }),
    /INVALID_ALLOCATION/,
  );
  await assert.rejects(
    call(employee, "request_expense", {
      data: { category: "Travel", amount: 100, currency: "INR", purpose: "Missing date" },
    }),
    /INVALID_EXPENSE/,
  );
  const validBase={category:"Travel & Transport",amount:100,currency:"INR",purpose:"Customer / Supplier / Site Visit",requiredDate:new Date(Date.now()+86400000).toISOString().slice(0,10)};
  await assert.rejects(call(employee,"request_expense",{data:{...validBase,requestType:"travel"}}),/INVALID_TRAVEL_DETAILS/);
  await assert.rejects(call(employee,"request_expense",{data:{...validBase,requestType:"reimbursement",merchant:"TEST rail"}}),/INVALID_REIMBURSEMENT_DETAILS/);
  await assert.rejects(call(employee,"request_expense",{data:{...validBase,requestType:"purchase",purchaseKind:"goods",itemOrService:"TEST component order"}}),/INVALID_PURCHASE_QUANTITY/);
  const alloc = (
    await call(admin, "allocate", {
      data: {
        departmentId: hd,
        category: "Travel",
        allocatedAmount: 1000,
        currency: "INR",
        periodId: "test",
        startDate: start,
        endDate: end,
      },
    })
  ).id;
  const requestKey = crypto.randomUUID();
  const payload = {
    data: {
      category: "Travel",
      amount: 600,
      currency: "INR",
      purpose: "Synthetic test trip",
      requiredDate: end,
      requestType: "reimbursement",
      merchant: "Synthetic rail operator",
      expenseDate: end,
    },
  };
  const req = (await call(employee, "request_expense", payload, requestKey)).id;
  assert.equal((await call(employee, "request_expense", payload, requestKey)).id, req);
  await assert.rejects(
    call(employee, "request_expense", { data: { ...payload.data, amount: 650 } }, requestKey),
    /RETRY_PAYLOAD_CHANGED/,
  );
  let row = (await load(employee)).items.find((i) => i.id === req);
  assert.equal(row.data.status, "Pending_Finance");
  assert.ok((await load(admin)).notifications.some((n) => n.itemId === req));
  assert.equal(
    (await load(qa)).notifications.some((n) => n.itemId === req),
    false,
  );
  assert.equal(
    (await load(qa)).items.some((i) => i.id === req),
    false,
  );
  await assert.rejects(
    call(employee, "approve_expense", { id: req, version: row.version, data: {} }),
    /SELF_APPROVAL/,
  );
  await call(admin, "approve_expense", {
    id: req,
    version: row.version,
    data: { allocationId: alloc },
  });
  row = (await load(admin)).items.find((i) => i.id === req);
  assert.equal(row.data.status, "Approved");
  assert.equal((await load(admin)).items.find((i) => i.id === alloc).data.committedAmount, 600);
  await assert.rejects(
    call(hw, "post_expense", {
      id: req,
      version: row.version,
      data: { actualAmount: 500, postingRef: "TEST-01", evidenceRef: "fixture" },
    }),
    /ITEM_UNAVAILABLE/,
  );
  const second = (await call(employee, "request_expense", payload)).id;
  assert.equal((await load(employee)).items.find(i=>i.id===second).data.status,"Pending_Finance");
  await assert.rejects(
    call(admin, "approve_expense", { id: second, version: 1, data: { allocationId: alloc } }),
    /INSUFFICIENT_BUDGET/,
  );
  await call(admin, "post_expense", {
    id: req,
    version: row.version,
    data: { actualAmount: 500, postingRef: "TEST-01", evidenceRef: "fixture" },
  });
  const ledger = (await load(admin)).items.find((i) => i.id === alloc).data;
  assert.equal(ledger.committedAmount, 0);
  assert.equal(ledger.spentAmount, 500);
  await assert.rejects(
    call(admin, "post_expense", {
      id: req,
      version: row.version,
      data: { actualAmount: 500, postingRef: "TEST-01", evidenceRef: "fixture" },
    }),
    /STALE_VERSION/,
  );
  await assert.rejects(call(employee,"request_expense",{data:{...payload.data,requestType:"purchase",purchaseKind:"goods",itemOrService:"TEST unknown supplier",quantity:1,supplierId:uuid(32)}}),/INVALID_SUPPLIER/);
  const purchase=(await call(employee,"request_expense",{data:{...payload.data,requestType:"purchase",purchaseKind:"goods",itemOrService:"TEST sensor evaluation quantity",quantity:4,projectId:projectMasterId,supplierId:supplierMasterId,supplierName:"Forged supplier label"}})).id;
  const savedPurchase=(await load(employee)).items.find(i=>i.id===purchase);
  assert.equal(savedPurchase.data.status,"Pending_Procurement");
  assert.equal(savedPurchase.projectId,projectMasterId,'selected project remains linked to the request');
  assert.equal(savedPurchase.data.supplierId,supplierMasterId,'purchase request preserves the canonical supplier UUID');
  assert.equal(savedPurchase.data.supplierName,'TEST approved component supplier','supplier display snapshot is sourced from the selected canonical record');
  assert.ok((await load(uuid(7))).items.some(i=>i.id===purchase));
  assert.equal((await load(hw)).items.some(i=>i.id===purchase),false);
  await assert.rejects(call(hw,"approve_expense",{id:purchase,version:1,data:{}}),/ITEM_UNAVAILABLE/);
  const procurementItem=(await load(uuid(7))).items.find(i=>i.id===purchase);
  await call(uuid(7),"approve_expense",{id:purchase,version:procurementItem.version,data:{}});
  assert.equal((await load(employee)).items.find(i=>i.id===purchase).data.status,"Pending_Finance");
  const travel = (await call(employee, "request_expense", { data: {
    ...payload.data, requestType: "travel", destination: "TEST client site",
    travelStartDate: end, travelEndDate: end,
  } })).id;
  const service = (await call(employee, "request_expense", { data: {
    ...payload.data, requestType: "purchase", purchaseKind: "service",
    itemOrService: "TEST annual electronics calibration service", serviceCatalogueId: "calibration",
  } })).id;
  const employeeItems = (await load(employee)).items;
  assert.equal(employeeItems.find(item => item.id === travel).data.status, "Pending_Finance");
  assert.equal(employeeItems.find(item => item.id === service).data.status, "Pending_Procurement");
  assert.equal(employeeItems.find(item => item.id === service).data.serviceCatalogueId, "calibration");
  assert.equal(employeeItems.find(item => item.id === service).data.serviceCatalogueName, "Equipment calibration & maintenance");
  await assert.rejects(call(employee, "request_expense", { data: {
    ...payload.data, requestType: "purchase", purchaseKind: "service",
    itemOrService: "TEST unknown service", serviceCatalogueId: "unknown",
  } }), /EXPENSE_SERVICE_CATALOGUE_ENTRY_REQUIRED/);
  const procurementItems = (await load(uuid(7))).items;
  assert.equal(procurementItems.some(item => item.id === travel), false);
  const serviceForReview = procurementItems.find(item => item.id === service);
  assert.equal(serviceForReview.data.serviceCatalogueName, "Equipment calibration & maintenance");
  await call(uuid(7), "approve_expense", { id: service, version: serviceForReview.version, data: {} });
  const forwardedService = (await load(employee)).items.find(item => item.id === service);
  assert.equal(forwardedService.data.status, "Pending_Finance");
  assert.equal(forwardedService.data.serviceCatalogueId, "calibration");
  const linkedServiceRequest = (await call(employee, "request_expense", { data: {
    ...payload.data, requestType: "purchase", purchaseKind: "service",
    itemOrService: "TEST annual GitHub subscription", serviceCatalogueId: "github",
    supplierId: supplierMasterId, supplierName: "Forged supplier label", projectId: projectMasterId,
  } })).id;
  const linkedServiceEmployeeView = (await load(employee)).items.find(item => item.id === linkedServiceRequest);
  assert.equal(linkedServiceEmployeeView.projectId, projectMasterId, "service request retains the selected canonical Project ID");
  assert.equal(linkedServiceEmployeeView.data.serviceCatalogueId, "github");
  assert.equal(linkedServiceEmployeeView.data.serviceCatalogueName, "GitHub subscription");
  assert.equal(linkedServiceEmployeeView.data.supplierId, supplierMasterId, "catalogue service retains the canonical Supplier ID");
  assert.equal(linkedServiceEmployeeView.data.supplierName, "TEST approved component supplier", "current Supplier master overrides a submitted display label");
  const linkedServiceProcurementView = (await load(uuid(7))).items.find(item => item.id === linkedServiceRequest);
  assert.equal(linkedServiceProcurementView.projectId, projectMasterId, "Procurement receives the Project relationship");
  assert.equal(linkedServiceProcurementView.data.supplierId, supplierMasterId, "Procurement receives the same canonical Supplier ID");
  await call(uuid(7), "approve_expense", { id: linkedServiceRequest, version: linkedServiceProcurementView.version, data: {} });
  const linkedServiceAfterForward = (await load(employee)).items.find(item => item.id === linkedServiceRequest);
  assert.equal(linkedServiceAfterForward.projectId, projectMasterId, "Project relationship survives the Procurement-to-Finance handoff");
  assert.equal(linkedServiceAfterForward.data.supplierId, supplierMasterId, "Supplier relationship survives the Procurement-to-Finance handoff");
  assert.equal(linkedServiceAfterForward.data.serviceCatalogueId, "github", "service catalogue identity survives the handoff");
  const departmentService = (id, name) => ({
    id, name, category: "Maintenance & Calibration", provider: "",
    cycle: "Annual", owner: "Department lead",
  });
  await db.query(
    "INSERT INTO private.expense_catalogues(organization_id,scope,value,updated_by) VALUES ($1,$2,$3::jsonb,$6),($1,$4,$5::jsonb,$6)",
    [org, hd, JSON.stringify({ services: [departmentService("ehw-calibration", "EHW calibration")] }),
      qd, JSON.stringify({ services: [departmentService("qa-calibration", "QA calibration")] }), admin],
  );
  const departmentRequest = {
    ...payload.data, requestType: "purchase", purchaseKind: "service",
    itemOrService: "TEST calibration request", departmentId: hd,
  };
  const hardwareService = (await call(hw, "request_expense", {
    data: { ...departmentRequest, serviceCatalogueId: "ehw-calibration" },
  })).id;
  assert.equal((await load(hw)).items.find(item => item.id === hardwareService).data.serviceCatalogueName, "EHW calibration");
  await assert.rejects(call(hw, "request_expense", {
    data: { ...departmentRequest, departmentId: qd, serviceCatalogueId: "qa-calibration" },
  }), /EXPENSE_SERVICE_CATALOGUE_ENTRY_REQUIRED/);
  const ticket = (
    await call(employee, "ticket_create", {
      data: {
        subject: "Synthetic laptop issue",
        description: "Synthetic battery fault",
        priority: "Normal",
        category: "IT",
      },
    })
  ).id;
  assert.equal(
    (await load(qa)).items.some((i) => i.id === ticket),
    false,
  );
  await assert.rejects(call(employee, "ticket_dispatch_help", { data: { ticketId: ticket, departmentCode: "QA", summary: "Please inspect this synthetic fault" } }), /SERVICE_AUTHORITY_REQUIRED/);
  const helpRequest = (await call(uuid(8), "ticket_dispatch_help", { data: { ticketId: ticket, departmentCode: "QA", summary: "Please inspect this synthetic fault" } })).id;
  const qaHelp = (await load(qa)).items.find(i => i.id === helpRequest);
  assert.ok(qaHelp, "the receiving department lead sees the dispatched help request");
  assert.ok((await load(qa)).notifications.some(n => n.itemId === helpRequest), "the receiving department lead gets a shared workspace notification");
  assert.equal((await load(qa)).items.some(i => i.id === ticket), false, "the receiving department cannot read the original ticket");
  assert.equal(qaHelp.projectId, null, "the help request does not expose the source project link");
  assert.equal("replies" in qaHelp.data, false, "the limited help item does not copy ticket replies");
  assert.equal("assetId" in qaHelp.data, false, "the limited help item does not copy asset links");
  await assert.rejects(call(fw, "ticket_help_response", { id: helpRequest, version: qaHelp.version, data: { response: "Synthetic findings" } }), /ITEM_UNAVAILABLE/);
  await call(qa, "ticket_help_response", { id: helpRequest, version: qaHelp.version, data: { response: "Synthetic QA inspection completed; no production action taken." } });
  const respondedHelp = (await load(uuid(8))).items.find(i => i.id === helpRequest);
  assert.equal(respondedHelp.data.status, "Responded");
  assert.equal((await load(uuid(8))).items.find(i => i.id === ticket).data.replies.length, 0, "department response remains separate from the ticket's private thread");
  await call(uuid(8), "ticket_help_close", { id: helpRequest, version: respondedHelp.version, data: {} });
  assert.equal((await load(uuid(8))).items.find(i => i.id === helpRequest).data.status, "Closed");
  await assert.rejects(
    call(admin, "ticket_status", { id: ticket, version: 1, data: {} }),
    /INVALID_TICKET_TRANSITION/,
  );
  assert.equal((await load(employee)).items.find((i) => i.id === ticket).data.status, "Open");
  const clientTicket = (
    await call(viewer, "ticket_create", {
      data: {
        subject: "Synthetic client issue",
        description: "Synthetic field issue",
        priority: "High",
        category: "Service",
      },
    })
  ).id;
  await call(admin, "ticket_reply", {
    id: clientTicket,
    version: 1,
    data: { message: "Private synthetic diagnostics", isInternalNote: true },
  });
  assert.equal(
    (await load(viewer)).items.find((i) => i.id === clientTicket).data.replies.length,
    0,
  );
  await assert.rejects(
    call(viewer, "ticket_status", { id: clientTicket, version: 2, data: { status: "Assigned" } }),
    /SERVICE_AUTHORITY/,
  );
  const template = (
    await call(admin, "publish_template", {
      data: {
        type: "form",
        title: "Synthetic feedback",
        isAnonymous: true,
        audienceIds: [mids[employee]],
        dueDate: end,
        questions: [{ id: "yes", label: "Ready?", type: "boolean", required: true }],
      },
    })
  ).id;
  row = (await load(employee)).items.find(
    (i) => i.kind === "assignment" && i.data.templateId === template,
  );
  await call(employee, "submit_assignment", {
    id: row.id,
    version: row.version,
    data: { answers: { yes: false } },
  });
  assert.equal((await load(employee)).items.find((i) => i.id === row.id).data.status, "Completed");
  const response = await db.query(
    "select member_id,assignment_id,answers from private.business_answers where template_id=$1",
    [template],
  );
  assert.equal(response.rows[0].member_id, null);
  assert.equal(response.rows[0].assignment_id, null);
  const stats = (await load(admin)).surveyResults.find((s) => s.template_id === template);
  assert.equal(stats.answers, null);
  const training = (
    await call(admin, "publish_template", {
      data: {
        type: "training",
        title: "Synthetic safety review",
        audienceIds: [mids[employee]],
        dueDate: end,
        cadenceDays: 7,
        questions: [
          { id: "review", label: "Reviewed the material?", type: "boolean", required: true },
        ],
      },
    })
  ).id;
  let trainingRow = (await load(employee)).items.find(
    (i) => i.kind === "assignment" && i.data.templateId === training,
  );
  await assert.rejects(
    call(employee, "submit_assignment", {
      id: trainingRow.id,
      version: trainingRow.version,
      data: { answers: {} },
    }),
    /REQUIRED_ANSWER/,
  );
  await call(employee, "submit_assignment", {
    id: trainingRow.id,
    version: trainingRow.version,
    data: { answers: { review: true } },
  });
  trainingRow = (await load(employee)).items.find((i) => i.id === trainingRow.id);
  assert.equal(trainingRow.data.status, "Submitted");
  await assert.rejects(
    call(employee, "review_training", {
      id: trainingRow.id,
      version: trainingRow.version,
      data: { evidenceRef: "denied" },
    }),
    /TRAINING_REVIEW/,
  );
  await call(admin, "review_training", {
    id: trainingRow.id,
    version: trainingRow.version,
    data: { evidenceRef: "TEST-ATTENDANCE-01" },
  });
  await db.query("update business_items set created_at=now()-interval '8 days' where id=$1", [
    training,
  ]);
  await load(employee);
  await load(employee);
  assert.equal(
    (
      await db.query(
        "select count(*) n from business_items where kind='assignment' and payload->>'templateId'=$1",
        [training],
      )
    ).rows[0].n,
    2,
  );
  await assert.rejects(
    as(employee, () => db.query("select private.business_schedule_all()")),
    /permission denied/,
  );
  // Real projects retain original IDs. Private source notes never enter common coordination.
  async function original(user, action, payload) {
    return as(
      user,
      async () =>
        (
          await db.query("select mutate_shared_test_workspace($1,$2::jsonb,$3) result", [
            action,
            JSON.stringify(payload),
            crypto.randomUUID(),
          ])
        ).rows[0].result,
    );
  }
  const project = (
    await original(admin, "create_project", { title: "Project Alpha", reference: "HLPL-TEST-A" })
  ).id;
  const sparse = (
    await original(admin, "create_project", { title: "Project Sparse", reference: "HLPL-TEST-B" })
  ).id;
  const source = (
    await original(hw, "create_record", {
      project_id: project,
      title: "Private source title",
      reference: "HLPL-TEST-A-EHW",
      record_type: "Specification",
      fields: {
        revision: "01",
        scope: "Private detailed requirements",
        coordinationSummary: "Hardware input pending",
      },
    })
  ).id;
  await original(qa, "create_record", {
    project_id: project,
    title: "QA review",
    reference: "HLPL-TEST-A-QA",
    record_type: "Review",
    fields: { revision: "01", dependsOn: source },
  });
  const originalSnapshot=await as(hw,async()=>(await db.query('select get_shared_test_workspace() result')).rows[0].result);
  const originalSource=originalSnapshot.records.find(r=>r.id===source);
  await original(hw,'update_record',{record_id:source,expected_updated_at:originalSource.updated_at,fields:{...originalSource.fields,scope:'Private detailed requirements'},notes:'Synthetic edited note'});
  assert.equal((await db.query('select notes from operational_records where id=$1',[source])).rows[0].notes,'Synthetic edited note');
  const priorityTask=(await original(hw,'create_task',{project_id:project,title:'Synthetic critical task',priority:'Critical',assignee_id:mids[employee]})).id;
  let savedTask=(await db.query('select * from tasks where id=$1',[priorityTask])).rows[0];
  assert.equal(savedTask.priority,'Critical');
  await original(employee,'update_task',{id:priorityTask,status:'In review',expected_updated_at:savedTask.updated_at});
  savedTask=(await db.query('select * from tasks where id=$1',[priorityTask])).rows[0];
  await assert.rejects(original(employee,'update_task',{id:priorityTask,status:'Complete',expected_updated_at:savedTask.updated_at}),/USE_LINKED_REVIEW_RECORD/);
  const coordination = await as(
    qa,
    async () => (await db.query("select get_project_coordination() result")).rows[0].result,
  );
  assert.equal(
    coordination.records.find((r) => r.id === source).fields.scope,
    "Hardware input pending",
  );
  assert.equal(coordination.records.find((r) => r.id === source).fields.projectId, project);
  assert.ok(!JSON.stringify(coordination).includes("Private detailed requirements"));
  assert.ok(coordination.records.some((r) => r.id === sparse));
  await assert.rejects(
    as(viewer, () => db.query("select get_project_coordination()")),
    /COORDINATION_ACCESS/,
  );
  const chan = (
    await call(admin, "channel_create", {
      data: { name: "Synthetic private team", memberIds: [mids[admin], mids[employee]] },
    })
  ).id;
  assert.equal(
    (await load(qa)).items.some((i) => i.id === chan),
    false,
  );
  await assert.rejects(
    call(qa, "send_message", { data: { channelId: chan, text: "denied" } }),
    /CHANNEL_OR_MESSAGE_DENIED/,
  );
  await assert.rejects(
    call(employee, "send_message", {
      data: {
        channelId: chan,
        text: "Invalid poll",
        poll: { question: "Choose", options: ["A", "B"] },
      },
    }),
    /INVALID_POLL/,
  );
  const msg = (
    await call(employee, "send_message", {
      data: {
        channelId: chan,
        text: "Synthetic poll",
        poll: { question: "Choose", options: ["A", "B"], closesAt: "2099-01-01T00:00:00Z" },
      },
    })
  ).id;
  await call(employee, "poll_vote", { id: msg, version: 1, data: { choice: 0 } });
  await call(employee, "poll_vote", { id: msg, version: 1, data: { choice: 1 } });
  assert.equal(
    (await db.query("select count(*) n from private.business_votes where message_id=$1", [msg]))
      .rows[0].n,
    1,
  );
  await db.query(
    "update business_items set payload=jsonb_set(payload,'{poll,closesAt}', '\"2000-01-01T00:00:00Z\"') where id=$1",
    [msg],
  );
  await assert.rejects(
    call(employee, "poll_vote", { id: msg, version: 1, data: { choice: 0 } }),
    /POLL_CLOSED/,
  );
});
