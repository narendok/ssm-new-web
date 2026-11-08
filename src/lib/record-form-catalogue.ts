export type RecordField = { key: string; label: string; required?: boolean; kind?: "text" | "date" | "select"; options?: string[]; master?: "people" | "suppliers" | "parts" | "products" | "customers" | "locations" | "routes" | "documentTypes"; readOnly?: boolean; automaticValue?: string; automaticLabel?: string };
export type RecordFormSpec = { types: string[]; fields: RecordField[]; sourceSpec?:RecordFormSpec };
export type RecordAttachmentSpec = { documentType: string; label: string; accept: string; stageCode: string };
const auditStatuses = ["Draft", "Planned", "Scheduled", "In progress", "Awaiting closure", "Closed", "Overdue"];
const automaticHardwareStages: Record<string, { code: string; label: string }> = {
  PRS: { code: "HW_02", label: "HW_02 · Hardware PRS baseline" },
  "Hardware tracker": { code: "HW_01", label: "HW_01 · Hardware requirement capture" },
  Schematic: { code: "HW_15", label: "HW_15 · Schematic preparation" },
  BOM: { code: "HW_19", label: "HW_19 · Tentative BOM and sourcing analysis" },
  "Gerber release": { code: "HW_24", label: "HW_24 · Prototype fabrication package" },
  "STEP clearance": {code:'HW_17',label:'HW_17 · Enclosure CAD / clearance'},
  "Firmware release": {code:'FW_12',label:'FW_12 · Firmware release candidate'},
  Certificate:{code:'C14',label:'C14 · Official certificate evidence'},
};
export function hardwareStageForRecordType(type: string) {
  const code=type.match(/^Stage evidence · ((?:G\d|HW|FW|SW)_\d{2})$/)?.[1];
  return automaticHardwareStages[type] || (code ? {code,label:`${code} · stage evidence`} : undefined);
}
const hardwareAttachments: Record<string, RecordAttachmentSpec> = {
  PRS: { documentType: "Technical document", label: "PRS original file", accept: ".pdf,.doc,.docx,.xlsx,.csv", stageCode: "HW_02" },
  "Hardware tracker": { documentType: "Technical document", label: "Tracker source file", accept: ".xlsx,.csv,.pdf", stageCode: "HW_01" },
  Schematic: { documentType: "Schematic PDF", label: "Schematic original file", accept: ".pdf,.sch,.kicad_sch,.dsn,.zip,.png,.jpg,.jpeg", stageCode: "HW_15" },
  BOM: { documentType: "BOM", label: "BOM original file", accept: ".xlsx,.csv,.pdf", stageCode: "HW_19" },
  "Gerber release": { documentType: "Gerber ZIP", label: "Gerber package", accept: ".zip", stageCode: "HW_24" },
  "STEP clearance": {documentType:'STEP model',label:'STEP / CAD original file',accept:'.step,.stp,.stl,.3mf,.zip,.pdf',stageCode:'HW_17'},
  "Firmware release": {documentType:'Firmware binary',label:'Firmware original file',accept:'.bin,.hex,.elf,.zip,.pdf',stageCode:'FW_12'},
  Certificate:{documentType:'Certificate',label:'Certificate original file',accept:'.pdf,.zip,.png,.jpg,.jpeg',stageCode:'C14'},
};
export function hardwareAttachmentForRecordType(type: string) {
  const stage=type.startsWith('Stage evidence · ')?hardwareStageForRecordType(type):undefined;
  return hardwareAttachments[type] || (stage ? {documentType:'Technical document',label:'Supporting original file',accept:'.pdf,.doc,.docx,.xlsx,.csv,.zip,.step,.stp,.bin,.hex,.png,.jpg,.jpeg',stageCode:stage.code} : undefined);
}
export function recordAttachmentAllowedAtStage(
  type: string,
  projectStageCode: string,
  canonicalStages: readonly { stageCode: string }[],
): boolean {
  const attachment = hardwareAttachmentForRecordType(type);
  if (!attachment || !projectStageCode) return false;
  const projectStageIndex = canonicalStages.findIndex(stage => stage.stageCode === projectStageCode);
  const attachmentStageIndex = canonicalStages.findIndex(stage => stage.stageCode === attachment.stageCode);
  return projectStageIndex >= 0 && attachmentStageIndex >= 0 &&
    attachmentStageIndex <= projectStageIndex && attachmentStageIndex >= projectStageIndex - 1;
}
const automaticQualityStages: Record<string, string> = {
  "APQP gate": "APQP",
  "DVP&R": "DVP&R",
  IQC: "IQC",
  IPQC: "IPQC",
  FQC: "FQC",
  "8D CAPA": "8D",
  Certificate: "Certificate",
};
export function qualityStageForRecordType(type: string) {
  return automaticQualityStages[type];
}
export const formSpecs: Partial<Record<string, RecordFormSpec>> = {
  home: {
    types: ["Task"],
    fields: [
      { key: "controlledNumber", label: "Task number", required: true },
      { key: "title", label: "Task title", required: true },
      {
        key: "priority",
        label: "Priority",
        required: true,
        kind: "select",
        options: ["Low", "Normal", "High", "Critical"],
      },
      { key: "dueDate", label: "Due date", kind: "date" },
    ],
  },
  rnd: {
    types: ["Project", "Part", "BOM", "Prototype", "Engineering change", "Design review"],
    fields: [
      { key: "controlledNumber", label: "Project code", required: true },
      { key: "title", label: "Project title", required: true },
      {
        key: "category",
        label: "Type / category",
        required: true,
        kind: "select",
        options: ["New product", "Variant", "Research", "Sustaining engineering"],
      },
      { key: "product", label: "Product", master: "products" },
      { key: "owner", label: "Owner", master: "people" },
      {
        key: "stage",
        label: "Stage",
        required: true,
        kind: "select",
        options: ["Concept", "Requirements", "Prototype", "Verification", "Released"],
      },
      { key: "targetDate", label: "Target date", kind: "date" },
      { key: "location", label: "Location", required: true, master: "locations" },
    ],
  },
  stores: {
    types: [
      "Purchase request",
      "Part",
      "Supplier",
      "RFQ",
      "Purchase order",
      "Receiving",
      "Stock movement",
    ],
    fields: [
      { key: "controlledNumber", label: "Purchase request number", required: true },
      { key: "title", label: "Request title", required: true },
      { key: "supplier", label: "Supplier", master: "suppliers" },
      { key: "part", label: "Part", master: "parts" },
      { key: "location", label: "Delivery location", required: true, master: "locations" },
      { key: "dueDate", label: "Required date", kind: "date" },
    ],
  },
  production: {
    types: ["Production order", "Production test", "Release", "Dispatch"],
    fields: [
      { key: "controlledNumber", label: "Production order number", required: true },
      { key: "title", label: "Production order title", required: true },
      { key: "route", label: "Production route", master: "routes" },
      { key: "location", label: "Location", required: true, master: "locations" },
      { key: "targetDate", label: "Planned completion", kind: "date" },
    ],
  },
  quality: {
    types: ["Inspection", "NCR", "CAPA", "Quality review"],
    fields: [
      { key: "controlledNumber", label: "Inspection number", required: true },
      { key: "title", label: "Inspection title", required: true },
      { key: "location", label: "Location", required: true, master: "locations" },
      { key: "targetDate", label: "Target closure", kind: "date" },
    ],
  },
  sales: {
    types: ["Enquiry", "Opportunity", "Order", "Handover"],
    fields: [
      { key: "controlledNumber", label: "Enquiry number", required: true },
      { key: "title", label: "Enquiry title", required: true },
      { key: "customer", label: "Customer", master: "customers" },
      { key: "targetDate", label: "Target date", kind: "date" },
      { key: "location", label: "Location", required: true, master: "locations" },
    ],
  },
  people: {
    types: ["Person", "Training", "Leave", "Asset"],
    fields: [
      { key: "controlledNumber", label: "Person number", required: true },
      { key: "title", label: "Name", required: true },
      { key: "location", label: "Location", required: true, master: "locations" },
      { key: "dueDate", label: "Due date", kind: "date" },
    ],
  },
  ehw: {
    types: ["PRS", "Hardware tracker", "Schematic", "BOM", "Gerber release"],
    fields: [
      { key: "controlledNumber", label: "Controlled number", required: true },
      { key: "title", label: "Title", required: true },
      {
        key: "hwStage",
        label: "HW stage",
        required: true,
        kind: "select",
        options: Array.from(
          { length: 37 },
          (_, index) => `HW_${String(index + 1).padStart(2, "0")}`,
        ),
      },
      { key: "projectId", label: "Project ID", master: "products" },
      { key: "location", label: "Location", required: true, master: "locations" },
    ],
  },
  esw: {
    types: ["Software gate", "HSI register", "CI/CD telemetry", "Firmware release"],
    fields: [
      { key: "controlledNumber", label: "Controlled number", required: true },
      { key: "title", label: "Title", required: true },
      {
        key: "gate",
        label: "SDLC gate",
        required: true,
        kind: "select",
        options: Array.from({ length: 12 }, (_, index) => `G${index}`),
      },
      { key: "projectId", label: "Project ID", master: "products" },
    ],
  },
  mech: {
    types: ["STEP clearance", "2D drawing", "Mold tooling", "Mechanical release"],
    fields: [
      { key: "controlledNumber", label: "Controlled number", required: true },
      { key: "title", label: "Title", required: true },
      { key: "projectId", label: "Project ID", master: "products" },
      { key: "location", label: "Location", required: true, master: "locations" },
    ],
  },
  pur: {
    types: [
      "Rapid prototype request",
      "Mass production request",
      "ASL/ACML",
      "F-PUR-10",
      "F-PUR-16",
      "PPAP Level 3",
    ],
    fields: [
      { key: "controlledNumber", label: "Controlled number", required: true },
      { key: "title", label: "Title", required: true },
      { key: "supplier", label: "Supplier", master: "suppliers" },
    ],
  },
  qa: {
    types: ["APQP gate", "DVP&R", "IQC", "IPQC", "FQC", "8D CAPA", "Certificate"],
    fields: [
      { key: "controlledNumber", label: "Controlled number", required: true },
      { key: "title", label: "Title", required: true },
      {
        key: "qualityStage",
        label: "Quality stage",
        required: true,
        kind: "select",
        options: ["APQP", "DVP&R", "IQC", "IPQC", "FQC", "8D"],
      },
    ],
  },
  emf: {
    types: ["Line startup checklist", "PFD", "PFMEA", "Control plan"],
    fields: [
      { key: "controlledNumber", label: "Controlled number", required: true },
      { key: "title", label: "Title", required: true },
      { key: "location", label: "Location", required: true, master: "locations" },
    ],
  },
  tst: {
    types: ["EOL test run", "Test jig", "QR label batch", "FPY review"],
    fields: [
      { key: "controlledNumber", label: "Controlled number", required: true },
      { key: "title", label: "Title", required: true },
      { key: "serialRange", label: "Serial range" },
      { key: "fpy", label: "First-pass yield %" },
    ],
  },
  fin: {
    types: ["Commercial billing", "PO & GRN validation", "Receivables review", "Tax close"],
    fields: [
      { key: "controlledNumber", label: "Controlled number", required: true },
      { key: "title", label: "Title", required: true },
      { key: "ageingDays", label: "Ageing days" },
    ],
  },
  sit: {
    types: ["Server telemetry", "Backup review", "IT support ticket", "Service case follow-up", "Field service / RMA assessment", "ISMS control"],
    fields: [
      { key: "controlledNumber", label: "Controlled number", required: true },
      { key: "title", label: "Title", required: true },
      { key: "service", label: "Service / asset" },
    ],
  },
  hrops: {
    types: ["Skill matrix", "Training need", "License alert", "DMAIC tollgate"],
    fields: [
      { key: "controlledNumber", label: "Controlled number", required: true },
      { key: "title", label: "Title", required: true },
      { key: "owner", label: "Owner", master: "people" },
    ],
  },
  audit: {
    types: [
      "Audit programme",
      "Internal audit plan",
      "Supplier audit plan",
      "Customer audit plan",
      "Audit finding",
      "Corrective / preventive action",
      "Management review",
      "Improvement action",
      "Controlled document",
    ],
    fields: [
      { key: "controlledNumber", label: "Audit / document number", required: true },
      { key: "title", label: "Title", required: true },
      {
        key: "auditStatus",
        label: "Workflow status",
        required: true,
        kind: "select",
        options: auditStatuses,
      },
      {
        key: "auditType",
        label: "Plan / finding type",
        required: true,
        kind: "select",
        options: ["Internal", "Supplier", "Customer", "Controlled document", "Management review"],
      },
      {
        key: "classification",
        label: "Finding / classification",
        kind: "select",
        options: [
          "Observation",
          "Minor nonconformity",
          "Major nonconformity",
          "Confidential",
          "Internal",
        ],
      },
      { key: "owner", label: "Owner", master: "people" },
      { key: "supplier", label: "Supplier", master: "suppliers" },
      { key: "customer", label: "Customer", master: "customers" },
      { key: "location", label: "Location", required: true, master: "locations" },
      { key: "targetDate", label: "Due / review date", kind: "date" },
    ],
  },
};

