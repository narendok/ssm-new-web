const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.resolve(__dirname, '../src/lib/shared-department-access.ts'), 'utf8');
const js = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
const loaded = { exports: {} };
new Function('module', 'exports', js)(loaded, loaded.exports);
const { departmentIdsForMember, memberHasDepartmentPermission, memberHasDepartmentScope } = loaded.exports;

const departments = [
  { id: 'it', code: 'SIT', active: true, leadMemberId: null },
  { id: 'ops', code: 'OPS', active: true, leadMemberId: null },
  { id: 'hr', code: 'HR', active: true, leadMemberId: 'lead-1' },
];

test('one member can switch between separate primary and role-assigned department workspaces', () => {
  const roles = [
    { departmentId: 'ops', active: true, memberIds: ['member-1'], permissions: ['records:view'] },
    { departmentId: 'hr', active: true, memberIds: ['member-1'], permissions: ['records:view'] },
    { departmentId: 'it', active: false, memberIds: ['member-1'], permissions: ['records:view'] },
  ];
  assert.deepEqual(departmentIdsForMember(departments, roles, 'member-1', 'member', 'SIT'), ['it', 'ops', 'hr']);
});

test('department actions require that department role permission; direct department lead remains authorized', () => {
  const roles = [{ departmentId: 'ops', active: true, memberIds: ['member-1'], permissions: ['records:view', 'tasks:assign'] }];
  assert.equal(memberHasDepartmentPermission(departments[1], roles, 'member-1', 'member', 'tasks:assign'), true);
  assert.equal(memberHasDepartmentPermission(departments[1], roles, 'member-1', 'member', 'records:create'), false);
  assert.equal(memberHasDepartmentPermission(departments[2], roles, 'lead-1', 'department_lead', 'records:create'), true);
});

test('assignee options include only members explicitly scoped to the selected department', () => {
  const roles = [{ departmentId: 'ops', active: true, memberIds: ['member-1'], permissions: ['records:view'] }];
  assert.equal(memberHasDepartmentScope(departments[1], roles, 'member-1'), true);
  assert.equal(memberHasDepartmentScope(departments[1], roles, 'member-2'), false);
});
