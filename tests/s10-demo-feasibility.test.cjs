const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadTsModule(relativePath) {
  const fullPath = path.resolve(__dirname, relativePath);
  const source = fs.readFileSync(fullPath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", "require", compiled)(mod, mod.exports, imported=>imported.startsWith('./') ? loadTsModule(path.relative(__dirname,path.resolve(path.dirname(fullPath),imported+'.ts'))) : require(imported));
  return mod.exports;
}

const { getScenario } = loadTsModule("../src/lib/lifecycle-scenarios.ts");
const {
  availableFeasibilitySources,
  createDemoFeasibilitySheet,
  isDemoInputActionAllowed,
  seedS10DemoFeasibilitySnapshot,
  withS10DemoFeasibilitySources,
} = loadTsModule("../src/lib/s10-demo-feasibility.ts");
const { computeProgressiveStageAndTaskState } = loadTsModule(
  "../src/lib/canonical-lifecycle.ts",
);
const projectInputCatalog = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../src/lib/project-input-template.json"), "utf8"),
);
const s10 = getScenario("S10");

test("S10 demo identity flows from its unique enquiry to project and feasibility", () => {
  assert.ok(s10);
  const original = [
    {
      id: "existing-project",
      reference: "EXISTING-001",
      title: "Existing sample",
      type: "Project",
      status: "Draft",
      fields: {},
    },
    {
      id: "demo-s10-project",
      reference: "UNRELATED-001",
      title: "Unrelated record",
      type: "Project",
      status: "Draft",
      fields: {},
    },
  ];
  const sources = withS10DemoFeasibilitySources(original, s10);
  const again = withS10DemoFeasibilitySources(sources, s10);
  const enquiry = sources.find((record) => record.reference === "DEMO-ENQ-010");
  const project = sources.find((record) => record.reference === "DEMO-PROJ-010");

  assert.equal(sources.filter((record) => record.reference === "DEMO-ENQ-010").length, 1);
  assert.equal(sources.filter((record) => record.reference === "DEMO-PROJ-010").length, 1);
  assert.equal(enquiry.type, "Enquiry");
  assert.equal(project.type, "Project");
  assert.notEqual(enquiry.id, project.id);
  assert.notEqual(project.id, "demo-s10-project");
  assert.equal(project.fields.enquiryId, enquiry.id);
  assert.equal(project.fields.enquiryCode, enquiry.reference);
  assert.equal(enquiry.fields.linkedProjectId, project.id);
  assert.equal(enquiry.fields.demoOnly, "true");
  assert.equal(project.fields.feasibilityStatus, "Pending");
  assert.equal(project.fields.feasibilityApproval, "Not approved");
  assert.equal(project.fields.requirementsFreeze, "Not frozen");
  assert.equal(again.length, sources.length);
  assert.deepEqual(original.map((record) => record.id), ["existing-project", "demo-s10-project"]);
});

