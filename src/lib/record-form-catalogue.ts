export type RecordField = { key: string; label: string; required?: boolean; kind?: "text" | "date" | "select"; options?: string[]; master?: "people" | "suppliers" | "parts" | "products" | "customers" | "locations" | "routes" | "documentTypes" };
export type RecordFormSpec = { types: string[]; fields: RecordField[] };
const auditStatuses = ["Draft", "Planned", "Scheduled", "In progress", "Awaiting closure", "Closed", "Overdue"];
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
    types: ["APQP gate", "DVP&R", "IQC", "IPQC", "FQC", "8D CAPA"],
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
    types: ["Server telemetry", "Backup review", "IT support ticket", "ISMS control"],
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
export function recordFormSpec(department: string): RecordFormSpec | undefined {
  return formSpecs[aliases[department.toUpperCase()] || department.toLowerCase()];
}
export function recordFields(spec: RecordFormSpec, type: string): RecordField[] {
  return spec.fields.filter(field => !["title", "controlledNumber", "projectId"].includes(field.key) && !(type === "PRS" && field.key === "hwStage"));
}
export function recordFieldValues(spec: RecordFormSpec, type: string, values: Record<string,string>): Record<string,string> {
  if (!spec.types.includes(type)) throw new Error("Choose a record type for this department.");
  const result: Record<string,string> = {revision: values["revision"] || "01"};
  for (const field of recordFields(spec,type)) {
    const value = values[field.key]?.trim() || "";
    if (field.required && !value) throw new Error(`${field.label} is required.`);
    if (value && field.options && !field.options.includes(value)) throw new Error(`Choose a valid ${field.label}.`);
    if (value) result[field.key] = value;
  }
  if (spec === formSpecs["pur"]) { if (type === "Rapid prototype request") result["procurementTrack"] = "Rapid prototype"; else if (type === "Mass production request") result["procurementTrack"] = "Mass production"; }

  // Section 14.15 Domain property persistence: preserve relational linkages and master bindings
  const domainLinkageKeys = [
    "supplierId",
    "supplier",
    "supplierName",
    "partId",
    "part",
    "mpn",
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
    "procurementTrack",
  ];
  for (const k of domainLinkageKeys) {
    const v = values[k];
    if (typeof v === "string" && v.trim() && result[k] === undefined) {
      result[k] = v.trim();
    }
  }

  return result;
}
