/**
 * Canonical Project Lifecycle Engine (Namespace: LC2-2026-10-28)
 * Authority: SSM One Cross-Platform Master Plan & Sample Data and Test Plan (28 October 2026)
 * Reference: ANTIGRAVITY_READY_TO_USE_CONSOLIDATED_HANDOFF_2026-10-21.md §16.10 - §16.11
 *
 * Implements:
 * 1. Seven Canonical Tracks:
 *    - hardware_only (HW)
 *    - firmware_only (FW)
 *    - software_only (SW)
 *    - hardware_firmware (HW + FW)
 *    - firmware_software_existing_hardware (FW + SW on existing HW)
 *    - hardware_firmware_software (HW + FW + SW)
 *    - ready_made (Commercial off-the-shelf deployment)
 *    Plus legacy mappings (turnkey, software, firmware).
 * 2. 89 Canonical Stage Templates & 178 Default Task Templates.
 * 3. Progressive Task Generation (active assigned tasks generated only for ready stages).
 * 4. Editable Custom Tasks and Stage-Plan Changes (per project, no global template mutation).
 * 5. Consolidated Tentative-BOM Costing & Sourcing Handoff (EHW submits tentative BOM;
 *    PUR performs 1 linked BOM costing analysis; RAM price is a line item, not a default task;
 *    HW_05 does NOT require later tentative BOM; HW_19:T02 is PUR-owned; FW_01 sizing is technical feasibility).
 * 6. The 8 Connected Sample Projects + 1 Declined Enquiry Pack (LC2-P01 to LC2-P09).
 */

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

export interface TrackMetadata {
  track: CanonicalProjectTrack;
  label: string;
  shortDescription: string;
  technicalDepartments: string[];
  requiresNewHardware: boolean;
  requiresFirmware: boolean;
  requiresSoftware: boolean;
  isReadyMade: boolean;
}

export const CANONICAL_TRACK_METADATA: Record<CanonicalProjectTrack, TrackMetadata> = {
  hardware_only: {
    track: "hardware_only",
    label: "Hardware Only (EHW)",
    shortDescription: "Custom electrical hardware, schematics, PCB, enclosure fitment, and manufacturing; no custom firmware or cloud software development.",
    technicalDepartments: ["EHW", "MECH", "PUR", "EMF", "MMF"],
    requiresNewHardware: true,
    requiresFirmware: false,
    requiresSoftware: false,
    isReadyMade: false,
  },
  firmware_only: {
    track: "firmware_only",
    label: "Firmware Only (FW on Existing Hardware)",
    shortDescription: "Embedded firmware implementation on an existing, verified hardware platform; hardware consulted only for true interface dependencies; no new PCB development.",
    technicalDepartments: ["FW"],
    requiresNewHardware: false,
    requiresFirmware: true,
    requiresSoftware: false,
    isReadyMade: false,
  },
  software_only: {
    track: "software_only",
    label: "Software Only (Cloud & Application)",
    shortDescription: "Cloud microservices, web apps, API endpoints, telemetry ingest and dashboards; no mandatory PCB, BOM, or embedded hardware tasks.",
    technicalDepartments: ["SW"],
    requiresNewHardware: false,
    requiresFirmware: false,
    requiresSoftware: true,
    isReadyMade: false,
  },
  hardware_firmware: {
    track: "hardware_firmware",
    label: "Hardware + Firmware (EHW + FW)",
    shortDescription: "Co-developed embedded hardware board and firmware runtime, joint bring-up, and verification.",
    technicalDepartments: ["EHW", "FW", "MECH", "PUR", "EMF", "MMF"],
    requiresNewHardware: true,
    requiresFirmware: true,
    requiresSoftware: false,
    isReadyMade: false,
  },
  firmware_software_existing_hardware: {
    track: "firmware_software_existing_hardware",
    label: "Firmware + Software on Existing Hardware (FW + SW)",
    shortDescription: "Device firmware and cloud/application software on an existing hardware platform; joint interface contracts and coordinated releases; no new PCB development.",
    technicalDepartments: ["FW", "SW"],
    requiresNewHardware: false,
    requiresFirmware: true,
    requiresSoftware: true,
    isReadyMade: false,
  },
  hardware_firmware_software: {
    track: "hardware_firmware_software",
    label: "Hardware + Firmware + Software (Turnkey)",
    shortDescription: "Full turnkey product development spanning embedded hardware, device firmware, and cloud/application software.",
    technicalDepartments: ["EHW", "FW", "SW", "MECH", "PUR", "EMF", "MMF"],
    requiresNewHardware: true,
    requiresFirmware: true,
    requiresSoftware: true,
    isReadyMade: false,
  },
  ready_made: {
    track: "ready_made",
    label: "Ready-Made Deployment (Commercial Catalog)",
    shortDescription: "Direct deployment of an existing, manufactured catalog device with technical data sheet and sales brochure; requires zero custom engineering development.",
    technicalDepartments: [],
    requiresNewHardware: false,
    requiresFirmware: false,
    requiresSoftware: false,
    isReadyMade: true,
  },
};

export function normalizeCanonicalTrack(track: string): CanonicalProjectTrack {
  const t = (track || "").trim().toLowerCase().replace(/-/g, "_");
  if (t === "turnkey" || t === "hardware_firmware_software" || t === "hw_fw_sw" || t === "hw+fw+sw") {
    return "hardware_firmware_software";
  }
  if (t === "software" || t === "software_only" || t === "sw") {
    return "software_only";
  }
  if (t === "firmware" || t === "firmware_only" || t === "fw") {
    return "firmware_only";
  }
  if (t === "hardware" || t === "hardware_only" || t === "ehw" || t === "hw") {
    return "hardware_only";
  }
  if (t === "hardware_firmware" || t === "hardware+firmware" || t === "hw_fw" || t === "hw+fw") {
    return "hardware_firmware";
  }
  if (
    t === "firmware_software_existing_hardware" ||
    t === "firmware_software" ||
    t === "fw_sw" ||
    t === "fw+sw" ||
    t === "firmware_software_existing_hw"
  ) {
    return "firmware_software_existing_hardware";
  }
  if (t === "ready_made" || t === "readymade" || t === "catalog" || t === "commercial") {
    return "ready_made";
  }
  return "hardware_firmware_software";
}

export interface CanonicalTaskTemplate {
  taskKey: string; // e.g. "LC2-2026-10-28:HW_19:T01"
  taskNumber: "T01" | "T02";
  title: string;
  defaultOwner: string; // Responsible department
  description: string;
}

export interface CanonicalStageTemplate {
  stageCode: string; // e.g. "HW_19"
  stageKey: string;  // e.g. "LC2-2026-10-28:HW_19"
  phaseCode: string; // e.g. "HW-P3"
  phaseTitle: string;
  name: string;
  defaultOwner: string; // Responsible department
  prerequisites: string[]; // Stage codes that must complete first
  applicabilityNote?: string;
  t01: CanonicalTaskTemplate;
  t02: CanonicalTaskTemplate;
}

export const TEMPLATE_NAMESPACE = "LC2-2026-10-28";

/**
 * All 89 Canonical Stage Templates & 178 Default Tasks (§16.10, Sample Data and Test Plan)
 */