const aliases: Record<string, string> = { SAL: "sales", SALES: "sales", EHW: "ehw", FW: "esw", EFW: "esw", SW: "esw", CSW: "esw", MECH: "mech", PUR: "pur", STORES: "stores", QA: "qa", QUALITY: "quality", EMF: "emf", PRODUCTION: "production", FIN: "fin", SIT: "sit", HR: "hrops", HROPS: "hrops", OPS: "hrops", "HR/OPS": "hrops", AUDIT: "audit" };
// MMF uses its existing manufacturing deliverables, never the hardware fallback.
formSpecs["mmf"] = { types: ["Mechanical manufacturing process requirements", "Manufacturing feasibility", "Fit verification", "Manufacturing inspection"], fields: [{key:"title",label:"Title",required:true},{key:"location",label:"Location",required:true,master:"locations"},{key:"targetDate",label:"Due / review date",kind:"date"}] };
export function recordFormSpec(department: string, configuredTypes?:string[]): RecordFormSpec | undefined {
  const base=formSpecs[aliases[department.toUpperCase()] || department.toLowerCase()];
  return base && configuredTypes ? {...base,sourceSpec:base,types:[...new Set([...base.types,...configuredTypes])]} : base;
}
export function recordFields(spec: RecordFormSpec, type: string): RecordField[] {
  const baseSpec=spec.sourceSpec||spec;
  const evidenceStage=type.startsWith('Stage evidence · ')?hardwareStageForRecordType(type):undefined;
  if(evidenceStage)return [{key:'recordStage',label:'Stage · automatic',kind:'text',readOnly:true,automaticValue:evidenceStage.code,automaticLabel:evidenceStage.label},
    {key:'evidenceSummary',label:'Evidence / draft content',required:true},{key:'sourceReferences',label:'Source references'},{key:'assumptions',label:'Assumptions / unresolved items'}];
  const fields = spec.fields
    .filter(field => !["title", "controlledNumber", "projectId"].includes(field.key) && field.master !== "locations")
    .map(field => {
      const automaticStage = baseSpec === formSpecs["ehw"] && field.key === "hwStage" ? hardwareStageForRecordType(type) : undefined;
      const automaticQualityStage = baseSpec === formSpecs["qa"] && field.key === "qualityStage" ? qualityStageForRecordType(type) : undefined;
      return automaticStage
        ? { ...field, label: "HW stage · automatic", kind: "text" as const, options: [], required: false, readOnly: true, automaticValue: automaticStage.code, automaticLabel: automaticStage.label }
        : automaticQualityStage
          ? { ...field, label: "Quality stage · automatic", kind: "text" as const, options: [], required: false, readOnly: true, automaticValue: automaticQualityStage, automaticLabel: `${automaticQualityStage} · determined by record type` }
        : field;
    });
  const stage=hardwareStageForRecordType(type);
  if(stage&&baseSpec!==formSpecs['ehw'])return [...fields.filter(f=>!(type==='Firmware release'&&f.key==='gate')),{key:'recordStage',label:'Stage · automatic',kind:'text',readOnly:true,automaticValue:stage.code,automaticLabel:stage.label}];
  return fields;
}
export function recordFieldValues(spec: RecordFormSpec, type: string, values: Record<string,string>): Record<string,string> {
  const baseSpec=spec.sourceSpec||spec;
  if (!spec.types.includes(type)) throw new Error("Choose a record type for this department.");
  const result: Record<string,string> = {revision: values["revision"] || "01"};
  const automaticStage = baseSpec === formSpecs["ehw"] ? hardwareStageForRecordType(type) : undefined;
  if (automaticStage) result["hwStage"] = automaticStage.code;
  const automaticQualityStage = baseSpec === formSpecs["qa"] ? qualityStageForRecordType(type) : undefined;
  if (automaticQualityStage) result["qualityStage"] = automaticQualityStage;
  const recordStage=hardwareStageForRecordType(type);if(recordStage)result['recordStage']=recordStage.code;
  for (const field of recordFields(spec,type)) {
    if (field.readOnly) continue;
    const value = values[field.key]?.trim() || "";
    if (field.required && !value) throw new Error(`${field.label} is required.`);
    if (value && field.options && !field.options.includes(value)) throw new Error(`Choose a valid ${field.label}.`);
    if (value) result[field.key] = value;
  }
  if (baseSpec === formSpecs["pur"]) { if (type === "Rapid prototype request") result["procurementTrack"] = "Rapid prototype"; else if (type === "Mass production request") result["procurementTrack"] = "Mass production"; }

  // Section 14.15 Domain property persistence: preserve relational linkages and master bindings
  const domainLinkageKeys = [
    // Common / Master identities
    "supplierId",
    "supplier",
    "supplierName",
    "partId",
    "part",
    "mpn",
    "customerId",
    "customer",
    "customerName",
    "verification_status",
    "release_status",
    "spocName",
    "spocEmail",
    "spocPhone",
    "manufacturer",
    "packageFootprint",
    "category",
    "stage",
    "quantity",
    "uom",
    // Sales (§14.15 SAL)
    "requestedDate",
    "targetDate",
    "enquiryId",
    "opportunityId",
    "orderTerms",
    "handoverItems",
    // Hardware (§14.15 EHW)
    "projectId",
    "projectCode",
    "schematicRef",
    "gerberRef",
    "bomRef",
    "prsRows",
    // Firmware / Software (§14.15 FW/SW)
    "hsiEndpoint",
    "commitSha",
    "buildUrl",
    "firmwareVersion",
    "ciStatus",
    "checksum",
    // Mechanical (§14.15 MECH & MMF)
    "stepRef",
    "drawingRef",
    "dimensions",
    "clearanceStatus",
    "moldToolId",
    "trialNumber",
    "processLimit",
    "fitResult",
    "inspectionDisposition",
    "toolLocation",
    // Purchasing (§14.15 PUR)
    "needByDate",
    "aslStatus",
    "ppapLevel",
    // Quality (§14.15 QA)
    "qualityStage",
    "lotNumber",
    "serialNumber",
    "method",
    "criteria",
    "actualReading",
    "disposition",
    "capaRef",
    "sampleSize",
    // Manufacturing (§14.15 EMF)
    "lineId",
    "toolId",
    "pfdOperation",
    "pfmeaRisk",
    "controlPlanRef",
    "lotQuantity",
    "totalPlannedUnits",
    "remainingPlannedUnits",
    // Finance (§14.15 FIN)
    "allocationId",
    "currency",
    "amount",
    "claimedAmount",
    "committedAmount",
    "actualAmount",
    "invoiceNumber",
    "taxAmount",
    "ageingDays",
    // Service / IT (§14.15 SIT)
    "assetId",
    "ticketSource",
    "serverMetric",
    "backupResult",
    "ismsControlId",
    // HR / Operations (§14.15 HR/OPS)
    "employeeId",
    "skillMatrixRow",
    "trainingCourseId",
    "licenseExpiry",
    "policyId",
    "surveyId",
  ];
  for (const k of domainLinkageKeys) {
    const v = values[k];
    if (typeof v === "string" && v.trim() && result[k] === undefined) {
      result[k] = v.trim();
    }
  }

  return result;
}
