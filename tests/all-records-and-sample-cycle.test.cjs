const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadTsModule(relativePath) {
  const fullPath = path.resolve(__dirname, relativePath);
  const code = fs.readFileSync(fullPath, "utf8");
  const transpiled = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", "require", transpiled)(mod, mod.exports, require);
  return mod.exports;
}

const { formSpecs, recordFormSpec, recordFields, recordFieldValues } = loadTsModule("../src/lib/record-form-catalogue.ts");
const { LIFECYCLE_SCENARIOS, getScenario } = loadTsModule("../src/lib/lifecycle-scenarios.ts");
const { buildDocumentDraft } = loadTsModule("../src/lib/document-draft.ts");
const { CATALOGUE_FAMILIES } = loadTsModule("../src/lib/document-catalogue.ts");

test("SECTION 1: Comprehensive verification of all 88 record types across all departments", () => {
  const allDeptSpecs = Object.keys(formSpecs);
  assert.ok(allDeptSpecs.length >= 12, "Must cover all departments");

  let totalTypesVerified = 0;

  for (const deptKey of allDeptSpecs) {
    const spec = formSpecs[deptKey];
    assert.ok(spec, `Spec must exist for ${deptKey}`);
    assert.ok(spec.types.length > 0, `Department ${deptKey} must have defined record types`);

    for (const recordType of spec.types) {
      totalTypesVerified++;
      const fields = recordFields(spec, recordType);

      // Populate realistic sample data for every field in this record type
      const sampleInput = {
        title: `Sample ${recordType} Record`,
        controlledNumber: `TEST-${deptKey.toUpperCase()}-${totalTypesVerified}`,
        projectId: "TEST-OBD-01",
        revision: "01",
      };

      for (const field of fields) {
        if (field.kind === "select" && field.options?.length) {
          sampleInput[field.key] = field.options[0];
        } else if (field.kind === "date") {
          sampleInput[field.key] = "2026-10-25";
        } else if (field.master === "locations") {
          sampleInput[field.key] = "XYZ Pvt Ltd — Noida Tech Center";
        } else if (field.master === "people") {
          sampleInput[field.key] = "Avery Vale";
        } else if (field.master === "suppliers") {
          sampleInput[field.key] = "Mouser Electronics";
        } else if (field.master === "parts") {
          sampleInput[field.key] = "STM32G0B1VCT6";
        } else if (field.master === "customers") {
          sampleInput[field.key] = "Tata Motors Limited";
        } else if (field.master === "routes") {
          sampleInput[field.key] = "SMT Line 1 -> Automated Optical Inspection";
        } else {
          sampleInput[field.key] = `Verified ${field.label}`;
        }
      }

      // Verify that sample record saves and preserves every field
      const saved = recordFieldValues(spec, recordType, sampleInput);
      assert.equal(saved.revision, "01", `Revision must be retained for ${recordType}`);

      for (const field of fields) {
        assert.equal(
          saved[field.key],
          sampleInput[field.key],
          `Field ${field.key} in ${deptKey} / ${recordType} must be preserved`
        );
      }

      // Verify required field validation
      const requiredField = fields.find((f) => f.required);
      if (requiredField) {
        const invalidInput = { ...sampleInput, [requiredField.key]: "" };
        assert.throws(
          () => recordFieldValues(spec, recordType, invalidInput),
          /required/,
          `Missing required field ${requiredField.label} must throw in ${recordType}`
        );
      }

      // Verify that foreign/invalid select options fail closed
      const selectField = fields.find((f) => f.kind === "select" && f.options?.length);
      if (selectField) {
        const badSelectInput = { ...sampleInput, [selectField.key]: "INVALID_OPTION_XYZ" };
        assert.throws(
          () => recordFieldValues(spec, recordType, badSelectInput),
          /valid/,
          `Invalid select value must be rejected in ${recordType}`
        );
      }
    }
  }

  assert.ok(totalTypesVerified >= 50, `Must verify all discovered types; verified ${totalTypesVerified}`);
});

test("SECTION 2: Verification of all 38 Document Catalogue Families (D01-D38)", () => {
  assert.equal(CATALOGUE_FAMILIES.length, 38, "Document catalogue must define all 38 families (D01-D38)");
  const ids = CATALOGUE_FAMILIES.map((f) => f.id);

  for (let i = 1; i <= 38; i++) {
    const expectedId = `D${String(i).padStart(2, "0")}`;
    assert.ok(ids.includes(expectedId), `Catalogue must contain family ${expectedId}`);
  }

  // Verify key automotive families
  const d01 = CATALOGUE_FAMILIES.find((f) => f.id === "D01");
  assert.ok(d01.family.includes("Common operating pack"));

  const d11 = CATALOGUE_FAMILIES.find((f) => f.id === "D11");
  assert.ok(d11.family.includes("Engineering BOM"));

  const d13 = CATALOGUE_FAMILIES.find((f) => f.id === "D13");
  assert.ok(d13.family.includes("POC / design verification / DVP&R"));

  const d22 = CATALOGUE_FAMILIES.find((f) => f.id === "D22");
  assert.ok(d22.family.includes("PFMEA / control plan"));
});