export const CANONICAL_STAGE_TEMPLATES: CanonicalStageTemplate[] = [
  // ==========================================
  // CM-P1: Common Request / Feasibility (2 stages, 4 tasks)
  // ==========================================
  {
    stageCode: "CM_01",
    stageKey: `${TEMPLATE_NAMESPACE}:CM_01`,
    phaseCode: "CM-P1",
    phaseTitle: "Common Request and Intake",
    name: "Request and input capture",
    defaultOwner: "SAL",
    prerequisites: [],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:CM_01:T01`,
      taskNumber: "T01",
      title: "Capture internal request or client source and objective",
      defaultOwner: "SAL",
      description: "Intake customer SOR or internal operational equipment requirement into shared system.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:CM_01:T02`,
      taskNumber: "T02",
      title: "Link verified input sources and identify missing values",
      defaultOwner: "SAL",
      description: "Map input parameters, tag unknown values, and prevent invented requirements.",
    },
  },
  {
    stageCode: "CM_02",
    stageKey: `${TEMPLATE_NAMESPACE}:CM_02`,
    phaseCode: "CM-P1",
    phaseTitle: "Common Request and Intake",
    name: "Applicable feasibility review",
    defaultOwner: "SAL",
    prerequisites: ["CM_01"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:CM_02:T01`,
      taskNumber: "T01",
      title: "Collect relevant departmental feasibility remarks and risks",
      defaultOwner: "SAL",
      description: "Gather feedback from applicable departments (EHW, FW, SW, MECH, PUR, QA, EMF, FIN, SIT, HR).",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:CM_02:T02`,
      taskNumber: "T02",
      title: "Record accepted scope or reasoned decline without creating a dummy project",
      defaultOwner: "SAL",
      description: "If unfeasible (e.g. lead time > client window), record reasoned decline and terminate without creating project.",
    },
  },

  // ==========================================
  // CM-P2: Common Baseline / Plan (2 stages, 4 tasks)
  // ==========================================
  {
    stageCode: "CM_03",
    stageKey: `${TEMPLATE_NAMESPACE}:CM_03`,
    phaseCode: "CM-P2",
    phaseTitle: "Common Baseline & Planning",
    name: "Requirements baseline",
    defaultOwner: "SAL",
    prerequisites: ["CM_02"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:CM_03:T01`,
      taskNumber: "T01",
      title: "Resolve required parameters and document exclusions",
      defaultOwner: "SAL",
      description: "Synthesize agreed technical parameters into domain specifications and document non-applicable items.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:CM_03:T02`,
      taskNumber: "T02",
      title: "Route baseline to existing authorized approvers",
      defaultOwner: "SAL",
      description: "Obtain formal gate review from domain leads according to governance authority.",
    },
  },
  {
    stageCode: "CM_04",
    stageKey: `${TEMPLATE_NAMESPACE}:CM_04`,
    phaseCode: "CM-P2",
    phaseTitle: "Common Baseline & Planning",
    name: "Plan and kickoff",
    defaultOwner: "SAL",
    prerequisites: ["CM_03"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:CM_04:T01`,
      taskNumber: "T01",
      title: "Assign accountable owners and dependency-aware schedule",
      defaultOwner: "SAL",
      description: "Establish project work breakdown and allocate lead responsibilities.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:CM_04:T02`,
      taskNumber: "T02",
      title: "Record kickoff decisions and agreed acceptance criteria",
      defaultOwner: "SAL",
      description: "Freeze kickoff agreement, milestone targets, and baseline project timeline.",
    },
  },

  // ==========================================
  // HW-P1: Hardware Requirements / Feasibility (5 stages, 10 tasks)
  // ==========================================
  {
    stageCode: "HW_01",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_01`,
    phaseCode: "HW-P1",
    phaseTitle: "Hardware Requirements & Feasibility",
    name: "Hardware requirement capture",
    defaultOwner: "EHW",
    prerequisites: ["CM_01"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_01:T01`,
      taskNumber: "T01",
      title: "Review electrical and physical requirements with source provenance",
      defaultOwner: "EHW",
      description: "Extract voltage, power, protection, interface, and environmental parameters from source input.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_01:T02`,
      taskNumber: "T02",
      title: "Record clarification queries and missing parameters",
      defaultOwner: "EHW",
      description: "Log explicit clarification queries back to client or internal requesting lead.",
    },
  },
  {
    stageCode: "HW_02",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_02`,
    phaseCode: "HW-P1",
    phaseTitle: "Hardware Requirements & Feasibility",
    name: "Hardware PRS baseline",
    defaultOwner: "EHW",
    prerequisites: ["HW_01", "CM_03"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_02:T01`,
      taskNumber: "T01",
      title: "Populate the shared electrical and interface parameter table",
      defaultOwner: "EHW",
      description: "Complete formal Product Requirement Specification (PRS) parameter table.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_02:T02`,
      taskNumber: "T02",
      title: "Review the hardware requirement baseline through existing authority",
      defaultOwner: "EHW",
      description: "Submit PRS revision for engineering and QA baseline sign-off.",
    },
  },
  {
    stageCode: "HW_03",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_03`,
    phaseCode: "HW-P1",
    phaseTitle: "Hardware Requirements & Feasibility",
    name: "Component feasibility and alternatives",
    defaultOwner: "EHW",
    prerequisites: ["HW_01"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_03:T01`,
      taskNumber: "T01",
      title: "Search canonical parts and compare supported alternatives",
      defaultOwner: "EHW",
      description: "Identify candidate microcontrollers, power ICs, and transceivers from existing part library.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_03:T02`,
      taskNumber: "T02",
      title: "Link sourcing availability and obsolescence risks from approved sources",
      defaultOwner: "EHW",
      description: "Check lifecycle status, lead times, and second-source viability.",
    },
  },
  {
    stageCode: "HW_04",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_04`,
    phaseCode: "HW-P1",
    phaseTitle: "Hardware Requirements & Feasibility",
    name: "System architecture and power tree",
    defaultOwner: "EHW",
    prerequisites: ["HW_02", "HW_03"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_04:T01`,
      taskNumber: "T01",
      title: "Draft functional blocks and interface boundaries",
      defaultOwner: "EHW",
      description: "Define power domains, signal routing topology, and isolation boundaries.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_04:T02`,
      taskNumber: "T02",
      title: "Calculate power and thermal budgets from approved requirements",
      defaultOwner: "EHW",
      description: "Compute sleep, peak, and average current draws, regulator efficiency, and dissipation.",
    },
  },
  {
    stageCode: "HW_05",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_05`,
    phaseCode: "HW-P1",
    phaseTitle: "Hardware Requirements & Feasibility",
    name: "Initial technical feasibility response",
    defaultOwner: "EHW",
    prerequisites: ["HW_03", "HW_04"], // HW_05 does NOT require the later tentative BOM (HW_19)
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_05:T01`,
      taskNumber: "T01",
      title: "Record architecture and component assumptions without requiring the later tentative BOM",
      defaultOwner: "EHW",
      description: "Document early technical feasibility assumptions, power tree feasibility, and package constraints.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_05:T02`,
      taskNumber: "T02",
      title: "Submit technical feasibility, risks and unresolved commercial assumptions",
      defaultOwner: "EHW",
      description: "Provide technical response to Sales for inclusion in consolidated contract review.",
    },
  },

  // ==========================================
  // HW-P2: Hardware Architecture / Schematic (11 stages, 22 tasks)
  // ==========================================
  {
    stageCode: "HW_06",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_06`,
    phaseCode: "HW-P2",
    phaseTitle: "Hardware Architecture & Schematic",
    name: "Evaluation setup or breadboard",
    defaultOwner: "EHW",
    prerequisites: ["HW_04", "HW_05"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_06:T01`,
      taskNumber: "T01",
      title: "Select existing evaluation boards and bench setup",
      defaultOwner: "EHW",
      description: "Configure dev kits and test instruments to de-risk novel circuit blocks.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_06:T02`,
      taskNumber: "T02",
      title: "Record configuration and verify the required concept functions",
      defaultOwner: "EHW",
      description: "Confirm power sequencing, clock stability, and critical communication waveforms.",
    },
  },
  {
    stageCode: "HW_07",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_07`,
    phaseCode: "HW-P2",
    phaseTitle: "Hardware Architecture & Schematic",
    name: "Prototype component request",
    defaultOwner: "EHW",
    prerequisites: ["HW_03"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_07:T01`,
      taskNumber: "T01",
      title: "Select canonical part revisions and requested quantities",
      defaultOwner: "EHW",
      description: "Compile engineering sample requisition with exact manufacturer part numbers.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_07:T02`,
      taskNumber: "T02",
      title: "Submit linked prototype request with approved alternates where available",
      defaultOwner: "EHW",
      description: "Submit sample requisition to Purchasing with approved pin-compatible alternates.",
    },
  },
  {
    stageCode: "HW_08",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_08`,
    phaseCode: "HW-P2",
    phaseTitle: "Hardware Architecture & Schematic",
    name: "Prototype procurement and acceptance references",
    defaultOwner: "PUR",
    prerequisites: ["HW_07"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_08:T01`,
      taskNumber: "T01",
      title: "Link authorized supplier order and receipt records",
      defaultOwner: "PUR",
      description: "Issue sample POs to franchised distributors and track incoming delivery.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_08:T02`,
      taskNumber: "T02",
      title: "Obtain QA acceptance or keep held components unavailable",
      defaultOwner: "PUR",
      description: "Coordinate Goods Receipt Note (GRN) and incoming inspection disposition.",
    },
  },
  {
    stageCode: "HW_09",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_09`,
    phaseCode: "HW-P2",
    phaseTitle: "Hardware Architecture & Schematic",
    name: "Pinout and draft hardware-firmware interface",
    defaultOwner: "EHW",
    prerequisites: ["HW_04"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_09:T01`,
      taskNumber: "T01",
      title: "Review required pin assignments and conflicts",
      defaultOwner: "EHW",
      description: "Map MCU GPIO, timers, SPI, I2C, UART, and CAN peripheral pins without resource conflicts.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_09:T02`,
      taskNumber: "T02",
      title: "Record the joint interface baseline or existing-platform reference",
      defaultOwner: "EHW",
      description: "Publish Hardware-Software Interface (HSI) draft and obtain Firmware Lead sign-off.",
    },
  },
  {
    stageCode: "HW_10",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_10`,
    phaseCode: "HW-P2",
    phaseTitle: "Hardware Architecture & Schematic",
    name: "Circuit calculations and simulation",
    defaultOwner: "EHW",
    prerequisites: ["HW_04"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_10:T01`,
      taskNumber: "T01",
      title: "Calculate selected circuit blocks against source requirements",
      defaultOwner: "EHW",
      description: "Calculate buck inductor saturation, TVS energy ratings, voltage dividers, and pull-up values.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_10:T02`,
      taskNumber: "T02",
      title: "Link native simulation evidence and design assumptions",
      defaultOwner: "EHW",
      description: "Attach SPICE simulations, DC operating points, and transient stability curves.",
    },
  },
  {
    stageCode: "HW_11",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_11`,
    phaseCode: "HW-P2",
    phaseTitle: "Hardware Architecture & Schematic",
    name: "Symbols footprints and native models",
    defaultOwner: "EHW",
    prerequisites: ["HW_03"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_11:T01`,
      taskNumber: "T01",
      title: "Validate library pin mappings and package footprints",
      defaultOwner: "EHW",
      description: "Verify PCB land patterns against IPC-7351B standards and component datasheets.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_11:T02`,
      taskNumber: "T02",
      title: "Attach authorized native model references and library revision",
      defaultOwner: "EHW",
      description: "Link validated 3D STEP models and schematic library symbols.",
    },
  },
  {
    stageCode: "HW_12",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_12`,
    phaseCode: "HW-P2",
    phaseTitle: "Hardware Architecture & Schematic",
    name: "Concept peripheral and signal checks",
    defaultOwner: "EHW",
    prerequisites: ["HW_06", "HW_08"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_12:T01`,
      taskNumber: "T01",
      title: "Run approved bench checks using available test tools",
      defaultOwner: "EHW",
      description: "Probe signal integrity, rise times, and power rail ripple on breadboard prototype.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_12:T02`,
      taskNumber: "T02",
      title: "Record interface observations and linked firmware build only where applicable",
      defaultOwner: "EHW",
      description: "Record oscilloscope captures and test code revision.",
    },
  },
  {
    stageCode: "HW_13",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_13`,
    phaseCode: "HW-P2",
    phaseTitle: "Hardware Architecture & Schematic",
    name: "Design risk review",
    defaultOwner: "EHW",
    prerequisites: ["HW_04", "HW_10"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_13:T01`,
      taskNumber: "T01",
      title: "Identify circuit failure modes and mitigation actions",
      defaultOwner: "EHW",
      description: "Examine reverse polarity, overvoltage, short circuit, and thermal runaway risks.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_13:T02`,
      taskNumber: "T02",
      title: "Review risks using the applicable company-approved method",
      defaultOwner: "EHW",
      description: "Populate hardware failure mode catalog or initial DFMEA input sheet.",
    },
  },
  {
    stageCode: "HW_14",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_14`,
    phaseCode: "HW-P2",
    phaseTitle: "Hardware Architecture & Schematic",
    name: "Verification planning",
    defaultOwner: "QA",
    prerequisites: ["HW_02", "HW_13"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_14:T01`,
      taskNumber: "T01",
      title: "Map requirements to tests criteria units and configurations",
      defaultOwner: "QA",
      description: "Draft Design Verification Plan & Report (DVP&R) matrix with test criteria and limits.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_14:T02`,
      taskNumber: "T02",
      title: "Review planned evidence and applicable external testing needs",
      defaultOwner: "QA",
      description: "Determine in-house bench verification vs. external accredited lab testing scope.",
    },
  },
  {
    stageCode: "HW_15",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_15`,
    phaseCode: "HW-P2",
    phaseTitle: "Hardware Architecture & Schematic",
    name: "Schematic preparation",
    defaultOwner: "EHW",
    prerequisites: ["HW_09", "HW_10", "HW_11"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_15:T01`,
      taskNumber: "T01",
      title: "Create revisioned schematics in the engineering tool",
      defaultOwner: "EHW",
      description: "Draft complete hierarchical schematics in ECAD with proper net classes and rules.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_15:T02`,
      taskNumber: "T02",
      title: "Link the native schematic and source requirements",
      defaultOwner: "EHW",
      description: "Export readable PDF schematic (EHW-SCH-01) and pin native project revision.",
    },
  },
  {
    stageCode: "HW_16",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_16`,
    phaseCode: "HW-P2",
    phaseTitle: "Hardware Architecture & Schematic",
    name: "Schematic review",
    defaultOwner: "EHW",
    prerequisites: ["HW_15", "HW_13"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_16:T01`,
      taskNumber: "T01",
      title: "Run configured electrical checks and peer review",
      defaultOwner: "EHW",
      description: "Execute Electrical Rules Check (ERC) with zero unhandled errors.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_16:T02`,
      taskNumber: "T02",
      title: "Resolve findings and record the authorized review decision",
      defaultOwner: "EHW",
      description: "Sign off formal schematic review gate and release for layout.",
    },
  },

  // ==========================================
  // HW-P3: Hardware Layout / Native Outputs (8 stages, 16 tasks)
  // ==========================================
  {
    stageCode: "HW_17",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_17`,
    phaseCode: "HW-P3",
    phaseTitle: "Hardware Layout & Native Outputs",
    name: "Mechanical interface and board outline",
    defaultOwner: "MECH",
    prerequisites: ["HW_16"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_17:T01`,
      taskNumber: "T01",
      title: "Confirm outline mounting connector and height constraints",
      defaultOwner: "MECH",
      description: "Establish PCB keepouts, mounting hole coordinates, and maximum component height limits.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_17:T02`,
      taskNumber: "T02",
      title: "Link existing or revised drawing STEP and outline files",
      defaultOwner: "MECH",
      description: "Export DXF/STEP board outline to ECAD layout environment.",
    },
  },
  {
    stageCode: "HW_18",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_18`,
    phaseCode: "HW-P3",
    phaseTitle: "Hardware Layout & Native Outputs",
    name: "Placement and floorplan",
    defaultOwner: "EHW",
    prerequisites: ["HW_16", "HW_17"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_18:T01`,
      taskNumber: "T01",
      title: "Place parts using the approved interface constraints",
      defaultOwner: "EHW",
      description: "Floorplan power stages, RF front-ends, MCU, decoupling capacitors, and connectors.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_18:T02`,
      taskNumber: "T02",
      title: "Review power signal thermal and accessibility concerns",
      defaultOwner: "EHW",
      description: "Check thermal relief, isolation clearances, and test point accessibility.",
    },
  },
  {
    stageCode: "HW_19",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_19`,
    phaseCode: "HW-P3",
    phaseTitle: "Hardware Layout & Native Outputs",
    name: "Tentative BOM and sourcing analysis",
    defaultOwner: "EHW", // Stage lead EHW, T02 is PUR-owned
    prerequisites: ["HW_16"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_19:T01`,
      taskNumber: "T01",
      title: "EHW submits the tentative revisioned BOM with canonical part links and quantities",
      defaultOwner: "EHW",
      description: "Export tentative preliminary BOM from schematic revision with exact MPNs and quantities.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_19:T02`,
      taskNumber: "T02",
      title: "PUR completes one linked BOM-level costing, availability and lead-time analysis without implying production release",
      defaultOwner: "PUR",
      description: "Perform consolidated supplier pricing, stock check, and lead-time analysis. RAM and other component prices are line items in this linked analysis, not separate tasks.",
    },
  },
  {
    stageCode: "HW_20",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_20`,
    phaseCode: "HW-P3",
    phaseTitle: "Hardware Layout & Native Outputs",
    name: "Fit and thermal review",
    defaultOwner: "MECH",
    prerequisites: ["HW_17", "HW_18"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_20:T01`,
      taskNumber: "T01",
      title: "Check populated board fit against enclosure references",
      defaultOwner: "MECH",
      description: "Import 3D ECAD assembly into MCAD to verify enclosure clearances and connector alignment.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_20:T02`,
      taskNumber: "T02",
      title: "Record clearance thermal findings and required changes",
      defaultOwner: "MECH",
      description: "Verify heat sink contact, potting volume, and IP seal compression.",
    },
  },
  {
    stageCode: "HW_21",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_21`,
    phaseCode: "HW-P3",
    phaseTitle: "Hardware Layout & Native Outputs",
    name: "PCB stackup and routing",
    defaultOwner: "EHW",
    prerequisites: ["HW_18", "HW_20"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_21:T01`,
      taskNumber: "T01",
      title: "Route against approved stackup and electrical constraints",
      defaultOwner: "EHW",
      description: "Route high-speed differential pairs, controlled impedance traces, and power planes.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_21:T02`,
      taskNumber: "T02",
      title: "Review return paths clearances and required impedance targets",
      defaultOwner: "EHW",
      description: "Verify continuous ground reference planes, via stitching, and creepage/clearance rules.",
    },
  },
  {
    stageCode: "HW_22",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_22`,
    phaseCode: "HW-P3",
    phaseTitle: "Hardware Layout & Native Outputs",
    name: "Board marking and fabrication preparation",
    defaultOwner: "EHW",
    prerequisites: ["HW_21"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_22:T01`,
      taskNumber: "T01",
      title: "Review identifiers polarity revision markings and fiducials",
      defaultOwner: "EHW",
      description: "Place silkscreen pin 1 indicators, test point legends, assembly fiducials, and QR/barcode areas.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_22:T02`,
      taskNumber: "T02",
      title: "Define applicable panel constraints with the supplier",
      defaultOwner: "EHW",
      description: "Confirm PCB panelization array, V-score lines, and mouse-bite breakaways with fabricator.",
    },
  },
  {
    stageCode: "HW_23",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_23`,
    phaseCode: "HW-P3",
    phaseTitle: "Hardware Layout & Native Outputs",
    name: "Layout and manufacturability review",
    defaultOwner: "EHW",
    prerequisites: ["HW_21", "HW_22"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_23:T01`,
      taskNumber: "T01",
      title: "Run configured DRC and supplier DFM checks",
      defaultOwner: "EHW",
      description: "Execute Design Rule Check (DRC) against PCB manufacturer capabilities.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_23:T02`,
      taskNumber: "T02",
      title: "Record and close peer-review findings before export",
      defaultOwner: "EHW",
      description: "Complete formal layout sign-off with Embedded Hardware and Manufacturing leads.",
    },
  },
  {
    stageCode: "HW_24",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_24`,
    phaseCode: "HW-P3",
    phaseTitle: "Hardware Layout & Native Outputs",
    name: "Prototype fabrication package",
    defaultOwner: "EHW",
    prerequisites: ["HW_23"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_24:T01`,
      taskNumber: "T01",
      title: "Export native-tool Gerber drill and assembly outputs",
      defaultOwner: "EHW",
      description: "Generate Gerber RS-274X/X2, Excellon drill files, pick-and-place centroids, and assembly drawings.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_24:T02`,
      taskNumber: "T02",
      title: "Register original package revision and integrity hash",
      defaultOwner: "EHW",
      description: "Compute SHA-256 checksum of fabrication ZIP and archive in Document Vault.",
    },
  },

  // ==========================================
  // HW-P4: Hardware Prototype / Verification (8 stages, 16 tasks)
  // ==========================================
  {
    stageCode: "HW_25",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_25`,
    phaseCode: "HW-P4",
    phaseTitle: "Hardware Prototype & Verification",
    name: "Authorized supplier fabrication request",
    defaultOwner: "PUR",
    prerequisites: ["HW_24"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_25:T01`,
      taskNumber: "T01",
      title: "Link approved supplier request for PCB PCBA and stencil as applicable",
      defaultOwner: "PUR",
      description: "Place fabrication PO with approved PCB fabricator and assembly house.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_25:T02`,
      taskNumber: "T02",
      title: "Resolve fabrication questions against the exact package revision",
      defaultOwner: "PUR",
      description: "Handle supplier engineering queries (EQs) with EHW lead.",
    },
  },
  {
    stageCode: "HW_26",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_26`,
    phaseCode: "HW-P4",
    phaseTitle: "Hardware Prototype & Verification",
    name: "Prototype enclosure and kitting",
    defaultOwner: "MMF",
    prerequisites: ["HW_17", "HW_19"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_26:T01`,
      taskNumber: "T01",
      title: "Link authorized prototype enclosure drawing or existing case",
      defaultOwner: "MMF",
      description: "Produce 3D printed or soft-tooled prototype enclosures, gaskets, and light pipes.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_26:T02`,
      taskNumber: "T02",
      title: "Prepare a traceable kit through the agreed inventory source",
      defaultOwner: "MMF",
      description: "Kit mechanical fasteners, harnesses, and housings for assembly.",
    },
  },
  {
    stageCode: "HW_27",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_27`,
    phaseCode: "HW-P4",
    phaseTitle: "Hardware Prototype & Verification",
    name: "Applicable pre-compliance evidence",
    defaultOwner: "QA",
    prerequisites: ["HW_32"], // HW_32 functional validation precedes formal pre-compliance
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_27:T01`,
      taskNumber: "T01",
      title: "Coordinate the applicable formal pre-compliance checks",
      defaultOwner: "QA",
      description: "Conduct preliminary radiated emissions, ESD immunity, and conducted transient testing.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_27:T02`,
      taskNumber: "T02",
      title: "Link QA test evidence rather than duplicate C08 execution tasks",
      defaultOwner: "QA",
      description: "Attach certified pre-compliance test report and log findings.",
    },
  },
  {
    stageCode: "HW_28",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_28`,
    phaseCode: "HW-P4",
    phaseTitle: "Hardware Prototype & Verification",
    name: "Verified final hardware-firmware interface",
    defaultOwner: "EHW",
    prerequisites: ["HW_09", "HW_31"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_28:T01`,
      taskNumber: "T01",
      title: "Verify actual pin behaviour and electrical scaling",
      defaultOwner: "EHW",
      description: "Verify ADC scaling, GPIO logic thresholds, interrupt latencies, and clock frequencies.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_28:T02`,
      taskNumber: "T02",
      title: "Record the final joint interface reference where firmware is in scope",
      defaultOwner: "EHW",
      description: "Freeze finalized Hardware-Software Interface document revision.",
    },
  },
  {
    stageCode: "HW_29",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_29`,
    phaseCode: "HW-P4",
    phaseTitle: "Hardware Prototype & Verification",
    name: "Production test fixture readiness",
    defaultOwner: "EMF",
    prerequisites: ["HW_14", "HW_16"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_29:T01`,
      taskNumber: "T01",
      title: "Link the approved test fixture design and diagnostic interface",
      defaultOwner: "EMF",
      description: "Fabricate bed-of-nails pogo pin jig and connect flashing harness.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_29:T02`,
      taskNumber: "T02",
      title: "Verify fixture readiness when production testing is required",
      defaultOwner: "EMF",
      description: "Validate automated test script coverage and pass/fail thresholds.",
    },
  },
  {
    stageCode: "HW_30",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_30`,
    phaseCode: "HW-P4",
    phaseTitle: "Hardware Prototype & Verification",
    name: "Outsourced PCBA receipt and prototype box-build",
    defaultOwner: "EMF",
    prerequisites: ["HW_25", "HW_08"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_30:T01`,
      taskNumber: "T01",
      title: "Link supplier assembly receipt and independent QA disposition",
      defaultOwner: "EMF",
      description: "Receive assembled PCBAs from outsourced contract manufacturer; record incoming QA lot check.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_30:T02`,
      taskNumber: "T02",
      title: "Perform applicable authorized box-build and inspection checks",
      defaultOwner: "EMF",
      description: "Assemble PCBAs into prototype enclosures, attach harnesses, and inspect visual quality.",
    },
  },
  {
    stageCode: "HW_31",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_31`,
    phaseCode: "HW-P4",
    phaseTitle: "Hardware Prototype & Verification",
    name: "Board bring-up",
    defaultOwner: "EHW",
    prerequisites: ["HW_30"], // HW_30 receipt/assembly precedes HW_31 bring-up
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_31:T01`,
      taskNumber: "T01",
      title: "Perform approved current-limited power and basic interface checks",
      defaultOwner: "EHW",
      description: "Power up board on current-limited supply; verify voltage rails, reset lines, and crystal oscillation.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_31:T02`,
      taskNumber: "T02",
      title: "Record measurements against source criteria and log faults",
      defaultOwner: "EHW",
      description: "Document bring-up checklist results, voltage trims, and debug log.",
    },
  },
  {
    stageCode: "HW_32",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_32`,
    phaseCode: "HW-P4",
    phaseTitle: "Hardware Prototype & Verification",
    name: "Bench functional validation",
    defaultOwner: "EHW",
    prerequisites: ["HW_31", "HW_14"], // Precedes pre-compliance
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_32:T01`,
      taskNumber: "T01",
      title: "Execute the applicable bench validation plan on pinned revisions",
      defaultOwner: "EHW",
      description: "Execute DVP&R functional electrical test cases across minimum, nominal, and maximum operating voltages.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_32:T02`,
      taskNumber: "T02",
      title: "Link defects corrective iterations and retest evidence",
      defaultOwner: "EHW",
      description: "Log bench findings, rework notes, and verified corrective test evidence.",
    },
  },

  // ==========================================
  // HW-P5: Hardware Pilot / Release (5 stages, 10 tasks)
  // ==========================================
  {
    stageCode: "HW_33",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_33`,
    phaseCode: "HW-P5",
    phaseTitle: "Hardware Pilot & Release",
    name: "Pilot or field evaluation",
    defaultOwner: "EHW",
    prerequisites: ["HW_32", "HW_28"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_33:T01`,
      taskNumber: "T01",
      title: "Support the authorized pilot configuration and installation",
      defaultOwner: "EHW",
      description: "Provide engineering support for pilot vehicle/equipment installations.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_33:T02`,
      taskNumber: "T02",
      title: "Capture user feedback and unresolved acceptance conditions",
      defaultOwner: "EHW",
      description: "Collect telemetry, environmental exposure notes, and field bug reports.",
    },
  },
  {
    stageCode: "HW_34",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_34`,
    phaseCode: "HW-P5",
    phaseTitle: "Hardware Pilot & Release",
    name: "Production BOM baseline",
    defaultOwner: "EHW",
    prerequisites: ["HW_33", "HW_36"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_34:T01`,
      taskNumber: "T01",
      title: "Verify released part revisions and approved sourcing references",
      defaultOwner: "EHW",
      description: "Freeze mass production Bill of Materials with full approved manufacturer list (AML).",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_34:T02`,
      taskNumber: "T02",
      title: "Submit the final BOM through the configured release authority",
      defaultOwner: "EHW",
      description: "Obtain formal engineering and purchasing release approval for production BOM.",
    },
  },
  {
    stageCode: "HW_35",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_35`,
    phaseCode: "HW-P5",
    phaseTitle: "Hardware Pilot & Release",
    name: "Final fabrication and panel package",
    defaultOwner: "EHW",
    prerequisites: ["HW_34", "HW_23"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_35:T01`,
      taskNumber: "T01",
      title: "Export the approved native fabrication package and associated panel stencil files",
      defaultOwner: "EHW",
      description: "Generate production-grade panelized Gerbers, paste stencils, and pick-and-place files.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_35:T02`,
      taskNumber: "T02",
      title: "Pin the source Gerber revision checksum and release evidence",
      defaultOwner: "EHW",
      description: "Record production fabrication package checksum and archive in vault.",
    },
  },
  {
    stageCode: "HW_36",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_36`,
    phaseCode: "HW-P5",
    phaseTitle: "Hardware Pilot & Release",
    name: "Relevant design-change closure",
    defaultOwner: "EHW",
    prerequisites: ["HW_32"], // HW_36 corrective closure precedes final production release
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_36:T01`,
      taskNumber: "T01",
      title: "Resolve or formally disposition open design changes",
      defaultOwner: "EHW",
      description: "Close all Engineering Change Requests (ECRs) and Engineering Change Orders (ECOs).",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_36:T02`,
      taskNumber: "T02",
      title: "Preserve the prior revisions and link verified corrective evidence",
      defaultOwner: "EHW",
      description: "Maintain clear traceability between bug reports, ECOs, and verified retest results.",
    },
  },
  {
    stageCode: "HW_37",
    stageKey: `${TEMPLATE_NAMESPACE}:HW_37`,
    phaseCode: "HW-P5",
    phaseTitle: "Hardware Pilot & Release",
    name: "Production handover readiness",
    defaultOwner: "EMF",
    prerequisites: ["HW_34", "HW_35"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_37:T01`,
      taskNumber: "T01",
      title: "Review applicable design manufacturing and QA handover evidence",
      defaultOwner: "EMF",
      description: "Compile production traveler, assembly instructions, and quality control plan.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:HW_37:T02`,
      taskNumber: "T02",
      title: "Request authorized production release without auto-approving it",
      defaultOwner: "EMF",
      description: "Submit mass production authorization request to designated signatory.",
    },
  },

  // ==========================================
  // FW-P1: Firmware Scope / Interfaces (2 stages, 4 tasks)
  // ==========================================
  {
    stageCode: "FW_01",
    stageKey: `${TEMPLATE_NAMESPACE}:FW_01`,
    phaseCode: "FW-P1",
    phaseTitle: "Firmware Scope & Interfaces",
    name: "Firmware feasibility and target sizing",
    defaultOwner: "FW",
    prerequisites: ["CM_01"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_01:T01`,
      taskNumber: "T01",
      title: "Assess existing target resources and required behaviours",
      defaultOwner: "FW",
      description: "Size MCU Flash, RAM, CPU load, and sleep state transitions. (Technical feasibility, not a purchasing price task).",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_01:T02`,
      taskNumber: "T02",
      title: "Record firmware risks and implementation assumptions",
      defaultOwner: "FW",
      description: "Log memory limitations, RTOS stack allocations, and timing constraints.",
    },
  },
  {
    stageCode: "FW_02",
    stageKey: `${TEMPLATE_NAMESPACE}:FW_02`,
    phaseCode: "FW-P1",
    phaseTitle: "Firmware Scope & Interfaces",
    name: "Firmware requirements and interface proposal",
    defaultOwner: "FW",
    prerequisites: ["FW_01", "CM_03"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_02:T01`,
      taskNumber: "T01",
      title: "Define state behaviour and required peripheral protocol contracts",
      defaultOwner: "FW",
      description: "Specify CAN J1939, BLE, cellular modem AT commands, and power mode state machines.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_02:T02`,
      taskNumber: "T02",
      title: "Review interface proposals against the selected existing or new hardware baseline",
      defaultOwner: "FW",
      description: "Reconcile register map, baud rates, and hardware pinout with EHW lead.",
    },
  },

  // ==========================================
  // FW-P2: Firmware Architecture / Environment (2 stages, 4 tasks)
  // ==========================================
  {
    stageCode: "FW_03",
    stageKey: `${TEMPLATE_NAMESPACE}:FW_03`,
    phaseCode: "FW-P2",
    phaseTitle: "Firmware Architecture & Environment",
    name: "Firmware architecture",
    defaultOwner: "FW",
    prerequisites: ["FW_02"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_03:T01`,
      taskNumber: "T01",
      title: "Design scheduling memory fault handling and persistence",
      defaultOwner: "FW",
      description: "Structure RTOS task priorities, queues, flash wear leveling, and watchdog recovery.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_03:T02`,
      taskNumber: "T02",
      title: "Review resource allocation and testability",
      defaultOwner: "FW",
      description: "Conduct peer review on memory allocation, ISR latencies, and deadlock prevention.",
    },
  },
  {
    stageCode: "FW_04",
    stageKey: `${TEMPLATE_NAMESPACE}:FW_04`,
    phaseCode: "FW-P2",
    phaseTitle: "Firmware Architecture & Environment",
    name: "Toolchain and evaluation environment",
    defaultOwner: "FW",
    prerequisites: ["FW_03"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_04:T01`,
      taskNumber: "T01",
      title: "Configure the approved source toolchain and reproducible build",
      defaultOwner: "FW",
      description: "Set up compiler toolchain (GCC/Clang), static analysis (cppcheck/clang-tidy), and automated build script.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_04:T02`,
      taskNumber: "T02",
      title: "Verify the development target and mock interfaces",
      defaultOwner: "FW",
      description: "Validate SWD/JTAG flashing, semi-hosting debug output, and hardware register mocks.",
    },
  },

  // ==========================================
  // FW-P3: Firmware Implementation (2 stages, 4 tasks)
  // ==========================================
  {
    stageCode: "FW_05",
    stageKey: `${TEMPLATE_NAMESPACE}:FW_05`,
    phaseCode: "FW-P3",
    phaseTitle: "Firmware Implementation",
    name: "Core drivers and protocol implementation",
    defaultOwner: "FW",
    prerequisites: ["FW_04"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_05:T01`,
      taskNumber: "T01",
      title: "Implement only the required hardware abstraction and protocol behaviours",
      defaultOwner: "FW",
      description: "Write HAL drivers for UART, SPI, I2C, CAN, and cellular modem network stack.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_05:T02`,
      taskNumber: "T02",
      title: "Link code changes and module checks to requirements",
      defaultOwner: "FW",
      description: "Commit tested driver modules with traceability to requirement specification.",
    },
  },
  {
    stageCode: "FW_06",
    stageKey: `${TEMPLATE_NAMESPACE}:FW_06`,
    phaseCode: "FW-P3",
    phaseTitle: "Firmware Implementation",
    name: "Application security update and power behaviour",
    defaultOwner: "FW",
    prerequisites: ["FW_05"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_06:T01`,
      taskNumber: "T01",
      title: "Implement applicable application state and power logic",
      defaultOwner: "FW",
      description: "Code telemetry packing, GPS fix filtering, ignition debounce, and deep sleep triggers.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_06:T02`,
      taskNumber: "T02",
      title: "Implement and verify secure update or boot behaviour only where required",
      defaultOwner: "FW",
      description: "Implement dual-bank OTA bootloader with cryptographic signature verification and fallback.",
    },
  },

  // ==========================================
  // FW-P4: Firmware Verification / Integration (5 stages, 10 tasks)
  // ==========================================
  {
    stageCode: "FW_07",
    stageKey: `${TEMPLATE_NAMESPACE}:FW_07`,
    phaseCode: "FW-P4",
    phaseTitle: "Firmware Verification & Integration",
    name: "Code review and unit verification",
    defaultOwner: "FW",
    prerequisites: ["FW_05", "FW_06"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_07:T01`,
      taskNumber: "T01",
      title: "Run agreed static analysis and unit checks",
      defaultOwner: "FW",
      description: "Run automated unit test suite and MISRA C guideline conformance checks.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_07:T02`,
      taskNumber: "T02",
      title: "Record peer review and fix required findings without invented coverage thresholds",
      defaultOwner: "FW",
      description: "Conduct engineering peer review; close blocking code comments.",
    },
  },
  {
    stageCode: "FW_08",
    stageKey: `${TEMPLATE_NAMESPACE}:FW_08`,
    phaseCode: "FW-P4",
    phaseTitle: "Firmware Verification & Integration",
    name: "Target integration",
    defaultOwner: "FW",
    prerequisites: ["FW_07"], // plus HW_31 when new hardware is selected
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_08:T01`,
      taskNumber: "T01",
      title: "Integrate against the pinned target and HSI revision",
      defaultOwner: "FW",
      description: "Flash firmware onto physical hardware target and test end-to-end peripheral control.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_08:T02`,
      taskNumber: "T02",
      title: "Record timing peripheral and configuration findings",
      defaultOwner: "FW",
      description: "Log logic analyzer traces, bus contention events, and timing jitter.",
    },
  },
  {
    stageCode: "FW_09",
    stageKey: `${TEMPLATE_NAMESPACE}:FW_09`,
    phaseCode: "FW-P4",
    phaseTitle: "Firmware Verification & Integration",
    name: "Production diagnostic support",
    defaultOwner: "FW",
    prerequisites: ["FW_08"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_09:T01`,
      taskNumber: "T01",
      title: "Prepare diagnostic firmware or test interface when required",
      defaultOwner: "FW",
      description: "Build factory test image with automated self-test commands for production jig.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_09:T02`,
      taskNumber: "T02",
      title: "Verify its controlled handoff to the production test fixture",
      defaultOwner: "FW",
      description: "Handoff diagnostic protocol to Electronics Manufacturing lead.",
    },
  },
  {
    stageCode: "FW_10",
    stageKey: `${TEMPLATE_NAMESPACE}:FW_10`,
    phaseCode: "FW-P4",
    phaseTitle: "Firmware Verification & Integration",
    name: "Recovery and persistence verification",
    defaultOwner: "FW",
    prerequisites: ["FW_08"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_10:T01`,
      taskNumber: "T01",
      title: "Test applicable communication recovery buffering and retained state",
      defaultOwner: "FW",
      description: "Simulate cellular loss, buffer telemetry records, and verify non-volatile flash FIFO.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_10:T02`,
      taskNumber: "T02",
      title: "Record failures and corrective tests against approved criteria",
      defaultOwner: "FW",
      description: "Test sudden power cut during flash write; verify zero filesystem corruption.",
    },
  },
  {
    stageCode: "FW_11",
    stageKey: `${TEMPLATE_NAMESPACE}:FW_11`,
    phaseCode: "FW-P4",
    phaseTitle: "Firmware Verification & Integration",
    name: "Firmware validation",
    defaultOwner: "FW",
    prerequisites: ["FW_07", "FW_08", "FW_10"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_11:T01`,
      taskNumber: "T01",
      title: "Execute the agreed functional robustness and environmental plan",
      defaultOwner: "FW",
      description: "Run 72-hour continuous test with thermal cycling and random message injection.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_11:T02`,
      taskNumber: "T02",
      title: "Review required defects and evidence before release",
      defaultOwner: "FW",
      description: "Review bug disposition with QA and verify all blocking issues resolved.",
    },
  },

  // ==========================================
  // FW-P5: Firmware Release / Support (2 stages, 4 tasks)
  // ==========================================
  {
    stageCode: "FW_12",
    stageKey: `${TEMPLATE_NAMESPACE}:FW_12`,
    phaseCode: "FW-P5",
    phaseTitle: "Firmware Release & Support",
    name: "Controlled firmware release",
    defaultOwner: "FW",
    prerequisites: ["FW_11"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_12:T01`,
      taskNumber: "T01",
      title: "Pin the approved source build configuration and binary hash",
      defaultOwner: "FW",
      description: "Generate release binary ELF/HEX/BIN; compute and archive SHA-256 fingerprint.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_12:T02`,
      taskNumber: "T02",
      title: "Obtain configured release authorization and record rollback instructions",
      defaultOwner: "FW",
      description: "Submit firmware release note with rollback procedure for authorized sign-off.",
    },
  },
  {
    stageCode: "FW_13",
    stageKey: `${TEMPLATE_NAMESPACE}:FW_13`,
    phaseCode: "FW-P5",
    phaseTitle: "Firmware Release & Support",
    name: "Field support and update monitoring",
    defaultOwner: "FW",
    prerequisites: ["FW_12"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_13:T01`,
      taskNumber: "T01",
      title: "Monitor the agreed deployment and diagnostic feedback",
      defaultOwner: "FW",
      description: "Track fleet OTA update success rates, reset reasons, and modem disconnect logs.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:FW_13:T02`,
      taskNumber: "T02",
      title: "Record follow-up updates through versioned change control",
      defaultOwner: "FW",
      description: "Log post-release patch requests under proper engineering change governance.",
    },
  },

  // ==========================================
  // SW-P1: Software Scope / Contracts (2 stages, 4 tasks)
  // ==========================================
  {
    stageCode: "SW_01",
    stageKey: `${TEMPLATE_NAMESPACE}:SW_01`,
    phaseCode: "SW-P1",
    phaseTitle: "Software Scope & Contracts",
    name: "Software feasibility and scope",
    defaultOwner: "SW",
    prerequisites: ["CM_01"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:SW_01:T01`,
      taskNumber: "T01",
      title: "Identify users features interfaces and deployment scope",
      defaultOwner: "SW",
      description: "Define cloud tenant hierarchy, telemetry ingest scale, and client web/mobile personas.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:SW_01:T02`,
      taskNumber: "T02",
      title: "Record capacity security and delivery assumptions",
      defaultOwner: "SW",
      description: "Estimate message ingress rates, database throughput, and infrastructure costs.",
    },
  },
  {
    stageCode: "SW_02",
    stageKey: `${TEMPLATE_NAMESPACE}:SW_02`,
    phaseCode: "SW-P1",
    phaseTitle: "Software Scope & Contracts",
    name: "Software requirements and API contract",
    defaultOwner: "SW",
    prerequisites: ["SW_01", "CM_03"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:SW_02:T01`,
      taskNumber: "T01",
      title: "Define agreed workflows data and API behaviours",
      defaultOwner: "SW",
      description: "Author OpenAPI 3.0 specification for ingestion endpoints and application REST APIs.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:SW_02:T02`,
      taskNumber: "T02",
      title: "Review the firmware payload contract only where devices are in scope",
      defaultOwner: "SW",
      description: "Reconcile binary telemetry packet parser and payload decoder with Firmware lead.",
    },
  },

  // ==========================================
  // SW-P2: Software Design / Environment (2 stages, 4 tasks)
  // ==========================================
  {
    stageCode: "SW_03",
    stageKey: `${TEMPLATE_NAMESPACE}:SW_03`,
    phaseCode: "SW-P2",
    phaseTitle: "Software Design & Environment",
    name: "Software architecture and access design",
    defaultOwner: "SW",
    prerequisites: ["SW_02"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:SW_03:T01`,
      taskNumber: "T01",
      title: "Design application data and authenticated authorization boundaries",
      defaultOwner: "SW",
      description: "Design relational schema, row-level security (RLS) policies, and JWT role-based access.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:SW_03:T02`,
      taskNumber: "T02",
      title: "Review UI flows and external integration contracts",
      defaultOwner: "SW",
      description: "Design responsive user interface wireframes and third-party webhook integrations.",
    },
  },
  {
    stageCode: "SW_04",
    stageKey: `${TEMPLATE_NAMESPACE}:SW_04`,
    phaseCode: "SW-P2",
    phaseTitle: "Software Design & Environment",
    name: "Build environment and simulators",
    defaultOwner: "SW",
    prerequisites: ["SW_03"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:SW_04:T01`,
      taskNumber: "T01",
      title: "Configure approved source testing and staging tools",
      defaultOwner: "SW",
      description: "Configure CI/CD pipelines, automated linters, and containerized local development.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:SW_04:T02`,
      taskNumber: "T02",
      title: "Create contract-based mock inputs for independent development",
      defaultOwner: "SW",
      description: "Build telemetry stream simulator to develop cloud ingest independently of physical hardware.",
    },
  },

  // ==========================================
  // SW-P3: Software Feature Implementation (2 stages, 4 tasks)
  // ==========================================
  {
    stageCode: "SW_05",
    stageKey: `${TEMPLATE_NAMESPACE}:SW_05`,
    phaseCode: "SW-P3",
    phaseTitle: "Software Feature Implementation",
    name: "Feature implementation",
    defaultOwner: "SW",
    prerequisites: ["SW_04"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:SW_05:T01`,
      taskNumber: "T01",
      title: "Implement the planned application and service capabilities",
      defaultOwner: "SW",
      description: "Develop device registry, alert engine, map visualization, and export reporting features.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:SW_05:T02`,
      taskNumber: "T02",
      title: "Link changes to requirements and preserve existing APIs",
      defaultOwner: "SW",
      description: "Ensure backwards compatibility and link pull requests to requirements tickets.",
    },
  },
  {
    stageCode: "SW_06",
    stageKey: `${TEMPLATE_NAMESPACE}:SW_06`,
    phaseCode: "SW-P3",
    phaseTitle: "Software Feature Implementation",
    name: "Access security and operations controls",
    defaultOwner: "SW",
    prerequisites: ["SW_03"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:SW_06:T01`,
      taskNumber: "T01",
      title: "Implement the agreed identity permissions and sensitive-data controls",
      defaultOwner: "SW",
      description: "Implement API key rotation, credential vaults, and encryption-at-rest for PII.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:SW_06:T02`,
      taskNumber: "T02",
      title: "Verify applicable operational and update-management behaviour",
      defaultOwner: "SW",
      description: "Implement audit logs, health probe endpoints, and automated rate limiting.",
    },
  },

  // ==========================================
  // SW-P4: Software Verification / Integration (3 stages, 6 tasks)
  // ==========================================
  {
    stageCode: "SW_07",
    stageKey: `${TEMPLATE_NAMESPACE}:SW_07`,
    phaseCode: "SW-P4",
    phaseTitle: "Software Verification & Integration",
    name: "Automated tests and peer review",
    defaultOwner: "SW",
    prerequisites: ["SW_05", "SW_06"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:SW_07:T01`,
      taskNumber: "T01",
      title: "Run unit integration regression and authorization checks",
      defaultOwner: "SW",
      description: "Execute automated unit tests, API integration tests, and permission boundary suites.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:SW_07:T02`,
      taskNumber: "T02",
      title: "Resolve required review findings before integration",
      defaultOwner: "SW",
      description: "Conduct security and performance code review with senior engineering peers.",
    },
  },
  {
    stageCode: "SW_08",
    stageKey: `${TEMPLATE_NAMESPACE}:SW_08`,
    phaseCode: "SW-P4",
    phaseTitle: "Software Verification & Integration",
    name: "End-to-end integration",
    defaultOwner: "SW",
    prerequisites: ["SW_07"], // plus FW_08 when FW selected
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:SW_08:T01`,
      taskNumber: "T01",
      title: "Verify the selected external or device-to-application contract end to end",
      defaultOwner: "SW",
      description: "Ingest live or simulated device packets, decode telemetry, and assert dashboard rendering.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:SW_08:T02`,
      taskNumber: "T02",
      title: "Record failures and recovery behaviour using agreed test data",
      defaultOwner: "SW",
      description: "Verify reconnect storms, out-of-order packets, and message deduplication.",
    },
  },
  {
    stageCode: "SW_09",
    stageKey: `${TEMPLATE_NAMESPACE}:SW_09`,
    phaseCode: "SW-P4",
    phaseTitle: "Software Verification & Integration",
    name: "Acceptance and security validation",
    defaultOwner: "SW",
    prerequisites: ["SW_08"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:SW_09:T01`,
      taskNumber: "T01",
      title: "Run applicable user acceptance security and performance checks",
      defaultOwner: "SW",
      description: "Conduct load testing under 10,000 simulated devices and OWASP Top 10 penetration test.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:SW_09:T02`,
      taskNumber: "T02",
      title: "Record authorized acceptance and required issue disposition",
      defaultOwner: "SW",
      description: "Sign off UAT report and security sign-off with customer and internal stakeholders.",
    },
  },

  // ==========================================
  // SW-P5: Software Deployment / Monitoring (2 stages, 4 tasks)
  // ==========================================
  {
    stageCode: "SW_10",
    stageKey: `${TEMPLATE_NAMESPACE}:SW_10`,
    phaseCode: "SW-P5",
    phaseTitle: "Software Deployment & Monitoring",
    name: "Controlled deployment",
    defaultOwner: "SW",
    prerequisites: ["SW_09"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:SW_10:T01`,
      taskNumber: "T01",
      title: "Rehearse the approved deployment data migration and rollback",
      defaultOwner: "SW",
      description: "Execute zero-downtime database migration and rehearsal deployment in staging environment.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:SW_10:T02`,
      taskNumber: "T02",
      title: "Obtain release authorization and verify the intended environment",
      defaultOwner: "SW",
      description: "Promote release build to production with signed container images and traffic shift.",
    },
  },
  {
    stageCode: "SW_11",
    stageKey: `${TEMPLATE_NAMESPACE}:SW_11`,
    phaseCode: "SW-P5",
    phaseTitle: "Software Deployment & Monitoring",
    name: "Post-release monitoring",
    defaultOwner: "SIT",
    prerequisites: ["SW_10"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:SW_11:T01`,
      taskNumber: "T01",
      title: "Monitor agreed service indicators and recovery readiness",
      defaultOwner: "SIT",
      description: "Monitor API latencies, error rates, message backlogs, and cluster auto-scaling metrics.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:SW_11:T02`,
      taskNumber: "T02",
      title: "Record support handover and follow-up improvements without invented SLA values",
      defaultOwner: "SIT",
      description: "Handoff runbooks, operational alerts, and support escalations to IT Operations.",
    },
  },

  // ==========================================
  // INT-P1: Coupled Integration (3 stages, 6 tasks)
  // ==========================================
  {
    stageCode: "INT_01",
    stageKey: `${TEMPLATE_NAMESPACE}:INT_01`,
    phaseCode: "INT-P1",
    phaseTitle: "Coupled Integration",
    name: "Cross-track baseline handshake",
    defaultOwner: "EHW", // EHW for HW-FW; FW for FW-SW
    prerequisites: ["HW_09", "FW_02"],
    applicabilityNote: "HW_09 and FW_02 for HW-FW; FW_02 and SW_02 for FW-SW",
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:INT_01:T01`,
      taskNumber: "T01",
      title: "Pin the joint interface and participating version references",
      defaultOwner: "EHW",
      description: "Freeze interface contract between hardware pinout, firmware drivers, and cloud decoder.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:INT_01:T02`,
      taskNumber: "T02",
      title: "Record the accountable joint review before dependent implementation",
      defaultOwner: "EHW",
      description: "Record sign-off from domain leads prior to cross-track implementation kickoff.",
    },
  },
  {
    stageCode: "INT_02",
    stageKey: `${TEMPLATE_NAMESPACE}:INT_02`,
    phaseCode: "INT-P1",
    phaseTitle: "Coupled Integration",
    name: "Integrated system verification",
    defaultOwner: "QA",
    prerequisites: ["INT_01"],
    applicabilityNote: "Selected from applicable HW_32, FW_11, SW_08",
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:INT_02:T01`,
      taskNumber: "T01",
      title: "Verify end-to-end behaviour on the pinned full configuration",
      defaultOwner: "QA",
      description: "Test sensor-to-cloud data journey using physical device and production cloud environment.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:INT_02:T02`,
      taskNumber: "T02",
      title: "Record unresolved cross-department blockers and owners",
      defaultOwner: "QA",
      description: "Log cross-domain integration defects and assign accountable defect owners.",
    },
  },
  {
    stageCode: "INT_03",
    stageKey: `${TEMPLATE_NAMESPACE}:INT_03`,
    phaseCode: "INT-P1",
    phaseTitle: "Coupled Integration",
    name: "Coordinated pilot acceptance",
    defaultOwner: "SAL",
    prerequisites: ["INT_02"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:INT_03:T01`,
      taskNumber: "T01",
      title: "Collect authorized customer or internal pilot feedback",
      defaultOwner: "SAL",
      description: "Deploy pilot units to test vehicles; collect user operational and reliability feedback.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:INT_03:T02`,
      taskNumber: "T02",
      title: "Record accepted scope limitations and refinement actions",
      defaultOwner: "SAL",
      description: "Document client pilot sign-off or open engineering change requests (ECNs).",
    },
  },

  // ==========================================
  // RM-P1 to RM-P3: Ready-Made Deployment (3 stages, 6 tasks)
  // ==========================================
  {
    stageCode: "RM_01",
    stageKey: `${TEMPLATE_NAMESPACE}:RM_01`,
    phaseCode: "RM-P1",
    phaseTitle: "Ready-Made Fit & Gap",
    name: "Existing product fit and gap review",
    defaultOwner: "SAL",
    prerequisites: ["CM_03"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:RM_01:T01`,
      taskNumber: "T01",
      title: "Select the actual existing product and released reference configuration",
      defaultOwner: "SAL",
      description: "Select catalog product model, approved technical data sheet (TDS), and sales brochure.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:RM_01:T02`,
      taskNumber: "T02",
      title: "Record fit gaps and conditions without creating a new engineering development track",
      defaultOwner: "SAL",
      description: "Verify client application matches standard device ratings; avoid unnecessary R&D tracks.",
    },
  },
  {
    stageCode: "RM_02",
    stageKey: `${TEMPLATE_NAMESPACE}:RM_02`,
    phaseCode: "RM-P2",
    phaseTitle: "Ready-Made Configuration",
    name: "Configuration and integration preparation",
    defaultOwner: "SIT",
    prerequisites: ["RM_01"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:RM_02:T01`,
      taskNumber: "T01",
      title: "Prepare approved installation configuration and interface settings",
      defaultOwner: "SIT",
      description: "Configure standard APN, server IP, reporting intervals, and I/O logic profiles.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:RM_02:T02`,
      taskNumber: "T02",
      title: "Verify existing version compatibility and authorization",
      defaultOwner: "SIT",
      description: "Validate default firmware release and server telemetry compatibility.",
    },
  },
  {
    stageCode: "RM_03",
    stageKey: `${TEMPLATE_NAMESPACE}:RM_03`,
    phaseCode: "RM-P3",
    phaseTitle: "Ready-Made Deployment Verification",
    name: "Ready-made deployment verification",
    defaultOwner: "SIT",
    prerequisites: ["RM_02"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:RM_03:T01`,
      taskNumber: "T01",
      title: "Execute the authorized installation or deployment plan",
      defaultOwner: "SIT",
      description: "Conduct trial field installation or staging device verification against checklist.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:RM_03:T02`,
      taskNumber: "T02",
      title: "Record operational checks and exceptions against agreed criteria",
      defaultOwner: "SIT",
      description: "Log successful power-on, GPS lock, server communication, and customer receipt sign-off.",
    },
  },

  // ==========================================
  // CL-P1: Release / Handover / Closure (3 stages, 6 tasks)
  // ==========================================
  {
    stageCode: "CL_01",
    stageKey: `${TEMPLATE_NAMESPACE}:CL_01`,
    phaseCode: "CL-P1",
    phaseTitle: "Project Closure & Handover",
    name: "Release decision readiness",
    defaultOwner: "QA",
    prerequisites: ["HW_32"],
    applicabilityNote: "Ready-made: RM_02; SW: SW_09; FW: FW_11; HW: HW_32 + change readiness; Coupled: INT_02",
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:CL_01:T01`,
      taskNumber: "T01",
      title: "Compile the applicable signed evidence and unresolved conditions",
      defaultOwner: "QA",
      description: "Assemble complete compliance, test reports, and approved concessions dossier.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:CL_01:T02`,
      taskNumber: "T02",
      title: "Obtain the configured release decision without replacing it with task completion",
      defaultOwner: "QA",
      description: "Submit formal product release request to authorized signers; task completion does not bypass gate.",
    },
  },
  {
    stageCode: "CL_02",
    stageKey: `${TEMPLATE_NAMESPACE}:CL_02`,
    phaseCode: "CL-P1",
    phaseTitle: "Project Closure & Handover",
    name: "Delivery and support handover",
    defaultOwner: "SAL",
    prerequisites: ["CL_01"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:CL_02:T01`,
      taskNumber: "T01",
      title: "Link the actual authorized dispatch or deployment evidence",
      defaultOwner: "SAL",
      description: "Attach delivery challan, e-way bill, courier tracking, or cloud production handover notice.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:CL_02:T02`,
      taskNumber: "T02",
      title: "Record recipient acceptance documents and support ownership",
      defaultOwner: "SAL",
      description: "Collect client Goods Acceptance Note or support handover acknowledgment.",
    },
  },
  {
    stageCode: "CL_03",
    stageKey: `${TEMPLATE_NAMESPACE}:CL_03`,
    phaseCode: "CL-P1",
    phaseTitle: "Project Closure & Handover",
    name: "Closure and lessons",
    defaultOwner: "SAL",
    prerequisites: ["CL_02"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:CL_03:T01`,
      taskNumber: "T01",
      title: "Review remaining obligations defects and follow-up ownership",
      defaultOwner: "SAL",
      description: "Verify all project receivables, warranties, and non-blocking maintenance tasks.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:CL_03:T02`,
      taskNumber: "T02",
      title: "Record authorized closure or keep the project open for refinement",
      defaultOwner: "SAL",
      description: "Archive project repository; mark formal project closure with management approval.",
    },
  },

  // ==========================================
  // CERT-P1 to CERT-P4: QA Certification (15 stages, 30 tasks) - Conditional Workstream
  // ==========================================
  {
    stageCode: "C01",
    stageKey: `${TEMPLATE_NAMESPACE}:C01`,
    phaseCode: "CERT-P1",
    phaseTitle: "Certification Planning",
    name: "Certification applicability review",
    defaultOwner: "QA",
    prerequisites: ["CM_03"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:C01:T01`,
      taskNumber: "T01",
      title: "Identify only the approved applicable regulatory and customer requirements",
      defaultOwner: "QA",
      description: "Identify AIS-140, CE, FCC, RoHS, or customer-specific certification requirements without blanket assumptions.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:C01:T02`,
      taskNumber: "T02",
      title: "Map required configurations and test evidence without asserting blanket certification",
      defaultOwner: "QA",
      description: "Define mandatory lab tests, test methods, and environmental standards.",
    },
  },
  {
    stageCode: "C02",
    stageKey: `${TEMPLATE_NAMESPACE}:C02`,
    phaseCode: "CERT-P1",
    phaseTitle: "Certification Planning",
    name: "External test matrix",
    defaultOwner: "QA",
    prerequisites: ["C01"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:C02:T01`,
      taskNumber: "T01",
      title: "Prepare the relevant test criteria samples and method references",
      defaultOwner: "QA",
      description: "Create matrix of surge, transient, vibration, ingress protection, and thermal tests.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:C02:T02`,
      taskNumber: "T02",
      title: "Review technical inputs and required approval authority",
      defaultOwner: "QA",
      description: "Obtain engineering review on test limits and device operating modes.",
    },
  },
  {
    stageCode: "C03",
    stageKey: `${TEMPLATE_NAMESPACE}:C03`,
    phaseCode: "CERT-P1",
    phaseTitle: "Certification Planning",
    name: "Test agency selection",
    defaultOwner: "PUR",
    prerequisites: ["C02"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:C03:T01`,
      taskNumber: "T01",
      title: "Collect permitted agency quotations and capability evidence",
      defaultOwner: "PUR",
      description: "Solicit commercial quotes from accredited test labs (ARAI, iCAT, UL, TÜV).",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:C03:T02`,
      taskNumber: "T02",
      title: "Route the selection through existing commercial and QA authority",
      defaultOwner: "PUR",
      description: "Obtain QA lead and Finance approval for lab slot and pricing.",
    },
  },
  {
    stageCode: "C04",
    stageKey: `${TEMPLATE_NAMESPACE}:C04`,
    phaseCode: "CERT-P1",
    phaseTitle: "Certification Planning",
    name: "Pre-compliance service authorization",
    defaultOwner: "PUR",
    prerequisites: ["C03"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:C04:T01`,
      taskNumber: "T01",
      title: "Prepare the authorized testing order request",
      defaultOwner: "PUR",
      description: "Issue purchase order for pre-compliance test booking.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:C04:T02`,
      taskNumber: "T02",
      title: "Link Finance-approved payment evidence only if actually available",
      defaultOwner: "PUR",
      description: "Attach authorized advance payment voucher where required by lab.",
    },
  },
  {
    stageCode: "C05",
    stageKey: `${TEMPLATE_NAMESPACE}:C05`,
    phaseCode: "CERT-P2",
    phaseTitle: "Pre-Compliance Execution",
    name: "Sample readiness",
    defaultOwner: "EMF",
    prerequisites: ["C04"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:C05:T01`,
      taskNumber: "T01",
      title: "Prepare traceable samples and applicable test configuration",
      defaultOwner: "EMF",
      description: "Build and label designated test sample units with serial numbers and firmware hashes.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:C05:T02`,
      taskNumber: "T02",
      title: "Record QA readiness checks before dispatch",
      defaultOwner: "EMF",
      description: "Conduct pre-dispatch functional check with QA engineer.",
    },
  },
  {
    stageCode: "C06",
    stageKey: `${TEMPLATE_NAMESPACE}:C06`,
    phaseCode: "CERT-P2",
    phaseTitle: "Pre-Compliance Execution",
    name: "Technical file compilation",
    defaultOwner: "QA",
    prerequisites: ["C04"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:C06:T01`,
      taskNumber: "T01",
      title: "Compile original requirements design and configuration references",
      defaultOwner: "QA",
      description: "Assemble schematics, BOM, user manual, and circuit description into technical file.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:C06:T02`,
      taskNumber: "T02",
      title: "Record authorized submission and external reference if submitted",
      defaultOwner: "QA",
      description: "Submit technical dossier to test agency and record tracking number.",
    },
  },
  {
    stageCode: "C07",
    stageKey: `${TEMPLATE_NAMESPACE}:C07`,
    phaseCode: "CERT-P2",
    phaseTitle: "Pre-Compliance Execution",
    name: "Lab scheduling and dispatch readiness",
    defaultOwner: "QA",
    prerequisites: ["C05", "C06"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:C07:T01`,
      taskNumber: "T01",
      title: "Confirm the actual agreed test slot and attendance",
      defaultOwner: "QA",
      description: "Confirm chamber test dates, engineer attendance, and equipment calibration.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:C07:T02`,
      taskNumber: "T02",
      title: "Link authorized sample dispatch evidence",
      defaultOwner: "QA",
      description: "Attach courier consignment note and delivery confirmation.",
    },
  },
  {
    stageCode: "C08",
    stageKey: `${TEMPLATE_NAMESPACE}:C08`,
    phaseCode: "CERT-P2",
    phaseTitle: "Pre-Compliance Execution",
    name: "Pre-compliance execution evidence",
    defaultOwner: "QA",
    prerequisites: ["C07"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:C08:T01`,
      taskNumber: "T01",
      title: "Coordinate applicable external testing against the approved plan",
      defaultOwner: "QA",
      description: "Oversee lab test runs: RF emissions, radiated immunity, automotive transients.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:C08:T02`,
      taskNumber: "T02",
      title: "Record genuine lab reports observations and configuration references",
      defaultOwner: "QA",
      description: "Upload original laboratory test summary and raw spectral sweep plots.",
    },
  },
  {
    stageCode: "C09",
    stageKey: `${TEMPLATE_NAMESPACE}:C09`,
    phaseCode: "CERT-P2",
    phaseTitle: "Pre-Compliance Execution",
    name: "Findings and corrective verification",
    defaultOwner: "EHW", // Findings go to responsible domain, not EHW unconditionally
    prerequisites: ["C08"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:C09:T01`,
      taskNumber: "T01",
      title: "Assign findings to the responsible domain and link corrective changes",
      defaultOwner: "EHW",
      description: "Triage test anomalies, design snubber/filter modifications, or update firmware debouncing.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:C09:T02`,
      taskNumber: "T02",
      title: "Record QA-reviewed retest or justified disposition",
      defaultOwner: "EHW",
      description: "Re-verify modified circuit in bench chamber and record verified corrective evidence.",
    },
  },
  {
    stageCode: "C10",
    stageKey: `${TEMPLATE_NAMESPACE}:C10`,
    phaseCode: "CERT-P3",
    phaseTitle: "Final Testing & Compliance",
    name: "Final test service authorization",
    defaultOwner: "PUR",
    prerequisites: ["C09"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:C10:T01`,
      taskNumber: "T01",
      title: "Prepare the applicable final test order request",
      defaultOwner: "PUR",
      description: "Issue final formal compliance testing purchase order to agency.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:C10:T02`,
      taskNumber: "T02",
      title: "Link actual Finance-authorized payment evidence if available",
      defaultOwner: "PUR",
      description: "Attach Finance approved payment transaction reference.",
    },
  },
  {
    stageCode: "C11",
    stageKey: `${TEMPLATE_NAMESPACE}:C11`,
    phaseCode: "CERT-P3",
    phaseTitle: "Final Testing & Compliance",
    name: "Final controlled sample readiness",
    defaultOwner: "QA",
    prerequisites: ["C10"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:C11:T01`,
      taskNumber: "T01",
      title: "Verify sample build and version provenance against released engineering references",
      defaultOwner: "QA",
      description: "Verify final production-representative samples match released BOM, Gerber, and FW binary.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:C11:T02`,
      taskNumber: "T02",
      title: "Record QA sample-release evidence without inventing results",
      defaultOwner: "QA",
      description: "Seal samples and issue formal Certificate of Conformity for test agency submission.",
    },
  },
  {
    stageCode: "C12",
    stageKey: `${TEMPLATE_NAMESPACE}:C12`,
    phaseCode: "CERT-P3",
    phaseTitle: "Final Testing & Compliance",
    name: "Final compliance evidence",
    defaultOwner: "QA",
    prerequisites: ["C11"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:C12:T01`,
      taskNumber: "T01",
      title: "Track actual applicable external test execution",
      defaultOwner: "QA",
      description: "Monitor official homologation test runs across environmental, electrical, and radio standards.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:C12:T02`,
      taskNumber: "T02",
      title: "Link original reports and open findings without simulated measurements",
      defaultOwner: "QA",
      description: "Upload official laboratory test report signed by authorized test agency engineer.",
    },
  },
  {
    stageCode: "C13",
    stageKey: `${TEMPLATE_NAMESPACE}:C13`,
    phaseCode: "CERT-P4",
    phaseTitle: "Certification Handover & Decisions",
    name: "Report accuracy review",
    defaultOwner: "QA",
    prerequisites: ["C12"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:C13:T01`,
      taskNumber: "T01",
      title: "Review report identity version criteria and result provenance",
      defaultOwner: "QA",
      description: "Audit test report details: model number, manufacturer, test standards, and limits.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:C13:T02`,
      taskNumber: "T02",
      title: "Resolve documented report discrepancies with the responsible source",
      defaultOwner: "QA",
      description: "Request official lab addendum if any typographical or serial discrepancies are found.",
    },
  },
  {
    stageCode: "C14",
    stageKey: `${TEMPLATE_NAMESPACE}:C14`,
    phaseCode: "CERT-P4",
    phaseTitle: "Certification Handover & Decisions",
    name: "External certificate decision",
    defaultOwner: "QA",
    prerequisites: ["C13"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:C14:T01`,
      taskNumber: "T01",
      title: "Track the actual authority decision where certification is required",
      defaultOwner: "QA",
      description: "Track Ministry or statutory body certificate issuance (e.g. ARAI Type Approval Certificate).",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:C14:T02`,
      taskNumber: "T02",
      title: "Upload the issued original or retain a clearly pending state",
      defaultOwner: "QA",
      description: "Upload scanned genuine certificate PDF or maintain pending state; never fabricate approval.",
    },
  },
  {
    stageCode: "C15",
    stageKey: `${TEMPLATE_NAMESPACE}:C15`,
    phaseCode: "CERT-P4",
    phaseTitle: "Certification Handover & Decisions",
    name: "Compliance record handover",
    defaultOwner: "QA",
    prerequisites: ["C14"],
    t01: {
      taskKey: `${TEMPLATE_NAMESPACE}:C15:T01`,
      taskNumber: "T01",
      title: "Archive verified original evidence and applicable approval references",
      defaultOwner: "QA",
      description: "Deposit complete statutory compliance packet into Document Control Vault.",
    },
    t02: {
      taskKey: `${TEMPLATE_NAMESPACE}:C15:T02`,
      taskNumber: "T02",
      title: "Update compliance readiness for the separate authorized release decision",
      defaultOwner: "QA",
      description: "Update production release checklist with compliance certificate reference.",
    },
  },
];

