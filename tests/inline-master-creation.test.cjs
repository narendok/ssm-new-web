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
  assert.match(indexContent, /canAddCustomer\s*=\s*\["sales",\s*"sal",\s*"admin"\]\.includes\(area\)/, "Customer creation restricted to Sales & Admin");
  assert.match(indexContent, /canAddSupplier\s*=\s*\["pur",\s*"admin"\]\.includes\(area\)/, "Supplier creation restricted to Purchasing & Admin");
  assert.match(indexContent, /canAddPart\s*=\s*\["ehw",\s*"esw",\s*"mech",\s*"pur",\s*"rnd",\s*"admin"\]\.includes\(area\)/, "Part creation restricted to Engineering/Purchasing & Admin");

  // Capability guards in SharedOperationalWorkspace.tsx
  assert.ok(sharedContent.includes('canAddSupplier = hasPermission(departmentForCode("PUR")?.id, "records:create")'), "Shared workspace gates supplier creation by configured Purchasing permission");
  assert.ok(sharedContent.includes('canAddPart = ["EHW", "FW", "SW", "MECH", "PUR", "RND"].includes(dept?.code || "") && canCreateRecords'), "Shared workspace gates part creation by the selected configured department");
  assert.ok(sharedContent.includes('data.customerOptions.length ? data.customerOptions : data.records') && sharedContent.includes('const customerDirectory'), "Customer search prefers the minimal canonical directory and retains only a visible-record fallback");
  assert.ok(sharedContent.includes('data.supplierOptions.length ? data.supplierOptions : data.records') && sharedContent.includes('const supplierDirectory'), "Supplier search prefers the minimal canonical directory and retains only a visible-record fallback");
  assert.ok(sharedContent.includes('customerDirectory\n        .filter(customer => isSelectableMasterStatus(customer.status))') && sharedContent.includes('supplierDirectory\n    .filter(supplier => isSelectableMasterStatus(supplier.status)'), "Customer and supplier selectors use the shared inactive-master status rule");
  assert.ok(sharedContent.includes('data.partOptions.length ? data.partOptions : data.records') && sharedContent.includes('data.productOptions.length ? data.productOptions : data.records'), "Part and Product pickers prefer minimal canonical directories and retain a visible-record fallback");
  assert.ok(sharedContent.includes('partDirectory.filter(part => isSelectableMasterStatus(part.status)).map') && sharedContent.includes('productDirectory.filter(product => isSelectableMasterStatus(product.status)).map'), "Part and Product selectors exclude inactive rows from canonical and fallback directories");
  assert.ok(sharedContent.includes('sharedMasterOptions(data.records, ["Project"])'), "Project ID picker contains project records only, not mixed Product records");
  assert.ok(sharedContent.includes('resolveSharedMasterFields(recordFields, data)'), "Editing an existing record uses the same canonical ID resolver as the shared read");
  assert.doesNotMatch(sharedContent, /\[customer\.id, customer\.reference, customer\.title\]|\[supplier\.id, supplier\.reference, supplier\.title\]|\[record\.id, record\.reference, record\.title\]/, "Existing links are never inferred from display titles");
  assert.ok(sharedContent.includes('customerId: id,') && sharedContent.includes('customer_id: id,'), "Customer selections keep the canonical master ID in current and legacy-compatible fields");
  assert.ok(sharedContent.includes('Department workspace') && sharedContent.includes('workspaceDepartmentIds.includes(preferredDepartment)'), "A multi-role member can switch only between assigned department workspaces");
  assert.ok(sharedContent.includes('canRequestReview ? async') && sharedContent.includes('canDecideGate ? async'), "RACI request and gate actions follow configured department permissions");

  // Shared workspace renders modals and binds canonical IDs with stable request identity
  assert.ok(sharedContent.includes("<InlineSupplierModal"), "SharedOperationalWorkspace renders InlineSupplierModal");
  assert.ok(sharedContent.includes("<InlinePartModal"), "SharedOperationalWorkspace renders InlinePartModal");
  assert.ok(sharedContent.includes("supplier.operationId"), "Shared workspace preserves stable supplier operationId on retry");
  assert.ok(sharedContent.includes("part.operationId"), "Shared workspace preserves stable part operationId on retry");
  assert.ok(sharedContent.includes("supplierId: createdId"), "SharedOperationalWorkspace binds canonical supplierId");
  assert.ok(sharedContent.includes("partId: createdId"), "SharedOperationalWorkspace binds canonical partId");
  assert.ok(sharedContent.includes("No canonical UUID was returned by the database"), "Shared workspace rejects missing returned ID");
});

