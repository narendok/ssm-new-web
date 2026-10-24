const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadTsModule(relativePath) {
  const filename = path.resolve(__dirname, relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", compiled)(mod, mod.exports);
  return mod.exports;
}

const scenarioLib = loadTsModule("../src/lib/lifecycle-scenarios.ts");
const {
  LIFECYCLE_SCENARIOS,
  getScenario,
  verifyProductionReconciliation,
} = scenarioLib;

test("§14.14: Six realistic lifecycle scenarios are completely defined", () => {
  assert.equal(LIFECYCLE_SCENARIOS.length, 6);
  const ids = LIFECYCLE_SCENARIOS.map((s) => s.id);
  assert.deepEqual(ids, ["S01", "S02", "S03", "S04", "S05", "S06"]);
});

test("§14.14 S01: INTERNAL-JIG has no external client and represents internal equipment", () => {
  const s01 = getScenario("S01");
  assert.ok(s01);
  assert.equal(s01.isExternalClient, false);
  assert.equal(s01.fixtureKey, "INTERNAL-JIG");
  assert.equal(s01.projectCode, "TEST-JIG-01");
  assert.match(s01.stageRemark, /fixture cover clearance remains open/i);
});

test("§14.14 S02: DECLINED-ENQUIRY is terminal enquiry with NO project created", () => {
  const s02 = getScenario("S02");
  assert.ok(s02);
  assert.equal(s02.isExternalClient, true);
  assert.equal(s02.fixtureKey, "DECLINED-ENQUIRY");
  assert.equal(s02.projectCode, undefined, "S02 must NOT create a project!");
  assert.ok(s02.enquiryCode, "S02 must have an enquiry code");
  assert.match(s02.stageRemark, /delivery window cannot accommodate/i);
});

test("§14.14 S03: CLIENT-POC has 10 devices and pending ignition debounce feedback", () => {
  const s03 = getScenario("S03");
  assert.ok(s03);
  assert.equal(s03.fixtureKey, "CLIENT-POC");
  assert.equal(s03.projectCode, "TEST-POC-01");
  assert.match(s03.stageRemark, /ignition-state debounce feedback remains pending/i);
});

test("§14.14 S04: SYSTEM-PILOT has active customer pilot observation period", () => {
  const s04 = getScenario("S04");
  assert.ok(s04);
  assert.equal(s04.fixtureKey, "SYSTEM-PILOT");
  assert.equal(s04.projectCode, "TEST-PILOT-01");
  assert.match(s04.stageRemark, /customer pilot observation period remains open/i);
});

test("§14.14 S05: PILOT-REFINEMENT has completed engineering but pilot remains open with refinements", () => {
  const s05 = getScenario("S05");
  assert.ok(s05);
  assert.equal(s05.fixtureKey, "PILOT-REFINEMENT");
  assert.match(s05.stageRemark, /intermittent alert duplication/i);
});

test("§14.14 S06: BULK-PRODUCTION satisfies mathematical quantity reconciliation (150 + 5 + 45 = 200; 500 - 200 = 300)", () => {
  const s06 = getScenario("S06");
  assert.ok(s06);
  assert.equal(s06.fixtureKey, "BULK-PRODUCTION");
  const rec = s06.productionReconciliation;
  assert.ok(rec, "S06 must provide productionReconciliation");

  assert.equal(rec.totalPlannedUnits, 500);
  assert.equal(rec.lotQuantity, 200);
  assert.equal(rec.acceptedUnits, 150);
  assert.equal(rec.heldUnits, 5);
  assert.equal(rec.pendingInspectionUnits, 45);
  assert.equal(rec.remainingPlannedUnits, 300);

  // Exact math verification
  assert.equal(rec.acceptedUnits + rec.heldUnits + rec.pendingInspectionUnits, rec.lotQuantity);
  assert.equal(rec.totalPlannedUnits - rec.lotQuantity, rec.remainingPlannedUnits);
  assert.equal(verifyProductionReconciliation(rec), true);
});

test("§14.12: Every scenario provides cross-department dependencies with owner, state and next action", () => {
  for (const scenario of LIFECYCLE_SCENARIOS) {
    assert.ok(scenario.dependencies.length > 0, `${scenario.id} must have dependencies`);
    for (const dep of scenario.dependencies) {
      assert.ok(dep.whatNeeded, "Must state what is needed");
      assert.ok(dep.providerDept, "Must state provider department");
      assert.ok(dep.providerLead, "Must state provider lead");
      assert.ok(dep.waitingDept, "Must state who is waiting");
      assert.ok(dep.state, "Must state current dependency state");
      assert.ok(dep.nextAction, "Must state next action");
    }
  }
});
