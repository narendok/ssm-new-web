/**
 * Six baseline scenarios plus LC2-P10 offline telematics (§14.14) & Connected Fixture Contract (§14.13)
 * Reference: ANTIGRAVITY_READY_TO_USE_CONSOLIDATED_HANDOFF_2026-10-21.md §14.12 - §14.14
 * 
 * S01: INTERNAL-JIG       (Internal Harness & EOL Jig; internal equipment, no external client)
 * S02: DECLINED-ENQUIRY   (Extended-Temperature Tracker; terminal declined enquiry; NO project created)
 * S03: CLIENT-POC         (Fleet OBD Tracker PoC; 10 devices, client feedback pending)
 * S04: SYSTEM-PILOT       (Vehicle Gateway Integration Pilot; HSI and customer pilot underway)
 * S05: PILOT-REFINEMENT   (fictional cold-chain workflow; synthetic alert issue under regression review)
 * S06: BULK-PRODUCTION    (fictional production workflow; simulated QA counts, no customer acceptance or shipment)
 * S10: OFFLINE-TELEMATICS (Fictional 4G/GNSS + local LoRa research PoC; feasibility not frozen)
 * 
 * Safety note: All records are synthetic non-manufacturing test fixtures.
 */

export type ScenarioState =
  | "Not attached"
  | "Missing"
  | "Submitted"
  | "Under Review"
  | "Approved/Frozen"
  | "Returned/Rework"
  | "Not Applicable";

export interface ScenarioStageStep {
  stageId: string;
  stageName: string;
  status: "Completed" | "In_Progress" | "Under_Review" | "Pending" | "Declined";
  startDate: string;
  endDate?: string | undefined;
  prerequisite: string;
  stageRemark: string;
  decisionOrReason: string;
  nextAction: string;
}

export interface ScenarioDependency {
  id: string;
  whatNeeded: string;
  deliverableCode: string;
  providerDept: string;
  providerLead: string;
  waitingDept: string;
  state: ScenarioState;
  nextAction: string;
  criticalPath: boolean;
}

export interface ProductionReconciliation {
  totalPlannedUnits: number;
  lotQuantity: number;
  acceptedUnits: number;
  heldUnits: number;
  pendingInspectionUnits: number;
  remainingPlannedUnits: number;
  reconciliationCheckPassed: boolean; // 150 + 5 + 45 === 200, 500 - 200 === 300
}

export interface LifecycleScenario {
  id: "S01" | "S02" | "S03" | "S04" | "S05" | "S06" | "S10";
  fixtureKey: string;
  title: string;
  projectCode?: string | undefined; // S02 has NO project code
  enquiryCode?: string | undefined;
  isExternalClient: boolean;
  clientName?: string | undefined;
  businessStory: string;
  currentPosition: string;
  stageHistory: ScenarioStageStep[];
  dependencies: ScenarioDependency[];
  currentNextAction: string;
  stageRemark: string;
  productionReconciliation?: ProductionReconciliation | undefined;
}

