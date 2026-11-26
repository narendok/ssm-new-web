const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const cache = new Map();
function loadSource(name) {
  if (cache.has(name)) return cache.get(name);
  const filePath = path.join(__dirname, `../src/lib/${name}.ts`);
  const compiled = ts.transpileModule(fs.readFileSync(filePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  cache.set(name, loaded.exports);
  new Function("module", "exports", "require", compiled)(loaded, loaded.exports, imported => {
    if (imported.startsWith("./")) return loadSource(imported.slice(2));
    if (imported.startsWith("@/lib/")) return loadSource(imported.slice("@/lib/".length));
    return require(imported);
  });
  cache.set(name, loaded.exports);
  return loaded.exports;
}

const { parseRecordSourcePairs, suggestRecordFieldKey } = loadSource("record-source-ocr");

test("record OCR maps Enquiry title and target date while keeping master links manual", () => {
  const pairs = parseRecordSourcePairs(
    "Enquiry title: Northstar Cargo EV tracker expansion request\nTarget date: 2026-12-15\nCustomer: Northstar Mobility Systems",
  );
  const fields = [
    { key: "__record_title", label: "Record title" },
    { key: "customer", label: "Customer", master: "customers" },
    { key: "targetDate", label: "Target date" },
    { key: "title", label: "Enquiry title" },
  ];

  assert.equal(suggestRecordFieldKey(pairs.find(pair => pair.label === "Enquiry title").label, fields), "title");
  assert.equal(suggestRecordFieldKey(pairs.find(pair => pair.label === "Target date").label, fields), "targetDate");
  assert.equal(suggestRecordFieldKey(pairs.find(pair => pair.label === "Customer").label, fields), "");
});
