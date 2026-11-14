const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/lib/shared-task-date.ts'), 'utf8');
const businessDateSource = fs.readFileSync(path.join(root, 'src/lib/business-date.ts'), 'utf8');
const businessDateJs = ts.transpile(businessDateSource, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
const businessDateModule = { exports: {} };
new Function('module', 'exports', businessDateJs)(businessDateModule, businessDateModule.exports);
const js = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
const loaded = { exports: {} };
new Function('require', 'module', 'exports', js)(name => name === './business-date' ? businessDateModule.exports : require(name), loaded, loaded.exports);
const { sharedTaskDueDate } = loaded.exports;

test('keeps reasonable due dates in the task date projection', () => {
  assert.deepEqual(
    sharedTaskDueDate('2026-11-12T00:00:00+05:30', '2026-11-01T10:00:00Z'),
    { dueDate: '2026-11-12', storedDueDate: '2026-11-12', warning: '' },
  );
});

test('does not project a due date more than a year before task creation as overdue', () => {
  const projected = sharedTaskDueDate('2000-07-22T00:00:00+05:30', '2026-10-24T09:00:00Z');
  assert.equal(projected.dueDate, '');
  assert.equal(projected.storedDueDate, '2000-07-22');
  assert.match(projected.warning, /over a year before this task was created/);
});

test('keeps an undated task empty without a warning', () => {
  assert.deepEqual(sharedTaskDueDate(null, '2026-11-01T10:00:00Z'), {
    dueDate: '', storedDueDate: '', warning: '',
  });
});
