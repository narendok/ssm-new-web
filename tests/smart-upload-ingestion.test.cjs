const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadSource(name) {
  const filePath = path.join(__dirname, `../src/lib/${name}.ts`);
  const compiled = ts.transpileModule(
    fs.readFileSync(filePath, "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const loaded = { exports: {} };
  new Function(
    "module",
    "exports",
    "require",
    compiled,
  )(loaded, loaded.exports, (imported) => {
    if (imported.startsWith("./")) {
      return loadSource(imported.slice(2));
    }
    return require(imported);
  });
  return loaded.exports;
}

const {
  extractDocumentContent,
  parseDelimitedText,
} = loadSource("document-ingestion-extractor");

const {
  resolveProjectEntity,
  resolveSupplierEntity,
  resolveCustomerEntity,
  resolveAllEntities,
} = loadSource("document-canonical-matching");

const {
  ROLE_USE_CASE_PROFILES,
  getProfilesForRole,
} = loadSource("document-ingestion-profiles");

const {
  prepareUploadDraft,
  CATALOGUE_FAMILY_BY_UPLOAD_TYPE,
  UPLOAD_TYPES,
} = loadSource("document-upload-pilot");
const { roleProfileAvailableToDepartment, smartUploadChoiceAvailable, smartUploadChoiceDepartment, uploadProfileDepartment } = loadSource("smart-upload-access");

// ============================================================================
// PHASE 1: One intake entry, 25 role profiles, and correct destinations
// ============================================================================
test("Phase 1: 25 Portal Roles are covered with valid use-case profiles and catalogue families", () => {
  assert.ok(ROLE_USE_CASE_PROFILES.length >= 25, "Must define at least 25 role use-case profiles");
  
  const expectedRoles = [
    "FAC", "QA", "MECH_DES", "MECH_MFG", "SIT", "PUR", "STR", "DSP",
    "SAL", "EHW", "FW", "SW_BE", "SW_FE", "SW_APP", "EMF", "TST",
    "FIN", "OPS", "PM", "HR", "LEG", "DOC_CTRL", "ADMIN", "CLIENT", "RND",
  ];
  
  for (const role of expectedRoles) {
    const profiles = getProfilesForRole(role);
    assert.ok(profiles.length > 0, `Role ${role} must have at least one defined use-case profile`);
    for (const p of profiles) {
      assert.ok(p.id, `Profile in ${role} must have an ID`);
      assert.ok(p.title, `Profile in ${role} must have a title`);
      assert.ok(p.acceptedExtensions.length > 0, `Profile ${p.id} must define accepted extensions`);
      assert.match(p.catalogueFamilyId, /^D\d{2}$/, `Profile ${p.id} must map to a D01-D38 catalogue family`);
    }
  }
});

test("Smart Upload role profiles and standard routes stay inside the signed-in department",()=>{
  assert.equal(roleProfileAvailableToDepartment({roleCode:"PUR"},"EHW",false),false);
  assert.equal(roleProfileAvailableToDepartment({roleCode:"PUR"},"PUR",false),true);
  assert.equal(roleProfileAvailableToDepartment({roleCode:"MECH_DES"},"MECH",false),true);
  assert.equal(roleProfileAvailableToDepartment({roleCode:"MECH_MFG"},"MECH",false),false);
  assert.equal(roleProfileAvailableToDepartment({roleCode:"FAC"},"HR",false),false,"unmapped role scopes fail closed for employees");
  assert.equal(roleProfileAvailableToDepartment({roleCode:"FAC"},null,true),true,"Admin may inspect profiles and explicitly choose an owner");
  assert.equal(smartUploadChoiceAvailable("quotation","EHW",false),false);
  assert.equal(smartUploadChoiceAvailable("quotation","PUR",false),true);
  assert.equal(smartUploadChoiceAvailable("invoice","PUR",false),false);
  assert.equal(smartUploadChoiceAvailable("invoice","FIN",false),true);
  assert.equal(smartUploadChoiceAvailable("sor","PUR",false),false);
  assert.equal(smartUploadChoiceAvailable("sor","SAL",false),true);
  assert.equal(smartUploadChoiceAvailable("invoice","EHW",true),true);
  assert.equal(smartUploadChoiceDepartment("quotation","PUR"),"PUR");
  assert.equal(uploadProfileDepartment("TST"),"EMF");
});

test("Phase 1: SmartUploadHub dialog contains both standard workflows and role-specific intake", () => {
  const component = fs.readFileSync(
    path.resolve(__dirname, "../src/components/SmartUploadHub.tsx"),
    "utf8",
  );
  assert.match(component, /Standard Workflows/);
  assert.match(component, /Role Profiles \(\{departmentProfiles\.length\}\)/);
  assert.doesNotMatch(component, /Role Profiles \(25 Roles\)/);
  assert.match(component, /Customer SOR \/ requirements/);
  assert.match(component, /Project BOM \/ parts list/);
  assert.match(component, /Supplier quotation/);
  assert.match(component, /Supplier invoice/);
  assert.match(component, /Goods receipt \/ delivery evidence/);
  assert.match(component, /Guarded Intake Boundary/);
});

// ============================================================================
// PHASE 2: Safe file intake, tabular extraction & provenance
// ============================================================================
test("Phase 2: Tabular CSV extraction captures rows, columns, and cell-level provenance", async () => {
  const sampleCsv = `MPN,Description,Qty,Rate,Vendor\nSTM32F405RGT6,MCU 32-bit ARM Cortex-M4,500,285.50,STMicroelectronics\nTPS62130RGTR,Step-Down Converter,1000,42.10,Texas Instruments`;
  
  const result = await extractDocumentContent({
    fileName: "sourcing_bom.csv",
    fileSize: sampleCsv.length,
    fileType: "text/csv",
    textBuffer: sampleCsv,
    uploadType: "BOM",
  });

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.lineItems.length, 2);
  assert.equal(result.lineItems[0].mpn, "STM32F405RGT6");
  assert.equal(result.lineItems[0].quantity, 500);
  assert.equal(result.lineItems[0].provenance.sourceFile, "sourcing_bom.csv");
  assert.equal(result.lineItems[0].provenance.row, 2);
  assert.equal(result.lineItems[1].mpn, "TPS62130RGTR");
  assert.equal(result.lineItems[1].provenance.row, 3);
  assert.equal(result.detectedEntities.supplierName, "STMicroelectronics");
});

test("Phase 2: JSON extraction safely extracts key-value paths without script execution", async () => {
  const sampleJson = JSON.stringify({
    quoteNumber: "Q-2026-TI-098",
    vendor: "Texas Instruments",
    project: "HLPL-SLCT-01",
    currency: "INR",
    totalAmount: 250000,
  });

  const result = await extractDocumentContent({
    fileName: "quotation.json",
    fileSize: sampleJson.length,
    fileType: "application/json",
    textBuffer: sampleJson,
    uploadType: "QUOTE",
  });

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.detectedEntities.projectReference, "HLPL-SLCT-01");
  assert.equal(result.detectedEntities.supplierName, "Texas Instruments");
  assert.ok(result.extractedFields.some(f => f.key === "quoteNumber" && f.value === "Q-2026-TI-098"));
});

