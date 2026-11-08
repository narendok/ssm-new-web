const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/lib/record-form-catalogue.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleRef = { exports: {} };
new Function('module', 'exports', compiled)(moduleRef, moduleRef.exports);
const { recordAttachmentAllowedAtStage } = moduleRef.exports;
const stages = ['HW_01', 'HW_02', 'HW_03', 'HW_15', 'HW_16', 'HW_17', 'HW_18', 'HW_19', 'HW_24'].map(stageCode => ({ stageCode }));

test('record originals are enabled at their mapped canonical stage and the immediately following stage only', () => {
  assert.equal(recordAttachmentAllowedAtStage('Schematic', 'HW_15', stages), true);
  assert.equal(recordAttachmentAllowedAtStage('Schematic', 'HW_16', stages), true);
  assert.equal(recordAttachmentAllowedAtStage('Schematic', 'HW_17', stages), false);
  assert.equal(recordAttachmentAllowedAtStage('Schematic', 'HW_14', stages), false);
  assert.equal(recordAttachmentAllowedAtStage('Schematic', 'Stage 8 · readiness planning', stages), false);
  assert.equal(recordAttachmentAllowedAtStage('APQP gate', 'HW_15', stages), false);
});

test('a record without a mapped original contract cannot upload directly from Add Record', () => {
  assert.equal(recordAttachmentAllowedAtStage('Task', 'HW_15', stages), false);
});
