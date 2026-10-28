const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTsModule(relativePath) {
  const fullPath = path.resolve(__dirname, relativePath);
  const code = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', transpiled)(mod, mod.exports, (id) => {
    if (id.startsWith('.')) {
      const resolved = path.resolve(path.dirname(fullPath), id);
      const withExt = fs.existsSync(resolved + '.ts') ? resolved + '.ts' : resolved;
      return loadTsModule(path.relative(__dirname, withExt));
    }
    return require(id);
  });
  return mod.exports;
}

const {
  CANONICAL_TRACK_METADATA,
  CANONICAL_STAGE_TEMPLATES,
  normalizeCanonicalTrack,
  getRecordedProjectTrack,
  getApplicableStagesForTrack,
  computeProgressiveStageAndTaskState,
  verifyTentativeBomCostingContract,
  resolveStagePrerequisites,
  createCustomTaskInstance,
  validateTaskDeletion,
  cancelTaskInstance,
} = loadTsModule('../src/lib/canonical-lifecycle.ts');

const {
  CANONICAL_SAMPLE_PROJECTS,
  getAllCanonicalSampleData,
} = loadTsModule('../src/lib/canonical-samples.ts');

const {
  LIFECYCLE_SCENARIOS,
  verifyProductionReconciliation,
  getAllScenarioFixtures,
} = loadTsModule('../src/lib/lifecycle-scenarios.ts');

test('SECTION 1: Canonical 7 Tracks & Normalization', () => {
  const tracks = Object.keys(CANONICAL_TRACK_METADATA);
  assert.equal(tracks.length, 7, 'Must have exactly 7 canonical tracks');
  assert.ok(tracks.includes('hardware_only'));
  assert.ok(tracks.includes('firmware_only'));
  assert.ok(tracks.includes('software_only'));
  assert.ok(tracks.includes('hardware_firmware'));
  assert.ok(tracks.includes('firmware_software_existing_hardware'));
  assert.ok(tracks.includes('hardware_firmware_software'));
  assert.ok(tracks.includes('ready_made'));

  // Normalization of legacy aliases
  assert.equal(normalizeCanonicalTrack('turnkey'), 'hardware_firmware_software');
  assert.equal(normalizeCanonicalTrack('software'), 'software_only');
  assert.equal(normalizeCanonicalTrack('firmware'), 'firmware_only');
  assert.equal(normalizeCanonicalTrack('hardware'), 'hardware_only');
  assert.equal(normalizeCanonicalTrack('ready_made'), 'ready_made');
  assert.equal(normalizeCanonicalTrack('firmware_software_existing_hardware'), 'firmware_software_existing_hardware');
});

test('SECTION 2: Exact Count of 89 Stages and 178 Default Tasks', () => {
  assert.equal(CANONICAL_STAGE_TEMPLATES.length, 89, 'Must define exactly 89 canonical stage templates');
  
  let taskCount = 0;
  for (const stg of CANONICAL_STAGE_TEMPLATES) {
    assert.ok(stg.stageCode, 'Stage must have a stageCode');
    assert.ok(stg.stageKey.startsWith('LC2-2026-10-28:'), 'Stage key must use namespace LC2-2026-10-28');
    assert.ok(stg.t01 && stg.t01.title, `Stage ${stg.stageCode} must have task T01`);
    assert.ok(stg.t02 && stg.t02.title, `Stage ${stg.stageCode} must have task T02`);
    assert.ok(stg.t01.defaultOwner, `Stage ${stg.stageCode} T01 must have defaultOwner`);
    assert.ok(stg.t02.defaultOwner, `Stage ${stg.stageCode} T02 must have defaultOwner`);
    taskCount += 2;
  }
  assert.equal(taskCount, 178, 'Must define exactly 178 default tasks (2 per stage)');
});

