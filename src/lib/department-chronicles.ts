/**
 * Department Chronicles Engine
 * Provides a dynamic, configurable single source of truth for departmental deliverables,
 * stage milestones, and RACI alignment across the entire portal lifecycle.
 * Users can create, modify, or delete chronicles at runtime with full portal synchronization.
 */

export type RaciRole = "R" | "A" | "C" | "I" | "";
export type RaciMatrix = Record<string, Record<string, RaciRole>>;

export type DepartmentChronicle = {
  id: string;
  stageIndex: number; // 0-indexed (0 to 8 corresponding to Stage 1 to Stage 9)
  stageName: string;
  departmentCode: string;
  title: string;
  deliverableCode: string;
  documentType: string;
  raciRole: "R" | "A" | "C" | "I";
  mandatory: boolean;
  description: string;
  status: "Draft" | "Pending" | "In review" | "Approved" | "Completed";
  updatedAt?: string;
};

export const CANONICAL_STAGES = [
  ["Stage 1", "Client & Sales Intake", "Customer SOR (SAL-SOR-01) and Mutual NDA (SAL-mNDA-01) intake."],
  ["Stage 2", "Feasibility & Contract Review", "EHW, FW, SW, MECH, PUR, QA, EMF, MMF, FIN, SIT, HR requirements compile into Contract Review HLPL/F/MKT/01."],
  ["Stage 3", "Requirement Freeze & Commercial Lock", "Consolidated Requirements Package freeze, costing model, and formal quotation SAL-QUO-01."],
  ["Stage 4", "Design & Development PoC", "Hardware schematics SCH-01, preliminary BOM, RTOS MCU bring-up, and telematics software stack."],
  ["Stage 5", "Pilot Build & Manufacturing Readiness", "Accepted outsourced PCBA lot traceability, box-build Control Plan EMF-CP-01, and mechanical fitment evidence."],
  ["Stage 6", "DVP&R Pre-Compliance Verification", "18-test automotive DVP&R matrix (transients, thermal shock, vibration, and drop)."],
  ["Stage 7", "Production Release, DFMEA & PPAP", "Production BOM release, DFMEA risk assessment, PPAP Level 3 dossier, and packaging traveler."],
  ["Stage 8", "Type Approval & Regulatory Certification", "Official Type Approval TAC certificate (ARAI/iCAT) and statutory compliance index."],
  ["Stage 9", "PDI, Field Mounting & Commercial Invoicing", "Pre-Delivery Inspection, warranty certificates, and commercial tax invoices."],
] as const;

export const CANONICAL_DEPARTMENTS = [
  "SAL",
  "EHW",
  "FW",
  "SW",
  "MECH",
  "PUR",
  "QA",
  "EMF",
  "MMF",
  "FIN",
  "SIT",
  "HR",
] as const;

