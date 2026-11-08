const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(path.resolve("src/lib/expense-suggestions.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
new Function("module", "exports", compiled)(loaded, loaded.exports);
const { suggestExpenseCategoryForStage } = loaded.exports;

test("expense category suggestion uses request and phase context without forcing selection", () => {
  const categories = [
    "Travel & Transport",
    "Engineering & Professional Services",
    "Electronic Components & Sensors",
    "Consumables & Lab Supplies",
    "Testing & External Laboratory Services",
    "Maintenance & Calibration",
  ];
  assert.equal(suggestExpenseCategoryForStage("TG-02 · Design", "travel", categories), "Travel & Transport");
  assert.equal(suggestExpenseCategoryForStage("TG-01 · Feasibility", "purchase", categories), "Engineering & Professional Services");
  assert.equal(suggestExpenseCategoryForStage("TG-04 · Schematic Development", "purchase", categories), "Electronic Components & Sensors");
  assert.equal(suggestExpenseCategoryForStage("TG-05 · Pilot Build", "purchase", categories), "Consumables & Lab Supplies");
  assert.equal(suggestExpenseCategoryForStage("TG-06 · DVP&R Validation", "purchase", categories), "Testing & External Laboratory Services");
  assert.equal(suggestExpenseCategoryForStage("TG-09 · Service", "purchase", categories), "Maintenance & Calibration");
  assert.equal(suggestExpenseCategoryForStage("TG-04 · Design", "reimbursement", categories), "");
  assert.equal(suggestExpenseCategoryForStage("TG-04 · Design", "purchase", categories, "Maintenance & Calibration"), "Maintenance & Calibration");
  assert.equal(suggestExpenseCategoryForStage("TG-04 · Design", "purchase", ["Other"]), "");
});

test("expense form keeps Finance category manual and has no separate business-purpose input", () => {
  const ui = fs.readFileSync(path.resolve("src/components/SharedBusinessWorkspace.tsx"), "utf8");
  assert.match(ui, /select\('category','Finance category'/);
  assert.match(ui, /Use suggestion/);
  assert.doesNotMatch(ui, /field\(['"]purpose['"]/);
  assert.match(ui, /category: values\['category'\]/);
  assert.doesNotMatch(ui, /category:\s*\(values\['requestType'\].*Travel & Transport/);
});
