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
const { recordStageLabel } = loadSource('lifecycle-record-presentation');

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

test('register labels canonical phases and explicitly quarantines unmapped legacy stage text', () => {
  assert.match(recordStageLabel({ hwStage: 'HW_15' }), /^TG_2 · Proof of Concept & Subsystem Bring-Up · HW_15 /);
  assert.equal(recordStageLabel({ lifecycleStage: 'Stage 7 · Production Release' }), 'Legacy stage label · Stage 7 · Production Release');
  assert.match(recordStageLabel({ lifecycleStage: 'Stage 3 · Requirement Freeze' }, 'PRS'), /^TG_1 · Concept, Architecture & Interface Freeze · HW_02 Product Requirement Spec \(PRS\) Freeze$/);
  assert.match(recordStageLabel({ lifecycleStage: 'Schematic' }, 'Schematic'), /^TG_2 · Proof of Concept & Subsystem Bring-Up · HW_15 Full Schematic Capture$/);
  assert.match(recordStageLabel({ lifecycleStage: 'BOM & layout' }, 'BOM'), /^TG_3 · Detailed Engineering & Prototype Tooling · HW_19 Tentative BOM Release$/);
  assert.equal(recordStageLabel({}), 'Operational · stage not recorded');
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
  assert.match(coordSource, /<SharedMasterSelect label="Task project" required/, 'Task creation uses a searchable project master picker');
  assert.match(coordSource, /options=\{projects\.map\(p=>\(\{value:p\.id,label:/, 'Picker options come from the permitted project records and use stable IDs');
  assert.match(coordSource, /value=\{newTaskProject\} onChange=\{setNewTaskProject\}/, 'Task form retains the selected canonical project ID');
});

test('record and project labels use saved stage names and phase assignments', () => {
  const { defaultLifecycleRevision } = loadSource('lifecycle-baseline');
  const { projectLifecycleContext } = loadSource('lifecycle-record-presentation');
  const config = defaultLifecycleRevision();
  const schematic = config.stages.find(stage => stage.code === 'HW_15');
  schematic.name = 'Configured schematic authoring';
  schematic.phase = 'TG_4';
  const fields = { lifecycleBaseline: JSON.stringify(config), currentStage: 'HW_15' };
  assert.match(recordStageLabel({recordStage:'HW_15'}, 'Schematic', fields), /^TG_4 .*Configured schematic authoring$/);
  assert.match(projectLifecycleContext(fields).stage, /Configured schematic authoring$/);
  assert.match(projectLifecycleContext(fields).phase, /^TG_4 /);
  assert.match(recordStageLabel({recordStage:'HW_15'}, 'Schematic'), /^TG_2 /, 'A saved project configuration does not rewrite unrelated baselines');
});

test('DepartmentProjectWorkspace combines project records and linked deliverables in one register', () => {
  const workspaceSource = fs.readFileSync(path.resolve(__dirname, '../src/components/DepartmentProjectWorkspace.tsx'), 'utf8');
  const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/index.tsx'), 'utf8');

  // Verify compact header
  assert.match(workspaceSource, /Lead:\s*<strong className="text-foreground">\{lead\}<\/strong>/, 'Lead displayed in compact context');
  assert.match(workspaceSource, /<SharedMasterSelect label="Workspace project" value=\{workspaceProjectSelection\}/, 'Project header uses the searchable canonical master selector');
  assert.match(workspaceSource, /options=\{\[\{value:"all",label:"All projects"\}.*projects\.map\(item=>\(\{value:item\.id,label:`\$\{item\.reference\} · \$\{item\.title\}`\}\)\)\]\}/, 'Workspace search shows reference/title but uses canonical project IDs');

  // Verify sub-navigation tabs
  assert.match(workspaceSource, /activeTab === "overview"/, 'Overview subview present');
  assert.match(workspaceSource, /activeTab === "tasks"/, 'Tasks subview present');
  assert.match(workspaceSource, /activeTab === "approvals"/, 'Approvals subview present');
  assert.match(workspaceSource, /activeTab === "records"/, 'Records subview present');
  assert.doesNotMatch(workspaceSource, /aria-label="Workspace subviews"/, 'Sidebar routes replace the duplicate in-page tab strip');
  assert.doesNotMatch(workspaceSource, /activeTab === "team"/, 'Team capacity is not a duplicate subview');
  assert.match(workspaceSource, /Team & capacity/, 'Team roster is available from the Overview summary');
  assert.match(workspaceSource, /activeTab === "overview" && project && <ProjectMasterSpecSheet/, 'Project master details stay inside Overview');
  assert.match(workspaceSource, /activeTab === "overview" && <section aria-label="Workspace summary"/, 'Cross-team summary metrics stay inside Overview');
  assert.match(workspaceSource, /props\.onOpenRecords \? props\.onOpenRecords\(\) : setActiveTab\("records"\)/, 'Overview record shortcut opens the sidebar-owned records destination');
  assert.match(workspaceSource, /props\.onOpenApprovals \? props\.onOpenApprovals\(\) : setActiveTab\("approvals"\)/, 'Overview approval shortcut opens the sidebar-owned approvals destination');

  const vaultSource = fs.readFileSync(path.resolve(__dirname, '../src/components/SharedDocumentVault.tsx'), 'utf8');
  assert.match(vaultSource, /<details aria-label="Lifecycle and draft source context"/, 'Document lifecycle and source context is available on demand');
  assert.match(vaultSource, />All documents<\/Button>/, 'Document detail keeps a focused in-feature route back to the library');

  const approvalsSource = fs.readFileSync(path.resolve(__dirname, '../src/components/ApprovalsFullPageView.tsx'), 'utf8');
  assert.match(approvalsSource, /Return for rework/, 'Approval decision action states its workflow purpose');
  assert.match(approvalsSource, /rounded-xl border bg-card p-3\.5/, 'Approval list uses compact full-page cards');
  assert.doesNotMatch(approvalsSource, /onBack/, 'Full-page approvals do not duplicate sidebar navigation with a back action');
  assert.match(approvalsSource, /className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border\/50 bg-muted\/20 px-3 py-2 text-xs"/, 'Approval counts use a single compact strip instead of tall KPI cards');
  assert.match(approvalsSource, /<details className="text-xs">\s*<summary className="w-fit cursor-pointer text-primary">Review details<\/summary>/, 'Long approval descriptions remain collapsed until requested');
  assert.match(approvalsSource, /<summary className="cursor-pointer underline decoration-dotted">Decision note<\/summary>/, 'Long rejection and return notes remain collapsed until requested');

  const pmssSource = fs.readFileSync(path.resolve(__dirname, '../src/components/ProjectMasterSpecSheet.tsx'), 'utf8');
  assert.doesNotMatch(pmssSource, /aria-label="PMSS tabs"/, 'Project spec sheet does not add another tab strip');
  assert.match(pmssSource, /<dl aria-label="Project overview"/, 'Project spec sheet keeps its key overview visible');
  assert.match(pmssSource, /<summary className="cursor-pointer text-xs font-semibold">Phases & gates/, 'Project gate detail remains available on demand');

  // Department record and its controlled document are shown together as one row group.
  assert.match(workspaceSource, /Records & Deliverables \(\{registerRowCount\}\)/, 'One combined project register heading present');
  assert.match(workspaceSource, /documentsForRecord\(record\)/, 'Linked documents are grouped with their department record');
  assert.match(workspaceSource, /Conflicting duplicate reference ·/, 'Duplicate controlled references are visibly flagged without deleting source records');
  assert.match(workspaceSource, /recordStageLabel\(record\.fields,\s*record\.type,\s*project\?\.fields\)/, 'Register resolves the selected project configuration');
  assert.match(routeSource, /recordStageLabel\(\s*\{ \.\.\.record\.fields, recordStage: String\(value\) \},\s*record\.type,?\s*\)/, 'Legacy stored stage fields are presented canonically in record details without rewriting the source');
  assert.match(workspaceSource, /Open file details/, 'Linked original opens from its record group');
  assert.match(routeSource, /onCreateDeliverable=\{\(\) => \{[\s\S]*setDocumentUploadRequested\(true\);[\s\S]*setModal\("documents"\)/, 'Project Add document opens the upload dialog directly instead of the template chooser');
  assert.match(routeSource, /initialProjectId=\{documentUploadProjectId\}/, 'Current project selection is passed to the upload dialog');
  assert.match(workspaceSource, /standaloneDocuments\.map/, 'Unlinked project documents remain discoverable in the same register');
  assert.doesNotMatch(workspaceSource, /activeTab === "deliverables"/, 'Duplicate deliverables subview removed');
});

test('legacy RecordForm keeps PRS editable and assigns a fixed HW stage without inventing a global approval', () => {
  const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/index.tsx'), 'utf8');
  const catalogueSource = fs.readFileSync(path.resolve(__dirname, '../src/lib/record-form-catalogue.ts'), 'utf8');
  const recordFormSource = routeSource.slice(routeSource.indexOf('function RecordForm('), routeSource.indexOf('function ManagedField('));

  assert.match(recordFormSource, /hardwareStageForRecordType\(type\)/, 'Record type provides its automatic hardware stage');
  assert.match(recordFormSource, /Project-linked PRS draft/, 'PRS is presented as a project-linked draft');
  assert.match(recordFormSource, /Operational draft · editable until submitted for review/, 'PRS remains editable and unapproved');
  assert.doesNotMatch(recordFormSource, /PRS is generated only after an approved Contract Review/, 'PRS creation no longer requires a global unrelated approval');
  assert.doesNotMatch(recordFormSource, /baseline: "Frozen · automated baseline · changes require PMSS amendment"/, 'Draft creation does not claim a frozen baseline');
  assert.match(catalogueSource, /PRS: \{ code: "HW_02", label: "HW_02 · Hardware PRS baseline" \}/, 'PRS stage is fixed by the record type catalogue');
});

test('decision stage choices and browser-local validation use the selected project lifecycle codes', () => {
  const decisionSource = fs.readFileSync(path.resolve(__dirname, '../src/components/DecisionDeviationLog.tsx'), 'utf8');
  const approvalsSource = fs.readFileSync(path.resolve(__dirname, '../src/components/ApprovalsFullPageView.tsx'), 'utf8');
  const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/index.tsx'), 'utf8');

  assert.match(decisionSource, /lifecycleStages\.some\(\(item\) => item\.code === stage\)/, 'The form accepts its pinned lifecycle stage code');
  assert.match(decisionSource, /<SharedMasterSelect\s+label="Decision project"[\s\S]*?options=\{projects\.map/, 'Decision project selection searches the permitted canonical project list');
  assert.match(approvalsSource, /<SharedMasterSelect\s+label="Source record"[\s\S]*?options=\{records\.map/, 'Approval source record selection searches permitted records');
  assert.match(approvalsSource, /resolveApprovalProjectFromRecord\(source\?\.fields, projects\)/, 'Selecting a source record keeps its exact canonical project link across supported aliases');
  assert.doesNotMatch(decisionSource, /stageOptions\.includes\(stage\)/, 'Legacy chronicle labels no longer reject canonical stage codes');
  assert.match(routeSource, /const decisionBaseline = readLifecycleBaseline\(\s*decisionProject\?\.fields\["lifecycleBaseline"\],?\s*\)/, 'Local save validation loads the selected project baseline');
  assert.match(routeSource, /\)\.map\(\(?stage\)? => stage\.code\)/, 'Local save validation permits only stages in that project baseline');
});

test('QA CAPA shortcut preserves its record filter and explains empty filtered registers', () => {
  const sidebarSource = fs.readFileSync(path.resolve(__dirname, '../src/components/RoleAwareSidebar.tsx'), 'utf8');
  const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/index.tsx'), 'utf8');
  const workspaceSource = fs.readFileSync(path.resolve(__dirname, '../src/components/DepartmentProjectWorkspace.tsx'), 'utf8');

  assert.match(sidebarSource, /onNavigate\("qa", "records"\); onRecordTypeFilterChange\?\.\("8D CAPA"\)/, 'Navigate before applying the CAPA filter that the route must preserve');
  assert.match(routeSource, /targetView !== "deliverables" && targetView !== "records"/, 'Generic navigation clears filters except on filtered registers');
  assert.match(workspaceSource, /Filtered to \{props\.recordTypeFilter\}/, 'The active record filter is visible');
  assert.match(workspaceSource, /No \$\{props\.recordTypeFilter\} records or deliverables are linked/, 'Empty filtered scopes explain what is missing');
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

test('RoleAwareSidebar gives EHW one records and deliverables destination', () => {
  const sidebarSource = fs.readFileSync(path.resolve(__dirname, '../src/components/RoleAwareSidebar.tsx'), 'utf8');

  // Verify demo walkthrough is in Reference & Training
  assert.match(sidebarSource, /id:\s*"dept-ref-training-lifecycle"/, 'Training walkthrough in Reference & Training');
  assert.match(sidebarSource, /label:\s*"(?:Knowledge Base|Help & Training: AI4T Lifecycle Walkthrough)"/, 'Knowledge Base label used');

  // Verify dept_projects does not embed demo lifecycle
  const deptProjectsSection = sidebarSource.match(/id:\s*"dept_projects"[\s\S]*?items:\s*\[([\s\S]*?)\]/);
  assert.ok(deptProjectsSection, 'dept_projects section exists');
  assert.doesNotMatch(deptProjectsSection[1], /dept-lifecycle/, 'dept_projects does not embed demo lifecycle');

  // Type-specific shortcuts all opened the same project-deliverables destination with a preset filter.
  // Keep one EHW destination; users can browse every type within the project workspace.
  assert.match(sidebarSource, /id:\s*"ehw-hub"[\s\S]*?label:\s*"Hardware Records & Deliverables"/, 'EHW has one combined records destination');
  assert.doesNotMatch(sidebarSource, /id:\s*"ehw-(?:specs|schematics|gerber)"/, 'Duplicate EHW type-filter shortcuts are removed');

  // Records remain available within the project workspace; don't repeat the same register in the sidebar.
  const workspaceSource = fs.readFileSync(path.resolve(__dirname, '../src/components/DepartmentProjectWorkspace.tsx'), 'utf8');
  assert.doesNotMatch(deptProjectsSection[1], /dept-records|Department Records Register/, 'Duplicate register shortcut removed');
  assert.match(workspaceSource, /Records & Deliverables \(\{registerRowCount\}\)/, 'Unified register remains in the department workspace');
  assert.match(sidebarSource, /label:\s*"Project Documents & Vault"/, 'Department document library remains a separate destination');
});

test('collapsed sidebar keeps favorite shortcuts first and lets the remaining department icons scroll', () => {
  const sidebarSource = fs.readFileSync(path.resolve(__dirname, '../src/components/RoleAwareSidebar.tsx'), 'utf8');
  assert.match(sidebarSource, /my-3 flex min-h-0 flex-1 flex-col items-center gap-1\.5 overflow-y-auto/, 'Compact rail has a shrinkable, scrollable icon lane');
  assert.match(sidebarSource, /favoriteItems\.slice\(0, 5\)\.map[\s\S]*?activeWorkGroups\.map/, 'Favorites are listed before remaining department shortcuts');
  assert.doesNotMatch(sidebarSource, /Favorites Star Indicator/, 'Decorative favorite star no longer consumes a shortcut slot');
  assert.match(sidebarSource, /onClick=\{item\.onClick\}/, 'Favorite icons remain direct navigation buttons');
  assert.match(sidebarSource, /onToggleExpanded\(\);\s*setExpandedGroups/, 'Department icons expand directly into their section');
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
