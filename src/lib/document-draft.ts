export type DraftSource = {
  reference: string;
  fields: Record<string, string>;
  notes?: string | undefined;
  attachments?: AttachmentMeta[] | undefined;
};

const wordDraftTypes = new Set(["SOR", "REVIEW", "QUO", "PRS", "EHW-PRS"]);

export function supportsDraftDocx(type: string | undefined) {
  return !!type && wordDraftTypes.has(type);
}

export type Section = { title: string; fields: string[] };

export type AttachmentMeta = {
  filename: string;
  format: string; // e.g. "STEP", "PCBDoc", "Gerber ZIP", "BIN/HEX", "PDF"
  sizeBytes: number;
  sha256: string;
  uploadedAt: string;
  uploaderName: string;
};

export type PersistedDocumentDraftSnapshot = {
  templateType: string | null;
  templateVersion: string;
  catalogueFamilyId: string | null;
  sourceRecordId: string | null;
  projectRecordId: string | null;
  sourceReference?: string | null;
  projectReference?: string | null;
  projectPhase?: string | null;
  projectStage?: string | null;
  classification?: string;
  releaseStatus: "Unissued";
  completionPercentage: number;
  missingFields: string[];
  sections: { title: string; rows: string[][] }[];
};

export const CATALOGUE_FAMILY_MAP: Record<string, string> = {
  ENQ: "D03", SOR: "D04", REVIEW: "D05", QUO: "D06", NDA: "D07",
  "EHW-PRS": "D08", "FW-FRS": "D08", "SW-SRS": "D08", "MECH-MRS": "D08",
  "PUR-SRS": "D08", "QA-QRS": "D08", "EMF-MPR": "D08", "MMF-MPR": "D08",
  "FIN-CFS": "D08", "SIT-SRS": "D08", "HROPS-CRS": "D08", PRS: "D08",
  BOM: "D11", DFMEA: "D12", DVP: "D13", ECR: "D14", ECO: "D14",
  PPAP: "D19", PSW: "D19", PFMEA: "D22", CP: "D22",
  PDI: "D23", "8D": "D25", NCR: "D25", INV: "D26", SKILL: "D27",
};

