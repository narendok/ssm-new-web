/**
 * Canonical Sample Data Pack & Test Execution Library (Pack: LC2-2026-10-28)
 * Authority: Sample Data and Test Plan (28 October 2026)
 * Reference: ANTIGRAVITY_READY_TO_USE_CONSOLIDATED_HANDOFF_2026-10-21.md §16.10 - §16.11 (Patch 5)
 *
 * Covers all 8 Sample Projects + 1 Declined Enquiry across all 7 Canonical Tracks:
 * - LC2-P01: Internal Equipment Harness Jig (HW only, Internal tooling, HW_31 active bring-up)
 * - LC2-E02: Declined Extended-Temp Enquiry (Pre-project feasibility only, terminal decline, NO project created)
 * - LC2-P03: Fleet OBD Tracker PoC (HW + FW, Client PoC 10 units, INT_03 feedback open)
 * - LC2-P04: Vehicle Gateway Integration Pilot (HW + FW + SW, Client pilot, observation in progress)
 * - LC2-P05: Cold-Chain Tracker Refinement (FW only on existing HW, regression review under FW_11)
 * - LC2-P06: Rugged Fleet Tracker Production (HW + FW, 500 planned, Lot 1 = 200 = 150 accepted + 5 held + 45 inspecting; 300 remaining)
 * - LC2-P07: Internal Service Application (SW only, Internal IT tool, SW_08 active service API integration)
 * - LC2-P08: Existing Product Deployment (Ready-made catalog device, RM_03 active field verification)
 * - LC2-P09: Device Connectivity Upgrade (FW + SW on existing HW, INT_02 active cloud payload compatibility)
 *
 * All records are synthetic DEMO/TEST fixtures.
 */

import type { AnalysisRecord, AnalysisDocument } from "./project-analysis-data";
import {
  type CanonicalProjectTrack,
  computeProgressiveStageAndTaskState,
  type ProjectStageInstance,
  type ProjectTaskInstance,
} from "./canonical-lifecycle";

export interface CanonicalSampleProject {
  fixtureKey: string; // e.g. "LC2-P01"
  projectCode?: string; // e.g. "PRJ-INT-001" (strictly undefined for LC2-E02)
  enquiryCode?: string;
  title: string;
  track: CanonicalProjectTrack;
  isExternalClient: boolean;
  clientName?: string;
  businessStory: string;
  currentActiveStage: string;
  activeSamplePointRemark: string;
  testingGuide: string;
  projectRecord?: AnalysisRecord;
  records: AnalysisRecord[];
  documents: AnalysisDocument[];
  completedStageCodes: string[];
  inProgressStageCodes: string[];
  stages: ProjectStageInstance[];
  activeTasks: ProjectTaskInstance[];
  plannedTaskPreviews: ProjectTaskInstance[];
  productionReconciliation?: {
    totalPlannedUnits: number;
    lotQuantity: number;
    acceptedUnits: number;
    heldUnits: number;
    pendingInspectionUnits: number;
    remainingPlannedUnits: number;
    reconciliationCheckPassed: boolean;
  };
}