test('SECTION 3: Track Applicability Invariants', () => {
  // Pure Software Track
  const swStages = getApplicableStagesForTrack('software_only');
  assert.ok(swStages.some(s => s.stageCode === 'SW_01'));
  assert.ok(swStages.some(s => s.stageCode === 'SW_08'));
  assert.ok(swStages.some(s => s.stageCode === 'CM_01'));
  assert.ok(swStages.some(s => s.stageCode === 'CL_03'));
  // Must NOT include hardware or firmware stages
  assert.ok(!swStages.some(s => s.stageCode === 'HW_01'), 'Software track must not include HW_01');
  assert.ok(!swStages.some(s => s.stageCode === 'HW_31'), 'Software track must not include HW_31 board bring-up');
  assert.ok(!swStages.some(s => s.stageCode === 'FW_01'), 'Software track must not include FW_01');
  assert.ok(!swStages.some(s => s.stageCode === 'RM_01'), 'Software track must not include RM_01');

  // Pure Firmware Track (on existing hardware)
  const fwStages = getApplicableStagesForTrack('firmware_only');
  assert.ok(fwStages.some(s => s.stageCode === 'FW_01'));
  assert.ok(fwStages.some(s => s.stageCode === 'FW_11'));
  assert.ok(!fwStages.some(s => s.stageCode === 'HW_01'), 'Firmware-only track must not include HW layout/PCB stages');
  assert.ok(!fwStages.some(s => s.stageCode === 'SW_05'), 'Firmware-only track must not include Cloud SW stages');

  // Ready-Made Deployment Track
  const rmStages = getApplicableStagesForTrack('ready_made');
  assert.ok(rmStages.some(s => s.stageCode === 'RM_01'));
  assert.ok(rmStages.some(s => s.stageCode === 'RM_03'));
  assert.ok(!rmStages.some(s => s.stageCode.startsWith('HW_')), 'Ready-made track must not include HW engineering');
  assert.ok(!rmStages.some(s => s.stageCode.startsWith('FW_')), 'Ready-made track must not include FW engineering');
  assert.ok(!rmStages.some(s => s.stageCode.startsWith('SW_')), 'Ready-made track must not include SW engineering');

  // Firmware + Software on Existing Hardware
  const fwSwStages = getApplicableStagesForTrack('firmware_software_existing_hardware');
  assert.ok(fwSwStages.some(s => s.stageCode === 'FW_01'));
  assert.ok(fwSwStages.some(s => s.stageCode === 'SW_01'));
  assert.ok(fwSwStages.some(s => s.stageCode === 'INT_01'));
  assert.ok(!fwSwStages.some(s => s.stageCode.startsWith('HW_')), 'FW+SW on existing HW must not include HW_01 to HW_37');
});

test('SECTION 4: Consolidated Tentative-BOM Costing & Sourcing Handoff', () => {
  const result = verifyTentativeBomCostingContract();
  assert.equal(result.hw05DoesNotRequireHw19, true, 'HW_05 initial technical response must not wait on HW_19 tentative BOM');
  assert.equal(result.hw19T02IsPurOwned, true, 'HW_19:T02 must be PUR-owned for linked costing and sourcing analysis');
  assert.equal(result.ramPriceNotSeparateDefaultTask, true, 'RAM pricing must be a line item in linked BOM analysis, not a separate task');
  assert.equal(result.fw01SizingIsTechnicalFeasibility, true, 'FW_01 Flash/RAM sizing is technical feasibility owned by FW');
});

