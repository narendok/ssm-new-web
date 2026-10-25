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

  // Verify Main Admin badge with Switch Login option
  assert.match(indexSource, /MAIN ADMIN/, 'MAIN ADMIN badge present');
  assert.match(indexSource, /Switch Login/, 'Switch Login option present for Admin');
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

test('Admin Portal UI: RoleAwareSidebar displays department lead layout for active department to Admin', () => {
  const sidebarSource = fs.readFileSync(path.resolve(__dirname, '../src/components/RoleAwareSidebar.tsx'), 'utf8');

  // Verify activeWorkGroups for admin includes deptWorkGroups matching department lead layout
  assert.match(
    sidebarSource,
    /isAdmin\s*\?\s*\[\.\.\.deptWorkGroups,\s*adminSettingsGroup\]\s*:\s*deptWorkGroups/,
    'Admin sidebar renders deptWorkGroups with Settings at bottom'
  );

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
