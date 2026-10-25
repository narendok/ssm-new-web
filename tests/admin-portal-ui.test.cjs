const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Admin Portal UI: PersonaSwitcher provides clean department access dropdown and Main Admin indicator', () => {
  const indexSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/index.tsx'), 'utf8');

  // Verify PersonaSwitcher has Department Access dropdown for Admin
  assert.match(indexSource, /aria-label="Select department access"/, 'Department access dropdown exists in PersonaSwitcher');
  assert.match(indexSource, /Department:/, 'Department label shown in PersonaSwitcher');

  // Verify canonical departments are in the dropdown
  assert.match(indexSource, /value="ehw"[^>]*>EHW · Embedded Hardware/, 'EHW option present');
  assert.match(indexSource, /value="pur"[^>]*>PUR · Purchasing & SCM/, 'PUR option present');
  assert.match(indexSource, /value="qa"[^>]*>QA · Quality Assurance/, 'QA option present');
  assert.match(indexSource, /value="sales"[^>]*>SAL · Sales & Business Development/, 'SAL option present');

  // Verify Main Admin badge with Switch Login option and Search All button
  assert.match(indexSource, /MAIN ADMIN/, 'MAIN ADMIN badge present');
  assert.match(indexSource, /Switch Login/, 'Switch Login option present for Admin');
  assert.match(indexSource, /Search All/, 'Quick Search All button present in PersonaSwitcher');
});

test('Admin Portal UI: DepartmentProjectWorkspace is rendered for Admin, matching Department Lead layout', () => {
  const indexSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/index.tsx'), 'utf8');

  // Verify DepartmentProjectWorkspace handles persona.kind === "admin"
  assert.match(
    indexSource,
    /persona\.kind === "admin"\)\s*&&\s*\(view === "project" \|\| view === "queue" \|\| view === "summary" \|\| view === "records" \|\| view === "deliverables"\)/,
    'DepartmentProjectWorkspace is rendered when persona is admin'
  );

  // Verify DepartmentLeadCoordinationCenter handles assignee view for admin
  assert.match(
    indexSource,
    /persona\.kind === "admin"\)\s*&&\s*view === "assignee"/,
    'DepartmentLeadCoordinationCenter handles assignee view for admin'
  );

  // Verify clean header without conflicting/cluttered legacy buttons in header
  const headerSection = indexSource.match(/<header[\s\S]*?<\/header>/);
  assert.ok(headerSection, 'Header section found');
  assert.doesNotMatch(headerSection[0], /HeaderAction label="PMSS"/, 'PMSS button removed from cluttered header');
  assert.doesNotMatch(headerSection[0], /HeaderAction\s+label="Project Analysis \(Page 1\)"/, 'Project Analysis Page 1 removed from cluttered header');
  assert.doesNotMatch(headerSection[0], /HeaderAction label="Hardware Deliverables Drive"/, 'Hardware Deliverables Drive removed from cluttered header');
  assert.doesNotMatch(headerSection[0], /HeaderAction label="Legal Hub"/, 'Legal Hub removed from cluttered header');
});

test('Admin Portal UI: RoleAwareSidebar displays executive command directory and department layout to Admin', () => {
  const sidebarSource = fs.readFileSync(path.resolve(__dirname, '../src/components/RoleAwareSidebar.tsx'), 'utf8');

  // Verify activeWorkGroups for admin includes executiveGroup + deptWorkGroups matching department lead layout
  assert.match(
    sidebarSource,
    /isAdmin\s*\?\s*\[executiveGroup,\s*\.\.\.deptWorkGroups,\s*adminSettingsGroup\]\s*:\s*deptWorkGroups/,
    'Admin sidebar renders Executive Command Directory + deptWorkGroups + Settings at bottom'
  );

  // Verify All Departments Directory item exists in executiveGroup
  assert.match(sidebarSource, /All Departments Directory/, 'All Departments Directory item present');
  assert.match(sidebarSource, /id:\s*"executive_oversight"/, 'executive_oversight group present');

  // Verify userRoleKey for admin falls back to activeArea / ehw
  assert.match(
    sidebarSource,
    /const userRoleKey = \(persona\.kind === "lead" \|\| persona\.kind === "member"\) && persona\.departmentId\s*\?\s*persona\.departmentId\s*:\s*\(activeArea && activeArea !== "home" && activeArea !== "rnd" \? activeArea : "ehw"\)/,
    'userRoleKey uses active department'
  );
});

test('Admin Portal UI: DepartmentLeadLoginModal highlights Main Admin as top selection', () => {
  const modalSource = fs.readFileSync(path.resolve(__dirname, '../src/components/DepartmentLeadLoginModal.tsx'), 'utf8');

  // Verify featured Main Admin login option
  assert.match(modalSource, /Main Admin · Executive Portal/, 'Featured Main Admin portal section present');
  assert.match(modalSource, /Select Main Admin →/, 'Select Main Admin button present');
  assert.match(modalSource, /Select Login Type \/ Role Access/, 'Login Type selection header present');
});

test('Admin Portal UI: CommonDepartmentSearchView renders all 12 departments and scattered filters are eliminated', () => {
  const searchViewSource = fs.readFileSync(path.resolve(__dirname, '../src/components/CommonDepartmentSearchView.tsx'), 'utf8');
  const approvalsSource = fs.readFileSync(path.resolve(__dirname, '../src/components/ApprovalsFullPageView.tsx'), 'utf8');
  const budgetsSource = fs.readFileSync(path.resolve(__dirname, '../src/components/DepartmentBudgetsWorkspace.tsx'), 'utf8');
  const indexSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/index.tsx'), 'utf8');

  // 1. CommonDepartmentSearchView covers all 12 departments
  const canonicalDeptCodes = ['EHW', 'FW', 'SW', 'MECH', 'PUR', 'EMF', 'MMF', 'QA', 'SAL', 'FIN', 'SIT', 'HR'];
  for (const code of canonicalDeptCodes) {
    assert.match(searchViewSource, new RegExp(`code:\\s*"${code}"`), `Department ${code} present in CommonDepartmentSearchView`);
  }

  // 2. ApprovalsFullPageView has NO scattered department filter dropdown
  assert.doesNotMatch(approvalsSource, /CompactFilterSelect[^>]*label="Department"/, 'Department filter dropdown removed from Approvals');
  assert.doesNotMatch(approvalsSource, /const \[deptFilter, setDeptFilter\]/, 'deptFilter state removed from Approvals');

  // 3. DepartmentBudgetsWorkspace has NO scattered department filter dropdown
  assert.doesNotMatch(budgetsSource, /<select[^>]*value=\{deptFilter\}/, 'Department filter select removed from Budgets');
  assert.doesNotMatch(budgetsSource, /const \[deptFilter, setDeptFilter\]/, 'deptFilter state removed from Budgets');

  // 4. SharedIndex search modal in index.tsx has NO scattered department filter dropdown
  assert.doesNotMatch(indexSource, /ResponsiveFilterBar[^>]*secondary=\{!departmentContext\s*\?\s*<CompactFilterSelect label="Department"/, 'Department filter dropdown removed from SharedIndex');
});