test('SECTION 5: Progressive Task Generation Logic', () => {
  // Project with only CM_01 completed
  const { stages, activeTasks, plannedTaskPreviews } = computeProgressiveStageAndTaskState({
    projectId: 'PRJ-TEST-PROG',
    track: 'hardware_only',
    completedStageCodes: ['CM_01'],
    inProgressStageCodes: ['CM_02'],
    cancelledTaskIds: ['PRJ-TEST-PROG:CM_01:T02'], // T02 was cancelled
  });

  const cm01 = stages.find(s => s.stageCode === 'CM_01');
  assert.equal(cm01.status, 'completed');

  const cm02 = stages.find(s => s.stageCode === 'CM_02');
  assert.equal(cm02.status, 'in_progress');

  // CM_03 requires CM_02 to be completed, so it must be planned
  const cm03 = stages.find(s => s.stageCode === 'CM_03');
  assert.equal(cm03.status, 'planned');

  // Active tasks must contain CM_01:T01 and CM_02 tasks, but NOT CM_03 tasks
  assert.ok(activeTasks.some(t => t.id === 'PRJ-TEST-PROG:CM_01:T01'));
  assert.ok(activeTasks.some(t => t.id === 'PRJ-TEST-PROG:CM_02:T01'));
  assert.ok(!activeTasks.some(t => t.id === 'PRJ-TEST-PROG:CM_03:T01'), 'CM_03 tasks must not be in activeTasks');

  // Cancelled task PRJ-TEST-PROG:CM_01:T02 must not be generated
  assert.ok(!activeTasks.some(t => t.id === 'PRJ-TEST-PROG:CM_01:T02'), 'Cancelled task must not be regenerated');

  // Future stages must have planned previews
  assert.ok(plannedTaskPreviews.some(t => t.id === 'PRJ-TEST-PROG:CM_03:T01'), 'CM_03 tasks must appear in planned previews');
});

test('SECTION 5B: Strict Prerequisite Gating & Fresh Project Invariants', () => {
  // A fresh project with ZERO completed stages
  const fresh = computeProgressiveStageAndTaskState({
    projectId: 'PRJ-FRESH-001',
    track: 'hardware_firmware_software',
    completedStageCodes: [],
    inProgressStageCodes: [],
  });

  const readyStages = fresh.stages.filter(s => s.status === 'ready');
  assert.equal(readyStages.length, 1, 'Only ONE stage must be ready on a fresh project');
  assert.equal(readyStages[0].stageCode, 'CM_01', 'Fresh project must ONLY mark CM_01 ready');

  // Integration and release stages MUST remain planned
  const int01 = fresh.stages.find(s => s.stageCode === 'INT_01');
  const int02 = fresh.stages.find(s => s.stageCode === 'INT_02');
  const cl01 = fresh.stages.find(s => s.stageCode === 'CL_01');
  assert.equal(int01.status, 'planned', 'INT_01 must be planned on fresh project');
  assert.equal(int02.status, 'planned', 'INT_02 must be planned on fresh project');
  assert.equal(cl01.status, 'planned', 'CL_01 must be planned on fresh project');

  // Supplying in_progress stage NEVER bypasses prerequisite checks
  const attemptBypass = computeProgressiveStageAndTaskState({
    projectId: 'PRJ-BYPASS-001',
    track: 'hardware_firmware_software',
    completedStageCodes: [],
    inProgressStageCodes: ['CL_01', 'INT_02'], // caller attempts to force in_progress without prerequisites
  });

  const cl01Bypass = attemptBypass.stages.find(s => s.stageCode === 'CL_01');
  const int02Bypass = attemptBypass.stages.find(s => s.stageCode === 'INT_02');
  assert.equal(cl01Bypass.status, 'planned', 'CL_01 must remain planned when prerequisites are unmet');
  assert.equal(int02Bypass.status, 'planned', 'INT_02 must remain planned when prerequisites are unmet');
});