export const CANONICAL_SAMPLE_PROJECTS: CanonicalSampleProject[] = [
  // ==========================================
  // LC2-P01: Internal Harness Jig (Hardware Only)
  // ==========================================
  (() => {
    const fixtureKey = "LC2-P01";
    const projectCode = "PRJ-INT-001";
    const completedStageCodes = ["CM_01", "CM_02", "CM_03", "CM_04", "HW_01", "HW_02", "HW_03", "HW_04", "HW_05", "HW_06", "HW_07", "HW_08", "HW_09", "HW_10", "HW_11", "HW_12", "HW_13", "HW_14", "HW_15", "HW_16", "HW_17", "HW_18", "HW_19", "HW_20", "HW_21", "HW_22", "HW_23", "HW_24", "HW_25", "HW_26", "HW_30"];
    const inProgressStageCodes = ["HW_31"];
    const { stages, activeTasks, plannedTaskPreviews } = computeProgressiveStageAndTaskState({
      projectId: projectCode,
      track: "hardware_only",
      completedStageCodes,
      inProgressStageCodes,
    });

    return {
      fixtureKey,
      projectCode,
      title: "Internal Harness & EOL Test Jig",
      track: "hardware_only" as CanonicalProjectTrack,
      isExternalClient: false,
      clientName: "Internal Hexense Labs — Plant Tooling Division",
      businessStory:
        "Shopfloor internal equipment improvement to eliminate manual wire harness continuity test bottlenecks on Line 2. No external client.",
      currentActiveStage: "HW_31",
      activeSamplePointRemark:
        "HW_31 active: Current-limited bring-up pending; outsourced PCB assembly received and QA inspected.",
      testingGuide:
        "Verify internal project context (no client fields required). Check that HW_31 is the currently active task in Today board, while HW_32+ remain planned. Ensure no firmware or cloud software development tasks appear.",
      projectRecord: {
        id: "prj-lc2-p01",
        reference: projectCode,
        title: "Internal Harness & EOL Test Jig",
        type: "Project",
        status: "Open",
        area: "rnd",
        priority: "Normal",
        fields: {
          projectTrack: "hardware_only",
          scope: "Internal",
          revision: "01",
          customer: "Internal Hexense Labs — Plant Tooling Division",
          currentStage: "HW_31",
          system_voltage: "24V DC (Industrial Bench)",
          operating_range: "18V to 30V DC",
        },
      },
      records: [
        {
          id: "rec-p01-sch",
          reference: "HLPL-JIG-EHW-SCH-01",
          title: "Harness 20-Pin Continuity & Pogo Jig Schematic",
          type: "Schematic",
          status: "Approved",
          area: "ehw",
          priority: "High",
          fields: { projectId: projectCode, revision: "01" },
        },
        {
          id: "rec-p01-bom",
          reference: "HLPL-JIG-EHW-BOM-01",
          title: "Tentative Test Jig Hardware BOM",
          type: "BOM",
          status: "Approved",
          area: "ehw",
          priority: "Normal",
          fields: { projectId: projectCode, revision: "01" },
        },
        {
          id: "rec-p01-rcpt",
          reference: "HLPL-JIG-EMF-GRN-01",
          title: "Outsourced PCBA Receipt & QA Inspection Note",
          type: "GRN",
          status: "Approved",
          area: "emf",
          priority: "Normal",
          fields: { projectId: projectCode, revision: "01" },
        },
      ],
      documents: [
        {
          id: "doc-p01-dwg",
          title: "EOL Test Jig Pogo-Pin Fixture Drawing",
          type: "Drawing",
          lifecycle: "Approved",
          linkedRecordRefs: [projectCode, "HLPL-JIG-EHW-SCH-01"],
        },
      ],
      completedStageCodes,
      inProgressStageCodes,
      stages,
      activeTasks,
      plannedTaskPreviews,
    };
  })(),

  // ==========================================
  // LC2-E02: Declined Enquiry (Terminal Pre-Project Feasibility)
  // ==========================================
  {
    fixtureKey: "LC2-E02",
    projectCode: undefined, // strictly undefined per §14.14 S02 invariant: NO project created
    enquiryCode: "ENQ-DECL-001",
    title: "Declined Extended-Temperature Tracker Enquiry",
    track: "hardware_firmware" as CanonicalProjectTrack,
    isExternalClient: true,
    clientName: "Nordic Fleet Logistics AB",
    businessStory:
      "Customer requested -40°C extended-temperature automotive tracker with a strict 6-week turnaround. Component sourcing showed 14-week distributor lead time for required military-grade power IC.",
    currentActiveStage: "CM_02",
    activeSamplePointRemark:
      "CM_02 declined: Synthetic 14-week component availability cannot meet customer 6-week window; terminal commercial declination recorded with zero downstream project or tasks.",
    testingGuide:
      "Verify that NO project record or UUID exists. Enquiry status is 'Declined'. Cross-check that no downstream engineering stages or production orders were created.",
    records: [
      {
        id: "rec-e02-enq",
        reference: "ENQ-DECL-001",
        title: "Extended-Temperature (-40°C) Fleet Tracker Enquiry",
        type: "Enquiry",
        status: "Declined",
        area: "sales",
        priority: "Normal",
        fields: {
          customer: "Nordic Fleet Logistics AB",
          requestedWindowWeeks: "6",
          feasibleLeadTimeWeeks: "14",
          terminalReason: "Arrow Electronics 14-week lead-time exceeds client 6-week deadline",
          revision: "01",
        },
      },
      {
        id: "rec-e02-feas",
        reference: "HLPL-EXT-PUR-FEAS-01",
        title: "Extended-Temperature SCM Component Feasibility Review",
        type: "Contract review",
        status: "Rejected",
        area: "pur",
        priority: "High",
        fields: {
          supplier: "Arrow Electronics",
          component: "TI LM5010A-Q1 (-40C to +125C Automotive Buck)",
          leadTimeWeeks: "14",
          decision: "Declined by Sales & Purchasing Leads",
          revision: "01",
          linkedRecords: "ENQ-DECL-001",
        },
      },
    ],
    documents: [
      {
        id: "doc-e02-notice",
        title: "Commercial Declination Notice",
        type: "Notice",
        lifecycle: "Released",
        linkedRecordRefs: ["ENQ-DECL-001", "HLPL-EXT-PUR-FEAS-01"],
      },
    ],
    completedStageCodes: ["CM_01"],
    inProgressStageCodes: [],
    stages: [],
    activeTasks: [],
    plannedTaskPreviews: [],
  },

  // ==========================================
  // LC2-P03: Fleet OBD Tracker PoC (Hardware + Firmware)
  // ==========================================
  (() => {
    const fixtureKey = "LC2-P03";
    const projectCode = "PRJ-POC-001";
    const completedStageCodes = [
      "CM_01", "CM_02", "CM_03", "CM_04",
      "HW_01", "HW_02", "HW_03", "HW_04", "HW_05", "HW_06", "HW_07", "HW_08", "HW_09", "HW_10", "HW_11", "HW_12", "HW_13", "HW_14", "HW_15", "HW_16", "HW_17", "HW_18", "HW_19", "HW_20", "HW_21", "HW_22", "HW_23", "HW_24", "HW_25", "HW_26", "HW_28", "HW_30", "HW_31", "HW_32",
      "FW_01", "FW_02", "FW_03", "FW_04", "FW_05", "FW_06", "FW_07", "FW_08", "FW_10", "FW_11", "FW_12",
      "INT_01", "INT_02",
    ];
    const inProgressStageCodes = ["INT_03"];
    const { stages, activeTasks, plannedTaskPreviews } = computeProgressiveStageAndTaskState({
      projectId: projectCode,
      track: "hardware_firmware",
      completedStageCodes,
      inProgressStageCodes,
    });

    return {
      fixtureKey,
      projectCode,
      enquiryCode: "ENQ-2026-POC-01",
      title: "Fleet OBD Tracker PoC",
      track: "hardware_firmware" as CanonicalProjectTrack,
      isExternalClient: true,
      clientName: "Tata Motors Limited · EV Fleet Division",
      businessStory:
        "10-unit proof-of-concept prototype build for electric bus fleet. Prototype units delivered to client depot; client ignition-line debounce trial feedback in progress.",
      currentActiveStage: "INT_03",
      activeSamplePointRemark:
        "INT_03 waiting: Ten prototype units delivered; client debounce feedback open on 50ms vs 200ms ignition filter.",
      testingGuide:
        "Verify 10 units recorded in Prototype record. Check that INT_03 is in progress awaiting customer feedback. Confirm PoC completion does NOT automatically authorize production release.",
      projectRecord: {
        id: "prj-lc2-p03",
        reference: projectCode,
        title: "Fleet OBD Tracker PoC",
        type: "Project",
        status: "Open",
        area: "sales",
        priority: "Normal",
        fields: {
          projectTrack: "hardware_firmware",
          scope: "Client",
          revision: "01",
          customer: "Tata Motors Limited · EV Fleet Division",
          currentStage: "INT_03",
          system_voltage: "12V DC (Passenger Vehicle / Light Commercial)",
          operating_range: "9V to 16V DC (with 36V load dump clamp)",
          sleep_current: "2.0 mA",
          can_interfaces: "2x CAN 2.0B / CAN-FD",
        },
      },
      records: [
        {
          id: "rec-p03-prs",
          reference: "HLPL-POC-EHW-PRS-01",
          title: "Product Requirement Specification · OBD Tracker PoC",
          type: "PRS",
          status: "Approved",
          area: "ehw",
          priority: "Normal",
          fields: { projectId: projectCode, revision: "01" },
        },
        {
          id: "rec-p03-proto",
          reference: "HLPL-POC-EMF-PRT-01",
          title: "10-Unit Prototype Lot Build Record",
          type: "Prototype",
          status: "Approved",
          area: "emf",
          priority: "Normal",
          fields: { projectId: projectCode, quantity: "10", serials: "OBD-POC-001 to 010", revision: "01" },
        },
        {
          id: "rec-p03-crd",
          reference: "HLPL-POC-SAL-CRD-02",
          title: "Client Ignition-Line Debounce Clarification",
          type: "Clarification",
          status: "In review",
          area: "sales",
          priority: "High",
          fields: { projectId: projectCode, issue: "50ms vs 200ms debounce filter on EV auxiliary ignition line", revision: "01" },
        },
      ],
      documents: [
        {
          id: "doc-p03-rpt",
          title: "PoC Field Trial Dispatch & Verification Note",
          type: "Report",
          lifecycle: "Approved",
          linkedRecordRefs: [projectCode, "HLPL-POC-EMF-PRT-01"],
        },
      ],
      completedStageCodes,
      inProgressStageCodes,
      stages,
      activeTasks,
      plannedTaskPreviews,
    };
  })(),

  // ==========================================
  // LC2-P04: Vehicle Gateway Pilot (Hardware + Firmware + Software)
  // ==========================================
  (() => {
    const fixtureKey = "LC2-P04";
    const projectCode = "PRJ-GW-001";
    const completedStageCodes = [
      "CM_01", "CM_02", "CM_03", "CM_04",
      "HW_01", "HW_02", "HW_03", "HW_04", "HW_05", "HW_06", "HW_07", "HW_08", "HW_09", "HW_10", "HW_11", "HW_12", "HW_13", "HW_14", "HW_15", "HW_16", "HW_17", "HW_18", "HW_19", "HW_20", "HW_21", "HW_22", "HW_23", "HW_24", "HW_25", "HW_26", "HW_28", "HW_30", "HW_31", "HW_32",
      "FW_01", "FW_02", "FW_03", "FW_04", "FW_05", "FW_06", "FW_07", "FW_08", "FW_10", "FW_11", "FW_12",
      "SW_01", "SW_02", "SW_03", "SW_04", "SW_05", "SW_06", "SW_07", "SW_08", "SW_09",
      "INT_01", "INT_02",
    ];
    const inProgressStageCodes = ["HW_33", "INT_03"];
    const { stages, activeTasks, plannedTaskPreviews } = computeProgressiveStageAndTaskState({
      projectId: projectCode,
      track: "hardware_firmware_software",
      completedStageCodes,
      inProgressStageCodes,
    });

    return {
      fixtureKey,
      projectCode,
      title: "Vehicle Gateway Integration Pilot",
      track: "hardware_firmware_software" as CanonicalProjectTrack,
      isExternalClient: true,
      clientName: "Apex Telematics Corp",
      businessStory:
        "50-vehicle telematics gateway pilot running real-time CAN bus telemetry into cloud ingestion API. Hardware and firmware verified; 30-day customer pilot observation underway.",
      currentActiveStage: "HW_33",
      activeSamplePointRemark:
        "HW_33 & INT_03 In Progress: Integrated system verified in test lab; 50-vehicle customer pilot observation in progress.",
      testingGuide:
        "Verify full three-track integration: EHW schematic/BOM, FW binary release, and SW API ingestion contract all linked to the same project. Check pilot observation is active without fake early completion.",
      projectRecord: {
        id: "prj-lc2-p04",
        reference: projectCode,
        title: "Vehicle Gateway Integration Pilot",
        type: "Project",
        status: "Open",
        area: "rnd",
        priority: "High",
        fields: {
          projectTrack: "hardware_firmware_software",
          scope: "Client",
          revision: "02",
          customer: "Apex Telematics Corp",
          currentStage: "HW_33",
          system_voltage: "24V DC (Heavy Commercial / Bus / Truck / Off-Highway)",
          operating_range: "9V to 36V DC",
          cellular_modem: "4G LTE Cat-1 with 2G Fallback",
        },
      },
      records: [
        {
          id: "rec-p04-sch",
          reference: "HLPL-GWY-EHW-SCH-01",
          title: "Gateway Main Controller Schematic Rev 2.1",
          type: "Schematic",
          status: "Approved",
          area: "ehw",
          priority: "Normal",
          fields: { projectId: projectCode, revision: "02" },
        },
        {
          id: "rec-p04-fw",
          reference: "HLPL-GWY-FW-BIN-01",
          title: "Gateway Telemetry Runtime v1.2.0",
          type: "Release",
          status: "Approved",
          area: "fw",
          priority: "High",
          fields: { projectId: projectCode, version: "v1.2.0", sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", revision: "01" },
        },
        {
          id: "rec-p04-hsi",
          reference: "HLPL-GWY-QA-HSI-01",
          title: "Hardware-Software Integration (HSI) Test Report",
          type: "Test report",
          status: "Approved",
          area: "qa",
          priority: "Normal",
          fields: { projectId: projectCode, revision: "01" },
        },
      ],
      documents: [
        {
          id: "doc-p04-matrix",
          title: "Gateway HSI Integration & Telemetry Protocol Matrix",
          type: "Matrix",
          lifecycle: "Approved",
          linkedRecordRefs: [projectCode, "HLPL-GWY-QA-HSI-01"],
        },
      ],
      completedStageCodes,
      inProgressStageCodes,
      stages,
      activeTasks,
      plannedTaskPreviews,
    };
  })(),

  // ==========================================
  // LC2-P05: Firmware Refinement (Firmware Only on Existing Hardware)
  // ==========================================
  (() => {
    const fixtureKey = "LC2-P05";
    const projectCode = "PRJ-CC-001";
    const completedStageCodes = [
      "CM_01", "CM_02", "CM_03", "CM_04",
      "FW_01", "FW_02", "FW_03", "FW_04", "FW_05", "FW_06", "FW_07", "FW_08", "FW_10",
    ];
    const inProgressStageCodes = ["FW_11"];
    const { stages, activeTasks, plannedTaskPreviews } = computeProgressiveStageAndTaskState({
      projectId: projectCode,
      track: "firmware_only",
      completedStageCodes,
      inProgressStageCodes,
    });

    return {
      fixtureKey,
      projectCode,
      title: "Cold-Chain Tracker Pilot Refinement",
      track: "firmware_only" as CanonicalProjectTrack,
      isExternalClient: true,
      clientName: "BioPharma Transport Ltd",
      businessStory:
        "Cold-chain temperature monitoring pilot showed duplicate cellular alerts on sudden thermal transition. Firmware patch v1.0.4 developed on existing PCB; regression test suite underway.",
      currentActiveStage: "FW_11",
      activeSamplePointRemark:
        "FW_11 Review: Duplicate temperature alert fix requires regression verification on existing hardware platform before release.",
      testingGuide:
        "Verify that NO new hardware development stages appear (HW_01 to HW_37 must be absent). Confirm project references existing PCB revision. Verify FW_11 is in review status.",
      projectRecord: {
        id: "prj-lc2-p05",
        reference: projectCode,
        title: "Cold-Chain Tracker Pilot Refinement",
        type: "Project",
        status: "Open",
        area: "rnd",
        priority: "Critical",
        fields: {
          projectTrack: "firmware_only",
          scope: "Client",
          revision: "02",
          customer: "BioPharma Transport Ltd",
          currentStage: "FW_11",
          existingBoardRef: "HLPL-CCT-HW-REV-02 (Existing Approved Hardware)",
        },
      },
      records: [
        {
          id: "rec-p05-ecn",
          reference: "HLPL-CCT-QA-ECN-01",
          title: "ECN: Temperature Excursion Alert Duplication on Cellular Transition",
          type: "Engineering change",
          status: "In review",
          area: "qa",
          priority: "Critical",
          fields: { projectId: projectCode, severity: "High", revision: "01" },
        },
        {
          id: "rec-p05-bug",
          reference: "HLPL-CCT-FW-BUG-01",
          title: "Firmware v1.0.4 Alert Debounce & FIFO Flush Patch",
          type: "Release",
          status: "In review",
          area: "fw",
          priority: "High",
          fields: { projectId: projectCode, patchVersion: "1.0.4", revision: "02" },
        },
      ],
      documents: [
        {
          id: "doc-p05-proc",
          title: "Alert Debounce Regression Verification Procedure",
          type: "Procedure",
          lifecycle: "Approved",
          linkedRecordRefs: [projectCode, "HLPL-CCT-QA-ECN-01"],
        },
      ],
      completedStageCodes,
      inProgressStageCodes,
      stages,
      activeTasks,
      plannedTaskPreviews,
    };
  })(),

  // ==========================================
  // LC2-P06: Bulk Production Run (Hardware + Firmware)
  // ==========================================
  (() => {
    const fixtureKey = "LC2-P06";
    const projectCode = "PRJ-PROD-001";
    const completedStageCodes = [
      "CM_01", "CM_02", "CM_03", "CM_04",
      "HW_01", "HW_02", "HW_03", "HW_04", "HW_05", "HW_06", "HW_07", "HW_08", "HW_09", "HW_10", "HW_11", "HW_12", "HW_13", "HW_14", "HW_15", "HW_16", "HW_17", "HW_18", "HW_19", "HW_20", "HW_21", "HW_22", "HW_23", "HW_24", "HW_25", "HW_26", "HW_28", "HW_30", "HW_31", "HW_32", "HW_33", "HW_34", "HW_35", "HW_36", "HW_37",
      "FW_01", "FW_02", "FW_03", "FW_04", "FW_05", "FW_06", "FW_07", "FW_08", "FW_10", "FW_11", "FW_12", "FW_13",
      "INT_01", "INT_02", "INT_03",
      "CL_01",
    ];
    const inProgressStageCodes = ["CL_02"];
    const { stages, activeTasks, plannedTaskPreviews } = computeProgressiveStageAndTaskState({
      projectId: projectCode,
      track: "hardware_firmware",
      completedStageCodes,
      inProgressStageCodes,
    });

    const productionReconciliation = {
      totalPlannedUnits: 500,
      lotQuantity: 200,
      acceptedUnits: 150,
      heldUnits: 5,
      pendingInspectionUnits: 45,
      remainingPlannedUnits: 300,
      reconciliationCheckPassed: 150 + 5 + 45 === 200 && 500 - 200 === 300,
    };

    return {
      fixtureKey,
      projectCode,
      title: "Rugged Fleet Tracker Series Production",
      track: "hardware_firmware" as CanonicalProjectTrack,
      isExternalClient: true,
      clientName: "National Logistics Fleet",
      businessStory:
        "Commercial order for 500 rugged GPS/telematics trackers. First manufacturing lot of 200 units built; 150 units QA-accepted and invoiced, 5 units held on MRB review, 45 units pending final visual inspection. 300 units remaining for Lot 2.",
      currentActiveStage: "CL_02",
      activeSamplePointRemark:
        "Production Lot 1 reconciliation: 150 accepted + 5 held + 45 pending = 200 units. 300 units remaining. Held units strictly quarantined from commercial delivery.",
      testingGuide:
        "Verify mathematical reconciliation: 150 accepted + 5 held + 45 inspecting = 200 lot units; 500 total - 200 lot = 300 remaining. Verify commercial invoice is strictly for 150 accepted units.",
      productionReconciliation,
      projectRecord: {
        id: "prj-lc2-p06",
        reference: projectCode,
        title: "Rugged Fleet Tracker Series Production",
        type: "Project",
        status: "Open",
        area: "emf",
        priority: "Normal",
        fields: {
          projectTrack: "hardware_firmware",
          scope: "Client",
          revision: "03",
          customer: "National Logistics Fleet",
          plannedUnits: "500",
          lot1Quantity: "200",
          lot1Accepted: "150",
          lot1Held: "5",
          lot1Pending: "45",
          remainingPlanned: "300",
          currentStage: "CL_02",
        },
      },
      records: [
        {
          id: "rec-p06-ord",
          reference: "HLPL-RFT-SAL-ORD-01",
          title: "Customer Order: 500 Rugged Fleet Trackers",
          type: "Order",
          status: "Approved",
          area: "sales",
          priority: "Normal",
          fields: { projectId: projectCode, plannedQuantity: "500", revision: "01" },
        },
        {
          id: "rec-p06-bom",
          reference: "HLPL-RFT-EHW-BOM-01",
          title: "Mass Production Released BOM Rev 03",
          type: "BOM",
          status: "Released",
          area: "ehw",
          priority: "Critical",
          fields: { projectId: projectCode, revision: "03" },
        },
        {
          id: "rec-p06-wo",
          reference: "HLPL-RFT-EMF-WO-01",
          title: "Manufacturing Work Order Lot 1 (200 Units)",
          type: "Production order",
          status: "Open",
          area: "emf",
          priority: "High",
          fields: { projectId: projectCode, lotQuantity: "200", remainingBalance: "300", revision: "01" },
        },
        {
          id: "rec-p06-acc",
          reference: "HLPL-RFT-QA-ACC-01",
          title: "Lot 1 EOL Acceptance Batch (150 Units)",
          type: "Inspection",
          status: "Approved",
          area: "qa",
          priority: "Normal",
          fields: { projectId: projectCode, acceptedQuantity: "150", revision: "01" },
        },
        {
          id: "rec-p06-mrb",
          reference: "HLPL-RFT-QA-MRB-01",
          title: "MRB Disposition on 5 SMT Held Units",
          type: "MRB Hold",
          status: "In review",
          area: "qa",
          priority: "High",
          fields: { projectId: projectCode, heldQuantity: "5", disposition: "Rework solder bridge on U4", revision: "01" },
        },
        {
          id: "rec-p06-insp",
          reference: "HLPL-RFT-QA-INSP-01",
          title: "Lot 1 Final Inspection Queue (45 Units)",
          type: "Inspection",
          status: "Draft",
          area: "qa",
          priority: "Normal",
          fields: { projectId: projectCode, pendingInspectionQuantity: "45", revision: "01" },
        },
        {
          id: "rec-p06-inv",
          reference: "HLPL-RFT-FIN-INV-01",
          title: "Commercial Tax Invoice for 150 Accepted Units",
          type: "Invoice",
          status: "Submitted",
          area: "fin",
          priority: "High",
          fields: { projectId: projectCode, invoicedQuantity: "150", revision: "01" },
        },
      ],
      documents: [
        {
          id: "doc-p06-coc",
          title: "Lot 1 Certificate of Conformance (150 Units)",
          type: "Certificate",
          lifecycle: "Approved",
          linkedRecordRefs: [projectCode, "HLPL-RFT-QA-ACC-01"],
        },
      ],
      completedStageCodes,
      inProgressStageCodes,
      stages,
      activeTasks,
      plannedTaskPreviews,
    };
  })(),

  // ==========================================
  // LC2-P07: Internal Service Application (Software Only)
  // ==========================================
  (() => {
    const fixtureKey = "LC2-P07";
    const projectCode = "PRJ-APP-001";
    const completedStageCodes = [
      "CM_01", "CM_02", "CM_03", "CM_04",
      "SW_01", "SW_02", "SW_03", "SW_04", "SW_05", "SW_06", "SW_07",
    ];
    const inProgressStageCodes = ["SW_08"];
    const { stages, activeTasks, plannedTaskPreviews } = computeProgressiveStageAndTaskState({
      projectId: projectCode,
      track: "software_only",
      completedStageCodes,
      inProgressStageCodes,
    });

    return {
      fixtureKey,
      projectCode,
      title: "Field Operations & Diagnostic Cloud Portal",
      track: "software_only" as CanonicalProjectTrack,
      isExternalClient: false,
      clientName: "Internal IT & Customer Support Operations",
      businessStory:
        "Internal cloud web application for service technicians to monitor device health, trigger remote diagnostic sessions, and generate field service tickets. Pure software development.",
      currentActiveStage: "SW_08",
      activeSamplePointRemark:
        "SW_08 active: Service workflow integration using synthetic API fixtures; HW, FW, and manufacturing stages are completely not applicable.",
      testingGuide:
        "Verify that hardware, firmware, and factory manufacturing stages are excluded. Confirm only SW stages exist alongside CM/CL common stages.",
      projectRecord: {
        id: "prj-lc2-p07",
        reference: projectCode,
        title: "Field Operations & Diagnostic Cloud Portal",
        type: "Project",
        status: "Open",
        area: "it",
        priority: "Normal",
        fields: {
          projectTrack: "software_only",
          scope: "Internal",
          revision: "01",
          currentStage: "SW_08",
          architecture: "React + Node microservices + Postgres",
        },
      },
      records: [
        {
          id: "rec-p07-srs",
          reference: "HLPL-SVC-SW-SRS-01",
          title: "Software Requirement Specification · Service Desk API",
          type: "SRS",
          status: "Approved",
          area: "sw",
          priority: "Normal",
          fields: { projectId: projectCode, revision: "01" },
        },
        {
          id: "rec-p07-api",
          reference: "HLPL-SVC-SW-API-01",
          title: "OpenAPI 3.0 Diagnostic Endpoint Contract",
          type: "Contract",
          status: "Approved",
          area: "sw",
          priority: "High",
          fields: { projectId: projectCode, revision: "01" },
        },
      ],
      documents: [
        {
          id: "doc-p07-arch",
          title: "Service Portal Software Architecture & Deployment Guide",
          type: "Architecture",
          lifecycle: "Approved",
          linkedRecordRefs: [projectCode, "HLPL-SVC-SW-SRS-01"],
        },
      ],
      completedStageCodes,
      inProgressStageCodes,
      stages,
      activeTasks,
      plannedTaskPreviews,
    };
  })(),

  // ==========================================
  // LC2-P08: Existing Product Deployment (Ready-Made)
  // ==========================================
  (() => {
    const fixtureKey = "LC2-P08";
    const projectCode = "PRJ-RM-001";
    const completedStageCodes = ["CM_01", "CM_02", "CM_03", "CM_04", "RM_01", "RM_02"];
    const inProgressStageCodes = ["RM_03"];
    const { stages, activeTasks, plannedTaskPreviews } = computeProgressiveStageAndTaskState({
      projectId: projectCode,
      track: "ready_made",
      completedStageCodes,
      inProgressStageCodes,
    });

    return {
      fixtureKey,
      projectCode,
      title: "Commercial Catalog Telematics Device Deployment",
      track: "ready_made" as CanonicalProjectTrack,
      isExternalClient: true,
      clientName: "City Transit Authority",
      businessStory:
        "Direct commercial supply of standard off-the-shelf HLPL-OBD4-01 device. Standard technical data sheet (SAL-TDS-01) and brochure (SAL-BRO-01) utilized; requires zero custom engineering.",
      currentActiveStage: "RM_03",
      activeSamplePointRemark:
        "RM_03 active: Standard configuration verification awaiting client field installation feedback. Custom engineering stages are completely absent.",
      testingGuide:
        "Verify technical engineering departments (EHW, FW, SW, MECH) have ZERO assigned stages or tasks. Check presence of SAL-BRO-01 brochure and SAL-TDS-01 data sheet.",
      projectRecord: {
        id: "prj-lc2-p08",
        reference: projectCode,
        title: "Commercial Catalog Telematics Device Deployment",
        type: "Project",
        status: "Open",
        area: "sales",
        priority: "Normal",
        fields: {
          projectTrack: "ready_made",
          scope: "Client",
          customer: "City Transit Authority",
          catalogProduct: "HLPL-OBD4-01",
          currentStage: "RM_03",
        },
      },
      records: [
        {
          id: "rec-p08-tds",
          reference: "SAL-TDS-01",
          title: "Technical Data Sheet · HLPL-OBD4-01 Standard Tracker",
          type: "TDS",
          status: "Approved",
          area: "sales",
          priority: "Normal",
          fields: { projectId: projectCode, productCode: "HLPL-OBD4-01", revision: "01" },
        },
        {
          id: "rec-p08-bro",
          reference: "SAL-BRO-01",
          title: "Commercial Product Brochure · HLPL-OBD4-01",
          type: "Brochure",
          status: "Approved",
          area: "sales",
          priority: "Normal",
          fields: { projectId: projectCode, revision: "01" },
        },
      ],
      documents: [
        {
          id: "doc-p08-tds",
          title: "HLPL-OBD4-01 Standard Technical Specification & Installation Manual",
          type: "Manual",
          lifecycle: "Released",
          linkedRecordRefs: [projectCode, "SAL-TDS-01"],
        },
      ],
      completedStageCodes,
      inProgressStageCodes,
      stages,
      activeTasks,
      plannedTaskPreviews,
    };
  })(),

  // ==========================================
  // LC2-P09: Device Connectivity Upgrade (FW + SW on Existing Hardware)
  // ==========================================
  (() => {
    const fixtureKey = "LC2-P09";
    const projectCode = "PRJ-UPG-001";
    const completedStageCodes = [
      "CM_01", "CM_02", "CM_03", "CM_04",
      "FW_01", "FW_02", "FW_03", "FW_04", "FW_05", "FW_06", "FW_07", "FW_08",
      "SW_01", "SW_02", "SW_03", "SW_04", "SW_05", "SW_06", "SW_07",
      "INT_01",
    ];
    const inProgressStageCodes = ["INT_02"];
    const { stages, activeTasks, plannedTaskPreviews } = computeProgressiveStageAndTaskState({
      projectId: projectCode,
      track: "firmware_software_existing_hardware",
      completedStageCodes,
      inProgressStageCodes,
    });

    return {
      fixtureKey,
      projectCode,
      title: "Fleet Telematics Protocol Upgrade (FW + Cloud)",
      track: "firmware_software_existing_hardware" as CanonicalProjectTrack,
      isExternalClient: true,
      clientName: "Metro Logistics Fleet",
      businessStory:
        "Protocol modernization to upgrade existing fleet devices from legacy HTTP to lightweight binary MQTT. Firmware and Cloud backend coordinated; existing hardware platform unchanged.",
      currentActiveStage: "INT_02",
      activeSamplePointRemark:
        "INT_02 active: Firmware payload / cloud decoder compatibility verification underway; existing hardware platform pinned; zero new PCB development.",
      testingGuide:
        "Verify dual FW and SW participation with coupled INT stages, but zero hardware layout or fabrication stages (HW_01 to HW_37 absent).",
      projectRecord: {
        id: "prj-lc2-p09",
        reference: projectCode,
        title: "Fleet Telematics Protocol Upgrade (FW + Cloud)",
        type: "Project",
        status: "Open",
        area: "rnd",
        priority: "High",
        fields: {
          projectTrack: "firmware_software_existing_hardware",
          scope: "Client",
          customer: "Metro Logistics Fleet",
          currentStage: "INT_02",
          existingBoardRef: "HLPL-OBD4-HW-REV-03 (Existing Pinned Platform)",
        },
      },
      records: [
        {
          id: "rec-p09-icd",
          reference: "HLPL-UPG-INT-ICD-01",
          title: "Binary MQTT Telemetry Interface Control Document (ICD)",
          type: "Contract",
          status: "Approved",
          area: "fw",
          priority: "Critical",
          fields: { projectId: projectCode, revision: "01" },
        },
        {
          id: "rec-p09-sim",
          reference: "HLPL-UPG-SW-SIM-01",
          title: "Cloud Telemetry Ingest Simulator Test Run",
          type: "Test report",
          status: "Approved",
          area: "sw",
          priority: "Normal",
          fields: { projectId: projectCode, revision: "01" },
        },
      ],
      documents: [
        {
          id: "doc-p09-icd",
          title: "MQTT Ingestion Interface Specification & Payload Map",
          type: "Specification",
          lifecycle: "Approved",
          linkedRecordRefs: [projectCode, "HLPL-UPG-INT-ICD-01"],
        },
      ],
      completedStageCodes,
      inProgressStageCodes,
      stages,
      activeTasks,
      plannedTaskPreviews,
    };
  })(),
];

/**
 * Returns all records, projects, and documents across all canonical sample packs.
 * Idempotent loader helper.
 */
export function getAllCanonicalSampleData(): {
  projects: AnalysisRecord[];
  records: AnalysisRecord[];
  documents: AnalysisDocument[];
} {
  const projects: AnalysisRecord[] = [];
  const records: AnalysisRecord[] = [];
  const documents: AnalysisDocument[] = [];

  for (const sample of CANONICAL_SAMPLE_PROJECTS) {
    if (sample.projectRecord) {
      projects.push(sample.projectRecord);
    }
    records.push(...sample.records);
    documents.push(...sample.documents);
  }

  return { projects, records, documents };
}
