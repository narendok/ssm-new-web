const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("shared TEST record forms use searchable master directories and persist canonical IDs", () => {
  const workspace = read("src/components/SharedTestWorkspace.tsx");
  assert.match(workspace, /isSelectableMasterStatus/);
  assert.match(workspace, /data\.customerOptions\.filter\(option => isSelectableMasterStatus\(option\.status\)\)/);
  assert.match(workspace, /data\.partOptions\.filter\(option => isSelectableMasterStatus\(option\.status\)\)/);
  assert.match(workspace, /data\.productOptions\.filter\(option => isSelectableMasterStatus\(option\.status\)\)/);
  assert.match(workspace, /record_type === "Project" && isSelectableMasterStatus\(r\.status\)/);
  for (const directory of ["customerOptions", "supplierOptions", "partOptions", "productOptions"]) {
    assert.ok(workspace.includes(`data.${directory}`), `${directory} must feed record master selectors`);
  }
  assert.match(workspace, /case "projects": return projects\.map\(project => \(\{ value: project\.id, label: `\$\{project\.reference\} · \$\{project\.title\}` \}\)\)/);
  assert.match(workspace, /<SharedMasterSelect\s+label="Project"[\s\S]*?options=\{recordMasterOptions\("projects"\)\}/);
  assert.match(workspace, /item\.master \? <SharedMasterSelect label=\{item\.label\} options=\{recordMasterOptions\(item\.master\)\}/);
  assert.match(workspace, /masterIdFields: Record<string, string> = \{ customers: "customerId", suppliers: "supplierId", parts: "partId", products: "productId" \}/);
  assert.match(workspace, /if \(idField && selectedId\) mappedFields\[idField\] = selectedId/);
  assert.match(workspace, /item\.key !== "projectId"/);
});

test("shared TEST reads resolve renamed master labels by canonical ID without mutating stored rows", async () => {
  const { resolveSharedMasterSnapshotLabels } = await import("../src/lib/shared-master-snapshot.ts");
  const snapshot = {
    customerOptions: [{ id: "customer-1", reference: "CUS-01-R2", title: "Current Customer Name", status: "Active" }],
    supplierOptions: [{ id: "supplier-1", reference: "SUP-01-R3", title: "Current Supplier Name", status: "Active" }],
    partOptions: [{ id: "part-1", reference: "PART-01-R2", title: "Part", status: "Active", mpn: "CURRENT-MPN" }],
    productOptions: [{ id: "product-1", reference: "PROD-01-R2", title: "Product", status: "Active" }],
    records: [
      { id: "project-1", record_type: "Project", reference: "PRJ-01", title: "Current Project Name", fields: {} },
      { id: "record-1", record_type: "Purchase request", reference: "REQ-01", title: "Request", fields: {
        customerId: "customer-1", customer: "Old Customer Name", customerCode: "CUS-01-R1",
        supplierId: "supplier-1", supplier: "Old Supplier Name", supplierCode: "SUP-01-R1",
        partId: "part-1", mpn: "OLD-MPN", productId: "product-1", productCode: "PROD-01-R1",
        projectId: "PRJ-01",
      } },
      { id: "record-2", record_type: "Legacy", reference: "LEG-01", title: "Unavailable master", fields: {
        customerId: "not-visible", customer: "Historical label",
      } },
      { id: "record-3", record_type: "Legacy", reference: "LEG-02", title: "Valid secondary aliases", fields: {
        customerId: "stale-customer", customer_id: "customer-1", customerCode: "stale-code", customer_code: "CUS-01-R2",
        supplierId: "stale-supplier", supplier_id: "supplier-1", partId: "stale-part", part_id: "part-1",
        productId: "stale-product", product_id: "product-1", projectId: "stale-project", project_id: "project-1",
      } },
    ],
  };
  const original = structuredClone(snapshot);
  const resolved = resolveSharedMasterSnapshotLabels(snapshot);
  const linked = resolved.records.find(record => record.id === "record-1").fields;
  assert.equal(linked.customer, "Current Customer Name");
  assert.equal(linked.customer_id, "customer-1");
  assert.equal(linked.customerCode, "CUS-01-R2");
  assert.equal(linked.customer_code, "CUS-01-R2");
  assert.equal(linked.supplier, "Current Supplier Name");
  assert.equal(linked.supplier_id, "supplier-1");
  assert.equal(linked.supplierCode, "SUP-01-R3");
  assert.equal(linked.supplier_code, "SUP-01-R3");
  assert.equal(linked.part, "Part");
  assert.equal(linked.partId, "part-1");
  assert.equal(linked.part_id, "part-1");
  assert.equal(linked.partCode, "PART-01-R2");
  assert.equal(linked.mpn, "CURRENT-MPN");
  assert.equal(linked.product, "Product");
  assert.equal(linked.productId, "product-1");
  assert.equal(linked.product_id, "product-1");
  assert.equal(linked.productCode, "PROD-01-R2");
  assert.equal(linked.projectId, "project-1");
  assert.equal(linked.project_id, "project-1");
  assert.equal(linked.linkedProjectId, "project-1");
  assert.equal(linked.project_code, "PRJ-01");
  assert.equal(linked.projectName, "Current Project Name");
  assert.equal(resolved.records.find(record => record.id === "record-2").fields.customer, "Historical label");
  const aliasRepaired = resolved.records.find(record => record.id === "record-3").fields;
  assert.deepEqual(aliasRepaired, original.records.find(record => record.id === "record-3").fields,
    "a valid secondary ID cannot silently overwrite another populated, unknown ID");
  assert.deepEqual(snapshot, original, "master label resolution is response-only and never rewrites persisted data");

  const serverRead = read("src/lib/shared-test.functions.ts");
  assert.match(serverRead, /resolveSharedMasterSnapshotLabels\(sharedTestSnapshotSchema\.parse\(data\)\)/,
    "the common authenticated workspace read applies canonical display names for every consumer");
});

