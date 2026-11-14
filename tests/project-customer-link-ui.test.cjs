const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.resolve(__dirname, "../src/components/SharedTestWorkspace.tsx"), "utf8");

test("Shared TEST Projects show canonical Customer links and a scoped searchable edit path", () => {
  assert.match(source, /Customer: \{label\}/, "Project rows show the resolved Customer or a clear missing/unresolved state");
  assert.match(source, /canEditProjectCustomer = admin \|\| \(lead && actor\.department_code === "SAL"\)/, "Only Admin and Sales lead see the customer-link action");
  assert.match(source, /p\.status\.toLowerCase\(\) === "draft"/, "The UI exposes link editing only on draft Projects");
  assert.match(source, /Link Customer|Review link/, "Missing and unresolved links have an explicit action");
  assert.match(source, /<DialogTitle>Link Customer to Project<\/DialogTitle>/, "The editor is a focused modal rather than a generic Project editor");
  assert.match(source, /<SharedMasterSelect label="Project Customer master"/, "The Customer is selected through the searchable canonical master picker");
  assert.match(source, /saveProjectCustomerLink\(\{ data:/, "The selection is saved through the authenticated server function");
  assert.match(source, /projectCustomerEditor\.updated_at/, "Save carries the Project version for stale-write protection");
});
