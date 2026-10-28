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

  // Load migrations up to our new forward migration
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
    [dSal, 'SAL', admin],
  ]) {
    await db.query(
      'INSERT INTO departments(id, organization_id, name, department_type, code, lead_member_id) VALUES($1,$2,$3,$3,$3,$4)',
      [id, org, code, mids[lead]]
    );
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
  assert.ok(syncRes.persisted_count >= 9, 'Persisted count must be at least 9 entities');

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
  // TEST 2: Custom Task Lifecycle & Safeguards
  // ==========================================
  const projectId = p06Project.id;

  // Create custom task
  const customTaskRes = await call(ehwLead, 'create_custom_task', {
    project_id: projectId,
    stage_code: 'HW_05',
    title: 'High-Speed Signal Integrity Simulation',
    priority: 'High',
    order_index: 3,
  });
  const customTaskId = customTaskRes.id;
  assert.ok(customTaskId);

  // Task exists in database with is_custom = true
  const taskRow = (await db.query('SELECT * FROM tasks WHERE id = $1', [customTaskId])).rows[0];
  assert.equal(taskRow.is_custom, true);
  assert.equal(taskRow.stage_code, 'HW_05');
  assert.equal(taskRow.status, 'Open');
  assert.equal(taskRow.order_index, 3);

  // Update task
  await call(ehwLead, 'update_task', {
    id: customTaskId,
    title: 'High-Speed Signal Integrity Simulation (DDR3 + PCIe)',
    priority: 'Critical',
    expected_updated_at: taskRow.updated_at.toISOString(),
  });
  const updatedRow = (await db.query('SELECT * FROM tasks WHERE id = $1', [customTaskId])).rows[0];
  assert.equal(updatedRow.title, 'High-Speed Signal Integrity Simulation (DDR3 + PCIe)');
  assert.equal(updatedRow.priority, 'Critical');

  // Stale write fails
  await assert.rejects(
    call(ehwLead, 'update_task', {
      id: customTaskId,
      title: 'Stale update',
      expected_updated_at: taskRow.updated_at.toISOString(),
    }),
    /STALE_WRITE/
  );

  // Safe deletion of unused custom task succeeds
  const unassignedUnused = await call(ehwLead, 'create_custom_task', {
    project_id: projectId,
    stage_code: 'HW_05',
    title: 'Temporary Task to Delete',
  });
  await call(ehwLead, 'delete_task', { id: unassignedUnused.id });
  const deletedCheck = await db.query('SELECT * FROM tasks WHERE id = $1', [unassignedUnused.id]);
  assert.equal(deletedCheck.rows.length, 0, 'Unassigned unused task deleted cleanly');

  // Assigned task deletion fails (must cancel instead)
  await call(ehwLead, 'update_task', {
    id: customTaskId,
    assignee_id: mids[employee],
    expected_updated_at: updatedRow.updated_at.toISOString(),
  });
  await assert.rejects(
    call(ehwLead, 'delete_task', { id: customTaskId }),
    /TASK_ASSIGNED_CANNOT_DELETE/
  );

  // Cancellation succeeds with reason
  await call(ehwLead, 'cancel_task', {
    id: customTaskId,
    reason: 'Simulation waived per external lab report',
  });
  const cancelledRow = (await db.query('SELECT * FROM tasks WHERE id = $1', [customTaskId])).rows[0];
  assert.equal(cancelledRow.status, 'cancelled');
  assert.equal(cancelledRow.cancellation_reason, 'Simulation waived per external lab report');
  assert.ok(cancelledRow.cancelled_at);

  // ==========================================
  // TEST 3: Project Stage Advance
  // ==========================================
  await call(admin, 'advance_stage', {
    project_id: projectId,
    target_stage: 'CL_02',
    notes: 'Release decision approved, moving to handover',
  });
  const advancedProject = (await db.query('SELECT * FROM operational_records WHERE id = $1', [projectId])).rows[0];
  assert.equal(advancedProject.stage, 'CL_02');
  assert.equal(advancedProject.fields.currentStage, 'CL_02');
  assert.equal(advancedProject.fields.stageRemark, 'Release decision approved, moving to handover');
});