export const DEFAULT_DEPARTMENT_CHRONICLES: DepartmentChronicle[] = [
  // Stage 1: Client & Sales Intake
  {
    id: "CHRON-S1-SAL-SOR",
    stageIndex: 0,
    stageName: "Stage 1: Client & Sales Intake",
    departmentCode: "SAL",
    title: "Customer Scope of Requirement (SOR)",
    deliverableCode: "SAL-SOR-01",
    documentType: "SOR",
    raciRole: "R",
    mandatory: true,
    description: "Customer Statement of Requirements defining volume, target vehicle platform, and commercial intent.",
    status: "Approved",
  },
  {
    id: "CHRON-S1-SAL-NDA",
    stageIndex: 0,
    stageName: "Stage 1: Client & Sales Intake",
    departmentCode: "SAL",
    title: "Mutual Non-Disclosure Agreement (mNDA)",
    deliverableCode: "SAL-mNDA-01",
    documentType: "NDA",
    raciRole: "R",
    mandatory: true,
    description: "Executed bilateral non-disclosure agreement protecting intellectual property.",
    status: "Approved",
  },

  // Stage 2: Feasibility & Contract Review (Stage 2 Gate - Universal Requirement Sheets)
  {
    id: "CHRON-S2-SAL-MKT",
    stageIndex: 1,
    stageName: "Stage 2: Feasibility & Contract Review",
    departmentCode: "SAL",
    title: "Contract Review & Consolidated Feasibility Report",
    deliverableCode: "HLPL/F/MKT/01",
    documentType: "REVIEW",
    raciRole: "A",
    mandatory: true,
    description: "Comprehensive multi-departmental feasibility compilation signed by all lead authorities before engineering kickoff.",
    status: "Approved",
  },
  {
    id: "CHRON-S2-EHW-PRS",
    stageIndex: 1,
    stageName: "Stage 2: Feasibility & Contract Review",
    departmentCode: "EHW",
    title: "Hardware Product Requirement Sheet (EHW-PRS)",
    deliverableCode: "EHW-PRS-01",
    documentType: "PRS",
    raciRole: "R",
    mandatory: true,
    description: "Electrical architecture, 9V-36V power regulation, AEC-Q component selection, and PCB layout constraints.",
    status: "Approved",
  },
  {
    id: "CHRON-S2-FW-FRS",
    stageIndex: 1,
    stageName: "Stage 2: Feasibility & Contract Review",
    departmentCode: "FW",
    title: "Firmware Product Requirement Sheet (FW-FRS)",
    deliverableCode: "FW-FRS-01",
    documentType: "FRS",
    raciRole: "R",
    mandatory: true,
    description: "FreeRTOS memory mapping, CAN J1939 driver requirements, dual-bank bootloader, and fail-safe OTA specifications.",
    status: "Approved",
  },
  {
    id: "CHRON-S2-SW-SRS",
    stageIndex: 1,
    stageName: "Stage 2: Feasibility & Contract Review",
    departmentCode: "SW",
    title: "Software Requirement Specification (SW-SRS)",
    deliverableCode: "SW-SRS-01",
    documentType: "SRS",
    raciRole: "R",
    mandatory: true,
    description: "AIS-140 MQTT ingestion protocols, BLE 5.2 GATT payload schemas, fleet API contracts, and desktop provisioning tools.",
    status: "Approved",
  },
  {
    id: "CHRON-S2-MECH-MRS",
    stageIndex: 1,
    stageName: "Stage 2: Feasibility & Contract Review",
    departmentCode: "MECH",
    title: "Mechanical Requirement Sheet (MECH-MRS)",
    deliverableCode: "MECH-MRS-01",
    documentType: "MRS",
    raciRole: "R",
    mandatory: true,
    description: "IP67 enclosure sealing, 2.4GHz RF transparent lid, vibration/drop dampening, and mold tooling feasibility.",
    status: "Approved",
  },
  {
    id: "CHRON-S2-PUR-BOM",
    stageIndex: 1,
    stageName: "Stage 2: Feasibility & Contract Review",
    departmentCode: "PUR",
    title: "Sourcing & Supply Chain Feasibility (PUR-BOM)",
    deliverableCode: "PUR-BOM-01",
    documentType: "BOM",
    raciRole: "R",
    mandatory: true,
    description: "BOM costing, semiconductor lead times, dual-sourcing strategy, and Approved Supplier List (ASL) check.",
    status: "Approved",
  },
  {
    id: "CHRON-S2-QA-QRS",
    stageIndex: 1,
    stageName: "Stage 2: Feasibility & Contract Review",
    departmentCode: "QA",
    title: "Quality & Compliance Requirement Sheet (QA-QRS)",
    deliverableCode: "QA-QRS-01",
    documentType: "QRS",
    raciRole: "R",
    mandatory: true,
    description: "DVP&R matrix, automotive standards compliance (AIS-140, ISO 7637-2, ISO 16750), and iCAT/NABL test matrix.",
    status: "Approved",
  },
  {
    id: "CHRON-S2-EMF-DFM",
    stageIndex: 1,
    stageName: "Stage 2: Feasibility & Contract Review",
    departmentCode: "EMF",
    title: "Electronics Manufacturing Feasibility (EMF-DFM)",
    deliverableCode: "EMF-DFM-01",
    documentType: "DFM",
    raciRole: "R",
    mandatory: true,
    description: "Box-build traveler, harness fitment, controlled firmware loading, and in-line test feasibility.",
    status: "Approved",
  },
  {
    id: "CHRON-S2-MMF-DFM",
    stageIndex: 1,
    stageName: "Stage 2: Feasibility & Contract Review",
    departmentCode: "MMF",
    title: "Mechanical Manufacturing Feasibility (MMF-DFM)",
    deliverableCode: "MMF-DFM-01",
    documentType: "DFM",
    raciRole: "R",
    mandatory: true,
    description: "Enclosure fabrication, mechanical finishing, subassembly fit checks, and tooling feasibility.",
    status: "Approved",
  },
  {
    id: "CHRON-S2-FIN-CFS",
    stageIndex: 1,
    stageName: "Stage 2: Feasibility & Contract Review",
    departmentCode: "FIN",
    title: "Commercial & Financial Feasibility (FIN-CFS)",
    deliverableCode: "FIN-CFS-01",
    documentType: "CFS",
    raciRole: "R",
    mandatory: true,
    description: "Target OEM unit pricing, NRE tooling recovery, payment credit terms, and gross margin validation.",
    status: "Approved",
  },
  {
    id: "CHRON-S2-SIT-IFS",
    stageIndex: 1,
    stageName: "Stage 2: Feasibility & Contract Review",
    departmentCode: "SIT",
    title: "Service & IT Infrastructure Feasibility (SIT-IFS)",
    deliverableCode: "SIT-IFS-01",
    documentType: "REVIEW",
    raciRole: "C",
    mandatory: false,
    description: "Cloud telemetry server capacity, database backup retention, and field service diagnostic harness.",
    status: "Approved",
  },
  {
    id: "CHRON-S2-HR-OPS",
    stageIndex: 1,
    stageName: "Stage 2: Feasibility & Contract Review",
    departmentCode: "HR",
    title: "Competency & Workmanship Feasibility (HR-OPS)",
    deliverableCode: "HR-OPS-01",
    documentType: "SKILL",
    raciRole: "C",
    mandatory: false,
    description: "IPC-A-610 Class 2 assembly training, ESD handling certification, and plant staffing matrix.",
    status: "Approved",
  },

  // Stage 3: Requirement Freeze & Commercial Lock
  {
    id: "CHRON-S3-SAL-QUO",
    stageIndex: 2,
    stageName: "Stage 3: Requirement Freeze & Commercial Lock",
    departmentCode: "SAL",
    title: "Commercial Quotation & Volume Price Lock",
    deliverableCode: "SAL-QUO-01",
    documentType: "QUO",
    raciRole: "R",
    mandatory: true,
    description: "Locked tier pricing, payment terms, statutory GST applicability, and advance NRE schedule.",
    status: "Approved",
  },
  {
    id: "CHRON-S3-EHW-FROZEN",
    stageIndex: 2,
    stageName: "Stage 3: Requirement Freeze & Commercial Lock",
    departmentCode: "EHW",
    title: "Frozen Product Requirement Specification",
    deliverableCode: "EHW-PRS-02",
    documentType: "PRS",
    raciRole: "C",
    mandatory: true,
    description: "Baseline requirements frozen for engineering development. ECN control enforced.",
    status: "Approved",
  },
  {
    id: "CHRON-S3-HROPS-CRS",
    stageIndex: 2,
    stageName: "Stage 3: Requirement Freeze & Commercial Lock",
    departmentCode: "HR",
    title: "Competency, Safety & Staffing Requirement Freeze (HR-OPS)",
    deliverableCode: "HROPS-CRS-01",
    documentType: "CRS",
    raciRole: "R",
    mandatory: true,
    description: "Resource planning, operator IPC-A-610 competency baseline, and organizational readiness requirements frozen.",
    status: "Approved",
  },
  {
    id: "CHRON-S3-SAL-BRO",
    stageIndex: 2,
    stageName: "Stage 3: Requirement Freeze & Commercial Lock",
    departmentCode: "SAL",
    title: "Product Marketing Brochure (Ready-Made Track)",
    deliverableCode: "SAL-BRO-01",
    documentType: "BRO",
    raciRole: "R",
    mandatory: false,
    description: "Commercial sales brochure, pitch deck, and customer presentation for off-the-shelf ready-made device sales.",
    status: "Approved",
  },
  {
    id: "CHRON-S3-SAL-TDS",
    stageIndex: 2,
    stageName: "Stage 3: Requirement Freeze & Commercial Lock",
    departmentCode: "SAL",
    title: "Technical Data Sheet (Ready-Made Track)",
    deliverableCode: "SAL-TDS-01",
    documentType: "TDS",
    raciRole: "R",
    mandatory: false,
    description: "Ready-made device physical, electrical, and pinout technical data sheet for customer integration.",
    status: "Approved",
  },

  // Stage 4: Design & Development PoC
  {
    id: "CHRON-S4-EHW-SCH",
    stageIndex: 3,
    stageName: "Stage 4: Design & Development PoC",
    departmentCode: "EHW",
    title: "Hardware Schematics & PCB Stackup Package",
    deliverableCode: "EHW-SCH-01",
    documentType: "SCH",
    raciRole: "R",
    mandatory: true,
    description: "Altium schematic capture, RF 50-ohm trace calculations, TVS diodes, and power architecture.",
    status: "Approved",
  },
  {
    id: "CHRON-S4-EHW-BOM",
    stageIndex: 3,
    stageName: "Stage 4: Design & Development PoC",
    departmentCode: "EHW",
    title: "Preliminary Engineering Bill of Materials",
    deliverableCode: "EHW-BOM-01",
    documentType: "BOM",
    raciRole: "R",
    mandatory: true,
    description: "Engineering BOM with preliminary MPNs and footprints for rapid prototyping.",
    status: "Approved",
  },
  {
    id: "CHRON-S4-FW-HAL",
    stageIndex: 3,
    stageName: "Stage 4: Design & Development PoC",
    departmentCode: "FW",
    title: "MCU Bring-Up, FreeRTOS Kernel & CAN HAL",
    deliverableCode: "FW-HAL-01",
    documentType: "FRS",
    raciRole: "R",
    mandatory: true,
    description: "Hardware abstraction layer bring-up, FreeRTOS task scheduling, and CAN loopback validation.",
    status: "Approved",
  },
  {
    id: "CHRON-S4-SW-API",
    stageIndex: 3,
    stageName: "Stage 4: Design & Development PoC",
    departmentCode: "SW",
    title: "Cloud Telemetry Contract & Ingestion Benchmark",
    deliverableCode: "SW-API-01",
    documentType: "SRS",
    raciRole: "R",
    mandatory: true,
    description: "AIS-140 MQTT payload benchmark, TLS 1.3 handshake verification, and REST endpoints.",
    status: "Approved",
  },

  // Stage 5: Pilot Build & Manufacturing Readiness
  {
    id: "CHRON-S5-EMF-CP",
    stageIndex: 4,
    stageName: "Stage 5: Pilot Build & Manufacturing Readiness",
    departmentCode: "EMF",
    title: "Electronics Box-Build Control Plan & Traveler",
    deliverableCode: "EMF-CP-01",
    documentType: "CP",
    raciRole: "R",
    mandatory: true,
    description: "Box-build assembly traveler, controlled firmware flashing procedure, and in-line functional checks.",
    status: "Approved",
  },
  {
    id: "CHRON-S5-MMF-FIT",
    stageIndex: 4,
    stageName: "Stage 5: Pilot Build & Manufacturing Readiness",
    departmentCode: "MMF",
    title: "Mechanical Enclosure Fitment & Seal Inspection",
    deliverableCode: "MMF-FIT-01",
    documentType: "DFM",
    raciRole: "R",
    mandatory: true,
    description: "Enclosure dimensional verification, silicone gasket seating, and drop test report.",
    status: "Approved",
  },
  {
    id: "CHRON-S5-PUR-LOT",
    stageIndex: 4,
    stageName: "Stage 5: Pilot Build & Manufacturing Readiness",
    departmentCode: "PUR",
    title: "Pilot Build Component Sourcing & Lot Traceability",
    deliverableCode: "PUR-LOT-01",
    documentType: "BOM",
    raciRole: "R",
    mandatory: true,
    description: "Lot traceability for outsourced PCBAs and critical long-lead ICs.",
    status: "Approved",
  },

  // Stage 6: DVP&R Pre-Compliance Verification
  {
    id: "CHRON-S6-QA-DVP",
    stageIndex: 5,
    stageName: "Stage 6: DVP&R Pre-Compliance Verification",
    departmentCode: "QA",
    title: "Design Verification Plan & Results (DVP&R)",
    deliverableCode: "QA-DVP-01",
    documentType: "DVP",
    raciRole: "R",
    mandatory: true,
    description: "18 electrical and environmental validation checks per ISO 7637-2, ISO 16750, and AIS-140.",
    status: "Approved",
  },
  {
    id: "CHRON-S6-EHW-EMC",
    stageIndex: 5,
    stageName: "Stage 6: DVP&R Pre-Compliance Verification",
    departmentCode: "EHW",
    title: "Pre-Compliance Conducted & Radiated Immunity Clearance",
    deliverableCode: "EHW-EMC-01",
    documentType: "PRS",
    raciRole: "C",
    mandatory: true,
    description: "Pre-compliance chamber testing results for automotive radiated immunity and transient pulses.",
    status: "Approved",
  },

  // Stage 7: Production Release, DFMEA & PPAP
  {
    id: "CHRON-S7-EHW-DFMEA",
    stageIndex: 6,
    stageName: "Stage 7: Production Release, DFMEA & PPAP",
    departmentCode: "EHW",
    title: "AIAG-VDA Hardware Design Failure Modes (DFMEA)",
    deliverableCode: "EHW-DFMEA-01",
    documentType: "DFMEA",
    raciRole: "R",
    mandatory: true,
    description: "Comprehensive failure mode risk analysis, severity/occurrence/detection scoring, and action priority.",
    status: "Approved",
  },
  {
    id: "CHRON-S7-EMF-PFMEA",
    stageIndex: 6,
    stageName: "Stage 7: Production Release, DFMEA & PPAP",
    departmentCode: "EMF",
    title: "Manufacturing Process Failure Modes (PFMEA)",
    deliverableCode: "EMF-PFMEA-01",
    documentType: "CP",
    raciRole: "R",
    mandatory: true,
    description: "Assembly process risks, prevention controls, detection methods, and reaction plans.",
    status: "Approved",
  },
  {
    id: "CHRON-S7-PUR-PPAP",
    stageIndex: 6,
    stageName: "Stage 7: Production Release, DFMEA & PPAP",
    departmentCode: "PUR",
    title: "Supplier PPAP Level 3 Qualification Package",
    deliverableCode: "PUR-PPAP-01",
    documentType: "PPAP",
    raciRole: "R",
    mandatory: true,
    description: "PSW warrant, dimensional reports, material certs, and supplier quality approvals.",
    status: "Approved",
  },

  // Stage 8: Type Approval & Regulatory Certification
  {
    id: "CHRON-S8-QA-TAC",
    stageIndex: 7,
    stageName: "Stage 8: Type Approval & Regulatory Certification",
    departmentCode: "QA",
    title: "iCAT AIS-140 Type Approval Certificate (Annexure 8)",
    deliverableCode: "QA-TAC-01",
    documentType: "DVP",
    raciRole: "R",
    mandatory: true,
    description: "Official agency type approval witness testing and TAC Form 22 clearance from iCAT Manesar.",
    status: "Approved",
  },
  {
    id: "CHRON-S8-QA-NABL",
    stageIndex: 7,
    stageName: "Stage 8: Type Approval & Regulatory Certification",
    departmentCode: "QA",
    title: "NABL 3.7V Battery Safety Test Certificate",
    deliverableCode: "QA-NABL-01",
    documentType: "DVP",
    raciRole: "R",
    mandatory: true,
    description: "NABL accredited laboratory report tested to IS 16046 (Part 2) / IEC 62133-2 and UN 38.3 transport safety.",
    status: "Approved",
  },

  // Stage 9: PDI, Field Mounting & Commercial Invoicing
  {
    id: "CHRON-S9-EMF-PDI",
    stageIndex: 8,
    stageName: "Stage 9: PDI, Field Mounting & Commercial Invoicing",
    departmentCode: "EMF",
    title: "Pre-Dispatch Inspection (PDI) Release Certificate",
    deliverableCode: "EMF-PDI-01",
    documentType: "PDI",
    raciRole: "R",
    mandatory: true,
    description: "100% automated functional testing, firmware flash checksum verification, IMEI scan, and packaging sign-off.",
    status: "Approved",
  },
  {
    id: "CHRON-S9-MMF-INSP",
    stageIndex: 8,
    stageName: "Stage 9: PDI, Field Mounting & Commercial Invoicing",
    departmentCode: "MMF",
    title: "Mechanical Subassembly Quality Checklist",
    deliverableCode: "MMF-INSP-01",
    documentType: "PDI",
    raciRole: "R",
    mandatory: true,
    description: "Final dimensional check, IP67 torque verification, and harness connector integrity inspection.",
    status: "Approved",
  },
  {
    id: "CHRON-S9-SIT-MNT",
    stageIndex: 8,
    stageName: "Stage 9: PDI, Field Mounting & Commercial Invoicing",
    departmentCode: "SIT",
    title: "Service Field Installation & Vehicle Mounting Checklist",
    deliverableCode: "SIT-MNT-01",
    documentType: "WI",
    raciRole: "R",
    mandatory: true,
    description: "Field harness installation SOP, vehicle ignition signal check, and telemetry cloud onboarding.",
    status: "Approved",
  },
  {
    id: "CHRON-S9-FIN-INV",
    stageIndex: 8,
    stageName: "Stage 9: PDI, Field Mounting & Commercial Invoicing",
    departmentCode: "FIN",
    title: "Commercial Tax Invoice & Delivery Dispatch Note",
    deliverableCode: "FIN-INV-01",
    documentType: "INV",
    raciRole: "R",
    mandatory: true,
    description: "Statutory GST invoice with dispatch delivery challan and serial range registration.",
    status: "Approved",
  },
];

