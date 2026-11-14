const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadSource(name) {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/lib/" + name + ".ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("module", "exports", "require", compiled)(loaded, loaded.exports, require);
  return loaded.exports;
}

const { resolveSharedProjectScope } = loadSource("shared-project-scope");
const workspaceSource = fs.readFileSync(
  path.resolve(__dirname, "../src/components/SharedOperationalWorkspace.tsx"),
  "utf8",
);

test("shared workspace clears a stale demo project selection when authenticated records load", () => {
  const currentProjects = [
    { id: "project-uuid-1", reference: "HLPL-TEST-ORION-01" },
    { id: "project-uuid-2", reference: "HLPL-TEST-TATA-02" },
  ];

  assert.equal(resolveSharedProjectScope("HLPL-SLCT-01", currentProjects), "all");
  assert.equal(
    resolveSharedProjectScope("HLPL-TEST-ORION-01", currentProjects),
    "HLPL-TEST-ORION-01",
  );
  assert.equal(resolveSharedProjectScope("project-uuid-2", currentProjects), "project-uuid-2");
  assert.equal(resolveSharedProjectScope("all", currentProjects), "all");
});

test("shared project-scope validation hook runs before asynchronous loading returns", () => {
  const validationHook = workspaceSource.indexOf("setScope((current) => resolveSharedProjectScope");
  const pendingReturn = workspaceSource.indexOf("if (query.isPending)");
  assert.ok(validationHook >= 0, "project scope validation is wired to authenticated data");
  assert.ok(
    validationHook < pendingReturn,
    "the hook is unconditional across loading and ready renders",
  );
});
