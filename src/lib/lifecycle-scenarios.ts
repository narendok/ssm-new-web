/**
 * Six Realistic Lifecycle Scenarios (§14.14) & Connected Fixture Contract (§14.13)
 * Reference: ANTIGRAVITY_READY_TO_USE_CONSOLIDATED_HANDOFF_2026-10-21.md §14.12 - §14.14
 * 
 * S01: INTERNAL-JIG       (Internal Harness & EOL Jig; internal equipment, no external client)
 * S02: DECLINED-ENQUIRY   (Extended-Temperature Tracker; terminal declined enquiry; NO project created)
 * S03: CLIENT-POC         (Fleet OBD Tracker PoC; 10 devices, client feedback pending)
 * S04: SYSTEM-PILOT       (Vehicle Gateway Integration Pilot; HSI and customer pilot underway)
 * S05: PILOT-REFINEMENT   (Cold-Chain Tracker Pilot Refinement; alert duplication under regression review)
 * S06: BULK-PRODUCTION    (Rugged Fleet Tracker Production; 500 planned, 200 lot 1: 150 accepted, 5 held, 45 inspection)
 * 
 * Safety note: All records are synthetic non-manufacturing test fixtures.
 */

export type ScenarioState =
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
  id: "S01" | "S02" | "S03" | "S04" | "S05" | "S06";
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
    clientName: "Internal Hexense Labs — Production Tooling",
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
    clientName: "Nordic Fleet Logistics AB",
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
    clientName: "Tata Motors Limited · EV Fleet Division",
    businessStory:
      "Client-facing proof of concept for an illustrative 10 prototype devices. Bench evaluation demonstrated reporting, but ignition debounce timing needs clarification before customer trial.",
    currentPosition:
      "Enquiry → qualified opportunity → accepted scoped feasibility → explicit project gate → requirements/PRS draft and reviewed baseline → prototype BOM/design/build → initial bench evidence → PoC delivery/evaluation.",
    stageRemark:
      "Basic reporting demonstrated on the agreed test setup; ignition-state debounce feedback remains pending. PoC acceptance does not authorize mass production.",
    currentNextAction:
      "Await client PoC feedback and one interface clarification regarding ignition debounce threshold.",
    stageHistory: [
      {
        stageId: "POC-STG-1",
        stageName: "Enquiry & Contract Review Gate",
        status: "Completed",
        startDate: "2026-08-01",
        endDate: "2026-08-10",
        prerequisite: "Customer SOR and pilot scope agreed",
        stageRemark: "Contract review HLPL/F/MKT/01 approved for 10-unit PoC.",
        decisionOrReason: "Project TEST-POC-01 authorized by MD & Sales Lead.",
        nextAction: "Draft PRS and tentative BOM.",
      },
      {
        stageId: "POC-STG-2",
        stageName: "PRS & Prototype Bring-up",
        status: "Completed",
        startDate: "2026-08-12",
        endDate: "2026-09-05",
        prerequisite: "Reviewed schematic and 10 hand-assembled proto units",
        stageRemark: "10 proto units built in Lab 1. CAN telemetry operational.",
        decisionOrReason: "Bench test report accepted by QA.",
        nextAction: "Deploy to client test vehicle fleet for field validation.",
      },
      {
        stageId: "POC-STG-3",
        stageName: "PoC Field Trial Evaluation",
        status: "In_Progress",
        startDate: "2026-09-10",
        prerequisite: "Customer trial observation period",
        stageRemark: "Basic reporting demonstrated on the agreed test setup; ignition-state debounce feedback remains pending. PoC acceptance does not authorize mass production.",
        decisionOrReason: "Customer feedback collection active.",
        nextAction: "Review ignition line debounce response from Tata engineers.",
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
        state: "Approved/Frozen",
        nextAction: "Signed delivery challan on file in Vault",
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
    clientName: "Ashok Leyland Limited · Commercial Trucks",
    businessStory:
      "Full vehicle gateway system integration and customer pilot underway. Hardware, firmware, and mechanical baselines frozen; integration bench complete; multi-department dependencies visible.",
    currentPosition:
      "Requirements → technical feasibility → approved project → hardware/firmware/mechanical design baselines → validation → HSI/system integration → controlled pilot candidate → customer pilot.",
    stageRemark:
      "Bench integration complete for the agreed sample configuration; customer pilot observation period remains open.",
    currentNextAction:
      "Complete 30-day customer pilot observation period across 5 trial commercial trucks.",
    stageHistory: [
      {
        stageId: "PLT-STG-1",
        stageName: "Design Baselines & HSI Freeze",
        status: "Completed",
        startDate: "2026-07-01",
        endDate: "2026-08-15",
        prerequisite: "Hardware Schematics Rev B + J1939 Telemetry Spec approved",
        stageRemark: "All 5 technical HODs signed off HSI interface baseline.",
        decisionOrReason: "Approved for SMT pilot staging.",
        nextAction: "Fabricate 50 pilot units on SMT Line 2.",
      },
      {
        stageId: "PLT-STG-2",
        stageName: "Bench Integration & DVP&R Pre-compliance",
        status: "Completed",
        startDate: "2026-08-20",
        endDate: "2026-09-30",
        prerequisite: "ISO 7637-2 electrical transient test pass",
        stageRemark: "Passed 16 of 18 DVP&R items; temperature chambers certified.",
        decisionOrReason: "Pilot release candidate accepted by QA.",
        nextAction: "Begin vehicle installation and telemetry observation.",
      },
      {
        stageId: "PLT-STG-3",
        stageName: "Customer Fleet Pilot Trial",
        status: "In_Progress",
        startDate: "2026-10-01",
        prerequisite: "30-day live CAN logging without gateway reboot",
        stageRemark: "Bench integration complete for the agreed sample configuration; customer pilot observation period remains open.",
        decisionOrReason: "Active customer field observation in Hosur test track.",
        nextAction: "Daily OTA telemetry error rate monitoring.",
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
        state: "Approved/Frozen",
        nextAction: "MQTT 3.1.1 broker operational; 99.98% packet receipt verified",
        criticalPath: false,
      },
      {
        id: "dep-s04-2",
        whatNeeded: "Customer Pilot 30-Day Field Sign-off",
        deliverableCode: "HLPL-VGW-QA-PILOT-01",
        providerDept: "Quality Assurance",
        providerLead: "Jordan Blake",
        waitingDept: "Executive Admin",
        state: "Under Review",
        nextAction: "Day 19 of 30 currently logged with zero fatal resets",
        criticalPath: true,
      },
    ],
  },
  {
    id: "S05",
    fixtureKey: "PILOT-REFINEMENT",
    title: "TEST Cold-Chain Tracker Pilot Refinement",
    projectCode: "TEST-REFINEMENT-01",
    enquiryCode: "ENQ-2026-CCT-01",
    isExternalClient: true,
    clientName: "TransFresh Cold Chain Solutions",
    businessStory:
      "Planned engineering and prototype build completed, but customer pilot identified intermittent alert duplication during LTE cell handover. Corrective firmware candidate is under regression review.",
    currentPosition:
      "Requirements/design/build/validation → pilot issue → actual simulated feedback → linked engineering change/NCR as applicable → refinement tasks/retest plan.",
    stageRemark:
      "Pilot feedback identified intermittent alert duplication; corrective candidate is under regression review. Final customer acceptance and bulk release remain blocked.",
    currentNextAction:
      "QA regression re-test of firmware patch v2.1.2 on cell handover test bench.",
    stageHistory: [
      {
        stageId: "REF-STG-1",
        stageName: "Engineering & Pilot Build",
        status: "Completed",
        startDate: "2026-06-01",
        endDate: "2026-08-30",
        prerequisite: "All engineering CAD, schematics, and pilot batch verified",
        stageRemark: "Initial pilot hardware build delivered to customer fleet.",
        decisionOrReason: "Historical engineering phase completed.",
        nextAction: "Customer pilot observation.",
      },
      {
        stageId: "REF-STG-2",
        stageName: "Pilot Observation & Issue Logging",
        status: "Completed",
        startDate: "2026-09-01",
        endDate: "2026-09-20",
        prerequisite: "Customer anomaly report logged in NCR system",
        stageRemark: "Customer reported duplicate high-temperature excursion SMS alerts.",
        decisionOrReason: "ECR-2026-042 raised by QA for cellular queue debounce.",
        nextAction: "Firmware team patch and regression verification.",
      },
      {
        stageId: "REF-STG-3",
        stageName: "Regression Verification & Refinement",
        status: "Under_Review",
        startDate: "2026-09-25",
        prerequisite: "Zero alert duplication on cell border simulated handover",
        stageRemark: "Pilot feedback identified intermittent alert duplication; corrective candidate is under regression review. Final customer acceptance and bulk release remain blocked.",
        decisionOrReason: "Patch v2.1.2 under dual testing by FW and QA.",
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
        whatNeeded: "Engineering Change Order ECR-2026-042 Sign-off",
        deliverableCode: "HLPL-CCT-QA-ECR-042",
        providerDept: "Quality Assurance",
        providerLead: "Jordan Blake",
        waitingDept: "Manufacturing & Client",
        state: "Under Review",
        nextAction: "Reviewing regression delta before authorizing client release",
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
    clientName: "Bharat Fleet Telematics Limited",
    businessStory:
      "Released product now in ongoing bulk production. Reviewed requirements, design baselines, and pilot acceptance complete. Currently executing 500-unit planned order with strict quantity reconciliation.",
    currentPosition:
      "Reviewed requirements and design → verified validation → recorded pilot acceptance → authorized production release → released BOM/process/control-plan baseline → production orders/lots → receiving/inspection/EOL/release evidence → dispatch/receivables.",
    stageRemark:
      "Hold disposition pending for five units; only accepted quantity is eligible for release.",
    currentNextAction:
      "QA material review board disposition on 5 held units; release 150 accepted units to dispatch.",
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
        prerequisite: "PPAP Level 3, Control Plan, and Line 1 Qualification",
        stageRemark: "PPAP warrant signed by client. SMT reflow profile validated.",
        decisionOrReason: "Formal mass production release authorized by MD.",
        nextAction: "Issue Work Order for Lot 1 (200 units).",
      },
      {
        stageId: "PRD-STG-2",
        stageName: "Lot 1 Production Run & EOL Testing",
        status: "In_Progress",
        startDate: "2026-08-01",
        prerequisite: "Automated test jig flashing and AOI inspection",
        stageRemark: "Hold disposition pending for five units; only accepted quantity is eligible for release.",
        decisionOrReason: "150 units passed 100% EOL (accepted); 5 units held pending MRB disposition; 45 units pending final inspection.",
        nextAction: "Execute MRB disposition and ship first 150 units with commercial invoice.",
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
        whatNeeded: "Commercial Tax Invoice for 150 Accepted Units",
        deliverableCode: "HLPL-RFT-FIN-INV-01",
        providerDept: "Finance",
        providerLead: "Priya Voss",
        waitingDept: "Client Logistics & Dispatch",
        state: "Submitted",
        nextAction: "Ready for GST e-way bill generation upon release",
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
 * acceptedUnits + heldUnits + pendingInspectionUnits === lotQuantity
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
        customer: "Tata Motors Limited · EV Fleet Division",
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
        fields: { projectId: "TEST-POC-01", customer: "Tata Motors Limited", revision: "01" },
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
        customer: "Apex Telematics Corp",
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
      title: "TEST Cold-Chain Tracker Pilot Refinement",
      type: "Project",
      status: "Open",
      area: "rnd",
      priority: "Normal",
      fields: {
        revision: "01",
        customer: "BioPharma Transport Ltd",
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
      title: "TEST Rugged Fleet Tracker Production",
      type: "Project",
      status: "Open",
      area: "emf",
      priority: "Normal",
      fields: {
        revision: "01",
        customer: "National Logistics Fleet",
        plannedUnits: "500",
        currentStage: "Stage 6",
      },
    },
    records: [
      {
        id: "fix-s06-rec-1",
        reference: "HLPL-RFT-SAL-ORD-01",
        title: "Customer Commercial Order 500 Trackers",
        type: "Order",
        status: "Approved",
        area: "sales",
        priority: "Normal",
        fields: { projectId: "TEST-PROD-01", plannedQuantity: "500", revision: "01" },
      },
      {
        id: "fix-s06-rec-2",
        reference: "HLPL-RFT-EHW-BOM-01",
        title: "Mass Production Released BOM Rev 03",
        type: "BOM",
        status: "Released",
        area: "ehw",
        priority: "Critical",
        fields: { projectId: "TEST-PROD-01", stage: "released", revision: "03" },
      },
      {
        id: "fix-s06-rec-3",
        reference: "HLPL-RFT-EMF-WO-01",
        title: "Manufacturing Work Order Lot 1 (200 Units)",
        type: "Production order",
        status: "Open",
        area: "emf",
        priority: "High",
        fields: { projectId: "TEST-PROD-01", lotQuantity: "200", remainingBalance: "300", revision: "01" },
      },
      {
        id: "fix-s06-rec-4",
        reference: "HLPL-RFT-QA-ACC-01",
        title: "Lot 1 EOL Acceptance Batch (150 Units)",
        type: "Inspection",
        status: "Approved",
        area: "qa",
        priority: "Normal",
        fields: { projectId: "TEST-PROD-01", acceptedQuantity: "150", revision: "01" },
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
        title: "Commercial Tax Invoice for 150 Accepted Units",
        type: "Invoice",
        status: "Submitted",
        area: "fin",
        priority: "High",
        fields: { projectId: "TEST-PROD-01", invoicedQuantity: "150", revision: "01" },
      },
    ],
    documents: [
      {
        id: "doc-s06-1",
        title: "Lot 1 Certificate of Conformance (150 Units)",
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