/**
 * Filter stages applicable to a specific track.
 * Invariants:
 * - Pure SW never requires PCB bring-up (HW_31) or PCBA receipt (HW_30).
 * - Pure FW never requires new PCB layout or fabrication (HW_01-HW_37).
 * - Ready-made never generates custom engineering stages.
 */
export function getApplicableStagesForTrack(
  track: ProjectTrack,
  options?: { enableCertification?: boolean }
): CanonicalStageTemplate[] {
  const norm = normalizeCanonicalTrack(track);
  const includeCert = Boolean(options?.enableCertification);

  return CANONICAL_STAGE_TEMPLATES.filter((stg) => {
    // Certification stages C01-C15 apply only if certification is explicitly enabled
    if (/^C\d+$/.test(stg.stageCode)) {
      return includeCert;
    }

    // Common stages CM_01-04 and CL_01-03 apply to all projects
    if (stg.stageCode.startsWith("CM_") || stg.stageCode.startsWith("CL_")) {
      return true;
    }

    // Ready-made track has ONLY CM_01-04, RM_01-03, and CL_01-03
    if (norm === "ready_made") {
      return stg.stageCode.startsWith("RM_");
    }

    // If ready-made stages are being considered for engineering tracks, reject
    if (stg.stageCode.startsWith("RM_")) {
      return false;
    }

    // Hardware stages HW_01 to HW_37
    if (stg.stageCode.startsWith("HW_")) {
      return norm === "hardware_only" || norm === "hardware_firmware" || norm === "hardware_firmware_software";
    }

    // Firmware stages FW_01 to FW_13
    if (stg.stageCode.startsWith("FW_")) {
      return (
        norm === "firmware_only" ||
        norm === "hardware_firmware" ||
        norm === "firmware_software_existing_hardware" ||
        norm === "hardware_firmware_software"
      );
    }

    // Software stages SW_01 to SW_11
    if (stg.stageCode.startsWith("SW_")) {
      return (
        norm === "software_only" ||
        norm === "firmware_software_existing_hardware" ||
        norm === "hardware_firmware_software"
      );
    }

    // Integrated stages INT_01 to INT_03
    if (stg.stageCode.startsWith("INT_")) {
      return (
        norm === "hardware_firmware" ||
        norm === "firmware_software_existing_hardware" ||
        norm === "hardware_firmware_software"
      );
    }

    return true;
  });
}

