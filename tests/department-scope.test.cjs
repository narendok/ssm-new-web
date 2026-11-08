const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/lib/department-scope.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const scope = { exports: {} };
new Function('module', 'exports', compiled)(scope, scope.exports);
const { departmentCode, approvalInDepartment, approvalScope, canDepartmentSign, projectReferences, taskProjectId } = scope.exports;
const departments = ['sales', 'ehw', 'fw', 'sw', 'mech', 'pur', 'qa', 'emf', 'mmf', 'fin', 'sit', 'hrops'];

test('all twelve leads see their requests and assigned cross-department reviews, but no unrelated requests', () => {
  for (const own of departments) {
    for (const other of departments) {
      const request = { department: departmentCode(other), approverAuthority: 'Admin' };
      assert.equal(approvalInDepartment(request, own), own === other, `${own} visibility of ${other}`);
      assert.equal(canDepartmentSign(request, own), false, 'request ownership does not grant signing authority');
    }
    const routed = { department: 'External Department', approverAuthority: departmentCode(own) };
    assert.equal(approvalInDepartment(routed, own), true);
    assert.equal(canDepartmentSign(routed, own), true);
  }
});

test('strict cross-department signing denial between FW and SW', () => {
  const swApproval = { department: 'SW', approverAuthority: 'SW' };
  const fwApproval = { department: 'FW', approverAuthority: 'FW' };

  // FW lead attempting to sign SW approval returns false
  assert.equal(canDepartmentSign(swApproval, 'fw'), false);
  assert.equal(approvalInDepartment({ department: 'SW', approverAuthority: 'Admin' }, 'fw'), false);

  // SW lead attempting to sign FW approval returns false
  assert.equal(canDepartmentSign(fwApproval, 'sw'), false);
  assert.equal(approvalInDepartment({ department: 'FW', approverAuthority: 'Admin' }, 'sw'), false);
});

test('canonical aliases, absent authority and explicit admin designation fail closed', () => {
  assert.equal(departmentCode('sales'), 'SAL');
  assert.equal(departmentCode('HR/OPS'), 'HR');
  assert.equal(departmentCode('fw'), 'FW');
  assert.equal(departmentCode('efw'), 'FW');
  assert.equal(departmentCode('sw'), 'SW');
  assert.equal(departmentCode('csw'), 'SW');
  assert.equal(departmentCode('mmf'), 'MMF');
  assert.equal(departmentCode('mechanical manufacturing'), 'MMF');
  assert.equal(approvalInDepartment({ department: 'HR' }, 'hrops'), true);
  assert.equal(canDepartmentSign({ department: 'QA', approverAuthority: 'Admin' }, 'qa'), false);
  assert.equal(canDepartmentSign({ department: 'QA' }, 'qa'), false);
  assert.equal(approvalInDepartment({}, undefined), false);

  // Retired ESW alias cannot be signed by arbitrary departments without explicit designated authority
  assert.equal(canDepartmentSign({ department: 'ESW', approverAuthority: 'ESW' }, 'fw'), false);
  assert.equal(canDepartmentSign({ department: 'ESW', approverAuthority: 'ESW' }, 'sw'), false);
  assert.equal(canDepartmentSign({ department: 'ESW', approverAuthority: 'ESW' }, 'sales'), false);
});

test('legacy compatibility is limited to known demo IDs and preserves explicit assignments', () => {
  assert.equal(approvalScope({ id: 'demo-approval-fin-advance' }).department, 'FIN');
  assert.equal(approvalScope({ id: 'demo-approval-fin-advance', department: 'SIT' }).department, 'SIT');
  assert.deepEqual(approvalScope({ id: 'real-record' }), { id: 'real-record' });
});

test('project links use structured fields, supporting multiple legacy link separators without title inference', () => {
  assert.deepEqual(projectReferences({ reference: 'TASK-1', type: 'Task', fields: { linkedRecords: 'HLPL-SLCT-01 · HLPL-AI4T-01, HLPL-XLINK-03' } }), ['HLPL-SLCT-01', 'HLPL-AI4T-01', 'HLPL-XLINK-03']);
  assert.deepEqual(projectReferences({ reference: 'HLPL-SLCT-01', type: 'Task', fields: {} }), []);
  assert.deepEqual(projectReferences({ reference: 'TASK-2', type: 'Task', fields: { project_id: 'project-uuid', projectCode: 'VCU' } }), ['project-uuid', 'VCU']);
});

test('task project scope resolves direct and linked-record project IDs without title inference', () => {
  const project = { id: 'project-uuid', reference: 'HLPL-AI4T-01', type: 'Project', fields: {} };
  const linkedTaskRecord = {
    id: 'task-record',
    reference: 'TASK-1',
    type: 'Task',
    fields: { project_id: project.id },
  };
  const unrelatedRecord = {
    id: 'unrelated-record',
    reference: 'Task mentions HLPL-AI4T-01 in its title',
    type: 'Task',
    fields: {},
  };

  assert.equal(taskProjectId({ recordId: project.id }, [project]), project.id);
  assert.equal(taskProjectId({ recordId: linkedTaskRecord.id }, [project, linkedTaskRecord]), project.id);
  assert.equal(taskProjectId({ recordId: unrelatedRecord.id }, [project, unrelatedRecord]), null);
});

test('repairing an incomplete demo snapshot preserves saved drafts, revisions, tasks, approvals and roster', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/lib/portal-hydration.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const hydration = { exports: {} };
  new Function('module', 'exports', compiled)(hydration, hydration.exports);
  const saved = { documents: [{ id: 'draft', revision: '02' }, { id: 'seed-1', revision: '03' }], records: [{ id: 'task-edited' }], departments: [{ id: 'own' }], approvals: [{ id: 'approved' }], teamMembers: [{ name: 'Added member' }] };
  const seed = { documents: [{ id: 'seed-1', revision: '00' }, { id: 'seed-2' }], records: [{ id: 'seed-task' }], departments: [{ id: 'seed-dept' }], approvals: [], teamMembers: [] };
  const repaired = hydration.exports.repairDemoState(saved, seed);
  assert.equal(repaired.documents.length, 3);
  assert.equal(repaired.documents.find(document => document.id === 'seed-1').revision, '03');
  assert.deepEqual(repaired.records, saved.records);
  assert.deepEqual(repaired.approvals, saved.approvals);
  assert.deepEqual(repaired.teamMembers, saved.teamMembers);
});