export const DOCUMENT_FORMATS: Record<string, Section[]> = {
  // Commercial & Customer Intake
  ENQ: [
    { title: "Customer & enquiry intake", fields: ["customer", "opportunity", "scope", "targetQuantity", "targetSOP"] },
    { title: "Commercial & technical feasibility", fields: ["targetPrice", "specRequirements", "leadTime", "reviewer", "status"] },
  ],
  SOR: [
    { title: "Customer scope", fields: ["customer", "scope", "quantity", "targetDate"] },
    { title: "Requirements and acceptance", fields: ["requirements", "interfaces", "acceptanceCriteria", "constraints"] },
  ],
  NDA: [
    { title: "Parties and purpose", fields: ["parties", "purpose", "effectiveDate"] },
    { title: "Confidentiality and execution", fields: ["obligations", "exclusions", "term", "governingLaw", "executionEvidence"] },
  ],
  QUO: [
    { title: "Commercial offer", fields: ["customer", "lineItems", "quantity", "currency", "unitPrice", "toolingCost"] },
    { title: "Terms and validity", fields: ["taxBasis", "paymentTerms", "leadTime", "validUntil", "exclusions"] },
  ],
  REVIEW: [
    { title: "Feasibility review", fields: ["requirements", "technicalFeasibility", "capacity", "sourcing", "costImpact", "scheduleImpact"] },
    { title: "Decision and actions", fields: ["risks", "actions", "decision", "reviewEvidence"] },
  ],

  // Process 01 Domain Requirements Specifications Across 12 Departments
  PRS: [
    { title: "Requirements baseline", fields: ["scope", "requirements", "architecture", "interfaces"] },
    { title: "Design limits and verification", fields: ["voltage", "temperatureRange", "environmental", "compliance", "acceptanceCriteria", "verificationLinks"] },
  ],
  "EHW-PRS": [
    { title: "Hardware requirements baseline", fields: ["scope", "voltage", "mcuTarget", "powerArchitecture", "inputVoltageRange", "currentConsumption"] },
    { title: "Interfaces & environmental limits", fields: ["canInterfaces", "linInterfaces", "analogInputs", "digitalOutputs", "operatingTemperature", "ipRating", "complianceStandards"] },
  ],
  "FW-FRS": [
    { title: "Microcontroller & RTOS architecture", fields: ["targetMcu", "coreClock", "flashPartitioning", "ramAllocation", "rtosKernel", "halDrivers"] },
    { title: "Protocols, diagnostics & FOTA security", fields: ["canJ1939Stack", "udsDiagnostics", "bootloaderSecurity", "dualBankFota", "failsafeRecovery", "verificationEvidence"] },
  ],
  "SW-SRS": [
    { title: "Telematics protocol & cloud ingestion", fields: ["telematicsProtocol", "ais140Annexure8", "mqttEndpoints", "protobufSchemas", "ingestionApi"] },
    { title: "Mobile & desktop application interfaces", fields: ["bleCompanionApp", "sensorGattServices", "desktopDiagnosticGui", "dataEncryption", "acceptanceCriteria"] },
  ],
  "MECH-MRS": [
    { title: "Enclosure specifications & packaging", fields: ["dimensions", "enclosureMaterial", "wallThickness", "mountingPattern", "connectorApertures"] },
    { title: "Environmental, thermal & ingress protection", fields: ["ipRating", "gasketSpecification", "thermalDissipation", "vibrationProfile", "shockResistance", "verificationLinks"] },
  ],
  "PUR-SRS": [
    { title: "Component sourcing & ASL matrix", fields: ["criticalComponents", "aslSuppliers", "leadTimes", "singleSourceRisks", "minimumOrderQty"] },
    { title: "Cost targets & lifecycle obsolescence", fields: ["targetBOMCost", "alternateComponents", "pcnTracking", "eopProtection", "sourcingStatus"] },
  ],
  "QA-QRS": [
    { title: "Quality assurance & PPM targets", fields: ["customerPpmTarget", "internalQualityGoal", "applicableStandards", "ais004Compliance", "cispr25EmcLevel"] },
    { title: "DVP&R matrix & lab testing scope", fields: ["testAgencies", "sampleSize", "testSchedule", "environmentalTesting", "qualityGateOwner"] },
  ],
  "EMF-MPR": [
    { title: "Electronics manufacturing & box-build scope", fields: ["pcbaReceiptVerification", "enclosureIntegration", "harnessRouting", "firmwareFlashingJig", "functionalTestingRig"] },
    { title: "Quality controls, ESD & packaging", fields: ["esdControls", "aoiInspection", "travelerTracking", "boxBuildLabeling", "packagingSpec"] },
  ],
  "MMF-MPR": [
    { title: "Mechanical manufacturing & tooling spec", fields: ["toolingMoldSpec", "cncMachiningTolerances", "sheetMetalFabrication", "surfaceFinishingAnodizing"] },
    { title: "Dimensional inspection & subassembly", fields: ["firstPieceInspection", "cmmInspectionCriteria", "mechanicalSubassembly", "fitChecks"] },
  ],
  "FIN-CFS": [
    { title: "Product financial feasibility & BOM costing", fields: ["targetBOMCost", "pcbaAssemblyCost", "boxBuildLaborCost", "logisticsPackagingCost", "totalUnitCost"] },
    { title: "Commercial margin & payback analysis", fields: ["targetSellingPrice", "grossMarginPercent", "toolingNreCost", "breakEvenVolume", "paybackPeriod"] },
  ],
  "SIT-SRS": [
    { title: "Cloud infrastructure & field service scope", fields: ["serverArchitecture", "databaseThroughput", "fieldDiagnosticTools", "simCardCarrierMno"] },
    { title: "Service SLA & operational reliability", fields: ["uptimeTarget", "otaRolloutStrategy", "customerSupportSLA", "disasterRecoveryPlan"] },
  ],
  "HROPS-CRS": [
    { title: "Workforce capacity & safety readiness", fields: ["requiredEngineeringHeadcount", "trainingNeedsTNI", "esdSafetyCertification", "shopfloorWorkstationReadiness"] },
    { title: "Compliance, competency & gate review", fields: ["operatorCertification", "safetyAudits", "hropsReviewer", "gateReadinessEvidence"] },
  ],

  // Engineering & Risk Specifications
  BOM: [
    { title: "Controlled bill of materials", fields: ["bomRevision", "lineItems", "mpn", "manufacturer", "quantity", "unit"] },
    { title: "Sourcing and cost", fields: ["alternates", "qualificationEvidence", "unitCost", "currency", "leadTime"] },
  ],
  DFMEA: [
    { title: "Design risk analysis", fields: ["function", "failureMode", "effect", "cause", "preventionControls", "detectionControls"] },
    { title: "Assessment and actions", fields: ["methodVersion", "severity", "occurrence", "detection", "actionPriority", "actions", "actionOwner", "verificationEvidence"] },
  ],
  PFMEA: [
    { title: "Process function & failure modes", fields: ["processStep", "itemFunction", "potentialFailureMode", "potentialFailureEffect", "potentialCause"] },
    { title: "Process risk evaluation & actions", fields: ["severity", "occurrence", "detection", "actionPriority", "preventionControl", "detectionControl", "correctiveAction", "actionOwner"] },
  ],
  CP: [
    { title: "Process control", fields: ["processStep", "machine", "characteristic", "specification", "measurementMethod"] },
    { title: "Sampling and reaction", fields: ["sampleSize", "frequency", "reactionPlan", "owner", "evidence"] },
  ],
  DVP: [
    { title: "Verification plan", fields: ["requirementId", "testId", "method", "standardVersion", "testConditions", "sampleConfiguration", "acceptanceCriteria"] },
    { title: "Actual results", fields: ["plannedDate", "actualDate", "measuredResult", "testEvidence", "disposition"] },
  ],
  PDI: [
    { title: "Inspection scope", fields: ["batch", "serialRange", "quantity", "configuration", "testRig", "calibrationEvidence"] },
    { title: "Inspection results", fields: ["checks", "acceptanceCriteria", "measuredResult", "failures", "rework", "releaseEvidence"] },
  ],

  // Quality, Change & Statutory Subtypes
  PPAP: [
    { title: "PPAP submission dossier", fields: ["partNumber", "partName", "revision", "submissionLevel", "designRecords", "engineeringChangeDocuments"] },
    { title: "Verification & warrant documents", fields: ["dfmeaReference", "pfmeaReference", "controlPlanReference", "dimensionalResults", "materialPerformanceResults", "pswReference"] },
  ],
  PSW: [
    { title: "Part submission warrant", fields: ["partNumber", "partName", "drawingNumber", "revision", "supplierName", "manufacturingLocation", "submissionLevel"] },
    { title: "Declaration & disposition", fields: ["explanationComment", "supplierAuthorizedSignature", "customerDisposition", "customerRepresentative"] },
  ],
  "8D": [
    { title: "8D Problem description & containment", fields: ["d1Team", "d2ProblemStatement", "d3ContainmentAction", "containmentVerification"] },
    { title: "Root cause, corrective & preventive actions", fields: ["d4RootCause5Why", "d5PermanentCorrectiveAction", "d6ValidationEvidence", "d7PreventRecurrence", "d8TeamRecognition", "closureDate"] },
  ],
  NCR: [
    { title: "Non-conformance report", fields: ["ncrNumber", "itemCode", "batchSerial", "defectDescription", "quantityAffected", "detectedAtStage", "reportedBy"] },
    { title: "Disposition & rework", fields: ["disposition", "reworkProcedure", "scrapAuthorized", "mrBReviewer", "verificationEvidence"] },
  ],
  ECR: [
    { title: "Engineering change request", fields: ["ecrNumber", "changeTitle", "requestedBy", "reasonForChange", "affectedSystems", "priority"] },
    { title: "Engineering impact assessment", fields: ["hardwareImpact", "firmwareImpact", "softwareImpact", "costImpact", "scheduleImpact", "changeReviewBoardDecision"] },
  ],
  ECO: [
    { title: "Engineering change order", fields: ["ecoNumber", "approvedEcrReference", "effectiveDate", "effectiveSerialRange", "dispositionExistingStock"] },
    { title: "Implementation & sign-off", fields: ["updatedDrawings", "updatedBOMRev", "updatedFirmwareRev", "leadSignOff", "closureSignOff"] },
  ],

  // Operations & Finance
  INV: [
    { title: "Invoice parties and references", fields: ["seller", "buyer", "consignee", "orderReference", "dispatchReference"] },
    { title: "Invoice calculation", fields: ["lineItems", "quantity", "unitPrice", "currency", "taxClassification", "taxRate", "taxAmount", "total", "paymentTerms"] },
  ],
  SKILL: [
    { title: "Competency assessment", fields: ["employee", "role", "skill", "requiredLevel", "observedLevel", "assessor", "assessmentEvidence"] },
    { title: "Training and review", fields: ["gap", "trainingPlan", "dueDate", "reassessment"] },
  ],
};

