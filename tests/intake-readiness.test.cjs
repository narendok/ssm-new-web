const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const source = fs.readFileSync(path.join(__dirname, "../src/lib/portal-intake.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", "require", compiled)(mod, mod.exports, require);
const { validateIntakeProject, salesEnquiryFromRecord, reconcileSalesEnquiries, suggestIntakeReference } = mod.exports;
const project = { id: "project-1", reference: "HLPL-OBDTEST-01", type: "Project" };
test("new sales intake can precede a project while explicit links reject unknown and archived projects", () => {
  for (const type of ["Enquiry", "Opportunity", "Enquiry & Opportunity", "Lead intake"])
    assert.equal(validateIntakeProject([project], type, ""), "");
  for (const code of ["HLPL-AI4T-01", "HLPL-UNKNOWN-01"])
    assert.throws(
      () => validateIntakeProject([project], "Enquiry", code),
      /Select an existing project/,
    );
  assert.equal(validateIntakeProject([project], "Enquiry", project.reference), project.reference);
  assert.throws(() =>
    validateIntakeProject([{ ...project, archived: true }], "Enquiry", project.reference),
  );
  for (const type of ["Order", "Handover", "PRS", "BOM"])
    assert.throws(() => validateIntakeProject([project], type, ""));
});
test("standalone inquiry keeps its own identity without fabricating a project link", () => {
  const reference = suggestIntakeReference(
    [{ reference: "HLPL-SAL-ENQ-0001" }, { reference: "hlpl-sal-enq-0002" }],
    "Enquiry",
  );
  assert.equal(reference, "HLPL-SAL-ENQ-0003");
  const record = {
    id: "new-inquiry",
    reference,
    type: "Enquiry",
    title: "New requirement",
    fields: { customer: "OEM", scope: "New tracker" },
    createdAt: "2026-10-21",
    updatedAt: "2026-10-21",
  };
  const saved = salesEnquiryFromRecord(record, []);
  assert.equal(saved.linkedProjectCode, "");
  assert.equal(saved.reference, reference);
  assert.equal(saved.id, record.id);
  assert.equal(saved.status, "Pending Enquiry");
  assert.equal(suggestIntakeReference([], "Opportunity"), "HLPL-SAL-OPP-0001");
});
test("project creation uses a unique canonical project code, including archived identities", () => {
  assert.equal(validateIntakeProject([], "Project", "HLPL-NEW-01"), "HLPL-NEW-01");
  assert.throws(
    () => validateIntakeProject([project], "Project", project.reference),
    /already exists/,
  );
  assert.throws(
    () => validateIntakeProject([{ ...project, archived: true }], "Project", project.reference),
    /already exists/,
  );
  assert.throws(() => validateIntakeProject([], "Project", "free text"), /unique project code/);
});
test("saved sales record maps to the same enquiry identity, scope and customer without sample data", () => {
  const record = {
    id: "enquiry-1",
    reference: "HLPL-OBDTEST-SAL-ENQ-01",
    type: "Enquiry",
    title: "Synthetic OEM enquiry",
    fields: { projectId: project.reference, customerId: "customer-canonical-1", customer: "Synthetic OEM", scope: "New OBD tracker", targetVolume: "12 evaluation units", targetDate: "2027-02-15" },
    createdAt: "2026-10-20",
    updatedAt: "2026-10-20",
  };
  const enquiry = salesEnquiryFromRecord(record, []);
  assert.equal(enquiry.id, record.id);
  assert.equal(enquiry.reference, record.reference);
  assert.equal(enquiry.linkedProjectCode, project.reference);
  assert.equal(enquiry.scopeSummary, record.fields.scope);
  assert.equal(enquiry.targetVolume, "12 evaluation units");
  assert.equal(enquiry.targetClosureDate, "2027-02-15");
  assert.equal(enquiry.customerName, "Synthetic OEM");
  assert.equal(enquiry.customerId, "customer-canonical-1");
  assert.equal(enquiry.spocEmail, "");
  assert.deepEqual(enquiry.feasibilitySignedDepts, []);
  assert.equal(enquiry.status, "Pending Enquiry");
});

test("Sales projection recovers missing volume/date from its intake record and hides archived local drafts", () => {
  const enquiry = {
    id: "enquiry-1", reference: "HLPL-TEST-ENQ-01", kind: "enquiry", title: "Synthetic",
    customerCode: "", customerName: "Synthetic OEM", spocName: "", spocEmail: "", scopeSummary: "",
    targetVolume: "Not recorded", targetClosureDate: "", salesOwner: "Not assigned",
    status: "Pending Enquiry", feasibilitySignedDepts: [], totalFeasibilityDepts: 0,
    createdAt: "2026-11-06", updatedAt: "2026-11-06",
  };
  const source = {
    id: enquiry.id, reference: enquiry.reference, type: "Enquiry", title: "Synthetic",
    notes: "Synthetic scope", fields: { targetVolume: "12 evaluation units", targetDate: "2027-02-15" },
    createdAt: "2026-11-06", updatedAt: "2026-11-06",
  };
  const repaired = reconcileSalesEnquiries([enquiry], [source]);
  assert.equal(repaired[0].targetVolume, "12 evaluation units");
  assert.equal(repaired[0].targetClosureDate, "2027-02-15");
  assert.equal(repaired[0].scopeSummary, "Synthetic scope");
  assert.deepEqual(reconcileSalesEnquiries([enquiry], [{ ...source, archived: true }]), []);
});

test("feasibility can run before project creation, with its own unique inquiry reference", () => {
  const { feasibilityIntakeContext } = mod.exports;
  assert.deepEqual(feasibilityIntakeContext([], { id: "e1", reference: "ENQ-1" }), {
    contractReference: "ENQ-1-CONTRACT-01",
    projectCode: "",
  });
  assert.notEqual(
    feasibilityIntakeContext([], { id: "e2", reference: "ENQ-2" }).contractReference,
    "ENQ-1-CONTRACT-01",
  );
  assert.throws(() =>
    feasibilityIntakeContext([], { id: "e1", reference: "ENQ-1", linkedProjectCode: "missing" }),
  );
});
test("later project association preserves inquiry, review IDs and outcomes and scopes changes by provenance", () => {
  const { linkIntakeProject } = mod.exports;
  const source = {
    id: "enquiry",
    reference: "ENQ-1",
    type: "Enquiry",
    fields: { scope: "Original", customerId: "customer-canonical-1", customer: "Synthetic OEM", customerCode: "CUS-01" },
  };
  const contract = {
    id: "contract",
    reference: "ENQ-1-CONTRACT-01",
    type: "Contract review",
    fields: { enquiryId: "enquiry", revision: "01" },
    status: "Approved",
  };
  const task = {
    id: "task",
    reference: "T1",
    type: "Task",
    fields: { linkedRecords: contract.reference },
    status: "Approved",
  };
  const unrelated = {
    id: "other",
    reference: "T2",
    type: "Task",
    fields: { linkedRecords: "ENQ-2-CONTRACT-01" },
  };
  const rows = [source, contract, task, unrelated, { ...project, fields: {} }];
  const approval = {
    id: "approval",
    recordId: contract.reference,
    outcome: "Approved",
    signedBy: "QA lead",
    evidenceRevision: "01",
  };
  const linked = linkIntakeProject(
    rows,
    [{ id: "enquiry", status: "Feasibility Complete" }],
    [approval],
    source.id,
    project.reference,
  );
  assert.equal(linked.records[0].reference, "ENQ-1");
  assert.equal(linked.records[1].reference, contract.reference);
  assert.equal(linked.records[1].fields.revision, "01");
  assert.equal(linked.records[2].status, "Approved");
  assert.equal(linked.records[2].fields.projectId, project.reference);
  const linkedProject = linked.records.find(record => record.type === "Project");
  assert.equal(linkedProject.fields.customerId, "customer-canonical-1");
  assert.equal(linkedProject.fields.customer_id, "customer-canonical-1");
  assert.equal(linkedProject.fields.customerCode, "CUS-01");
  assert.equal(linked.records[3], unrelated);
  assert.deepEqual(linked.approvals[0], { ...approval, project: project.reference });
  assert.equal(linked.enquiries[0].status, "Feasibility Complete");
  assert.equal(linked.enquiries[0].linkedProjectCode, project.reference);
  assert.equal(source.fields.projectId, undefined);
  assert.throws(
    () => linkIntakeProject(linked.records, linked.enquiries, linked.approvals, source.id, ""),
    /reviewed change/,
  );
});
