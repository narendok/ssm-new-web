const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("authenticated customer directory uses shared canonical data before the browser-local register", () => {
  const route = read("src/routes/index.tsx");
  const sharedRoute = route.indexOf('testMembership && view === "customers"');
  const localRoute = route.indexOf(') : view === "customers" ? (', sharedRoute);
  assert.ok(sharedRoute >= 0 && localRoute > sharedRoute, "authenticated TEST directory must take precedence over local examples");
  assert.match(route.slice(sharedRoute, localRoute), /SharedCustomerDirectoryWorkspace[\s\S]*membership=\{testMembership\}/);

  const workspace = read("src/components/SharedCustomerDirectoryWorkspace.tsx");
  assert.match(workspace, /useServerFn\(getSharedTestWorkspace\)/);
  assert.match(workspace, /useServerFn\(mutateSharedTestWorkspace\)/);
  assert.match(workspace, /sharedCustomerDirectory\(query\.data\)/);
  assert.match(workspace, /action:\s*"create_record"[\s\S]*record_type:\s*"Customer"/);
  assert.match(workspace, /if \(!result\?\.id\) throw new Error/);
  assert.match(workspace, /No browser-local examples are shown as a fallback/);
  assert.doesNotMatch(workspace, /defaultCustomers|localStorage|handleCustomerCreated/);
});

test("customer directory keeps canonical IDs and only enriches visible records", () => {
  const adapter = read("src/lib/shared-customer-directory.ts");
  assert.match(adapter, /\(snapshot\.customerOptions \?\? \[\]\)\.map\(option/);
  assert.match(adapter, /id:\s*option\.id/);
  assert.match(adapter, /const records = snapshot\.records\.filter\(record => record\.record_type === "Customer"\)/);
  assert.match(adapter, /const record = byId\.get\(option\.id\)/);
  assert.match(adapter, /customerOptions|customerId/);
  assert.match(adapter, /fieldText\(record\?\.fields\["spocEmail"\]\)/);
});

test("directory uses shared option IDs, enriches only visible records, and counts linked opportunities", async () => {
  const { sharedCustomerDirectory } = await import("../src/lib/shared-customer-directory.ts");
  const snapshot = {
    customerOptions: [
      { id: "customer-visible", reference: "CUS-01", title: "Northstar", status: "Active" },
      { id: "customer-summary", reference: "CUS-02", title: "Other Customer", status: "Active" },
    ],
    records: [
      { id: "customer-visible", record_type: "Customer", reference: "CUS-01-R2", title: "Northstar Mobility", status: "Active", fields: { division: "EV Systems", spocEmail: "sales@example.test" }, updated_at: "2026-11-12" },
      { id: "opportunity-1", record_type: "Opportunity", reference: "OP-01", title: "Fleet gateway", status: "Open", fields: { customerId: "customer-visible" }, updated_at: "2026-11-12" },
    ],
  };

  const customers = sharedCustomerDirectory(snapshot);
  const visible = customers.find(customer => customer.id === "customer-visible");
  const summary = customers.find(customer => customer.id === "customer-summary");
  assert.equal(visible.name, "Northstar Mobility");
  assert.equal(visible.code, "CUS-01-R2");
  assert.equal(visible.activeOpportunitiesCount, 1);
  assert.equal(summary.name, "Other Customer");
  assert.equal(summary.spocEmail, "", "summary-only choices do not invent or expose contact data");
});

test("inactive customer master statuses stay unselectable in Sales intake", async () => {
  const { sharedCustomerDirectory } = await import("../src/lib/shared-customer-directory.ts");
  const { isSelectableMasterStatus } = await import("../src/lib/shared-master-options.ts");
  const statuses = ["Archived", "Obsolete", "Rejected", "Inactive", "Cancelled", "Canceled", "Retired", "Disabled"];
  const customers = sharedCustomerDirectory({
    customerOptions: statuses.map((status, index) => ({ id: `customer-${index}`, reference: `CUS-${index}`, title: status, status })),
    records: [],
  });
  for (const customer of customers) {
    assert.equal(customer.status, "Inactive");
    assert.equal(isSelectableMasterStatus(customer.status), false);
  }
});

test("Sales intake can select organization customers even when their full records are department-scoped", async () => {
  const { sharedSalesPipeline } = await import("../src/lib/shared-sales.ts");
  const intakeSource = read("src/components/SalesWorkspaceAndCustomerRegister.tsx");
  assert.match(intakeSource, /options=\{selectableCustomers\.map\(c=>\(\{value:c\.id,label:/, "Sales selection stores the stable customer ID");
  assert.match(intakeSource, /customerChoices = customers\.filter\(customer => customer\.status !== "Inactive"\)/, "inactive customer masters are excluded from new intake choices");
  assert.match(intakeSource, /enq\.customerId \|\| customers\.find\(customer => customer\.code === enq\.customerCode\)\?\.id/, "legacy code-linked enquiries resolve back to the canonical ID where possible");
  const snapshot = {
    customerOptions: [{ id: "customer-summary", reference: "CUS-02", title: "Shared customer", status: "Active" }],
    records: [
      { id: "opportunity-2", record_type: "Opportunity", reference: "OP-02", title: "New opportunity", status: "Open", fields: { customerId: "customer-summary" }, notes: "Fictional TEST", updated_at: "2026-11-12" },
    ],
    approvals: [],
    departments: [],
  };

  const { customers, enquiries } = sharedSalesPipeline(snapshot);
  assert.equal(customers.length, 1);
  assert.equal(customers[0].id, "customer-summary");
  assert.equal(enquiries[0].customerName, "Shared customer");
  assert.equal(enquiries[0].customerCode, "CUS-02");
});

test("shared TEST record creation uses the cross-department supplier directory before visible records", () => {
  const workspace = read("src/components/SharedTestWorkspace.tsx");
  assert.match(workspace, /const supplierOptions = sharedSupplierOptions\([\s\S]*data\.supplierOptions\.length[\s\S]*data\.supplierOptions\.map\(option => \(\{ \.\.\.option, record_type: "Supplier" \}\)\)[\s\S]*data\.records/);
  assert.match(workspace, /case "suppliers": return supplierOptions/);
  assert.match(workspace, /SharedMasterSelect label=\{item\.label\} options=\{recordMasterOptions\(item\.master\)\}/);
});