test("Phase 2: Binary files (PDF, ZIP, STEP) fall back to safe manual review without faking OCR", async () => {
  const binaryPayload = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
  
  const result = await extractDocumentContent({
    fileName: "AIS140_TAC_Certificate_HLPL-SLCT-01.pdf",
    fileSize: 45200,
    fileType: "application/pdf",
    binaryBuffer: binaryPayload.buffer,
    uploadType: "CERT",
  });

  assert.equal(result.status, "MANUAL_REVIEW");
  assert.match(result.summaryMessage, /manual review/i);
  assert.equal(result.detectedEntities.projectReference, "HLPL-SLCT-01");
  assert.ok(result.checksum.length === 64, "Must compute valid SHA-256 digest for binary files");
  assert.ok(result.warnings.some(w => w.includes("Binary format")));
});

test("Phase 2: Empty (0 bytes) and oversized (>25MB) files fail safely with clear errors", async () => {
  const emptyResult = await extractDocumentContent({
    fileName: "empty.csv",
    fileSize: 0,
    fileType: "text/csv",
    uploadType: "BOM",
  });
  assert.equal(emptyResult.status, "ERROR");
  assert.match(emptyResult.warnings[0], /empty/i);

  const oversizeResult = await extractDocumentContent({
    fileName: "huge.zip",
    fileSize: 30 * 1024 * 1024,
    fileType: "application/zip",
    uploadType: "FILE",
  });
  assert.equal(oversizeResult.status, "ERROR");
  assert.match(oversizeResult.warnings[0], /exceeds maximum size/i);
});