export const CLIENT_DELIVERABLE_TYPES = new Set(["QUO", "NDA", "PDI", "PSW", "INV"]);

/** Explicit aliases are compatibility inputs; arbitrary substrings never select a template. */
export const DOCUMENT_TEMPLATE_VERSION = "2026-10-19.2";

export const DOCUMENT_TEMPLATE_REGISTRY = Object.fromEntries(
  Object.keys(DOCUMENT_FORMATS).map((type) => [
    type,
    {
      type,
      version: DOCUMENT_TEMPLATE_VERSION,
      classification: CLIENT_DELIVERABLE_TYPES.has(type) ? "Client deliverable" : "Internal engineering document",
      releaseStatus: "Unissued",
      reviewRequired: true,
      sections: DOCUMENT_FORMATS[type],
    },
  ])
);

export function draftType(title: string, id: string, explicitType?: string): string | undefined {
  if (explicitType !== undefined) {
    const norm = explicitType.toUpperCase().trim();
    return Object.hasOwn(DOCUMENT_FORMATS, norm) ? norm : undefined;
  }

  const value = `${title} ${id}`.toUpperCase();
  const tokens = value.split(/[^A-Z0-9]+/).filter(Boolean);

  // Exact token match (e.g. BOM, SOR, QUO, INV, SKILL, DVP, CP, PDI)
  const matches: string[] = Object.keys(DOCUMENT_FORMATS).filter((type) => tokens.includes(type));

  // Hyphenated and composite domain requirement specifications (Process 01 across departments)
  if (value.includes("EHW-PRS") || (tokens.includes("EHW") && tokens.includes("PRS")) || /PRODUCT REQUIREMENT SPEC/.test(value)) matches.push("EHW-PRS");
  if (value.includes("FW-FRS") || (tokens.includes("FW") && (tokens.includes("FRS") || tokens.includes("FIRMWARE"))) || /FIRMWARE.*REQUIREMENT/.test(value)) matches.push("FW-FRS");
  if (value.includes("SW-SRS") || (tokens.includes("SW") && (tokens.includes("SRS") || tokens.includes("SOFTWARE"))) || /CLOUD.*SOFTWARE.*REQUIREMENT/.test(value)) matches.push("SW-SRS");
  if (value.includes("MECH-MRS") || (tokens.includes("MECH") && (tokens.includes("MRS") || tokens.includes("MECHANICAL"))) || /MECHANICAL.*REQUIREMENT/.test(value)) matches.push("MECH-MRS");
  if (value.includes("PUR-SRS") || (tokens.includes("PUR") && (tokens.includes("SRS") || tokens.includes("SOURCING"))) || /COMPONENT SOURCING/.test(value)) matches.push("PUR-SRS");
  if (value.includes("QA-QRS") || (tokens.includes("QA") && (tokens.includes("QRS") || tokens.includes("QUALITY"))) || /QUALITY.*REQUIREMENT/.test(value)) matches.push("QA-QRS");
  if (value.includes("EMF-MPR") || (tokens.includes("EMF") && (tokens.includes("MPR") || tokens.includes("PRODUCTION"))) || /ELECTRONICS MFG/.test(value)) matches.push("EMF-MPR");
  if (value.includes("MMF-MPR") || (tokens.includes("MMF") && (tokens.includes("MPR") || tokens.includes("TOOLING"))) || /MECHANICAL MFG/.test(value)) matches.push("MMF-MPR");
  if (value.includes("FIN-CFS") || (tokens.includes("FIN") && (tokens.includes("CFS") || tokens.includes("FINANCIAL"))) || /FINANCIAL FEASIBILITY/.test(value)) matches.push("FIN-CFS");
  if (value.includes("SIT-SRS") || value.includes("SIT-E2E") || (tokens.includes("SIT") && (tokens.includes("SRS") || tokens.includes("E2E") || tokens.includes("INTEGRATION"))) || /SYSTEM INTEGRATION/.test(value)) matches.push("SIT-SRS");
  if (value.includes("HROPS-CRS") || ((tokens.includes("HROPS") || tokens.includes("HR")) && tokens.includes("CRS")) || /CAPACITY.*COMPETENCY/.test(value)) matches.push("HROPS-CRS");
  if (value.includes("PCB-CAM") || (tokens.includes("PCB") && (tokens.includes("CAM") || tokens.includes("FABRICATION")))) matches.push("PCB-CAM");
  if (value.includes("STE-FCT") || (tokens.includes("STE") && (tokens.includes("FCT") || tokens.includes("TEST")))) matches.push("STE-FCT");

  // Distinct controlled subtypes
  if (tokens.includes("DFMEA") || /DESIGN FAILURE|DESIGN FMEA/.test(value)) matches.push("DFMEA");
  if (tokens.includes("PFMEA") || /PROCESS FAILURE|PROCESS FMEA/.test(value)) matches.push("PFMEA");
  if (tokens.includes("PSW") || /SUBMISSION WARRANT/.test(value)) matches.push("PSW");
  if (tokens.includes("PPAP") || /PRODUCTION PART APPROVAL/.test(value)) matches.push("PPAP");
  if (tokens.includes("8D") || /EIGHT DISCIPLINE|CORRECTIVE ACTION/.test(value)) matches.push("8D");
  if (tokens.includes("NCR") || /NONCONFORMANCE|NON-CONFORMANCE/.test(value)) matches.push("NCR");
  if (tokens.includes("ECR") || /CHANGE REQUEST/.test(value)) matches.push("ECR");
  if (tokens.includes("ECO") || /CHANGE ORDER/.test(value)) matches.push("ECO");

  // Common aliases and standard forms
  if (tokens.includes("MNDA")) matches.push("NDA");
  if (/CONTRACT REVIEW|MKT\/01/.test(value)) matches.push("REVIEW");
  if (/SKILL MATRIX|HR\/03/.test(value)) matches.push("SKILL");
  if (/PRE.DISPATCH|PRE.DELIVERY/.test(value)) matches.push("PDI");
  if (/CONTROL PLAN/.test(value)) matches.push("CP");
  if (/REQUIREMENT SPEC/.test(value) && matches.length === 0) matches.push("PRS");

  let filtered = matches;
  if (filtered.includes("EHW-PRS")) {
    filtered = filtered.filter((m) => m !== "PRS");
  }

  const unique = Array.from(new Set(filtered));
  return unique.length === 1 ? unique[0] : undefined;
}

