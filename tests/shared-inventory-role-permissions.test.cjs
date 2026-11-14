const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");

const ui = fs.readFileSync(
  path.resolve(__dirname, "../src/components/SharedDepartmentRoleConfiguration.tsx"),
  "utf8",
);
const server = fs.readFileSync(
  path.resolve(__dirname, "../src/lib/department-roles.functions.ts"),
  "utf8",
);
const migration = fs.readFileSync(
  path.resolve(__dirname, "../supabase/migrations/20261114224121_shared_inventory_role_permissions.sql"),
  "utf8",
);

const inventoryPermissions = [
  "inventory:issue",
  "inventory:receive",
  "inventory:hold",
  "inventory:release_hold",
];

test("Shared role settings expose the inventory permissions enforced by the ledger", () => {
  for (const permission of inventoryPermissions) {
    assert.match(ui, new RegExp(`\\['${permission.replace(":", ":")}['"]`));
    assert.match(server, new RegExp(`'${permission.replace(":", ":")}'`));
    assert.match(migration, new RegExp(`'${permission.replace(":", ":")}'`));
  }
  assert.match(ui, /Receive against approved purchase orders/);
  assert.match(ui, /Place stock on QA hold/);
  assert.match(ui, /Release stock from QA hold/);
});

test("inventory permission migration only widens the Admin role editor allowlist", () => {
  assert.match(migration, /pg_get_functiondef\('public\.save_shared_department_role\(jsonb\)'::regprocedure\)/);
  assert.match(migration, /SHARED_INVENTORY_ROLE_PERMISSION_PATCH_PRECONDITION/);
  assert.match(migration, /'documents:approve','inventory:issue','inventory:receive','inventory:hold','inventory:release_hold'/);
  assert.doesNotMatch(migration, /\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE)\b/i);
  assert.doesNotMatch(migration, /inventory:adjust/);
});

test("inventory permission migration patches the deployed function without changing its security mode", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE FUNCTION public.save_shared_department_role(p_payload jsonb)
    RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
    AS $function$
    BEGIN
      IF EXISTS(
        SELECT 1 FROM jsonb_array_elements_text(p_payload->'permissions') x
        WHERE x NOT IN ('records:view','records:create','records:edit','tasks:assign',
          'approvals:decide','documents:manage','settings:manage','audit:manage','documents:approve')
      ) THEN RAISE EXCEPTION 'INVALID_ROLE_PERMISSION'; END IF;
      RETURN '{}'::jsonb;
    END
    $function$;
  `);

  await db.exec(migration);
  const definition = (await db.query(
    "SELECT pg_get_functiondef('public.save_shared_department_role(jsonb)'::regprocedure) AS definition",
  )).rows[0].definition;
  assert.match(definition, /SECURITY DEFINER/);
  assert.match(definition, /search_path TO ''/);

  const accepted = await db.query(
    "SELECT public.save_shared_department_role($1::jsonb) AS result",
    [JSON.stringify({ permissions: inventoryPermissions })],
  );
  assert.deepEqual(accepted.rows[0].result, {});
  await assert.rejects(
    db.query(
      "SELECT public.save_shared_department_role($1::jsonb)",
      [JSON.stringify({ permissions: ["inventory:adjust"] })],
    ),
    /INVALID_ROLE_PERMISSION/,
  );
});
