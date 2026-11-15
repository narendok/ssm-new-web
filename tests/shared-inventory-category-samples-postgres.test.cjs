const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");

const migration = fs.readFileSync(
  path.resolve(__dirname, "../supabase/migrations/20261115014709_add_shared_inventory_category_samples.sql"),
  "utf8",
);
const testOrgId = "10000000-0000-4000-8000-000000000001";
const otherOrgId = "10000000-0000-4000-8000-000000000002";
const creatorId = "10000000-0000-4000-8000-000000000003";

test("Shared TEST inventory category fixtures add one fictional selectable Part and opening balance per sparse category", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE SCHEMA private;
    CREATE TYPE public.portal_record_status AS ENUM ('draft','open','in_review','approved','released','archived');
    CREATE TABLE public.departments(
      id uuid PRIMARY KEY, organization_id uuid NOT NULL, code text NOT NULL, active boolean NOT NULL DEFAULT true
    );
    CREATE TABLE public.operational_records(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, department_id uuid,
      area text NOT NULL, record_type text NOT NULL, reference text NOT NULL, title text NOT NULL,
      status public.portal_record_status NOT NULL DEFAULT 'draft', priority text NOT NULL DEFAULT 'normal',
      fields jsonb NOT NULL DEFAULT '{}'::jsonb, notes text NOT NULL DEFAULT '',
      created_by uuid NOT NULL, updated_by uuid NOT NULL, archived_at timestamptz,
      is_demo boolean NOT NULL DEFAULT false, UNIQUE (organization_id,reference)
    );
    CREATE TABLE public.shared_inventory_events(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, part_id uuid NOT NULL,
      department_id uuid, event_kind text NOT NULL, on_hand_delta numeric(14,3) NOT NULL DEFAULT 0,
      held_delta numeric(14,3) NOT NULL DEFAULT 0, location text NOT NULL, bin text NOT NULL DEFAULT '',
      note text NOT NULL, is_demo boolean NOT NULL DEFAULT false, fixture_key text
    );
    CREATE UNIQUE INDEX shared_inventory_fixture_key_unique
      ON public.shared_inventory_events(organization_id,fixture_key) WHERE fixture_key IS NOT NULL;
    INSERT INTO public.departments VALUES
      ('10000000-0000-4000-8000-000000000010','${testOrgId}','PUR',true),
      ('10000000-0000-4000-8000-000000000011','${testOrgId}','EMF',true),
      ('10000000-0000-4000-8000-000000000012','${otherOrgId}','PUR',true),
      ('10000000-0000-4000-8000-000000000013','${otherOrgId}','EMF',true);
    INSERT INTO public.operational_records (
      organization_id,department_id,area,record_type,reference,title,fields,created_by,updated_by,is_demo
    ) VALUES
      ('${testOrgId}','10000000-0000-4000-8000-000000000010','pur','Part','HLPL-DEMO-INV-PKG-01','Protective packing material sample',
       '{"category":"Packaging & Consumables","primaryDepartment":"PUR","departmentViews":["PUR","EMF","QA"]}',
       '${creatorId}','${creatorId}',true),
      ('${testOrgId}','10000000-0000-4000-8000-000000000011','emf','Part','HLPL-DEMO-INV-TOOL-01','Harness continuity fixture sample',
       '{"category":"Production Tools","primaryDepartment":"EMF","departmentViews":["EMF","QA","PUR"]}',
       '${creatorId}','${creatorId}',true),
      ('${otherOrgId}','10000000-0000-4000-8000-000000000012','pur','Part','HLPL-DEMO-INV-PKG-01','Non-TEST sample-like source',
       '{"category":"Packaging & Consumables","primaryDepartment":"PUR"}',
       '${creatorId}','${creatorId}',true),
      ('${otherOrgId}','10000000-0000-4000-8000-000000000013','emf','Part','HLPL-DEMO-INV-TOOL-01','Non-TEST sample-like source',
       '{"category":"Production Tools","primaryDepartment":"EMF"}',
       '${creatorId}','${creatorId}',true);
    CREATE FUNCTION private.is_shared_test_org(p_org uuid)
      RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT p_org='${testOrgId}'::uuid $$;
  `);

  await db.exec(migration);
  const parts = await db.query(`
    SELECT reference,title,fields,is_demo,status::text AS status
    FROM public.operational_records
    WHERE organization_id='${testOrgId}' AND reference IN ('HLPL-DEMO-INV-PKG-02','HLPL-DEMO-INV-TOOL-02')
    ORDER BY reference
  `);
  assert.equal(parts.rows.length, 2);
  assert.deepEqual(parts.rows.map((row) => [row.reference,row.fields.category,row.fields.primaryDepartment,row.is_demo,row.status]), [
    ["HLPL-DEMO-INV-PKG-02","Packaging & Consumables","PUR",true,"draft"],
    ["HLPL-DEMO-INV-TOOL-02","Production Tools","EMF",true,"draft"],
  ]);
  assert.ok(parts.rows.every((row) => row.fields.mpn === "Not recorded" && row.fields.sampleDataNotice.includes("Fictional Shared TEST")));
  assert.ok(parts.rows.every((row) => row.fields.fixturePack === "SSM-DEMO-INVENTORY-2026-11-v1.1"));
  assert.deepEqual(parts.rows.map((row) => row.fields.departmentViews), [
    ["PUR","EMF","EHW","QA"],
    ["EMF","QA","PUR","EHW"],
  ]);

  const categoryCounts = await db.query(`
    SELECT fields->>'category' AS category,count(*)::int AS count
    FROM public.operational_records
    WHERE organization_id='${testOrgId}' AND is_demo AND archived_at IS NULL AND record_type='Part'
      AND reference LIKE 'HLPL-DEMO-INV-%'
    GROUP BY fields->>'category' ORDER BY category
  `);
  assert.deepEqual(categoryCounts.rows, [
    { category:"Packaging & Consumables",count:2 },
    { category:"Production Tools",count:2 },
  ]);

  const balances = await db.query(`
    SELECT part.reference,event.on_hand_delta::int AS quantity,event.is_demo,event.fixture_key
    FROM public.shared_inventory_events event
    JOIN public.operational_records part ON part.id=event.part_id
    WHERE event.organization_id='${testOrgId}' ORDER BY part.reference
  `);
  assert.deepEqual(balances.rows, [
    { reference:"HLPL-DEMO-INV-PKG-02",quantity:18,is_demo:true,fixture_key:"shared-test-opening:HLPL-DEMO-INV-PKG-02" },
    { reference:"HLPL-DEMO-INV-TOOL-02",quantity:5,is_demo:true,fixture_key:"shared-test-opening:HLPL-DEMO-INV-TOOL-02" },
  ]);

  const otherOrgRows = await db.query(`
    SELECT count(*)::int AS count FROM public.operational_records
    WHERE organization_id='${otherOrgId}' AND reference IN ('HLPL-DEMO-INV-PKG-02','HLPL-DEMO-INV-TOOL-02')
  `);
  assert.equal(otherOrgRows.rows[0].count, 0, "fixture inserts stay inside the Shared TEST organization");

  await db.exec(migration);
  assert.equal((await db.query("SELECT count(*)::int AS count FROM public.operational_records WHERE reference IN ('HLPL-DEMO-INV-PKG-02','HLPL-DEMO-INV-TOOL-02') AND organization_id=$1",[testOrgId])).rows[0].count,2);
  assert.equal((await db.query("SELECT count(*)::int AS count FROM public.shared_inventory_events WHERE fixture_key LIKE 'shared-test-opening:HLPL-DEMO-INV-%-02'")).rows[0].count,2);
});
