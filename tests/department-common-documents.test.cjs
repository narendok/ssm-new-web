const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../src/lib/demo-common-documents.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", compiled)(mod, mod.exports);
const { demoDepartmentCommonDocuments, mergeDemoDepartmentCommonDocuments } = mod.exports;

const departments = [
  { id: "demo-dept-sit", name: "Service & IT", code: "SIT", active: true },
  { id: "demo-dept-ehw", name: "Embedded Hardware", code: "EHW", active: true },
  { id: "demo-dept-inactive", name: "Inactive", code: "OLD", active: false },
];

test("local demo seeds scoped common-document draft indexes, not fictitious originals or approvals", () => {
  const docs = demoDepartmentCommonDocuments(departments);
  assert.equal(docs.length, 2);
  const sit = docs.find((doc) => doc.departmentId === "demo-dept-sit");
  assert.match(sit.title, /TEST SAMPLE.*Service ticket, access, and backup-review work instruction/);
  assert.equal(sit.uploadScope, "common");
  assert.equal(sit.lifecycle, "Draft");
  assert.match(sit.effectiveDate, /no original file attached/);
  assert.deepEqual(sit.linkedRecordRefs, []);
  assert.equal("localFiles" in sit, false);
});

test("common-document hydration is additive and idempotent", () => {
  const seeded = demoDepartmentCommonDocuments(departments);
  const existing = [{ id: "existing-document", title: "User draft" }, seeded[0]];
  const merged = mergeDemoDepartmentCommonDocuments(existing, departments);
  assert.equal(merged.length, 3);
  assert.equal(merged.filter((doc) => doc.id === seeded[0].id).length, 1);
  assert.equal(merged.find((doc) => doc.id === "existing-document").title, "User draft");
});