export type StageProgressionStatus =
  | "completed"
  | "ready"
  | "in_progress"
  | "planned"
  | "not_applicable";

export interface ProjectStageInstance {
  stageCode: string;
  stageKey: string;
  name: string;
  phaseCode: string;
  status: StageProgressionStatus;
  ownerDepartment: string;
  prerequisites: string[];
  completedAt?: string;
  approvedBy?: string;
  remarks?: string;
  isCustom?: boolean;
}

export interface ProjectTaskInstance {
  id: string; // unique stable ID, e.g. "PRJ-01:HW_19:T01" or UUID
  projectId: string;
  stageCode: string;
  stageKey: string;
  taskNumber?: "T01" | "T02" | "CUSTOM";
  title: string;
  description: string;
  department: string;
  assignee?: string;
  status: "todo" | "in_progress" | "in_review" | "completed" | "cancelled";
  priority: "Critical" | "High" | "Normal" | "Low";
  dueDate?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  isCustom?: boolean;
  order: number;
}

/**
 * Resolves track-specific prerequisites for a canonical stage.
 * Invariants (§16.10, §16.11, Master Plan & User Amendments):
 * 1. CM_01 is the single entry stage with empty prerequisites ([]).
 * 2. Pre-project technical feasibility: HW_01, FW_01, SW_01 require only CM_01 (or CM_02),
 *    never waiting for project approval or kickoff (CM_03 / CM_04).
 * 3. Cross-track integration:
 *    - INT_01 requires joint baseline interfaces:
 *      - HW+FW: ["HW_09", "FW_02"]
 *      - FW+SW: ["FW_02", "SW_02"]
 *      - HW+FW+SW: ["HW_09", "FW_02", "SW_02"]
 *    - INT_02 requires INT_01 plus applicable domain verification:
 *      - HW+FW: ["INT_01", "HW_32", "FW_11"]
 *      - FW+SW: ["INT_01", "FW_11", "SW_08"]
 *      - HW+FW+SW: ["INT_01", "HW_32", "FW_11", "SW_08"]
 *    - INT_03 requires ["INT_02"].
 * 4. Release Readiness (CL_01):
 *    - Ready-made: ["RM_02"] (Configuration ready; RM_03 is deployment verification which follows release).
 *    - Pure Software: ["SW_09"] (Software release readiness; SW_10 deployment & SW_11 monitoring follow release).
 *    - Pure Firmware: ["FW_11"] (System verification; FW_12 distribution & FW_13 factory staging follow release).
 *    - Hardware: ["HW_32"] (Environmental & functional verification + change readiness; HW_37 handover follows release).
 *    - Coupled tracks: ["INT_02"] (Integrated system verification; INT_03 pilot acceptance follows baseline integration).
 *    - Post-release stages (RM_03, SW_10, FW_12, HW_37, INT_03) do NOT block CL_01.
 * 5. CL_02 depends on ["CL_01"]; CL_03 depends on ["CL_02"].
 */
