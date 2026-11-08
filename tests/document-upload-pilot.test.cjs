const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
function loadSource(name) {
  const compiled = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, `../src/lib/${name}.ts`), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const loaded = { exports: {} };
  new Function("module", "exports", "require", compiled)(loaded, loaded.exports, imported => imported.startsWith("./") ? loadSource(imported.slice(2)) : require(imported));
  return loaded.exports;
}
const { prepareUploadDraft: prepare, sourceGerberPackages, assertUploadContextCurrent, UPLOAD_TYPES } = loadSource("document-upload-pilot");
const fixture = () => ({
  metadata: {
    title: "Board original",
    type: "GER",
    scope: "internal",
    projectId: "p1",
    departmentId: "hardware",
    revision: "02",
    sourceDocumentId: "",
  },
  file: { name: "board.zip", size: 12, type: "application/zip" },
  projects: [
    { id: "p1", reference: "HLPL-VTU", title: "VTU" },
    { id: "p2", reference: "HLPL-XLC", title: "XLC" },
  ],
  departments: [
    { id: "hardware", code: "EHW", name: "Hardware", active: true },
    { id: "qa", code: "QA", name: "QA", active: true },
  ],
  sourcePackages: [],
  actor: { id: "employee-1", kind: "member", name: "Actual employee", departmentId: "hardware" },
  documentId: "new-document",
  fileId: "new-file",
  checksum: "a".repeat(64),
  timestamp: "2026-10-20T12:00:00Z",
});
test("same generic type serves different projects; upload stays internal Draft and retains original identity", () => {
  const input = fixture(),
    first = prepare(input);
  input.metadata.projectId = "p2";
  const second = prepare(input);
  assert.equal(first.type, second.type);
  assert.equal(first.type, "Gerber ZIP");
  assert.equal(first.lifecycle, "Draft");
  assert.equal(first.classification, "Internal");
  assert.equal(first.projectId, "p1");
  assert.deepEqual(first.linkedRecordRefs, ["HLPL-VTU"]);
  assert.equal(first.localFiles[0].name, "board.zip");
  assert.equal(first.localFiles[0].uploader, "Actual employee");
  assert.equal(first.localFiles[0].storage, "indexeddb");
  assert.equal(first.localFiles[0].checksum, "a".repeat(64));
  assert.equal(first.part, "HLPL-VTU-EHW-GER-02");
  assert.notEqual(first.part, second.part);
  assert.equal(first.approver, undefined);
  assert.equal(first.cloudDocumentId, undefined);
});
test("missing/archived project, wrong department, missing actor and client writes are rejected", () => {
  let x = fixture();
  x.metadata.projectId = "unknown";
  assert.throws(() => prepare(x), /active project/);
  x = fixture();
  x.projects[0].archived = true;
  assert.throws(() => prepare(x), /active project/);
  x = fixture();
  x.metadata.departmentId = "qa";
  assert.throws(() => prepare(x), /authorized owning/);
  x = fixture();
  x.actor.kind = "client";
  assert.throws(() => prepare(x), /internal author/);
  x = fixture();
  x.actor.id = "";
  assert.throws(() => prepare(x), /internal author/);
});
test("common/department uploads have no hidden project association", () => {
  const x = fixture();
  x.metadata.scope = "common";
  assert.throws(() => prepare(x), /must not carry/);
  x.metadata.projectId = "";
  const draft = prepare(x);
  assert.deepEqual(draft.linkedRecordRefs, []);
  assert.equal(draft.projectId, undefined);
  assert.equal(draft.group, "01 Common documents");
});
test("invalid file, empty/oversize file, invalid revision and missing digest cannot create a draft", () => {
  for (const patch of [
    { file: { name: "bad.exe", size: 10, type: "" } },
    { file: { name: "a.zip", size: 0, type: "" } },
    { file: { name: "a.zip", size: 26 * 1024 * 1024, type: "" } },
    { checksum: "not-a-hash" },
  ])
    assert.throws(() => prepare({ ...fixture(), ...patch }));
  const x = fixture();
  x.metadata.revision = "../02";
  assert.throws(() => prepare(x), /valid revision/);
  assert.ok(UPLOAD_TYPES.some((t) => t.id === "STEP"));
  assert.ok(UPLOAD_TYPES.some((t) => t.id === "STL"));
  assert.ok(UPLOAD_TYPES.some((t) => t.id === "DXF"));
});
test("BOM originals accept spreadsheet, CSV and PDF sources as an internal Draft", () => {
  for (const name of ["bom.csv", "bom.xlsx", "bom.pdf"]) {
    const x = fixture();
    x.metadata.type = "BOM";
    x.file = { name, size: 40, type: "application/octet-stream" };
    const draft = prepare(x);
    assert.equal(draft.type, "BOM / parts list");
    assert.equal(draft.lifecycle, "Draft");
    assert.equal(draft.uploadType, "BOM");
    assert.equal(draft.localFiles[0].name, name);
  }
});
test("project lifecycle context travels with a document while legacy stage text stays unmapped", () => {
  const x = fixture();
  x.metadata.type = "BOM";
  x.file = { name: "bom.csv", size: 40, type: "application/octet-stream" };
  x.projects[0].fields = { currentStage: "HW_15", companyPhase: "TG_3" };
  const draft = prepare(x);
  assert.equal(draft.phase, "TG_3 · Detailed Engineering & Prototype Tooling");
  assert.equal(draft.lifecycleStage, "HW_15 · Schematic preparation");
  x.projects[0].fields = { lifecycleStage: "Stage 7 · Production Release" };
  const legacy = prepare(x);
  assert.equal(legacy.phase, undefined);
  assert.equal(legacy.lifecycleStage, "Legacy stage label · Stage 7 · Production Release");
});
test("panel/stencil retain exact source package revision and hash; cross-project and unlinked packages fail", () => {
  for (const type of ["PANEL", "STENCIL"]) {
    const x = fixture();
    x.metadata.type = type;
    x.metadata.sourceDocumentId = "gerber-1";
    assert.throws(() => prepare(x), /Gerber package/);
    x.sourcePackages = [
      { documentId: "gerber-1", projectId: "p2", revision: "01", checksum: "b".repeat(64) },
    ];
    assert.throws(() => prepare(x), /Gerber package/);
    x.sourcePackages[0].projectId = "p1";
    const draft = prepare(x);
    assert.deepEqual(draft.sourcePackage, x.sourcePackages[0]);
    x.sourcePackages[0].revision = "03";
    assert.equal(draft.sourcePackage.revision, "01");
  }
});
test("filename/title never establish a source Gerber link; only explicit project/type/current-file metadata qualify", () => {
  const docs = [
    {
      id: "g1",
      title: "Gerber ZIP",
      type: "Gerber ZIP",
      projectId: "p1",
      revision: "02",
      localFiles: [{ revision: "02", checksum: "a".repeat(64) }],
    },
  ];
  const project = { id: "p1", reference: "HLPL-VTU", title: "VTU" };
  assert.deepEqual(sourceGerberPackages(docs, project), []);
  docs[0].uploadType = "GER";
  assert.equal(sourceGerberPackages(docs, project).length, 1);
  docs[0].localFiles[0].revision = "01";
  assert.deepEqual(sourceGerberPackages(docs, project), []);
  docs[0].localFiles[0].revision = "02";
  assert.deepEqual(sourceGerberPackages(docs, { ...project, id: "p2" }), []);
});
test("concurrent project archival, department disable and source replacement block record commit", () => {
  const x = fixture(),
    draft = prepare(x),
    check = assertUploadContextCurrent;
  assert.doesNotThrow(() => check(draft, x.projects, x.departments, []));
  assert.throws(
    () => check(draft, [{ ...x.projects[0], archived: true }], x.departments, []),
    /project changed/,
  );
  assert.throws(() => check(draft, x.projects, [], []), /department/);
  const source = { documentId: "g1", projectId: "p1", revision: "01", checksum: "b".repeat(64) };
  assert.throws(
    () =>
      check({ ...draft, sourcePackage: source }, x.projects, x.departments, [
        { ...source, revision: "02" },
      ]),
    /Gerber revision changed/,
  );
});
