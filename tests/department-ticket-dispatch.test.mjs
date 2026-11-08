import test from "node:test";
import assert from "node:assert/strict";

test("department help requests are explicit, linked, and projected without the private ticket thread", async () => {
  const { filterAuthorizedTickets } = await import("../src/lib/service-tickets.ts");
  const source = {
    id: "ticket-private-1", reference: "TKT-2026-0101", source: "Internal",
    requesterName: "Kai Morgan", requesterEmail: "kai@example.test", requesterDepartment: "SIT",
    subject: "Gateway fault investigation", description: "Original ticket details",
    category: "Cloud & Gateway", priority: "High", status: "In Progress",
    projectId: "PROJECT-SECRET", assetId: "ASSET-SECRET", assignedOwner: "Preeti Joshi (SIT)",
    slaDueHours: 12, createdAt: "2026-11-08T09:00:00Z", updatedAt: "2026-11-08T09:00:00Z",
    replies: [{ id: "private", authorName: "Kai", authorRole: "SIT", isInternalNote: true, message: "Private diagnostic note", createdAt: "2026-11-08T09:01:00Z" }],
    history: [{ timestamp: "2026-11-08T09:00:00Z", actor: "Kai", action: "Created" }],
    departmentHelpRequests: [{ id: "help-1", departmentCode: "EHW", departmentName: "Embedded Hardware", summary: "Please review the power input transient evidence reference TR-17 and advise whether hardware inspection is needed.", status: "Requested", requestedBy: "Kai Morgan (SIT)", createdAt: "2026-11-08T09:02:00Z" }],
  };

  const ehw = filterAuthorizedTickets([source], { role: "ehw", email: "avery@example.test", department: "ehw" });
  assert.equal(ehw.length, 1);
  assert.equal(ehw[0].subject, "Department help · TKT-2026-0101");
  assert.match(ehw[0].description, /TR-17/);
  assert.equal(ehw[0].projectId, undefined);
  assert.equal(ehw[0].assetId, undefined);
  assert.equal(ehw[0].replies.length, 0);
  assert.equal(ehw[0].history.length, 1);
  assert.equal(ehw[0].departmentHelpRequests.length, 1);
  assert.equal(ehw[0].departmentHelpRequests[0].id, "help-1");

  assert.deepEqual(filterAuthorizedTickets([source], { role: "qa", email: "jordan@example.test", department: "qa" }), []);
  assert.equal(filterAuthorizedTickets([source], { role: "sit", email: "kai@example.test", department: "sit" })[0].replies[0].message, "Private diagnostic note");

  const closed = { ...source, departmentHelpRequests: [{ ...source.departmentHelpRequests[0], status: "Closed" }] };
  assert.deepEqual(filterAuthorizedTickets([closed], { role: "ehw", email: "avery@example.test", department: "ehw" }), []);
});

test("department ticket workspace exposes a separate receiving-department help inbox", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../src/components/ServiceTicketsWorkspace.tsx", import.meta.url), "utf8");
  assert.match(source, /Requests to My Department/);
  assert.match(source, /Request department help/);
  assert.match(source, /Send help response/);
  assert.match(source, /ticket thread and internal notes stay with Service & IT/);
  assert.match(source, /Create linked record/);
  const route = await readFile(new URL("../src/routes/index.tsx", import.meta.url), "utf8");
  assert.match(route, /sourceTicketReference: ticket\.reference/);
  assert.match(route, /Draft only\. Confirm evidence, project, ownership, and next actions/);
});

test("recurring issue signals require distinct matching tickets and recommend a technical owner", async () => {
  const { findRecurringIssueSignals } = await import("../src/lib/service-tickets.ts");
  const base = {
    source: "Client", requesterName: "Fictional requester", requesterEmail: "requester@example.test",
    category: "Hardware Fault", priority: "Normal", status: "Open", slaDueHours: 24,
    createdAt: "2026-11-08T09:00:00Z", updatedAt: "2026-11-08T09:00:00Z",
    replies: [], history: [],
  };
  const first = { ...base, id: "one", reference: "TKT-2026-1001", subject: "GPS fix drops during regen braking" };
  const second = { ...base, id: "two", reference: "TKT-2026-1002", subject: "During regenerative braking, GPS fix drops" };
  const duplicateId = { ...second, reference: "TKT-2026-1002" };
  const signals = findRecurringIssueSignals([first, second, duplicateId]);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].reportCount, 2);
  assert.equal(signals[0].suggestedDepartment, "EHW");
  assert.deepEqual(signals[0].ticketReferences, ["TKT-2026-1001", "TKT-2026-1002"]);
  assert.deepEqual(findRecurringIssueSignals([first]), []);
  const { readFile } = await import("node:fs/promises");
  const component = await readFile(new URL("../src/components/ServiceTicketsWorkspace.tsx", import.meta.url), "utf8");
  assert.match(component, /Recurring issue signals/);
  assert.match(component, /Request technical review/);
});

