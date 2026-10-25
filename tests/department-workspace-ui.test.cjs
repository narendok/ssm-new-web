const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadSource(name) {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/lib/' + name + '.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  new Function('module', 'exports', 'require', compiled)(loaded, loaded.exports, imported => imported.startsWith('./') ? loadSource(imported.slice(2)) : require(imported));
  return loaded.exports;
}

const { taskLane } = loadSource('task-board');
const { businessDate } = loadSource('business-date');

test('taskLane deterministically maps tasks to the four lanes without duplication', () => {
  const completedTask = { status: 'Approved', fields: {} };
  const releasedTask = { status: 'Released', fields: {} };
  const reviewTask = { status: 'In review', fields: {} };
  const inProgressTask = { status: 'Open', fields: { workStatus: 'In progress' } };
  const todayDueTask = { status: 'Open', fields: { dueDate: businessDate() } };
  const todoTask = { status: 'Open', fields: { dueDate: '2099-01-01' } };

  assert.equal(taskLane(completedTask), 'completed');
  assert.equal(taskLane(releasedTask), 'completed');
  assert.equal(taskLane(reviewTask), 'review');
  assert.equal(taskLane(inProgressTask), 'today');
  assert.equal(taskLane(todayDueTask), 'today');
  assert.equal(taskLane(todoTask), 'todo');
});

test('DepartmentLeadCoordinationCenter source includes Checklist, Kanban, and Table modes with collapsed completed group', () => {
  const coordSource = fs.readFileSync(path.resolve(__dirname, '../src/components/DepartmentLeadCoordinationCenter.tsx'), 'utf8');

  // Verify three view modes supported in state
  assert.match(coordSource, /"kanban" \| "table" \| "checklist"/, 'viewMode accepts checklist, kanban, and table');

  // Verify view mode toggle buttons exist
  assert.match(coordSource, /setViewMode\("checklist"\)/, 'Checklist toggle button present');
  assert.match(coordSource, /setViewMode\("kanban"\)/, 'Kanban toggle button present');
  assert.match(coordSource, /setViewMode\("table"\)/, 'Table toggle button present');

  // Verify TaskChecklistView exists and implements collapsible completed group
  assert.match(coordSource, /function TaskChecklistView/, 'TaskChecklistView component defined');
  assert.match(coordSource, /const \[completedExpanded, setCompletedExpanded\] = useState<boolean>\(false\)/, 'Completed group collapsed by default');
  assert.match(coordSource, /hideHeader/, 'hideHeader prop supported for clean embedding without duplicate headings');
  assert.match(coordSource, /hideProjectsAndTeam/, 'hideProjectsAndTeam prop supported for My Tasks isolation');
});

test('DepartmentProjectWorkspace provides compact header, sub-navigation tabs, and Unified Technical Deliverables board', () => {
  const workspaceSource = fs.readFileSync(path.resolve(__dirname, '../src/components/DepartmentProjectWorkspace.tsx'), 'utf8');

  // Verify compact header
  assert.match(workspaceSource, /Lead:\s*<strong className="text-foreground">\{lead\}<\/strong>/, 'Lead displayed in compact context');
  assert.match(workspaceSource, /<CompactFilterSelect label="Workspace project"/, 'Searchable compact project selector present in header');

  // Verify sub-navigation tabs
  assert.match(workspaceSource, /activeTab === "overview"/, 'Overview subview present');
  assert.match(workspaceSource, /activeTab === "tasks"/, 'Tasks subview present');
  assert.match(workspaceSource, /activeTab === "deliverables"/, 'Deliverables subview present');
  assert.match(workspaceSource, /activeTab === "approvals"/, 'Approvals subview present');
  assert.match(workspaceSource, /activeTab === "records"/, 'Records subview present');
  assert.match(workspaceSource, /activeTab === "team"/, 'Team subview present');

  // Verify the selected-project deliverables slice is distinct from the all-project vault.
  assert.match(workspaceSource, /Project Deliverables & Linked Files/, 'Project deliverables board heading present');
  assert.match(workspaceSource, /search across all projects you can access/, 'Project board explains the separate all-project vault');
  assert.match(workspaceSource, /Inspect File/, 'Inspect file action present on deliverables');
});

