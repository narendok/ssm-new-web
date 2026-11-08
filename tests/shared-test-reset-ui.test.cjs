const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("shared TEST reset is a confirmed Admin-only web action for one fictional run", () => {
  const ui = read("src/components/SharedTestWorkspace.tsx");
  const schema = read("src/lib/shared-test.schema.ts");
  const server = read("src/lib/shared-test.functions.ts");
  const migration = read("supabase/migrations/20261106001444_admin_reset_shared_test_sample_pack.sql");

  assert.match(ui, /admin = actor\.role === "admin"/);
  assert.match(ui, /\{admin && \(/);
  assert.match(ui, /Reset shared TEST sample data/);
  assert.match(ui, /window\.confirm\(/);
  assert.match(ui, /every web and app tester/);
  assert.match(ui, /resetSamplePack\(\{\s*data: \{ runId: "LC2-2026-10-28", requestId: crypto\.randomUUID\(\) \}/);
  assert.match(ui, /Shared TEST sample pack restored for web and app testers/);
  assert.match(ui, /Shared TEST reset is not installed on this backend yet\. No sample data was reset\./);

  assert.match(schema, /runId: z\.literal\("LC2-2026-10-28"\)/);
  assert.match(server, /"reset_shared_test_sample_pack"/);
  assert.match(migration, /member\.role <> 'admin'/);
  assert.match(migration, /FIXTURE_RUN_NOT_SUPPORTED/);
  assert.match(migration, /controlled_document_files file WHERE file\.document_id = document\.id/);
  assert.doesNotMatch(migration, /DELETE FROM public\.controlled_document_files/);
  assert.match(migration, /reset_and_restore/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.reset_shared_test_sample_pack\(text, uuid\) TO authenticated/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.reset_shared_test_sample_pack\(text, uuid\) FROM PUBLIC, anon/);
});
