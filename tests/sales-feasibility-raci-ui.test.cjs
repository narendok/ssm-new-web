const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = relative => fs.readFileSync(path.resolve(__dirname, relative), "utf8");

test("Shared Sales intake displays and pins the current configured feasibility RACI", () => {
  const pipeline = read("../src/components/SharedSalesPipeline.tsx");
  const intake = read("../src/components/SalesWorkspaceAndCustomerRegister.tsx");

  assert.match(pipeline, /stages\.find\(item => item\.code === "CM_02"\)/,
    "Shared Sales reads the feasibility RACI from the saved lifecycle revision");
  assert.match(pipeline, /feasibilityRaci=\{feasibilityRaci\}/,
    "the saved RACI is provided to the intake screen");
  assert.match(intake, /Required reviews · current Settings/,
    "the intake screen labels the Settings-driven reviewers clearly");
  assert.match(intake, /feasibilityRaciRevision: feasibilityRaci\.revision/,
    "dispatch carries the visible settings revision for server-side stale-config rejection");
  assert.match(intake, /disabled=\{settingsDrivenRaci && !feasibilityRaci\}/,
    "dispatch cannot be enabled before its configured RACI is loaded");
});
