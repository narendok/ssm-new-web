const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("shared TEST reset stays disabled when its deployed scope exceeds project-only authorization", () => {
  const ui = read("src/components/SharedTestWorkspace.tsx");
  const schema = read("src/lib/shared-test.schema.ts");
  const server = read("src/lib/shared-test.functions.ts");
  const migration = read("supabase/migrations/20261106001444_admin_reset_shared_test_sample_pack.sql");

  assert.match(ui, /admin = actor\.role === "admin"/);
  assert.match(ui, /\{admin && \(/);
  assert.match(ui, /Reset shared TEST sample data \(paused\)/);
  assert.match(ui, /disabled\s+title="Paused because this backend reset also deletes linked fixture records outside the approved project-only scope\."/);
  assert.match(ui, /installed reset also removes manifest-owned tasks,\s+approvals, stage reviews and linked draft records/);
  assert.match(ui, /current unmanifested fictional Projects/);
  assert.doesNotMatch(ui, /resetSamplePack\(\{/);
  assert.doesNotMatch(ui, /resetCanonicalSamplePack/);

  assert.match(server, /"reset_shared_test_sample_pack"/);
  assert.match(migration, /member\.role <> 'admin'/);
  assert.match(migration, /controlled_document_files file WHERE file\.document_id = document\.id/);
  assert.doesNotMatch(migration, /DELETE FROM public\.controlled_document_files/);
  assert.match(migration, /reset_and_restore/);
  assert.match(schema, /runId: z\.literal\("LC2-2026-10-28"\)/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.reset_shared_test_sample_pack\(text, uuid\) TO authenticated/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.reset_shared_test_sample_pack\(text, uuid\) FROM PUBLIC, anon/);
});