test("archived project masters can refresh linked history labels without becoming selectable records", async () => {
  const { resolveSharedMasterSnapshotLabels } = await import("../src/lib/shared-master-snapshot.ts");
  const snapshot = {
    customerOptions: [], supplierOptions: [], partOptions: [], productOptions: [],
    projectOptions: [{ id: "archived-project-id", reference: "TEST-OLD-01", title: "Archived TEST project", status: "Active", archived: true }],
    records: [{ id: "linked-record", record_type: "BOM", reference: "BOM-01", title: "Historical BOM", status: "Draft", fields: { projectId: "archived-project-id" } }],
  };
  const resolved = resolveSharedMasterSnapshotLabels(snapshot);
  const fields = resolved.records[0].fields;
  assert.equal(fields.projectId, "archived-project-id");
  assert.equal(fields.projectCode, "TEST-OLD-01");
  assert.equal(fields.projectName, "Archived TEST project");

  const workspace = read("src/components/SharedTestWorkspace.tsx");
  assert.match(workspace, /const projects = data\.records\.filter\(\(r\) => r\.record_type === "Project" && isSelectableMasterStatus\(r\.status\)\)/,
    "new-work project choices remain limited to active project records");

  const migration = read("supabase/migrations/20261112213606_shared_archived_project_display_lookup.sql");
  assert.match(migration, /'projectOptions'/, "the shared read adds a separate display-only lookup");
  assert.match(migration, /p\.archived_at IS NOT NULL/, "only archived projects enter the historical lookup");
  assert.match(migration, /linked\.archived_at IS NULL[\s\S]*private\.shared_test_record_visible\(linked\.id\)/,
    "archived labels are scoped to a visible active linked record");
  assert.match(migration, /'records',COALESCE[\s\S]*r\.archived_at IS NULL/,
    "archived projects stay out of the selectable records list");
});

