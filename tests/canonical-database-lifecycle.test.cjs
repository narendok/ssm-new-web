const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const root = path.resolve(__dirname, '..');
const uuid = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('Transactional PostgreSQL verification of canonical lifecycle, custom tasks, and atomic sample sync', async (t) => {
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
    CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(), bucket_id text, name text);
    CREATE PUBLICATION supabase_realtime;
  `);

  // Load migrations up to our forward migration
  const migrationNames = [
    '20260927075123_ac4fb50c-cb14-4750-a34f-24a69522d4b0',
    '20260927075232_f91de181-c465-45aa-948c-2fd7979633e6',
    '20260927090641_a22d2778-36cf-4d5a-9317-87ec60e24b1e',
    '20260927171219_adbe39cb-1238-47c9-ba7c-69ad4ac4dc2d',
    '20260927171247_b0c6d9a3-9521-4fcb-bf96-260d6f79035d',
    '20260927171349_e3fade41-b2b3-4f0e-8a0b-12796c1261fd',
    '20261020010000_operational_stage_gate_contract',
    '20261020014346_bind_stage_gate_approval_revisions',
    '20261020025329_enforce_operational_gate_write_boundary',
    '20261020034857_shared_test_workspace',
    '20261025091500_harden_downstream_master_guards',
    '20261028120000_lifecycle_and_sample_pack_sync',
    '20261028120001_canonical_stage_completion_reviews',
    '20261028120002_preserve_legacy_lifecycle_boundary',
    '20261103120000_decide_shared_test_track_after_feasibility',
    '20261106001444_admin_reset_shared_test_sample_pack',
    '20261106005734_retire_legacy_test_fixture_on_admin_reset',
  ];

  for (const name of migrationNames) {
    const file = path.join(root, 'supabase/migrations', `${name}.sql`);
    if (fs.existsSync(file)) {
      await db.exec(fs.readFileSync(file, 'utf8'));
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
    [admin, 'admin@example.com'],
    [ehwLead, 'ehw@example.com'],
    [purLead, 'pur@example.com'],
    [employee, 'employee.ehw@example.com'],
    [viewer, 'viewer@example.com'],
    [salLead, 'sal@example.com'],
  ]) {
    await db.query('INSERT INTO auth.users VALUES($1,$2)', [id, email]);
  }

  await db.query(
    "INSERT INTO organizations(id, name, main_location, created_by) VALUES($1, 'TEST ONLY · SSM-new1 synthetic workspace', 'Synthetic', $2)",
    [org, admin]
  );

  const mids = {};
  mids[admin] = (await db.query('SELECT id FROM organization_members WHERE user_id=$1', [admin])).rows[0].id;

  for (const [id, role] of [
    [ehwLead, 'department_lead'],
    [purLead, 'department_lead'],
    [salLead, 'department_lead'],
    [employee, 'member'],
    [viewer, 'viewer'],
  ]) {
    mids[id] = (
      await db.query(
        'INSERT INTO organization_members(organization_id, user_id, role, display_name) VALUES($1,$2,$3::text::app_role,$3::text) RETURNING id',
        [org, id, role]
      )
    ).rows[0].id;
  }

  for (const [id, code, lead] of [
    [dEhw, 'EHW', ehwLead],
    [dPur, 'PUR', purLead],
    [dSal, 'SAL', salLead],
  ]) {
    await db.query(
      'INSERT INTO departments(id, organization_id, name, department_type, code, lead_member_id) VALUES($1,$2,$3,$3,$3,$4)',
      [id, org, code, mids[lead]]
    );
  }
  const dClient = uuid(14);
  const dInactive = uuid(15);
  const dNoLead = uuid(16);
  await db.query(
    'INSERT INTO departments(id, organization_id, name, department_type, code, lead_member_id, active) VALUES($1,$2,$3,$3,$4,$5,$6)',
    [dClient, org, 'Client', 'CLIENT', mids[salLead], true]
  );
  await db.query(
    'INSERT INTO departments(id, organization_id, name, department_type, code, lead_member_id, active) VALUES($1,$2,$3,$3,$4,$5,$6)',
    [dInactive, org, 'Inactive QA', 'INACTIVE_QA', mids[ehwLead], false]
  );
  await db.query(
    'INSERT INTO departments(id, organization_id, name, department_type, code, lead_member_id, active) VALUES($1,$2,$3,$3,$4,$5,$6)',
    [dNoLead, org, 'No active lead', 'NO_LEAD', mids[employee], true]
  );

  const seedTask = async ({
    departmentId,
    assigneeId = null,
    stageCode = 'HW_01',
    isCustom = false,
    status = 'Open',
    title,
  }) => (await db.query(
    `INSERT INTO tasks(
       organization_id, department_id, title, status, priority, assignee_id,
       created_by, stage_code, is_custom
     ) VALUES($1,$2,$3,$4,'High',$5,$6,$7,$8)
     RETURNING *`,
    [org, departmentId, title, status, assigneeId, admin, stageCode, isCustom]
  )).rows[0];

  const backfillEligible = await seedTask({
    departmentId: dEhw,
    status: 'Complete',
    title: 'Preexisting generated stage task',
  });
  const explicitAssignment = await seedTask({
    departmentId: dEhw,
    assigneeId: mids[employee],
    title: 'Preexisting explicitly assigned task',
  });
  const existingCustom = await seedTask({
    departmentId: dEhw,
    isCustom: true,
    title: 'Preexisting custom task',
  });
  const existingNonStage = await seedTask({
    departmentId: dEhw,
    stageCode: null,
    title: 'Preexisting non-stage task',
  });
  const existingClient = await seedTask({
    departmentId: dClient,
    title: 'Preexisting client stage task',
  });
  const existingInactive = await seedTask({
    departmentId: dInactive,
    title: 'Preexisting inactive-department task',
  });
  const existingNoLead = await seedTask({
    departmentId: dNoLead,
    title: 'Preexisting task without active lead',
  });
  const taskHistory = {
    entity_type: 'task',
    entity_id: backfillEligible.id,
    action: 'completed_before_assignment',
    detail: { status: 'Complete', source: 'local regression fixture' },
  };
  await db.query(
    'INSERT INTO audit_events(organization_id, actor_id, entity_type, entity_id, action, detail) VALUES($1,$2,$3,$4,$5,$6)',
    [org, admin, taskHistory.entity_type, taskHistory.entity_id, taskHistory.action, taskHistory.detail]
  );

  // Apply the target migration only to this in-process PGlite database so the
  // seeded rows exercise its backfill as well as its future-insert trigger.
  await db.exec(fs.readFileSync(
    path.join(root, 'supabase/migrations/20261101010231_stage_task_lead_assignment.sql'),
    'utf8'
  ));

  const backfilledTasks = await db.query(
    'SELECT id, assignee_id, status, priority, stage_code, is_custom FROM tasks WHERE id = ANY($1::uuid[])',
    [[backfillEligible.id, explicitAssignment.id, existingCustom.id, existingNonStage.id, existingClient.id, existingInactive.id, existingNoLead.id]]
  );
  const backfilledById = new Map(backfilledTasks.rows.map((row) => [row.id, row]));
  assert.equal(backfilledById.get(backfillEligible.id).assignee_id, mids[ehwLead]);
  assert.equal(backfilledById.get(backfillEligible.id).status, 'Complete', 'backfill preserves task state');
  assert.equal(backfilledById.get(backfillEligible.id).priority, 'High');
  assert.equal(backfilledById.get(backfillEligible.id).stage_code, 'HW_01');
  assert.equal(backfilledById.get(backfillEligible.id).is_custom, false);
  assert.equal(backfilledById.get(explicitAssignment.id).assignee_id, mids[employee], 'backfill preserves explicit employee assignment');
  for (const task of [existingCustom, existingNonStage, existingClient, existingInactive, existingNoLead]) {
    assert.equal(backfilledById.get(task.id).assignee_id, null, `${task.title} receives no inferred assignee`);
  }
  const savedTaskHistory = await db.query(
    'SELECT entity_type, entity_id, action, detail FROM audit_events WHERE entity_id=$1',
    [backfillEligible.id]
  );
  assert.deepEqual(savedTaskHistory.rows[0], taskHistory, 'backfill does not rewrite task audit history');

  const insertedGenerated = await seedTask({
    departmentId: dEhw,
    title: 'New generated stage task',
  });
  assert.equal(insertedGenerated.assignee_id, mids[ehwLead], 'new generated task uses active same-department lead');
  const insertedExplicit = await seedTask({
    departmentId: dEhw,
    assigneeId: mids[employee],
    title: 'New explicit employee assignment',
  });
  assert.equal(insertedExplicit.assignee_id, mids[employee], 'trigger preserves explicit employee assignment');
  const insertedCustom = await seedTask({
    departmentId: dEhw,
    isCustom: true,
    title: 'New custom stage task',
  });
  assert.equal(insertedCustom.assignee_id, null, 'trigger does not assign custom tasks');
  for (const [departmentId, title] of [
    [dClient, 'New client task'],
    [dInactive, 'New inactive-department task'],
    [dNoLead, 'New task without active lead'],
  ]) {
    const inserted = await seedTask({ departmentId, title });
    assert.equal(inserted.assignee_id, null, `${title} receives no inferred assignee`);
  }

  // Create department roles and assignments
  for (const [id] of [[dEhw], [dPur], [dSal]]) {
    await db.query(
      "INSERT INTO department_roles(organization_id, department_id, role_key, name) VALUES($1, $2, 'test_employee', 'Staff') ON CONFLICT DO NOTHING",
      [org, id]
    );
  }
  const ehwRole = (
    await db.query("SELECT id FROM department_roles WHERE organization_id = $1 AND department_id = $2 AND role_key = 'test_employee'", [org, dEhw])
  ).rows[0];
  if (ehwRole) {
    await db.query("INSERT INTO department_role_assignments(role_id, member_id, assigned_by) VALUES($1, $2, $3) ON CONFLICT DO NOTHING", [ehwRole.id, mids[employee], admin]);
  }

  async function asUser(user, callback) {
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user ?? '']);
    await db.exec('SET ROLE authenticated');
    try {
      return await callback();
    } finally {
      await db.exec('RESET ROLE');
    }
  }

  async function call(user, action, payload, key = crypto.randomUUID()) {
    if (action === 'advance_stage' && !payload.expected_updated_at) {
      payload = {...payload, expected_updated_at:(await db.query('SELECT updated_at FROM operational_records WHERE id=$1',[payload.project_id])).rows[0].updated_at.toISOString()};
    }
    return asUser(user, async () => {
      const res = await db.query(
        'SELECT mutate_shared_test_workspace($1,$2::jsonb,$3) as result',
        [action, JSON.stringify(payload), key]
      );
      return res.rows[0].result;
    });
  }

  // ==========================================
  // TEST 1: Atomic Canonical Sample Pack Sync
  // ==========================================
  // Viewer cannot sync
  await assert.rejects(call(viewer, 'sync_canonical_sample_pack', { p_run_id: 'LC2-2026-10-28' }), /TEST_WRITE_DENIED/);

  // Admin executes sync
  const syncRes = await call(admin, 'sync_canonical_sample_pack', { p_run_id: 'LC2-2026-10-28' });
  assert.equal(syncRes.status, 'synced_new', 'Initial sync must create new sample pack');
  assert.ok(syncRes.persisted_count >= 30, 'Persisted count must be >= 30 across projects, records, documents, tasks');

  // Verify S02 invariant: NO project created for LC2-E02
  const e02Project = await db.query(
    "SELECT * FROM operational_records WHERE organization_id = $1 AND record_type = 'Project' AND reference = 'ENQ-DECL-001'",
    [org]
  );
  assert.equal(e02Project.rows.length, 0, 'S02 invariant: Strictly NO project record created for declined enquiry');

  const e02Enquiry = await db.query(
    "SELECT * FROM operational_records WHERE organization_id = $1 AND record_type = 'Enquiry' AND reference = 'ENQ-DECL-001'",
    [org]
  );
  assert.equal(e02Enquiry.rows.length, 1, 'LC2-E02 enquiry must be persisted');

  // Verify connected records and documents exist
  const p01Sch = await db.query(
    "SELECT * FROM operational_records WHERE organization_id = $1 AND reference = 'HLPL-JIG-EHW-SCH-01'",
    [org]
  );
  assert.equal(p01Sch.rows.length, 1, 'P01 Schematic deliverable must be created');

  const p01Bom = await db.query(
    "SELECT * FROM operational_records WHERE organization_id = $1 AND reference = 'HLPL-JIG-EHW-BOM-01'",
    [org]
  );
  assert.equal(p01Bom.rows.length, 1, 'P01 BOM deliverable must be created');

  const p01Doc = await db.query(
    "SELECT * FROM documents WHERE organization_id = $1 AND title = 'EOL Test Jig Pogo-Pin Fixture Drawing'",
    [org]
  );
  assert.equal(p01Doc.rows.length, 1, 'P01 Document must be created');

  const p01Tasks = await db.query(
    "SELECT * FROM tasks WHERE organization_id = $1 AND stage_code = 'HW_31'",
    [org]
  );
  assert.ok(p01Tasks.rows.length >= 2, 'P01 tasks must be created in tasks table');

  const p01Links = await db.query(
    "SELECT * FROM record_links WHERE organization_id = $1 AND target_record_id = $2",
    [org, p01Sch.rows[0].id]
  );
  assert.equal(p01Links.rows.length, 1, 'Record links must connect project to deliverable record');

  // Verify S06 production arithmetic
  const p06Project = (
    await db.query(
      "SELECT * FROM operational_records WHERE organization_id = $1 AND record_type = 'Project' AND reference = 'PRJ-PROD-001'",
      [org]
    )
  ).rows[0];
  assert.ok(p06Project, 'PRJ-PROD-001 must exist');
  const f = p06Project.fields;
  assert.equal(f.acceptedUnits, 150);
  assert.equal(f.heldUnits, 5);
  assert.equal(f.pendingInspectionUnits, 45);
  assert.equal(f.lotQuantity, 200);
  assert.equal(f.totalPlannedUnits, 500);
  assert.equal(f.remainingPlannedUnits, 300);
  assert.equal(f.acceptedUnits + f.heldUnits + f.pendingInspectionUnits, f.lotQuantity);
  assert.equal(f.totalPlannedUnits - f.lotQuantity, f.remainingPlannedUnits);

  // Idempotency: Replaying sync does NOT duplicate records
  const countBefore = (await db.query('SELECT count(*) as c FROM operational_records WHERE organization_id = $1', [org])).rows[0].c;
  const replayRes = await call(admin, 'sync_canonical_sample_pack', { p_run_id: 'LC2-2026-10-28' });
  assert.equal(replayRes.status, 'already_synced');
  const countAfter = (await db.query('SELECT count(*) as c FROM operational_records WHERE organization_id = $1', [org])).rows[0].c;
  assert.equal(countBefore, countAfter, 'Replay sync must create 0 duplicate records');

  // ==========================================
  // TEST 2: Stage Advance Authorization & Stage Validation
  // ==========================================
  const projectId = p06Project.id;

  // Advancing to an invalid stage code MUST fail
  await assert.rejects(
    call(admin, 'advance_stage', { project_id: projectId, target_stage: 'NOT_A_STAGE' }),
    /INVALID_STAGE_CODE/
  );

  // EHW lead attempting to advance a Sales-owned project / commercial stage MUST fail
  await assert.rejects(
    call(ehwLead, 'advance_stage', { project_id: projectId, target_stage: 'CM_02' }),
    /STAGE_ADVANCE_DENIED/
  );

  // EHW lead attempting to advance to CL_02 (release/closure) MUST fail (only QA/SAL/Admin)
  await assert.rejects(
    call(ehwLead, 'advance_stage', { project_id: projectId, target_stage: 'CL_02' }),
    /STAGE_ADVANCE_DENIED/
  );

  // A sample's current-stage label is not approval evidence.
  await assert.rejects(call(admin,'advance_stage',{project_id:projectId,target_stage:'CL_02'}),/PREREQUISITES_NOT_MET/);

  // ==========================================
  // TEST 3: Custom Task Stage Validation & Lifecycle Safeguards
  // ==========================================
  // Custom task with invalid stage code MUST fail
  await assert.rejects(
    call(ehwLead, 'create_custom_task', {
      project_id: projectId,
      stage_code: 'NOT_A_STAGE',
      title: 'Invalid Stage Task',
    }),
    /INVALID_STAGE_CODE/
  );

  // Valid custom task succeeds
  const customTaskRes = await call(ehwLead, 'create_custom_task', {
    project_id: projectId,
    stage_code: 'HW_05',
    title: 'High-Speed Signal Integrity Simulation',
    priority: 'High',
    order_index: 3,
  });
  const customTaskId = customTaskRes.id;
  assert.ok(customTaskId);

  const taskRow = (await db.query('SELECT * FROM tasks WHERE id = $1', [customTaskId])).rows[0];
  assert.equal(taskRow.is_custom, true);
  assert.equal(taskRow.stage_code, 'HW_05');

  // Updating task without expected_updated_at MUST fail
  await assert.rejects(
    call(ehwLead, 'update_task', {
      id: customTaskId,
      title: 'No Version Update',
    }),
    /EXPECTED_UPDATED_AT_REQUIRED/
  );

  // Updating task with stale version MUST fail
  await assert.rejects(
    call(ehwLead, 'update_task', {
      id: customTaskId,
      title: 'Stale update',
      expected_updated_at: new Date(Date.now() - 60000).toISOString(),
    }),
    /STALE_WRITE/
  );

  // Update task with valid version succeeds
  await call(ehwLead, 'update_task', {
    id: customTaskId,
    title: 'High-Speed Signal Integrity Simulation (DDR3 + PCIe)',
    priority: 'Critical',
    expected_updated_at: taskRow.updated_at.toISOString(),
  });
  const updatedRow = (await db.query('SELECT * FROM tasks WHERE id = $1', [customTaskId])).rows[0];
  assert.equal(updatedRow.title, 'High-Speed Signal Integrity Simulation (DDR3 + PCIe)');

  // Cancelling task without expected_updated_at MUST fail
  await assert.rejects(
    call(ehwLead, 'cancel_task', {
      id: customTaskId,
      reason: 'Valid reason here',
    }),
    /EXPECTED_UPDATED_AT_REQUIRED/
  );

  // Cancelling task without substantive reason (< 5 chars) MUST fail
  await assert.rejects(
    call(ehwLead, 'cancel_task', {
      id: customTaskId,
      reason: 'No',
      expected_updated_at: updatedRow.updated_at.toISOString(),
    }),
    /CANCELLATION_REASON_REQUIRED/
  );

  // Cancelling task with valid substantive reason succeeds
  await call(ehwLead, 'cancel_task', {
    id: customTaskId,
    reason: 'Simulation waived per external accredited lab report',
    expected_updated_at: updatedRow.updated_at.toISOString(),
  });
  const cancelledRow = (await db.query('SELECT * FROM tasks WHERE id = $1', [customTaskId])).rows[0];
  assert.equal(cancelledRow.status, 'Cancelled');
  assert.equal(cancelledRow.cancellation_reason, 'Simulation waived per external accredited lab report');
  assert.ok(cancelledRow.cancelled_at);

  // Deleting a non-custom canonical template task MUST fail
  const canonicalTask = (await db.query("SELECT * FROM tasks WHERE organization_id = $1 AND is_custom = false LIMIT 1", [org])).rows[0];
  assert.ok(canonicalTask);
  await assert.rejects(
    call(admin, 'delete_task', {
      id: canonicalTask.id,
      expected_updated_at: canonicalTask.updated_at.toISOString(),
    }),
    /CANNOT_DELETE_CANONICAL_TASK/
  );

  // Safe deletion of unused custom task succeeds
  const unassignedUnused = await call(ehwLead, 'create_custom_task', {
    project_id: projectId,
    stage_code: 'HW_05',
    title: 'Temporary Task to Delete',
  });
  const unassignedRow = (await db.query('SELECT * FROM tasks WHERE id = $1', [unassignedUnused.id])).rows[0];
  await call(ehwLead, 'delete_task', {
    id: unassignedUnused.id,
    expected_updated_at: unassignedRow.updated_at.toISOString(),
  });
  const deletedCheck = await db.query('SELECT * FROM tasks WHERE id = $1', [unassignedUnused.id]);
  assert.equal(deletedCheck.rows.length, 0, 'Unassigned unused custom task deleted cleanly');

  // ==========================================
  // TEST 4: Fail-closed Downstream Master Guards
  // ==========================================
  // Creating PO without supplier MUST fail
  await assert.rejects(
    call(purLead, 'create_record', {
      record_type: 'Purchase order',
      reference: 'HLPL-PUR-PO-FAIL-01',
      title: 'Missing Supplier PO',
      project_id: projectId,
      fields: { revision: '01' },
    }),
    /SUPPLIER_REQUIRED/
  );

  // Updating PO to remove supplier MUST fail
  const validSup = (
    await db.query(
      "INSERT INTO operational_records(organization_id, department_id, area, record_type, reference, title, status, fields, created_by, updated_by) VALUES($1, $2, 'pur', 'Supplier', 'HLPL-SUP-V01', 'Test Verified Supplier', 'approved', '{\"verification_status\":\"Approved\",\"revision\":\"01\"}'::jsonb, $3, $3) RETURNING id",
      [org, dPur, admin]
    )
  ).rows[0].id;

  const validPO = (
    await call(purLead, 'create_record', {
      record_type: 'Purchase order',
      reference: 'HLPL-PUR-PO-OK-01',
      title: 'Valid Supplier PO',
      project_id: projectId,
      fields: { revision: '01', supplier_id: validSup },
    })
  ).id;
  assert.ok(validPO);

  const poRow = (await db.query('SELECT * FROM operational_records WHERE id = $1', [validPO])).rows[0];
  await assert.rejects(
    call(purLead, 'update_record', {
      record_id: validPO,
      expected_updated_at: poRow.updated_at.toISOString(),
      fields: { revision: '02' }, // Missing supplier
    }),
    /SUPPLIER_REQUIRED/
  );

  // ==========================================
  // TEST 5: Four Blocker Verifications
  // ==========================================
  // Blocker 3: Stage catalogue mismatch
  // Verify 89 canonical stages in table
  const countRes = await db.query('SELECT count(*) as count FROM public.canonical_stage_templates');
  assert.equal(Number(countRes.rows[0].count), 89, 'Exact 89 canonical stage templates in public.canonical_stage_templates');

  // is_valid_canonical_stage recognizes valid codes FW_13, SW_11, C01..C15
  for (const validCode of ['FW_13', 'SW_11', 'C01', 'C02', 'C15']) {
    const res = await db.query('SELECT public.is_valid_canonical_stage($1) as valid', [validCode]);
    assert.equal(res.rows[0].valid, true, `Stage ${validCode} must be valid canonical stage`);
  }

  // is_valid_canonical_stage rejects non-canonical codes MECH_01..14, CL_04, Stage 1..9
  for (const invalidCode of ['MECH_01', 'MECH_14', 'CL_04', 'Stage 1', 'Stage 9', 'NOT_A_STAGE']) {
    const res = await db.query('SELECT public.is_valid_canonical_stage($1) as valid', [invalidCode]);
    assert.equal(res.rows[0].valid, false, `Stage ${invalidCode} must be rejected as non-canonical`);
  }

  // Attempting to advance to non-canonical stage MUST fail with INVALID_STAGE_CODE
  await assert.rejects(
    call(admin, 'advance_stage', { project_id: projectId, target_stage: 'MECH_01' }),
    /INVALID_STAGE_CODE/
  );
  await assert.rejects(
    call(admin, 'advance_stage', { project_id: projectId, target_stage: 'CL_04' }),
    /INVALID_STAGE_CODE/
  );

  // Blocker 1 & 4: Prerequisites bypassed and progressive task generation
  // Create a fresh project (starts at CM_01)
  const freshProject = await call(salLead, 'create_project', {
    reference: 'HLPL-FRESH-PREREQ-01',
    title: 'Fresh Project for Prerequisite and Task Generation Test',
    track: 'hardware_firmware_software',
  });
  const freshProjectId = freshProject.id;
  assert.ok(freshProjectId);

  // Verify that fresh project has progressive tasks for CM_01 generated
  const freshTasks = (
    await db.query('SELECT * FROM tasks WHERE record_id = $1 AND stage_code = $2 ORDER BY order_index', [
      freshProjectId,
      'CM_01',
    ])
  ).rows;
  assert.equal(freshTasks.length, 2, 'Fresh project automatically generates 2 default tasks for CM_01');
  assert.equal(freshTasks[0].order_index, 1);
  assert.equal(freshTasks[1].order_index, 2);
  assert.equal(freshTasks[0].status, 'Open');

  // Blocker 1: Fresh project jumping directly to CL_03 closure MUST fail
  await assert.rejects(
    call(admin, 'advance_stage', { project_id: freshProjectId, target_stage: 'CL_03' }),
    /PREREQUISITES_NOT_MET/
  );

  // Fresh project jumping to HW_32 or CM_03 MUST also fail
  await assert.rejects(
    call(admin, 'advance_stage', { project_id: freshProjectId, target_stage: 'HW_32' }),
    /PREREQUISITES_NOT_MET/
  );
  await assert.rejects(
    call(admin, 'advance_stage', { project_id: freshProjectId, target_stage: 'CM_03' }),
    /PREREQUISITES_NOT_MET/
  );

  // Completion requires finished tasks and a separate authorized decision.
  await assert.rejects(call(salLead,'advance_stage',{project_id:freshProjectId,target_stage:'CM_02'}),/PREREQUISITES_NOT_MET/);
  for (const task of freshTasks) {
    await call(salLead,'update_task',{id:task.id,status:'Complete',expected_updated_at:task.updated_at.toISOString()});
  }
  const review=await call(salLead,'request_stage_completion',{project_id:freshProjectId,stage_code:'CM_01',expected_updated_at:(await db.query('SELECT updated_at FROM operational_records WHERE id=$1',[freshProjectId])).rows[0].updated_at.toISOString()});
  const reviewApproval=(await db.query('SELECT * FROM approvals WHERE record_id=$1',[review.id])).rows[0];
  await call(admin,'decide_approval',{id:reviewApproval.id,outcome:'approved',expected_updated_at:reviewApproval.updated_at.toISOString()});

  // Advancing fresh project from CM_01 to eligible next stage CM_02 succeeds
  await call(salLead, 'advance_stage', {
    project_id: freshProjectId,
    target_stage: 'CM_02',
    notes: 'Completed CM_01 input capture, proceeding to feasibility review',
  });

  // Verify that project stage is updated and completedStages contains CM_01
  const updatedFreshPrj = (await db.query('SELECT * FROM operational_records WHERE id = $1', [freshProjectId])).rows[0];
  assert.equal(updatedFreshPrj.stage, 'CM_02');
  assert.deepEqual(updatedFreshPrj.fields.completedStages, ['CM_01']);

  // Blocker 4: Advancing project automatically creates progressive tasks for CM_02 in public.tasks
  const cm02Tasks = (
    await db.query('SELECT * FROM tasks WHERE record_id = $1 AND stage_code = $2 ORDER BY order_index', [
      freshProjectId,
      'CM_02',
    ])
  ).rows;
  assert.equal(cm02Tasks.length, 2, 'Advancing to CM_02 automatically generates 2 default tasks for CM_02');
  assert.equal(cm02Tasks[0].title, 'Collect relevant departmental feasibility remarks and risks');
  assert.equal(cm02Tasks[1].title, 'Record accepted scope or reasoned decline without creating a dummy project');
  assert.equal(cm02Tasks[0].status, 'Open');

  // Blocker 2: Track restrictions server-side
  // Create a software_only project
  const swProject = await call(salLead, 'create_project', {
    reference: 'HLPL-SW-ONLY-01',
    title: 'Software Only Dedicated Project',
    track: 'software_only',
  });
  const swProjectId = swProject.id;

  // EHW lead moving software_only project to HW_37 MUST fail
  await assert.rejects(
    call(ehwLead, 'advance_stage', { project_id: swProjectId, target_stage: 'HW_37' }),
    /STAGE_ADVANCE_DENIED|STAGE_NOT_APPLICABLE_TO_TRACK/
  );

  // Admin moving software_only project to HW_37 MUST fail with STAGE_NOT_APPLICABLE_TO_TRACK
  await assert.rejects(
    call(admin, 'advance_stage', { project_id: swProjectId, target_stage: 'HW_37' }),
    /STAGE_NOT_APPLICABLE_TO_TRACK/
  );

  // Creating custom task for HW_37 on software_only project MUST fail with STAGE_NOT_APPLICABLE_TO_TRACK
  await assert.rejects(
    call(admin, 'create_custom_task', {
      project_id: swProjectId,
      department_id: dEhw,
      stage_code: 'HW_37',
      title: 'Invalid Hardware Task on Software Project',
    }),
    /STAGE_NOT_APPLICABLE_TO_TRACK/
  );

  // Advancing declined project MUST fail with STAGE_GATE_BLOCKED
  const declinedProject = await call(salLead, 'create_project', {
    reference: 'HLPL-DECL-PRJ-01',
    title: 'Declined Customer Project',
    track: 'hardware_firmware',
  });
  await db.query("UPDATE operational_records SET fields = fields || '{\"declined\": true}'::jsonb WHERE id = $1", [declinedProject.id]);
  await assert.rejects(
    call(salLead, 'advance_stage', { project_id: declinedProject.id, target_stage: 'CM_02' }),
    /STAGE_GATE_BLOCKED/
  );

  // Track decision is available only after every requested feasibility reviewer approves.
  const feasibilityOpportunity = await call(salLead, 'create_record', {
    record_type: 'Opportunity',
    reference: 'HLPL-TEST-OPP-TRACK-01',
    title: 'Fictional tracker scope under feasibility',
    fields: { revision: '01', requiredDepartments: 'EHW,PUR', feasibilityDispatchedAt: new Date().toISOString() },
  });
  const ehwReviewId = (await call(salLead, 'request_approval', {
    record_id: feasibilityOpportunity.id,
    reviewer_department_id: dEhw,
  })).id;
  const purReviewId = (await call(salLead, 'request_approval', {
    record_id: feasibilityOpportunity.id,
    reviewer_department_id: dPur,
  })).id;
  async function decideTrack(user, track, requestId = crypto.randomUUID(), expectedUpdatedAt = undefined) {
    const current = expectedUpdatedAt ? new Date(expectedUpdatedAt) : (await db.query('SELECT updated_at FROM operational_records WHERE id=$1', [feasibilityOpportunity.id])).rows[0].updated_at;
    return asUser(user, async () => {
      const result = await db.query('SELECT decide_shared_test_track_after_feasibility($1::jsonb,$2) AS result', [
        JSON.stringify({ opportunityId: feasibilityOpportunity.id, expectedUpdatedAt: current.toISOString(), track }), requestId,
      ]);
      return result.rows[0].result;
    });
  }
  await assert.rejects(decideTrack(salLead, 'hardware_firmware'), /FEASIBILITY_REVIEWS_INCOMPLETE/);
  const ehwApproval = (await db.query('SELECT updated_at FROM approvals WHERE id=$1', [ehwReviewId])).rows[0];
  await call(ehwLead, 'decide_approval', { id: ehwReviewId, expected_updated_at: ehwApproval.updated_at.toISOString(), outcome: 'approved' });
  await assert.rejects(decideTrack(salLead, 'hardware_firmware'), /FEASIBILITY_REVIEWS_INCOMPLETE/);
  const purApproval = (await db.query('SELECT updated_at FROM approvals WHERE id=$1', [purReviewId])).rows[0];
  await call(purLead, 'decide_approval', { id: purReviewId, expected_updated_at: purApproval.updated_at.toISOString(), outcome: 'approved' });
  await assert.rejects(decideTrack(ehwLead, 'hardware_firmware'), /SALES_TRACK_DECISION_DENIED/);
  const trackDecisionRequestId = crypto.randomUUID();
  const trackDecisionExpectedAt = (await db.query('SELECT updated_at FROM operational_records WHERE id=$1', [feasibilityOpportunity.id])).rows[0].updated_at.toISOString();
  const decidedTrack = await decideTrack(salLead, 'hardware_firmware', trackDecisionRequestId);
  assert.equal(decidedTrack.id, feasibilityOpportunity.id);
  assert.equal(decidedTrack.track, 'hardware_firmware');
  const storedTrack = (await db.query('SELECT fields FROM operational_records WHERE id=$1', [feasibilityOpportunity.id])).rows[0].fields;
  assert.equal(storedTrack.projectTrack, 'hardware_firmware');
  assert.match(storedTrack.trackDecisionBasis, /completed internal feasibility reviews/);
  assert.deepEqual(await decideTrack(salLead, 'hardware_firmware', trackDecisionRequestId, trackDecisionExpectedAt), decidedTrack, 'Track decision retry is idempotent');
  await assert.rejects(decideTrack(salLead, 'hardware_only'), /SALES_TRACK_ALREADY_DECIDED/);

  // ==========================================
  // TEST 4: Admin-only shared sample reset
  // ==========================================
  async function resetPack(user, runId = 'LC2-2026-10-28', requestId = crypto.randomUUID()) {
    return asUser(user, async () => {
      const res = await db.query('SELECT reset_shared_test_sample_pack($1,$2) AS result', [runId, requestId]);
      return res.rows[0].result;
    });
  }

  await assert.rejects(resetPack(viewer), /SAMPLE_RESET_ADMIN_REQUIRED/);
  await assert.rejects(resetPack(ehwLead), /SAMPLE_RESET_ADMIN_REQUIRED/);
  await assert.rejects(resetPack(employee), /SAMPLE_RESET_ADMIN_REQUIRED/);
  await assert.rejects(resetPack(admin, 'another-run'), /FIXTURE_RUN_NOT_SUPPORTED/);

  const unrelated = await call(admin, 'create_project', {
    reference: 'HLPL-TEST-KEEP-01',
    title: 'Unrelated TEST workspace project',
    track: 'hardware_only',
  });
  const uploadedDoc = (await call(admin, 'create_document', {
    record_id: p06Project.id,
    title: 'Uploaded customer test drawing',
    document_type: 'Drawing',
    reference_url: 'private',
    visibility: 'internal',
  })).id;
  const uploadedFileId = uuid(910);
  await db.query(
    `INSERT INTO controlled_document_files(id,organization_id,department_id,document_id,revision,storage_path,original_name,content_type,size_bytes,checksum,uploaded_by)
     VALUES($1,$2,$3,$4,'01','TEST/kept-sample-artifact.pdf','kept-sample-artifact.pdf','application/pdf',12,'fictional-test-checksum',$5)`,
    [uploadedFileId, org, dEhw, uploadedDoc, admin]
  );
  await db.query(
    "INSERT INTO storage.objects(bucket_id,name) VALUES('controlled-documents','TEST/kept-sample-artifact.pdf')"
  );
  // Model optional downstream tables so the same scoped cleanup branch is exercised locally.
  await db.exec(`
    CREATE TABLE project_input_sheets(id uuid PRIMARY KEY,organization_id uuid,source_record_id uuid,project_record_id uuid);
    CREATE TABLE project_input_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),sheet_id uuid);
    CREATE TABLE decision_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid,project_id uuid);
    CREATE TABLE customer_change_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid,project_record_id uuid);
    CREATE TABLE customer_change_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid);
    CREATE TABLE customer_change_impacts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid);
  `);
  const inputSheetId = uuid(912);
  const changeRequestId = uuid(913);
  await db.query('INSERT INTO project_input_sheets VALUES($1,$2,$3,$3)', [inputSheetId, org, p06Project.id]);
  await db.query('INSERT INTO project_input_events(sheet_id) VALUES($1)', [inputSheetId]);
  await db.query('INSERT INTO decision_entries(organization_id,project_id) VALUES($1,$2)', [org, p06Project.id]);
  await db.query('INSERT INTO customer_change_requests(id,organization_id,project_record_id) VALUES($1,$2,$3)', [changeRequestId, org, p06Project.id]);
  await db.query('INSERT INTO customer_change_events(request_id) VALUES($1)', [changeRequestId]);
  await db.query('INSERT INTO customer_change_impacts(request_id) VALUES($1)', [changeRequestId]);

  // A stale, explicitly manifested legacy fixture is retired by the same
  // authenticated reset. A linked user-created record and uploaded bytes survive.
  const legacyProjectId = uuid(920);
  const legacyRecordId = uuid(921);
  const legacyDocumentId = uuid(922);
  const legacyDraftDocumentId = uuid(923);
  const legacyTaskId = uuid(924);
  const linkedUserRecordId = uuid(925);
  const legacyFileId = uuid(926);
  const legacyRunId = 'TEST-LIFECYCLE-20261025-001';
  await db.query(
    `INSERT INTO operational_records(id,organization_id,department_id,area,record_type,reference,title,status,stage,fields,is_demo,created_by,updated_by)
     VALUES($1,$2,$3,'project','Project','TEST-OLD-01','Old TEST project · Stage 5','in_review','Stage 5',$4::jsonb,true,$5,$5),
           ($6,$2,$3,'ehw','Schematic','TEST-OLD-01-SCH','Old schematic · Stage 4','draft','Stage 4',$7::jsonb,true,$5,$5),
           ($8,$2,$3,'ehw','Schematic','TEST-OLD-01-USER','User linked draft · Stage 4','draft','Stage 4',$9::jsonb,false,$5,$5)`,
    [legacyProjectId, org, dEhw, JSON.stringify({ stage: 'Stage 5' }), admin,
      legacyRecordId, JSON.stringify({ projectId: legacyProjectId, stage: 'Stage 4' }),
      linkedUserRecordId, JSON.stringify({ projectId: legacyProjectId, stage: 'Stage 4' })]
  );
  await db.query(
    'INSERT INTO record_links(organization_id,source_record_id,target_record_id,relationship,created_by) VALUES($1,$2,$3,\'deliverable\',$4)',
    [org, legacyProjectId, linkedUserRecordId, admin]
  );
  await db.query(
    `INSERT INTO documents(id,organization_id,record_id,title,document_type,reference_url,visibility,created_by)
     VALUES($1,$2,$3,'Legacy uploaded drawing','Drawing','private','internal',$4),
           ($5,$2,$3,'Legacy empty draft','Drawing','private','internal',$4)`,
    [legacyDocumentId, org, legacyRecordId, admin, legacyDraftDocumentId]
  );
  await db.query(
    'INSERT INTO controlled_document_files(id,organization_id,department_id,document_id,revision,storage_path,original_name,content_type,size_bytes,checksum,uploaded_by) VALUES($1,$2,$3,$4,\'01\',\'TEST/legacy-original.pdf\',\'legacy-original.pdf\',\'application/pdf\',10,\'legacy-fictional-checksum\',$5)',
    [legacyFileId, org, dEhw, legacyDocumentId, admin]
  );
  await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('controlled-documents','TEST/legacy-original.pdf')");
  await db.query(
    `INSERT INTO tasks(id,organization_id,department_id,record_id,title,status,priority,created_by,template_task_key)
     VALUES($1,$2,$3,$4,'Legacy fixture task','Open','Normal',$5,$6)`,
    [legacyTaskId, org, dEhw, legacyProjectId, admin, `${legacyRunId}:HW_01:T01`]
  );
  await db.query(
    `INSERT INTO scenario_fixture_manifests(organization_id,run_id,scenario_id,fixture_key,entity_type,record_type,canonical_id,reference,stage)
     VALUES($1,$2,'legacy-test','legacy-project','project','Project',$3,'TEST-OLD-01','Stage 5'),
           ($1,$2,'legacy-test','legacy-record','record','Schematic',$4,'TEST-OLD-01-SCH','Stage 4'),
           ($1,$2,'legacy-test','legacy-file','document','Drawing',$5,'DOC-OLD-01','Stage 4'),
           ($1,$2,'legacy-test','legacy-empty-doc','document','Drawing',$6,'DOC-OLD-02','Stage 4'),
           ($1,$2,'legacy-test','legacy-task','task','Task',$7,'OLD-TASK-01',NULL)`,
    [org, legacyRunId, legacyProjectId, legacyRecordId, legacyDocumentId, legacyDraftDocumentId, legacyTaskId]
  );

  const firstReset = await resetPack(admin, 'LC2-2026-10-28', uuid(911));
  assert.equal(firstReset.status, 'reset_and_restored');
  assert.equal(firstReset.fictional_test_data, true);
  assert.equal(firstReset.binary_files_preserved, true);
  assert.equal(firstReset.legacy_fixture.status, 'legacy_fixture_retired');
  assert.equal(firstReset.legacy_fixture.retired_record_count, 2);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM operational_records WHERE id=ANY($1::uuid[])',
    [[legacyProjectId, legacyRecordId]])).rows[0].count, 0, 'Only manifested legacy sample records are retired');
  assert.equal((await db.query('SELECT count(*)::int AS count FROM operational_records WHERE id=$1',
    [linkedUserRecordId])).rows[0].count, 1, 'An unmanifested user-created record linked to a sample remains');
  assert.equal((await db.query('SELECT count(*)::int AS count FROM documents WHERE id=$1',
    [legacyDocumentId])).rows[0].count, 1, 'Document metadata with an uploaded original remains');
  assert.equal((await db.query('SELECT record_id FROM documents WHERE id=$1',
    [legacyDocumentId])).rows[0].record_id, null, 'Preserved legacy original is detached from retired sample records');
  assert.equal((await db.query('SELECT count(*)::int AS count FROM documents WHERE id=$1',
    [legacyDraftDocumentId])).rows[0].count, 0, 'Empty fixture-only document metadata is retired');
  assert.equal((await db.query('SELECT count(*)::int AS count FROM controlled_document_files WHERE id=$1',
    [legacyFileId])).rows[0].count, 1, 'Legacy uploaded original metadata survives');
  assert.equal((await db.query("SELECT count(*)::int AS count FROM storage.objects WHERE name='TEST/legacy-original.pdf'"))
    .rows[0].count, 1, 'Legacy uploaded original bytes remain untouched');
  assert.equal((await db.query('SELECT count(*)::int AS count FROM tasks WHERE id=$1', [legacyTaskId])).rows[0].count, 0);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM scenario_fixture_manifests WHERE organization_id=$1 AND run_id=$2',
    [org, legacyRunId])).rows[0].count, 0, 'The stale legacy manifest is retired');
  const restoredProject = (await db.query(
    "SELECT * FROM operational_records WHERE organization_id=$1 AND record_type='Project' AND reference='PRJ-PROD-001'",
    [org]
  )).rows[0];
  assert.ok(restoredProject);
  assert.equal(restoredProject.status, 'open');
  assert.match(restoredProject.fields.customer, /fictional TEST customer/);
  assert.equal(restoredProject.fields.acceptedUnits, undefined);
  assert.match(restoredProject.fields.sampleDataNotice, /no customer acceptance or release recorded/);
  assert.match(restoredProject.title, /pilot/i);
  assert.equal((await db.query(
    "SELECT count(*)::int AS count FROM operational_records WHERE organization_id=$1 AND reference='HLPL-TEST-KEEP-01'",
    [org]
  )).rows[0].count, 1, 'Reset must preserve unrelated TEST projects');
  assert.equal((await db.query(
    'SELECT count(*)::int AS count FROM controlled_document_files WHERE id=$1', [uploadedFileId]
  )).rows[0].count, 1, 'Uploaded binary file metadata must survive reset');
  assert.equal((await db.query('SELECT record_id FROM documents WHERE id=$1', [uploadedDoc])).rows[0].record_id, null,
    'Preserved uploaded evidence must be detached from the deleted sample project');
  assert.equal((await db.query(
    "SELECT count(*)::int AS count FROM storage.objects WHERE name='TEST/kept-sample-artifact.pdf'"
  )).rows[0].count, 1, 'Uploaded binary storage object must remain untouched');
  for (const table of ['project_input_sheets','project_input_events','decision_entries','customer_change_requests','customer_change_events','customer_change_impacts']) {
    assert.equal((await db.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count, 0,
      `${table} rows linked to the reset sample must be removed`);
  }
  assert.equal((await db.query('SELECT count(*)::int AS count FROM organizations WHERE id=$1', [org])).rows[0].count, 1);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM organization_members WHERE organization_id=$1', [org])).rows[0].count, 6);
  assert.equal((await db.query(
    "SELECT count(*)::int AS count FROM operational_records WHERE id IN (SELECT canonical_id FROM scenario_fixture_manifests WHERE organization_id=$1 AND run_id='LC2-2026-10-28' AND entity_type IN ('record','project')) AND status IN ('approved','released')",
    [org]
  )).rows[0].count, 0, 'Reset sample must not claim approval or release');
  assert.equal((await db.query(
    `SELECT count(*)::int AS count FROM operational_records record
     WHERE record.id IN (SELECT canonical_id FROM scenario_fixture_manifests WHERE organization_id=$1 AND run_id='LC2-2026-10-28' AND entity_type IN ('record','project'))
       AND (lower(record.title || record.notes || record.fields::text) LIKE '%tata motors%'
         OR lower(record.title || record.notes || record.fields::text) LIKE '%bharat heavy%'
         OR lower(record.title || record.notes || record.fields::text) LIKE '%city delivery express%'
         OR lower(record.title || record.notes || record.fields::text) LIKE '%fastcargo logistics%'
         OR lower(record.title || record.notes || record.fields::text) LIKE '%hexense%')`,
    [org]
  )).rows[0].count, 0, 'Reset must replace legacy customer identities with fictional TEST names');
  assert.equal((await db.query(
    "SELECT count(*)::int AS count FROM tasks WHERE id IN (SELECT canonical_id FROM scenario_fixture_manifests WHERE organization_id=$1 AND run_id='LC2-2026-10-28' AND entity_type='task') AND status='Complete'",
    [org]
  )).rows[0].count, 0, 'Reset sample tasks must return to active work');

  const sampleCount = (await db.query(
    "SELECT count(*)::int AS count FROM scenario_fixture_manifests WHERE organization_id=$1 AND run_id='LC2-2026-10-28'",
    [org]
  )).rows[0].count;
  const secondReset = await resetPack(admin);
  assert.equal(secondReset.status, 'reset_and_restored');
  assert.equal((await db.query(
    "SELECT count(*)::int AS count FROM scenario_fixture_manifests WHERE organization_id=$1 AND run_id='LC2-2026-10-28'",
    [org]
  )).rows[0].count, sampleCount, 'Repeated reset must not duplicate fixture rows');
  const replay = await resetPack(admin, 'LC2-2026-10-28', uuid(911));
  assert.deepEqual(replay, firstReset, 'Request replay must return its idempotent result');
});