/**
 * Derives a complete dynamic RACI matrix from the current list of chronicles.
 * When a user creates, modifies, or deletes any chronicle, this function computes
 * the exact updated RACI table in real-time.
 */
export function deriveRaciMatrixFromChronicles(
  chronicles: DepartmentChronicle[],
  stages: readonly (readonly [string, string, string])[],
  departments: readonly string[],
): RaciMatrix {
  const matrix: RaciMatrix = {};

  for (let sIdx = 0; sIdx < stages.length; sIdx++) {
    const stageKey = stages[sIdx]![0];
    const stageChronicles = chronicles.filter(c => c.stageIndex === sIdx);

    const row: Record<string, RaciRole> = {};

    for (const dept of departments) {
      // Find chronicles matching this department in this stage
      const matching = stageChronicles.filter(
        c => c.departmentCode.trim().toUpperCase() === dept.trim().toUpperCase(),
      );

      if (matching.length > 0) {
        // Priority: R > A > C > I
        if (matching.some(c => c.raciRole === "R")) {
          row[dept] = "R";
        } else if (matching.some(c => c.raciRole === "A")) {
          row[dept] = "A";
        } else if (matching.some(c => c.raciRole === "C")) {
          row[dept] = "C";
        } else if (matching.some(c => c.raciRole === "I")) {
          row[dept] = "I";
        } else {
          row[dept] = "";
        }
      } else {
        // Unassigned departments have no role in this stage
        row[dept] = "";
      }
    }

    matrix[stageKey] = row;
  }

  return matrix;
}