export function resolveStagePrerequisites(stageCode: string, track: ProjectTrack): string[] {
  const normTrack = normalizeCanonicalTrack(track);
  const code = stageCode.toUpperCase();

  // CM_01 is strictly the only entry stage with zero prerequisites
  if (code === "CM_01") {
    return [];
  }

  // Cross-track baseline handshake
  if (code === "INT_01") {
    if (normTrack === "hardware_firmware") return ["HW_09", "FW_02"];
    if (normTrack === "firmware_software_existing_hardware") return ["FW_02", "SW_02"];
    if (normTrack === "hardware_firmware_software") return ["HW_09", "FW_02", "SW_02"];
    return ["CM_04"];
  }

  // Integrated system verification
  if (code === "INT_02") {
    if (normTrack === "hardware_firmware") return ["INT_01", "HW_32", "FW_11"];
    if (normTrack === "firmware_software_existing_hardware") return ["INT_01", "FW_11", "SW_08"];
    if (normTrack === "hardware_firmware_software") return ["INT_01", "HW_32", "FW_11", "SW_08"];
    return ["INT_01"];
  }

  // Coordinated pilot acceptance
  if (code === "INT_03") {
    return ["INT_02"];
  }

  // Release decision readiness: strictly depends on verification evidence, NOT post-release stages
  if (code === "CL_01") {
    if (normTrack === "ready_made") return ["RM_02"];
    if (normTrack === "software_only") return ["SW_09"];
    if (normTrack === "firmware_only") return ["FW_11"];
    if (normTrack === "hardware_only") return ["HW_32"];
    if (
      normTrack === "hardware_firmware" ||
      normTrack === "firmware_software_existing_hardware" ||
      normTrack === "hardware_firmware_software"
    ) {
      return ["INT_02"];
    }
    return ["CM_04"];
  }

  if (code === "CL_02") {
    return ["CL_01"];
  }

  if (code === "CL_03") {
    return ["CL_02"];
  }

  // Fallback to static template prerequisites
  const template = CANONICAL_STAGE_TEMPLATES.find((t) => t.stageCode.toUpperCase() === code);
  return template ? template.prerequisites : [];
}

