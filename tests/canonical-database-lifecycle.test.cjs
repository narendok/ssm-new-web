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
});