test("S10 enquiry and project appear in the chooser; project intake creates one linked draft", () => {
  const sources = withS10DemoFeasibilitySources([], s10);
  const chooser = availableFeasibilitySources(sources, [], "", "");
  const enquiry = chooser.find((record) => record.reference === "DEMO-ENQ-010");
  const project = chooser.find((record) => record.reference === "DEMO-PROJ-010");
  assert.ok(enquiry);
  assert.ok(project);

  const initialSnapshot = { sheets: [], events: [{ id: "existing-event" }] };
  const snapshot = createDemoFeasibilitySheet(
    initialSnapshot,
    sources,
    project.id,
    "Client",
    "2026-11-01T10:00:00.000Z",
    s10,
  );
  const sheet = snapshot.sheets[0];
  assert.equal(snapshot.events, initialSnapshot.events);
  assert.equal(sheet.source_record_id, project.id);
  assert.equal(sheet.project_record_id, project.id);
  assert.equal(sheet.status, "Draft");
  assert.equal(sheet.revision, 1);
  assert.equal(sheet.parameter_values["use_case"].input, "Custom vehicle telematics/GPS tracker; intended PoC/demo.");
  assert.equal(sheet.parameter_values["cellular"].input.includes("Requested 4G"), true);
  assert.equal(sheet.parameter_values["cellular"].input.includes("unanswered"), true);
  assert.equal(sheet.parameter_values["gnss"].input.includes("Requested IRNSS/NavIC"), true);
  assert.equal(
    sheet.parameter_values["special"].input,
    "Investigate LoRa for operation/data exchange without internet. Relationship to requested 4G connectivity is unresolved; no architecture is selected.",
  );
  for (const id of ["use_case", "cellular", "gnss", "special"]) {
    assert.equal(
      sheet.parameter_values[id].source,
      "DEMO ONLY · User-provided scenario brief · tentative, unverified",
    );
    assert.equal(sheet.parameter_values[id].finalValue, "");
    assert.deepEqual(sheet.parameter_values[id].responses, {});
  }
  assert.ok(projectInputCatalog.some((parameter) => parameter.id === "special"));
  assert.deepEqual(
    sheet.custom_parameters.map((parameter) => parameter.lead),
    ["EHW", "FW", "SW", "MECH", "PUR", "QA", "SAL", "EMF", "MMF"],
  );
  for (const parameter of sheet.custom_parameters) {
    const response = sheet.parameter_values[parameter.id];
    assert.match(parameter.hint, /Owner: TBD/);
    assert.equal(response.input, "");
    assert.equal(response.finalValue, "");
    assert.deepEqual(response.responses, {});
    assert.equal(response.source, "");
    assert.match(parameter.section, /DEMO ONLY/);
    assert.match(parameter.label, /·/);
  }
  for (const id of [
    "system_voltage",
    "operating_range",
    "sleep_current",
    "storage",
    "ip",
    "dimensions",
    "battery",
    "temperature",
    "certifications",
    "quantity",
    "cost",
    "delivery",
  ]) {
    assert.ok(projectInputCatalog.some((parameter) => parameter.id === id));
    assert.equal(sheet.parameter_values[id], undefined, `${id} must remain unanswered`);
  }
  assert.equal(sheet.client_evidence, "");
  assert.equal(
    availableFeasibilitySources(sources, snapshot.sheets, "", "").some(
      (record) => record.id === project.id,
    ),
    false,
  );
  assert.ok(
    availableFeasibilitySources(sources, snapshot.sheets, "", "").some(
      (record) => record.id === enquiry.id,
    ),
  );
  assert.throws(
    () =>
      createDemoFeasibilitySheet(
        snapshot,
        sources,
        project.id,
        "Client",
        "2026-11-01T10:00:00.000Z",
        s10,
      ),
    /DEMO_INPUT_SHEET_EXISTS/,
  );
});

