const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");

const migrationPath = path.resolve(
  __dirname,
  "../supabase/migrations/20261114111545_shared_inventory_part_catalog.sql",
);
const hardeningMigrationPath = path.resolve(
  __dirname,
  "../supabase/migrations/20261114114212_harden_shared_inventory_part_catalog.sql",
);
const orgId = "10000000-0000-4000-8000-000000000001";
const actorId = "10000000-0000-4000-8000-000000000002";
const partId = "10000000-0000-4000-8000-000000000003";

test("shared inventory catalog returns only safe, selectable canonical Part fields", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE SCHEMA private;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    CREATE FUNCTION private.is_selectable_master_status(p_status text) RETURNS boolean
      LANGUAGE sql IMMUTABLE AS $$
        SELECT COALESCE(lower(btrim(p_status)), '') NOT IN ('archived','obsolete','rejected','inactive','cancelled','canceled','retired','disabled')
      $$;
    CREATE TABLE public.test_actor (
      organization_id uuid, membership_id uuid, role text, is_client boolean
    );
    CREATE FUNCTION public.resolve_test_membership()
    RETURNS TABLE(organization_id uuid, membership_id uuid, role text, is_client boolean)
    LANGUAGE sql STABLE AS $$ SELECT * FROM public.test_actor $$;
    CREATE TABLE public.operational_records (
      id uuid PRIMARY KEY, organization_id uuid, record_type text, archived_at timestamptz,
      status text, reference text, title text, fields jsonb, is_demo boolean
    );
    INSERT INTO public.test_actor VALUES ('${orgId}','${actorId}','admin',false);
    INSERT INTO public.operational_records VALUES
      ('${partId}','${orgId}','Part',NULL,'draft','HLPL-DEMO-INV-ELE-01','Controller sample',
       '{"category":"Electronics","subcategory":"Microcontrollers","mpn":"Not recorded","departmentViews":["EHW","PUR"],"primaryDepartment":"EHW","sampleDataNotice":"Fictional sample","secretCost":123.45}'::jsonb,true),
      ('10000000-0000-4000-8000-000000000004','${orgId}','Part',NULL,'archived','OLD-PART','Archived', '{}'::jsonb,false),
      ('10000000-0000-4000-8000-000000000005','${orgId}','Supplier',NULL,'approved','SUP-01','Supplier', '{}'::jsonb,false),
      ('10000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000007','Part',NULL,'approved','OTHER-ORG','Other org', '{}'::jsonb,false);
  `);
  await db.exec(fs.readFileSync(migrationPath, "utf8"));
  await db.exec(fs.readFileSync(hardeningMigrationPath, "utf8"));

  const functionSecurity = await db.query(`
    SELECT
      (SELECT prosecdef FROM pg_proc WHERE oid='public.get_shared_inventory_part_catalog()'::regprocedure) AS public_is_definer,
      (SELECT prosecdef FROM pg_proc WHERE oid='private.read_shared_inventory_part_catalog()'::regprocedure) AS private_is_definer,
      has_function_privilege('authenticated', 'public.get_shared_inventory_part_catalog()', 'EXECUTE') AS authenticated_can_read,
      has_function_privilege('authenticated', 'private.read_shared_inventory_part_catalog()', 'EXECUTE') AS authenticated_can_call_private,
      has_function_privilege('anon', 'public.get_shared_inventory_part_catalog()', 'EXECUTE') AS anon_can_read,
      has_function_privilege('anon', 'private.read_shared_inventory_part_catalog()', 'EXECUTE') AS anon_can_call_private
  `);
  assert.deepEqual(functionSecurity.rows[0], {
    public_is_definer: false,
    private_is_definer: true,
    authenticated_can_read: true,
    authenticated_can_call_private: true,
    anon_can_read: false,
    anon_can_call_private: false,
  });

  await assert.rejects(
    db.query("SELECT public.get_shared_inventory_part_catalog()"),
    /TEST_MEMBERSHIP_REQUIRED/,
  );
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [actorId]);
  await db.exec("SET ROLE authenticated");
  const result = await db.query("SELECT public.get_shared_inventory_part_catalog() AS catalog");
  const catalog = result.rows[0].catalog;
  assert.equal(catalog.stockLedgerAvailable, false);
  assert.equal(catalog.items.length, 1);
  assert.deepEqual(catalog.items[0], {
    id: partId,
    reference: "HLPL-DEMO-INV-ELE-01",
    title: "Controller sample",
    status: "draft",
    mpn: "Not recorded",
    category: "Electronics",
    subcategory: "Microcontrollers",
    primaryDepartment: "EHW",
    departmentViews: ["EHW", "PUR"],
    sampleDataNotice: "Fictional sample",
    isDemo: true,
  });
  assert.equal(JSON.stringify(catalog).includes("secretCost"), false);

  await db.exec("RESET ROLE");
  await db.exec("UPDATE public.test_actor SET role='viewer'");
  await db.exec("SET ROLE authenticated");
  const viewer = await db.query("SELECT public.get_shared_inventory_part_catalog() AS catalog");
  assert.deepEqual(viewer.rows[0].catalog.items, []);
  await db.exec("RESET ROLE");
  await db.exec("UPDATE public.test_actor SET role='member', is_client=true");
  await db.exec("SET ROLE authenticated");
  const client = await db.query("SELECT public.get_shared_inventory_part_catalog() AS catalog");
  assert.deepEqual(client.rows[0].catalog.items, []);
});
