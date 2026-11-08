/**
 * SSM One Document Catalogue - 38 Family Registry & Coverage Matrix
 * 
 * Implements the canonical document-family mapping owned by the SSM-Planning catalogue; see the shared master-plan document map.
 * Reconciles 38 logical families, 89 unique source blocks, and 90 source-family links.
 * D02 and D04 remain clarification-only.
 */

import { companyPhaseLabel } from './company-phases';
import { STAGE_DELIVERABLE_BINDINGS } from './lifecycle-stage-extensions';

export type DocumentSubtype = {
  id: string;
  name: string;
  departmentCode: string;
  format: "DOCX" | "XLSX" | "PDF" | "Native File" | "Software record";
  isClientDeliverable?: boolean;
  requiresReview?: boolean;
};

export type CatalogueFamily = {
  id: string; // D01 - D38
  owner: string;
  family: string;
  format: string;
  createOrRecordWhen: string;
  sourceBlocks: string[];
  deliveryScope: string;
  status: string;
  subtypes?: DocumentSubtype[];
  clarificationOnly?: boolean;
};

export const DOCUMENT_CATALOGUE_VERSION = "2026-11-07.phases";
// Additive crosswalk: family IDs/source coverage stay intact; operational records retain their existing type names.
export const LIFECYCLE_DOCUMENT_EXITS = [
  {stage:'HW_02',family:'D08',recordType:'PRS',original:false},
  {stage:'HW_15',family:'D10',recordType:'Schematic',original:true},
  {stage:'HW_19',family:'D11',recordType:'BOM',original:false},
  {stage:'HW_24',family:'D10',recordType:'Gerber release',original:true},
  {stage:'HW_17',family:'D10',recordType:'STEP clearance',original:true},
  {stage:'FW_12',family:'D10',recordType:'Firmware release',original:true},
  {stage:'C14',family:'D23',recordType:'Certificate',original:true},
  ...STAGE_DELIVERABLE_BINDINGS,
] as const;
export const REUSABLE_CATALOGUE_FAMILIES = ['D08','D10','D11','D13','D14','D23','D31'] as const;

