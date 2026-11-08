const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
function load(name) {
  const compiled = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, `../src/lib/${name}.ts`), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const m = { exports: {} };
  new Function("module", "exports", compiled)(m, m.exports);
  return m.exports;
}
const { searchVisibleItems } = load("portal-search");
const { suggestProjectCode } = load("project-code");
const { singleActiveDestination, matchesWorkspaceDocument } = load("sidebar-selection");
const records = [
  {
    id: "t1",
    reference: "TASK-01",
    title: "Inspect board",
    type: "Task",
    departmentId: "hw",
    notes: "CAN review",
  },
  {
    id: "r1",
    reference: "REVIEW-01",
    title: "Contract review",
    type: "Review",
    departmentId: "sales",
  },
  { id: "p1", reference: "HLPL-VTU", title: "VTU", type: "Project", departmentId: "sales" },
  {
    id: "old",
    reference: "OLD",
    title: "Archived",
    type: "Task",
    departmentId: "hw",
    archived: true,
  },
];
const docs = [
  { id: "d1", title: "Board schematic", type: "Schematic", departmentId: "hw" },
  { id: "d2", title: "Commercial contract", type: "Agreement", departmentId: "sales" },
];
test("search retains department boundaries while allowing explicitly permitted project summaries", () => {
  const found = searchVisibleItems(records, docs, "", "All", "hw", ["p1"]);
  assert.deepEqual(
    found.records.map((r) => r.id),
    ["t1", "p1"],
  );
  assert.deepEqual(
    found.documents.map((d) => d.id),
    ["d1"],
  );
  assert.equal(
    searchVisibleItems(records, docs, "contract", "All", "hw", ["p1"]).records.length,
    0,
  );
  assert.equal(
    searchVisibleItems(records, docs, "contract", "All", "hw", ["p1"]).documents.length,
    0,
  );
});
test("search matches references and notes and correctly separates task/process/document filters", () => {
  assert.deepEqual(
    searchVisibleItems(records, docs, "CAN", "Tasks", "hw").records.map((r) => r.id),
    ["t1"],
  );
  assert.deepEqual(
    searchVisibleItems(records, docs, "REVIEW", "Processes", "sales").records.map((r) => r.id),
    ["r1"],
  );
  assert.equal(searchVisibleItems(records, docs, "", "Documents", "hw").records.length, 0);
  assert.equal(searchVisibleItems(records, docs, "", "Projects", "hw").documents.length, 0);
});
test("search does not duplicate or switch record identity when legacy collections contain repeated IDs", () => {
  const repeated = [records[0], { ...records[0], title: "Stale duplicate" }, ...records];
  const found = searchVisibleItems(repeated, [...docs, ...docs], "", "All", "hw");
  assert.equal(found.records.length, 1);
  assert.equal(found.records[0].title, "Inspect board");
  assert.equal(found.documents.length, 1);
  assert.equal(
    searchVisibleItems(repeated, docs, "Stale duplicate", "All", "hw").records.length,
    0,
  );
  assert.equal(repeated.length, 6);
});
test("project suggestions skip all existing project codes including archived and differently cased references", () => {
  const existing = [
    { type: "Project", reference: "HLPL-PRJ-0001", archived: true },
    { type: "Project", reference: "hlpl-prj-0002" },
    { type: "Project", reference: "HLPL-VTU-01", title: "Separate descriptive title" },
  ];
  assert.equal(suggestProjectCode(existing), "HLPL-PRJ-0003");
  assert.equal(existing[2].title, "Separate descriptive title");
  assert.equal(existing[2].reference, "HLPL-VTU-01");
});
test("sidebar leaves only one canonical item current and preserves navigation callbacks and groups", () => {
  const navigate = () => {};
  const groups = [
    {
      id: "a",
      items: [
        { id: "x", isActive: true, onClick: navigate },
        { id: "y", isActive: true, onClick: navigate },
      ],
    },
    { id: "b", items: [{ id: "z", isActive: true, onClick: navigate }] },
  ];
  const result = singleActiveDestination(groups);
  assert.equal(result.flatMap((g) => g.items).filter((i) => i.isActive).length, 1);
  assert.equal(result[0].items[0].onClick, navigate);
  assert.equal(groups[0].items[1].isActive, true);
  assert.equal(result.length, 2);
});
test("workspace document filters refine visible documents without filename-based access grants", () => {
  assert.equal(
    matchesWorkspaceDocument({ title: "Hardware PRS", type: "Requirements" }, "PRS"),
    true,
  );
  assert.equal(matchesWorkspaceDocument({ title: "Schematic Rev 02", type: "PDF" }, "PRS"), false);
  assert.equal(
    matchesWorkspaceDocument({ title: "Preliminary BOM", type: "XLSX" }, "SCHEMATIC"),
    true,
  );
  assert.equal(matchesWorkspaceDocument({ title: "Gerber", type: "ZIP" }, "DFMEA"), true);
  assert.equal(matchesWorkspaceDocument({ title: "Design verification plan and report", type: "DVP&R report" }, "DVP&R"), true);
  assert.equal(matchesWorkspaceDocument({ title: "8D Corrective Action Report", type: "Controlled technical record" }, "8D CAPA"), true);
  assert.equal(matchesWorkspaceDocument({ title: "Internal note", type: "PDF" }, "unknown"), false);
});

