const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const source = fs.readFileSync(
  path.resolve(__dirname, "../src/lib/shared-supplier-directory.ts"),
  "utf8",
);
const loaded = { exports: {} };
new Function(
  "module",
  "exports",
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
)(loaded, loaded.exports);
const { sharedSupplierDirectory } = loaded.exports;

test("supplier directory preserves canonical identities and only enriches authorized supplier records", () => {
  const result = sharedSupplierDirectory({
    supplierOptions: [
      { id: "a", reference: "SUP-A", title: "Old label", status: "draft" },
      { id: "b", reference: "SUP-B", title: "Limited access supplier", status: "approved" },
    ],
    records: [
      {
        id: "a",
        reference: "SUP-A",
        title: "Current supplier",
        status: "approved",
        record_type: "Supplier",
        fields: { spocName: "TEST Contact" },
        notes: "Verified note",
      },
      {
        id: "c",
        reference: "SUP-C",
        title: "Inactive supplier",
        status: "inactive",
        record_type: "Supplier",
        fields: {},
        notes: "",
      },
      { id: "part", reference: "PART-1", title: "Not a supplier", record_type: "Part", fields: {} },
    ],
    documents: [
      { id: "doc-a", record_id: "a", title: "Authorized certificate" },
      { id: "doc-other", record_id: "part", title: "Unrelated document" },
    ],
  });
  assert.equal(result.length, 3);
  const current = result.find((item) => item.id === "a");
  assert.equal(current.title, "Current supplier");
  assert.equal(current.status, "approved");
  assert.equal(current.fields.spocName, "TEST Contact");
  assert.deepEqual(
    current.documents.map((item) => item.id),
    ["doc-a"],
  );
  assert.equal(current.fields.warrantyPeriod, undefined);
  const limited = result.find((item) => item.id === "b");
  assert.equal(limited.hasDetails, false);
  assert.deepEqual(limited.fields, {});
  assert.equal(result.find((item) => item.id === "c").status, "inactive");
});

test("empty shared supplier master remains empty without local sample fallback", () => {
  assert.deepEqual(
    sharedSupplierDirectory({ supplierOptions: [], records: [], documents: [] }),
    [],
  );
});
