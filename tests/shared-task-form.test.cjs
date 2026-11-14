const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const component = fs.readFileSync(path.resolve(__dirname, '../src/components/DepartmentLeadCoordinationCenter.tsx'), 'utf8');
const sharedWorkspace = fs.readFileSync(path.resolve(__dirname, '../src/components/SharedOperationalWorkspace.tsx'), 'utf8');

test('shared task form requires a saved project and links the custom task to its current RACI stage', () => {
  assert.match(component, /if \(!newTaskProject\)[\s\S]{0,180}Select a saved project/);
  assert.match(component, /RACI owner/);
  assert.match(component, /Project \*/);
  assert.doesNotMatch(component, /Department task — no project/);
  assert.match(sharedWorkspace, /save\("create_custom_task"/);
  assert.match(sharedWorkspace, /stage_code: stageCode/);
  assert.match(sharedWorkspace, /const stageCode=String\(project\.fields\["currentStage"\]\|\|project\.fields\["lifecycleStage"\]\|\|project\.fields\["stage"\]/);
});