export const LIFECYCLE_SCENARIOS: LifecycleScenario[] = [
  {
    id: "S01",
    fixtureKey: "INTERNAL-JIG",
    title: "TEST Internal Harness & EOL Jig",
    projectCode: "TEST-JIG-01",
    isExternalClient: false,
    clientName: "Northstar Sample Labs · internal fictional TEST",
    businessStory:
      "Internal equipment improvement, no external client. Originates from shopfloor need to accelerate wire harness continuity testing and automated EOL flashing.",
    currentPosition:
      "Internal need → scoped requirements → feasibility → draft interface/fixture design; implementation in progress.",
    stageRemark:
      "Harness pin mapping reviewed; fixture cover clearance remains open. Complete fit check before jig validation.",
    currentNextAction:
      "Mechanical fixture clearance awaiting review by MECH lead.",
    stageHistory: [
      {
        stageId: "STG-1",
        stageName: "Internal Shopfloor Need Identification",
        status: "Completed",
        startDate: "2026-09-01",
        endDate: "2026-09-08",
        prerequisite: "Production test bench bottleneck observed on Line 2",
        stageRemark: "Shopfloor yield report highlighted 12m manual test overhead per harness.",
        decisionOrReason: "Approved by Operations Lead for internal jig development.",
        nextAction: "Define scoped technical requirements and pin mapping.",
      },
      {
        stageId: "STG-2",
        stageName: "Requirements & Feasibility",
        status: "Completed",
        startDate: "2026-09-10",
        endDate: "2026-09-20",
        prerequisite: "Jig electrical pinout specification drafted",
        stageRemark: "Hardware and Mechanical confirmed feasibility with standard 20-pin Pogo block.",
        decisionOrReason: "Feasibility sign-off completed by EHW & MECH.",
        nextAction: "Produce 3D CAD enclosure and wiring schematic.",
      },
      {
        stageId: "STG-3",
        stageName: "Interface & Fixture Design",
        status: "In_Progress",
        startDate: "2026-09-25",
        prerequisite: "Mechanical clearance fit check with Pogo block",
        stageRemark: "Harness pin mapping reviewed; fixture cover clearance remains open. Complete fit check before jig validation.",
        decisionOrReason: "Mechanical clearance fit check pending dimensional tolerance review.",
        nextAction: "MECH lead review of STL 3D clearance model.",
      },
    ],
    dependencies: [
      {
        id: "dep-s01-1",
        whatNeeded: "Harness 20-Pin Continuity Schematic",
        deliverableCode: "HLPL-JIG-EHW-SCH-01",
        providerDept: "Hardware",
        providerLead: "Avery Vale",
        waitingDept: "Mechanical & Testing",
        state: "Approved/Frozen",
        nextAction: "Schematic frozen; awaiting fixture mechanical housing",
        criticalPath: true,
      },
      {
        id: "dep-s01-2",
        whatNeeded: "Pogo-Pin Enclosure Clearance 3D STEP",
        deliverableCode: "HLPL-JIG-MECH-STP-01",
        providerDept: "Mechanical",
        providerLead: "Devin Taylor",
        waitingDept: "Testing (Jig Bring-up)",
        state: "Under Review",
        nextAction: "Verify 1.5mm top cover clearance with toggle clamp",
        criticalPath: true,
      },
    ],
  },
  {
    id: "S02",
    fixtureKey: "DECLINED-ENQUIRY",
    title: "TEST Extended-Temperature Tracker Enquiry",
    enquiryCode: "ENQ-2026-EXT-01",
    projectCode: undefined, // Explicitly NO project created!
    isExternalClient: true,
    clientName: "Maple Harbor Fleet Services · fictional TEST client",
    businessStory:
      "Customer requested -40°C to +85°C certified refrigerated trailer telematics. Technical feasibility identified that required environmental and battery qualification cannot fit the customer's 6-week window. Commercial opportunity declined cleanly.",
    currentPosition:
      "Customer request → clarification → opportunity → technical feasibility with documented limitations → Sales lead closes declined with reason. Terminal enquiry outcome; NO project created.",
    stageRemark:
      "Requested delivery window cannot accommodate the required qualification work; no confirmed alternate scope accepted.",
    currentNextAction:
      "Terminal state reached. Archived in Sales Enquiry Register with formal declination letter sent.",
    stageHistory: [
      {
        stageId: "ENQ-STG-1",
        stageName: "Commercial Enquiry Intake",
        status: "Completed",
        startDate: "2026-09-15",
        endDate: "2026-09-18",
        prerequisite: "Customer RFQ received via sales portal",
        stageRemark: "Customer requested 5,000 units with -40°C operating window in 6 weeks.",
        decisionOrReason: "Enquiry qualified and routed for HOD feasibility review.",
        nextAction: "Perform multidisciplinary feasibility check.",
      },
      {
        stageId: "ENQ-STG-2",
        stageName: "Multidisciplinary Feasibility Evaluation",
        status: "Completed",
        startDate: "2026-09-19",
        endDate: "2026-09-24",
        prerequisite: "Temperature test data on LiFePO4 chemistry and Arrow MCU lead times",
        stageRemark: "Arrow component lead-time for automotive -40°C MCU is 14 weeks. Battery heater required.",
        decisionOrReason: "Feasibility returned as CONDITIONAL / NOT FEASIBLE within customer schedule.",
        nextAction: "Present alternate 16-week timeline to customer.",
      },
      {
        stageId: "ENQ-STG-3",
        stageName: "Commercial Closure & Declination",
        status: "Declined",
        startDate: "2026-09-26",
        endDate: "2026-09-28",
        prerequisite: "Customer feedback on alternate schedule",
        stageRemark: "Requested delivery window cannot accommodate the required qualification work; no confirmed alternate scope accepted.",
        decisionOrReason: "Terminal business declination signed by Sales Lead (Priya Sharma). Zero dummy project created.",
        nextAction: "Enquiry record locked in CRM archive.",
      },
    ],
    dependencies: [
      {
        id: "dep-s02-1",
        whatNeeded: "Automotive Cold-Temp Component Sourcing",
        deliverableCode: "HLPL-EXT-PUR-FEAS-01",
        providerDept: "Purchasing",
        providerLead: "Morgan Reed",
        waitingDept: "Sales & BD",
        state: "Returned/Rework",
        nextAction: "Arrow 14-week lead-time exceeds customer 6-week window",
        criticalPath: true,
      },
    ],
  },
  {
    id: "S03",
    fixtureKey: "CLIENT-POC",
    title: "TEST Fleet OBD Tracker PoC",
    projectCode: "TEST-POC-01",
    enquiryCode: "ENQ-2026-POC-01",
    isExternalClient: true,
    clientName: "Northstar Mobility Works · fictional TEST client",
    businessStory:
      "Local workflow for an illustrative 10-unit proof of concept. A synthetic bench checklist and ignition debounce question are under review; no devices were delivered and no external feedback is recorded.",
    currentPosition:
      "Fictional enquiry → draft feasibility → internal requirements review → prototype planning → synthetic bench checklist and interface clarification. No customer decision or delivery is represented.",
    stageRemark:
      "Illustrative bench workflow only; the 50ms vs 200ms ignition debounce assumption remains unverified. No customer acceptance, test result, or production release is represented.",
    currentNextAction:
      "Resolve the internal test question and define evidence needed before any external trial is considered.",
    stageHistory: [
      {
        stageId: "POC-STG-1",
        stageName: "Enquiry & Opportunity Review",
        status: "Completed",
        startDate: "2026-08-01",
        endDate: "2026-08-10",
        prerequisite: "Fictional test brief entered; scope remains illustrative",
        stageRemark: "Local TEST intake record assembled; no customer SOR or approval is represented.",
        decisionOrReason: "Sample fixture only; no real project authorization or customer decision.",
        nextAction: "Draft PRS and tentative BOM for internal review.",
      },
      {
        stageId: "POC-STG-2",
        stageName: "PRS & Prototype Bring-up",
        status: "Completed",
        startDate: "2026-08-12",
        endDate: "2026-09-05",
        prerequisite: "Draft schematic checklist and illustrative prototype plan",
        stageRemark: "Synthetic bench checklist is in progress; no prototype build, test result, or QA disposition is claimed.",
        decisionOrReason: "Local test workflow only; no controlled approval.",
        nextAction: "Resolve internal interface questions before any external trial is considered.",
      },
      {
        stageId: "POC-STG-3",
        stageName: "Internal PoC Evaluation Checklist",
        status: "In_Progress",
        startDate: "2026-09-10",
        prerequisite: "Repeatable internal test and clarified evidence criteria",
        stageRemark: "Synthetic debounce question remains under internal review; no customer trial or acceptance is recorded.",
        decisionOrReason: "Local fixture review only.",
        nextAction: "Review the debounce assumption with fictional sample owners.",
      },
    ],
    dependencies: [
      {
        id: "dep-s03-1",
        whatNeeded: "Client Ignition-Line Debounce Clarification",
        deliverableCode: "HLPL-POC-SAL-CRD-02",
        providerDept: "Sales & Client",
        providerLead: "Priya Sharma",
        waitingDept: "Firmware (ESW)",
        state: "Under Review",
        nextAction: "Confirm 50ms vs 200ms debounce filter timing",
        criticalPath: true,
      },
      {
        id: "dep-s03-2",
        whatNeeded: "10 Proto Physical Delivery Receipt",
        deliverableCode: "HLPL-POC-DEL-10",
        providerDept: "Service & IT",
        providerLead: "Kai Morgan",
        waitingDept: "Executive Command",
        state: "Not attached",
        nextAction: "No delivery is represented; keep the local receipt checklist empty.",
        criticalPath: false,
      },
    ],
  },
  {
    id: "S04",
    fixtureKey: "SYSTEM-PILOT",
    title: "TEST Vehicle Gateway Integration Pilot",
    projectCode: "TEST-PILOT-01",
    enquiryCode: "ENQ-2026-VGW-01",
    isExternalClient: true,
    clientName: "Pinecone Fleetworks · fictional TEST client",
    businessStory:
      "Fictional HW+FW+SW gateway integration workflow. Internal interface checks and synthetic evidence rows are in progress; no customer pilot, approval, or release is represented.",
    currentPosition:
      "Draft requirements → cross-track feasibility → internal HW/FW/SW design review → synthetic integration checklist → conditional test planning. External pilot and release remain unauthorized.",
    stageRemark:
      "Internal integration checklist is illustrative and incomplete; no customer observation or acceptance is recorded.",
    currentNextAction:
      "Complete internal interface review before proposing any external trial.",
    stageHistory: [
      {
        stageId: "PLT-STG-1",
        stageName: "Design Baselines & HSI Freeze",
        status: "Completed",
        startDate: "2026-07-01",
        endDate: "2026-08-15",
        prerequisite: "Draft schematic checklist and interface assumptions",
        stageRemark: "Local TEST interface checklist assembled; departmental review remains pending.",
        decisionOrReason: "No manufacturing or pilot authorization is represented.",
        nextAction: "Resolve interface questions before any build is proposed.",
      },
      {
        stageId: "PLT-STG-2",
        stageName: "Bench Integration & DVP&R Pre-compliance",
        status: "Completed",
        startDate: "2026-08-20",
        endDate: "2026-09-30",
        prerequisite: "Synthetic DVP&R checklist and test plan",
        stageRemark: "Illustrative checklist has 16 of 18 placeholder items; no measured result or certification is claimed.",
        decisionOrReason: "No QA disposition or release is recorded.",
        nextAction: "Complete internal test planning before considering a controlled trial.",
      },
      {
        stageId: "PLT-STG-3",
        stageName: "Conditional Integration Review",
        status: "In_Progress",
        startDate: "2026-10-01",
        prerequisite: "Repeatable internal CAN logging and reset test",
        stageRemark: "Synthetic integration work remains in progress; no external vehicle or customer observation is represented.",
        decisionOrReason: "Local TEST fixture status only.",
        nextAction: "Review internal test-bench telemetry and error logs.",
      },
    ],
    dependencies: [
      {
        id: "dep-s04-1",
        whatNeeded: "Cloud Telemetry Server Ingestion Acknowledgment",
        deliverableCode: "HLPL-VGW-SIT-ACK-01",
        providerDept: "Service & IT",
        providerLead: "Kai Morgan",
        waitingDept: "QA (Compliance)",
        state: "Under Review",
        nextAction: "Synthetic target only; no server connection or receipt measurement is represented.",
        criticalPath: false,
      },
      {
        id: "dep-s04-2",
        whatNeeded: "Internal Pilot Evidence Review",
        deliverableCode: "HLPL-VGW-QA-PILOT-01",
        providerDept: "Quality Assurance",
        providerLead: "Jordan Blake",
        waitingDept: "Executive Admin",
        state: "Under Review",
        nextAction: "Fictional progress marker only; no external fleet trial or customer sign-off.",
        criticalPath: true,
      },
    ],
  },
  {
    id: "S05",
    fixtureKey: "PILOT-REFINEMENT",
    title: "TEST Cold-Chain Tracker Regression Refinement",
    projectCode: "TEST-REFINEMENT-01",
    enquiryCode: "ENQ-2026-CCT-01",
    isExternalClient: true,
    clientName: "Frostline Cargo Systems · fictional TEST client",
    businessStory:
      "Fictional engineering workflow with a synthetic alert-duplication issue during simulated LTE handover. Corrective firmware candidate is under internal regression review; no real pilot or customer feedback is represented.",
    currentPosition:
      "Requirements/design/build/validation → synthetic issue log → linked engineering change/NCR fixture → refinement tasks/retest plan.",
    stageRemark:
      "Synthetic test fixture records intermittent alert duplication; corrective candidate is under regression review. No customer acceptance or release is represented.",
    currentNextAction:
      "QA regression re-test of firmware patch v2.1.2 on cell handover test bench.",
    stageHistory: [
      {
        stageId: "REF-STG-1",
        stageName: "Engineering & Pilot Build",
        status: "Completed",
        startDate: "2026-06-01",
        endDate: "2026-08-30",
        prerequisite: "Illustrative engineering CAD and schematic checklist",
        stageRemark: "Fictional prototype workflow only; no hardware was built or delivered.",
        decisionOrReason: "Sample lifecycle state for UI testing only.",
        nextAction: "Review synthetic test observations internally.",
      },
      {
        stageId: "REF-STG-2",
        stageName: "Synthetic Observation & Issue Logging",
        status: "Completed",
        startDate: "2026-09-01",
        endDate: "2026-09-20",
        prerequisite: "Synthetic anomaly report fixture",
        stageRemark: "Test fixture records duplicate high-temperature alert messages in simulated LTE handover; no customer report is represented.",
        decisionOrReason: "Sample ECR raised for cellular queue debounce testing.",
        nextAction: "Firmware team patch and regression verification.",
      },
      {
        stageId: "REF-STG-3",
        stageName: "Regression Verification & Refinement",
        status: "Under_Review",
        startDate: "2026-09-25",
        prerequisite: "Zero alert duplication on cell border simulated handover",
        stageRemark: "Synthetic test fixture records intermittent alert duplication; corrective candidate is under internal regression review. No real customer feedback or acceptance is represented.",
        decisionOrReason: "Patch v2.1.2 is a sample candidate under an internal FW/QA workflow; no result is represented.",
        nextAction: "Complete 48-hour continuous cellular tower roaming loop test.",
      },
    ],
    dependencies: [
      {
        id: "dep-s05-1",
        whatNeeded: "Firmware v2.1.2 Handover Debounce Patch",
        deliverableCode: "HLPL-CCT-FW-REL-2.1.2",
        providerDept: "Firmware",
        providerLead: "Quinn Alex",
        waitingDept: "QA (Regression Test)",
        state: "Submitted",
        nextAction: "Awaiting QA dual-chamber test confirmation",
        criticalPath: true,
      },
      {
        id: "dep-s05-2",
        whatNeeded: "Engineering Change Order ECR-2026-042 Internal Review",
        deliverableCode: "HLPL-CCT-QA-ECR-042",
        providerDept: "Quality Assurance",
        providerLead: "Jordan Blake",
        waitingDept: "Manufacturing & Systems Test",
        state: "Under Review",
        nextAction: "Review synthetic regression delta; no external release is authorized or represented.",
        criticalPath: true,
      },
    ],
  },
  {
    id: "S06",
    fixtureKey: "BULK-PRODUCTION",
    title: "TEST Rugged Fleet Tracker Production",
    projectCode: "TEST-PROD-01",
    enquiryCode: "ENQ-2026-RFT-01",
    isExternalClient: true,
    clientName: "Willow Ridge Fleet Labs · fictional TEST client",
    businessStory:
      "Fictional lifecycle simulation of a production-stage HW+FW program. Quantities represent sample records only; there is no real production, customer decision, shipment, or revenue.",
    currentPosition:
      "Requirements/design → internal validation checklist → simulated production-readiness review → sample lot/receiving/inspection records. No real customer acceptance, authorization, shipment, or invoice is represented.",
    stageRemark:
      "Simulation only: 150 internal QA-pass placeholders, 5 held placeholders, and 45 inspection placeholders; no customer acceptance or dispatch is represented.",
    currentNextAction:
      "Complete the internal sample MRB and inspection workflow; do not dispatch or infer customer acceptance from local fixture data.",
    productionReconciliation: {
      totalPlannedUnits: 500,
      lotQuantity: 200,
      acceptedUnits: 150,
      heldUnits: 5,
      pendingInspectionUnits: 45,
      remainingPlannedUnits: 300,
      reconciliationCheckPassed: true, // 150 + 5 + 45 === 200; 500 - 200 === 300
    },
    stageHistory: [
      {
        stageId: "PRD-STG-1",
        stageName: "APQP & Production Readiness Release",
        status: "Completed",
        startDate: "2026-05-01",
        endDate: "2026-07-31",
        prerequisite: "Illustrative PPAP, control plan, and line-qualification checklist",
        stageRemark: "Fictional checklist entries only; no PPAP submission, client warrant, line validation, or release is represented.",
        decisionOrReason: "Sample lifecycle state only; no management or customer authorization.",
        nextAction: "Review sample work-order fields without initiating production.",
      },
      {
        stageId: "PRD-STG-2",
        stageName: "Lot 1 Production Run & EOL Testing",
        status: "In_Progress",
        startDate: "2026-08-01",
        prerequisite: "Automated test jig flashing and AOI inspection",
        stageRemark: "Simulated QA placeholders: 150 internal-pass, 5 held, 45 pending inspection; no customer acceptance or shipment.",
        decisionOrReason: "Illustrative quantity reconciliation only; no real EOL result or disposition exists.",
        nextAction: "Complete local sample review; no invoice or dispatch action is available.",
      },
    ],
    dependencies: [
      {
        id: "dep-s06-1",
        whatNeeded: "MRB Disposition on 5 SMT Held Units",
        deliverableCode: "HLPL-RFT-QA-MRB-01",
        providerDept: "Quality Assurance",
        providerLead: "Jordan Blake",
        waitingDept: "Manufacturing (EMF)",
        state: "Under Review",
        nextAction: "Cold solder joint inspect under X-Ray machine",
        criticalPath: false,
      },
      {
        id: "dep-s06-2",
        whatNeeded: "Sample Invoice Record (not issued)",
        deliverableCode: "HLPL-RFT-FIN-INV-01",
        providerDept: "Finance",
        providerLead: "Priya Voss",
        waitingDept: "Client Logistics & Dispatch",
        state: "Submitted",
        nextAction: "Metadata-only test fixture; no tax invoice, e-way bill, or shipment is generated.",
        criticalPath: true,
      },
    ],
  },
  {
    id: "S10",
    fixtureKey: "LC2-P10-OFFLINE-TELEMATICS",
    title: "DEMO_ONLY Offline-Capable 4G/GNSS Tracker PoC",
    projectCode: "DEMO-PROJ-010",
    enquiryCode: "DEMO-ENQ-010",
    isExternalClient: true,
    clientName: "Northstar Field Systems (fictional)",
    businessStory:
      "Synthetic client PoC for a 4G/GNSS field tracker with NavIC/IRNSS receiver support to be assessed and a local LoRa path researched for operation without public internet. This is a reference walkthrough, not a validated design or approved customer project.",
    currentPosition:
      "Fictional intake + draft OMS → feasibility and requirements under review → freeze gate pending → conditional HW/FW/SW design, PoC build, verification, client demo and closeout. No pilot or production authorization.",
    stageRemark:
      "DEMO_ONLY · CM_02 feasibility is not approved or frozen. Receiver/NavIC capability, local LoRa topology and legal limits, power/storage targets, carrier/backhaul and PoC acceptance criteria remain open; no measured results are asserted.",
    currentNextAction:
      "Resolve owner/client questions in the feasibility table, attach evidence, and record an authorized requirements-freeze decision before enabling downstream development tasks.",
    stageHistory: [
      {
        stageId: "DEMO-CM-01",
        stageName: "Fictional client intake and PoC boundary",
        status: "Completed",
        startDate: "2026-10-29",
        endDate: "2026-10-29",
        prerequisite: "Synthetic enquiry DEMO-ENQ-010; draft OMS DEMO-OMS-010",
        stageRemark: "PoC only. Quantity, commercial values, delivery promise and production scope are not recorded.",
        decisionOrReason: "Reference scenario created for product walkthrough; no real customer decision or order.",
        nextAction: "Review feasibility questions with the relevant department owners.",
      },
      {
        stageId: "DEMO-CM-02",
        stageName: "Cross-department feasibility and requirement draft",
        status: "Under_Review",
        startDate: "2026-10-29",
        prerequisite: "Fictional intake and project scope",
        stageRemark: "No requirement baseline is frozen. Public internet independence, local LoRa reachability, remote sync, GNSS/NavIC support, power and storage are separate questions.",
        decisionOrReason: "Open by design; do not infer technical feasibility, certification applicability or client acceptance.",
        nextAction: "Gather owner responses and evidence; freeze a versioned PMSS only after blockers are resolved.",
      },
      {
        stageId: "DEMO-HW-FW-SW-PLAN",
        stageName: "Conditional HW + FW + SW development and PoC",
        status: "Pending",
        startDate: "2026-10-29",
        prerequisite: "Authorized v1.0 requirement freeze and approved PoC scope",
        stageRemark: "Planned lifecycle preview only. Hardware, firmware, software, integration, test, documentation and client-demo tasks must activate through their real gates.",
        decisionOrReason: "No development work, test result or release is represented as completed.",
        nextAction: "Keep stages and tasks planned until the prerequisite freeze is approved.",
      },
    ],
    dependencies: [
      {
        id: "dep-s10-ehw-1",
        whatNeeded: "Receiver, antenna and NavIC/IRNSS capability assessment",
        deliverableCode: "DEMO-PROD-010-EHW-FEAS",
        providerDept: "Electronics Manufacturing / EHW",
        providerLead: "DEMO_ONLY · owner TBD",
        waitingDept: "Firmware, Testing & Sales",
        state: "Submitted",
        nextAction: "Confirm candidate receiver documentation, supported constellations, antenna constraints and test method; do not claim a fix or performance value before measurements.",
        criticalPath: true,
      },
      {
        id: "dep-s10-lora-1",
        whatNeeded: "Local LoRa topology, gateway and offline data-flow research",
        deliverableCode: "DEMO-PROD-010-SW-LO-RESEARCH",
        providerDept: "SW / Systems Engineering",
        providerLead: "DEMO_ONLY · owner TBD",
        waitingDept: "Electronics, Firmware & Client",
        state: "Under Review",
        nextAction: "Define whether local peer or gateway exchange is intended; verify coverage, capacity, regional band and duty-cycle constraints before freeze.",
        criticalPath: true,
      },
      {
        id: "dep-s10-pur-1",
        whatNeeded: "Candidate cellular, GNSS and LoRa component availability and lead-time",
        deliverableCode: "DEMO-PROD-010-PUR-FEAS",
        providerDept: "Purchasing",
        providerLead: "DEMO_ONLY · owner TBD",
        waitingDept: "Electronics & Finance",
        state: "Submitted",
        nextAction: "Return sourced candidate evidence and indicative lead-time; no quotation, order or stock commitment is implied.",
        criticalPath: false,
      },
      {
        id: "dep-s10-qa-1",
        whatNeeded: "PoC verification criteria and conditional certification applicability",
        deliverableCode: "DEMO-PROD-010-QA-PLAN",
        providerDept: "Quality & Testing",
        providerLead: "DEMO_ONLY · owner TBD",
        waitingDept: "All technical owners & Client",
        state: "Submitted",
        nextAction: "Separate internal PoC evidence from any market certification; establish applicable markets and evidence before naming required certificates.",
        criticalPath: true,
      },
    ],
  },
];