test("RecordForm master values are selected from searchable managed options", () => {
  const indexContent = fs.readFileSync(path.resolve(__dirname, "../src/routes/index.tsx"), "utf8");
  assert.ok(indexContent.includes('import { SharedMasterSelect } from "@/components/SharedMasterSelect"'), "RecordForm uses the shared searchable master selector");
  assert.ok(indexContent.includes("options={options.map((option) => ({ value: option, label: option }))}"), "Customer, supplier, part and other master options come from the managed directory");
  assert.ok(indexContent.includes("value.trim().toLocaleLowerCase() === field(item.key).trim().toLocaleLowerCase()"), "Managed references must match an exact directory value rather than a fuzzy substring");
  assert.ok(!indexContent.includes("list={`${fieldId}-options`}"), "Master fields do not permit arbitrary datalist text");
  assert.ok(indexContent.includes('item.key === "projectId" && type !== "Project"'), "Linked project fields use one dedicated register selector");
  assert.match(indexContent, /projectRecords\.map\(\(record\)\s*=>\s*\(\{\s*value:\s*record\.reference,\s*label:\s*`\$\{record\.reference\} · \$\{record\.title\}`/, "Project links display code and title from the active project register");
  assert.match(indexContent, /label:\s*isPreProjectIntake\(type\)\s*\?\s*"New requirement — no project yet"\s*:\s*item\.required\s*\?\s*"Choose a project"\s*:\s*"No project linked"/, "Required records show a project prompt while intake and task records retain their valid no-project choices");
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
    "20261101023755_customer_requirement_change_workflow",
    "20261026090000_preproject_sales_intake",
    "20261026100000_atomic_sales_intake",
    "20261026110000_shared_document_registration",
    "20261027010000_shared_decision_log",
    "20261027155020_shared_chat_threads",
  ];

  for (const name of initialMigrations) {
    const file = path.join(root, "supabase/migrations", `${name}.sql`);
    await db.exec(fs.readFileSync(file, "utf8"));
  }
  await db.exec(
    fs.readFileSync(
      path.join(root, "supabase/migrations/20261106041141_allow_test_member_document_drafts.sql"),
      "utf8",
    ),
  );
  await db.exec(fs.readFileSync(path.join(root,"supabase/migrations/20261111162011_role_scoped_document_registration.sql"),"utf8"));
  await db.exec(fs.readFileSync(path.join(root,"supabase/migrations/20261111162044_shared_document_draft_snapshots.sql"),"utf8"));
  await db.exec(fs.readFileSync(path.join(root,"supabase/migrations/20261113044537_exact_document_project_link_aliases.sql"),"utf8"));

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
    [emp, "employee.ehw@example.com"],
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
  const employeeRole=(await db.query("INSERT INTO department_roles(organization_id,department_id,name,role_key) VALUES($1,$2,'TEST employee','test_employee') RETURNING id",[org,dEhw])).rows[0];
  await db.query("INSERT INTO department_role_assignments(role_id,member_id,assigned_by) VALUES($1,$2,$3)",[employeeRole.id,mids[emp],admin]);

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

  // Original chat UI now consumes actual shared messages, threads and poll votes.
  async function chatCall(user,action,data,key=crypto.randomUUID(),target){return asUser(user,async()=> (await db.query('SELECT mutate_business_workspace($1,$2::jsonb,$3) result',[action,JSON.stringify({...target,data}),key])).rows[0].result);}
  const chatChannel=(await chatCall(hwLead,'channel_create',{name:'TEST thread channel',memberIds:[mids[hwLead],mids[emp]]})).id;
  const otherChat=(await chatCall(purLead,'channel_create',{name:'Other channel',memberIds:[mids[purLead],mids[emp]]})).id;
  const chatKey=crypto.randomUUID(),chatData={channelId:chatChannel,text:'Synthetic urgent root',isUrgent:true};
  const rootMessage=(await chatCall(hwLead,'send_message',chatData,chatKey)).id;
  assert.equal((await chatCall(hwLead,'send_message',chatData,chatKey)).id,rootMessage);
  await assert.rejects(chatCall(hwLead,'send_message',{...chatData,isUrgent:false},chatKey),/RETRY_PAYLOAD_CHANGED/);
  const replyMessage=(await chatCall(emp,'send_message',{channelId:chatChannel,text:'Synthetic reply',replyToId:rootMessage})).id;
  const replyRow=(await db.query('SELECT payload FROM business_items WHERE id=$1',[replyMessage])).rows[0].payload;
  assert.equal(replyRow.replyToId,rootMessage);
  assert.equal((await db.query('SELECT payload FROM business_items WHERE id=$1',[rootMessage])).rows[0].payload.isUrgent,true);
  await assert.rejects(chatCall(emp,'send_message',{channelId:otherChat,text:'Wrong parent',replyToId:rootMessage}),/REPLY_PARENT_DENIED/);
  await assert.rejects(chatCall(emp,'send_message',{channelId:chatChannel,text:'Nested invalid parent',replyToId:replyMessage}),/REPLY_PARENT_DENIED/);
  await assert.rejects(chatCall(purLead,'send_message',{channelId:chatChannel,text:'Unauthorized'}),/CHANNEL_OR_MESSAGE_DENIED/);
  await assert.rejects(chatCall(hwLead,'send_message',{channelId:chatChannel,text:'Invalid urgency',isUrgent:'yes'}),/INVALID_URGENCY/);
  const pollId=(await chatCall(hwLead,'send_message',{channelId:chatChannel,text:'Choose',poll:{question:'Test poll',options:['A','B'],closesAt:new Date(Date.now()+3600000).toISOString()}})).id;
  await chatCall(emp,'poll_vote',{choice:0},crypto.randomUUID(),{id:pollId,version:1});
  await chatCall(emp,'poll_vote',{choice:1},crypto.randomUUID(),{id:pollId,version:1});
  assert.equal((await db.query('SELECT choice FROM private.business_votes WHERE message_id=$1',[pollId])).rows[0].choice,1);
  assert.equal((await db.query('SELECT count(*)::int n FROM private.business_votes WHERE message_id=$1',[pollId])).rows[0].n,1);
  await db.query("UPDATE business_items SET payload=jsonb_set(payload,'{poll,closesAt}',to_jsonb((now()-interval '1 hour')::text)) WHERE id=$1",[pollId]);
  await assert.rejects(chatCall(emp,'poll_vote',{choice:0},crypto.randomUUID(),{id:pollId,version:1}),/POLL_CLOSED_OR_UNAVAILABLE/);
  await db.query('UPDATE organization_members SET active=false WHERE id=$1',[mids[emp]]);
  await assert.rejects(chatCall(emp,'send_message',{channelId:chatChannel,text:'Inactive'}),/AUTHENTICATED_MEMBERSHIP_REQUIRED/);
  await db.query('UPDATE organization_members SET active=true WHERE id=$1',[mids[emp]]);
  const savedChannel=(await db.query('SELECT payload FROM business_items WHERE id=$1',[chatChannel])).rows[0].payload;
  await db.query("UPDATE business_items SET payload=jsonb_set(payload,'{memberIds}',$2::jsonb) WHERE id=$1",[chatChannel,JSON.stringify([mids[hwLead]])]);
  await assert.rejects(chatCall(emp,'send_message',{channelId:chatChannel,text:'Revoked'}),/CHANNEL_OR_MESSAGE_DENIED/);
  await db.query('UPDATE business_items SET payload=$2 WHERE id=$1',[chatChannel,JSON.stringify(savedChannel)]);

  // 1. Setup shared project for downstream orders
  const project = (
    await call(salLead, "create_project", {
      title: "Rugged Fleet Tracker Mass Production",
      reference: "HLPL-RFT-01",
    })
  ).id;
  assert.ok(project, "Project must be created");

  // Shared decision register: author identity, review authority and visibility are server-owned.
  const decisionAuthor=uuid(1401),decisionOther=uuid(1402),decisionClient=uuid(1403);
  for(const [id,role] of [[decisionAuthor,'member'],[decisionOther,'member'],[decisionClient,'viewer']]){
    await db.query('INSERT INTO auth.users VALUES($1,$2)',[id,`${id}@example.test`]);
    const member=(await db.query('INSERT INTO organization_members(organization_id,user_id,role,display_name) VALUES($1,$2,$3,$4) RETURNING id',[org,id,role,'Decision TEST user'])).rows[0].id;mids[id]=member;
    if(role==='member'){
      const r=(await db.query("INSERT INTO department_roles(organization_id,department_id,name,role_key) VALUES($1,$2,$3,$4) RETURNING id",[org,dEhw,`Decision ${id}`,id])).rows[0].id;
      await db.query('INSERT INTO department_role_assignments(role_id,member_id,assigned_by) VALUES($1,$2,$3)',[r,member,admin]);
    }
  }
  const decisionCall=(user,action,payload,key=crypto.randomUUID())=>asUser(user,async()=> (await db.query('SELECT mutate_shared_decision($1,$2::jsonb,$3) result',[action,JSON.stringify(payload),key])).rows[0].result);
  const readDecisions=user=>asUser(user,async()=> (await db.query('SELECT get_shared_decisions() result')).rows[0].result);
  const decisionPayload={title:'TEST shared exception',rationale:'Document the actual exception',scope:'common',departmentId:dQa,authorId:mids[admin],status:'Approved'},decisionKey=crypto.randomUUID();
  const savedDecision=await decisionCall(decisionAuthor,'create',decisionPayload,decisionKey);
  assert.equal((await decisionCall(decisionAuthor,'create',decisionPayload,decisionKey)).id,savedDecision.id);
  await assert.rejects(decisionCall(decisionAuthor,'create',{...decisionPayload,title:'Altered retry'},decisionKey),/REQUEST_ID_REUSED/);
  let decisionRow=(await db.query('SELECT * FROM decision_entries WHERE id=$1',[savedDecision.id])).rows[0];
  assert.equal(decisionRow.department_id,dEhw);assert.equal(decisionRow.author_id,mids[decisionAuthor]);assert.equal(decisionRow.status,'Pending lead review');
  assert.equal((await readDecisions(decisionOther)).entries.length,0);
  assert.equal((await readDecisions(qaLead)).entries.length,0);
  await assert.rejects(readDecisions(decisionClient),/DECISION_ACCESS_DENIED/);
  await assert.rejects(decisionCall(null,'create',decisionPayload),/DECISION_ACCESS_DENIED/);
  await assert.rejects(decisionCall(decisionAuthor,'create',{...decisionPayload,projectId:project}),/COMMON_DECISION_HAS_NO_PROJECT_STAGE/);
  await assert.rejects(decisionCall(decisionAuthor,'create',{...decisionPayload,scope:'client',projectId:crypto.randomUUID(),stage:'Stage 2'}),/DECISION_PROJECT_REQUIRED/);
  await assert.rejects(decisionCall(qaLead,'approve',{id:savedDecision.id,expectedVersion:1}),/DECISION_REVIEW_DENIED/);
  await assert.rejects(decisionCall(hwLead,'visibility',{departmentId:dEhw,viewerDepartmentId:dQa,enabled:true}),/DECISION_VISIBILITY_ADMIN_REQUIRED/);
  await decisionCall(admin,'visibility',{departmentId:dEhw,viewerDepartmentId:dQa,enabled:true});
  assert.equal((await readDecisions(qaLead)).entries[0].id,savedDecision.id);
  await assert.rejects(decisionCall(qaLead,'approve',{id:savedDecision.id,expectedVersion:1}),/DECISION_REVIEW_DENIED/);
  await decisionCall(admin,'visibility',{departmentId:dEhw,viewerDepartmentId:dQa,enabled:false});
  assert.equal((await readDecisions(qaLead)).entries.length,0);
  await db.query("UPDATE organization_members SET role='department_lead' WHERE id=$1",[mids[decisionAuthor]]);
  await assert.rejects(decisionCall(decisionAuthor,'approve',{id:savedDecision.id,expectedVersion:1}),/DECISION_SELF_APPROVAL_DENIED/);
  await db.query("UPDATE organization_members SET role='member' WHERE id=$1",[mids[decisionAuthor]]);
  await assert.rejects(decisionCall(hwLead,'approve',{id:savedDecision.id,expectedVersion:99}),/STALE_DECISION/);
  await decisionCall(hwLead,'approve',{id:savedDecision.id,expectedVersion:1});
  decisionRow=(await db.query('SELECT * FROM decision_entries WHERE id=$1',[savedDecision.id])).rows[0];assert.equal(decisionRow.status,'Approved');assert.equal(decisionRow.reviewed_by,mids[hwLead]);
  await assert.rejects(asUser(decisionAuthor,()=>db.query("UPDATE decision_entries SET status='Approved' WHERE id=$1",[savedDecision.id])),/permission denied/);
  assert.equal((await asUser(decisionOther,()=>db.query('SELECT id FROM decision_entries'))).rows.length,0,'Direct table access obeys own-submission RLS');
  const projectDecision=await decisionCall(decisionAuthor,'create',{title:'Project exception',rationale:'Review a project exception',scope:'client',projectId:project,stage:'Stage 2: Feasibility & Contract Review'});
  await assert.rejects(decisionCall(hwLead,'reject',{id:projectDecision.id,expectedVersion:1,reason:''}),/REJECTION_REASON_REQUIRED/);
  await decisionCall(hwLead,'reject',{id:projectDecision.id,expectedVersion:1,reason:'Evidence needs correction'});
  assert.equal((await db.query('SELECT status FROM decision_entries WHERE id=$1',[projectDecision.id])).rows[0].status,'Rejected');
  await db.query('UPDATE organization_members SET active=false WHERE id=$1',[mids[decisionAuthor]]);
  await assert.rejects(readDecisions(decisionAuthor),/DECISION_ACCESS_DENIED/);
  await db.query('UPDATE organization_members SET active=true WHERE id=$1',[mids[decisionAuthor]]);
  assert.equal((await db.query("SELECT has_function_privilege('anon','public.mutate_shared_decision(text,jsonb,uuid)','EXECUTE') allowed")).rows[0].allowed,false);

  const registerDoc=(user,payload,key=crypto.randomUUID())=>asUser(user,async()=> (await db.query('SELECT register_controlled_document($1::jsonb,$2) result',[JSON.stringify(payload),key])).rows[0].result);
  const docPayload={title:'TEST Gerber source',documentType:'Gerber ZIP',scope:'client',departmentId:dEhw,projectId:project};
  const docKey=crypto.randomUUID(),gerber=await registerDoc(hwLead,docPayload,docKey);
  assert.equal((await registerDoc(hwLead,docPayload,docKey)).id,gerber.id);
  await assert.rejects(registerDoc(hwLead,{...docPayload,title:'Changed retry'},docKey),/REQUEST_ID_REUSED/);
  const generatedSnapshot={templateType:'BOM',templateVersion:'2026-10-19.2',catalogueFamilyId:'D11',sourceRecordId:null,projectRecordId:project,releaseStatus:'Unissued',completionPercentage:0,missingFields:['lineItems','mpn'],sections:[{title:'Controlled bill of materials',rows:[['lineItems','TBD — owner confirmation required','No source provided']]}]};
  const employeeDoc=await registerDoc(emp,{title:'Employee project attachment',documentType:'Technical document',scope:'internal',projectId:project,draftSnapshot:generatedSnapshot});
  assert.equal(employeeDoc.status,'Draft');
  const employeeDocRow=(await db.query('SELECT department_id,record_id,metadata FROM documents WHERE id=$1',[employeeDoc.id])).rows[0];
  assert.equal(employeeDocRow.department_id,dEhw);assert.equal(employeeDocRow.record_id,project);assert.equal(employeeDocRow.metadata.status,'Draft');
  assert.equal(employeeDocRow.metadata.draftSnapshot.templateType,'BOM');assert.equal(employeeDocRow.metadata.draftSnapshot.releaseStatus,'Unissued');
  const aliasSource=(await call(hwLead,"create_record",{
    title:"TEST alias-linked schematic",reference:"HLPL-RFT-EHW-SCH-ALIAS",record_type:"Schematic",project_id:project,
    fields:{revision:"01",stage:"HW_01"},
  })).id;
  await db.query("UPDATE operational_records SET fields=$2::jsonb WHERE id=$1",[aliasSource,JSON.stringify({revision:"01",stage:"HW_01",project_id:project,projectCode:"HLPL-RFT-01"})]);
  const aliasDoc=await registerDoc(hwLead,{...docPayload,title:"TEST document from project aliases",recordId:aliasSource});
  assert.equal((await db.query("SELECT record_id FROM documents WHERE id=$1",[aliasDoc.id])).rows[0].record_id,aliasSource,
    "an exact project_id plus matching projectCode is accepted as the same linked project");
  await db.query("UPDATE operational_records SET fields=$2::jsonb WHERE id=$1",[aliasSource,JSON.stringify({revision:"01",stage:"HW_01",project_id:project,projectCode:"HLPL-VAULT-OTHER-01"})]);
  await assert.rejects(registerDoc(hwLead,{...docPayload,title:"TEST conflicting project aliases",recordId:aliasSource}),/DOCUMENT_SOURCE_PROJECT_MISMATCH/);
  await assert.rejects(registerDoc(hwLead,{...docPayload,title:"TEST project-linked source in common scope",scope:"common",projectId:undefined,recordId:aliasSource}),/DOCUMENT_NONPROJECT_SCOPE/);
  await assert.rejects(registerDoc(emp,{title:'Invalid released snapshot',documentType:'Technical document',scope:'internal',projectId:project,draftSnapshot:{...generatedSnapshot,releaseStatus:'Released'}}),/DOCUMENT_DRAFT_SNAPSHOT_INVALID/);
  await assert.rejects(registerDoc(emp,{title:'Snapshot without release status',documentType:'Technical document',scope:'internal',projectId:project,draftSnapshot:{...generatedSnapshot,releaseStatus:undefined}}),/DOCUMENT_DRAFT_SNAPSHOT_INVALID/);
  await assert.rejects(registerDoc(emp,{title:'Snapshot bound to another project',documentType:'Technical document',scope:'internal',projectId:project,draftSnapshot:{...generatedSnapshot,projectRecordId:crypto.randomUUID()}}),/DOCUMENT_DRAFT_SNAPSHOT_INVALID/);
  const employeeScopedDoc=await registerDoc(emp,{...docPayload,departmentId:dQa,title:'Employee scoped to own department'});
  assert.equal((await db.query('SELECT department_id FROM documents WHERE id=$1',[employeeScopedDoc.id])).rows[0].department_id,dEhw,
    'member input cannot route a document outside its assigned department');
  await assert.rejects(registerDoc(null,docPayload),/DOCUMENT_REGISTER_DENIED/);
  const secondaryRole=(await db.query("INSERT INTO department_roles(organization_id,department_id,name,role_key) VALUES($1,$2,'TEST QA document role','test_qa_documents') RETURNING id",[org,dQa])).rows[0].id;
  await db.query("INSERT INTO department_role_assignments(role_id,member_id,assigned_by) VALUES($1,$2,$3)",[secondaryRole,mids[emp],admin]);
  const limitedRoleDoc=await registerDoc(emp,{title:'Unpermitted secondary department draft',documentType:'Technical document',scope:'common',departmentId:dQa});
  assert.equal((await db.query('SELECT department_id FROM documents WHERE id=$1',[limitedRoleDoc.id])).rows[0].department_id,dEhw,
    'a role assignment without documents:manage cannot redirect the write outside the primary department');
  await db.query("INSERT INTO role_permissions(role_id,permission_key,allowed) VALUES($1,'documents:manage',true)",[secondaryRole]);
  assert.equal((await asUser(emp,()=>db.query("SELECT public.has_department_permission($1,$2,'documents:manage') allowed",[org,dQa]))).rows[0].allowed,true);
  const secondaryDoc=await registerDoc(emp,{title:'TEST secondary department draft',documentType:'Technical document',scope:'common',departmentId:dQa});
  assert.equal((await db.query('SELECT department_id FROM documents WHERE id=$1',[secondaryDoc.id])).rows[0].department_id,dQa,
    'an explicitly configured secondary department role can register a document in that department');
  await assert.rejects(registerDoc(hwLead,{...docPayload,scope:'common',projectId:undefined,recordId:project}),/DOCUMENT_NONPROJECT_SCOPE/);
  await assert.rejects(registerDoc(hwLead,{...docPayload,projectId:crypto.randomUUID()}),/DOCUMENT_PROJECT_REQUIRED/);
  const commonDoc=await registerDoc(hwLead,{title:'TEST common procedure',documentType:'Policy / procedure',scope:'common',departmentId:dQa,status:'Approved',visibility:'client'});
  const commonRow=(await db.query('SELECT * FROM documents WHERE id=$1',[commonDoc.id])).rows[0];
  assert.equal(commonRow.department_id,dEhw);assert.equal(commonRow.record_id,null);assert.equal(commonRow.metadata.status,'Draft');assert.equal(commonRow.visibility,'internal');
  const fileId=crypto.randomUUID(),storagePath=`${org}/${dEhw}/${gerber.id}/01/test.zip`;
  await db.query("INSERT INTO controlled_document_files(id,organization_id,department_id,document_id,revision,storage_path,original_name,content_type,size_bytes,checksum,uploaded_by) VALUES($1,$2,$3,$4,'01',$5,'test.zip','application/zip',4,$6,$7)",[fileId,org,dEhw,gerber.id,storagePath,'a'.repeat(64),hwLead]);
  await assert.rejects(registerDoc(hwLead,{...docPayload,title:'Panel',documentType:'Panel ZIP',sourceFileId:fileId}),/GERBER_SOURCE_UPLOAD_INCOMPLETE/);
  await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('controlled-documents',$1)",[storagePath]);
  const panel=await registerDoc(hwLead,{...docPayload,title:'Panel',documentType:'Panel ZIP',sourceFileId:fileId});
  const panelMeta=(await db.query('SELECT metadata FROM documents WHERE id=$1',[panel.id])).rows[0].metadata;
  assert.equal(panelMeta.sourceFileId,fileId);assert.equal(panelMeta.sourceRevision,'01');assert.equal(panelMeta.sourceChecksum,'a'.repeat(64));
  const access=user=>asUser(user,()=>db.query('SELECT * FROM get_controlled_file_access($1)',[fileId]));
  assert.equal((await access(hwLead)).rows[0].file_id,fileId);
  assert.equal((await access(admin)).rows[0].file_id,fileId);
  await assert.rejects(access(qaLead),/FILE_ACCESS_DENIED/);
  await assert.rejects(access(emp),/FILE_ACCESS_DENIED/);
  await assert.rejects(access(null),/AUTH_REQUIRED/);
  await db.query('UPDATE organization_members SET active=false WHERE id=$1',[mids[hwLead]]);
  await assert.rejects(access(hwLead),/FILE_ACCESS_DENIED/);
  await db.query('UPDATE organization_members SET active=true WHERE id=$1',[mids[hwLead]]);
  const otherProject=(await call(salLead,'create_project',{title:'Other Vault project',reference:'HLPL-VAULT-OTHER-01'})).id;
  await assert.rejects(registerDoc(hwLead,{...docPayload,projectId:otherProject,title:'Wrong project panel',documentType:'Panel ZIP',sourceFileId:fileId}),/GERBER_SOURCE_PROJECT_OR_TYPE_MISMATCH/);

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
  assert.equal(f.acceptedUnits, 150, "S06: 150 internal QA pass placeholders in the TEST fixture");
  assert.equal(f.heldUnits, 5, "S06: 5 held units");
  assert.equal(f.pendingInspectionUnits, 45, "S06: 45 pending inspection units");
  assert.equal(f.acceptedUnits + f.heldUnits + f.pendingInspectionUnits, f.lotQuantity, "150 + 5 + 45 === 200 simulated lot units");
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
  assert.equal(coverage,91,"All current catalogue entries, including the QA Certificate record, exercised");

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
  pre=await sheetCall(salLead,"revise",{sheetId:pre.id,expectedVersion:pre.version,reason:"Seed a real departmental review for the change approval regression."});
  pre=await sheetCall(hwLead,"respond",{sheetId:pre.id,expectedVersion:pre.version,parameterId:"system_voltage",department:"EHW",status:"Feasible",remarks:"Synthetic hardware baseline reviewed."});
  pre=await sheetCall(hwLead,"review_response",{sheetId:pre.id,expectedVersion:pre.version,parameterId:"system_voltage",department:"EHW"});
  pre=await sheetCall(admin,"approve",{sheetId:pre.id,expectedVersion:pre.version});assert.equal(pre.status,"Approved");
  await assert.rejects(sheetCall(salLead,"input",{sheetId:pre.id,expectedVersion:pre.version,parameterId:"system_voltage",input:"Unauthorized baseline rewrite"}),/INPUT_BASELINE_LOCKED/);

  async function changeCall(user, action, payload, operationId = crypto.randomUUID()) {
    return asUser(user, async () => (
      await db.query(
        "SELECT mutate_customer_change_request($1, $2::jsonb, $3::uuid) result",
        [action, JSON.stringify(payload), operationId]
      )
    ).rows[0].result);
  }
  async function changeRead(user, projectId = null) {
    return asUser(user, async () => (
      await db.query("SELECT get_customer_change_requests($1::uuid) result", [projectId])
    ).rows[0].result);
  }
  const impactScope = {
    tracks: ["hardware"],
    stages: ["Stage 2"],
    documents: ["TEST-DOC-01"],
    bom: ["TEST-BOM-01"],
    reusableAssets: ["TEST-ASSET-01"],
  };
  const makeChangePayload = (sheetSnapshot, projectId, title = "Synthetic requirements change") => {
    const proposedValues = JSON.parse(JSON.stringify(sheetSnapshot.parameter_values));
    proposedValues.system_voltage.input = "Synthetic 24 V requirement";
    return {
      projectId,
      sheetId: sheetSnapshot.id,
      expectedSheetVersion: sheetSnapshot.version,
      expectedSheetRevision: sheetSnapshot.revision,
      title,
      customerReference: "TEST-CHANGE-01",
      description: "Synthetic request to change the system voltage requirement.",
      rationale: "Isolated regression test; not a customer record.",
      proposedValues,
      impacts: [
        { departmentCode: "EHW", scope: impactScope },
        { departmentCode: "PUR", scope: { ...impactScope, tracks: [], bom: ["TEST-BOM-02"] } },
      ],
    };
  };
  let changePayload = makeChangePayload(pre, accepted.id);
  const staleSheetPayload = { ...changePayload, expectedSheetVersion: pre.version - 1 };
  await assert.rejects(
    changeCall(salLead, "create", staleSheetPayload),
    /CUSTOMER_CHANGE_STALE_BASELINE/
  );
  await assert.rejects(
    changeCall(emp, "create", changePayload),
    /CUSTOMER_CHANGE_CREATE_DENIED/
  );
  const createOperation = crypto.randomUUID();
  let change = await changeCall(salLead, "create", changePayload, createOperation);
  assert.equal(change.status, "Draft");
  assert.equal(change.requested_by, mids[salLead], "requester is derived from authenticated membership");
  assert.equal(change.baseline_revision, pre.revision);
  assert.deepEqual(change.before_values.system_voltage, pre.parameter_values.system_voltage);
  await assert.rejects(
    changeRead(client, accepted.id),
    /CUSTOMER_CHANGE_ACCESS_DENIED/,
    "viewer/client membership cannot read customer-change requests"
  );
  await assert.rejects(
    changeCall(client, "submit", { requestId: change.id, expectedVersion: change.version }),
    /CUSTOMER_CHANGE_WRITE_DENIED/,
    "viewer/client membership cannot mutate customer-change requests"
  );
  assert.equal((await changeCall(salLead, "create", changePayload, createOperation)).id, change.id, "create retry is idempotent");
  await assert.rejects(
    changeCall(salLead, "create", { ...changePayload, title: "Changed retry payload" }, createOperation),
    /CUSTOMER_CHANGE_RETRY_PAYLOAD_CHANGED/
  );
  await assert.rejects(
    asUser(qaLead, () => db.query("SELECT * FROM customer_change_requests")),
    /permission denied/
  );
  const hardwareRead = await changeRead(hwLead, accepted.id);
  const hardwareRequest = hardwareRead.requests.find((request) => request.id === change.id);
  assert.equal(hardwareRequest.impacts.length, 1, "department reviewer sees only its own assignment");
  assert.equal(hardwareRequest.impacts[0].department_code, "EHW");
  assert.deepEqual(hardwareRequest.events, [], "department reviewer does not see requester/admin event details");
  const notAssigned = await changeRead(qaLead, accepted.id);
  assert.equal(notAssigned.requests.some((request) => request.id === change.id), false, "unassigned department cannot read the request");
  await assert.rejects(
    changeCall(qaLead, "assess_impact", {
      requestId: change.id, expectedVersion: change.version, expectedImpactVersion: 1,
      outcome: "No impact", assessment: "No impact found in this test.",
    }),
    /CUSTOMER_CHANGE_ACCESS_DENIED/
  );
  await assert.rejects(
    changeCall(salLead, "submit", { requestId: change.id, expectedVersion: change.version + 1 }),
    /CUSTOMER_CHANGE_STALE_VERSION/
  );
  change = await changeCall(salLead, "submit", { requestId: change.id, expectedVersion: change.version });
  assert.equal(change.status, "Impact review");
  await assert.rejects(
    changeCall(hwLead, "assess_impact", {
      requestId: change.id, expectedVersion: change.version, expectedImpactVersion: 99,
      outcome: "Impact identified", assessment: "Stale department impact version.",
    }),
    /CUSTOMER_CHANGE_STALE_IMPACT/
  );
  change = await changeCall(hwLead, "assess_impact", {
    requestId: change.id, expectedVersion: change.version, expectedImpactVersion: 1,
    outcome: "Impact identified", assessment: "Hardware requirement delta assessed.",
  });
  assert.equal(change.status, "Impact review", "request waits for each assigned department");
  const staleDepartmentDecision = change.version - 1;
  await assert.rejects(
    changeCall(purLead, "assess_impact", {
      requestId: change.id, expectedVersion: staleDepartmentDecision, expectedImpactVersion: 1,
      outcome: "Impact identified", assessment: "Purchasing impact assessed.",
    }),
    /CUSTOMER_CHANGE_STALE_VERSION/
  );
  change = await changeCall(purLead, "assess_impact", {
    requestId: change.id, expectedVersion: change.version, expectedImpactVersion: 1,
    outcome: "Impact identified", assessment: "Purchasing impact assessed.",
  });
  assert.equal(change.status, "Pending approval");
  change = await changeCall(admin, "decide", {
    requestId: change.id, expectedVersion: change.version,
    decision: "return", notes: "Clarify the proposed implementation before approval.",
  });
  assert.equal(change.status, "Returned");
  changePayload = makeChangePayload(pre, accepted.id, "Synthetic requirements change after rework");
  change = await changeCall(salLead, "update_draft", {
    ...changePayload, requestId: change.id, expectedVersion: change.version,
  });
  assert.equal(change.status, "Draft");
  assert.equal(change.before_values.system_voltage.input, pre.parameter_values.system_voltage.input, "rework preserves the original approved baseline snapshot");
  change = await changeCall(salLead, "submit", { requestId: change.id, expectedVersion: change.version });
  change = await changeCall(hwLead, "assess_impact", {
    requestId: change.id, expectedVersion: change.version, expectedImpactVersion: 1,
    outcome: "Return for rework", assessment: "Hardware evidence needs a clearer test reference.",
  });
  assert.equal(change.status, "Returned", "department impact review can route for rework");
  changePayload = makeChangePayload(pre, accepted.id, "Synthetic requirements change after second rework");
  change = await changeCall(salLead, "update_draft", {
    ...changePayload, requestId: change.id, expectedVersion: change.version,
  });
  change = await changeCall(salLead, "submit", { requestId: change.id, expectedVersion: change.version });
  change = await changeCall(hwLead, "assess_impact", {
    requestId: change.id, expectedVersion: change.version, expectedImpactVersion: 1,
    outcome: "Impact identified", assessment: "Hardware requirement delta assessed.",
  });
  change = await changeCall(purLead, "assess_impact", {
    requestId: change.id, expectedVersion: change.version, expectedImpactVersion: 1,
    outcome: "No impact", assessment: "No purchasing impact for this synthetic change.",
  });
  const requesterCreated = await changeCall(admin, "create", makeChangePayload(pre, accepted.id, "Admin requester cannot self-approve"));
  let adminRequest = await changeCall(admin, "submit", {
    requestId: requesterCreated.id, expectedVersion: requesterCreated.version,
  });
  adminRequest = await changeCall(hwLead, "assess_impact", {
    requestId: adminRequest.id, expectedVersion: adminRequest.version, expectedImpactVersion: 1,
    outcome: "Impact identified", assessment: "Hardware impact assessed for self-approval guard.",
  });
  adminRequest = await changeCall(purLead, "assess_impact", {
    requestId: adminRequest.id, expectedVersion: adminRequest.version, expectedImpactVersion: 1,
    outcome: "No impact", assessment: "No purchasing impact in self-approval guard.",
  });
  await assert.rejects(
    changeCall(admin, "decide", {
      requestId: adminRequest.id, expectedVersion: adminRequest.version,
      decision: "approve", notes: "Self approval must be denied.",
    }),
    /CUSTOMER_CHANGE_DECISION_DENIED/
  );
  change = await changeCall(admin, "decide", {
    requestId: change.id, expectedVersion: change.version,
    decision: "approve", notes: "Synthetic impact reviews complete; approve revision.",
  });
  assert.equal(change.status, "Approved");
  assert.equal(change.approved_revision, pre.revision + 1);
  pre = (await db.query("SELECT * FROM project_input_sheets WHERE id=$1", [pre.id])).rows[0];
  assert.equal(pre.status, "Draft", "approval atomically opens the next canonical input revision");
  assert.equal(pre.revision, change.approved_revision);
  assert.equal(pre.parameter_values.system_voltage.input, "Synthetic 24 V requirement");
  assert.equal(pre.parameter_values.system_voltage.responses.EHW.reviewedBy, "", "approval invalidates prior departmental confirmations");
  const approvalEvent = (await db.query(
    "SELECT details FROM project_input_events WHERE sheet_id=$1 AND action='customer_change_approved' ORDER BY created_at DESC LIMIT 1",
    [pre.id]
  )).rows[0];
  assert.equal(approvalEvent.details.requestId, change.id);
  assert.equal(approvalEvent.details.previousRevision, change.baseline_revision);
  assert.equal(
    approvalEvent.details.baseline.system_voltage.input,
    change.before_values.system_voltage.input,
    "approval history retains the pre-change baseline, not the newly applied values"
  );
  const changeSnapshot = await changeRead(salLead, accepted.id);
  const contractModule = { exports: {} };
  const contractSource = fs.readFileSync(path.join(root, "src/lib/customer-change.schema.ts"), "utf8");
  const contractJs = ts.transpileModule(contractSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function("require", "module", "exports", contractJs)(
    require,
    contractModule,
    contractModule.exports
  );
  const decodedSnapshot = contractModule.exports.customerChangeSnapshotSchema.parse(changeSnapshot);
  const savedChange = decodedSnapshot.requests.find((request) => request.id === change.id);
  assert.equal(savedChange.events.at(-1).action, "approved");
  assert.equal(savedChange.impacts.length, 2);
  assert.equal(savedChange.impacts.find((impact) => impact.department_code === "EHW").outcome, "Impact identified");
  await assert.rejects(
    db.query("UPDATE customer_change_events SET details='{}'::jsonb WHERE request_id=$1", [change.id]),
    /CUSTOMER_CHANGE_AUDIT_IMMUTABLE/
  );
  pre = await sheetCall(admin, "approve", { sheetId: pre.id, expectedVersion: pre.version });
  const rejectedPayload = makeChangePayload(pre, accepted.id, "Synthetic request to verify rejection");
  rejectedPayload.proposedValues.system_voltage.input = "Synthetic 36 V requirement";
  let rejected = await changeCall(salLead, "create", rejectedPayload);
  rejected = await changeCall(salLead, "submit", { requestId: rejected.id, expectedVersion: rejected.version });
  rejected = await changeCall(hwLead, "assess_impact", {
    requestId: rejected.id, expectedVersion: rejected.version, expectedImpactVersion: 1,
    outcome: "Impact identified", assessment: "Hardware impact assessed before rejection.",
  });
  rejected = await changeCall(purLead, "assess_impact", {
    requestId: rejected.id, expectedVersion: rejected.version, expectedImpactVersion: 1,
    outcome: "No impact", assessment: "No purchasing impact before rejection.",
  });
  const unchangedRevision = pre.revision;
  rejected = await changeCall(admin, "decide", {
    requestId: rejected.id, expectedVersion: rejected.version,
    decision: "reject", notes: "Synthetic request rejected for test coverage.",
  });
  assert.equal(rejected.status, "Rejected");
  assert.equal((await db.query("SELECT revision FROM project_input_sheets WHERE id=$1", [pre.id])).rows[0].revision, unchangedRevision, "rejected request does not alter the canonical baseline");
  const stalePayload = makeChangePayload({
    ...pre, status: "Approved", version: pre.version, revision: pre.revision,
  }, accepted.id, "Stale baseline request");
  stalePayload.proposedValues.system_voltage.input = "Synthetic 48 V requirement";
  const staleDraft = await changeCall(salLead, "create", stalePayload);
  const revised = await sheetCall(salLead, "revise", {
    sheetId: pre.id, expectedVersion: pre.version, reason: "Synthetic input changed after the request was opened.",
  });
  await assert.rejects(
    changeCall(salLead, "submit", { requestId: staleDraft.id, expectedVersion: staleDraft.version }),
    /CUSTOMER_CHANGE_STALE_BASELINE/
  );
  assert.equal(revised.revision, pre.revision + 1);

  // Dispatch and its generated work use the same saved responsibility/task definition.
  await db.exec('CREATE TABLE IF NOT EXISTS storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint)');
  for(const migration of ['20261028120000_lifecycle_and_sample_pack_sync','20261028120001_canonical_stage_completion_reviews','20261028120002_preserve_legacy_lifecycle_boundary','20261029120000_restore_preproject_sales_intake','20261103235542_versioned_lifecycle_and_asset_reuse','20261104002046_shared_test_original_storage','20261104043746_reviewed_project_lifecycle_configuration','20261106130248_stage_raci_execution_contract','20261107100003_settings_driven_feasibility_dispatch'])
    await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',migration+'.sql'),'utf8'));
  const settingsV1={id:'TEST-FEASIBILITY-RACI-v1',createdAt:'2026-11-07T00:00:00Z',stages:[{code:'CM_02',name:'Configured feasibility',phase:'TG_0',gate:'Intake review',department:'EHW',prerequisites:[],exitTypes:[],optional:false,raci:{R:['EHW'],A:['SAL'],C:['QA'],I:['PUR']},tasks:[{id:'F01',title:'Configured technical assessment',description:'Synthetic test scope',department:'EHW'},{id:'F02',title:'Configured dependency review',description:'Synthetic test dependencies',department:'EHW'}]}]};
  const publishSettings=async(definition,expectedRevision)=>(await asUser(admin,()=>db.query("SELECT public.mutate_lifecycle_workspace('save_revision',$1::jsonb,$2) result",[JSON.stringify({definition,expectedRevision}),crypto.randomUUID()]))).rows[0].result;
  const settingsSave=await publishSettings(settingsV1,null);
  const dispatchRequest=crypto.randomUUID();
  const configuredPayload={mode:'opportunity',title:'Settings-bound feasibility fixture',scopeSummary:'Synthetic RACI dispatch test only',dispatchFeasibility:true,feasibilityDepts:['QA'],feasibilityRaciRevision:settingsV1.id};
  const configuredDispatch=await salesCall(salLead,configuredPayload,dispatchRequest);
  assert.equal(configuredDispatch.reviewCount,1);
  const dispatched=(await db.query('SELECT * FROM operational_records WHERE id=$1',[configuredDispatch.id])).rows[0];
  assert.equal(dispatched.fields.requiredDepartments,'EHW');
  assert.deepEqual(dispatched.fields.feasibilityRaci,settingsV1.stages[0].raci);
  const generated=(await db.query('SELECT * FROM tasks WHERE record_id=$1',[configuredDispatch.id])).rows;
  assert.equal(generated.length,2);
  assert.ok(generated.every(task=>task.department_id===dEhw && task.template_task_key.startsWith('FEASIBILITY:TEST-FEASIBILITY-RACI-v1:')));
  assert.ok(generated.some(task=>task.title.startsWith('Configured dependency review')));
  const configuredApproval=(await db.query('SELECT * FROM approvals WHERE record_id=$1',[configuredDispatch.id])).rows[0];
  await assert.rejects(()=>call(hwLead,'decide_approval',{id:configuredApproval.id,outcome:'approved',expected_updated_at:configuredApproval.updated_at}),/CONFIGURED_FEASIBILITY_WORK_INCOMPLETE/);
  for(const task of generated)await call(hwLead,'update_task',{id:task.id,status:'Complete',expected_updated_at:task.updated_at});
  await call(hwLead,'decide_approval',{id:configuredApproval.id,outcome:'approved',expected_updated_at:configuredApproval.updated_at,notes:'Synthetic fixture tasks checked'});
  const settingsV2=structuredClone(settingsV1);settingsV2.id='TEST-FEASIBILITY-RACI-v2';settingsV2.stages[0].department='QA';settingsV2.stages[0].raci.R=['QA'];for(const task of settingsV2.stages[0].tasks)task.department='QA';
  await publishSettings(settingsV2,settingsSave.id);
  assert.equal((await salesCall(salLead,configuredPayload,dispatchRequest)).id,configuredDispatch.id,'Retry retains its original settings and does not duplicate work');
  assert.equal((await db.query('SELECT count(*)::int n FROM tasks WHERE record_id=$1',[configuredDispatch.id])).rows[0].n,2);
  await assert.rejects(()=>salesCall(salLead,{...configuredPayload,title:'Stale settings preview'}),/FEASIBILITY_SETTINGS_CHANGED/);
  const nextDispatch=await salesCall(salLead,{...configuredPayload,title:'Updated settings fixture',feasibilityRaciRevision:settingsV2.id});
  assert.equal((await db.query('SELECT fields FROM operational_records WHERE id=$1',[nextDispatch.id])).rows[0].fields.requiredDepartments,'QA');
  assert.equal((await db.query('SELECT fields FROM operational_records WHERE id=$1',[configuredDispatch.id])).rows[0].fields.feasibilityRaciRevision,settingsV1.id);

});
