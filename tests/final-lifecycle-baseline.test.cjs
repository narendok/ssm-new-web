const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const mod = { exports: {} };
  cache.set(name, mod.exports);
  const source = fs.readFileSync(path.join(__dirname, "../src/lib", name + ".ts"), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("module", "exports", "require", js)(mod, mod.exports, (s) =>
    s.startsWith("./") ? load(s.slice(2)) : require(s),
  );
  return mod.exports;
}
const api = load("lifecycle-baseline");
const engine = load("canonical-lifecycle");
const reuse = load("reusable-assets");
const hexa = load("hexa-lifecycle-review");
const extensions=load('lifecycle-stage-extensions');
const uploadAccess=load('stage-upload-access');
test('complete phase catalogue includes all 82 source stages with editable defaults and dependency-safe track filtering',()=>{
  const revision=api.defaultLifecycleRevision();
  assert.equal(revision.stages.length,110);
  for(const binding of extensions.STAGE_DELIVERABLE_BINDINGS){
    const stage=revision.stages.find(stage=>stage.code===binding.stage);
    assert.ok(stage,binding.stage);assert.equal(stage.tasks.length,5);assert.ok(stage.exitTypes.length);
  }
  assert.equal(revision.stages.find(stage=>stage.code==='G8_04').sourceReference.row,77);
  const tailored=structuredClone(revision);tailored.stages.find(stage=>stage.code==='CM_02').prerequisites=['CM_01'];
  tailored.stages.find(stage=>stage.code==='HW_15').exitTypes=[];
  assert.deepEqual(extensions.completeLifecycleDefinitions(tailored),tailored.stages,'Reopening Settings never overwrites saved tailoring');
  const software=api.projectLifecycleStages(revision,'software_only');
  assert.ok(software.some(stage=>stage.code==='G0_05'));
  assert.ok(!software.some(stage=>stage.code==='G0_02'));
  assert.ok(software.every(stage=>stage.prerequisites.every(code=>software.some(prerequisite=>prerequisite.code===code))));
  const progress=engine.computeProgressiveStageAndTaskState({projectId:'TEST',track:'software_only',completedStageCodes:['CM_01'],stageDefinitions:software});
  assert.equal(progress.activeTasks.filter(task=>task.stageCode==='G0_01').length,5);
  assert.equal(progress.activeTasks.filter(task=>task.stageCode==='G0_05').length,0);
});
test('parallel record uploads follow pinned dependencies and activation rather than list positions',()=>{
  const stages=[{code:'G0_01',prerequisites:[]},{code:'SW_01',prerequisites:['G0_01']},{code:'HW_35',prerequisites:[]}];
  assert.equal(uploadAccess.stageUploadAllowed(stages,'SW_01','G0_01'),true);
  assert.equal(uploadAccess.stageUploadAllowed(stages,'SW_01','SW_01'),true);
  assert.equal(uploadAccess.stageUploadAllowed(stages,'SW_01','HW_35'),false);
  assert.equal(uploadAccess.stageUploadAllowed(stages,'SW_01','HW_35',['HW_35']),true);
  assert.equal(uploadAccess.stageUploadAllowed(stages,'SW_01','UNKNOWN',['UNKNOWN']),false);
});
test("workbook corrections preserve project snapshots and unresolved stage identities", () => {
  const before = api.defaultLifecycleRevision();
  before.stages=before.stages.filter(stage=>!/^G\d_/.test(stage.code)).map(stage=>({...stage,prerequisites:stage.prerequisites.filter(code=>!/^G\d_/.test(code))}));
  const pinned = api.pinLifecycleRevision(before);
  const review = hexa.reviewHexaWorkbook(before);
  assert.equal(review.matched.length, 61);
  assert.equal(review.unresolved.length, 21);
  assert.ok(review.unresolved.some(row => row.row === 77 && !/^[A-Z]+_\d+$/.test(row.code)));
  const corrected = hexa.applyHexaStageCorrections(before);
  assert.deepEqual(api.validateLifecycleRevision(corrected), []);
  assert.equal(corrected.stages.find(stage=>stage.code==='HW_15').phase,'TG_2');
  assert.equal(corrected.stages.find(stage=>stage.code==='HW_35').phase,'TG_8');
  assert.equal(corrected.stages.find(stage=>stage.code==='HW_17').department,'MMF');
  assert.ok(corrected.stages.find(stage=>stage.code==='HW_17').tasks.every(task=>task.department==='MMF'));
  assert.deepEqual(corrected.stages.find(stage=>stage.code==='HW_19').tasks,before.stages.find(stage=>stage.code==='HW_19').tasks);
  assert.equal(api.pinLifecycleRevision(before),pinned);
  assert.equal(corrected.stages.length,before.stages.length);
});
test("confirmed CFT and PM aliases route to Operations while unresolved roles preserve authority", () => {
  const before=api.defaultLifecycleRevision();
  const known=new Set(['SAL','EHW','FW','SW','MECH','PUR','QA','EMF','MMF','FIN','SIT','HR']);
  const corrected=hexa.applyHexaRaci(before,known);
  assert.deepEqual(corrected.stages.find(stage=>stage.code==='HW_02').raci.A,['HR']);
  assert.deepEqual(corrected.stages.find(stage=>stage.code==='HW_03').raci.C,before.stages.find(stage=>stage.code==='HW_03').raci.C);
  assert.deepEqual(hexa.resolveHexaDepartments('PM (Project Manager), CFT (Cross functional Team)',hexa.HEXA_CONFIRMED_ROLE_DEPARTMENTS,known),{departments:['HR'],unresolved:[]});
  assert.deepEqual(api.validateLifecycleRevision(corrected),[]);
});
test("workbook task defaults have stable identities and respect confirmed department ownership",()=>{
  const before=api.defaultLifecycleRevision();
  const corrected=hexa.applyHexaTaskDefaults(hexa.applyHexaStageCorrections(before));
  const schematic=corrected.stages.find(stage=>stage.code==='HW_15');
  assert.equal(schematic.tasks.length,5);
  assert.equal(new Set(schematic.tasks.map(task=>task.id)).size,5);
  assert.match(schematic.tasks[0].title,/hierarchical multi-sheet schematics/);
  assert.ok(corrected.stages.find(stage=>stage.code==='HW_17').tasks.every(task=>task.department==='MMF'));
  assert.deepEqual(hexa.applyHexaTaskDefaults(corrected),corrected);
  assert.deepEqual(api.validateLifecycleRevision(corrected),[]);
});
test("two projects pin an unchanged reusable revision without inventory movement", () => {
  const asset = {
    id: "A-r1",
    familyId: "A",
    revision: 1,
    title: "Controller PCB",
    kind: "PCB",
    originProject: "P1",
    originStage: "HW_24",
    documentId: "D1",
    documentRevision: "01",
    inventoryItemId: "I1",
    compatibility: "24V evaluation only",
    parentRevisionId: "",
    status: "Draft",
    createdAt: "2026-11-04",
    createdBy: "TEST",
  };
  const context = {
    projects: ["P1", "P2"],
    documents: [{ id: "D1", revision: "01" }],
    inventoryIds: ["I1"],
    assets: [],
  };
  assert.deepEqual(reuse.validateReusableAsset(asset, context), []);
  const snapshot = JSON.stringify(asset);
  let uses = [];
  for (const projectId of context.projects)
    uses = reuse.linkReusableAsset(
      uses,
      {
        id: projectId,
        projectId,
        assetRevisionId: asset.id,
        assessment: "Interface review recorded",
        createdAt: "2026-11-04",
        createdBy: "TEST",
      },
      [asset],
      context.projects,
    );
  assert.equal(uses.length, 2);
  assert.equal(JSON.stringify(asset), snapshot);
  assert.equal(reuse.linkReusableAsset(uses, uses[0], [asset], context.projects).length, 2);
  assert.throws(() =>
    reuse.linkReusableAsset(uses, { ...uses[0], assessment: "" }, [asset], context.projects),
  );
  assert.ok(
    reuse.validateReusableAsset(
      { ...asset, id: "A-r2", revision: 2, parentRevisionId: asset.id },
      { ...context, assets: [asset] },
    ).length === 0,
  );
});
test("ten fixed phases map engineering, certification and sustaining stages", () => {
  assert.equal(api.COMPANY_PHASES.length, 10);
  assert.equal(api.phaseForStage("HW_15"), "TG_2");
  assert.equal(api.phaseForStage("HW_07"), "TG_2");
  assert.equal(api.phaseForStage("C11"), "TG_6");
  assert.equal(api.phaseForStage("CL_03"), "TG_9");
  assert.equal(api.deriveCompanyStatus("TG_3", "ON_HOLD"), "ON_HOLD");
  assert.equal(api.deriveCompanyStatus("TG_7"), "PILOT_AND_VALIDATION");
  assert.equal(api.deriveCompanyStatus("TG_7", undefined, true), "RELEASED_PRODUCTION");
  assert.equal(api.gateForStage("HW_15"), "HW-G2");
  assert.equal(api.gateForStage("C14"), "CERT-G4");
});
test("optional omissions unblock dependencies without becoming completed work", () => {
  const r = api.defaultLifecycleRevision();
  const p = {
    projectId: "P",
    track: "hardware_only",
    completedStageCodes: [
      "CM_01",
      "CM_02",
      "CM_03",
      "CM_04",
      "HW_01",
      "HW_02",
      "HW_03",
      "HW_04",
      "HW_05",
    ],
    stageDefinitions: api.projectLifecycleStages(r, "hardware_only"),
    omittedStageCodes: ["HW_06"],
  };
  const result = engine.computeProgressiveStageAndTaskState(p);
  assert.ok(!result.stages.some((s) => s.stageCode === "HW_06"));
  assert.ok(!result.activeTasks.some((t) => t.stageCode === "HW_06"));
  assert.ok(!p.completedStageCodes.includes("HW_06"));
});
test("printable PMSS escapes record text and carries no invented acceptance", () => {
  const print = load("pmss-print");
  const html = print.pmssPrintHtml(
    { reference: "TEST-<script>", title: "<img src=x onerror=alert(1)>", fields: {} },
    [],
    { "System voltage": "24V & transient review" },
    [],
  );
  assert.ok(html.includes("@page{size:A4"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes("does not grant approval"));
});
test("default catalog validates and pinned snapshots survive subsequent edits", () => {
  const revision = api.defaultLifecycleRevision();
  assert.deepEqual(api.validateLifecycleRevision(revision), []);
  const release = api
    .projectLifecycleStages(revision, "hardware_only")
    .find((s) => s.code === "CL_01");
  assert.ok(release.prerequisites.includes("HW_34"));
  assert.ok(release.prerequisites.includes("HW_35"));
  assert.ok(!release.prerequisites.includes("FW_12"));
  assert.ok(
    api
      .projectLifecycleStages(revision, "hardware_firmware_software", true)
      .find((s) => s.code === "CL_01")
      .prerequisites.includes("C15"),
  );
  const pin = api.pinLifecycleRevision(revision);
  revision.stages[0].name = "Changed default";
  assert.notEqual(api.readLifecycleBaseline(pin).stages[0].name, "Changed default");
  assert.equal(api.readLifecycleBaseline("{broken"), undefined);
});
test("cycle, missing dependency and duplicate task identity reject activation", () => {
  const r = api.defaultLifecycleRevision();
  r.stages[0].prerequisites = ["MISSING", r.stages[0].code];
  r.stages[0].tasks.push({ ...r.stages[0].tasks[0] });
  const errors = api.validateLifecycleRevision(r);
  assert.ok(errors.some((e) => e.includes("missing prerequisite")));
  assert.ok(errors.some((e) => e.includes("Dependency cycle")));
  assert.ok(errors.some((e) => e.includes("duplicate task")));
});
test("configured defaults generate variable task counts with stable retry identities", () => {
  const r = api.defaultLifecycleRevision();
  r.stages[0].tasks.push({
    id: "T03",
    title: "Third configured action",
    description: "Collect input",
    department: "SAL",
  });
  const params = {
    projectId: "TEST-P1",
    track: "hardware_only",
    completedStageCodes: [],
    stageDefinitions: api.projectLifecycleStages(r, "hardware_only"),
  };
  const first = engine.computeProgressiveStageAndTaskState(params);
  const retry = engine.computeProgressiveStageAndTaskState(params);
  assert.equal(first.activeTasks.length, 3);
  assert.deepEqual(
    first.activeTasks.map((t) => t.id),
    retry.activeTasks.map((t) => t.id),
  );
  assert.ok(first.stages.filter((s) => s.status === "completed").length === 0);
  const cancelled = engine.computeProgressiveStageAndTaskState({
    ...params,
    cancelledTaskIds: [first.activeTasks[2].id],
  });
  assert.equal(cancelled.activeTasks.length, 2);
});