// ============================================================================
// PHASE 3: Canonical entity resolution against authorized masters
// ============================================================================
const sampleProjects = [
  { id: "prj-1", reference: "HLPL-SLCT-01", title: "AIS-140 Intelligent 4G Telematics Tracker", archived: false },
  { id: "prj-2", reference: "HLPL-BCU-02", title: "Meridian Fleet Devices Telematics Gateway", archived: false },
  { id: "prj-old", reference: "HLPL-OLD-01", title: "Archived Legacy Project", archived: true },
];

const sampleSuppliers = [
  { id: "sup-1", reference: "HLPL-SUP-TI", name: "Texas Instruments India", status: "Approved" },
  { id: "sup-2", reference: "HLPL-SUP-MURATA", name: "Murata Manufacturing", status: "Approved" },
];

const sampleCustomers = [
  { id: "cus-1", reference: "HLPL-CUS-ORION", title: "Orion Mobility Systems", status: "Active" },
];

test("Phase 3: Exact project reference resolves to EXACT_MATCH without user ambiguity", () => {
  const res = resolveProjectEntity("HLPL-SLCT-01", sampleProjects);
  assert.equal(res.status, "EXACT_MATCH");
  assert.equal(res.matchedId, "prj-1");
  assert.equal(res.matchedReference, "HLPL-SLCT-01");
});

test("Phase 3: Partial or multiple project candidates yield AMBIGUOUS_MATCH and never auto-link", () => {
  const res = resolveProjectEntity("HLPL", sampleProjects);
  assert.equal(res.status, "AMBIGUOUS_MATCH");
  assert.equal(res.matchedId, undefined, "Ambiguous match must never auto-select an ID");
  assert.ok(res.candidates.length >= 2);
  assert.match(res.reason, /disambiguation/i);
});

test("Phase 3: Archived or unlisted projects resolve to NO_MATCH", () => {
  const res = resolveProjectEntity("HLPL-OLD-01", sampleProjects);
  assert.equal(res.status, "NO_MATCH");
  assert.equal(res.matchedId, undefined);
});

test("Phase 3: Supplier and Customer masters resolve exactly or require resolution", () => {
  const supRes = resolveSupplierEntity("Texas Instruments India", sampleSuppliers);
  assert.equal(supRes.status, "EXACT_MATCH");
  assert.equal(supRes.matchedId, "sup-1");

  const unkSup = resolveSupplierEntity("Unknown Vendor Corp", sampleSuppliers);
  assert.equal(unkSup.status, "NO_MATCH");
  assert.equal(unkSup.matchedId, undefined);

  const cusRes = resolveCustomerEntity("Orion Mobility Systems", sampleCustomers);
  assert.equal(cusRes.status, "EXACT_MATCH");
  assert.equal(cusRes.matchedId, "cus-1");
});

test("Phase 3: resolveAllEntities aggregates resolution summary and flags ambiguous matches", () => {
  const summary = resolveAllEntities({
    detectedEntities: {
      projectReference: "HLPL-SLCT-01",
      supplierName: "Partial Vendor",
    },
    projects: sampleProjects,
    suppliers: sampleSuppliers,
    customers: sampleCustomers,
  });

  assert.equal(summary.projectResolution.status, "EXACT_MATCH");
  assert.equal(summary.supplierResolution.status, "NO_MATCH");
  assert.equal(summary.hasUnresolvedEntities, false); // NO_MATCH is not ambiguous; user can create or select
});

// ============================================================================
// PHASE 4: Review, validation & guarded save interlocks
// ============================================================================
test("Phase 4: prepareUploadDraft enforces strict interlocks — NEVER auto-approves, adjusts stock, or issues PO", () => {
  const draft = prepareUploadDraft({
    metadata: {
      title: "Supplier Quotation - Power Modules",
      type: "QUOTE",
      scope: "internal",
      projectId: "prj-1",
      departmentId: "pur",
      revision: "01",
      sourceDocumentId: "",
    },
    file: { name: "quote_ti_2026.pdf", size: 120400, type: "application/pdf" },
    projects: sampleProjects,
    departments: [
      { id: "pur", code: "PUR", name: "Purchasing", active: true },
    ],
    sourcePackages: [],
    actor: { id: "user-1", kind: "lead", name: "Avery Lead", departmentId: "pur" },
    documentId: "doc-uuid-1",
    fileId: "file-uuid-1",
    checksum: "b".repeat(64),
    timestamp: "2026-11-15T12:00:00Z",
  });

  assert.equal(draft.lifecycle, "Draft", "Uploaded document must always be Draft");
  assert.equal(draft.classification, "Internal");
  assert.equal(draft.approved, false, "Upload must NEVER set approved to true");
  assert.equal(draft.customerReleased, false, "Upload must NEVER set customerReleased to true");
  assert.equal(draft.inventoryAdjusted, false, "Upload must NEVER adjust inventory");
  assert.equal(draft.poCreated, false, "Upload must NEVER create purchase order");
  assert.equal(draft.gateAdvanced, false, "Upload must NEVER advance lifecycle gate");
  assert.equal(draft.catalogueFamilyId, "D18", "Quotation must map to catalogue D18");
  assert.equal(draft.localFiles[0].checksum, "b".repeat(64));
});