/** Values are copied from a referenced source, never inferred from a product family. */
export function buildDocumentDraft(
  title: string,
  id: string,
  source?: DraftSource,
  project?: DraftSource,
  explicitType?: string
) {
  const type = draftType(title, id, explicitType);
  const sections = type ? DOCUMENT_FORMATS[type] : undefined;
  const isClient = type ? CLIENT_DELIVERABLE_TYPES.has(type) : false;
  const catalogueFamilyId = type ? (CATALOGUE_FAMILY_MAP[type] ?? null) : null;

  const allFields = (sections ?? []).flatMap((section) => section.fields);
  const missingFields = allFields.filter(
    (field) =>
      !source?.fields[field]?.trim() &&
      !(["customer", "quantity", "targetDate"].includes(field) && project?.fields[field]?.trim())
  );

  const populatedCount = allFields.length - missingFields.length;
  const completionPercentage = allFields.length > 0 ? Math.round((populatedCount / allFields.length) * 100) : 0;

  return {
    type,
    templateVersion: DOCUMENT_TEMPLATE_VERSION,
    catalogueFamilyId,
    isClientDeliverable: isClient,
    completionPercentage,
    missingFields,
    attachments: source?.attachments ?? [],
    snapshot: {
      templateType: type ?? null,
      templateVersion: DOCUMENT_TEMPLATE_VERSION,
      catalogueFamilyId,
      source: source ? { ...source, fields: { ...source.fields }, attachments: source.attachments ? [...source.attachments] : [] } : null,
      project: project ? { ...project, fields: { ...project.fields } } : null,
      releaseStatus: "Unissued",
      classification: isClient ? "Client deliverable — release and access require explicit authorization" : "Internal engineering document — internal confidential",
    },
    supported: Boolean(sections),
    sections: (sections ?? [{ title: "Source document", fields: ["scope", "requirements", "evidence"] }]).map((section) => ({
      title: section.title,
      rows: section.fields.map((field) => {
        const own = source?.fields[field]?.trim();
        // Only shared identification fields may come from a project record.
        const baseline = ["customer", "quantity", "targetDate"].includes(field) ? project?.fields[field]?.trim() : undefined;
        return [
          field,
          own || baseline || "TBD — owner confirmation required",
          own ? source!.reference : baseline ? project!.reference : "No source provided",
        ];
      }),
    })),
  };
}

