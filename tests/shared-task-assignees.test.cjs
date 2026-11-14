const test = require("node:test");
const assert = require("node:assert/strict");

test("Shared TEST task assignees come from configured department L1–L4 profiles", async () => {
  const { sharedTaskAssigneeOptions } = await import("../src/lib/shared-task-assignees.ts");
  const members = [
    { id: "l1", display_name: "Avery Vale", role: "department_lead", department_id: "ehw" },
    { id: "l2", display_name: "Morgan Reed", role: "member", department_id: "ehw" },
    { id: "unmapped", display_name: "Unmapped Member", role: "member", department_id: "ehw" },
    { id: "viewer", display_name: "Read Only", role: "viewer", department_id: "ehw" },
    { id: "other-dept", display_name: "Taylor Quinn", role: "member", department_id: "hr" },
  ];
  const roles = [
    { id: "r1", departmentId: "ehw", name: "Hardware Lead", active: true, hierarchyLevel: 1, memberIds: ["l1"] },
    { id: "r2", departmentId: "ehw", name: "Senior Hardware Engineer", active: true, hierarchyLevel: 2, memberIds: ["l2"] },
    { id: "r3", departmentId: "ehw", name: "Unclassified Role", active: true, hierarchyLevel: null, memberIds: ["unmapped"] },
    { id: "r4", departmentId: "hr", name: "HR Lead", active: true, hierarchyLevel: 1, memberIds: ["other-dept"] },
    { id: "r5", departmentId: "ehw", name: "Inactive Operator", active: false, hierarchyLevel: 4, memberIds: ["unmapped"] },
  ];

  const options = sharedTaskAssigneeOptions("ehw", "unmapped", members, roles);
  assert.deepEqual(options, [
    {
      value: "unmapped",
      label: "Current assignment · profile not configured — Unmapped Member",
      configuredProfile: false,
    },
    {
      value: "l1",
      label: "L1 · Lead · Hardware Lead — Avery Vale",
      configuredProfile: true,
    },
    {
      value: "l2",
      label: "L2 · Senior / Specialist · Senior Hardware Engineer — Morgan Reed",
      configuredProfile: true,
    },
  ]);
});

test("an unconfigured department keeps the current assignment but offers no guessed assignee", async () => {
  const { sharedTaskAssigneeOptions } = await import("../src/lib/shared-task-assignees.ts");
  const members = [
    { id: "member", display_name: "Casey Rowan", role: "member", department_id: "emf" },
  ];

  assert.deepEqual(sharedTaskAssigneeOptions("emf", "member", members, []), [
    {
      value: "member",
      label: "Current assignment · profile not configured — Casey Rowan",
      configuredProfile: false,
    },
  ]);
  assert.deepEqual(sharedTaskAssigneeOptions("emf", null, members, []), []);
});
