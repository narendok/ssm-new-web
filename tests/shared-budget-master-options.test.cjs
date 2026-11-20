const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('expense settings and allocation use canonical searchable values and compact fixed choices', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../src/components/SharedBusinessWorkspace.tsx'),
    'utf8',
  );
  const routeSource = fs.readFileSync(
    path.resolve(__dirname, '../src/routes/index.tsx'),
    'utf8',
  );
  const settingsSource = fs.readFileSync(
    path.resolve(__dirname, '../src/components/ExpenseSettingsPanel.tsx'),
    'utf8',
  );
  const sharedSelectSource = fs.readFileSync(
    path.resolve(__dirname, '../src/components/SharedMasterSelect.tsx'),
    'utf8',
  );
  const policySource = fs.readFileSync(
    path.resolve(__dirname, '../src/components/TravelPolicySettings.tsx'),
    'utf8',
  );
  const departmentScopeMigration = fs.readFileSync(
    path.resolve(__dirname, '../supabase/migrations/20261120222032_admin_expense_department_scope.sql'),
    'utf8',
  );
  const internalAllocationMigration = fs.readFileSync(
    path.resolve(__dirname, '../supabase/migrations/20261120233000_internal_budget_allocation_department.sql'),
    'utf8',
  );
  const allocationForm = source.match(
    /\{action === "allocate" && \(([\s\S]*?)\n\s*\)\}\s*\{action === "request_expense"/,
  )?.[1];

  assert.ok(allocationForm, 'allocation form block exists');
  assert.match(allocationForm, /label="allocation department"/);
  assert.match(allocationForm, /options=\{data\.departments/);
  assert.match(allocationForm, /departmentId, category: "", projectId: ""/,
    'changing the target department clears dependent category and project choices');
  assert.match(allocationForm, /label="allocation Finance category"/);
  assert.match(allocationForm, /expenseOptions\.data\?\.categories/,
    'allocation categories come from the authenticated shared Finance catalogue');
  assert.match(allocationForm, /!values\["departmentId"\]/,
    'category selection waits for an explicit target department');
  assert.doesNotMatch(allocationForm, /field\("category"/,
    'allocation category is not free text');

  const expenseForm = source.match(
    /\{action === "request_expense" && \(([\s\S]*?)\n\s*\)\}\s*\{action === "approve_expense"/,
  )?.[1];
  assert.ok(expenseForm, 'expense request form block exists');
  assert.match(expenseForm, /adminAllDepartments \? \([\s\S]*?label="expense department"[\s\S]*?options=\{data\.departments[\s\S]*?department\.code !== "CLIENT"/,
    'Admin in All Departments selects an active company department from shared data');
  assert.match(expenseForm, /fixedExpenseDepartment\?\.name \|\| "Your department is not configured"/,
    'department leads see their authenticated department as a fixed scope');
  assert.match(source, /departmentId: expenseDepartment/,
    'the selected department is sent to the shared mutation');
  assert.match(routeSource, /adminAllDepartments=\{persona\.kind === "admin" && adminDepartment === "all"\}/,
    'the shared workspace receives the route-level Admin scope');
  assert.match(departmentScopeMigration, /EXPENSE_DEPARTMENT_OVERRIDE_DENIED/,
    'the backend rejects non-admin department spoofing');
  assert.match(internalAllocationMigration, /upper\(code\)<>'CLIENT'/,
    'the shared allocation RPC excludes client accounts even if the UI is bypassed');

  assert.match(settingsSource, /label="expense settings scope"/,
    'the changing department scope list is searchable');
  assert.match(settingsSource, /value: "", label: "Company defaults"/,
    'company defaults remain an explicit settings scope');
  assert.match(settingsSource, /role="group" aria-label="City tier"/,
    'the two fixed city tiers are presented as a compact choice row');
  assert.match(settingsSource, /aria-pressed=\{tier === option\.value\}/,
    'the selected city tier is exposed to assistive technology');
  assert.doesNotMatch(settingsSource, /<select[^>]*aria-label="City tier"/,
    'city tier is not hidden in a dropdown');
  assert.match(sharedSelectSource, /required=\{required\} disabled=\{disabled\}/,
    'a disabled required searchable selector does not block form submission');
  assert.match(policySource, /data\.isAdmin \? \([\s\S]*?<SharedMasterSelect[\s\S]*?options=\{\[[\s\S]*?Company policy[\s\S]*?departments\.map/,
    'Admin can search the company policy and department override scopes');
  assert.match(policySource, /Department scope · \{departments\.find\(item => item\.id === department\)/,
    'an Ops lead sees its single allowed scope as fixed text rather than a one-option dropdown');
});