test('PurchasingCommandCenter removes duplicate 6-module switcher while retaining canonical subviews and actions', () => {
  const purSource = fs.readFileSync(path.resolve(__dirname, '../src/components/PurchasingCommandCenter.tsx'), 'utf8');

  // Verify duplicate 6-module switcher is eliminated
  assert.doesNotMatch(purSource, /1\. Recordage & Stores[\s\S]*?2\. Smart BOM[\s\S]*?3\. Adaptive Ingestion/, 'Duplicate 6-module nav switcher removed');

  // Verify streamlined header with active subview indicator exists
  assert.match(purSource, /PUR · \{currentTab === "recordage"/, 'Streamlined PUR header indicator present');
  assert.match(purSource, /\+ Create PO/, 'PO creation action present for orders');
  assert.match(purSource, /\+ Add Supplier/, 'Supplier creation action present for suppliers');
  assert.match(purSource, /\+ Add Quotation/, 'Quotation creation action present for quotations');
});

test('RoleAwareSidebar avoids duplicate department record navigation and routes DFMEA to project workspace', () => {
  const sidebarSource = fs.readFileSync(path.resolve(__dirname, '../src/components/RoleAwareSidebar.tsx'), 'utf8');

  // Verify demo walkthrough is in Reference & Training
  assert.match(sidebarSource, /id:\s*"dept-ref-training-lifecycle"/, 'Training walkthrough in Reference & Training');
  assert.match(sidebarSource, /label:\s*"(?:Knowledge Base|Help & Training: AI4T Lifecycle Walkthrough)"/, 'Knowledge Base label used');

  // Verify dept_projects does not embed demo lifecycle
  const deptProjectsSection = sidebarSource.match(/id:\s*"dept_projects"[\s\S]*?items:\s*\[([\s\S]*?)\]/);
  assert.ok(deptProjectsSection, 'dept_projects section exists');
  assert.doesNotMatch(deptProjectsSection[1], /dept-lifecycle/, 'dept_projects does not embed demo lifecycle');

  // Verify EHW DFMEA and specs route to full-page deliverables board
  assert.match(sidebarSource, /id:\s*"ehw-gerber"[\s\S]*?onNavigate\("ehw",\s*"(?:project|deliverables)"\)/, 'EHW DFMEA navigates to deliverables board');
  assert.match(sidebarSource, /id:\s*"ehw-specs"[\s\S]*?onNavigate\("ehw",\s*"deliverables"\)/, 'EHW Specs navigates to deliverables board');

  // Records remain available within the project workspace; don't repeat the same register in the sidebar.
  const workspaceSource = fs.readFileSync(path.resolve(__dirname, '../src/components/DepartmentProjectWorkspace.tsx'), 'utf8');
  assert.doesNotMatch(deptProjectsSection[1], /dept-records|Department Records Register/, 'Duplicate register shortcut removed');
  assert.match(workspaceSource, /Department Records Register \(\{deptWorkRecords\.length\}\)/, 'Full register remains in the department workspace');
  assert.match(sidebarSource, /label:\s*"Project Documents & Vault"/, 'Department document library remains a separate destination');
});

test('Theme styling consistency on select controls and options', () => {
  const workspaceSource = fs.readFileSync(path.resolve(__dirname, '../src/components/DepartmentProjectWorkspace.tsx'), 'utf8');
  const coordSource = fs.readFileSync(path.resolve(__dirname, '../src/components/DepartmentLeadCoordinationCenter.tsx'), 'utf8');
  const purSource = fs.readFileSync(path.resolve(__dirname, '../src/components/PurchasingCommandCenter.tsx'), 'utf8');

  // Verify theme classes applied to options and selects
  const filterSource = fs.readFileSync(path.resolve(__dirname, '../src/components/ResponsiveFilterBar.tsx'), 'utf8');
  assert.match(filterSource, /bg-background text-foreground/, 'Searchable project control uses current theme colors');
  assert.match(coordSource, /\[&>option\]:bg-background\s+\[&>option\]:text-foreground/, 'Coordination center select styles options for dark theme');
  assert.match(purSource, /\[&>option\]:bg-background\s+\[&>option\]:text-foreground/, 'Purchasing modals style options for dark theme');
});
