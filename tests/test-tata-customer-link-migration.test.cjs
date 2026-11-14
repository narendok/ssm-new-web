const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const migration = fs.readFileSync(
  path.join(__dirname, '..', 'supabase/migrations/20261112233916_register_test_tata_ev_customer_link.sql'),
  'utf8',
);
const orgId = '10000000-0000-4000-8000-000000000001';
const salesId = '10000000-0000-4000-8000-000000000002';
const opportunityId = '10000000-0000-4000-8000-000000000003';
const actorId = '10000000-0000-4000-8000-000000000004';
const customerName = 'Tata Motors Limited · EV Fleet Division';
const customerReference = 'TATA-EV';
const opportunityReference = 'HLPL-GEN-SAL-OPP-AB1E826904DE413E8BD73511FCA134E5-01';

async function setup({ demo = true, name = customerName, reference = customerReference } = {}) {
  const db = new PGlite();
  await db.exec(`
    create table public.organizations(id uuid primary key, name text);
    create table public.departments(id uuid primary key, organization_id uuid, code text, active boolean);
    create table public.operational_records(
      id uuid primary key default gen_random_uuid(), organization_id uuid not null,
      department_id uuid, area text, record_type text, reference text, title text,
      status text default 'draft', fields jsonb default '{}'::jsonb, notes text,
      created_by uuid, updated_by uuid, is_demo boolean default false,
      archived_at timestamptz
    );
    insert into public.organizations values ('${orgId}', 'TEST ONLY · SSM-new1 synthetic workspace');
    insert into public.departments values ('${salesId}', '${orgId}', 'SAL', true);
    insert into public.operational_records(
      id, organization_id, department_id, area, record_type, reference, title,
      status, fields, created_by, updated_by, is_demo
    ) values (
      '${opportunityId}', '${orgId}', '${salesId}', 'sal', 'Opportunity',
      '${opportunityReference}', 'Tata Ace EV 4G Telematics Gateway', 'draft',
      jsonb_build_object('customer', '${name}', 'customerCode', '${reference}'),
      '${actorId}', '${actorId}', ${demo}
    );
  `);
  return db;
}

test('Shared TEST migration creates one draft master from exact demo Opportunity identity and links its ID', async t => {
  const db = await setup();
  t.after(() => db.close());

  await db.exec(migration);
  await db.exec(migration);

  const { rows } = await db.query(`
    select r.id, r.reference, r.title, r.status, r.is_demo, r.fields,
      o.fields->>'customerId' as customer_id,
      o.fields->>'customer_id' as customer_id_alias
    from public.operational_records r
    join public.operational_records o on o.id='${opportunityId}'
    where r.record_type='Customer' and r.reference='${customerReference}'
  `);
  assert.equal(rows.length, 1, 'rerunning the data repair must not duplicate the Customer master');
  assert.equal(rows[0].title, customerName);
  assert.equal(rows[0].status, 'draft');
  assert.equal(rows[0].is_demo, true);
  assert.equal(rows[0].customer_id, rows[0].id);
  assert.equal(rows[0].customer_id_alias, rows[0].id);
  assert.equal(rows[0].fields.sourceOpportunityReference, opportunityReference);
  assert.equal(Object.hasOwn(rows[0].fields, 'email'), false, 'contact details are not copied from the Opportunity');
});

test('Shared TEST migration leaves a non-demo or mismatched Opportunity unchanged', async t => {
  const db = await setup({ demo: false });
  t.after(() => db.close());

  await db.exec(migration);
  const { rows } = await db.query("select count(*)::int as count from public.operational_records where record_type='Customer'");
  const opportunity = (await db.query(`select fields from public.operational_records where id='${opportunityId}'`)).rows[0];
  assert.equal(rows[0].count, 0);
  assert.equal(opportunity.fields.customerId, undefined);
});

test('Shared TEST migration fails closed when the customer code conflicts with another master identity', async t => {
  const db = await setup();
  t.after(() => db.close());
  await db.query(`insert into public.operational_records(organization_id,record_type,reference,title,status,is_demo)
    values ('${orgId}','Customer','${customerReference}','Different customer','draft',true)`);

  await assert.rejects(db.exec(migration), /TEST_TATA_CUSTOMER_MASTER_CONFLICT/);
  const opportunity = (await db.query(`select fields from public.operational_records where id='${opportunityId}'`)).rows[0];
  assert.equal(opportunity.fields.customerId, undefined);
});