test("Phase 4: Duplicate or unhashed binary submissions are rejected", () => {
  assert.throws(
    () =>
      prepareUploadDraft({
        metadata: {
          title: "Test",
          type: "FILE",
          scope: "common",
          projectId: "",
          departmentId: "pur",
          revision: "01",
          sourceDocumentId: "",
        },
        file: { name: "test.pdf", size: 100, type: "application/pdf" },
        projects: sampleProjects,
        departments: [{ id: "pur", code: "PUR", name: "Purchasing", active: true }],
        sourcePackages: [],
        actor: { id: "user-1", kind: "lead", name: "Avery", departmentId: "pur" },
        documentId: "d1",
        fileId: "f1",
        checksum: "invalid-hash",
        timestamp: "2026-11-15T12:00:00Z",
      }),
    /SHA-256 checksum/,
  );
});

// ============================================================================
// PHASE 5: Document families (D01-D38) & Role Docs Vault indexing
// ============================================================================
test("Phase 5: Every upload type maps to a recognized catalogue family (D01-D38)", () => {
  for (const t of UPLOAD_TYPES) {
    const family = CATALOGUE_FAMILY_BY_UPLOAD_TYPE[t.id];
    assert.ok(family, `Upload type ${t.id} must map to a catalogue family`);
    assert.match(family, /^D\d{2}$/, `Family ${family} must be in format D01-D38`);
  }
  assert.equal(CATALOGUE_FAMILY_BY_UPLOAD_TYPE.SCH, "D10");
  assert.equal(CATALOGUE_FAMILY_BY_UPLOAD_TYPE.PCB, "D10");
  assert.equal(CATALOGUE_FAMILY_BY_UPLOAD_TYPE.BOM, "D08");
  assert.equal(CATALOGUE_FAMILY_BY_UPLOAD_TYPE.QUOTE, "D18");
  assert.equal(CATALOGUE_FAMILY_BY_UPLOAD_TYPE.INVOICE, "D21");
  assert.equal(CATALOGUE_FAMILY_BY_UPLOAD_TYPE.RECEIPT, "D22");
  assert.equal(CATALOGUE_FAMILY_BY_UPLOAD_TYPE.CERT, "D23");
  assert.equal(CATALOGUE_FAMILY_BY_UPLOAD_TYPE.SOP, "D01");
  assert.equal(CATALOGUE_FAMILY_BY_UPLOAD_TYPE.BRINGUP, "D13");
});

test("Phase 5: SOP and Hardware Bring-Up profiles are explicitly mapped in EHW and DOC_CTRL", () => {
  const ehwProfiles = getProfilesForRole("EHW");
  const bringupSop = ehwProfiles.find((p) => p.id === "ehw_bringup_sop");
  assert.ok(bringupSop, "EHW must have ehw_bringup_sop profile");
  assert.equal(bringupSop.catalogueFamilyId, "D01");
  assert.equal(bringupSop.roleCode, "EHW");

  const bringupReport = ehwProfiles.find((p) => p.id === "ehw_bringup_report");
  assert.ok(bringupReport, "EHW must have ehw_bringup_report profile");
  assert.equal(bringupReport.catalogueFamilyId, "D13");

  const docCtrlProfiles = getProfilesForRole("DOC_CTRL");
  const docSop = docCtrlProfiles.find((p) => p.id === "doc_ctrl_sop_wi");
  assert.ok(docSop, "DOC_CTRL must have doc_ctrl_sop_wi profile");
  assert.equal(docSop.catalogueFamilyId, "D01");
});