/**
 * Helper to fetch a scenario by key or ID
 */
export function getScenario(idOrKey: string): LifecycleScenario | undefined {
  return LIFECYCLE_SCENARIOS.find(
    (s) => s.id === idOrKey || s.fixtureKey === idOrKey || s.projectCode === idOrKey
  );
}

/**
 * Validate that S06 Production reconciliation satisfies the mathematical equality:
 * acceptedUnits (internal QA only in TEST fixtures) + heldUnits + pendingInspectionUnits === lotQuantity
 * totalPlannedUnits - lotQuantity === remainingPlannedUnits
 */
export function verifyProductionReconciliation(rec: ProductionReconciliation): boolean {
  const lotSum = rec.acceptedUnits + rec.heldUnits + rec.pendingInspectionUnits;
  const planDiff = rec.totalPlannedUnits - rec.lotQuantity;
  return lotSum === rec.lotQuantity && planDiff === rec.remainingPlannedUnits;
}


import type { AnalysisRecord, AnalysisDocument } from "./project-analysis-data";

export interface ScenarioFixtureManifest {
  scenarioId: "S01" | "S02" | "S03" | "S04" | "S05" | "S06";
  fixtureKey: string;
  project?: AnalysisRecord | undefined;
  records: AnalysisRecord[];
  documents: AnalysisDocument[];
}

