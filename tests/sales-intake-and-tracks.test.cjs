const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { sharedSalesPipeline } = require('../src/lib/shared-sales.ts');

const {
  DEFAULT_DEPARTMENT_CHRONICLES,
  deriveRaciMatrixFromChronicles,
  getTechnicalDepartmentsForTrack,
  isDepartmentActiveForTrack,
} = require('../src/lib/department-chronicles.ts');

const stages = [
  ["Stage 1", "Customer Requirements & Proposal Gate", "SAL"],
  ["Stage 2", "Multi-Department Feasibility & Contract Review Gate", "SAL"],
  ["Stage 3", "Requirement Freeze & Commercial Lock", "SAL"],
  ["Stage 4", "Design & Development PoC", "EHW"],
  ["Stage 5", "Design Verification & SMT Pilot", "EHW"],
  ["Stage 6", "Validation & Pre-Compliance DVP", "QA"],
  ["Stage 7", "Product & Process Engineering Freeze", "EHW"],
  ["Stage 8", "PPAP, Homologation & Type Approval", "QA"],
  ["Stage 9", "SOP & Series Production Handoff", "EMF"],
];

const departments = ["SAL", "EHW", "FW", "SW", "MECH", "PUR", "QA", "EMF", "MMF", "FIN", "SIT", "HR"];

test('ready_made track requires zero technical engineering development', () => {
  const depts = getTechnicalDepartmentsForTrack('ready_made');
  assert.deepEqual(depts, [], 'Ready-made device track must require no technical engineering departments');
  
  // Common departments remain active
  assert.equal(isDepartmentActiveForTrack('SAL', 'ready_made'), true);
  assert.equal(isDepartmentActiveForTrack('FIN', 'ready_made'), true);
  assert.equal(isDepartmentActiveForTrack('HR', 'ready_made'), true);
  
  // Technical departments are inactive for ready-made track
  assert.equal(isDepartmentActiveForTrack('EHW', 'ready_made'), false);
  assert.equal(isDepartmentActiveForTrack('FW', 'ready_made'), false);
  assert.equal(isDepartmentActiveForTrack('MECH', 'ready_made'), false);
  assert.equal(isDepartmentActiveForTrack('EMF', 'ready_made'), false);
});

test('ready_made track includes SAL-BRO-01 and SAL-TDS-01 in Stage 3 chronicles', () => {
  const bro = DEFAULT_DEPARTMENT_CHRONICLES.find(c => c.deliverableCode === 'SAL-BRO-01');
  assert.ok(bro, 'SAL-BRO-01 must be present in chronicles');
  assert.equal(bro.stageIndex, 2);
  assert.equal(bro.departmentCode, 'SAL');
  assert.equal(bro.documentType, 'BRO');

  const tds = DEFAULT_DEPARTMENT_CHRONICLES.find(c => c.deliverableCode === 'SAL-TDS-01');
  assert.ok(tds, 'SAL-TDS-01 must be present in chronicles');
  assert.equal(tds.stageIndex, 2);
  assert.equal(tds.departmentCode, 'SAL');
  assert.equal(tds.documentType, 'TDS');
});

test('deriveRaciMatrixFromChronicles leaves unassigned departments as empty string', () => {
  const matrix = deriveRaciMatrixFromChronicles(DEFAULT_DEPARTMENT_CHRONICLES, stages, departments);
  // In Stage 1, only SAL is assigned; EHW has no role
  assert.equal(matrix["Stage 1"]["SAL"], "R");
  assert.equal(matrix["Stage 1"]["EHW"], "");
  assert.equal(matrix["Stage 1"]["MECH"], "");
  
  // In Stage 3, HR and SAL are Responsible
  assert.equal(matrix["Stage 3"]["HR"], "R");
  assert.equal(matrix["Stage 3"]["SAL"], "R");
});

test('SalesWorkspaceAndCustomerRegister contains UnifiedSalesIntakeModal and dual action buttons', () => {
  const file = fs.readFileSync(path.resolve(__dirname, '../src/components/SalesWorkspaceAndCustomerRegister.tsx'), 'utf8');
  assert.ok(file.includes('UnifiedSalesIntakeModal'), 'UnifiedSalesIntakeModal must be exported');
  assert.ok(file.includes('Add Enquiry'), 'Add Enquiry button must be present');
  assert.ok(file.includes('Add Opportunity'), 'Add Opportunity button must be present');
  assert.ok(file.includes('Convert to Opportunity'), 'Convert to Opportunity button must be present');
  assert.ok(!file.includes('aria-label="Project technical track"'), 'formal track selection must be deferred until after feasibility');
  assert.ok(file.includes('Engineering track is decided after feasibility review'), 'intake must explain the track decision point');
  assert.ok(file.includes('Customer-stated scope clue (unconfirmed)'), 'customer scope clues must remain unconfirmed at intake');
  const sharedPipeline = fs.readFileSync(path.resolve(__dirname, '../src/components/SharedSalesPipeline.tsx'), 'utf8');
  assert.ok(!sharedPipeline.includes('source.projectTrack==="ready_made"?["SAL","FIN"]'), 'customer scope clues must not waive engineering feasibility reviewers');
});

test('shared intake does not invent a project track before feasibility records one', () => {
  const pipeline = sharedSalesPipeline({
    records: [{ id: 'enquiry-1', reference: 'TEST-ENQ-1', record_type: 'Enquiry', title: 'Fictional intake', status: 'open', department_id: 'sales', updated_at: '2026-11-03T00:00:00Z', fields: { customer: 'Fictional Fleet', scope: 'Tracker requirements under review' }, notes: '' }],
    approvals: [],
    departments: [],
  });
  assert.equal(pipeline.enquiries[0].projectTrack, undefined);
});
