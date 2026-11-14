const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Admin Portal UI: PersonaSwitcher provides clean department access dropdown and Main Admin indicator', () => {
  const indexSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/index.tsx'), 'utf8');

  // Verify PersonaSwitcher has Department Access dropdown for Admin
  assert.match(indexSource, /aria-label="Select department access"/, 'Department access dropdown exists in PersonaSwitcher');
  assert.match(indexSource, /Department:/, 'Department label shown in PersonaSwitcher');

  assert.match(indexSource, /departments=\{configuredDepartments\}/, 'Department selector receives the organization master');
  assert.match(indexSource, /DEPARTMENT_MODULES\[code\]/, 'Configured department names retain stable workflow identities');

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
    /persona\.kind === "admin"\)\s*&&\s*\(view === "project"\s*\|\|\s*view === "queue"\s*\|\|\s*view === "summary"\s*\|\|\s*view === "records"\s*\|\|\s*view === "deliverables"\)/,
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
  const sharedDirectorySource = fs.readFileSync(path.resolve(__dirname, '../src/components/SharedOrganizationDirectory.tsx'), 'utf8');
  const approvalsSource = fs.readFileSync(path.resolve(__dirname, '../src/components/ApprovalsFullPageView.tsx'), 'utf8');
  const budgetsSource = fs.readFileSync(path.resolve(__dirname, '../src/components/DepartmentBudgetsWorkspace.tsx'), 'utf8');
  const indexSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/index.tsx'), 'utf8');

  // 1. CommonDepartmentSearchView covers all 12 departments
  const canonicalDeptCodes = ['EHW', 'FW', 'SW', 'MECH', 'PUR', 'EMF', 'MMF', 'QA', 'SAL', 'FIN', 'SIT', 'HR'];
  for (const code of canonicalDeptCodes) {
    assert.match(searchViewSource, new RegExp(`code:\\s*"${code}"`), `Department ${code} present in CommonDepartmentSearchView`);
  }

  assert.match(searchViewSource, /export function buildDepartmentDirectoryMetadata\([\s\S]*?if \(!department\.active\) continue;[\s\S]*?departmentCode\(department\.code\.replace\(\/\^DEMO-\/i, ""\)\)[\s\S]*?DEPARTMENT_MODULES\[code\]/,
    'directory cards follow active departments by stable code and exclude inactive legacy entries');
  assert.match(indexSource, /departments=\{buildDepartmentDirectoryMetadata\(portal\.departments\)\}/,
    'local directory uses the configured department registry rather than legacy workspace-type matching');
  assert.match(indexSource, /openTaskCounts=\{Object\.fromEntries\([\s\S]*?record\.departmentId === configuredDepartment\?\.id\s*\|\|\s*record\.area === department\.id/,
    'local directory task counts use the configured department link or stable workflow area');
  assert.match(indexSource, /projectCounts=\{Object\.fromEntries\([\s\S]*?flatMap\(\(record\) => projectReferences\(record\)\)[\s\S]*?linkedProjects\.has\(record\.id\)\s*\|\|\s*linkedProjects\.has\(record\.reference\)/,
    'local project counts include explicit links from cross-department tasks');
  assert.match(sharedDirectorySource, /buildDepartmentDirectoryMetadata\(departments\.map\(/,
    'authenticated shared directory uses the same active-code mapping as the local directory');
  assert.match(searchViewSource, /text-xl font-bold text-foreground">\{departments\.length\}<\/span>/,
    'directory department total is derived from configured active entries');
  assert.match(searchViewSource, /text-xl font-bold text-primary">\{totalTasks\}<\/span>/,
    'directory task total does not substitute a fabricated fallback');
  assert.match(searchViewSource, /text-xl font-bold text-amber-500">\{totalApprovals\}<\/span>/,
    'directory approval total does not substitute a fabricated fallback');
  assert.match(searchViewSource, /const deptProjects = projectCounts\[dept\.id\] \?\? 0;/,
    'department project cards default to zero when no project count is supplied');

  // 2. ApprovalsFullPageView has NO scattered department filter dropdown
  assert.doesNotMatch(approvalsSource, /CompactFilterSelect[^>]*label="Department"/, 'Department filter dropdown removed from Approvals');
  assert.doesNotMatch(approvalsSource, /const \[deptFilter, setDeptFilter\]/, 'deptFilter state removed from Approvals');

  // 3. DepartmentBudgetsWorkspace has NO scattered department filter dropdown
  assert.doesNotMatch(budgetsSource, /<select[^>]*value=\{deptFilter\}/, 'Department filter select removed from Budgets');
  assert.doesNotMatch(budgetsSource, /const \[deptFilter, setDeptFilter\]/, 'deptFilter state removed from Budgets');

  // 4. SharedIndex search modal in index.tsx has NO scattered department filter dropdown
  assert.doesNotMatch(indexSource, /ResponsiveFilterBar[^>]*secondary=\{!departmentContext\s*\?\s*<CompactFilterSelect label="Department"/, 'Department filter dropdown removed from SharedIndex');
});

test('Budget request project selector uses the current project register and supports search', () => {
  const budgetsSource = fs.readFileSync(path.resolve(__dirname, '../src/components/DepartmentBudgetsWorkspace.tsx'), 'utf8');
  const indexSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/index.tsx'), 'utf8');

  assert.match(indexSource, /const selectableProjects\s*=\s*activeRecords\.filter\(\s*\(?record\)?\s*=>\s*record\.type === "Project" && isSelectableMasterStatus\(record\.status\),?\s*\)/,
    'shared project pickers receive active, selectable project master records');
  assert.match(indexSource, /projects=\{selectableProjects\.map\(\s*\(?record\)?\s*=>\s*\(\{\s*id: record\.id,\s*reference: record\.reference,\s*title: record\.title,?\s*\}\),?\s*\)\}/,
    'budget workspace receives selectable project master records');
  assert.match(budgetsSource, /<SharedMasterSelect[\s\S]*?label="Project"[\s\S]*?options=\{projects\.map\(project => \(\{ value: project\.id, label: `\$\{project\.reference\} · \$\{project\.title\}` \}\)\)\}/,
    'project selection is searchable, displays the canonical project reference/title, and stores the stable project ID');
  assert.doesNotMatch(budgetsSource, /HLPL-AI4T-01 · Tata Ace EV 4G|HLPL-SLCT-01 · Select Motors AIS-140|HLPL-XLINK-03 · CV Dual-CAN Gateway/,
    'budget request form has no hard-coded project examples');
  assert.match(budgetsSource, /newProject && !projects\.some\(project => \[project\.id, project\.reference\]\.includes\(newProject\)\)/,
    'budget request rejects stale or unknown project IDs while accepting legacy references');
  assert.match(budgetsSource, /const resolveProjectId = \(value: string \| null \| undefined\) =>\s+projects\.find\(project => \[project\.id, project\.reference\]\.includes\(value \|\| ""\)\)\?\.id \|\| ""/,
    'existing project references resolve to canonical IDs before a new request is saved');
});

test('Admin Portal UI: legacy EOL testing stays historical and active project views follow configured departments', () => {
  const indexSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/index.tsx'), 'utf8');

  assert.match(indexSource, /active:\s*seed\.code\s*!==\s*"TST"/, 'Legacy TST is not an active department in the local demo registry');
  assert.match(indexSource, /seed\.code\s*===\s*"TST"\s*\?\s*\{\s*isLegacy:\s*true\s*\}/, 'Legacy TST identity is retained for historical records');
  assert.match(indexSource, /departments\s*\.filter\(\(department\)\s*=>\s*department\.active\)\s*\.flatMap/, 'Inactive legacy departments do not receive active demo lead/coordinator groups');
  assert.match(indexSource, /departmentId:\s*emfDepartment\.id,[\s\S]*?name:\s*"DEMO EOL Testing lead",\s*assignee:\s*"Mina Cross · EOL Testing"/, 'EOL Testing remains a distinct role owned by EMF');
  assert.match(indexSource, /EOL Testing is an EMF-owned role\. Historical TST records, owners and IDs retain\s+their original codes and links\./, 'Current EOL ownership is separated from preserved historical TST links');
  assert.match(indexSource, /reconcileDemoEolRoleAssignments\(\s*value\.roles,\s*Array\.isArray\(value\.departments\) \? value\.departments : \[\],?\s*\)/, 'Saved demo role assignments are reconciled without deleting historical roles');
  assert.match(indexSource, /Historical role assignments · preserved/, 'Inactive legacy role history remains reviewable');
  assert.match(indexSource, /const deptCodes = \[\s*\.\.\.new Set\(\s*portal\.departments[\s\S]*?filter\(\(department\) => department\.active\)/, 'Project department views derive from active configured departments');
  assert.doesNotMatch(indexSource, /\["TST",\s*"Production & Automated EOL Testing"/, 'EOL testing is not seeded as a separate active project department');

  const inputTemplate = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/lib/project-input-template.json'), 'utf8'));
  assert.doesNotMatch(JSON.stringify(inputTemplate), /"TST"/, 'Active project input consumers and reviewers route EOL work through EMF');
});
