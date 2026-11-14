const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const migration = fs.readFileSync(
  path.join(__dirname, '..', 'supabase/migrations/20261112235114_link_test_software_services_to_supplier_masters.sql'),
  'utf8',
);
const orgId = '20000000-0000-4000-8000-000000000001';
const purchasingId = '20000000-0000-4000-8000-000000000002';
const actorId = '20000000-0000-4000-8000-000000000003';

async function setup({ githubProvider = 'GitHub' } = {}) {
  const db = new PGlite();
  await db.exec(`
    create schema private;
    create table public.organizations(id uuid primary key, name text, created_by uuid);
    create table public.departments(id uuid primary key, organization_id uuid, code text, active boolean);
    create table public.operational_records(
      id uuid primary key default gen_random_uuid(), organization_id uuid not null,
      department_id uuid, area text not null, record_type text not null,
      reference text not null, title text not null, status text not null default 'draft',
      fields jsonb not null default '{}'::jsonb, notes text not null default '',
      created_by uuid not null, updated_by uuid not null, is_demo boolean not null default false,
      archived_at timestamptz
    );
    create table private.expense_catalogues(
      organization_id uuid not null, scope text not null, value jsonb not null,
      version integer not null default 1, updated_by uuid not null,
      updated_at timestamptz not null default now(), primary key(organization_id,scope)
    );
    insert into public.organizations values ('${orgId}', 'TEST ONLY · SSM-new1 synthetic workspace', '${actorId}');
    insert into public.departments values ('${purchasingId}', '${orgId}', 'PUR', true);
    insert into public.operational_records(organization_id,area,record_type,reference,title,status,fields,created_by,updated_by,is_demo) values
      ('${orgId}','pur','Supplier','HLPL-SUP-0268F622','trewst','draft','{"name":"trewst"}','${actorId}','${actorId}',true),
      ('${orgId}','pur','Supplier','HLPL-SUP-PEND-01','Shenzhen FastTurn PCB Co','draft','{"name":"Shenzhen FastTurn PCB Co"}','${actorId}','${actorId}',true),
      ('${orgId}','pur','Supplier','HLPL-SUP-VEND-01','Texas Instruments India Pvt Ltd','approved','{"name":"Texas Instruments India Pvt Ltd"}','${actorId}','${actorId}',true);
    insert into private.expense_catalogues(organization_id,scope,value,version,updated_by) values (
      '${orgId}','company',jsonb_build_object('categories',jsonb_build_array('software'),'services',jsonb_build_array(
        jsonb_build_object('id','github','name','GitHub subscription','provider','${githubProvider}'),
        jsonb_build_object('id','zoho','name','Zoho business software','provider','Zoho'),
        jsonb_build_object('id','cloud','name','Cloud hosting & infrastructure','provider','')
      )),6,'${actorId}'
    );
  `);
  return db;
}

test('Shared TEST migration creates draft-only supplier masters and links exact service IDs', async t => {
  const db = await setup();
  t.after(() => db.close());

  await db.exec(migration);
  const suppliers = (await db.query(`
    select id,reference,title,status,is_demo,fields from public.operational_records
    where organization_id='${orgId}' and record_type='Supplier'
    order by reference
  `)).rows;
  const github = suppliers.find(supplier => supplier.reference === 'HLPL-SUP-TEST-GITHUB');
  const zoho = suppliers.find(supplier => supplier.reference === 'HLPL-SUP-TEST-ZOHO');
  assert.ok(github);
  assert.ok(zoho);
  for (const supplier of [github, zoho]) {
    assert.equal(supplier.status, 'draft');
    assert.equal(supplier.is_demo, true);
    assert.equal(supplier.fields.demoOnly, true);
    assert.equal(supplier.fields.verification_status, 'unverified');
    assert.equal(Object.hasOwn(supplier.fields, 'spocEmail'), false);
    assert.equal(Object.hasOwn(supplier.fields, 'bankAccount'), false);
  }

  const catalogue = (await db.query(`
    select value,version from private.expense_catalogues
    where organization_id='${orgId}' and scope='company'
  `)).rows[0];
  const services = catalogue.value.services;
  assert.equal(catalogue.version, 7, 'company catalogue version advances once');
  assert.equal(services.find(service => service.id === 'github').supplierId, github.id);
  assert.equal(services.find(service => service.id === 'github').provider, github.title);
  assert.equal(services.find(service => service.id === 'zoho').supplierId, zoho.id);
  assert.equal(services.find(service => service.id === 'zoho').provider, zoho.title);
  assert.deepEqual(services.find(service => service.id === 'cloud'), {
    id: 'cloud', name: 'Cloud hosting & infrastructure', provider: '',
  }, 'unrelated service remains unchanged');
  assert.deepEqual(catalogue.value.categories, ['software']);
  assert.equal(suppliers.length, 5, 'the three existing Supplier records are preserved');
});

test('Shared TEST migration refuses changed provider identity before creating suppliers', async t => {
  const db = await setup({ githubProvider: 'GitHub Enterprise · verify legal vendor' });
  t.after(() => db.close());

  await assert.rejects(db.exec(migration), /TEST_SOFTWARE_SERVICE_IDENTITY_CHANGED/);
  const suppliers = (await db.query(`
    select count(*)::int as count from public.operational_records
    where organization_id='${orgId}' and record_type='Supplier'
  `)).rows[0];
  const catalogue = (await db.query(`
    select version from private.expense_catalogues
    where organization_id='${orgId}' and scope='company'
  `)).rows[0];
  assert.equal(suppliers.count, 3);
  assert.equal(catalogue.version, 6);
});
