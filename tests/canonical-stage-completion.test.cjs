const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const root = path.resolve(__dirname, '..');
const uuid = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('Stage completion requires finished work and an independent evidence-bound approval', async (t) => {
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
    return asUser(user, async () => {
      const res = await db.query(
        'SELECT mutate_shared_test_workspace($1,$2::jsonb,$3) as result',
        [action, JSON.stringify(payload), key]
      );
      return res.rows[0].result;
    });
  }


  const created=await call(salLead,'create_project',{reference:'HLPL-TEST-STAGE-01',title:'Stage completion guard',track:'hardware_firmware'});
  const projectId=created.id;
  const project=async()=> (await db.query('SELECT * FROM operational_records WHERE id=$1',[projectId])).rows[0];
  const activate=async(stage)=>call(salLead,'advance_stage',{project_id:projectId,target_stage:stage,expected_updated_at:(await project()).updated_at.toISOString()});
  const request=async()=>call(salLead,'request_stage_completion',{project_id:projectId,stage_code:'CM_01',expected_updated_at:(await project()).updated_at.toISOString()});
  assert.equal((await db.query('SELECT count(*) AS c FROM tasks WHERE record_id=$1',[projectId])).rows[0].c,2);
  await assert.rejects(activate('CM_02'),/PREREQUISITES_NOT_MET/);
  await assert.rejects(request(),/STAGE_WORK_INCOMPLETE/);
  const tasks=(await db.query('SELECT * FROM tasks WHERE record_id=$1 ORDER BY id',[projectId])).rows;
  for(const task of tasks)await call(salLead,'update_task',{id:task.id,status:'Complete',expected_updated_at:task.updated_at.toISOString()});
  // Finishing tasks alone is not stage approval.
  await assert.rejects(activate('CM_02'),/PREREQUISITES_NOT_MET/);
  let review=await request();
  const repeated=await request();assert.equal(review.id,repeated.id);
  const ap=async()=> (await db.query('SELECT * FROM approvals WHERE record_id=$1',[review.id])).rows[0];
  const decide=async(user)=>call(user,'decide_approval',{id:(await ap()).id,outcome:'approved',expected_updated_at:(await ap()).updated_at.toISOString()});
  await assert.rejects(decide(salLead),/SELF_APPROVAL_DENIED/);
  await assert.rejects(decide(ehwLead),/SIGNING_AUTHORITY_DENIED/);
  assert.deepEqual((await project()).fields.completedStages,[]);
  // Evidence changes invalidate a pending review, even when tasks remain Complete.
  const changed=(await db.query('SELECT * FROM tasks WHERE id=$1',[tasks[0].id])).rows[0];
  await call(salLead,'update_task',{id:changed.id,priority:'High',expected_updated_at:changed.updated_at.toISOString()});
  await assert.rejects(decide(admin),/STAGE_REVIEW_STALE/);
  await call(admin,'decide_approval',{id:(await ap()).id,outcome:'returned',notes:'Work changed; submit the current evidence',expected_updated_at:(await ap()).updated_at.toISOString()});
  const oldReviewId=review.id;
  review=await request();assert.notEqual(review.id,oldReviewId);
  await decide(admin);
  assert.ok((await project()).fields.completedStages.includes('CM_01'));
  await activate('CM_02');
  assert.ok(!(await project()).fields.completedStages.includes('CM_02'));
  const count=(await db.query("SELECT count(*) AS c FROM tasks WHERE record_id=$1 AND stage_code='CM_02'",[projectId])).rows[0].c;
  assert.equal(count,2);
  await activate('CM_02');
  assert.equal((await db.query("SELECT count(*) AS c FROM tasks WHERE record_id=$1 AND stage_code='CM_02'",[projectId])).rows[0].c,2);
  await assert.rejects(activate('CL_03'),/PREREQUISITES_NOT_MET/);
  // An independent ready stage can start without falsely completing the current commercial stage.
  await call(ehwLead,'advance_stage',{project_id:projectId,target_stage:'HW_01',expected_updated_at:(await project()).updated_at.toISOString()});
  assert.ok(!(await project()).fields.completedStages.includes('CM_02'));
  assert.equal((await db.query("SELECT count(*) AS c FROM tasks WHERE record_id=$1 AND stage_code='HW_01'",[projectId])).rows[0].c,2);
  await assert.rejects(call(salLead,'update_record',{record_id:review.id,fields:{revision:'02'},expected_updated_at:(await db.query('SELECT updated_at FROM operational_records WHERE id=$1',[review.id])).rows[0].updated_at.toISOString()}),/STAGE_REVIEW_IMMUTABLE/);
  // A raw cancellation update cannot bypass the substantive-reason action.
  const activeTask=(await db.query("SELECT * FROM tasks WHERE record_id=$1 AND stage_code='HW_01' ORDER BY id LIMIT 1",[projectId])).rows[0];
  await assert.rejects(call(ehwLead,'update_task',{id:activeTask.id,status:'Cancelled',expected_updated_at:activeTask.updated_at.toISOString()}),/USE_CANCEL_TASK/);
  // Authenticated callers cannot invoke internal bypass helpers or rewrite templates/review evidence.
  await assert.rejects(asUser(salLead,()=>db.query('SELECT private.ensure_canonical_stage_tasks($1,$2)',[projectId,'CL_03'])),/permission denied/);
  assert.equal((await db.query("SELECT has_table_privilege('authenticated','public.canonical_stage_templates','UPDATE') AS allowed")).rows[0].allowed,false);
  assert.equal((await db.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.canonical_stage_templates'::regclass")).rows[0].relrowsecurity,true);
  const legacy=(await db.query("INSERT INTO operational_records(organization_id,department_id,area,record_type,reference,title,stage,fields,is_demo,created_by,updated_by) VALUES($1,$2,'sal','Project','HLPL-LEGACY-KEEP-01','Retain legacy history','Stage 4','{\"track\":\"hardware_firmware\",\"revision\":\"01\"}',true,$3,$3) RETURNING *",[org,dSal,admin])).rows[0];
  await assert.rejects(call(salLead,'advance_stage',{project_id:legacy.id,target_stage:'CM_01',expected_updated_at:legacy.updated_at.toISOString()}),/LEGACY_LIFECYCLE_REVIEW_REQUIRED/);
  await assert.rejects(call(salLead,'request_stage_completion',{project_id:legacy.id,stage_code:'CM_01',expected_updated_at:legacy.updated_at.toISOString()}),/LEGACY_LIFECYCLE_REVIEW_REQUIRED/);
  assert.equal((await db.query('SELECT stage FROM operational_records WHERE id=$1',[legacy.id])).rows[0].stage,'Stage 4');
});