test('SECTION 5C: Dependency Graph Integrity across all 7 Tracks', () => {
  // 1. Pre-project feasibility: HW_01, FW_01, SW_01 require only CM_01, never waiting for CM_03 or CM_04
  const hw01Prereqs = resolveStagePrerequisites('HW_01', 'hardware_only');
  const fw01Prereqs = resolveStagePrerequisites('FW_01', 'firmware_only');
  const sw01Prereqs = resolveStagePrerequisites('SW_01', 'software_only');
  assert.deepEqual(hw01Prereqs, ['CM_01'], 'HW_01 technical feasibility must require only CM_01');
  assert.deepEqual(fw01Prereqs, ['CM_01'], 'FW_01 technical feasibility must require only CM_01');
  assert.deepEqual(sw01Prereqs, ['CM_01'], 'SW_01 technical feasibility must require only CM_01');

  // 2. Cross-track integration prerequisites
  assert.deepEqual(resolveStagePrerequisites('INT_01', 'hardware_firmware'), ['HW_09', 'FW_02']);
  assert.deepEqual(resolveStagePrerequisites('INT_01', 'firmware_software_existing_hardware'), ['FW_02', 'SW_02']);
  assert.deepEqual(resolveStagePrerequisites('INT_01', 'hardware_firmware_software'), ['HW_09', 'FW_02', 'SW_02']);

  // 3. Release readiness CL_01: depends on validation evidence, NOT post-release stages (RM_03, HW_37, INT_03)
  assert.deepEqual(resolveStagePrerequisites('CL_01', 'ready_made'), ['RM_02']);
  assert.deepEqual(resolveStagePrerequisites('CL_01', 'software_only'), ['SW_09']);
  assert.deepEqual(resolveStagePrerequisites('CL_01', 'firmware_only'), ['FW_11']);
  assert.deepEqual(resolveStagePrerequisites('CL_01', 'hardware_only'), ['HW_32']);
  assert.deepEqual(resolveStagePrerequisites('CL_01', 'hardware_firmware'), ['INT_02']);
  assert.deepEqual(resolveStagePrerequisites('CL_01', 'hardware_firmware_software'), ['INT_02']);
});

test('SECTION 5D: Custom Task Management & Safeguards', () => {
  // 1. Create custom task
  const customTask = createCustomTaskInstance({
    projectId: 'PRJ-CUST-001',
    stageCode: 'HW_05',
    title: 'Custom Signal Integrity Simulation on DDR3 Bus',
    description: 'High-frequency simulation with HyperLynx',
    department: 'EHW',
    priority: 'High',
  });
  assert.equal(customTask.isCustom, true);
  assert.equal(customTask.status, 'todo');
  assert.equal(customTask.stageCode, 'HW_05');

  // 2. Safe deletion of unstarted, unassigned custom task
  const canDeleteUnused = validateTaskDeletion(customTask, [customTask]);
  assert.equal(canDeleteUnused.canDelete, true);

  // 3. Default template task cannot be deleted
  const defaultTask = {
    id: 'PRJ-CUST-001:HW_05:T01',
    projectId: 'PRJ-CUST-001',
    stageCode: 'HW_05',
    stageKey: 'LC2-2026-10-28:HW_05',
    title: 'Hardware schematic review',
    description: '',
    department: 'EHW',
    status: 'todo',
    priority: 'Normal',
    order: 1,
    isCustom: false,
  };
  const canDeleteDefault = validateTaskDeletion(defaultTask, [defaultTask]);
  assert.equal(canDeleteDefault.canDelete, false);

  // 4. Task in progress cannot be deleted (must be cancelled)
  const taskInProgress = { ...customTask, status: 'in_progress' };
  const canDeleteInProgress = validateTaskDeletion(taskInProgress, [taskInProgress]);
  assert.equal(canDeleteInProgress.canDelete, false);

  // 5. Cancel task with reason
  const cancelled = cancelTaskInstance(taskInProgress, 'Simulation scope replaced by vendor test report');
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.cancellationReason, 'Simulation scope replaced by vendor test report');
  assert.ok(cancelled.cancelledAt);
});

