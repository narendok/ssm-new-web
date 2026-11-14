const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveEditableMasterLink, replaceEditableMasterLink } = require('../src/lib/shared-record-master-edit.ts');

const options = [
  { id: 'project-1', reference: 'HLPL-P-01', title: 'Orion' },
  { id: 'supplier-1', reference: 'HLPL-S-01', title: 'Supplier One' },
];

test('record master editing resolves only a consistent exact alias set', () => {
  assert.deepEqual(resolveEditableMasterLink({ projectId: 'project-1', projectCode: 'HLPL-P-01' }, options, ['projectId', 'projectCode']), { id: 'project-1', existing: true, unresolved: false });
  assert.deepEqual(resolveEditableMasterLink({ projectId: 'missing', projectCode: 'HLPL-P-01' }, options, ['projectId', 'projectCode']), { id: '', existing: true, unresolved: true });
  assert.deepEqual(resolveEditableMasterLink({ projectId: 'project-1', project_id: 'supplier-1' }, options, ['projectId', 'project_id']), { id: '', existing: true, unresolved: true });
  assert.deepEqual(resolveEditableMasterLink({}, options, ['projectId', 'projectCode']), { id: '', existing: false, unresolved: false });
});

test('record master edit replaces every alias together or clears every alias together', () => {
  const aliases = { ids: ['projectId', 'project_id', 'linkedProjectId'], references: ['projectCode', 'project_code', 'projectReference', 'project'], names: ['projectName'] };
  const selected = replaceEditableMasterLink({ ...options[0], projectId: 'old' }, options[0], aliases);
  assert.equal(selected.projectId, 'project-1');
  assert.equal(selected.project_id, 'project-1');
  assert.equal(selected.linkedProjectId, 'project-1');
  assert.equal(selected.projectCode, 'HLPL-P-01');
  assert.equal(selected.project, 'HLPL-P-01');
  assert.equal(selected.projectName, 'Orion');
  const cleared = replaceEditableMasterLink(selected, undefined, aliases);
  assert.equal(Object.keys(cleared).some(key => [...aliases.ids, ...aliases.references, ...aliases.names].includes(key)), false);
});