/**
 * Derives stage deliverables for a specific stage from the active chronicles.
 * Replaces hardcoded stage deliverables in the Project Lifecycle Player.
 */
export function deriveDeliverablesForStage(
  chronicles: DepartmentChronicle[],
  stageIndex: number,
): Array<{
  docId: string;
  title: string;
  dept: string;
  status: "Approved" | "In Review" | "Draft";
  description: string;
}> {
  return chronicles
    .filter(c => c.stageIndex === stageIndex)
    .map(c => ({
      docId: c.deliverableCode,
      title: c.title,
      dept: c.departmentCode,
      status: (c.status === "Approved" || c.status === "Completed"
        ? "Approved"
        : c.status === "In review"
          ? "In Review"
          : "Draft") as "Approved" | "In Review" | "Draft",
      description: c.description,
    }));
}

export type CanonicalProjectTrack =
  | "hardware_only"
  | "firmware_only"
  | "software_only"
  | "hardware_firmware"
  | "firmware_software_existing_hardware"
  | "hardware_firmware_software"
  | "ready_made";

export type ProjectTrack =
  | CanonicalProjectTrack
  | "turnkey"   // legacy alias -> hardware_firmware_software
  | "software"  // legacy alias -> software_only
  | "firmware"; // legacy alias -> firmware_only