test("canonical snapshot label resolution repairs exact legacy master references without guessing duplicates", async () => {
  const { resolveSharedMasterSnapshotLabels } = await import("../src/lib/shared-master-snapshot.ts");
  const snapshot = {
    customerOptions: [
      { id: "customer-1", reference: "CUS-EXACT", title: "Exact Customer", status: "Active" },
      { id: "customer-2", reference: "CUS-DUP", title: "Duplicate A", status: "Active" },
      { id: "customer-3", reference: "CUS-DUP", title: "Duplicate B", status: "Active" },
    ],
    supplierOptions: [{ id: "supplier-1", reference: "SUP-EXACT", title: "Exact Supplier", status: "Active" }],
    partOptions: [{ id: "part-1", reference: "PART-EXACT", title: "Part", status: "Active", mpn: "MPN-1" }],
    productOptions: [{ id: "product-1", reference: "PROD-EXACT", title: "Product", status: "Active" }],
    projectOptions: [
      { id: "project-archived", reference: "PRJ-OLD", title: "Historical project", status: "Active", archived: true },
      { id: "project-duplicate-a", reference: "PRJ-DUP", title: "Duplicate project A", status: "Active", archived: true },
      { id: "project-duplicate-b", reference: "PRJ-DUP", title: "Duplicate project B", status: "Active", archived: true },
    ],
    records: [
      { id: "legacy-exact", record_type: "Legacy", reference: "LEG-1", title: "Legacy links", fields: {
        customer_code: "CUS-EXACT", supplier_code: "SUP-EXACT", part_code: "PART-EXACT", product_code: "PROD-EXACT", project: "PRJ-OLD",
      } },
      { id: "legacy-ambiguous", record_type: "Legacy", reference: "LEG-2", title: "Ambiguous legacy link", fields: { customerCode: "CUS-DUP" } },
      { id: "legacy-uuid", record_type: "Legacy", reference: "LEG-3", title: "Legacy project UUID", fields: { linkedProjectId: "project-archived" } },
      { id: "legacy-ambiguous-project", record_type: "Legacy", reference: "LEG-4", title: "Ambiguous project reference", fields: { projectCode: "PRJ-DUP" } },
      { id: "legacy-conflicting-customer", record_type: "Legacy", reference: "LEG-5", title: "Conflicting customer IDs", fields: {
        customerId: "customer-1", customer_id: "customer-2", customerCode: "CUS-EXACT",
      } },
    ],
  };
  const resolved = resolveSharedMasterSnapshotLabels(snapshot);
  const exact = resolved.records.find(record => record.id === "legacy-exact").fields;
  assert.equal(exact.customerId, "customer-1");
  assert.equal(exact.customer_id, "customer-1");
  assert.equal(exact.customer, "Exact Customer");
  assert.equal(exact.supplierId, "supplier-1");
  assert.equal(exact.supplier_id, "supplier-1");
  assert.equal(exact.supplier, "Exact Supplier");
  assert.equal(exact.partId, "part-1");
  assert.equal(exact.productId, "product-1");
  assert.equal(exact.projectId, "project-archived");
  assert.equal(exact.project_id, "project-archived");
  assert.equal(exact.projectName, "Historical project");
  assert.equal(resolved.records.find(record => record.id === "legacy-ambiguous").fields.customerId, undefined,
    "duplicate references stay unresolved instead of selecting the first match");
  assert.equal(resolved.records.find(record => record.id === "legacy-ambiguous-project").fields.projectId, undefined,
    "duplicate project references stay unresolved instead of linking to whichever row appears first");
  const conflict = resolved.records.find(record => record.id === "legacy-conflicting-customer").fields;
  assert.equal(conflict.customerId, "customer-1");
  assert.equal(conflict.customer_id, "customer-2");
  assert.equal(conflict.customer, undefined,
    "conflicting valid IDs must remain unresolved even when a reference alias matches one master");
  const uuidProject = resolved.records.find(record => record.id === "legacy-uuid").fields;
  assert.equal(uuidProject.projectCode, "PRJ-OLD");
  assert.equal(uuidProject.projectName, "Historical project");
});

test("master refresh preserves unknown ID aliases rather than overwriting them from another alias", async () => {
  const { resolveSharedMasterFields } = await import("../src/lib/shared-master-snapshot.ts");
  const snapshot = { customerOptions: [{ id: "c1", reference: "C-1", title: "Customer", status: "Active" }], supplierOptions: [], partOptions: [], productOptions: [], projectOptions: [], records: [] };
  for (const fields of [
    { customerId: "c1", customer_id: "unknown" },
    { customerId: "unknown", customerCode: "C-1" },
  ]) assert.deepEqual(resolveSharedMasterFields(fields, snapshot), fields);
  const consistent = resolveSharedMasterFields({ customerId: "c1", customer_id: "C-1" }, snapshot);
  assert.equal(consistent.customer_id, "c1", "an exact legacy reference and canonical UUID may identify the same master");
});

test("customer edit selector binds canonical IDs and makes unresolved legacy labels visible", () => {
  const workspace = read("src/components/SharedOperationalWorkspace.tsx");
  assert.match(workspace, /if \(field\.master === "customers"\)[\s\S]*?const customerId = values\["customerId"\] \|\| values\["customer_id"\] \|\| ""/,
    "editing a shared record selects the canonical customer ID, not the display label");
  assert.match(workspace, /value=\{customerId\}/,
    "the searchable customer picker stays selected after a record is reopened");
  assert.match(workspace, /Saved customer text is not linked to a master:/,
    "legacy display values without an exact canonical match remain visible and clearly unlinked");
  assert.match(workspace, /Choose a customer above to create the canonical link\./,
    "a user can explicitly link the legacy value through the current customer directory");
  assert.match(workspace, /const supplierId = values\["supplierId"\] \|\| values\["supplier_id"\] \|\| ""/,
    "editing a shared record selects the canonical supplier ID, not its display label");
  assert.match(workspace, /Saved supplier text is not linked to a master:/,
    "supplier display values without a canonical match are visibly marked as unlinked");
});

