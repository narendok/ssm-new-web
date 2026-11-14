const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("approval source record resolves its project through exact canonical ID/reference aliases", async () => {
  const { resolveApprovalProjectFromRecord } = await import("../src/lib/approval-master-links.ts");
  const projects = [
    { id: "project-1", reference: "PRJ-001", title: "Current project" },
    { id: "project-2", reference: "PRJ-002", title: "Another project" },
  ];
  for (const key of ["projectId", "project_id", "linkedProjectId"]) {
    assert.equal(resolveApprovalProjectFromRecord({ [key]: "project-1" }, projects), projects[0], `${key} UUID resolves to the canonical project`);
  }
  for (const key of ["projectCode", "project_code", "projectReference", "project"]) {
    assert.equal(resolveApprovalProjectFromRecord({ [key]: "PRJ-001" }, projects), projects[0], `${key} exact reference resolves to the canonical project`);
  }
  assert.equal(resolveApprovalProjectFromRecord({ projectId: "project-1", projectCode: "PRJ-002" }, projects), undefined,
    "conflicting aliases remain unlinked rather than choosing one project");
  assert.equal(resolveApprovalProjectFromRecord({ project: "Current project" }, projects), undefined,
    "project titles are not used as identity links");
  assert.equal(resolveApprovalProjectFromRecord({ projectId: "project-1", projectCode: "UNKNOWN" }, projects), undefined,
    "an unresolved populated alias blocks automatic project selection");
  assert.equal(resolveApprovalProjectFromRecord({ projectId: "project-1", projectCode: "PRJ-001" }, projects), projects[0],
    "consistent canonical ID and reference resolve together");
  assert.equal(resolveApprovalProjectFromRecord({ projectCode: "PRJ-001" }, [...projects, { id: "project-3", reference: "PRJ-001", title: "Conflicting reference" }]), undefined,
    "duplicate master references remain ambiguous");
});

test("approval submit rejects stale, conflicting and missing project associations", async () => {
  const { validateApprovalProjectLink } = await import("../src/lib/approval-master-links.ts");
  const projects = [{ id: "p1", reference: "PRJ-1", title: "One" }, { id: "p2", reference: "PRJ-2", title: "Two" }];
  assert.equal(validateApprovalProjectLink({ projectId: "p1" }, "PRJ-1", projects), "PRJ-1");
  assert.throws(() => validateApprovalProjectLink({ projectId: "p1" }, "PRJ-2", projects), /must match/);
  assert.throws(() => validateApprovalProjectLink({ projectId: "p1" }, "", projects), /must match/);
  assert.throws(() => validateApprovalProjectLink({ projectId: "missing" }, "PRJ-1", projects), /unresolved/);
  assert.throws(() => validateApprovalProjectLink({ projectId: "p1" }, "stale", projects), /current project/);
  assert.throws(() => validateApprovalProjectLink({}, "PRJ-1", projects), /not linked/);
  assert.equal(validateApprovalProjectLink({}, "", projects), "", "common records may remain without a project");
});

test("approval request selectors use configured departments and canonical record/project IDs", () => {
  const view = read("src/components/ApprovalsFullPageView.tsx");
  const route = read("src/routes/index.tsx");
  const operational = read("src/components/SharedOperationalWorkspace.tsx");

  assert.match(view, /departments\?: \{ id: string; code: string; name: string \}\[\]/);
  assert.match(view, /departments\.filter\(department => department\.code\.toUpperCase\(\) !== "CLIENT"\)\.map/);
  assert.doesNotMatch(view, /<option value="TST">|<option value="HR">|<option value="EHW">/);
  assert.match(view, /options=\{records\.map\(record => \(\{ value: record\.id, label:/);
  assert.match(view, /resolveApprovalProjectFromRecord\(source\?\.fields, projects\)/,
    "choosing a source record resolves its project from the canonical link resolver");
  assert.match(view, /options=\{projects\.map\(project => \(\{ value: project\.id \|\| project\.reference, label:/);
  assert.match(view, /setReqProject\(project\?\.reference \|\| ""\)/);
  assert.match(route, /departments=\{portal\.departments\s*\.filter\(\s*\(?department\)?\s*=>\s*department\.active\)/);
  assert.match(operational, /departments=\{data\.departments\.map\(department=>/);
});