test("S10 brief seed preserves other sheets and existing responses and never seeds approved sheets", () => {
  const sources = withS10DemoFeasibilitySources([], s10);
  const project = sources.find((record) => record.reference === "DEMO-PROJ-010");
  const existingOther = {
    id: "existing-sample",
    source_record_id: "existing-project",
    project_record_id: "existing-project",
    scope: "Client",
    input_owner_id: "demo-admin-id",
    revision: 1,
    version: 3,
    status: "Draft",
    parameter_values: { cellular: { input: "Existing sample", source: "Existing provenance", finalValue: "", required: true, responses: {} } },
    custom_parameters: [],
    client_evidence: "",
    updated_at: "2026-10-01T00:00:00.000Z",
  };
  const existingS10 = {
    ...existingOther,
    id: "existing-s10-draft",
    source_record_id: project.id,
    project_record_id: project.id,
    version: 4,
    parameter_values: {
      use_case: { input: "User-edited demo note", source: "Existing source", finalValue: "", required: true, responses: {} },
      cellular: {
        input: "",
        source: "User intentionally cleared this field",
        finalValue: "User's existing draft value",
        required: true,
        responses: { SAL: { status: "Pending", remarks: "Keep existing response", evidence: "local", ownerId: "", dueDate: "", authorId: "", reviewedBy: "" } },
      },
    },
    custom_parameters: [],
  };
  const snapshot = {
    sheets: [existingOther, existingS10],
    events: [{ id: "existing-event", action: "user-edit" }],
    unrelatedData: { preserved: true },
  };
  const seeded = seedS10DemoFeasibilitySnapshot(snapshot, sources, s10);

  assert.deepEqual(seeded.sheets[0], existingOther);
  assert.equal(seeded.sheets[1].parameter_values.use_case.input, "User-edited demo note");
  assert.equal(seeded.sheets[1].parameter_values.use_case.source, "Existing source");
  assert.equal(seeded.sheets[1].parameter_values.cellular.input, "");
  assert.equal(
    seeded.sheets[1].parameter_values.cellular.source,
    "User intentionally cleared this field",
  );
  assert.equal(seeded.sheets[1].parameter_values.cellular.finalValue, "User's existing draft value");
  assert.deepEqual(
    seeded.sheets[1].parameter_values.cellular.responses,
    existingS10.parameter_values.cellular.responses,
  );
  assert.equal(seeded.sheets[1].parameter_values.gnss.input.includes("Requested IRNSS/NavIC"), true);
  assert.equal(seeded.sheets[1].parameter_values.special.input.includes("Investigate LoRa"), true);
  assert.equal(seeded.sheets[1].version, 5);
  assert.equal(seeded.events, snapshot.events);
  assert.equal(seeded.unrelatedData, snapshot.unrelatedData);
  assert.equal(seedS10DemoFeasibilitySnapshot(seeded, sources, s10), seeded);

  const approved = { ...existingS10, status: "Approved" };
  const approvedSnapshot = { sheets: [approved], events: [] };
  assert.equal(
    seedS10DemoFeasibilitySnapshot(approvedSnapshot, sources, s10),
    approvedSnapshot,
  );
});

test("S10 downstream task generation stays blocked without an explicit authorized freeze", () => {
  const projectId = "DEMO-PROJ-010";
  const common = {
    projectId,
    track: "hardware_firmware_software",
    completedStageCodes: ["CM_01"],
    inProgressStageCodes: ["CM_03", "HW_01", "FW_01", "SW_01"],
    requireAuthorizedFeasibilityFreeze: true,
  };
  const blocked = computeProgressiveStageAndTaskState(common);
  assert.ok(
    blocked.activeTasks.every((task) => ["CM_01", "CM_02"].includes(task.stageCode)),
  );
  assert.ok(
    blocked.stages
      .filter((stage) => !["CM_01", "CM_02"].includes(stage.stageCode))
      .every((stage) => stage.status === "planned"),
  );

  const invalidAuthorization = {
    projectId,
    sheetId: "demo-sheet",
    revision: 1,
    status: "Approved",
    action: "freeze",
    authorizedBy: "Demo user",
    authorizedRole: "department_lead",
    authorizationId: "demo-approval",
    frozenAt: "2026-11-01T10:00:00.000Z",
  };
  const stillBlocked = computeProgressiveStageAndTaskState({
    ...common,
    feasibilityFreezeAuthorization: invalidAuthorization,
  });
  assert.ok(stillBlocked.activeTasks.every((task) => ["CM_01", "CM_02"].includes(task.stageCode)));

  const authorized = computeProgressiveStageAndTaskState({
    ...common,
    completedStageCodes: ["CM_01", "CM_02"],
    inProgressStageCodes: [],
    feasibilityFreezeAuthorization: {
      ...invalidAuthorization,
      authorizedRole: "admin",
    },
  });
  assert.ok(
    authorized.activeTasks.some(
      (task) => task.stageCode === "CM_03" || task.stageCode === "HW_01",
    ),
  );

  assert.equal(isDemoInputActionAllowed("create"), true);
  for (const action of ["approve", "revise", "link_project", "client_evidence"]) {
    assert.equal(isDemoInputActionAllowed(action), false);
  }
});
