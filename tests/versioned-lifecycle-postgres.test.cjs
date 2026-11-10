const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");

const root = path.resolve(__dirname, "..");
const uuid = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("Versioned lifecycle settings and reusable assets enforce TEST authorization, pinning and replay", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());

  // Setup base mock auth schema
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO authenticated, anon, service_role;
    CREATE SCHEMA storage;
    CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(), bucket_id text, name text); CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint);
    CREATE PUBLICATION supabase_realtime;
  `);

  // Load migrations up to our forward migration
  const migrationNames = [
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
    "20261025110000_saved_lifecycle_disposition",
    "20261025091500_harden_downstream_master_guards",
    "20261028120000_lifecycle_and_sample_pack_sync",
    "20261028120001_canonical_stage_completion_reviews",
    "20261028120002_preserve_legacy_lifecycle_boundary",
    "20261029120000_restore_preproject_sales_intake",
    "20261103120000_decide_shared_test_track_after_feasibility",
    "20261104010000_versioned_lifecycle_and_asset_reuse",
    "20261106001444_admin_reset_shared_test_sample_pack",
  ];

  for (const name of migrationNames) {
    const file = path.join(root, "supabase/migrations", `${name}.sql`);
    if (fs.existsSync(file)) {
      await db.exec(fs.readFileSync(file, "utf8"));
    }
  }

  // Seed organization & members
  const admin = uuid(1);
  const ehwLead = uuid(2);
  const purLead = uuid(3);
  const employee = uuid(4);
  const viewer = uuid(5);
  const salLead = uuid(6);
  const org = uuid(10);
  const dEhw = uuid(11);
  const dPur = uuid(12);
  const dSal = uuid(13);

  for (const [id, email] of [
    [admin, "admin@example.com"],
    [ehwLead, "ehw@example.com"],
    [purLead, "pur@example.com"],
    [employee, "employee.ehw@example.com"],
    [viewer, "viewer@example.com"],
    [salLead, "sal@example.com"],
  ]) {
    await db.query("INSERT INTO auth.users VALUES($1,$2)", [id, email]);
  }

  await db.query(
    "INSERT INTO organizations(id, name, main_location, created_by) VALUES($1, 'TEST ONLY · SSM-new1 synthetic workspace', 'Synthetic', $2)",
    [org, admin],
  );

  const mids = {};
  mids[admin] = (
    await db.query("SELECT id FROM organization_members WHERE user_id=$1", [admin])
  ).rows[0].id;

  for (const [id, role] of [
    [ehwLead, "department_lead"],
    [purLead, "department_lead"],
    [salLead, "department_lead"],
    [employee, "member"],
    [viewer, "viewer"],
  ]) {
    mids[id] = (
      await db.query(
        "INSERT INTO organization_members(organization_id, user_id, role, display_name) VALUES($1,$2,$3::text::app_role,$3::text) RETURNING id",
        [org, id, role],
      )
    ).rows[0].id;
  }

  for (const [id, code, lead] of [
    [dEhw, "EHW", ehwLead],
    [dPur, "PUR", purLead],
    [dSal, "SAL", salLead],
  ]) {
    await db.query(
      "INSERT INTO departments(id, organization_id, name, department_type, code, lead_member_id) VALUES($1,$2,$3,$3,$3,$4)",
      [id, org, code, mids[lead]],
    );
  }
  const dClient = uuid(14);
  const dInactive = uuid(15);
  const dNoLead = uuid(16);
  await db.query(
    "INSERT INTO departments(id, organization_id, name, department_type, code, lead_member_id, active) VALUES($1,$2,$3,$3,$4,$5,$6)",
    [dClient, org, "Client", "CLIENT", mids[salLead], true],
  );
  await db.query(
    "INSERT INTO departments(id, organization_id, name, department_type, code, lead_member_id, active) VALUES($1,$2,$3,$3,$4,$5,$6)",
    [dInactive, org, "Inactive QA", "INACTIVE_QA", mids[ehwLead], false],
  );
  await db.query(
    "INSERT INTO departments(id, organization_id, name, department_type, code, lead_member_id, active) VALUES($1,$2,$3,$3,$4,$5,$6)",
    [dNoLead, org, "No active lead", "NO_LEAD", mids[employee], true],
  );

  async function asUser(user, callback) {
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user ?? ""]);
    await db.exec("SET ROLE authenticated");
    try {
      return await callback();
    } finally {
      await db.exec("RESET ROLE");
    }
  }
  async function mutate(user, action, payload, key = crypto.randomUUID()) {
    return asUser(
      user,
      async () =>
        (
          await db.query("SELECT public.mutate_lifecycle_workspace($1,$2::jsonb,$3) result", [
            action,
            JSON.stringify(payload),
            key,
          ])
        ).rows[0].result,
    );
  }
  const stage = (code, prerequisites, tasks) => ({
    code,
    name: code,
    gate: "Common",
    department: "SAL",
    phase: "TG_0",
    prerequisites,
    exitTypes: [],
    optional: false,
    tasks,
  });
  const definition = {
    id: "TEST-LC-v1",
    createdAt: "2026-11-04T00:00:00Z",
    stages: [
      stage(
        "CM_01",
        [],
        [1, 2, 3].map((n) => ({
          id: "T0" + n,
          title: "Configured task " + n,
          department: "SAL",
          description: "TEST",
        })),
      ),
      stage(
        "CM_02",
        ["CM_01"],
        [{ id: "T01", title: "Feasibility action", department: "SAL", description: "TEST" }],
      ),
    ],
  };
  await assert.rejects(
    () => mutate(employee, "save_revision", { definition, expectedRevision: null }),
    /ADMIN_REQUIRED/,
  );
  const request = uuid(800);
  const saved = await mutate(
    admin,
    "save_revision",
    { definition, expectedRevision: null },
    request,
  );
  assert.deepEqual(
    await mutate(admin, "save_revision", { definition, expectedRevision: null }, request),
    saved,
  );
  await assert.rejects(
    () => mutate(admin, "save_revision", { definition, expectedRevision: null }),
    /STALE/,
  );
  const invalid = structuredClone(definition);
  invalid.stages[0].prerequisites = ["CM_02"];
  await assert.rejects(
    () => mutate(admin, "save_revision", { definition: invalid, expectedRevision: saved.id }),
    /CYCLIC/,
  );
  await asUser(admin, async () => {
    await assert.rejects(
      () => db.query("SELECT * FROM private.lifecycle_revisions"),
      /permission denied/,
    );
  });
  const project = uuid(901),
    project2 = uuid(902);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [admin]);
  for (const id of [project, project2])
    await db.query(
      "INSERT INTO operational_records(id,organization_id,department_id,area,record_type,reference,title,stage,fields,created_by,updated_by) VALUES($1,$2,$3,'sales','Project',$4,'Fictional controller','CM_01',$5::jsonb,$6,$6)",
      [
        id,
        org,
        dSal,
        "HLPL-TEST-" + id.slice(-3),
        JSON.stringify({ track: "hardware_only", currentStage: "CM_01", completedStages: [] }),
        admin,
      ],
    );
  const tasks = await db.query("SELECT * FROM tasks WHERE record_id=$1", [project]);
  assert.equal(tasks.rows.length, 3);
  assert.ok(tasks.rows.every((t) => t.template_task_key.startsWith("LC-TG:TEST-LC-v1:CM_01:")));
  await db.query("UPDATE operational_records SET title='Updated title' WHERE id=$1", [project]);
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM tasks WHERE record_id=$1", [project])).rows[0].n,
    3,
  );
  await assert.rejects(
    () =>
      db.query(
        'UPDATE operational_records SET fields=fields||\'{"currentStage":"CM_02","completedStages":["CM_01"]}\'::jsonb WHERE id=$1',
        [project],
      ),
    /WORK_INCOMPLETE/,
  );
  await db.query("UPDATE tasks SET status='Complete' WHERE record_id=$1", [project]);
  await db.query(
    'UPDATE operational_records SET fields=fields||\'{"currentStage":"CM_02","completedStages":["CM_01"]}\'::jsonb WHERE id=$1',
    [project],
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int n FROM tasks WHERE record_id=$1 AND stage_code='CM_02'",
        [project],
      )
    ).rows[0].n,
    1,
  );
  const doc = uuid(903),
    file = uuid(904);
  await db.query(
    "INSERT INTO documents(id,organization_id,department_id,record_id,title,document_type,reference_url,created_by) VALUES($1,$2,$3,$4,'Fictional harness drawing','Drawing','',$5)",
    [doc, org, dSal, project, admin],
  );
  await db.query(
    "INSERT INTO controlled_document_files(id,organization_id,department_id,document_id,revision,storage_path,original_name,content_type,size_bytes,checksum,uploaded_by) VALUES($1,$2,$3,$4,'01','test/harness.pdf','harness.pdf','application/pdf',64,$5,$6)",
    [file, org, dSal, doc, "a".repeat(64), admin],
  );
  const inventory = uuid(905),
    stockSnapshot = {
      mpn: "TEST-HARNESS-MODULE",
      quantity: "17",
      stockUnit: "piece",
      release_status: "Engineering_Only",
    };
  await db.query(
    "INSERT INTO operational_records(id,organization_id,department_id,area,record_type,reference,title,fields,created_by,updated_by) VALUES($1,$2,$3,'pur','Part','HLPL-HARNESS-ITEM-01','Harness item master',$4::jsonb,$5,$5)",
    [inventory, org, dPur, JSON.stringify(stockSnapshot), admin],
  );
  const assetPayload = {
    sourceProject: project,
    documentId: doc,
    fileId: file,
    definition: {
      title: "Harness module",
      kind: "Harness",
      originStage: "CM_02",
      compatibility: "Fictional evaluation",
      inventoryItemId: inventory,
      parentRevisionId: "",
    },
  };
  await db.exec(
    fs.readFileSync(
      path.join(root, "supabase/migrations/20261104030000_shared_test_original_storage.sql"),
      "utf8",
    ),
  );
  await assert.rejects(
    () => mutate(admin, "publish_asset", assetPayload),
    /ORIGINAL_UPLOAD_INCOMPLETE/,
  );
  await db.query(
    "INSERT INTO storage.objects(bucket_id,name) VALUES('controlled-documents','test/harness.pdf')",
  );
  const published = await mutate(admin, "publish_asset", assetPayload);
  const first = await mutate(admin, "link_asset", {
    projectId: project2,
    assetRevisionId: published.id,
    assessment: "Checked connector compatibility",
  });
  const second = await mutate(admin, "link_asset", {
    projectId: project2,
    assetRevisionId: published.id,
    assessment: "Checked connector compatibility",
  });
  assert.equal(first.id, second.id);
  await assert.rejects(
    () =>
      mutate(admin, "link_asset", {
        projectId: project2,
        assetRevisionId: published.id,
        assessment: "",
      }),
    /ASSET_USE_DENIED/,
  );
  const snap = await asUser(
    admin,
    async () => (await db.query("SELECT public.get_lifecycle_workspace() result")).rows[0].result,
  );
  assert.equal(snap.assets.length, 1);
  assert.equal(snap.uses.length, 1);
  assert.equal(snap.files[0].checksum, "a".repeat(64));
  assert.equal(snap.assets[0].definition.status, "Draft");
  assert.equal(snap.assets[0].definition.inventoryItemId, inventory);
  assert.deepEqual(
    (await db.query("SELECT fields FROM operational_records WHERE id=$1", [inventory])).rows[0]
      .fields,
    stockSnapshot,
  );
  const v2 = structuredClone(definition);
  v2.id = "TEST-LC-v2";
  v2.stages[0].tasks = [];
  await mutate(admin, "save_revision", { definition: v2, expectedRevision: saved.id });
  assert.equal(
    JSON.parse(
      (await db.query("SELECT fields FROM operational_records WHERE id=$1", [project])).rows[0]
        .fields.lifecycleBaseline,
    ).id,
    "TEST-LC-v1",
  );
  await db.exec(
    fs.readFileSync(
      path.join(root, "supabase/migrations/20261104020000_project_start_from_feasibility.sql"),
      "utf8",
    ),
  );
  await db.exec(
    fs.readFileSync(
      path.join(root, "supabase/migrations/20261107050000_copy_reviewed_opportunity_context.sql"),
      "utf8",
    ),
  );
  const oldWrite = async (user, action, payload) =>
    asUser(
      user,
      async () =>
        (
          await db.query("SELECT public.mutate_shared_test_workspace($1,$2::jsonb,$3) result", [
            action,
            JSON.stringify(payload),
            crypto.randomUUID(),
          ])
        ).rows[0].result,
    );
  await assert.rejects(
    () => oldWrite(admin, "create_project", { title: "Bypass", reference: "HLPL-BYPASS" }),
    /USE_REVIEWED_OPPORTUNITY/,
  );
  const opportunity = (
    await oldWrite(salLead, "create_record", {
      record_type: "Opportunity",
      reference: "HLPL-TEST-OPPORTUNITY-START",
      title: "Fictional feasibility case",
      fields: {
        revision: "01",
        requiredDepartments: "EHW",
        feasibilityDispatchedAt: "2026-11-04T00:00:00Z",
        quantity: "12",
        contactPerson: "Fictional TEST Contact",
        email: "test-contact@example.com",
        owner: "TEST Sales Lead",
      },
    })
  ).id;
  const start = async (user, payload, requestId = crypto.randomUUID()) =>
    asUser(
      user,
      async () =>
        (
          await db.query("SELECT public.start_project_from_feasibility($1::jsonb,$2) result", [
            JSON.stringify(payload),
            requestId,
          ])
        ).rows[0].result,
    );
  let source = (await db.query("SELECT * FROM operational_records WHERE id=$1", [opportunity]))
    .rows[0];
  await assert.rejects(
    () =>
      start(salLead, {
        opportunityId: opportunity,
        expectedUpdatedAt: source.updated_at,
        reference: "HLPL-TEST-PROJECT-START",
        title: "Fictional case",
      }),
    /FEASIBILITY_AND_TRACK/,
  );
  const review = (
    await oldWrite(salLead, "request_approval", {
      record_id: opportunity,
      reviewer_department_id: dEhw,
      title: "Fictional feasibility review",
    })
  ).id;
  const approval = (await db.query("SELECT * FROM approvals WHERE id=$1", [review])).rows[0];
  await oldWrite(ehwLead, "decide_approval", {
    id: review,
    expected_updated_at: approval.updated_at,
    outcome: "approved",
    notes: "In-memory fixture review only",
  });
  source = (await db.query("SELECT * FROM operational_records WHERE id=$1", [opportunity])).rows[0];
  await asUser(salLead, () =>
    db.query("SELECT public.decide_shared_test_track_after_feasibility($1::jsonb,$2)", [
      JSON.stringify({
        opportunityId: opportunity,
        expectedUpdatedAt: source.updated_at,
        track: "hardware_only",
      }),
      crypto.randomUUID(),
    ]),
  );
  source = (await db.query("SELECT * FROM operational_records WHERE id=$1", [opportunity])).rows[0];
  const startPayload = {
    opportunityId: opportunity,
    expectedUpdatedAt: source.updated_at,
    reference: "HLPL-TEST-PROJECT-START",
    title: "Fictional scoped project",
  };
  const startKey = crypto.randomUUID();
  const started = await start(salLead, startPayload, startKey);
  assert.deepEqual(await start(salLead, startPayload, startKey), started);
  const created = (await db.query("SELECT * FROM operational_records WHERE id=$1", [started.id]))
    .rows[0];
  assert.equal(created.fields.track, "hardware_only");
  assert.equal(created.fields.sourceOpportunityId, opportunity);
  assert.equal(created.fields.quantity, "12");
  assert.equal(created.fields.contactPerson, "Fictional TEST Contact");
  assert.equal(created.fields.email, "test-contact@example.com");
  assert.equal(created.fields.owner, "TEST Sales Lead");
  assert.equal(created.fields.currentStage, "CM_01");
  assert.equal(created.fields.portfolioStatus, "FEASIBILITY_AND_SCOPING");
  assert.equal(created.status, "draft");
  await db.exec(
    fs.readFileSync(
      path.join(
        root,
        "supabase/migrations/20261104040000_reviewed_project_lifecycle_configuration.sql",
      ),
      "utf8",
    ),
  );
  const v3 = structuredClone(v2);
  v3.id = "TEST-LC-v3";
  v3.stages[1].optional = true;
  v3.stages[1].prerequisites = [];
  const latest = (
    await db.query("SELECT id FROM private.lifecycle_revisions ORDER BY version DESC LIMIT 1")
  ).rows[0].id;
  const version3 = await mutate(admin, "save_revision", {
    definition: v3,
    expectedRevision: latest,
  });
  const configure = async (user, payload, key = crypto.randomUUID()) =>
    asUser(
      user,
      async () =>
        (
          await db.query("SELECT public.configure_project_lifecycle($1::jsonb,$2) result", [
            JSON.stringify(payload),
            key,
          ])
        ).rows[0].result,
    );
  let p2 = (await db.query("SELECT * FROM operational_records WHERE id=$1", [project2])).rows[0];
  const migration = {
    action: "migrate_baseline",
    projectId: project2,
    revisionId: version3.id,
    expectedUpdatedAt: p2.updated_at,
    reason: "Adopt reviewed future defaults; preserve existing tasks",
  };
  await assert.rejects(() => configure(employee, migration), /CONFIGURATION_DENIED/);
  const migrationKey = crypto.randomUUID();
  const migrated = await configure(admin, migration, migrationKey);
  assert.deepEqual(await configure(admin, migration, migrationKey), migrated);
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM tasks WHERE record_id=$1", [project2])).rows[0].n,
    3,
  );
  assert.deepEqual(
    (
      await db.query("SELECT private.project_stage_prerequisites($1,'CM_02','hardware_only') req", [
        project2,
      ])
    ).rows[0].req,
    [],
  );
  await assert.rejects(
    () => db.query("SELECT private.canonical_stage_work_snapshot($1,'CM_01')", [project2]),
    /WORK_INCOMPLETE/,
  );
  await db.query("UPDATE tasks SET status='Complete' WHERE record_id=$1", [project2]);
  const configuredSnapshot = (
    await db.query("SELECT private.canonical_stage_work_snapshot($1,'CM_01') snap", [project2])
  ).rows[0].snap;
  assert.equal(configuredSnapshot.tasks.length, 3);
  assert.equal(configuredSnapshot.activation_baseline, "TEST-LC-v1");
  p2 = (await db.query("SELECT * FROM operational_records WHERE id=$1", [project2])).rows[0];
  const stageReview = await oldWrite(admin, "request_stage_completion", {
    project_id: project2,
    stage_code: "CM_01",
    expected_updated_at: p2.updated_at,
  });
  const stageApproval = (
    await db.query("SELECT * FROM approvals WHERE record_id=$1", [stageReview.id])
  ).rows[0];
  await assert.rejects(
    () =>
      oldWrite(admin, "decide_approval", {
        id: stageApproval.id,
        expected_updated_at: stageApproval.updated_at,
        outcome: "approved",
      }),
    /SELF_APPROVAL/,
  );
  await oldWrite(salLead, "decide_approval", {
    id: stageApproval.id,
    expected_updated_at: stageApproval.updated_at,
    outcome: "approved",
    notes: "In-memory configured-stage review fixture",
  });
  p2 = (await db.query("SELECT * FROM operational_records WHERE id=$1", [project2])).rows[0];
  await assert.rejects(
    () =>
      configure(admin, {
        action: "omit_optional",
        projectId: project2,
        expectedUpdatedAt: p2.updated_at,
        stageCode: "CM_01",
        reason: "Cannot omit active work",
      }),
    /ONLY_APPLICABLE_OPTIONAL|STARTED_STAGE/,
  );
  const omission = {
    action: "omit_optional",
    projectId: project2,
    expectedUpdatedAt: p2.updated_at,
    stageCode: "CM_02",
    reason: "Optional demonstration step excluded for this fixture",
  };
  await configure(admin, omission);
  p2 = (await db.query("SELECT * FROM operational_records WHERE id=$1", [project2])).rows[0];
  assert.ok(p2.fields.omittedStages.CM_02.reason);
  assert.ok(!p2.fields.completedStages.includes("CM_02"));
  assert.ok(p2.fields.completedStages.includes("CM_01"));
  await assert.rejects(
    () =>
      oldWrite(admin, "advance_stage", {
        project_id: project2,
        target_stage: "CM_02",
        expected_updated_at: p2.updated_at,
      }),
    /STAGE_MARKED_NOT_APPLICABLE/,
  );
  await db.exec(
    fs.readFileSync(
      path.join(root, "supabase/migrations/20261104050000_reuse_original_in_record_dialog.sql"),
      "utf8",
    ),
  );
  const reuseRecord = await oldWrite(admin, "create_record", {
    title: "Fictional reused harness interface",
    reference: "HLPL-REUSE-REC-01",
    department_id: dSal,
    project_id: project2,
    record_type: "Schematic",
    fields: { revision: "01", hwStage: "HW_15" },
  });
  const attach = async (payload, key = crypto.randomUUID()) =>
    asUser(
      admin,
      async () =>
        (
          await db.query("SELECT public.attach_reusable_revision_to_record($1::jsonb,$2) result", [
            JSON.stringify(payload),
            key,
          ])
        ).rows[0].result,
    );
  const attachPayload = {
    recordId: reuseRecord.id,
    projectId: project2,
    assetRevisionId: published.id,
    assessment: "Evaluate harness interface before adoption",
  };
  const attachKey = crypto.randomUUID();
  const attached = await attach(attachPayload, attachKey);
  assert.deepEqual(await attach(attachPayload, attachKey), attached);
  assert.equal(attached.fileId, file);
  assert.equal(
    (await db.query("SELECT private.has_record_original_object($1) ok", [reuseRecord.id])).rows[0]
      .ok,
    true,
  );
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM controlled_document_files")).rows[0].n,
    1,
  );
  await assert.rejects(() => attach({ ...attachPayload, projectId: project }), /PROJECT_MISMATCH/);
  await assert.rejects(
    () =>
      db.query(
        "UPDATE operational_records SET fields=fields||jsonb_build_object('reusedOriginalFileId',$2::text) WHERE id=$1",
        [reuseRecord.id, uuid(999)],
      ),
    /VERIFIED_REUSABLE_ORIGINAL/,
  );
  await db.exec(
    fs.readFileSync(
      path.join(
        root,
        "supabase/migrations/20261104060000_parallel_stage_readiness_and_exit_receipts.sql",
      ),
      "utf8",
    ),
  );
  const v4 = structuredClone(v3);
  v4.id = "TEST-LC-v4";
  v4.stages[0].tasks = structuredClone(definition.stages[0].tasks);
  v4.stages.push(
    stage(
      "CM_03",
      [],
      [
        {
          id: "T01",
          title: "Independent parallel work",
          description: "Keep other stages open",
          department: "SAL",
        },
      ],
    ),
  );
  const schematicStage = stage(
    "HW_15",
    [],
    [{ id: "T01", title: "Schematic review", description: "Original required", department: "SAL" }],
  );
  schematicStage.exitTypes = ["Schematic"];
  v4.stages.push(schematicStage);
  await mutate(admin, "save_revision", { definition: v4, expectedRevision: version3.id });
  const parallelProject = uuid(920);
  await db.query(
    "INSERT INTO operational_records(id,organization_id,department_id,area,record_type,reference,title,stage,fields,created_by,updated_by) VALUES($1,$2,$3,'sales','Project','HLPL-PARALLEL-TEST','Parallel fixture','CM_01',$4::jsonb,$5,$5)",
    [
      parallelProject,
      org,
      dSal,
      JSON.stringify({ track: "hardware_only", currentStage: "CM_01", completedStages: [] }),
      admin,
    ],
  );
  const parallel = (
    await db.query("SELECT * FROM operational_records WHERE id=$1", [parallelProject])
  ).rows[0];
  await oldWrite(admin, "advance_stage", {
    project_id: parallelProject,
    target_stage: "CM_03",
    expected_updated_at: parallel.updated_at,
  });
  const parallelTasks = (
    await db.query("SELECT stage_code,status,description FROM tasks WHERE record_id=$1", [
      parallelProject,
    ])
  ).rows;
  assert.equal(parallelTasks.length, 4);
  assert.equal(
    parallelTasks.filter((t) => t.stage_code === "CM_01" && t.status === "Open").length,
    3,
  );
  assert.equal(
    parallelTasks.find((t) => t.stage_code === "CM_03").description,
    "Keep other stages open",
  );
  assert.deepEqual(
    (await db.query("SELECT fields FROM operational_records WHERE id=$1", [parallelProject]))
      .rows[0].fields.completedStages,
    [],
  );
  const beforeSchematic = (
    await db.query("SELECT * FROM operational_records WHERE id=$1", [parallelProject])
  ).rows[0];
  await oldWrite(admin, "advance_stage", {
    project_id: parallelProject,
    target_stage: "HW_15",
    expected_updated_at: beforeSchematic.updated_at,
  });
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int n FROM pg_trigger WHERE tgname='require_binary_stage_exit' AND NOT tgisinternal",
      )
    ).rows[0].n,
    1,
  );
  await db.query("UPDATE tasks SET status='Complete' WHERE record_id=$1 AND stage_code='HW_15'", [
    parallelProject,
  ]);
  await assert.rejects(
    () => db.query("SELECT private.canonical_stage_work_snapshot($1,'HW_15')", [parallelProject]),
    /EXIT_EVIDENCE_MISSING/,
  );
  await assert.rejects(
    () =>
      db.query(
        'UPDATE operational_records SET fields=fields||\'{"completedStages":["HW_15"]}\'::jsonb WHERE id=$1',
        [parallelProject],
      ),
    /EXIT_EVIDENCE_MISSING/,
  );
  const proofRecord = await oldWrite(admin, "create_record", {
    title: "Schematic fixture evidence",
    reference: "HLPL-SCHEMATIC-EVIDENCE-01",
    department_id: dSal,
    project_id: parallelProject,
    record_type: "Schematic",
    fields: { revision: "01", hwStage: "HW_15" },
  });
  await db.query("UPDATE operational_records SET status='approved' WHERE id=$1", [proofRecord.id]);
  const proofDoc = uuid(930),
    proofFile = uuid(931);
  await db.query(
    "INSERT INTO documents(id,organization_id,department_id,record_id,title,document_type,reference_url,created_by) VALUES($1,$2,$3,$4,'Fixture original','Schematic PDF','',$5)",
    [proofDoc, org, dSal, proofRecord.id, admin],
  );
  await db.query(
    "INSERT INTO controlled_document_files(id,organization_id,department_id,document_id,revision,storage_path,original_name,content_type,size_bytes,checksum,uploaded_by) VALUES($1,$2,$3,$4,'01','test/evidence.pdf','evidence.pdf','application/pdf',64,$5,$6)",
    [proofFile, org, dSal, proofDoc, "b".repeat(64), admin],
  );
  await assert.rejects(
    () => db.query("SELECT private.canonical_stage_work_snapshot($1,'HW_15')", [parallelProject]),
    /EXIT_EVIDENCE_MISSING/,
  );
  await db.query(
    "INSERT INTO storage.objects(bucket_id,name) VALUES('controlled-documents','test/evidence.pdf')",
  );
  assert.equal(
    (
      await db.query("SELECT private.canonical_stage_work_snapshot($1,'HW_15') snap", [
        parallelProject,
      ])
    ).rows[0].snap.tasks.length,
    1,
  );
  await db.exec(
    fs.readFileSync(
      path.join(root, "supabase/migrations/20261104070000_recorded_certification_scope.sql"),
      "utf8",
    ),
  );
  const v5 = structuredClone(v4);
  v5.id = "TEST-LC-v5";
  v5.stages.push(stage("CL_01", ["CM_03"], []));
  const homologation = stage("HW_37", ["HW_15"], []);
  homologation.optional = true;
  v5.stages.push(homologation);
  for (let n = 1; n <= 15; n++)
    v5.stages.push(
      stage(
        "C" + String(n).padStart(2, "0"),
        n === 1 ? [] : ["C" + String(n - 1).padStart(2, "0")],
        [
          {
            id: "T01",
            title: "Certification fixture " + n,
            description: "No certificate assumed",
            department: "SAL",
          },
        ],
      ),
    );
  const latest4 = (
    await db.query("SELECT id FROM private.lifecycle_revisions ORDER BY version DESC LIMIT 1")
  ).rows[0].id;
  await mutate(admin, "save_revision", { definition: v5, expectedRevision: latest4 });
  const certificationProject = uuid(940);
  await db.query(
    "INSERT INTO operational_records(id,organization_id,department_id,area,record_type,reference,title,stage,fields,created_by,updated_by) VALUES($1,$2,$3,'sales','Project','HLPL-CERT-SCOPE','Certification scope fixture','CM_01',$4::jsonb,$5,$5)",
    [
      certificationProject,
      org,
      dSal,
      JSON.stringify({ track: "hardware_only", currentStage: "CM_01", completedStages: [] }),
      admin,
    ],
  );
  await assert.rejects(
    () =>
      db.query("SELECT private.project_stage_prerequisites($1,'CL_01','hardware_only')", [
        certificationProject,
      ]),
    /CERTIFICATION_SCOPE_DECISION_REQUIRED/,
  );
  const scope = async (user, payload) =>
    asUser(
      user,
      async () =>
        (
          await db.query("SELECT public.set_project_certification_scope($1::jsonb,$2) result", [
            JSON.stringify(payload),
            crypto.randomUUID(),
          ])
        ).rows[0].result,
    );
  let cp = (await db.query("SELECT * FROM operational_records WHERE id=$1", [certificationProject]))
    .rows[0];
  const scopePayload = {
    projectId: certificationProject,
    expectedUpdatedAt: cp.updated_at,
    required: false,
    reason: "Fixture applicability assessment: no regulatory homologation in this scope",
  };
  await assert.rejects(() => scope(employee, scopePayload), /SCOPE_AUTHORITY/);
  await scope(admin, scopePayload);
  cp = (await db.query("SELECT * FROM operational_records WHERE id=$1", [certificationProject]))
    .rows[0];
  assert.equal(cp.fields.certificationRequired, false);
  assert.ok(cp.fields.omittedStages.HW_37);
  assert.deepEqual(cp.fields.completedStages, []);
  await scope(admin, {
    ...scopePayload,
    expectedUpdatedAt: cp.updated_at,
    required: true,
    reason: "Fixture scope revised before engineering freeze and certification work",
  });
  cp = (await db.query("SELECT * FROM operational_records WHERE id=$1", [certificationProject]))
    .rows[0];
  assert.equal(cp.fields.certificationRequired, true);
  assert.ok(!cp.fields.omittedStages.HW_37);
  assert.ok(
    (
      await db.query("SELECT private.project_stage_prerequisites($1,'CL_01','hardware_only') req", [
        certificationProject,
      ])
    ).rows[0].req.includes("C15"),
  );
  await oldWrite(admin, "advance_stage", {
    project_id: certificationProject,
    target_stage: "C01",
    expected_updated_at: cp.updated_at,
  });
  cp = (await db.query("SELECT * FROM operational_records WHERE id=$1", [certificationProject]))
    .rows[0];
  await assert.rejects(
    () => scope(admin, { ...scopePayload, expectedUpdatedAt: cp.updated_at }),
    /USE_REQUIREMENTS_AMENDMENT/,
  );
  await db.exec(
    fs.readFileSync(
      path.join(root, "supabase/migrations/20261104080000_verified_original_receipts.sql"),
      "utf8",
    ),
  );
  assert.equal(
    (await db.query("SELECT private.has_record_original_object($1) ok", [reuseRecord.id])).rows[0]
      .ok,
    false,
  );
  await asUser(admin, () =>
    assert.rejects(
      () =>
        db.query("SELECT public.attest_controlled_original($1,$2,$3,64)", [
          file,
          admin,
          "a".repeat(64),
        ]),
      /permission denied/,
    ),
  );
  await db.query("SELECT set_config('request.jwt.claim.role','service_role',false)");
  await db.exec("SET ROLE service_role");
  try {
    await assert.rejects(
      () =>
        db.query("SELECT public.attest_controlled_original($1,$2,$3,64)", [
          file,
          admin,
          "b".repeat(64),
        ]),
      /DIGEST_MISMATCH/,
    );
    await db.query("SELECT public.attest_controlled_original($1,$2,$3,64)", [
      file,
      admin,
      "a".repeat(64),
    ]);
  } finally {
    await db.exec("RESET ROLE");
    await db.query("SELECT set_config('request.jwt.claim.role','',false)");
  }
  assert.equal(
    (await db.query("SELECT private.has_record_original_object($1) ok", [reuseRecord.id])).rows[0]
      .ok,
    true,
  );
  await db.query("UPDATE storage.objects SET id=gen_random_uuid() WHERE name='test/harness.pdf'");
  assert.equal(
    (await db.query("SELECT private.has_record_original_object($1) ok", [reuseRecord.id])).rows[0]
      .ok,
    false,
  );
  await db.exec(
    fs.readFileSync(
      path.join(root, "supabase/migrations/20261104090000_pinned_lifecycle_identity_guard.sql"),
      "utf8",
    ),
  );
  await assert.rejects(
    () =>
      db.query("UPDATE operational_records SET stage='Stage 2' WHERE id=$1", [
        certificationProject,
      ]),
    /USE_PINNED_STAGE_WORKFLOW/,
  );
  assert.equal(
    (await db.query("SELECT stage FROM operational_records WHERE id=$1", [certificationProject]))
      .rows[0].stage,
    "C01",
  );
  await db.exec(
    fs.readFileSync(
      path.join(root, "supabase/migrations/20261104100000_canonical_coordination_projection.sql"),
      "utf8",
    ),
  );
  const aliasProject = uuid(960);
  await db.query(
    "INSERT INTO operational_records(id,organization_id,department_id,area,record_type,reference,title,stage,fields,created_by,updated_by) VALUES($1,$2,$3,'sales','Project','HLPL-LEGACY-ALIAS','Legacy alias fixture','Stage 2',$4::jsonb,$5,$5)",
    [
      aliasProject,
      org,
      dSal,
      JSON.stringify({ track: "hardware_only", currentStage: "CM_01", completedStages: [] }),
      admin,
    ],
  );
  const coordination = (
    await asUser(salLead, () => db.query("SELECT public.get_project_coordination() data"))
  ).rows[0].data;
  const projected = coordination.records.find((r) => r.id === aliasProject);
  assert.equal(projected.fields.currentStage, "CM_01");
  assert.equal(projected.fields.lifecycleStage, "CM_01");
  assert.equal(projected.fields.legacyStage, "Stage 2");
  assert.ok(projected.fields.lifecycleBaseline);
  {
  await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/20261106125525_stage_raci_execution_contract.sql'),'utf8'));
  await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/20261101010231_stage_task_lead_assignment.sql'),'utf8'));
  const raciDefinition = structuredClone(definition);
  raciDefinition.id='TEST-RACI-v1';
  for(const s of raciDefinition.stages) s.raci={R:['SAL'],A:['PUR'],C:['EHW'],I:[]};
  let latest=(await db.query('SELECT id FROM private.lifecycle_revisions WHERE organization_id=$1 ORDER BY version DESC LIMIT 1',[org])).rows[0].id;
  const badRaci=structuredClone(raciDefinition); badRaci.stages[0].raci.R=['EHW'];
  await assert.rejects(()=>mutate(admin,'save_revision',{definition:badRaci,expectedRevision:latest}),/RACI_RESPONSIBLE|TASK_OWNER_NOT/);
  await mutate(admin,'save_revision',{definition:raciDefinition,expectedRevision:latest});
  const createRaciProject=async(id,reference,dept)=>{
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[admin]);
    await db.query("INSERT INTO operational_records(id,organization_id,department_id,area,record_type,reference,title,stage,fields,created_by,updated_by) VALUES($1,$2,$3,'sales','Project',$4,'Fictional RACI verification','CM_01',$5::jsonb,$6,$6)",[id,org,dept,reference,JSON.stringify({track:'hardware_only',currentStage:'CM_01',completedStages:[]}),admin]);
  };
  const raciProject=uuid(970);
  await createRaciProject(raciProject,'HLPL-TEST-RACI-01',dSal);
  const routedTasks=(await db.query('SELECT * FROM tasks WHERE record_id=$1',[raciProject])).rows;
  assert.equal(routedTasks.length,3);
  assert.ok(routedTasks.every(t=>t.department_id===dSal && t.assignee_id===mids[salLead]));
  await assert.rejects(()=>db.query('UPDATE tasks SET department_id=$1 WHERE id=$2',[dEhw,routedTasks[0].id]),/TASK_OWNER_NOT_RACI_RESPONSIBLE/);
  await db.query("UPDATE tasks SET status='Complete' WHERE record_id=$1",[raciProject]);
  const rp=(await db.query('SELECT * FROM operational_records WHERE id=$1',[raciProject])).rows[0];
  const rr=await oldWrite(salLead,'request_stage_completion',{project_id:raciProject,stage_code:'CM_01',expected_updated_at:rp.updated_at});
  const ra=(await db.query('SELECT * FROM approvals WHERE record_id=$1',[rr.id])).rows[0];
  assert.equal(ra.reviewer_department_id,dPur);
  await assert.rejects(()=>oldWrite(ehwLead,'decide_approval',{id:ra.id,expected_updated_at:ra.updated_at,outcome:'approved'}),/SIGNING_AUTHORITY|DENIED|PERMISSION/);
  await oldWrite(purLead,'decide_approval',{id:ra.id,expected_updated_at:ra.updated_at,outcome:'approved',notes:'Synthetic in-memory RACI verification only'});
  assert.ok((await db.query('SELECT fields FROM operational_records WHERE id=$1',[raciProject])).rows[0].fields.completedStages.includes('CM_01'));
  const raciNext=structuredClone(raciDefinition);raciNext.id='TEST-RACI-v2';
  for(const s of raciNext.stages){s.raci.R=['EHW'];s.department='EHW';for(const t of s.tasks)t.department='EHW';}
  latest=(await db.query('SELECT id FROM private.lifecycle_revisions WHERE organization_id=$1 ORDER BY version DESC LIMIT 1',[org])).rows[0].id;
  await mutate(admin,'save_revision',{definition:raciNext,expectedRevision:latest});
  assert.equal((await db.query("SELECT private.project_stage_responsibility($1,'CM_01') r",[raciProject])).rows[0].r.R[0],'SAL');
  assert.ok((await db.query('SELECT * FROM tasks WHERE record_id=$1',[raciProject])).rows.every(t=>t.department_id===dSal));
  const raciProject2=uuid(971);
  await createRaciProject(raciProject2,'HLPL-TEST-RACI-02',dEhw);
  const changedTasks=(await db.query('SELECT * FROM tasks WHERE record_id=$1',[raciProject2])).rows;
  assert.equal(changedTasks.length,3);
  assert.ok(changedTasks.every(t=>t.department_id===dEhw && t.assignee_id===mids[ehwLead]));
  await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261106222219_shared_department_configuration.sql'),'utf8'));
  const configuration=async(user)=>(await asUser(user,()=>db.query('SELECT public.get_organization_configuration() data'))).rows[0].data;
  const departmentConfig=(await configuration(admin)).departments.find(d=>d.id===dEhw);
  const departmentPatch={id:dEhw,name:'Configured hardware engineering',type:departmentConfig.type,active:true,sortOrder:7,leadMemberId:departmentConfig.leadMemberId,expectedUpdatedAt:departmentConfig.updatedAt};
  const saveDepartment=async(user,payload)=>(await asUser(user,()=>db.query('SELECT public.update_organization_department($1::jsonb) data',[JSON.stringify(payload)]))).rows[0].data;
  await assert.rejects(()=>saveDepartment(employee,departmentPatch),/ADMIN_REQUIRED/);
  const renamed=await saveDepartment(admin,departmentPatch);
  assert.equal(renamed.departments.find(d=>d.id===dEhw).name,'Configured hardware engineering');
  assert.equal((await configuration(ehwLead)).departments.find(d=>d.id===dEhw).name,'Configured hardware engineering');
  await assert.rejects(()=>saveDepartment(admin,departmentPatch),/STALE_DEPARTMENT/);
  await assert.rejects(()=>saveDepartment(admin,{...departmentPatch,active:false,expectedUpdatedAt:renamed.departments.find(d=>d.id===dEhw).updatedAt}),/ACTIVE_WORK_OR_LIFECYCLE/);
  await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261107221540_department_workspace_responsibilities.sql'),'utf8'));
  const groupPatch=(d,extra)=>({id:d.id,name:d.name,type:d.type,active:d.active,sortOrder:d.sortOrder,leadMemberId:d.leadMemberId,expectedUpdatedAt:d.updatedAt,ticketGroups:d.ticketGroups,workspaceDepartmentId:d.workspaceDepartmentId,...extra});
  const groupHardware=(await configuration(admin)).departments.find(d=>d.id===dEhw);
  const grouped=await saveDepartment(admin,groupPatch(groupHardware,{workspaceDepartmentId:dSal,ticketGroups:['service','it']}));
  assert.equal(grouped.departments.find(d=>d.id===dEhw).workspaceDepartmentId,dSal);
  assert.deepEqual(grouped.departments.find(d=>d.id===dEhw).ticketGroups,['service','it']);
  await assert.rejects(()=>saveDepartment(employee,groupPatch(grouped.departments.find(d=>d.id===dEhw),{ticketGroups:[]})),/ADMIN_REQUIRED/);
  await assert.rejects(()=>saveDepartment(admin,groupPatch(grouped.departments.find(d=>d.id===dSal),{workspaceDepartmentId:dEhw})),/CHOOSE_ACTIVE_MAIN_WORKSPACE/);
  await assert.rejects(()=>saveDepartment(admin,groupPatch(grouped.departments.find(d=>d.id===dEhw),{ticketGroups:['unknown']})),/INVALID_WORKSPACE_RESPONSIBILITIES/);
  await saveDepartment(admin,groupPatch(grouped.departments.find(d=>d.id===dEhw),{workspaceDepartmentId:null}));
  await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261110090000_multi_department_lead_access.sql'),'utf8'));
  const noLeadConfig=(await configuration(admin)).departments.find(d=>d.id===dNoLead);
  const multiRoleConfig=await saveDepartment(admin,{...groupPatch(noLeadConfig),leadMemberId:mids[ehwLead]});
  assert.equal(multiRoleConfig.departments.find(d=>d.id===dNoLead).leadMemberId,mids[ehwLead]);
  assert.equal((await asUser(ehwLead,()=>db.query('SELECT private.shared_test_scope($1,$2) allowed',[org,dNoLead]))).rows[0].allowed,true);
  assert.equal((await asUser(purLead,()=>db.query('SELECT private.shared_test_scope($1,$2) allowed',[org,dNoLead]))).rows[0].allowed,false);
  assert.equal((await asUser(ehwLead,()=>db.query('SELECT public.has_department_permission($1,$2,$3) allowed',[org,dNoLead,'approvals:decide']))).rows[0].allowed,true);
  assert.equal((await asUser(purLead,()=>db.query('SELECT public.has_department_permission($1,$2,$3) allowed',[org,dNoLead,'approvals:decide']))).rows[0].allowed,false);
  await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261107043504_complete_phase_stage_registry.sql'),'utf8'));
  assert.equal((await db.query("SELECT count(*)::int n FROM canonical_stage_templates WHERE stage_code ~ '^G[0-9]_'")).rows[0].n,21);
  assert.equal((await db.query('SELECT count(*)::int n FROM private.stage_deliverable_bindings')).rows[0].n,82);
  const stageSettings=structuredClone(raciDefinition);stageSettings.id='TEST-FULL-STAGE-SETTINGS';
  stageSettings.stages.push({...stage('G0_01',['CM_01'],Array.from({length:5},(_,index)=>({id:`T0${index+1}`,title:`Configured kickoff task ${index+1}`,description:'Synthetic TEST task',department:'SAL'}))),raci:{R:['SAL'],A:['PUR'],C:['EHW'],I:[]},exitTypes:['Stage evidence · G0_01']});
  latest=(await db.query('SELECT id FROM private.lifecycle_revisions WHERE organization_id=$1 ORDER BY version DESC LIMIT 1',[org])).rows[0].id;
  await mutate(admin,'save_revision',{definition:stageSettings,expectedRevision:latest});
  const extendedProject=uuid(980);
  await createRaciProject(extendedProject,'HLPL-TEST-EXTENDED-STAGES',dSal);
  await db.query("UPDATE tasks SET status='Complete' WHERE record_id=$1",[extendedProject]);
  let currentProject=(await db.query('SELECT * FROM operational_records WHERE id=$1',[extendedProject])).rows[0];
  let receipt=await oldWrite(salLead,'request_stage_completion',{project_id:extendedProject,stage_code:'CM_01',expected_updated_at:currentProject.updated_at});
  let approval=(await db.query('SELECT * FROM approvals WHERE record_id=$1',[receipt.id])).rows[0];
  await oldWrite(purLead,'decide_approval',{id:approval.id,expected_updated_at:approval.updated_at,outcome:'approved',notes:'Synthetic isolated intake verification'});
  currentProject=(await db.query('SELECT * FROM operational_records WHERE id=$1',[extendedProject])).rows[0];
  const activationPayload={project_id:extendedProject,target_stage:'G0_01',expected_updated_at:currentProject.updated_at};
  const activationRequest=uuid(981);
  const activate=()=>asUser(salLead,()=>db.query('SELECT public.mutate_shared_test_workspace($1,$2::jsonb,$3)', ['advance_stage',JSON.stringify(activationPayload),activationRequest]));
  await activate();await activate();
  const kickoffTasks=(await db.query("SELECT * FROM tasks WHERE record_id=$1 AND stage_code='G0_01'",[extendedProject])).rows;
  assert.equal(kickoffTasks.length,5);
  assert.ok(kickoffTasks.every(task=>task.department_id===dSal&&task.assignee_id===mids[salLead]));
  await db.query("UPDATE tasks SET status='Complete' WHERE record_id=$1 AND stage_code='G0_01'",[extendedProject]);
  currentProject=(await db.query('SELECT * FROM operational_records WHERE id=$1',[extendedProject])).rows[0];
  await assert.rejects(()=>oldWrite(salLead,'request_stage_completion',{project_id:extendedProject,stage_code:'G0_01',expected_updated_at:currentProject.updated_at}),/REQUIRED_STAGE_EXIT_EVIDENCE_MISSING/);
  const evidence=await oldWrite(salLead,'create_record',{project_id:extendedProject,department_id:dSal,record_type:'Stage evidence · G0_01',reference:'HLPL-TEST-CHARTER-01',title:'Synthetic charter evidence',fields:{projectId:extendedProject,revision:'01',recordStage:'G0_01',evidenceSummary:'Fictional bench validation charter; not customer acceptance'}});
  await assert.rejects(()=>oldWrite(admin,'create_record',{project_id:extendedProject,department_id:dEhw,record_type:'Stage evidence · G0_01',reference:'HLPL-TEST-WRONG-OWNER',title:'Wrong owner',fields:{projectId:extendedProject,revision:'01'}}),/DEPARTMENT_MISMATCH/);
  const evidenceReview=await oldWrite(salLead,'request_approval',{record_id:evidence.id,reviewer_department_id:dEhw});
  approval=(await db.query('SELECT * FROM approvals WHERE id=$1',[evidenceReview.id])).rows[0];
  assert.equal(approval.reviewer_department_id,dPur,'Stage evidence approvals follow configured A, not the client-supplied reviewer');
  await assert.rejects(()=>oldWrite(salLead,'request_approval',{record_id:evidence.id,reviewer_department_id:dEhw}),/REVIEW_ALREADY_PENDING/);
  await oldWrite(purLead,'decide_approval',{id:approval.id,expected_updated_at:approval.updated_at,outcome:'approved',notes:'Synthetic in-memory evidence review only'});
  currentProject=(await db.query('SELECT * FROM operational_records WHERE id=$1',[extendedProject])).rows[0];
  receipt=await oldWrite(salLead,'request_stage_completion',{project_id:extendedProject,stage_code:'G0_01',expected_updated_at:currentProject.updated_at});
  approval=(await db.query('SELECT * FROM approvals WHERE record_id=$1',[receipt.id])).rows[0];
  await oldWrite(purLead,'decide_approval',{id:approval.id,expected_updated_at:approval.updated_at,outcome:'approved',notes:'Synthetic stage completion only'});
  assert.ok((await db.query('SELECT fields FROM operational_records WHERE id=$1',[extendedProject])).rows[0].fields.completedStages.includes('G0_01'));
  assert.equal((await db.query("SELECT fields->>'lifecycleBaseline' baseline FROM operational_records WHERE id=$1",[raciProject])).rows[0].baseline.includes('TEST-RACI-v1'),true);
  }
});