/**
 * Validates whether a custom task can be deleted rather than cancelled.
 * Safe deletion rules:
 * - Only custom tasks can be deleted (default template tasks can only be cancelled).
 * - Only tasks with zero recorded progress (status 'todo', unstarted) and not assigned can be deleted.
 * - Tasks with dependent tasks cannot be deleted until dependencies are resolved.
 * If deletion is not permitted, the caller must use cancellation.
 */
export function validateTaskDeletion(
  task: ProjectTaskInstance,
  allTasks: ProjectTaskInstance[] = [],
): { canDelete: boolean; reason?: string } {
  if (!task.isCustom) {
    return { canDelete: false, reason: "Default template tasks cannot be deleted; they may only be cancelled." };
  }
  if (task.status === "in_progress" || task.status === "completed") {
    return { canDelete: false, reason: "Tasks with recorded progress cannot be deleted; cancel them instead." };
  }
  if (task.assignee && task.assignee !== "Unassigned") {
    return { canDelete: false, reason: "Assigned tasks cannot be deleted; cancel them instead to preserve audit history." };
  }
  const hasDependents = allTasks.some(
    (t) => t.id !== task.id && t.description.includes(task.id),
  );
  if (hasDependents) {
    return { canDelete: false, reason: "Other tasks depend on this task; resolve dependencies or cancel instead." };
  }
  return { canDelete: true };
}