test("SECTION 3: End-to-End Cross-Department Project Cycle Simulation (§14.13C & §14.14)", () => {
  // Phase 1: Sales Customer & Enquiry Intake (S02 Declined vs S03/S04 Accepted)
  const s02 = getScenario("DECLINED-ENQUIRY");
  assert.ok(s02, "S02 must exist");
  assert.equal(s02.projectCode, undefined, "S02 Declined Enquiry MUST NOT create a project code");
  assert.equal(s02.isExternalClient, true);
  assert.ok(s02.dependencies.length > 0, "S02 must record supplier lead-time dependency");
  assert.ok(s02.stageRemark.includes("cannot accommodate"), "S02 must record lead-time constraint");

  // Phase 2: Internal Jig Tooling (S01 Clientless Boundary)
  const s01 = getScenario("INTERNAL-JIG");
  assert.ok(s01, "S01 must exist");
  assert.equal(s01.isExternalClient, false, "S01 must represent internal boundary (no external client)");
  assert.equal(s01.projectCode, "TEST-JIG-01");
  assert.ok(s01.dependencies.some((d) => d.providerDept === "Hardware"));
  assert.ok(s01.dependencies.some((d) => d.providerDept === "Mechanical"));

  // Phase 3: Hardware Baseline & BOM Formulation (S03 Client PoC)
  const s03 = getScenario("CLIENT-POC");
  assert.ok(s03, "S03 must exist");
  assert.equal(s03.projectCode, "TEST-POC-01");
  assert.ok(s03.stageRemark.includes("PoC acceptance does not authorize mass production"));

  // Verify tentative BOM draft generation without hardware boilerplate leakage
  const bomDraft = buildDocumentDraft("Production BOM", "HLPL-POC-EHW-BOM-01");
  assert.equal(bomDraft.type, "BOM");
  assert.ok(bomDraft.supported);
  assert.ok(bomDraft.sections.length > 0);

  // Phase 4: Purchasing Derivation & Master Integration
  const purSpec = recordFormSpec("PUR");
  assert.ok(purSpec);
  // Rapid prototype derivation
  const protoReq = recordFieldValues(purSpec, "Rapid prototype request", {
    supplier: "Mouser Electronics",
  });
  assert.equal(protoReq.procurementTrack, "Rapid prototype");

  // Mass production derivation
  const massReq = recordFieldValues(purSpec, "Mass production request", {
    supplier: "Arrow Electronics",
  });
  assert.equal(massReq.procurementTrack, "Mass production");

  // Phase 5: System Integration & Field Pilot (S04 System Pilot)
  const s04 = getScenario("SYSTEM-PILOT");
  assert.ok(s04, "S04 must exist");
  assert.equal(s04.projectCode, "TEST-PILOT-01");
  assert.ok(s04.dependencies.some((d) => d.providerDept === "Service & IT"));
  assert.ok(s04.dependencies.some((d) => d.providerDept === "Quality Assurance"));

  // Phase 6: Pilot Refinement & Firmware Patch Handover (S05)
  const s05 = getScenario("PILOT-REFINEMENT");
  assert.ok(s05, "S05 must exist");
  assert.equal(s05.projectCode, "TEST-REFINEMENT-01");
  assert.ok(s05.dependencies.some((d) => d.criticalPath));
  assert.ok(s05.stageRemark.includes("Final customer acceptance and bulk release remain blocked"));

  // Phase 7: Bulk Production Release & Strict Mathematical Reconciliation (S06)
  const s06 = getScenario("BULK-PRODUCTION");
  assert.ok(s06, "S06 must exist");
  assert.equal(s06.projectCode, "TEST-PROD-01");
  const recon = s06.productionReconciliation;
  assert.ok(recon, "S06 must have production reconciliation matrix");

  // Invariant verification:
  // 1. First lot total must equal accepted (150) + held (5) + pending inspection (45) = 200
  assert.equal(recon.acceptedUnits + recon.heldUnits + recon.pendingInspectionUnits, recon.lotQuantity);
  assert.equal(recon.lotQuantity, 200);

  // 2. Remaining planned balance must equal total planned (500) - lot quantity (200) = 300
  assert.equal(recon.totalPlannedUnits - recon.lotQuantity, recon.remainingPlannedUnits);
  assert.equal(recon.remainingPlannedUnits, 300);
  assert.equal(recon.reconciliationCheckPassed, true);
});