const { isDecisionVisible, assertDecisionSubmission } = load("decision-log-policy");
test("decision visibility defaults to own department; employees see only their submissions", () => {
  const actor = {
    id: "employee",
    kind: "member",
    name: "Employee",
    role: "HW employee",
    department: "EHW",
  };
  const entry = {
    id: "d",
    authorId: "employee",
    actor: "Employee",
    actorRole: "HW employee",
    departmentCode: "EHW",
    scope: "common",
    projectCode: "",
    title: "Change review practice",
    rationale: "Document exception",
    status: "Pending lead review",
  };
  assert.equal(isDecisionVisible(entry, actor), true);
  assert.equal(isDecisionVisible({ ...entry, authorId: "other" }, actor), false);
  assert.equal(isDecisionVisible({ ...entry, departmentCode: "QA" }, actor), false);
  assert.equal(isDecisionVisible(entry, { ...actor, kind: "client" }), false);
  assert.equal(isDecisionVisible(entry, { ...actor, kind: "lead" }), true);
  assert.equal(
    isDecisionVisible({ ...entry, departmentCode: "QA" }, { ...actor, kind: "admin" }),
    true,
  );
});
test("decision submission binds author, department, stage and permitted project without self approval", () => {
  const actor = {
    id: "employee",
    kind: "member",
    name: "Employee",
    role: "HW employee",
    department: "EHW",
  };
  const entry = {
    id: "d",
    authorId: "employee",
    actor: "Employee",
    actorRole: "HW employee",
    departmentCode: "EHW",
    scope: "internal",
    projectCode: "P1",
    stage: "Review",
    title: "Change",
    rationale: "Reason",
    status: "Pending lead review",
  };
  assert.doesNotThrow(() => assertDecisionSubmission(entry, actor, ["P1"], ["Review"]));
  for (const patch of [
    { authorId: "lead" },
    { actor: "Lead" },
    { departmentCode: "QA" },
    { status: "Approved" },
    { projectCode: "P2" },
    { stage: "Old stage" },
    { scope: "common" },
    { title: " " },
  ])
    assert.throws(() =>
      assertDecisionSubmission({ ...entry, ...patch }, actor, ["P1"], ["Review"]),
    );
  assert.doesNotThrow(() =>
    assertDecisionSubmission(
      { ...entry, scope: "common", projectCode: "", stage: undefined },
      actor,
      [],
      [],
    ),
  );
});

test("form defaults never attach hidden hardware, software, purchasing or QA stages to an inquiry", () => {
  const { scopeRecordDefaults } = load("record-form-defaults");
  const original = {
    title: "Inquiry",
    scope: "Customer requirement",
    location: "Office",
    hwStage: "HW_01",
    gate: "G0",
    procurementTrack: "Rapid prototype",
    qualityStage: "APQP",
    assignee: "Employee",
    sourceRecordId: "existing-source",
  };
  const inquiry = scopeRecordDefaults(original, [
    "title",
    "customer",
    "targetDate",
    "location",
    "projectId",
  ]);
  assert.deepEqual(inquiry, {
    title: "Inquiry",
    scope: "Customer requirement",
    location: "Office",
    sourceRecordId: "existing-source",
  });
  assert.equal(scopeRecordDefaults(original, ["hwStage"]).hwStage, "HW_01");
  assert.equal(scopeRecordDefaults(original, ["assignee"]).assignee, "Employee");
  assert.equal(original.qualityStage, "APQP");
});