/**
 * Creates a project-specific custom task instance.
 */
export function createCustomTaskInstance(params: {
  projectId: string;
  stageCode: string;
  title: string;
  description?: string;
  department: string;
  priority?: "Critical" | "High" | "Normal" | "Low";
  assignee?: string;
  order?: number;
}): ProjectTaskInstance {
  const customId = `${params.projectId}:${params.stageCode}:C_${Date.now()}`;
  const task: ProjectTaskInstance = {
    id: customId,
    projectId: params.projectId,
    stageCode: params.stageCode,
    stageKey: `${TEMPLATE_NAMESPACE}:${params.stageCode}`,
    taskNumber: "CUSTOM",
    title: params.title.trim(),
    description: params.description || "",
    department: params.department,
    status: "todo",
    priority: params.priority || "Normal",
    order: params.order ?? 99,
    isCustom: true,
  };
  if (params.assignee) {
    task.assignee = params.assignee;
  }
  return task;
}

/**
 * Cancels a project task instance, recording reason and timestamp.
 */
export function cancelTaskInstance(
  task: ProjectTaskInstance,
  reason: string,
): ProjectTaskInstance {
  return {
    ...task,
    status: "cancelled",
    cancellationReason: reason.trim(),
    cancelledAt: new Date().toISOString(),
  };
}