/** Rehydrates the exact stored field/provenance rows for preview; it never rereads mutable source records. */
export function restoreDocumentDraftSnapshot(snapshot: PersistedDocumentDraftSnapshot) {
  const type = snapshot.templateType && Object.hasOwn(DOCUMENT_FORMATS, snapshot.templateType) ? snapshot.templateType : undefined;
  if (!type || !snapshot.templateVersion || snapshot.releaseStatus !== "Unissued" || !Array.isArray(snapshot.sections)) return undefined;
  const sections = snapshot.sections.filter(section =>
    typeof section.title === "string" && Array.isArray(section.rows) && section.rows.every(row => Array.isArray(row) && row.length >= 2 && row.every(value => typeof value === "string"))
  ).map(section => ({ title: section.title, rows: section.rows.map(row => [row[0] ?? "", row[1] ?? "", row[2] ?? ""]) }));
  if (sections.length !== snapshot.sections.length) return undefined;
  const isClientDeliverable = CLIENT_DELIVERABLE_TYPES.has(type);
  return {
    type,
    templateVersion: snapshot.templateVersion,
    catalogueFamilyId: snapshot.catalogueFamilyId,
    isClientDeliverable,
    completionPercentage: snapshot.completionPercentage,
    missingFields: [...snapshot.missingFields],
    attachments: [] as AttachmentMeta[],
    supported: true,
    snapshot: {
      templateType: type,
      templateVersion: snapshot.templateVersion,
      catalogueFamilyId: snapshot.catalogueFamilyId,
      source: snapshot.sourceReference ? { reference: snapshot.sourceReference, fields: {}, attachments: [] } : null,
      project: snapshot.projectReference ? {
        reference: snapshot.projectReference,
        fields: {
          ...(snapshot.projectPhase ? { companyPhase: snapshot.projectPhase } : {}),
          ...(snapshot.projectStage ? { currentStage: snapshot.projectStage } : {}),
        },
      } : null,
      releaseStatus: "Unissued" as const,
      classification: snapshot.classification || (isClientDeliverable ? "Client deliverable — release and access require explicit authorization" : "Internal engineering document — internal confidential"),
    },
    sections,
  };
}