test('SECTION 6: 8 Sample Projects + 1 Declined Enquiry (Patch 5)', () => {
  assert.equal(CANONICAL_SAMPLE_PROJECTS.length, 9, 'Must have 9 sample cases (8 projects + 1 declined enquiry)');

  const e02 = CANONICAL_SAMPLE_PROJECTS.find(s => s.fixtureKey === 'LC2-E02');
  assert.ok(e02, 'LC2-E02 must exist');
  assert.equal(e02.projectCode, undefined, 'LC2-E02 must strictly have NO project code');
  assert.equal(e02.projectRecord, undefined, 'LC2-E02 must strictly have NO project record');

  // P06 mathematical reconciliation
  const p06 = CANONICAL_SAMPLE_PROJECTS.find(s => s.fixtureKey === 'LC2-P06');
  assert.ok(p06 && p06.productionReconciliation, 'LC2-P06 must have productionReconciliation');
  const rec = p06.productionReconciliation;
  assert.equal(rec.acceptedUnits, 150);
  assert.equal(rec.heldUnits, 5);
  assert.equal(rec.pendingInspectionUnits, 45);
  assert.equal(rec.lotQuantity, 200);
  assert.equal(rec.remainingPlannedUnits, 300);
  assert.equal(rec.totalPlannedUnits, 500);
  assert.equal(rec.reconciliationCheckPassed, true);
  assert.equal(verifyProductionReconciliation(rec), true);

  // Check all 7 tracks are covered across the samples
  const coveredTracks = new Set(CANONICAL_SAMPLE_PROJECTS.map(s => s.track));
  assert.ok(coveredTracks.has('hardware_only'));
  assert.ok(coveredTracks.has('firmware_only'));
  assert.ok(coveredTracks.has('software_only'));
  assert.ok(coveredTracks.has('hardware_firmware'));
  assert.ok(coveredTracks.has('firmware_software_existing_hardware'));
  assert.ok(coveredTracks.has('hardware_firmware_software'));
  assert.ok(coveredTracks.has('ready_made'));

  // Idempotent loader check
  const data1 = getAllCanonicalSampleData();
  const data2 = getAllCanonicalSampleData();
  assert.equal(data1.projects.length, 8, 'Must return exactly 8 projects (P01, P03..P09; E02 has no project)');
  assert.equal(data1.projects.length, data2.projects.length, 'Repeated call must return identical counts');
  assert.equal(data1.records.length, data2.records.length, 'Repeated call must return identical record counts');
});

test('SECTION 7: Lifecycle Scenarios S01-S06 Parity', () => {
  assert.equal(LIFECYCLE_SCENARIOS.length, 6, 'LIFECYCLE_SCENARIOS must have all 6 canonical scenarios S01-S06');

  const fixtures = getAllScenarioFixtures();
  assert.ok(fixtures.records.length > 20, 'Scenario fixtures must contain realistic records');
});


test('Recorded project track preserves field aliases and never guesses missing scope', () => {
  assert.equal(getRecordedProjectTrack({projectTrack: 'software_only'}), 'software_only');
  assert.equal(getRecordedProjectTrack({projectTrack: 'firmware'}), 'firmware_only');
  assert.equal(getRecordedProjectTrack({track: 'hardware_only', projectTrack: 'software_only'}), 'hardware_only');
  assert.equal(getRecordedProjectTrack({track: '', projectTrack: 'ready_made'}), 'ready_made');
  assert.equal(getRecordedProjectTrack({track: ' HW+FW '}), 'hardware_firmware');
  for (const track of Object.keys(CANONICAL_TRACK_METADATA)) {
    assert.equal(getRecordedProjectTrack({track}), track);
  }
  assert.equal(getRecordedProjectTrack(), undefined);
  assert.equal(getRecordedProjectTrack({}), undefined);
  assert.equal(getRecordedProjectTrack({track: 'unknown-track'}), undefined);
  assert.equal(getRecordedProjectTrack({track: {value: 'software_only'}}), undefined);
  const swTrack = getRecordedProjectTrack({projectTrack: 'software_only'});
  assert.ok(!getApplicableStagesForTrack(swTrack).some(stage => stage.stageCode.startsWith('HW_')));
});
