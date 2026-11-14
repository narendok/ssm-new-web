const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");

const migrationPath = path.resolve(
  __dirname,
  "../supabase/migrations/20261114151645_guard_purchase_order_source_quotation.sql",
);
const orgId = "10000000-0000-4000-8000-000000000001";
const otherOrgId = "10000000-0000-4000-8000-000000000002";
const projectId = "10000000-0000-4000-8000-000000000003";
const otherProjectId = "10000000-0000-4000-8000-000000000004";
const supplierId = "10000000-0000-4000-8000-000000000005";
const otherSupplierId = "10000000-0000-4000-8000-000000000006";
const quoteId = "10000000-0000-4000-8000-000000000007";

async function createDatabase(t) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE SCHEMA private;
    CREATE FUNCTION private.is_shared_test_org(p_org uuid)
      RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT p_org = '${orgId}'::uuid $$;
    CREATE FUNCTION private.is_selectable_master_status(p_status text)
      RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
        SELECT COALESCE(lower(btrim(p_status)), '') NOT IN
          ('archived','obsolete','rejected','inactive','cancelled','canceled','retired','disabled')
      $$;
    CREATE TABLE public.operational_records (
      id uuid PRIMARY KEY,
      organization_id uuid NOT NULL,
      record_type text NOT NULL,
      reference text NOT NULL,
      title text NOT NULL,
      status text NOT NULL,
      archived_at timestamptz,
      fields jsonb NOT NULL DEFAULT '{}'::jsonb
    );
    INSERT INTO public.operational_records VALUES
      ('${projectId}','${orgId}','Project','PRJ-01','Project one','open',NULL,'{}'),
      ('${otherProjectId}','${orgId}','Project','PRJ-02','Project two','open',NULL,'{}'),
      ('${supplierId}','${orgId}','Supplier','SUP-01','Supplier one','approved',NULL,'{}'),
      ('${otherSupplierId}','${orgId}','Supplier','SUP-02','Supplier two','approved',NULL,'{}'),
      ('${quoteId}','${orgId}','Supplier quotation','QT-01','Approved quote','approved',NULL,
        jsonb_build_object('revision','R02','supplierId','${supplierId}','supplier_id','${supplierId}',
                           'projectId','${projectId}','project_id','${projectId}'));
  `);
  await db.exec(fs.readFileSync(migrationPath, "utf8"));
  return db;
}

function poFields(overrides = {}) {
  return {
    sourceQuotationId: quoteId,
    sourceQuotationRevision: "R02",
    supplierId,
    supplier_id: supplierId,
    projectId,
    project_id: projectId,
    ...overrides,
  };
}

async function insertPo(db, id, fields, organizationId = orgId) {
  return db.query(
    `INSERT INTO public.operational_records
      (id, organization_id, record_type, reference, title, status, fields)
     VALUES ($1, $2, 'Purchase order', $3, 'PO test', 'draft', $4::jsonb)`,
    [id, organizationId, `PO-${id.slice(-4)}`, JSON.stringify(fields)],
  );
}

test("Shared TEST accepts a PO linked to the current approved quotation revision", async (t) => {
  const db = await createDatabase(t);
  const poId = "10000000-0000-4000-8000-000000000008";
  await insertPo(db, poId, poFields());
  const result = await db.query(
    "UPDATE public.operational_records SET status='in_review' WHERE id=$1 RETURNING status",
    [poId],
  );
  assert.equal(result.rows[0].status, "in_review");
});

test("Shared TEST rejects unapproved, missing, malformed, stale, or mismatched source quotes", async (t) => {
  const db = await createDatabase(t);
  await db.query("UPDATE public.operational_records SET status='draft' WHERE id=$1", [quoteId]);
  await assert.rejects(
    insertPo(db, "10000000-0000-4000-8000-000000000008", poFields()),
    /SOURCE_QUOTATION_NOT_APPROVED/,
  );

  await db.query("UPDATE public.operational_records SET status='approved' WHERE id=$1", [quoteId]);
  await assert.rejects(
    insertPo(db, "10000000-0000-4000-8000-000000000009", poFields({ sourceQuotationRevision: "R01" })),
    /SOURCE_QUOTATION_REVISION_STALE/,
  );
  await assert.rejects(
    insertPo(db, "10000000-0000-4000-8000-000000000010", poFields({ supplierId: otherSupplierId })),
    /SOURCE_QUOTATION_MASTER_MISMATCH/,
  );
  await assert.rejects(
    insertPo(db, "10000000-0000-4000-8000-000000000011", poFields({ projectId: otherProjectId })),
    /SOURCE_QUOTATION_MASTER_MISMATCH/,
  );
  await assert.rejects(
    insertPo(db, "10000000-0000-4000-8000-000000000012", poFields({ sourceQuotationRevision: "" })),
    /SOURCE_QUOTATION_LINK_INVALID/,
  );
  await assert.rejects(
    insertPo(db, "10000000-0000-4000-8000-000000000013", poFields({ sourceQuotationId: "not-a-uuid" })),
    /SOURCE_QUOTATION_LINK_INVALID/,
  );
});

test("Shared TEST revalidates source quote status and revision before PO review or approval", async (t) => {
  const db = await createDatabase(t);
  const poId = "10000000-0000-4000-8000-000000000008";
  await insertPo(db, poId, poFields());

  await db.query("UPDATE public.operational_records SET status='draft' WHERE id=$1", [quoteId]);
  await assert.rejects(
    db.query("UPDATE public.operational_records SET status='approved' WHERE id=$1", [poId]),
    /SOURCE_QUOTATION_NOT_APPROVED/,
  );

  await db.query(
    "UPDATE public.operational_records SET status='approved', fields=fields || '{\"revision\":\"R03\"}'::jsonb WHERE id=$1",
    [quoteId],
  );
  await assert.rejects(
    db.query("UPDATE public.operational_records SET status='in_review' WHERE id=$1", [poId]),
    /SOURCE_QUOTATION_REVISION_STALE/,
  );

  await assert.rejects(
    db.query(
      "UPDATE public.operational_records SET fields=fields || '{\"sourceQuotationId\":\"\"}'::jsonb WHERE id=$1",
      [poId],
    ),
    /SOURCE_QUOTATION_LINK_INVALID/,
  );
});

test("the source-quotation guard is scoped to the synthetic Shared TEST organization", async (t) => {
  const db = await createDatabase(t);
  await insertPo(
    db,
    "10000000-0000-4000-8000-000000000008",
    poFields({ sourceQuotationId: "invalid", sourceQuotationRevision: "stale" }),
    otherOrgId,
  );
  const count = await db.query("SELECT count(*)::int AS count FROM public.operational_records WHERE record_type='Purchase order'");
  assert.equal(count.rows[0].count, 1);
});