export const CATALOGUE_FAMILIES: CatalogueFamily[] = [
  {
    id: "D01",
    owner: "Each department",
    family: "Common operating pack: SOPs, authority matrix and work instructions",
    format: "DOCX / approved references",
    createOrRecordWhen: "Maintain one controlled pack per department/workstream; reuse its revision across projects. Includes engineering/SDLC/CI standards, FIFO and nonconformance procedures.",
    sourceBlocks: ["B0450", "B0452", "B0463", "B0478", "B0479", "B0489", "B0500", "B0514", "B0516", "B0520"],
    deliveryScope: "Foundation, independently",
    status: "Target family; readiness follows actual records/contracts",
    subtypes: [
      { id: "SOP", name: "Standard Operating Procedure", departmentCode: "ALL", format: "DOCX" },
      { id: "WI", name: "Work Instruction", departmentCode: "ALL", format: "DOCX" },
    ],
  },
  {
    id: "D02",
    owner: "Sales",
    family: "Customer Register and contacts",
    format: "Software records → synced XLSX",
    createOrRecordWhen: "One managed Customer Register.xlsx from Customer master; refresh additions/changes, retain revisions. Not one file per customer and not external Excel import.",
    sourceBlocks: [],
    deliveryScope: "Current flow",
    status: "Target family; clarification-only",
    clarificationOnly: true,
  },
  {
    id: "D03",
    owner: "Sales",
    family: "Enquiries & Opportunities register / pipeline reviews",
    format: "Software records / review log",
    createOrRecordWhen: "Log each customer intake. Monthly/quarterly pipeline reviews link to enquiries rather than duplicating them.",
    sourceBlocks: ["B0458", "B0508"],
    deliveryScope: "Current flow",
    status: "Target family; readiness follows actual records/contracts",
    subtypes: [
      { id: "SAL-ENQ", name: "Customer Enquiry Register", departmentCode: "SAL", format: "XLSX" },
    ],
  },
  {
    id: "D04",
    owner: "Sales",
    family: "Master Specification / customer inputs / SOR",
    format: "Versioned fields + DOCX",
    createOrRecordWhen: "Customer Statement of Requirements and master engineering specifications intake.",
    sourceBlocks: [],
    deliveryScope: "Current flow",
    status: "Target family; clarification-only",
    clarificationOnly: true,
  },
  {
    id: "D05",
    owner: "Sales coordinates assigned departments",
    family: "Feasibility / contract review",
    format: "Assigned review records + DOCX",
    createOrRecordWhen: "Contract Review Record (HLPL/F/MKT/01) across Sales, Hardware, Firmware, Software, Mechanical, Purchase, QA, Manufacturing and Finance.",
    sourceBlocks: ["B0442", "B0448", "B0506"],
    deliveryScope: `${companyPhaseLabel('TG_0')} review`,
    status: "Core milestone deliverable",
    subtypes: [
      { id: "REVIEW", name: "Contract & Multi-Department Feasibility Review (HLPL/F/MKT/01)", departmentCode: "SAL", format: "DOCX", requiresReview: true },
    ],
  },
  {
    id: "D06",
    owner: "Sales",
    family: "Quotation / commercial proposal",
    format: "DOCX / commercial records",
    createOrRecordWhen: "Commercial offer with line items, quantity tiers, NRE tooling, payment terms and validity.",
    sourceBlocks: ["B0449", "B0507"],
    deliveryScope: `${companyPhaseLabel('TG_1')} review`,
    status: "Core milestone deliverable",
    subtypes: [
      { id: "QUO", name: "Commercial Quotation & Costing", departmentCode: "SAL", format: "DOCX", isClientDeliverable: true },
    ],
  },
  {
    id: "D07",
    owner: "Operations / Legal",
    family: "NDA and confidential agreement",
    format: "DOCX + actual agreement evidence",
    createOrRecordWhen: "Mutual non-disclosure and confidential IP protection agreement.",
    sourceBlocks: ["B0515"],
    deliveryScope: "Commercial baseline",
    status: "Core milestone deliverable",
    subtypes: [
      { id: "NDA", name: "Mutual Non-Disclosure Agreement", departmentCode: "SAL", format: "DOCX", isClientDeliverable: true },
    ],
  },
  {
    id: "D08",
    owner: "Hardware / R&D",
    family: "PRS / confirmed requirement baseline",
    format: "Versioned baseline + DOCX",
    createOrRecordWhen: "Domain-specific Product Requirements Specifications across all engineering departments (Process 01).",
    sourceBlocks: ["B0443", "B0444", "B0445", "B0446", "B0447"],
    deliveryScope: `${companyPhaseLabel('TG_0')} / ${companyPhaseLabel('TG_1')} review`,
    status: "Core milestone deliverable",
    subtypes: [
      { id: "EHW-PRS", name: "Hardware Product Requirements Specification", departmentCode: "EHW", format: "DOCX", requiresReview: true },
      { id: "FW-FRS", name: "Embedded Firmware Requirements Specification", departmentCode: "FW", format: "DOCX", requiresReview: true },
      { id: "SW-SRS", name: "Cloud & Application Software Requirements", departmentCode: "SW", format: "DOCX", requiresReview: true },
      { id: "MECH-MRS", name: "Mechanical & Enclosure Requirements", departmentCode: "MECH", format: "DOCX", requiresReview: true },
      { id: "PUR-SRS", name: "Sourcing & Component Feasibility Matrix", departmentCode: "PUR", format: "DOCX", requiresReview: true },
      { id: "QA-QRS", name: "Quality Assurance & DVP&R Requirements", departmentCode: "QA", format: "DOCX", requiresReview: true },
      { id: "EMF-MPR", name: "Electronics Manufacturing Process Requirements", departmentCode: "EMF", format: "DOCX", requiresReview: true },
      { id: "MMF-MPR", name: "Mechanical Manufacturing Process Requirements", departmentCode: "MMF", format: "DOCX", requiresReview: true },
      { id: "FIN-CFS", name: "Financial Feasibility & Cost Target Sheet", departmentCode: "FIN", format: "DOCX", requiresReview: true },
      { id: "SIT-SRS", name: "IT Infrastructure & Cloud Service Requirements", departmentCode: "SIT", format: "DOCX", requiresReview: true },
      { id: "HROPS-CRS", name: "Competency, Safety & Compliance Requirements", departmentCode: "HR", format: "DOCX", requiresReview: true },
    ],
  },
  {
    id: "D09",
    owner: "Hardware / R&D",
    family: "Architecture / block diagram / HSI",
    format: "Design files / specification",
    createOrRecordWhen: "System architecture, high-level design, hardware-software interface (HSI) specification.",
    sourceBlocks: ["B0451", "B0453"],
    deliveryScope: "Engineering design",
    status: "Core milestone deliverable",
    subtypes: [
      { id: "HSI", name: "Hardware-Software Interface Specification", departmentCode: "EHW", format: "DOCX" },
      { id: "ARCH", name: "System Architecture & Block Diagram", departmentCode: "EHW", format: "DOCX" },
    ],
  },
  {
    id: "D10",
    owner: "Hardware / R&D",
    family: "Design and release file package",
    format: "Externally authored native artifacts uploaded or controlled-linked",
    createOrRecordWhen: "Schematics, Gerber packages, 3D CAD STEP files, and firmware release binaries (.hex, .bin) with SHA-256 checksums.",
    sourceBlocks: ["B0455", "B0456", "B0457"],
    deliveryScope: "Native vault",
    status: "Controlled native artifacts with PDF covers",
    subtypes: [
      { id: "GERBER", name: "PCB Fabrication & Gerber Package", departmentCode: "EHW", format: "Native File" },
      { id: "CAD-STEP", name: "3D Mechanical Enclosure Model (STEP)", departmentCode: "MECH", format: "Native File" },
      { id: "FW-BIN", name: "Target Firmware Binary Release (.bin/.hex)", departmentCode: "FW", format: "Native File" },
    ],
  },
  {
    id: "D11",
    owner: "Hardware / R&D",
    family: "Engineering BOM / cost tracker",
    format: "Portal-owned structured BOM + XLSX/CSV rendition",
    createOrRecordWhen: "Controlled Bill of Materials with MPN, manufacturer, footprint, designator, quantity, and unit cost.",
    sourceBlocks: ["B0459", "B0460", "B0461"],
    deliveryScope: "Engineering baseline",
    status: "Core milestone deliverable",
    subtypes: [
      { id: "BOM", name: "Controlled Engineering Bill of Materials", departmentCode: "EHW", format: "XLSX" },
    ],
  },
  {
    id: "D12",
    owner: "Hardware / R&D",
    family: "DFMEA",
    format: "Structured ratings/actions + DOCX",
    createOrRecordWhen: "Design Failure Mode and Effects Analysis assessing function, potential failure mode, severity, occurrence, detection and action priority.",
    sourceBlocks: ["B0462"],
    deliveryScope: "Quality baseline",
    status: "Core milestone deliverable",
    subtypes: [
      { id: "DFMEA", name: "Design Failure Mode and Effects Analysis", departmentCode: "EHW", format: "DOCX" },
    ],
  },
  {
    id: "D13",
    owner: "Hardware / R&D",
    family: "POC / design verification / DVP&R",
    format: "Test records + evidence / DOCX",
    createOrRecordWhen: "Design Verification Plan and Report tracking environmental, electrical, thermal and EMC testing with measured values and pass/fail disposition.",
    sourceBlocks: ["B0464", "B0465", "B0466"],
    deliveryScope: "Verification baseline",
    status: "Core milestone deliverable",
    subtypes: [
      { id: "DVP", name: "Design Verification Plan & Report (DVP&R)", departmentCode: "QA", format: "DOCX" },
    ],
  },
  {
    id: "D14",
    owner: "Hardware / R&D",
    family: "Design change / ECO / ECN review",
    format: "Change register + evidence",
    createOrRecordWhen: "Engineering Change Request (ECR) and Engineering Change Order (ECO) impact assessment.",
    sourceBlocks: ["B0467"],
    deliveryScope: "Change management",
    status: "Core milestone deliverable",
    subtypes: [
      { id: "ECR", name: "Engineering Change Request", departmentCode: "ALL", format: "DOCX" },
      { id: "ECO", name: "Engineering Change Order", departmentCode: "ALL", format: "DOCX" },
    ],
  },
  {
    id: "D15",
    owner: "Hardware / R&D",
    family: "Software quality / security / performance review",
    format: "Review records",
    createOrRecordWhen: "Firmware code review, static analysis, MISRA compliance, vulnerability audit and FOTA fail-safe checks.",
    sourceBlocks: ["B0468"],
    deliveryScope: "Software governance",
    status: "Engineering records",
  },
  {
    id: "D16",
    owner: "Hardware / R&D",
    family: "DRC / component-library review",
    format: "Review records",
    createOrRecordWhen: "PCB Design Rule Checks (DRC), footprint validation, thermal relief and high-speed signal integrity review.",
    sourceBlocks: ["B0469"],
    deliveryScope: "Hardware governance",
    status: "Engineering records",
  },
  {
    id: "D17",
    owner: "Production",
    family: "Tooling condition / custody / mold maintenance review",
    format: "Asset/tool review records",
    createOrRecordWhen: "Injection mold tooling custody, stamping die life tracking, maintenance intervals and shot count audits.",
    sourceBlocks: ["B0470"],
    deliveryScope: "Production assets",
    status: "Plant records",
  },
  {
    id: "D18",
    owner: "Procurement",
    family: "Supplier qualification / ASL / ACML / performance and capacity",
    format: "Supplier registers + review evidence",
    createOrRecordWhen: "Approved Supplier List (ASL), Approved Component Manufacturer List (ACML), and supplier audit ratings.",
    sourceBlocks: ["B0471", "B0472"],
    deliveryScope: "Supply chain",
    status: "Controlled registers",
  },
  {
    id: "D19",
    owner: "Procurement",
    family: "Supplier PPAP / submission warrant",
    format: "Checklist + supplier evidence",
    createOrRecordWhen: "Production Part Approval Process submission and Part Submission Warrant (PSW) disposition.",
    sourceBlocks: ["B0473"],
    deliveryScope: "Production readiness",
    status: "Core milestone deliverable",
    subtypes: [
      { id: "PPAP", name: "PPAP Submission Dossier", departmentCode: "PUR", format: "DOCX" },
      { id: "PSW", name: "Part Submission Warrant", departmentCode: "PUR", format: "DOCX", isClientDeliverable: true },
    ],
  },
  {
    id: "D20",
    owner: "Production",
    family: "Calibration / MSA / expiration review",
    format: "Instrument register + evidence",
    createOrRecordWhen: "Calibration certificates, Measurement System Analysis (Gage R&R), and test instrument traceability.",
    sourceBlocks: ["B0474", "B0475"],
    deliveryScope: "Quality & maintenance",
    status: "Controlled registers",
  },
  {
    id: "D21",
    owner: "Production",
    family: "Line capacity / startup / process flow",
    format: "Readiness records / PFD",
    createOrRecordWhen: "Process Flow Diagram (PFD) for manufacturing, line balance, cycle times, and line startup verification.",
    sourceBlocks: ["B0476"],
    deliveryScope: "Production preparation",
    status: "Manufacturing records",
  },
  {
    id: "D22",
    owner: "Production",
    family: "PFMEA / control plan",
    format: "Distinct structured templates / DOCX",
    createOrRecordWhen: "Process Failure Mode and Effects Analysis (PFMEA) and Production Control Plan (CP) detailing process steps, gages, frequencies and reaction plans.",
    sourceBlocks: ["B0477", "B0480"],
    deliveryScope: "Manufacturing quality",
    status: "Core milestone deliverable",
    subtypes: [
      { id: "PFMEA", name: "Process Failure Mode and Effects Analysis", departmentCode: "EMF", format: "DOCX" },
      { id: "CP", name: "Production Control Plan", departmentCode: "EMF", format: "DOCX" },
    ],
  },
  {
    id: "D23",
    owner: "Production",
    family: "EOL / FQC / PDI",
    format: "Measured unit records + DOCX",
    createOrRecordWhen: "End-of-Line testing, Final Quality Control, and Pre-Dispatch Inspection Certificate with serial numbers and measured parameters.",
    sourceBlocks: ["B0481", "B0482"],
    deliveryScope: "Dispatch release",
    status: "Core milestone deliverable",
    subtypes: [
      { id: "PDI", name: "Pre-Dispatch Inspection Report & Certificate", departmentCode: "QA", format: "DOCX", isClientDeliverable: true },
    ],
  },
  {
    id: "D24",
    owner: "Production",
    family: "5S / OEE / yield / scrap / defects / KPI reviews",
    format: "Operational registers + calculated views",
    createOrRecordWhen: "Overall Equipment Effectiveness, first-pass yield, scrap percentage, and defect pareto tracking.",
    sourceBlocks: ["B0483", "B0484"],
    deliveryScope: "Manufacturing operations",
    status: "Operational views",
  },
  {
    id: "D25",
    owner: "Operations",
    family: "NCR / 8D / CAPA / lessons learned",
    format: "Linked case and action records",
    createOrRecordWhen: "Non-Conformance Reports (NCR) and 8D Root Cause Problem Solving with containment, 5-Why root cause, and permanent corrective action.",
    sourceBlocks: ["B0485", "B0486"],
    deliveryScope: "Continuous improvement",
    status: "Core milestone deliverable",
    subtypes: [
      { id: "8D", name: "8D Corrective Action Problem Solving Report", departmentCode: "QA", format: "DOCX" },
      { id: "NCR", name: "Non-Conformance Report", departmentCode: "QA", format: "DOCX" },
    ],
  },
  {
    id: "D26",
    owner: "Finance",
    family: "Receivables / MIS / financial KPI / closing / billing",
    format: "Financial records + XLSX/DOCX renditions",
    createOrRecordWhen: "Commercial invoicing, accounts receivable aging, billing milestone certification, and project gross margin reconciliations.",
    sourceBlocks: ["B0487", "B0488"],
    deliveryScope: "Commercial closing",
    status: "Financial records",
    subtypes: [
      { id: "INV", name: "Commercial Tax Invoice", departmentCode: "FIN", format: "PDF", isClientDeliverable: true },
    ],
  },
  {
    id: "D27",
    owner: "HR",
    family: "Skill matrix / TNI / training / manpower and workforce reviews",
    format: "Restricted HR records + matrix rendition",
    createOrRecordWhen: "Competency assessment, Training Need Identification (TNI), and operator skill evaluation.",
    sourceBlocks: ["B0490", "B0491"],
    deliveryScope: "Workforce competency",
    status: "Core milestone deliverable",
    subtypes: [
      { id: "SKILL", name: "Competency & Skill Matrix Assessment (HLPL/F/HR/03)", departmentCode: "HR", format: "XLSX" },
    ],
  },
  {
    id: "D28",
    owner: "HR",
    family: "Onboarding / BGV",
    format: "Restricted policy and case records",
    createOrRecordWhen: "Employee onboarding, background verification, credential validation and compliance records.",
    sourceBlocks: ["B0492"],
    deliveryScope: "HR management",
    status: "Confidential records",
  },
  {
    id: "D29",
    owner: "HR",
    family: "Grievance / employee query",
    format: "Restricted case register",
    createOrRecordWhen: "Confidential employee queries, safety escalations, and grievance resolution logs.",
    sourceBlocks: ["B0493"],
    deliveryScope: "HR management",
    status: "Confidential records",
  },
  {
    id: "D30",
    owner: "Operations",
    family: "Linked risk registers / project risk matrix",
    format: "Scoped risk records",
    createOrRecordWhen: "Project-level risk register identifying technical, supply chain, schedule and financial risks with mitigation plans.",
    sourceBlocks: ["B0494"],
    deliveryScope: "Program management",
    status: "Controlled registers",
  },
  {
    id: "D31",
    owner: "Operations",
    family: "Certification / statutory applicability and validity evidence",
    format: "Reference / actual external evidence",
    createOrRecordWhen: "Government Type Approval Certificates (ARAI, ICAT, BIS, WPC, RoHS, CE) stored as authentic external PDF attachments.",
    sourceBlocks: ["B0495"],
    deliveryScope: "Statutory compliance",
    status: "External evidence vault",
  },
  {
    id: "D32",
    owner: "Operations",
    family: "APQP / internal audits / governance / management review",
    format: "Assigned checklist/review records",
    createOrRecordWhen: "Internal IATF 16949 QMS audits, APQP phase gate checklists, and Management Review Meeting minutes.",
    sourceBlocks: ["B0496", "B0497"],
    deliveryScope: "Governance",
    status: "QMS records",
  },
  {
    id: "D33",
    owner: "Operations",
    family: "DMAIC / improvement charter and tollgate evidence",
    format: "Improvement project records",
    createOrRecordWhen: "Six Sigma DMAIC project charters, Kaizen improvement initiatives, and waste reduction tollgates.",
    sourceBlocks: ["B0498"],
    deliveryScope: "Operational excellence",
    status: "Improvement records",
  },
  {
    id: "D34",
    owner: "Production",
    family: "Process-equipment PM / downtime / OEE",
    format: "Maintenance and performance records",
    createOrRecordWhen: "Preventive maintenance tickets, mean time between failures (MTBF), mean time to repair (MTTR), and equipment logs.",
    sourceBlocks: ["B0499"],
    deliveryScope: "Maintenance operations",
    status: "Equipment records",
  },
  {
    id: "D35",
    owner: "Facility / Maintenance",
    family: "Utilities / DG / electricity and water",
    format: "Facility records + evidence",
    createOrRecordWhen: "Plant utilities, backup power diesel generator logs, electrical power quality, and water treatment reports.",
    sourceBlocks: ["B0501"],
    deliveryScope: "Facility management",
    status: "Facility records",
  },
  {
    id: "D36",
    owner: "Facility / Maintenance",
    family: "IT backup / security review / project IT tickets",
    format: "Authorized IT records",
    createOrRecordWhen: "Network security logs, data backup verification, access control audits, and developer IT tickets.",
    sourceBlocks: ["B0502", "B0503"],
    deliveryScope: "IT operations",
    status: "Infrastructure records",
  },
  {
    id: "D37",
    owner: "Facility / Maintenance",
    family: "Facility/security service / waste disposal / pest control",
    format: "Contracts, service and disposal evidence",
    createOrRecordWhen: "Hazardous e-waste disposal manifests, security gatehouse registers, and environmental permits.",
    sourceBlocks: ["B0504"],
    deliveryScope: "Facility management",
    status: "Compliance evidence",
  },
  {
    id: "D38",
    owner: "Operations",
    family: "Cross-department KPI definitions / dashboard",
    format: "Definitions + authorized aggregate views",
    createOrRecordWhen: "Company executive metrics, department SLA scorecards, delivery on-time-in-full (OTIF), and customer PPM.",
    sourceBlocks: ["B0505"],
    deliveryScope: "Executive oversight",
    status: "Executive views",
  },
];

/**
 * Lookup catalogue family by ID (D01 - D38)
 */
export function getCatalogueFamilyById(id: string): CatalogueFamily | undefined {
  return CATALOGUE_FAMILIES.find((fam) => fam.id === id);
}

/**
 * Lookup catalogue family for a given document subtype code (e.g. 'EHW-PRS', 'DFMEA', '8D')
 */
export function getCatalogueFamilyForType(type: string): CatalogueFamily | undefined {
  const normalized = type.toUpperCase().trim();
  return CATALOGUE_FAMILIES.find((fam) =>
    fam.subtypes?.some((sub) => sub.id === normalized || normalized.includes(sub.id))
  );
}

/**
 * Returns all active registered subtypes with their delivery formats and departments
 */
export function getAllRegisteredSubtypes(): DocumentSubtype[] {
  return CATALOGUE_FAMILIES.flatMap((fam) => fam.subtypes ?? []);
}