/**
 * Updates a task instance with permitted patches.
 */
export function updateTaskInstance(
  task: ProjectTaskInstance,
  patch: Partial<Pick<ProjectTaskInstance, "title" | "description" | "priority" | "assignee" | "order" | "dueDate">>,
): ProjectTaskInstance {
  return {
    ...task,
    ...patch,
  };
}

/**
 * Progressive Task Generation:
 * Evaluates stage prerequisites. Only stages whose prerequisites are all completed
 * become "ready" or "in_progress" and generate active assigned tasks.
 * Future stages keep their planned task previews visible without cluttering active To Do / Today boards.
 *
 * Invariants:
 * 1. Fresh project with zero completed stages marks ONLY CM_01 as ready.
 * 2. Supplying an in_progress stage NEVER bypasses prerequisite checks.
 * 3. Cancelled tasks are preserved and never regenerated from templates.
 */
export function computeProgressiveStageAndTaskState(params: {
  projectId: string;
  track: ProjectTrack;
  completedStageCodes: string[];
  inProgressStageCodes?: string[];
  customStages?: ProjectStageInstance[];
  customTasks?: ProjectTaskInstance[];
  cancelledTaskIds?: string[];
  enableCertification?: boolean;
}): {
  stages: ProjectStageInstance[];
  activeTasks: ProjectTaskInstance[];
  plannedTaskPreviews: ProjectTaskInstance[];
} {
  const {
    projectId,
    track,
    completedStageCodes,
    inProgressStageCodes = [],
    customStages = [],
    customTasks = [],
    cancelledTaskIds = [],
    enableCertification = false,
  } = params;

  const applicableStageTemplates = getApplicableStagesForTrack(track, { enableCertification });
  const completedSet = new Set(completedStageCodes.map((s) => s.toUpperCase()));
  const inProgressSet = new Set(inProgressStageCodes.map((s) => s.toUpperCase()));
  const cancelledTaskSet = new Set(cancelledTaskIds);

  const stages: ProjectStageInstance[] = [];

  for (const tpl of applicableStageTemplates) {
    const code = tpl.stageCode.toUpperCase();
    const prereqs = resolveStagePrerequisites(tpl.stageCode, track);
    const prereqsMet = prereqs.length === 0 || prereqs.every((p) => completedSet.has(p.toUpperCase()));

    let status: StageProgressionStatus = "planned";

    if (completedSet.has(code)) {
      status = "completed";
    } else if (inProgressSet.has(code)) {
      // STRICT GATING: A stage cannot legally be in_progress unless its prerequisites are completed
      if (prereqsMet) {
        status = "in_progress";
      } else {
        // Prerequisite not met - must remain planned
        status = "planned";
      }
    } else {
      if (prereqsMet) {
        status = "ready";
      } else {
        status = "planned";
      }
    }

    stages.push({
      stageCode: tpl.stageCode,
      stageKey: tpl.stageKey,
      name: tpl.name,
      phaseCode: tpl.phaseCode,
      status,
      ownerDepartment: tpl.defaultOwner,
      prerequisites: prereqs,
    });
  }

  // Include custom stages if any
  for (const cs of customStages) {
    stages.push(cs);
  }

  const activeTasks: ProjectTaskInstance[] = [];
  const plannedTaskPreviews: ProjectTaskInstance[] = [];

  for (const stage of stages) {
    const isStageActive = stage.status === "ready" || stage.status === "in_progress" || stage.status === "completed";
    const template = applicableStageTemplates.find((t) => t.stageCode === stage.stageCode);

    if (template) {
      // Task 1
      const t1Id = `${projectId}:${stage.stageCode}:T01`;
      if (!cancelledTaskSet.has(t1Id)) {
        const task1: ProjectTaskInstance = {
          id: t1Id,
          projectId,
          stageCode: stage.stageCode,
          stageKey: stage.stageKey,
          taskNumber: "T01",
          title: template.t01.title,
          description: template.t01.description,
          department: template.t01.defaultOwner,
          status: stage.status === "completed" ? "completed" : stage.status === "in_progress" ? "in_progress" : "todo",
          priority: "Normal",
          order: 1,
        };
        if (isStageActive) {
          activeTasks.push(task1);
        } else {
          plannedTaskPreviews.push(task1);
        }
      }

      // Task 2
      const t2Id = `${projectId}:${stage.stageCode}:T02`;
      if (!cancelledTaskSet.has(t2Id)) {
        const task2: ProjectTaskInstance = {
          id: t2Id,
          projectId,
          stageCode: stage.stageCode,
          stageKey: stage.stageKey,
          taskNumber: "T02",
          title: template.t02.title,
          description: template.t02.description,
          department: template.t02.defaultOwner,
          status: stage.status === "completed" ? "completed" : "todo",
          priority: "Normal",
          order: 2,
        };
        if (isStageActive) {
          activeTasks.push(task2);
        } else {
          plannedTaskPreviews.push(task2);
        }
      }
    }

    // Attach custom tasks for this stage
    const stageCustomTasks = customTasks.filter((ct) => ct.stageCode === stage.stageCode);
    for (const ct of stageCustomTasks) {
      if (cancelledTaskSet.has(ct.id)) continue;
      if (isStageActive) {
        activeTasks.push(ct);
      } else {
        plannedTaskPreviews.push(ct);
      }
    }
  }

  return { stages, activeTasks, plannedTaskPreviews };
}

/**
 * Tentative BOM Costing Contract Verification (§16.10, §16.11)
 * Rules:
 * 1. Hardware submits tentative BOM (HW_19:T01).
 * 2. Purchasing performs 1 consolidated BOM costing & sourcing analysis (HW_19:T02).
 * 3. RAM, MCU, and component prices are line items in that consolidated analysis, NOT separate default tasks.
 * 4. HW_05 technical response does NOT depend on HW_19 tentative BOM.
 * 5. HW_19:T02 is PUR-owned.
 */
export function verifyTentativeBomCostingContract(): {
  hw05DoesNotRequireHw19: boolean;
  hw19T02IsPurOwned: boolean;
  ramPriceNotSeparateDefaultTask: boolean;
  fw01SizingIsTechnicalFeasibility: boolean;
} {
  const hw05 = CANONICAL_STAGE_TEMPLATES.find((s) => s.stageCode === "HW_05");
  const hw19 = CANONICAL_STAGE_TEMPLATES.find((s) => s.stageCode === "HW_19");
  const fw01 = CANONICAL_STAGE_TEMPLATES.find((s) => s.stageCode === "FW_01");

  const hw05DoesNotRequireHw19 = Boolean(hw05 && !hw05.prerequisites.includes("HW_19"));
  const hw19T02IsPurOwned = Boolean(hw19 && hw19.t02.defaultOwner === "PUR");
  
  // Verify that no default task template exists whose sole title is "RAM pricing"
  const ramPriceNotSeparateDefaultTask = !CANONICAL_STAGE_TEMPLATES.some(
    (s) => s.t01.title.toLowerCase().includes("ram price") || s.t02.title.toLowerCase().includes("ram price")
  );

  const fw01SizingIsTechnicalFeasibility = Boolean(
    fw01 &&
      fw01.defaultOwner === "FW" &&
      (fw01.name.toLowerCase().includes("target sizing") ||
        fw01.t01.description.toLowerCase().includes("size mcu flash"))
  );

  return {
    hw05DoesNotRequireHw19,
    hw19T02IsPurOwned,
    ramPriceNotSeparateDefaultTask,
    fw01SizingIsTechnicalFeasibility,
  };
}
