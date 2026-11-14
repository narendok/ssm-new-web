const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { feasibilityEstimateReview, mergeFeasibilityTaskPlan, feasibilityDepartmentCodes } = require('../src/lib/project-inputs.ts');
const { defaultLifecycleRevision } = require('../src/lib/lifecycle-baseline.ts');
const { feasibilityLifecycleStages } = require('../src/lib/feasibility-lifecycle.ts');

test('feasibility task stages follow a recorded project track and keep all candidates provisional before selection', () => {
  const revision = defaultLifecycleRevision();
  const allCandidates = feasibilityLifecycleStages(revision);
  const hardwareOnly = feasibilityLifecycleStages(revision, { projectTrack: 'hardware_only' });

  assert.equal(allCandidates.track, undefined);
  assert.equal(allCandidates.stages.length, revision.stages.length, 'unselected opportunity keeps candidate stages available');
  assert.equal(hardwareOnly.track, 'hardware_only');
  assert.ok(hardwareOnly.stages.some(stage => stage.code.startsWith('HW_')));
  assert.ok(hardwareOnly.stages.every(stage => !stage.code.startsWith('FW_') && !stage.code.startsWith('SW_')),
    'a hardware-only project must not show firmware or software department tasks');

  const certified = feasibilityLifecycleStages(revision, { projectTrack: 'hardware_only', certificationRequired: 'true' });
  assert.ok(!hardwareOnly.stages.some(stage => /^C\d+$/.test(stage.code)));
  assert.ok(certified.stages.some(stage => /^C\d+$/.test(stage.code)), 'certification stages appear only when required by the selected project');
});

test('preserves saved lead task timing after lifecycle defaults change and suggests only newly added tasks', () => {
  const saved = {
    'HW_01:T01': { stageCode: 'HW_01', phase: 'TG_0', effortHours: 12, startOffsetDays: 2, durationDays: 3 },
  };
  const suggested = {
    'HW_01:T01': { stageCode: 'HW_01', phase: 'TG_0', effortHours: 4, startOffsetDays: 0, durationDays: 1 },
    'HW_01:T02': { stageCode: 'HW_01', phase: 'TG_0', effortHours: 6, startOffsetDays: 1, durationDays: 1 },
  };
  const merged = mergeFeasibilityTaskPlan([
    { key: 'HW_01:T01', stageCode: 'HW_01', phase: 'TG_0' },
    { key: 'HW_01:T02', stageCode: 'HW_01', phase: 'TG_0' },
  ], saved, suggested);

  assert.deepEqual(merged['HW_01:T01'], saved['HW_01:T01']);
  assert.deepEqual(merged['HW_01:T02'], suggested['HW_01:T02']);
});

test('flags changed stage windows and lifecycle revision for lead review', () => {
  const unchanged = feasibilityEstimateReview(
    { lifecycleRevisionId: 'revision-1', stageDurationDays: { HW_01: 5, HW_02: 8 } },
    'revision-1',
    { HW_01: 5, HW_02: 3 },
  );
  assert.deepEqual(unchanged, { lifecycleChanged: false, changedStageCodes: ['HW_02'], requiresReview: true });

  const revisionChanged = feasibilityEstimateReview(
    { lifecycleRevisionId: 'revision-1', stageDurationDays: { HW_01: 5 } },
    'revision-2',
    { HW_01: 5 },
  );
  assert.equal(revisionChanged.lifecycleChanged, true);
  assert.equal(revisionChanged.requiresReview, true);
});

test('a changed lifecycle schedule cannot be re-baselined until the lead acknowledges review', () => {
  const workspace = fs.readFileSync(path.join(__dirname, '../src/components/ProjectInputsWorkspace.tsx'), 'utf8');
  assert.match(workspace, /aria-label="Confirm feasibility task schedule review"/);
  assert.match(workspace, /estimateReview\?\.requiresReview && !estimateScheduleReviewed/);
  assert.match(workspace, /setEstimateScheduleReviewed\(true\)/,
    'Auto-plan is an explicit review action against the current Admin windows');
  assert.doesNotMatch(workspace, /saved estimate used \$\{savedDays\} days/,
    'the lead UI does not imply that a department lead controls the Admin stage duration');
});

test('a lead can select only active departments granted through their configured editable roles', () => {
  const available = feasibilityDepartmentCodes(
    [
      { id: 'dept-ehw', code: 'EHW' },
      { id: 'dept-mmf', code: 'MMF' },
      { id: 'dept-qa', code: 'QA' },
      { id: 'dept-fw', code: 'FW' },
      { id: 'dept-old', code: 'OLD', active: false },
    ],
    [
      { departmentId: 'dept-mmf', active: true, hierarchyLevel: 1, memberIds: ['member-1'], permissions: ['records:view', 'records:edit'] },
      { departmentId: 'dept-qa', active: true, hierarchyLevel: 2, memberIds: ['member-1'], permissions: ['records:view', 'records:edit'] },
      { departmentId: 'dept-fw', active: true, hierarchyLevel: null, memberIds: ['member-1'], permissions: ['records:view', 'records:edit'] },
      { departmentId: 'dept-old', active: true, memberIds: ['member-1'], permissions: ['records:edit'] },
      { departmentId: 'dept-qa', active: false, memberIds: ['member-1'], permissions: ['records:edit'] },
    ],
    'member-1',
    'EHW',
  );
  assert.deepEqual(available, ['EHW', 'MMF']);
});

test('shared feasibility UI scopes assessments and task timelines to the selected configured role', () => {
  const workspace = fs.readFileSync(path.join(__dirname, '../src/components/ProjectInputsWorkspace.tsx'), 'utf8');
  const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261112144252_configured_department_feasibility_work.sql'), 'utf8');
  assert.match(workspace, /getSharedDepartmentRoleConfiguration/);
  assert.match(workspace, /aria-label="Feasibility department role"/);
  assert.match(workspace, /departmentCode: estimateDept/);
  assert.match(workspace, /p\.lead === estimateDept \|\| p\.reviewers\.includes\(estimateDept\)/);
  assert.match(migration, /private\.can_manage_department_feasibility\(a\.organization_id,d\.id,a\.membership_id\)/);
  assert.match(migration, /role\.hierarchy_level IS NULL OR role\.hierarchy_level=1/);
  assert.match(migration, /p_estimate->>'departmentCode'/);
  assert.match(migration, /FEASIBILITY_ESTIMATE_DEPARTMENT_DENIED/);
  assert.match(migration, /INPUT_DEPARTMENT_DENIED/);
  const explicitLeadGuard = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261113034559_require_explicit_l1_for_department_feasibility.sql'), 'utf8');
  assert.match(explicitLeadGuard, /role\.hierarchy_level=1/);
  assert.doesNotMatch(explicitLeadGuard, /hierarchy_level IS NULL/);
});
