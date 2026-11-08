const { test } = require("node:test");
const assert = require("node:assert/strict");
const { reconcileDemoProjectLifecycle } = require("../src/lib/demo-project-lifecycle.ts");

test("known browser-local projects migrate from legacy labels to canonical phases, stages, and post-feasibility tracks", () => {
  const projects = [
    { type: "Project", reference: "HLPL-BCU-02", stage: "Stage 2 · Multi-Dept Feasibility", fields: { currentStage: "Stage 2 · Multi-Dept Feasibility", lifecycleStage: "Stage 2 · Multi-Dept Feasibility" } },
    { type: "Project", reference: "HLPL-SLCT-01", stage: "Stage 8 · readiness planning", fields: { currentStage: "Stage 8 · readiness planning" } },
  ];

  const [bcu, slct] = reconcileDemoProjectLifecycle(projects);
  assert.equal(bcu.stage, "HW_02");
  assert.equal(bcu.fields.currentStage, "HW_02");
  assert.equal(bcu.fields.lifecycleStage, "HW_02");
  assert.equal(bcu.fields.companyPhase, "TG_1");
  assert.equal(bcu.fields.projectTrack, "hardware_firmware");
  assert.equal(slct.stage, "C13");
  assert.equal(slct.fields.companyPhase, "TG_6");
  assert.doesNotMatch(slct.fields.currentStage, /^Stage\s+\d+/i);
});

test("demo lifecycle reconciliation leaves user projects and already-canonical edits untouched", () => {
  const custom = { type: "Project", reference: "USER-001", stage: "Stage 1", fields: { currentStage: "Stage 1" } };
  const edited = { type: "Project", reference: "HLPL-BCU-02", stage: "HW_03", fields: { currentStage: "HW_03", projectTrack: "hardware_only" } };
  const [unchangedCustom, unchangedCanonical] = reconcileDemoProjectLifecycle([custom, edited]);
  assert.deepEqual(unchangedCustom, custom);
  assert.deepEqual(unchangedCanonical, edited);
});