export const DEPARTMENT_FULL_NAMES: Record<
  string,
  { short: string; full: string; roleName: string; description: string; isCommon: boolean }
> = {
  SAL: {
    short: "SAL",
    full: "Sales & BD",
    roleName: "Sales & Business Development Lead",
    description: "Business Development, Customer SOR, Contract Review & Commercial Lock",
    isCommon: true,
  },
  EHW: {
    short: "EHW",
    full: "Embedded Hardware",
    roleName: "Embedded Hardware Engineering Lead",
    description: "Schematics, PCB Layout, ECAD Netlists, TVS & Power Electronics",
    isCommon: false,
  },
  FW: {
    short: "FW",
    full: "Embedded Firmware",
    roleName: "Firmware & Embedded Systems Lead",
    description: "FreeRTOS/Bare-Metal Kernel, CAN J1939 Telemetry & Device Drivers",
    isCommon: false,
  },
  SW: {
    short: "SW",
    full: "Software & Cloud",
    roleName: "Software & Cloud Engineering Lead",
    description: "Cloud Microservices, Telematics Web/Mobile Apps & API Gateways",
    isCommon: false,
  },
  MECH: {
    short: "MECH",
    full: "Mechanical Engineering",
    roleName: "Mechanical & Thermal Engineering Lead",
    description: "IP67 Enclosures, 3D CAD, Mold Tooling, Thermal Simulation & Fitment",
    isCommon: false,
  },
  PUR: {
    short: "PUR",
    full: "Purchasing & SCM",
    roleName: "Supply Chain & Procurement Lead",
    description: "Production BOM Sourcing, ASL Suppliers, Soft-Tooling & Component SCM",
    isCommon: false,
  },
  QA: {
    short: "QA",
    full: "QA & Testing",
    roleName: "Quality Assurance & Testing Lead",
    description: "Quality Assurance, Pre-Compliance, DVP&R, Environmental & Automotive Testing",
    isCommon: true,
  },
  EMF: {
    short: "EMF",
    full: "Electronics Manufacturing",
    roleName: "Electronics Manufacturing Lead",
    description: "SMT Assembly Line, Stencil Printing, Reflow, Lot Traceability & Inspection",
    isCommon: false,
  },
  MMF: {
    short: "MMF",
    full: "Mechanical Manufacturing",
    roleName: "Mechanical Tooling & Manufacturing Lead",
    description: "Injection Mold Hard-Tooling, Metal Stamping & Mechanical Fabrication",
    isCommon: false,
  },
  FIN: {
    short: "FIN",
    full: "Finance & Accounts",
    roleName: "Finance & Commercial Accounts Lead",
    description: "Project Budgets, Expense Claims, Cost Accounting & Commercial Invoicing",
    isCommon: true,
  },
  SIT: {
    short: "SIT",
    full: "IT & System Integration",
    roleName: "System Integration & IT Service Lead",
    description: "Cloud Deployment, IT Infrastructure, Diagnostic & Customer Support",
    isCommon: true,
  },
  HR: {
    short: "HR",
    full: "HR & Operations",
    roleName: "HR & Operations Governance Lead",
    description: "Competency Roster, Staffing, Operator IPC-A-610 Safety & Plant Operations",
    isCommon: true,
  },
};

