const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/lib/department-chronicles.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', compiled)(mod, mod.exports);

const {
  DEFAULT_DEPARTMENT_CHRONICLES,
  deriveRaciMatrixFromChronicles,
  deriveDeliverablesForStage,
} = mod.exports;

const stages = [
  ["Stage 1", "Client & Sales Intake", "SOR and Mutual NDA"],
  ["Stage 2", "Feasibility & Contract Review", "Multi-department requirement baseline"],
  ["Stage 3", "Requirement Freeze & Commercial Lock", "Frozen PRS and Quotation"],
  ["Stage 4", "Design & Development PoC", "SCH, preliminary BOM, HAL bring-up"],
  ["Stage 5", "Pilot Build & Manufacturing Readiness", "Box-build Control Plan and fitment"],
  ["Stage 6", "DVP&R Pre-Compliance Verification", "Verification matrix and EMC testing"],
  ["Stage 7", "Production Release, DFMEA & PPAP", "DFMEA, PFMEA and PPAP Level 3"],
  ["Stage 8", "Type Approval & Regulatory Certification", "iCAT TAC and NABL battery cert"],
  ["Stage 9", "PDI, Field Mounting & Commercial Invoicing", "PDI, mounting SOP and tax invoice"],
];

const departments = ["SAL", "EHW", "FW", "SW", "MECH", "PUR", "QA", "EMF", "MMF", "FIN", "SIT", "HR"];

test('default department chronicles cover all 9 stages with canonical departments', () => {
  assert.ok(DEFAULT_DEPARTMENT_CHRONICLES.length >= 25, 'Expected comprehensive set of default chronicles');
  
  // Verify Stage 2 contains requirement sheets for all 11 downstream departments
  const stage2 = DEFAULT_DEPARTMENT_CHRONICLES.filter(c => c.stageIndex === 1);
  const stage2Depts = new Set(stage2.map(c => c.departmentCode));
  for (const dept of ["EHW", "FW", "SW", "MECH", "PUR", "QA", "EMF", "MMF", "FIN", "SIT", "HR"]) {
    assert.ok(stage2Depts.has(dept), `Stage 2 must include requirement sheet for ${dept}`);
  }
});

test('deriveRaciMatrixFromChronicles accurately maps responsible and accountable roles', () => {
  const matrix = deriveRaciMatrixFromChronicles(DEFAULT_DEPARTMENT_CHRONICLES, stages, departments);
  
  // Stage 1: SAL is Responsible
  assert.equal(matrix["Stage 1"]["SAL"], "R");
  
  // Stage 2: FW, SW, EHW, MECH, PUR, QA, EMF, MMF, FIN are Responsible; SAL is Accountable
  assert.equal(matrix["Stage 2"]["FW"], "R");
  assert.equal(matrix["Stage 2"]["SW"], "R");
  assert.equal(matrix["Stage 2"]["MMF"], "R");
  assert.equal(matrix["Stage 2"]["EMF"], "R");
  assert.equal(matrix["Stage 2"]["SAL"], "A");

  // Stage 3: HR/OPS is Responsible for Requirement Freeze
  assert.equal(matrix["Stage 3"]["HR"], "R");
  assert.equal(matrix["Stage 3"]["EHW"], "R");
  assert.equal(matrix["Stage 3"]["SAL"], "R");
  
  // Stage 6: QA is Responsible
  assert.equal(matrix["Stage 6"]["QA"], "R");
  
  // Stage 8: QA is Responsible (TAC, NABL)
  assert.equal(matrix["Stage 8"]["QA"], "R");
});

test('creating a new chronicle dynamically updates RACI matrix and stage deliverables', () => {
  const newChronicle = {
    id: "CHRON-CUSTOM-TEST-01",
    stageIndex: 3, // Stage 4
    stageName: "Stage 4: Design & Development PoC",
    departmentCode: "MMF",
    title: "Custom 3D Rapid Prototype Enclosure Fit Check",
    deliverableCode: "MMF-PROTO-01",
    documentType: "DFM",
    raciRole: "R",
    mandatory: true,
    description: "First-run SLS 3D printed housing clearance test.",
    status: "Approved",
  };

  const updatedChronicles = [...DEFAULT_DEPARTMENT_CHRONICLES, newChronicle];
  const matrix = deriveRaciMatrixFromChronicles(updatedChronicles, stages, departments);

  // MMF is now Responsible in Stage 4
  assert.equal(matrix["Stage 4"]["MMF"], "R");

  // Stage 4 deliverables contain the new item
  const stage4Deliverables = deriveDeliverablesForStage(updatedChronicles, 3);
  const found = stage4Deliverables.find(d => d.docId === "MMF-PROTO-01");
  assert.ok(found, "Custom chronicle must appear in Stage 4 deliverables");
  assert.equal(found.title, "Custom 3D Rapid Prototype Enclosure Fit Check");
  assert.equal(found.dept, "MMF");
});

test('modifying an existing chronicle updates deliverable attributes and RACI dynamically', () => {
  // Modify CHRON-S4-FW-HAL from FW to SW and change title
  const modified = DEFAULT_DEPARTMENT_CHRONICLES.map(c => {
    if (c.id === "CHRON-S4-FW-HAL") {
      return {
        ...c,
        title: "Modified Firmware & Telematics Stack",
        departmentCode: "SW",
      };
    }
    return c;
  });

  const stage4Deliverables = deriveDeliverablesForStage(modified, 3);
  const updatedItem = stage4Deliverables.find(d => d.docId === "FW-HAL-01");
  assert.ok(updatedItem);
  assert.equal(updatedItem.title, "Modified Firmware & Telematics Stack");
  assert.equal(updatedItem.dept, "SW");
});

test('deleting a chronicle removes it from stage deliverables and recomputes RACI matrix', () => {
  // Delete CHRON-S6-QA-DVP
  const withoutDvp = DEFAULT_DEPARTMENT_CHRONICLES.filter(c => c.id !== "CHRON-S6-QA-DVP");
  
  const stage6Deliverables = deriveDeliverablesForStage(withoutDvp, 5);
  assert.equal(stage6Deliverables.some(d => d.docId === "QA-DVP-01"), false);

  // QA is no longer 'R' in Stage 6
  const matrix = deriveRaciMatrixFromChronicles(withoutDvp, stages, departments);
  assert.notEqual(matrix["Stage 6"]["QA"], "R");
});
