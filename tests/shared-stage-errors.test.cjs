const test = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../src/lib/shared-stage-errors.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleExports = {};
vm.runInNewContext(compiled, { exports: moduleExports, Set, RegExp });

test("missing stage RPC tells the user no stage was changed", () => {
  for (const action of ["request_stage_completion", "advance_stage"]) {
    const message = moduleExports.sharedStageSaveError(action, "PGRST202: Could not find the function in the schema cache");
    assert.match(message, /shared TEST database/i);
    assert.match(message, /No stage change was saved/i);
  }
});

test("missing-RPC wording is limited to stage actions", () => {
  assert.equal(
    moduleExports.sharedStageSaveError("create_record", "PGRST202: Could not find the function in the schema cache"),
    "PGRST202: Could not find the function in the schema cache",
  );
});

test("ordinary stage errors are preserved for actionable feedback", () => {
  const original = "APPROVAL_REQUIRED: stage has pending approvals";
  assert.equal(moduleExports.sharedStageSaveError("advance_stage", original), original);
});
