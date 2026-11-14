const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const sourcePath = (name) => path.resolve(__dirname, "../src/lib/" + name + ".ts");

function loadSource(name) {
  const source = fs.readFileSync(sourcePath(name), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loaded = { exports: {} };
  new Function("module", "exports", "require", compiled)(loaded, loaded.exports, (specifier) =>
    specifier.startsWith("./")
      ? loadSource(specifier.slice(2).replace(/\.ts$/, ""))
      : require(specifier),
  );
  return loaded.exports;
}

const workspace = loadSource("local-test-workspace");
const {
  LOCAL_TEST_ANDROID_FIXTURE_REFERENCE,
  LOCAL_TEST_ENQUIRY_CODE,
  LOCAL_TEST_FEASIBILITY_SHEET_ID,
  LOCAL_TEST_FIXTURE_KEY,
  LOCAL_TEST_PROJECT_CODE,
  LOCAL_TEST_PROJECT_ID,
  LOCAL_TEST_WORKSPACE_STORAGE_KEY,
  addLocalFeedback,
  addLocalTaskComment,
  deriveLocalWorkspaceView,
  getLocalDocumentRegister,
  getRepresentativePortfolioCoverage,
  loadLocalTestFixture,
  localDocumentDepartmentFilter,
  localHardwareBudgetSummary,
  reloadLocalTestFixture,
  resetLocalTestFixture,
  reviewLocalFeedback,
  searchLocalDocumentPortfolio,
  saveLocalControlledDocumentDraft,
  selectLocalBinaryArtifactFile,
  toggleLocalTaskSubtask,
  transitionLocalHandoff,
  transitionLocalTask,
  updateLocalBudgetLine,
  updateLocalHardwareRequirement,
  updateLocalTentativeBomLine,
} = workspace;

const source = loadSource("lifecycle-scenarios");
const { getScenario } = source;

test("S10 enquiry, project, feasibility sheet and department questions share stable linked IDs", () => {
  const state = loadLocalTestFixture();
  const enquiry = state.records.find((record) => record.reference === LOCAL_TEST_ENQUIRY_CODE);
  const project = state.records.find((record) => record.reference === LOCAL_TEST_PROJECT_CODE);
  const sheet = state.sheets.find((item) => item.id === LOCAL_TEST_FEASIBILITY_SHEET_ID);

  assert.ok(enquiry);
  assert.ok(project);
  assert.ok(sheet);
  assert.equal(enquiry.id, "demo-s10-enquiry");
  assert.equal(project.id, LOCAL_TEST_PROJECT_ID);
  assert.equal(state.androidFixtureReference, LOCAL_TEST_ANDROID_FIXTURE_REFERENCE);
  assert.equal(enquiry.fields.linkedProjectId, project.id);
  assert.equal(enquiry.fields.linkedProjectCode, project.reference);
  assert.equal(project.fields.enquiryId, enquiry.id);
  assert.equal(project.fields.enquiryCode, enquiry.reference);
  assert.deepEqual(enquiry.linkedRecordIds, [project.id]);
  assert.deepEqual(project.linkedRecordIds, [enquiry.id]);
  assert.equal(sheet.source_record_id, project.id);
  assert.equal(sheet.project_record_id, project.id);
  assert.equal(sheet.status, "Draft");
  assert.equal(
    sheet.parameter_values.use_case.input,
    "Custom vehicle telematics/GPS tracker; intended PoC/demo.",
  );
  assert.equal(
    sheet.parameter_values.cellular.source,
    "DEMO ONLY · User-provided scenario brief · tentative, unverified",
  );
  assert.match(sheet.parameter_values.special.input, /Investigate LoRa.*without internet/);
  assert.match(
    sheet.parameter_values.special.input,
    /relationship to requested 4G connectivity is unresolved/i,
  );

  const questionDepartments = new Set(sheet.custom_parameters.map((question) => question.lead));
  for (const department of ["SAL", "EHW", "FW", "SW", "MECH", "PUR", "QA", "EMF", "MMF"]) {
    assert.ok(questionDepartments.has(department), `${department} feasibility question missing`);
  }
  for (const question of sheet.custom_parameters) {
    const value = sheet.parameter_values[question.id];
    assert.equal(value.input, "");
    assert.equal(value.source, "");
    assert.equal(value.finalValue, "");
    assert.deepEqual(value.responses, {});
  }
  assert.equal(sheet.status, "Draft");
  assert.equal(project.fields.feasibilityApproval, "Not approved");
  assert.equal(project.fields.requirementsFreeze, "Not frozen");
  assert.equal(
    state.records.filter((record) => record.reference === LOCAL_TEST_PROJECT_CODE).length,
    1,
  );
  assert.ok(
    state.tasks.every(
      (task) =>
        task.projectId === LOCAL_TEST_PROJECT_ID &&
        task.projectCode === LOCAL_TEST_PROJECT_CODE &&
        task.enquiryId === enquiry.id &&
        task.feasibilitySheetId === sheet.id,
    ),
  );
  assert.ok(
    state.documents.every(
      (document) =>
        document.projectId === LOCAL_TEST_PROJECT_ID &&
        document.filePresent === false &&
        document.released === false,
    ),
  );
  assert.equal(getScenario("S10").fixtureKey, LOCAL_TEST_FIXTURE_KEY);
});

test("loading refuses duplicate S10 references or IDs instead of creating conflicting records", () => {
  const state = loadLocalTestFixture();
  const conflictingReference = {
    ...state,
    records: [
      ...state.records.filter((record) => record.reference !== LOCAL_TEST_PROJECT_CODE),
      {
        ...state.records.find((record) => record.reference === LOCAL_TEST_PROJECT_CODE),
        id: "another-project-id",
      },
    ],
  };
  assert.throws(
    () => loadLocalTestFixture(conflictingReference),
    /LOCAL_TEST_RECORD_REFERENCE_CONFLICT/,
  );

  const conflictingId = {
    ...state,
    records: [
      ...state.records.filter((record) => record.id !== LOCAL_TEST_PROJECT_ID),
      {
        ...state.records.find((record) => record.id === LOCAL_TEST_PROJECT_ID),
        reference: "OTHER-REFERENCE",
      },
    ],
  };
  assert.throws(() => loadLocalTestFixture(conflictingId), /LOCAL_TEST_RECORD_ID_CONFLICT/);

  const duplicateReference = {
    ...state,
    records: [
      ...state.records,
      {
        ...state.records.find((record) => record.reference === LOCAL_TEST_PROJECT_CODE),
        id: "duplicate-project-id",
      },
    ],
  };
  assert.throws(
    () => loadLocalTestFixture(duplicateReference),
    /LOCAL_TEST_RECORD_REFERENCE_CONFLICT/,
  );
});

test("the navigator reuses existing portfolio fixtures for every requested use case", () => {
  const state = loadLocalTestFixture();
  const portfolio = getRepresentativePortfolioCoverage(state);
  const byKey = new Map(portfolio.map((entry) => [entry.key, entry]));
  assert.equal(portfolio.length, 6);
  assert.equal(new Set(portfolio.map((entry) => entry.fixtureKey)).size, portfolio.length);

  const declined = byKey.get("no-project-enquiry");
  assert.equal(declined.fixtureKey, "LC2-E02");
  assert.equal(declined.projectCode, undefined);
  assert.equal(declined.enquiryCode, "ENQ-DECL-001");
  assert.equal(declined.activeTaskCount, 0);
  assert.match(declined.status, /no project/i);

  const feasibility = byKey.get("active-feasibility");
  assert.equal(feasibility.fixtureKey, LOCAL_TEST_FIXTURE_KEY);
  assert.equal(feasibility.projectCode, LOCAL_TEST_PROJECT_CODE);
  assert.equal(
    feasibility.activeTaskCount,
    state.tasks.filter((task) => ["CM_01", "CM_02"].includes(task.stageCode)).length,
  );
  assert.ok(feasibility.handoffs.length > 0);

  const hardware = byKey.get("hardware-only");
  const hardwareFirmware = byKey.get("hardware-firmware-poc");
  const threeTrack = byKey.get("three-track-pilot");
  const qaFeedback = byKey.get("qa-regression-feedback");
  assert.equal(hardware.fixtureKey, "LC2-P01");
  assert.equal(hardware.track, "hardware_only");
  assert.equal(hardwareFirmware.fixtureKey, "LC2-P03");
  assert.equal(hardwareFirmware.track, "hardware_firmware");
  assert.equal(threeTrack.fixtureKey, "LC2-P04");
  assert.equal(threeTrack.track, "hardware_firmware_software");
  assert.equal(qaFeedback.fixtureKey, "LC2-P05");
  assert.equal(qaFeedback.track, "firmware_only");

  assert.ok(
    new Set(portfolio.map((entry) => `${entry.completedStageCount}:${entry.inProgressStageCount}`))
      .size >= 4,
  );
  assert.ok(hardware.tasks.some((task) => task.department === "EHW"));
  assert.ok(hardwareFirmware.tasks.some((task) => task.department === "FW"));
  assert.ok(threeTrack.tasks.some((task) => task.department === "SW"));
  assert.ok(qaFeedback.handoffs.length > 0);
  assert.equal(portfolio.filter((entry) => entry.fixtureKey === "LC2-P03").length, 1);
  assert.equal(portfolio.filter((entry) => entry.fixtureKey === "LC2-P04").length, 1);
  assert.ok(
    portfolio.every(
      (entry) =>
        entry.origin === "Existing canonical sample" || entry.fixtureKey === LOCAL_TEST_FIXTURE_KEY,
    ),
  );
});

test("document project search matches fixture identity and keeps query matching case-insensitive", () => {
  const portfolio = getRepresentativePortfolioCoverage(loadLocalTestFixture());

  assert.deepEqual(
    searchLocalDocumentPortfolio(portfolio, "lc2-p04").map((entry) => entry.key),
    ["three-track-pilot"],
  );
  assert.deepEqual(
    searchLocalDocumentPortfolio(portfolio, "hardware_firmware").map((entry) => entry.key),
    ["no-project-enquiry", "active-feasibility", "hardware-firmware-poc", "three-track-pilot"],
  );
  assert.equal(searchLocalDocumentPortfolio(portfolio, "  ").length, portfolio.length);
  assert.deepEqual(searchLocalDocumentPortfolio(portfolio, "no matching fixture"), []);
});

test("document register scopes to existing project fixtures and filters by department", () => {
  const state = loadLocalTestFixture();
  const noProject = getLocalDocumentRegister(state, "no-project-enquiry");
  assert.ok(noProject.length > 0);
  assert.ok(noProject.every((item) => item.fixtureKey === "LC2-E02"));
  assert.ok(noProject.every((item) => item.projectId === undefined));
  assert.ok(noProject.every((item) => item.kind === "Controlled draft"));
  assert.ok(noProject.some((item) => /terminal enquiry/i.test(item.dueStatus)));
  assert.ok(noProject.every((item) => item.projectCode === undefined));

  const s10All = getLocalDocumentRegister(state, "active-feasibility");
  const s10Sales = getLocalDocumentRegister(state, "active-feasibility", "SAL");
  const s10Hardware = getLocalDocumentRegister(state, "active-feasibility", "EHW");
  assert.ok(s10All.length > s10Sales.length);
  assert.ok(s10Sales.every((item) => item.department === "SAL"));
  assert.ok(s10Hardware.every((item) => item.department === "EHW"));
  assert.ok(s10All.every((item) => item.projectId === LOCAL_TEST_PROJECT_ID));
  assert.ok(
    s10All
      .filter((item) => item.stageCode === "DEMO-HW-FW-SW-PLAN")
      .every((item) => /blocked.*freeze/i.test(item.dueStatus)),
  );

  const hardware = getLocalDocumentRegister(state, "hardware-only");
  const hardwareFirmware = getLocalDocumentRegister(state, "hardware-firmware-poc");
  const threeTrack = getLocalDocumentRegister(state, "three-track-pilot");
  const qaFeedback = getLocalDocumentRegister(state, "qa-regression-feedback");
  assert.ok(hardware.some((item) => item.stageCode.startsWith("HW_")));
  assert.ok(!hardware.some((item) => item.stageCode.startsWith("FW_")));
  assert.ok(hardwareFirmware.some((item) => item.stageCode === "FW_01"));
  assert.ok(!hardwareFirmware.some((item) => item.stageCode.startsWith("SW_")));
  assert.ok(threeTrack.some((item) => item.stageCode === "SW_01"));
  assert.ok(
    qaFeedback.some((item) => item.kind === "Binary artifact" && item.stageCode === "FW_11"),
  );
  assert.ok(
    hardware.some(
      (item) =>
        item.stageStatus === "completed" && /stage complete.*no local file/i.test(item.dueStatus),
    ),
  );
  assert.ok(
    hardware.some(
      (item) => item.stageStatus === "planned" && /planned.*not due/i.test(item.dueStatus),
    ),
  );
  assert.equal(new Set(s10All.map((item) => item.fixtureKey)).size, 1);
});

test("presentation department selects the matching local document filter or All when unknown", () => {
  const state = loadLocalTestFixture();
  const ehwFilter = localDocumentDepartmentFilter("ehw");
  assert.equal(ehwFilter, "EHW");
  const ehwDocuments = getLocalDocumentRegister(state, "active-feasibility", ehwFilter);
  const ehwDrafts = ehwDocuments.filter((item) => item.kind === "Controlled draft");
  assert.ok(ehwDrafts.length > 0, "EHW filter should include editable controlled-draft rows");
  const ehwFeasibilityDraft = ehwDrafts.find(
    (item) => item.sourceTaskId === `${LOCAL_TEST_PROJECT_CODE}:CM_02:EHW`,
  );
  assert.ok(ehwFeasibilityDraft);
  assert.equal(ehwFeasibilityDraft.projectId, LOCAL_TEST_PROJECT_ID);
  assert.equal(ehwFeasibilityDraft.projectCode, LOCAL_TEST_PROJECT_CODE);
  assert.equal(ehwFeasibilityDraft.stageCode, "DEMO-CM-02");
  assert.equal(ehwFeasibilityDraft.department, "EHW");
  assert.match(ehwFeasibilityDraft.title, /receiver and antenna evidence questions/);
  assert.match(ehwFeasibilityDraft.stageExitContext, /task owner EHW, canonical stage owner SAL/);
  assert.ok(ehwDocuments.every((item) => item.department === "EHW"));

  const salesDocuments = getLocalDocumentRegister(
    state,
    "active-feasibility",
    localDocumentDepartmentFilter("sales"),
  );
  assert.equal(localDocumentDepartmentFilter("sales"), "SAL");
  assert.ok(salesDocuments.length > 0);
  assert.ok(salesDocuments.every((item) => item.department === "SAL"));

  assert.equal(localDocumentDepartmentFilter("quality"), "All");
  const unknownFilter = localDocumentDepartmentFilter("unmapped-role");
  assert.equal(unknownFilter, "All");
  const unknownPersonaDocuments = getLocalDocumentRegister(state, "active-feasibility");
  assert.ok(unknownPersonaDocuments.length > ehwDocuments.length);
  assert.ok(unknownPersonaDocuments.some((item) => item.department === "SAL"));
  assert.ok(unknownPersonaDocuments.some((item) => item.department === "EHW"));
});

test("controlled draft rows expose editable Save Draft and binary rows remain file-picker metadata only", () => {
  const component = fs.readFileSync(
    path.resolve(__dirname, "../src/components/LocalTestWorkspace.tsx"),
    "utf8",
  );
  assert.match(component, /controlledDocumentRows\.map\([\s\S]*?<ControlledDocumentEditor/);
  assert.match(component, /if \(!isEditing\)[\s\S]*?>\s*Edit\s*</);
  assert.match(component, /setIsEditing\(false\)[\s\S]*?>\s*Cancel\s*</);
  assert.match(component, />\s*Save Draft\s*</);
  assert.match(component, /binaryDocumentRows\.map\([\s\S]*?type="file"/);
  assert.match(component, /selectLocalBinaryArtifactFile/);
  assert.match(component, /selected locally, not uploaded\/shared/);
});

test("controlled document drafts save editable local history without authorizing lifecycle gates", () => {
  let state = loadLocalTestFixture();
  const doc = getLocalDocumentRegister(state, "active-feasibility").find(
    (item) => item.kind === "Controlled draft" && item.stageCode === "DEMO-CM-02",
  );
  const v1 = {
    title: "Feasibility review notes · local edit",
    revision: "01",
    stageExitContext: "Still unresolved; local draft only.",
  };
  state = saveLocalControlledDocumentDraft(
    state,
    "active-feasibility",
    doc.id,
    v1,
    "Local reviewer",
    "2026-11-02T15:00:00.000Z",
  );
  const v2 = { ...v1, revision: "02", stageExitContext: "Revised local notes; unanswered." };
  state = saveLocalControlledDocumentDraft(
    state,
    "active-feasibility",
    doc.id,
    v2,
    "Local reviewer",
    "2026-11-02T15:05:00.000Z",
  );

  const saved = state.documentDrafts.find((item) => item.id === doc.id);
  assert.equal(saved.history.length, 2);
  assert.equal(saved.history[0].revision, "01");
  assert.equal(saved.history[1].revision, "02");
  assert.equal(
    getLocalDocumentRegister(state, "active-feasibility").find((item) => item.id === doc.id).title,
    v2.title,
  );
  assert.equal(state.events.at(-1).fixtureKey, LOCAL_TEST_FIXTURE_KEY);
  assert.match(state.events.at(-1).detail, /no approval, release, freeze, or gate authorization/i);
  assert.equal(
    state.records.find((record) => record.reference === LOCAL_TEST_PROJECT_CODE).fields
      .requirementsFreeze,
    "Not frozen",
  );
  assert.equal(deriveLocalWorkspaceView(state).downstreamTaskGenerationBlocked, true);

  const legacyState = { ...state };
  delete legacyState.documentDrafts;
  delete legacyState.binarySelections;
  const migrated = loadLocalTestFixture(legacyState);
  assert.deepEqual(migrated.documentDrafts, []);
  assert.deepEqual(migrated.binarySelections, []);
});

test("binary selection stores local file metadata separately from controlled drafts", () => {
  const initial = loadLocalTestFixture();
  const fileArtifact = getLocalDocumentRegister(initial, "active-feasibility").find(
    (item) => item.kind === "Binary artifact" && item.title === "Gerber",
  );
  assert.ok(
    initial.hardwareMaster.binaryDeliverables.some((item) => item.id === fileArtifact.id),
    "S10 document picker should address the existing hardware binary catalog row",
  );
  const selected = selectLocalBinaryArtifactFile(
    initial,
    "active-feasibility",
    fileArtifact.id,
    {
      name: "sample-gerber.zip",
      size: 2048,
      type: "application/zip",
      lastModified: 1_798_000_000_000,
    },
    "Local tester",
    "2026-11-02T16:00:00.000Z",
  );
  const metadata = selected.binarySelections.find((item) => item.id === fileArtifact.id);
  assert.equal(metadata.fileName, "sample-gerber.zip");
  assert.equal(metadata.sizeBytes, 2048);
  assert.equal(metadata.uploaded, false);
  assert.match(metadata.storageState, /not uploaded or shared/);
  assert.equal("bytes" in metadata, false);
  assert.equal("content" in metadata, false);
  assert.equal(selected.documentDrafts.length, initial.documentDrafts.length);
  assert.equal(selected.documents.length, initial.documents.length);
  assert.equal(selected.events.at(-1).action, "Local binary file selected");
  assert.match(selected.events.at(-1).detail, /metadata only; bytes were not uploaded/i);
  assert.equal(
    selected.hardwareMaster.binaryDeliverables.find((item) => item.kind === "Gerber")?.uploaded,
    false,
  );
  assert.equal(
    selected.binarySelections.find((item) => item.id === fileArtifact.id).storageState,
    "Selected locally · not uploaded or shared",
  );
});

test("S10 document reset clears only S10 drafts and file metadata, preserving other fixtures", () => {
  let state = loadLocalTestFixture();
  const s10Control = getLocalDocumentRegister(state, "active-feasibility").find(
    (item) => item.kind === "Controlled draft",
  );
  state = saveLocalControlledDocumentDraft(
    state,
    "active-feasibility",
    s10Control.id,
    {
      title: "S10 editable local draft",
      revision: "01",
      stageExitContext: "Still pending and unapproved.",
    },
    "Local tester",
    "2026-11-02T17:00:00.000Z",
  );
  const s10Binary = getLocalDocumentRegister(state, "active-feasibility").find(
    (item) => item.kind === "Binary artifact",
  );
  state = selectLocalBinaryArtifactFile(
    state,
    "active-feasibility",
    s10Binary.id,
    { name: "local-only.step", size: 12, type: "model/step", lastModified: 1_798_000_000_000 },
    "Local tester",
    "2026-11-02T17:01:00.000Z",
  );

  const otherControl = getLocalDocumentRegister(state, "hardware-only").find(
    (item) => item.kind === "Controlled draft",
  );
  state = saveLocalControlledDocumentDraft(
    state,
    "hardware-only",
    otherControl.id,
    {
      title: "Other fixture draft",
      revision: "02",
      stageExitContext: "Preserve outside S10 reset.",
    },
    "Local tester",
    "2026-11-02T17:02:00.000Z",
  );
  const otherBinary = getLocalDocumentRegister(state, "hardware-only").find(
    (item) => item.kind === "Binary artifact",
  );
  state = selectLocalBinaryArtifactFile(
    state,
    "hardware-only",
    otherBinary.id,
    {
      name: "other-fixture.pdf",
      size: 99,
      type: "application/pdf",
      lastModified: 1_798_000_000_000,
    },
    "Local tester",
    "2026-11-02T17:03:00.000Z",
  );

  const reset = resetLocalTestFixture(state);
  assert.ok(reset.documentDrafts.every((item) => item.fixtureKey !== LOCAL_TEST_FIXTURE_KEY));
  assert.ok(reset.binarySelections.every((item) => item.fixtureKey !== LOCAL_TEST_FIXTURE_KEY));
  assert.ok(reset.documentDrafts.some((item) => item.id === otherControl.id));
  assert.ok(reset.binarySelections.some((item) => item.id === otherBinary.id));
  const reloaded = reloadLocalTestFixture(reset, "2026-11-02T17:04:00.000Z");
  assert.ok(!reloaded.documentDrafts.some((item) => item.id === s10Control.id));
  assert.ok(!reloaded.binarySelections.some((item) => item.id === s10Binary.id));
  assert.ok(reloaded.documentDrafts.some((item) => item.id === otherControl.id));
  assert.ok(reloaded.binarySelections.some((item) => item.id === otherBinary.id));
});

test("department task views follow canonical current stages and expose only future previews downstream", () => {
  const state = loadLocalTestFixture();
  const view = deriveLocalWorkspaceView(state);
  assert.equal(view.downstreamTaskGenerationBlocked, true);
  assert.deepEqual([...new Set(view.activeTasks.map((task) => task.stageCode))].sort(), [
    "CM_01",
    "CM_02",
  ]);
  assert.ok(view.activeTasks.some((task) => task.status === "completed"));
  assert.ok(view.activeTasks.some((task) => task.status === "in_progress"));
  assert.ok(view.activeTasks.some((task) => task.status === "in_review"));
  assert.ok(view.activeTasks.some((task) => task.status === "blocked"));
  assert.ok(view.plannedTaskPreviews.length > 0);
  assert.ok(
    view.plannedTaskPreviews.every((task) =>
      ["CM_03", "HW_01", "FW_01", "SW_01"].includes(task.stageCode),
    ),
  );

  const ehw = deriveLocalWorkspaceView(state, "EHW");
  assert.ok(ehw.activeTasks.length > 0);
  assert.ok(ehw.activeTasks.every((task) => task.department === "EHW"));
  assert.ok(ehw.plannedTaskPreviews.every((task) => task.department === "EHW"));
  assert.ok(deriveLocalWorkspaceView(state, "EMF").activeTasks.length === 0);
});

test("EHW requirements preserve source provenance; test assumptions are editable and remain unapproved", () => {
  const state = loadLocalTestFixture();
  const master = state.hardwareMaster;
  assert.ok(master);
  const userFacts = master.requirements.filter((item) => item.provenance === "user_brief");
  const assumptions = master.requirements.filter(
    (item) => item.provenance === "fixture_assumption",
  );
  assert.equal(userFacts.length, 4);
  assert.ok(
    userFacts.every(
      (item) => item.source === "DEMO ONLY · User-provided scenario brief · tentative, unverified",
    ),
  );
  assert.ok(assumptions.length >= 2);
  assert.ok(
    assumptions.every((item) => item.decisionStatus === "Editable · unapproved test assumption"),
  );
  assert.match(assumptions[0].value, /customer quantity remains unknown/i);

  const changed = updateLocalHardwareRequirement(
    state,
    assumptions[0].id,
    "2 units · local planning alternative only; customer quantity remains unknown.",
    "Local reviewer",
    "2026-11-02T14:00:00.000Z",
  );
  assert.match(
    changed.hardwareMaster.requirements.find((item) => item.id === assumptions[0].id).value,
    /^2 units/,
  );
  assert.equal(
    state.hardwareMaster.requirements.find((item) => item.id === assumptions[0].id).value,
    assumptions[0].value,
  );
  assert.throws(
    () =>
      updateLocalHardwareRequirement(
        state,
        userFacts[0].id,
        "altered",
        "Local reviewer",
        "2026-11-02T14:01:00.000Z",
      ),
    /LOCAL_TEST_USER_BRIEF_FACT_READ_ONLY/,
  );
  assert.equal(
    changed.records.find((record) => record.reference === LOCAL_TEST_PROJECT_CODE).fields
      .requirementsFreeze,
    "Not frozen",
  );
});

test("reusable assets distinguish their certificate metadata from project certification", () => {
  const master = loadLocalTestFixture().hardwareMaster;
  assert.deepEqual(master.assets.map((asset) => asset.kind).sort(), [
    "Enclosure",
    "Harness",
    "PCB",
  ]);
  for (const asset of master.assets) {
    assert.equal(asset.projectId, LOCAL_TEST_PROJECT_ID);
    assert.equal(asset.revision, "00");
    assert.equal(asset.status, "Reusable candidate · not selected");
    assert.equal(asset.certificateMetadata.status, "No asset certificate metadata recorded");
    assert.equal(asset.certificateMetadata.certificateReference, "");
    assert.equal(asset.projectConfigurationCertification.status, "Not assessed");
  }
});

test("tentative BOM links existing inventory IDs, and budget estimates remain transparent and editable", () => {
  const state = loadLocalTestFixture();
  const master = state.hardwareMaster;
  const inventorySource = fs.readFileSync(
    path.resolve(__dirname, "../src/routes/index.tsx"),
    "utf8",
  );
  const inventoryIds = ["inv-stm32", "inv-eg915", "inv-enclosure", "inv-cal-fixture"];
  for (const inventoryId of inventoryIds) {
    assert.ok(master.tentativeBom.some((line) => line.inventoryItemId === inventoryId));
    assert.match(inventorySource, new RegExp(`id:\\s*"${inventoryId}"`));
  }
  assert.ok(master.tentativeBom.every((line) => line.projectId === LOCAL_TEST_PROJECT_ID));
  assert.ok(
    master.tentativeBom.every((line) => line.quantity > 0 && line.estimatedUnitCostUsd >= 0),
  );
  assert.ok(master.tentativeBom.every((line) => line.supplier === "" && line.leadTimeWeeks === ""));
  assert.ok(
    master.tentativeBom.every((line) => line.approvalStatus === "Draft · unapproved estimate"),
  );

  const before = localHardwareBudgetSummary(master);
  assert.equal(
    before.tentativeBomSubtotal,
    master.tentativeBom.reduce((sum, line) => sum + line.quantity * line.estimatedUnitCostUsd, 0),
  );
  assert.equal(before.estimatedPlanningTotal, before.subtotal + before.contingency);
  const line = master.tentativeBom[0];
  const editedBom = updateLocalTentativeBomLine(
    state,
    line.id,
    { quantity: 2, supplier: "Candidate source TBD", leadTimeWeeks: "TBD" },
    "Local reviewer",
    "2026-11-02T14:02:00.000Z",
  );
  assert.equal(editedBom.hardwareMaster.tentativeBom[0].quantity, 2);
  assert.equal(editedBom.hardwareMaster.tentativeBom[0].supplier, "Candidate source TBD");
  assert.ok(
    localHardwareBudgetSummary(editedBom.hardwareMaster).tentativeBomSubtotal >
      before.tentativeBomSubtotal,
  );
  assert.throws(
    () =>
      updateLocalTentativeBomLine(
        state,
        line.id,
        { quantity: 0 },
        "Local reviewer",
        "2026-11-02T14:03:00.000Z",
      ),
    /LOCAL_TEST_BOM_VALUE_INVALID/,
  );

  const budgetLine = master.budgetLines[0];
  const editedBudget = updateLocalBudgetLine(
    state,
    budgetLine.id,
    budgetLine.amountUsd + 25,
    "Local reviewer",
    "2026-11-02T14:04:00.000Z",
  );
  assert.equal(editedBudget.hardwareMaster.budgetLines[0].amountUsd, budgetLine.amountUsd + 25);
  assert.equal(
    editedBudget.hardwareMaster.draftRecords.find((record) => record.kind === "Budget").status,
    "Draft · editable",
  );
});

test("draft records are separate from binary metadata and contain no fake file or release values", () => {
  const state = loadLocalTestFixture();
  const master = state.hardwareMaster;
  assert.deepEqual(
    new Set(master.draftRecords.map((record) => record.kind)),
    new Set(["Requirements", "Feasibility", "BOM", "Budget"]),
  );
  assert.ok(
    master.draftRecords.every(
      (record) =>
        record.projectId === LOCAL_TEST_PROJECT_ID && record.status === "Draft · editable",
    ),
  );
  assert.deepEqual(
    new Set(master.binaryDeliverables.map((item) => item.kind)),
    new Set([
      "Schematic",
      "Gerber",
      "Firmware",
      "CAD/STEP",
      "Drawing",
      "Test report",
      "Certification report",
    ]),
  );
  assert.ok(master.binaryDeliverables.every((item) => item.projectId === LOCAL_TEST_PROJECT_ID));
  assert.ok(
    master.binaryDeliverables.every(
      (item) =>
        !item.uploaded && item.storageUrl === "" && item.status === "Not uploaded · metadata only",
    ),
  );
  assert.ok(
    master.binaryDeliverables.every((item) => !("signature" in item) && !("release" in item)),
  );
});

test("an explicit admin freeze is required even if feasibility is marked complete locally", () => {
  const state = loadLocalTestFixture();
  const completedFeasibility = {
    ...state,
    completedStageCodes: ["CM_01", "CM_02"],
    inProgressStageCodes: [],
  };
  const view = deriveLocalWorkspaceView(completedFeasibility);
  assert.equal(view.downstreamTaskGenerationBlocked, true);
  assert.ok(
    view.lifecycle.stages
      .filter((stage) => !["CM_01", "CM_02"].includes(stage.stageCode))
      .every((stage) => stage.status === "planned"),
  );
  assert.ok(
    view.lifecycle.activeTasks.every((task) => ["CM_01", "CM_02"].includes(task.stageCode)),
  );

  const tampered = {
    ...completedFeasibility,
    freezeAuthorization: {
      projectId: LOCAL_TEST_PROJECT_ID,
      sheetId: LOCAL_TEST_FEASIBILITY_SHEET_ID,
      revision: 1,
      status: "Approved",
      action: "freeze",
      authorizedBy: "Local demo participant",
      authorizedRole: "admin",
      authorizationId: "forged-local-value",
      frozenAt: "2026-11-02T09:00:00.000Z",
    },
  };
  assert.equal(deriveLocalWorkspaceView(tampered).downstreamTaskGenerationBlocked, true);
});

test("task status, checklist, comments and history update only local current-stage fixture work", () => {
  const original = loadLocalTestFixture();
  const task = original.tasks.find((item) => item.id.endsWith(":CM_02:SW"));
  const moved = transitionLocalTask(
    original,
    task.id,
    "in_progress",
    "Local tester",
    "2026-11-02T10:00:00.000Z",
  );
  assert.equal(moved.tasks.find((item) => item.id === task.id).status, "in_progress");
  assert.equal(original.tasks.find((item) => item.id === task.id).status, "todo");
  assert.equal(moved.events.at(-1).action, "Local task status changed");
  assert.equal(deriveLocalWorkspaceView(moved).downstreamTaskGenerationBlocked, true);

  const activeTask = moved.tasks.find((item) => item.id === task.id);
  const checklistState = toggleLocalTaskSubtask(
    moved,
    task.id,
    activeTask.subtasks[0].id,
    "Local tester",
    "2026-11-02T10:01:00.000Z",
  );
  assert.equal(checklistState.tasks.find((item) => item.id === task.id).subtasks[0].done, true);

  const commented = addLocalTaskComment(
    checklistState,
    task.id,
    "Keep the connectivity architecture question unresolved.",
    "Local reviewer",
    "2026-11-02T10:02:00.000Z",
  );
  assert.equal(
    commented.tasks.find((item) => item.id === task.id).comments.at(-1).author,
    "Local reviewer",
  );
  assert.equal(commented.events.at(-1).action, "Local review comment added");
  assert.throws(
    () =>
      transitionLocalTask(commented, task.id, "todo", "Local tester", "2026-11-02T10:03:00.000Z"),
    /LOCAL_TEST_TASK_TRANSITION_INVALID/,
  );
});

test("handoffs support a local review/return loop but freeze-dependent handoffs stay blocked", () => {
  const state = loadLocalTestFixture();
  const handoff = state.handoffs.find((item) => item.id.endsWith("HF-SAL-EHW"));
  const requested = transitionLocalHandoff(
    state,
    handoff.id,
    "Awaiting review",
    "Local tester",
    "2026-11-02T11:00:00.000Z",
  );
  assert.equal(requested.handoffs.find((item) => item.id === handoff.id).status, "Awaiting review");
  const returned = transitionLocalHandoff(
    requested,
    handoff.id,
    "Returned with questions",
    "Local reviewer",
    "2026-11-02T11:01:00.000Z",
  );
  assert.equal(
    returned.handoffs.find((item) => item.id === handoff.id).status,
    "Returned with questions",
  );
  const reset = transitionLocalHandoff(
    returned,
    handoff.id,
    "Draft",
    "Local tester",
    "2026-11-02T11:02:00.000Z",
  );
  assert.equal(reset.handoffs.find((item) => item.id === handoff.id).status, "Draft");

  const gated = state.handoffs.find((item) => item.requiresFreeze);
  assert.throws(
    () =>
      transitionLocalHandoff(
        state,
        gated.id,
        "Awaiting review",
        "Local tester",
        "2026-11-02T11:03:00.000Z",
      ),
    /LOCAL_TEST_HANDOFF_STAGE_BLOCKED/,
  );
  assert.ok(reset.events.length > state.events.length);
  assert.ok(reset.events.every((event) => !/accepted|approved|frozen/i.test(event.action)));
});

test("internal feedback can be reviewed locally without changing draft inputs or approvals", () => {
  const state = loadLocalTestFixture();
  const task = state.tasks.find((item) => item.id.endsWith(":CM_02:SAL"));
  const added = addLocalFeedback(
    state,
    task.id,
    "Add a question asking what 'without internet' means for the demo.",
    "Local reviewer",
    "2026-11-02T12:00:00.000Z",
  );
  const feedback = added.feedback[0];
  assert.equal(feedback.status, "Open");
  assert.equal(feedback.projectId, LOCAL_TEST_PROJECT_ID);
  assert.equal(added.events.at(-1).action, "Local scenario feedback recorded");

  const reviewed = reviewLocalFeedback(
    added,
    feedback.id,
    "Added to the local review notes; no source value was changed.",
    "Local reviewer",
    "2026-11-02T12:01:00.000Z",
  );
  assert.equal(reviewed.feedback[0].status, "Noted locally");
  assert.equal(
    reviewed.feedback[0].response,
    "Added to the local review notes; no source value was changed.",
  );
  assert.deepEqual(reviewed.sheets, state.sheets);
  assert.equal(
    reviewed.records.find((record) => record.reference === LOCAL_TEST_PROJECT_CODE).fields
      .requirementsFreeze,
    "Not frozen",
  );
});

test("reload preserves edits; reset removes only S10 fixture rows and reload restores them", () => {
  let state = loadLocalTestFixture();
  const task = state.tasks.find((item) => item.id.endsWith(":CM_02:SW"));
  state = transitionLocalTask(
    state,
    task.id,
    "in_progress",
    "Local tester",
    "2026-11-02T13:00:00.000Z",
  );
  const assumption = state.hardwareMaster.requirements.find(
    (item) => item.provenance === "fixture_assumption",
  );
  state = updateLocalHardwareRequirement(
    state,
    assumption.id,
    "Adjusted assumption for local review; still not customer-confirmed.",
    "Local tester",
    "2026-11-02T13:00:30.000Z",
  );
  const bomLine = state.hardwareMaster.tentativeBom[0];
  state = updateLocalTentativeBomLine(
    state,
    bomLine.id,
    { quantity: 2 },
    "Local tester",
    "2026-11-02T13:00:45.000Z",
  );
  const unrelatedRecord = {
    id: "unrelated-record",
    reference: "OTHER-PROJECT",
    title: "Unrelated local sample",
    type: "Project",
    status: "Draft",
    fields: { demoFixtureKey: "OTHER" },
  };
  const unrelatedTask = {
    ...state.tasks[0],
    id: "unrelated-task",
    fixtureKey: undefined,
    projectId: "OTHER-PROJECT",
  };
  const unrelatedSheet = {
    ...state.sheets[0],
    id: "unrelated-sheet",
    source_record_id: "OTHER-PROJECT",
    project_record_id: "OTHER-PROJECT",
    fixtureKey: undefined,
  };
  const unrelatedHandoff = {
    ...state.handoffs[0],
    id: "unrelated-handoff",
    fixtureKey: undefined,
    projectId: "OTHER-PROJECT",
  };
  const unrelatedDocument = {
    ...state.documents[0],
    id: "unrelated-document",
    fixtureKey: undefined,
    projectId: "OTHER-PROJECT",
  };
  const unrelatedFeedback = {
    id: "unrelated-feedback",
    fixtureKey: undefined,
    projectId: "OTHER-PROJECT",
    taskId: "OTHER-TASK",
    author: "Other local reviewer",
    body: "Unrelated feedback",
    status: "Open",
    response: "",
  };
  const unrelatedDepartment = {
    ...state.departments[0],
    id: "unrelated-department",
    fixtureKey: undefined,
  };
  const unrelatedEvent = {
    id: "unrelated-event",
    at: "2026-11-02T13:01:00.000Z",
    actor: "Other local user",
    action: "Unrelated action",
    detail: "Must remain.",
  };
  state = {
    ...state,
    records: [...state.records, unrelatedRecord],
    sheets: [...state.sheets, unrelatedSheet],
    tasks: [...state.tasks, unrelatedTask],
    handoffs: [...state.handoffs, unrelatedHandoff],
    documents: [...state.documents, unrelatedDocument],
    feedback: [unrelatedFeedback],
    departments: [...state.departments, unrelatedDepartment],
    events: [...state.events, unrelatedEvent],
  };

  const reloaded = reloadLocalTestFixture(state, "2026-11-02T13:02:00.000Z");
  assert.equal(reloaded.tasks.find((item) => item.id === task.id).status, "in_progress");
  assert.match(
    reloaded.hardwareMaster.requirements.find((item) => item.id === assumption.id).value,
    /^Adjusted assumption/,
  );
  assert.equal(
    reloaded.hardwareMaster.tentativeBom.find((item) => item.id === bomLine.id).quantity,
    2,
  );
  assert.ok(reloaded.records.some((record) => record.id === unrelatedRecord.id));
  assert.ok(reloaded.sheets.some((sheet) => sheet.id === unrelatedSheet.id));
  assert.ok(reloaded.tasks.some((item) => item.id === unrelatedTask.id));
  assert.ok(reloaded.handoffs.some((item) => item.id === unrelatedHandoff.id));
  assert.ok(reloaded.documents.some((item) => item.id === unrelatedDocument.id));
  assert.ok(reloaded.feedback.some((item) => item.id === unrelatedFeedback.id));
  assert.ok(reloaded.departments.some((item) => item.id === unrelatedDepartment.id));
  assert.ok(reloaded.events.some((event) => event.id === unrelatedEvent.id));
  assert.ok(reloaded.events.some((event) => event.action === "Local test sample reloaded"));

  const reset = resetLocalTestFixture(reloaded);
  assert.ok(!reset.records.some((record) => record.reference === LOCAL_TEST_PROJECT_CODE));
  assert.ok(!reset.records.some((record) => record.reference === LOCAL_TEST_ENQUIRY_CODE));
  assert.ok(!reset.sheets.some((item) => item.id === LOCAL_TEST_FEASIBILITY_SHEET_ID));
  assert.ok(!reset.tasks.some((item) => item.fixtureKey === LOCAL_TEST_FIXTURE_KEY));
  assert.ok(reset.records.some((record) => record.id === unrelatedRecord.id));
  assert.ok(reset.sheets.some((sheet) => sheet.id === unrelatedSheet.id));
  assert.ok(reset.tasks.some((item) => item.id === unrelatedTask.id));
  assert.ok(reset.handoffs.some((item) => item.id === unrelatedHandoff.id));
  assert.ok(reset.documents.some((item) => item.id === unrelatedDocument.id));
  assert.ok(reset.feedback.some((item) => item.id === unrelatedFeedback.id));
  assert.ok(reset.departments.some((item) => item.id === unrelatedDepartment.id));
  assert.ok(reset.events.some((event) => event.id === unrelatedEvent.id));
  assert.equal(reset.hardwareMaster, undefined);

  const restored = loadLocalTestFixture(reset);
  assert.ok(restored.records.some((record) => record.reference === LOCAL_TEST_PROJECT_CODE));
  assert.ok(restored.records.some((record) => record.reference === LOCAL_TEST_ENQUIRY_CODE));
  assert.ok(restored.records.some((record) => record.id === unrelatedRecord.id));
  assert.ok(restored.sheets.some((sheet) => sheet.id === unrelatedSheet.id));
  assert.ok(restored.tasks.some((item) => item.id === unrelatedTask.id));
  assert.match(
    restored.hardwareMaster.requirements.find((item) => item.id === assumption.id).value,
    /spreadsheet demonstration only/i,
  );
  assert.ok(restored.handoffs.some((item) => item.id === unrelatedHandoff.id));
  assert.ok(restored.documents.some((item) => item.id === unrelatedDocument.id));
  assert.ok(restored.feedback.some((item) => item.id === unrelatedFeedback.id));
  assert.ok(restored.departments.some((item) => item.id === unrelatedDepartment.id));
  assert.equal(
    restored.records.filter((record) => record.reference === LOCAL_TEST_PROJECT_CODE).length,
    1,
  );
  assert.equal(
    restored.tasks.find((item) => item.id === unrelatedTask.id).status,
    unrelatedTask.status,
  );

  const legacySheet = {
    ...restored.sheets.find((item) => item.id === LOCAL_TEST_FEASIBILITY_SHEET_ID),
    parameter_values: {
      ...restored.sheets.find((item) => item.id === LOCAL_TEST_FEASIBILITY_SHEET_ID)
        .parameter_values,
      cellular: {
        ...restored.sheets.find((item) => item.id === LOCAL_TEST_FEASIBILITY_SHEET_ID)
          .parameter_values.cellular,
        input: "Legacy local edit: 4G requested; coexistence unresolved.",
      },
    },
  };
  const v1State = {
    ...restored,
    version: 1,
    sheets: restored.sheets.map((item) => (item.id === legacySheet.id ? legacySheet : item)),
  };
  delete v1State.androidFixtureReference;
  delete v1State.hardwareMaster;
  const migrated = loadLocalTestFixture(v1State);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.androidFixtureReference, LOCAL_TEST_ANDROID_FIXTURE_REFERENCE);
  assert.ok(migrated.hardwareMaster.assets.length > 0);
  assert.equal(
    migrated.hardwareMaster.requirements.find(
      (item) => item.label === "Requested cellular connectivity",
    ).value,
    "Legacy local edit: 4G requested; coexistence unresolved.",
  );
  assert.ok(migrated.records.some((record) => record.id === unrelatedRecord.id));
});

test("EHW draft rows in S10 are editable and separately managed from binaries", () => {
  const state = loadLocalTestFixture();
  const register = getLocalDocumentRegister(state, "active-feasibility", "EHW");
  const drafts = register.filter((item) => item.kind === "Controlled draft");
  const binaries = register.filter((item) => item.kind === "Binary artifact");

  assert.ok(drafts.length > 0);
  assert.ok(binaries.length > 0);
  assert.ok(drafts.every((d) => d.department === "EHW"));
  assert.ok(binaries.every((b) => b.department === "EHW"));

  const ehwDraft = drafts.find((d) => d.title.includes("receiver"));
  assert.ok(ehwDraft);
  assert.equal(ehwDraft.stageCode, "DEMO-CM-02");
  assert.ok(ehwDraft.sourceTaskId);

  const newDraft = { title: "New EHW title", revision: "B", stageExitContext: "Updated" };
  const nextState = saveLocalControlledDocumentDraft(
    state,
    "active-feasibility",
    ehwDraft.id,
    newDraft,
    "Tester",
    "2026-11-02T13:30:00Z",
  );
  const updatedDrafts = getLocalDocumentRegister(nextState, "active-feasibility", "EHW");
  const updatedDraft = updatedDrafts.find((d) => d.id === ehwDraft.id);
  assert.equal(updatedDraft.title, "New EHW title");

  const binary = binaries[0];
  const nextStateBinary = selectLocalBinaryArtifactFile(
    nextState,
    "active-feasibility",
    binary.id,
    { name: "test.step", size: 1024, type: "model/step", lastModified: 1730554200000 },
    "Tester",
    "2026-11-02T13:35:00Z",
  );
  const updatedBinaries = getLocalDocumentRegister(nextStateBinary, "active-feasibility", "EHW");
  const updatedBinary = updatedBinaries.find((b) => b.id === binary.id);
  assert.ok(updatedBinary);
  const binarySelection = nextStateBinary.binarySelections.find(
    (selection) => selection.id === binary.id,
  );
  assert.equal(binarySelection.fileName, "test.step");
  assert.equal(binarySelection.sizeBytes, 1024);
  assert.equal(binarySelection.uploaded, false);
  assert.equal(binarySelection.storageState, "Selected locally · not uploaded or shared");
  assert.equal("bytes" in binarySelection, false);
  assert.equal("content" in binarySelection, false);
  assert.equal(nextStateBinary.documentDrafts.length, nextState.documentDrafts.length);
});

test("the legacy browser-local shell is not exposed; its stored sample remains separate from authenticated data", () => {
  const route = fs.readFileSync(path.resolve(__dirname, "../src/routes/index.tsx"), "utf8");
  const component = fs.readFileSync(
    path.resolve(__dirname, "../src/components/LocalTestWorkspace.tsx"),
    "utf8",
  );
  const helper = fs.readFileSync(sourcePath("local-test-workspace"), "utf8");
  const sharedMembership = route.indexOf("setTestMembership(membership)");
  assert.doesNotMatch(route, /LocalTestWorkspace|localTestWorkspaceOpen|TEST Workspace/);
  assert.match(route, /portal\?\.demoLoaded && !testMembership/);
  assert.match(route, />\s*TEST DATA\s*<\/span>/);
  assert.match(route, /Reset sample/);
  assert.match(route, /<SharedDocumentVault[\s\S]{0,200}membership=\{testMembership\}/);
  assert.match(component, /localStorage\.getItem\(LOCAL_TEST_WORKSPACE_STORAGE_KEY\)/);
  assert.match(component, /localStorage\.setItem\(\s*LOCAL_TEST_WORKSPACE_STORAGE_KEY/);
  assert.doesNotMatch(
    component,
    /supabase|fetch\(|XMLHttpRequest|useServerFn|SharedOperationalWorkspace/i,
  );
  assert.doesNotMatch(helper, /supabase|fetch\(|XMLHttpRequest|https?:\/\//i);
  assert.match(component, /selected locally, not uploaded\/shared/);
  assert.notEqual(LOCAL_TEST_WORKSPACE_STORAGE_KEY, "XYZ Pvt Ltd-portal-v3");
  assert.ok(sharedMembership >= 0);
});