export const SCENARIO_FIXTURE_MANIFESTS: ScenarioFixtureManifest[] = [
  {
    scenarioId: "S01",
    fixtureKey: "INTERNAL-JIG",
    project: {
      id: "fix-s01-prj",
      reference: "TEST-JIG-01",
      title: "TEST Internal Harness & EOL Jig",
      type: "Project",
      status: "Open",
      area: "rnd",
      priority: "Normal",
      fields: {
        revision: "01",
        customer: "Internal Hexense Labs — Production Tooling",
        currentStage: "Stage 4",
      },
    },
    records: [
      {
        id: "fix-s01-rec-1",
        reference: "HLPL-JIG-EHW-SCH-01",
        title: "Harness 20-Pin Continuity Schematic",
        type: "Schematic",
        status: "Approved",
        area: "ehw",
        priority: "High",
        fields: { projectId: "TEST-JIG-01", revision: "01" },
      },
      {
        id: "fix-s01-rec-2",
        reference: "HLPL-JIG-MECH-STP-01",
        title: "Pogo-Pin Enclosure Clearance 3D STEP",
        type: "CAD",
        status: "In review",
        area: "mech",
        priority: "Normal",
        fields: { projectId: "TEST-JIG-01", revision: "01" },
      },
      {
        id: "fix-s01-rec-3",
        reference: "HLPL-JIG-TE-PRG-01",
        title: "Automated EOL Flashing Script",
        type: "Program",
        status: "Draft",
        area: "fw",
        priority: "Normal",
        fields: { projectId: "TEST-JIG-01", revision: "01" },
      },
    ],
    documents: [
      {
        id: "doc-s01-1",
        title: "EOL Jig Mechanical Assembly Drawing",
        type: "Drawing",
        linkedRecordRefs: ["TEST-JIG-01", "HLPL-JIG-MECH-STP-01"],
      },
    ],
  },
  {
    scenarioId: "S02",
    fixtureKey: "DECLINED-ENQUIRY",
    project: undefined, // strictly NO project created per §14.14 S02 invariant
    records: [
      {
        id: "fix-s02-rec-1",
        reference: "ENQ-2026-EXT-01",
        title: "TEST Extended-Temperature Tracker Enquiry",
        type: "Enquiry",
        status: "Declined",
        area: "sales",
        priority: "Normal",
        fields: {
          customer: "Nordic Fleet Logistics AB",
          targetWindow: "6 Weeks",
          terminalReason: "Arrow 14-week lead-time exceeds customer 6-week window",
          revision: "01",
        },
      },
      {
        id: "fix-s02-rec-2",
        reference: "HLPL-EXT-PUR-FEAS-01",
        title: "Automotive Cold-Temp Component Sourcing Feasibility",
        type: "Contract review",
        status: "Rejected",
        area: "pur",
        priority: "High",
        fields: {
          supplier: "Arrow Electronics",
          leadTimeWeeks: "14",
          constraintWeeks: "6",
          outcome: "Feasibility Rejected",
          revision: "01",
          linkedRecords: "ENQ-2026-EXT-01",
        },
      },
    ],
    documents: [
      {
        id: "doc-s02-1",
        title: "Formal Commercial Declination Letter",
        type: "Notice",
        linkedRecordRefs: ["ENQ-2026-EXT-01", "HLPL-EXT-PUR-FEAS-01"],
      },
    ],
  },
  {
    scenarioId: "S03",
    fixtureKey: "CLIENT-POC",
    project: {
      id: "fix-s03-prj",
      reference: "TEST-POC-01",
      title: "TEST Fleet OBD Tracker PoC",
      type: "Project",
      status: "Open",
      area: "sales",
      priority: "Normal",
      fields: {
        revision: "01",
        customer: "Northstar Mobility Works · fictional TEST client",
        currentStage: "Stage 3",
      },
    },
    records: [
      {
        id: "fix-s03-rec-1",
        reference: "ENQ-2026-POC-01",
        title: "Fleet OBD PoC Enquiry",
        type: "Enquiry",
        status: "Approved",
        area: "sales",
        priority: "Normal",
        fields: { projectId: "TEST-POC-01", customer: "Northstar Mobility Works · fictional TEST client", revision: "01" },
      },
      {
        id: "fix-s03-rec-2",
        reference: "HLPL-POC-SAL-CRD-02",
        title: "Client Ignition-Line Debounce Clarification",
        type: "Clarification",
        status: "In review",
        area: "sales",
        priority: "High",
        fields: { projectId: "TEST-POC-01", targetDebounce: "50ms vs 200ms", revision: "01" },
      },
      {
        id: "fix-s03-rec-3",
        reference: "HLPL-POC-EHW-PRS-01",
        title: "Product Requirement Specification · OBD PoC",
        type: "PRS",
        status: "Approved",
        area: "ehw",
        priority: "Normal",
        fields: { projectId: "TEST-POC-01", revision: "01" },
      },
      {
        id: "fix-s03-rec-4",
        reference: "HLPL-POC-EMF-PRT-01",
        title: "10-Unit Prototype Build Record",
        type: "Prototype",
        status: "Approved",
        area: "emf",
        priority: "Normal",
        fields: { projectId: "TEST-POC-01", quantity: "10", revision: "01" },
      },
    ],
    documents: [
      {
        id: "doc-s03-1",
        title: "PoC Field Trial Dispatch & Verification Note",
        type: "Report",
        linkedRecordRefs: ["TEST-POC-01", "HLPL-POC-EMF-PRT-01"],
      },
    ],
  },
  {
    scenarioId: "S04",
    fixtureKey: "SYSTEM-PILOT",
    project: {
      id: "fix-s04-prj",
      reference: "TEST-PILOT-01",
      title: "TEST Vehicle Gateway Integration Pilot",
      type: "Project",
      status: "Open",
      area: "rnd",
      priority: "Normal",
      fields: {
        revision: "01",
        customer: "Pinecone Fleetworks · fictional TEST client",
        currentStage: "Stage 5",
      },
    },
    records: [
      {
        id: "fix-s04-rec-1",
        reference: "HLPL-GWY-EHW-SCH-01",
        title: "Gateway Controller Schematic V2",
        type: "Schematic",
        status: "Approved",
        area: "ehw",
        priority: "Normal",
        fields: { projectId: "TEST-PILOT-01", revision: "02" },
      },
      {
        id: "fix-s04-rec-2",
        reference: "HLPL-GWY-FW-BIN-01",
        title: "Gateway Telemetry Binary v1.2",
        type: "Release",
        status: "Approved",
        area: "fw",
        priority: "High",
        fields: { projectId: "TEST-PILOT-01", revision: "01" },
      },
      {
        id: "fix-s04-rec-3",
        reference: "HLPL-GWY-QA-HSI-01",
        title: "Hardware-Software Integration (HSI) Test Report",
        type: "Test report",
        status: "In review",
        area: "qa",
        priority: "High",
        fields: { projectId: "TEST-PILOT-01", linkedRecords: "HLPL-GWY-FW-BIN-01", revision: "01" },
      },
      {
        id: "fix-s04-rec-4",
        reference: "HLPL-GWY-SAL-PLT-01",
        title: "50-Vehicle Customer Pilot Protocol",
        type: "Protocol",
        status: "Open",
        area: "sales",
        priority: "Normal",
        fields: { projectId: "TEST-PILOT-01", pilotVehicles: "50", revision: "01" },
      },
    ],
    documents: [
      {
        id: "doc-s04-1",
        title: "Gateway HSI Integration & Telemetry Protocol",
        type: "Matrix",
        linkedRecordRefs: ["TEST-PILOT-01", "HLPL-GWY-QA-HSI-01"],
      },
    ],
  },
  {
    scenarioId: "S05",
    fixtureKey: "PILOT-REFINEMENT",
    project: {
      id: "fix-s05-prj",
      reference: "TEST-REFINEMENT-01",
      title: "TEST Cold-Chain Tracker Regression Refinement",
      type: "Project",
      status: "Open",
      area: "rnd",
      priority: "Normal",
      fields: {
        revision: "01",
        customer: "Frostline Cargo Systems · fictional TEST client",
        currentStage: "Stage 5",
      },
    },
    records: [
      {
        id: "fix-s05-rec-1",
        reference: "HLPL-CCT-QA-ECN-01",
        title: "ECN: Temperature Excursion Alert Duplication",
        type: "Engineering change",
        status: "In review",
        area: "qa",
        priority: "Critical",
        fields: { projectId: "TEST-REFINEMENT-01", severity: "High", revision: "01" },
      },
      {
        id: "fix-s05-rec-2",
        reference: "HLPL-CCT-FW-BUG-01",
        title: "Firmware v1.0.4 Alert Debounce Patch",
        type: "Release",
        status: "Submitted",
        area: "fw",
        priority: "High",
        fields: { projectId: "TEST-REFINEMENT-01", patchVersion: "1.0.4", revision: "02" },
      },
      {
        id: "fix-s05-rec-3",
        reference: "HLPL-CCT-QA-REG-01",
        title: "Regression Test Suite Log (Cellular Debounce)",
        type: "Test report",
        status: "Draft",
        area: "qa",
        priority: "Normal",
        fields: { projectId: "TEST-REFINEMENT-01", revision: "01" },
      },
    ],
    documents: [
      {
        id: "doc-s05-1",
        title: "Alert Debounce Regression Verification Procedure",
        type: "Procedure",
        linkedRecordRefs: ["TEST-REFINEMENT-01", "HLPL-CCT-QA-REG-01"],
      },
    ],
  },
  {
    scenarioId: "S06",
    fixtureKey: "BULK-PRODUCTION",
    project: {
      id: "fix-s06-prj",
      reference: "TEST-PROD-01",
      title: "TEST Rugged Fleet Tracker Production Workflow",
      type: "Project",
      status: "Open",
      area: "emf",
      priority: "Normal",
      fields: {
        revision: "01",
        customer: "Willow Ridge Fleet Labs · fictional TEST client",
        plannedUnits: "500",
        currentStage: "Stage 6",
      },
    },
    records: [
      {
        id: "fix-s06-rec-1",
        reference: "HLPL-RFT-SAL-ORD-01",
        title: "Sample Commercial Order Record · Not Issued",
        type: "Order",
        status: "Draft · local TEST",
        area: "sales",
        priority: "Normal",
        fields: { projectId: "TEST-PROD-01", plannedQuantity: "500", revision: "01" },
      },
      {
        id: "fix-s06-rec-2",
        reference: "HLPL-RFT-EHW-BOM-01",
        title: "Sample Production BOM · Not Released",
        type: "BOM",
        status: "Draft · local TEST",
        area: "ehw",
        priority: "Critical",
        fields: { projectId: "TEST-PROD-01", stage: "released", revision: "03" },
      },
      {
        id: "fix-s06-rec-3",
        reference: "HLPL-RFT-EMF-WO-01",
        title: "Sample Manufacturing Work Order · Not Issued",
        type: "Production order",
        status: "Open",
        area: "emf",
        priority: "High",
        fields: { projectId: "TEST-PROD-01", lotQuantity: "200", remainingBalance: "300", revision: "01" },
      },
      {
        id: "fix-s06-rec-4",
        reference: "HLPL-RFT-QA-ACC-01",
        title: "Sample Internal QA Pass Placeholders (150 Units)",
        type: "Inspection",
        status: "Draft · local TEST",
        area: "qa",
        priority: "Normal",
        fields: { projectId: "TEST-PROD-01", simulatedInternalPassQuantity: "150", customerAcceptance: "not represented", revision: "01" },
      },
      {
        id: "fix-s06-rec-5",
        reference: "HLPL-RFT-QA-MRB-01",
        title: "MRB Disposition on 5 SMT Held Units",
        type: "MRB Hold",
        status: "In review",
        area: "qa",
        priority: "High",
        fields: { projectId: "TEST-PROD-01", heldQuantity: "5", disposition: "Pending MRB review", revision: "01" },
      },
      {
        id: "fix-s06-rec-6",
        reference: "HLPL-RFT-QA-INSP-01",
        title: "Lot 1 Final Inspection Queue (45 Units)",
        type: "Inspection",
        status: "Draft",
        area: "qa",
        priority: "Normal",
        fields: { projectId: "TEST-PROD-01", pendingInspectionQuantity: "45", revision: "01" },
      },
      {
        id: "fix-s06-rec-7",
        reference: "HLPL-RFT-FIN-INV-01",
        title: "Sample Invoice Metadata · Not Issued",
        type: "Invoice",
        status: "Metadata only · local TEST",
        area: "fin",
        priority: "High",
        fields: { projectId: "TEST-PROD-01", invoicedQuantity: "0 · not issued", revision: "01" },
      },
    ],
    documents: [
      {
        id: "doc-s06-1",
        title: "Sample Certificate Checklist · Not Issued",
        type: "Certificate",
        linkedRecordRefs: ["TEST-PROD-01", "HLPL-RFT-QA-ACC-01"],
      },
    ],
  },
];

export function getAllScenarioFixtures(): { records: AnalysisRecord[]; documents: AnalysisDocument[] } {
  const records: AnalysisRecord[] = [];
  const documents: AnalysisDocument[] = [];
  for (const manifest of SCENARIO_FIXTURE_MANIFESTS) {
    if (manifest.project) records.push(manifest.project);
    records.push(...manifest.records);
    documents.push(...manifest.documents);
  }
  return { records, documents };
}