export function getTechnicalDepartmentsForTrack(track: ProjectTrack): string[] {
  const t = (track || "").trim().toLowerCase();
  switch (t) {
    case "ready_made":
    case "readymade":
    case "catalog":
    case "commercial":
      return []; // Off-the-shelf catalog products require zero technical engineering development
    case "software":
    case "software_only":
    case "sw":
      return ["SW"];
    case "firmware":
    case "firmware_only":
    case "fw":
      return ["FW", "EHW"];
    case "firmware_software_existing_hardware":
    case "firmware_software":
    case "fw+sw":
      return ["FW", "SW"];
    case "hardware_only":
    case "hardware":
    case "ehw":
      return ["EHW", "MECH", "PUR", "EMF", "MMF"];
    case "hardware_firmware":
    case "hardware+firmware":
    case "hw+fw":
      return ["EHW", "FW", "MECH", "PUR", "EMF", "MMF"];
    case "hardware_firmware_software":
    case "turnkey":
    default:
      return ["EHW", "FW", "SW", "MECH", "PUR", "EMF", "MMF"];
  }
}

export function isDepartmentActiveForTrack(dept: string, track: ProjectTrack): boolean {
  const norm = dept.trim().toUpperCase();
  const info = DEPARTMENT_FULL_NAMES[norm];
  if (info?.isCommon) return true;
  return getTechnicalDepartmentsForTrack(track).includes(norm);
}

