const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript"),
  path = require("node:path");
function load(name) {
  const p = path.join(__dirname, "../src/lib", name + ".ts");
  const m = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(p, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module: m,
      exports: m.exports,
      require: (n) => load(n.replace("./", "")),
      Intl,
      Date,
      Set,
      Map,
    },
  );
  return m.exports;
}
const { projectAnalysis, enquiryAnalysis } = load("project-analysis-data");
const record = (id, type, fields = {}, status = "Draft") => ({
  id,
  reference: id,
  title: id,
  type,
  status,
  fields,
});
test("analysis derives distinct projects and explicit dependencies, leaving sparse projects unknown", () => {
  const p = record("P1", "Project"),
    p2 = record("P2", "Project"),
    sparse = record("P3", "Project");
  const source = record("A", "Specification", { projectId: "P1", department: "EHW" }, "approved");
  const target = record("B", "Review", {
    projectId: "P1",
    department: "QA",
    dependsOn: "A;missing",
  });
  const other = record("C", "Specification", { projectId: "P2", department: "MECH" });
  const rows = [p, p2, sparse, source, target, other];
  const first = projectAnalysis(p, rows, []),
    second = projectAnalysis(p2, rows, []),
    third = projectAnalysis(sparse, rows, []);
  assert.equal(first.inputs.length, 2);
  assert.equal(first.dependencies.length, 2);
  assert.equal(first.dependencies.find((d) => d.reference === "A").blocked, false);
  assert.equal(
    first.dependencies.find((d) => d.reference === "missing").state,
    "Missing / restricted",
  );
  assert.equal(second.inputs.length, 1);
  assert.equal(second.dependencies.length, 0);
  assert.equal(third.inputs.length, 0);
  assert.equal(third.dependencies.length, 0);
  source.status = "Complete";
  assert.equal(
    projectAnalysis(p, rows, []).dependencies.find((d) => d.reference === "A").blocked,
    true,
  );
});
test("enquiry feasibility can exist before a project without inventing project records", () => {
  const rows = [
    record("ENQ-1", "Enquiry"),
    record("FEAS-1", "Feasibility", { enquiryId: "ENQ-1" }),
  ];
  const result = enquiryAnalysis(rows);
  assert.equal(result.length, 1);
  assert.equal(result[0].responses[0].id, "FEAS-1");
  assert.equal(
    rows.some((r) => r.type === "Project"),
    false,
  );
});

test('saved lifecycle history uses persisted data only and rejects malformed values',()=>{
 const {savedLifecycleHistory}=load('project-analysis-data');
 assert.equal(savedLifecycleHistory(undefined).length,0);
 assert.equal(savedLifecycleHistory('invalid').length,0);
 assert.equal(savedLifecycleHistory('{}').length,0);
 const rows=savedLifecycleHistory(JSON.stringify([null,12,{stageId:'A',stageName:'Review',status:'Under_Review',stageRemark:'Awaiting evidence',nextAction:'Complete test'}]));
 assert.equal(rows.length,1);assert.equal(rows[0].name,'Review');assert.equal(rows[0].remark,'Awaiting evidence');assert.equal(rows[0].nextAction,'Complete test');
});