test("shared TEST master edits update canonical IDs together with selected display values", () => {
  const workspace = read("src/components/SharedTestWorkspace.tsx");
  assert.match(workspace, /const recordMasterValue = \(field: RecordField\) =>\s+\{[\s\S]*?values\["customerId"\][\s\S]*?values\["supplierId"\][\s\S]*?values\["partId"\][\s\S]*?values\["productId"\]/,
    "reopened shared TEST records select the existing master by its stable ID even when their display label was refreshed");
  assert.match(workspace, /const setRecordMasterValue = \(field: RecordField, id: string\) =>\s+\{[\s\S]*?customerId: id, customer_id: id[\s\S]*?supplierId: id, supplier_id: id[\s\S]*?partId: id, part_id: id[\s\S]*?productId: id, product_id: id/,
    "changing any supported master keeps the canonical ID aliases synchronized with the selection");
  assert.match(workspace, /const selectedId = idField \? values\[idField\] \|\| values\[item\.key\]/,
    "new record creation persists the canonical ID instead of a display label");
  assert.match(workspace, /value=\{recordMasterValue\(item\)\}[^\n]*onChange=\{value => setRecordMasterValue\(item, value\)\}/,
    "both create and edit selectors use the same canonical linkage behavior");
});

test("shared department task creation receives canonical project summaries for searchable selection", () => {
  const workspace = read("src/components/DepartmentProjectWorkspace.tsx");
  const taskWorkspace = read("src/components/DepartmentLeadCoordinationCenter.tsx");
  assert.match(taskWorkspace, /<SharedMasterSelect label="Task project" required/, "Task creation offers search over permitted project choices");
  assert.match(taskWorkspace, /options=\{projects\.map\(p=>\(\{value:p\.id,label:`\$\{p\.reference \|\| p\.id\} · \$\{p\.name\}`\}\)\)\}/, "Search results display project reference and title while storing canonical UUID");
  assert.match(workspace, /id: item\.id,\s+reference: item\.reference,\s+name: item\.title/, "Both task panels receive canonical project IDs and distinct references");
  assert.match(taskWorkspace, /onProjectScopeChange\(proj\.reference \|\| proj\.id\)/, "Project navigation keeps the workspace's reference-based route scope");
});

test("purchase requests keep service supplier links when business snapshot is stale", async () => {
  const workspace = read("src/components/SharedBusinessWorkspace.tsx");
  assert.match(workspace, /mergeCanonicalSupplierOptions\(expenseOptions\.data\?\.suppliers, data\.suppliers\)/,
    "the freshly loaded expense catalogue is merged with the periodically refreshed business snapshot");
  assert.match(workspace, /supplierId: selectedService\.supplierId \|\| ""/,
    "choosing a service preserves its canonical supplier ID even before the other snapshot refreshes");

  const { mergeCanonicalSupplierOptions } = await import("../src/lib/shared-master-options.ts");
  const merged = mergeCanonicalSupplierOptions(
    [{ id: "supplier-new", reference: "SUP-02", title: "New supplier", status: "Active" }],
    [
      { id: "supplier-old", reference: "SUP-01", title: "Existing supplier", status: "Active" },
      { id: "supplier-new", reference: "SUP-02-stale", title: "Stale label", status: "Active" },
      { id: "supplier-archived", reference: "SUP-03", title: "Archived supplier", status: "Archived" },
    ],
  );
  assert.deepEqual(merged, [
    { id: "supplier-old", reference: "SUP-01", title: "Existing supplier", status: "Active" },
    { id: "supplier-new", reference: "SUP-02", title: "New supplier", status: "Active" },
  ]);
});

test("web pickers and staging link validation share one inactive-master status rule", async () => {
  const { isSelectableMasterStatus } = await import("../src/lib/shared-master-options.ts");
  for (const status of ["Archived", "Obsolete", "Rejected", "Inactive", "Cancelled", "Canceled", "Retired", "Disabled"]) {
    assert.equal(isSelectableMasterStatus(status), false, `${status} must not be selectable`);
    assert.equal(isSelectableMasterStatus(`  ${status.toUpperCase()}  `), false, `Whitespace-wrapped ${status} must not be selectable`);
  }
  assert.equal(isSelectableMasterStatus("Active"), true);

  const migration = read("supabase/migrations/20261112153643_unify_selectable_master_status.sql");
  for (const status of ["archived", "obsolete", "rejected", "inactive", "cancelled", "canceled", "retired", "disabled"]) {
    assert.match(migration, new RegExp(`'${status}'`), `${status} must be rejected server-side`);
  }
  for (const fn of ["get_business_workspace", "mutate_business_workspace", "get_expense_catalogue", "save_expense_catalogue", "get_shared_test_workspace", "validate_customer_master_link", "validate_supplier_master_link", "validate_part_master_link", "validate_product_master_link"]) {
    assert.match(migration, new RegExp(`\\.${fn}\\(`), `${fn} must use the shared status rule`);
  }
});

test("shared decision log offers only selectable canonical projects", () => {
  const log = read("src/components/SharedDecisionLog.tsx");
  assert.match(log, /import \{ isSelectableMasterStatus \} from "@\/lib\/shared-master-options"/);
  assert.match(log, /filter\(r=>r\.type==="Project"&&isSelectableMasterStatus\(r\.status\)\)/);
  assert.match(log, /projects=\{projects\}/);
});
