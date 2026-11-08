import {
  CANONICAL_STAGE_TEMPLATES,
  computeProgressiveStageAndTaskState,
  type ProjectTaskInstance,
} from "./canonical-lifecycle";
import { createDemoFeasibilitySheet, withS10DemoFeasibilitySources } from "./s10-demo-feasibility";
import { getScenario, type LifecycleScenario } from "./lifecycle-scenarios";
import { CANONICAL_SAMPLE_PROJECTS, type CanonicalSampleProject } from "./canonical-samples";
import type { AnalysisRecord } from "./project-analysis-data";
import type { InputSheet } from "./project-inputs";

export const LOCAL_TEST_WORKSPACE_STORAGE_KEY = "ssm-local-test-workspace-v1";
export const LOCAL_TEST_FIXTURE_KEY = "LC2-P10-OFFLINE-TELEMATICS";
export const LOCAL_TEST_PROJECT_ID = "demo-s10-project";
export const LOCAL_TEST_PROJECT_CODE = "DEMO-PROJ-010";
export const LOCAL_TEST_ANDROID_FIXTURE_REFERENCE = "HLPL-GEN-EHW-P10";
export const LOCAL_TEST_ENQUIRY_ID = "demo-s10-enquiry";
export const LOCAL_TEST_ENQUIRY_CODE = "DEMO-ENQ-010";
export const LOCAL_TEST_FEASIBILITY_SHEET_ID = "demo-input-demo-proj-010";

export type LocalTaskStatus = "todo" | "in_progress" | "in_review" | "blocked" | "completed";

export type LocalWorkspaceStatus = "Draft" | "Awaiting review" | "Returned with questions";

export type LocalFixtureRecord = AnalysisRecord & {
  fixtureKey: string;
  linkedRecordIds: string[];
};

export type LocalWorkspaceTask = {
  id: string;
  fixtureKey?: string;
  projectId: string;
  projectCode: string;
  enquiryId: string;
  feasibilitySheetId: string;
  stageCode: string;
  department: string;
  title: string;
  description: string;
  assignee: string;
  status: LocalTaskStatus;
  subtasks: Array<{ id: string; label: string; done: boolean }>;
  comments: Array<{
    id: string;
    author: string;
    body: string;
    createdAt: string;
  }>;
};

export type LocalWorkspaceHandoff = {
  id: string;
  fixtureKey?: string;
  projectId: string;
  fromDepartment: string;
  toDepartment: string;
  title: string;
  status: LocalWorkspaceStatus;
  note: string;
  requiresFreeze: boolean;
};

export type LocalWorkspaceDocument = {
  id: string;
  fixtureKey?: string;
  projectId: string;
  reference: string;
  title: string;
  department: string;
  revision: string;
  status: "Draft metadata" | "Future planned";
  classification: "Internal · local test";
  filePresent: false;
  released: false;
};

export type LocalDocumentDraftFields = {
  title: string;
  revision: string;
  stageExitContext: string;
};

export type LocalDocumentDraftHistoryEntry = LocalDocumentDraftFields & {
  version: number;
  savedAt: string;
};

export type LocalControlledDocumentDraft = LocalDocumentDraftFields & {
  id: string;
  fixtureKey: string;
  projectId?: string;
  savedAt: string;
  history: LocalDocumentDraftHistoryEntry[];
};

export type LocalBinaryFileSelection = {
  id: string;
  fixtureKey: string;
  projectId?: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  lastModified: number;
  selectedAt: string;
  storageState: "Selected locally · not uploaded or shared";
  uploaded: false;
};

export type LocalDocumentRegisterItem = {
  id: string;
  fixtureKey: string;
  sourceTaskId?: string;
  projectId?: string;
  projectCode?: string;
  projectTitle: string;
  stageCode: string;
  stageName: string;
  stageStatus: string;
  stageExitContext: string;
  department: string;
  title: string;
  revision: string;
  kind: "Controlled draft" | "Binary artifact";
  dueStatus: string;
};

export type LocalWorkspaceFeedback = {
  id: string;
  fixtureKey?: string;
  projectId: string;
  taskId: string;
  author: string;
  body: string;
  status: "Open" | "Under local review" | "Noted locally";
  response: string;
};

export type LocalWorkspaceEvent = {
  id: string;
  fixtureKey?: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
};

export type LocalRequirementProvenance = "user_brief" | "fixture_assumption";

export type LocalHardwareRequirement = {
  id: string;
  projectId: string;
  label: string;
  value: string;
  provenance: LocalRequirementProvenance;
  source: string;
  decisionStatus: "Tentative · unverified" | "Editable · unapproved test assumption";
};

export type LocalHardwareAsset = {
  id: string;
  projectId: string;
  code: string;
  kind: "PCB" | "Enclosure" | "Harness";
  title: string;
  revision: string;
  status: "Reusable candidate · not selected";
  certificateMetadata: {
    status: "No asset certificate metadata recorded";
    certificateReference: string;
    issuer: string;
  };
  projectConfigurationCertification: {
    status: "Not assessed";
    note: string;
  };
};

export type LocalTentativeBomLine = {
  id: string;
  projectId: string;
  inventoryItemId: string;
  itemDescription: string;
  quantity: number;
  unit: string;
  supplier: string;
  leadTimeWeeks: string;
  estimatedUnitCostUsd: number;
  estimateNote: string;
  approvalStatus: "Draft · unapproved estimate";
};

export type LocalBudgetLine = {
  id: string;
  projectId: string;
  category: string;
  amountUsd: number;
  estimateNote: string;
  approvalStatus: "Draft · unapproved estimate";
};

export type LocalDraftRecord = {
  id: string;
  projectId: string;
  kind: "Requirements" | "Feasibility" | "BOM" | "Budget";
  title: string;
  revision: string;
  status: "Draft · editable";
};

export type LocalBinaryDeliverable = {
  id: string;
  projectId: string;
  kind:
    | "Schematic"
    | "Gerber"
    | "Firmware"
    | "CAD/STEP"
    | "Drawing"
    | "Test report"
    | "Certification report";
  title: string;
  status: "Not uploaded · metadata only";
  uploaded: false;
  storageUrl: "";
};

export type LocalHardwareMasterData = {
  projectId: string;
  requirements: LocalHardwareRequirement[];
  assets: LocalHardwareAsset[];
  tentativeBom: LocalTentativeBomLine[];
  budgetLines: LocalBudgetLine[];
  draftRecords: LocalDraftRecord[];
  binaryDeliverables: LocalBinaryDeliverable[];
  contingencyPercent: number;
};

export type LocalPortfolioEntry = {
  key: string;
  fixtureKey: string;
  title: string;
  projectCode?: string;
  enquiryCode?: string;
  track: string;
  phase: string;
  status: string;
  departmentCodes: string[];
  completedStageCount: number;
  inProgressStageCount: number;
  activeTaskCount: number;
  plannedPreviewCount: number;
  handoffs: Array<{
    id: string;
    title: string;
    provider: string;
    waiting: string;
    status: string;
  }>;
  stages: Array<{ code: string; name: string; status: string }>;
  tasks: Array<{ id: string; title: string; department: string; status: string }>;
  origin: "Existing canonical sample" | "Existing S10 lifecycle scenario";
};

export type LocalTestWorkspaceState = {
  version: 1 | 2;
  fixtureKey: string;
  androidFixtureReference: string;
  records: Array<AnalysisRecord & { fixtureKey?: string; linkedRecordIds?: string[] }>;
  sheets: Array<InputSheet & { fixtureKey?: string }>;
  tasks: LocalWorkspaceTask[];
  handoffs: LocalWorkspaceHandoff[];
  documents: LocalWorkspaceDocument[];
  documentDrafts: LocalControlledDocumentDraft[];
  binarySelections: LocalBinaryFileSelection[];
  feedback: LocalWorkspaceFeedback[];
  departments: Array<{
    id: string;
    fixtureKey?: string;
    code: string;
    name: string;
    lead: string;
  }>;
  events: LocalWorkspaceEvent[];
  completedStageCodes: string[];
  inProgressStageCodes: string[];
  hardwareMaster?: LocalHardwareMasterData;
};

const SAMPLE_ACTOR = "Local demo participant";
const BASE_TIME = "2026-11-02T09:00:00.000Z";
const CURRENT_STAGE_CODES = new Set(["CM_01", "CM_02"]);
const PREVIEW_STAGE_CODES = new Set(["CM_03", "HW_01", "FW_01", "SW_01"]);
const S10_BRIEF_PROVENANCE = "DEMO ONLY · User-provided scenario brief · tentative, unverified";

const CONTROLLED_DOCUMENT_MILESTONES: Array<{
  stageCode: string;
  department: string;
  title: string;
  context: string;
}> = [
  {
    stageCode: "CM_01",
    department: "SAL",
    title: "Intake and source summary",
    context: "Record the enquiry source, intended use and open input values.",
  },
  {
    stageCode: "CM_02",
    department: "SAL",
    title: "Feasibility review record",
    context: "Collect applicable department questions and evidence; unanswered items remain open.",
  },
  {
    stageCode: "CM_03",
    department: "SAL",
    title: "Requirement baseline review",
    context: "A draft review artifact only; it does not freeze or authorize requirements.",
  },
  {
    stageCode: "HW_01",
    department: "EHW",
    title: "Hardware requirements review",
    context: "Record sourced hardware inputs and unresolved technical questions.",
  },
  {
    stageCode: "HW_03",
    department: "EHW",
    title: "Schematic design review",
    context: "Capture review notes only; no schematic binary is attached by this draft.",
  },
  {
    stageCode: "HW_04",
    department: "MECH",
    title: "Mechanical interface review",
    context: "Record fit and interface review; no STEP model or drawing is attached by this draft.",
  },
  {
    stageCode: "HW_19",
    department: "EHW",
    title: "Tentative BOM review",
    context: "Capture candidate-line review; this is not a purchase, reservation or approved BOM.",
  },
  {
    stageCode: "FW_01",
    department: "FW",
    title: "Firmware feasibility review",
    context: "Record implementation questions; no firmware package is attached by this draft.",
  },
  {
    stageCode: "FW_11",
    department: "QA",
    title: "Firmware regression review",
    context: "Record review scope; this does not represent executed or passing test evidence.",
  },
  {
    stageCode: "SW_01",
    department: "SW",
    title: "Software interface review",
    context:
      "Record interface questions; architecture and connectivity assumptions remain unapproved.",
  },
  {
    stageCode: "INT_01",
    department: "QA",
    title: "Integration and PoC verification review",
    context: "Plan evidence collection only; no test execution or acceptance is represented.",
  },
  {
    stageCode: "INT_03",
    department: "QA",
    title: "Integration feedback review",
    context: "Track sample feedback and questions; no client acceptance is implied.",
  },
  {
    stageCode: "CL_01",
    department: "QA",
    title: "Release evidence completeness review",
    context: "Local checklist metadata only; no release decision or certification is represented.",
  },
];

const BINARY_DOCUMENT_MILESTONES: Array<{
  stageCode: string;
  department: string;
  title: string;
}> = [
  { stageCode: "HW_03", department: "EHW", title: "Schematic / Gerber fabrication source" },
  { stageCode: "HW_04", department: "MECH", title: "STEP model / engineering drawings" },
  { stageCode: "FW_01", department: "FW", title: "Firmware package" },
  { stageCode: "INT_01", department: "QA", title: "Executed integration / PoC test evidence" },
  { stageCode: "CL_01", department: "QA", title: "Certification report (if applicable)" },
];

function createS10HardwareMaster(sheet: InputSheet): LocalHardwareMasterData {
  const projectId = LOCAL_TEST_PROJECT_ID;
  const binaryDeliverableRows: Array<[string, string, LocalBinaryDeliverable["kind"]]> = [
    ["SCHEMATIC", "Schematic source", "Schematic"],
    ["GERBER", "Gerber / fabrication package", "Gerber"],
    ["FIRMWARE", "Firmware image / source", "Firmware"],
    ["CAD", "CAD / STEP model", "CAD/STEP"],
    ["DRAWING", "Controlled engineering drawing", "Drawing"],
    ["TEST", "PoC test evidence report", "Test report"],
    ["CERT", "Certification report / certificate evidence", "Certification report"],
  ];
  const requirements: LocalHardwareRequirement[] = [
    {
      id: `${LOCAL_TEST_PROJECT_CODE}:REQ-USE-CASE`,
      projectId,
      label: "Product / intended use",
      value: sheet.parameter_values["use_case"]?.input ?? "",
      provenance: "user_brief",
      source: S10_BRIEF_PROVENANCE,
      decisionStatus: "Tentative · unverified",
    },
    {
      id: `${LOCAL_TEST_PROJECT_CODE}:REQ-CELLULAR`,
      projectId,
      label: "Requested cellular connectivity",
      value: sheet.parameter_values["cellular"]?.input ?? "",
      provenance: "user_brief",
      source: S10_BRIEF_PROVENANCE,
      decisionStatus: "Tentative · unverified",
    },
    {
      id: `${LOCAL_TEST_PROJECT_CODE}:REQ-GNSS`,
      projectId,
      label: "Requested positioning",
      value: sheet.parameter_values["gnss"]?.input ?? "",
      provenance: "user_brief",
      source: S10_BRIEF_PROVENANCE,
      decisionStatus: "Tentative · unverified",
    },
    {
      id: `${LOCAL_TEST_PROJECT_CODE}:REQ-SPECIAL`,
      projectId,
      label: "Open LoRa / no-internet question",
      value: sheet.parameter_values["special"]?.input ?? "",
      provenance: "user_brief",
      source: S10_BRIEF_PROVENANCE,
      decisionStatus: "Tentative · unverified",
    },
    {
      id: `${LOCAL_TEST_PROJECT_CODE}:ASSUMPTION-EVAL-QTY`,
      projectId,
      label: "Evaluation quantity placeholder",
      value: "1 unit · spreadsheet demonstration only; customer quantity remains unknown.",
      provenance: "fixture_assumption",
      source: "DEMO ONLY · Editable local planning assumption · not customer-confirmed",
      decisionStatus: "Editable · unapproved test assumption",
    },
    {
      id: `${LOCAL_TEST_PROJECT_CODE}:ASSUMPTION-ARCH`,
      projectId,
      label: "Hardware / connectivity architecture",
      value: "TBD · no 4G, GNSS, or LoRa architecture selected.",
      provenance: "fixture_assumption",
      source: "DEMO ONLY · Editable local planning assumption · not customer-confirmed",
      decisionStatus: "Editable · unapproved test assumption",
    },
  ];

  const asset = (
    code: string,
    kind: LocalHardwareAsset["kind"],
    title: string,
  ): LocalHardwareAsset => ({
    id: `${LOCAL_TEST_PROJECT_CODE}:ASSET-${code}`,
    projectId,
    code: `S10-${code}-CAND`,
    kind,
    title,
    revision: "00",
    status: "Reusable candidate · not selected",
    certificateMetadata: {
      status: "No asset certificate metadata recorded",
      certificateReference: "",
      issuer: "",
    },
    projectConfigurationCertification: {
      status: "Not assessed",
      note: "No project-configuration certification decision or evidence is recorded.",
    },
  });

  return {
    projectId,
    requirements,
    assets: [
      asset("PCB", "PCB", "Generic telematics controller PCB candidate"),
      asset("ENCLOSURE", "Enclosure", "Vehicle enclosure library candidate"),
      asset("HARNESS", "Harness", "Vehicle interface harness library candidate"),
    ],
    tentativeBom: [
      {
        id: `${LOCAL_TEST_PROJECT_CODE}:BOM-001`,
        projectId,
        inventoryItemId: "inv-stm32",
        itemDescription: "Existing inventory reference · STM32G0B1VCT6 MCU",
        quantity: 1,
        unit: "pcs",
        supplier: "",
        leadTimeWeeks: "",
        estimatedUnitCostUsd: 8,
        estimateNote: "Illustrative local estimate only; not a quote or selected part.",
        approvalStatus: "Draft · unapproved estimate",
      },
      {
        id: `${LOCAL_TEST_PROJECT_CODE}:BOM-002`,
        projectId,
        inventoryItemId: "inv-eg915",
        itemDescription: "Existing inventory reference · EG915N-EU LTE modem candidate",
        quantity: 1,
        unit: "pcs",
        supplier: "",
        leadTimeWeeks: "",
        estimatedUnitCostUsd: 15,
        estimateNote:
          "4G candidate reference only; NavIC, LoRa and system compatibility are unverified.",
        approvalStatus: "Draft · unapproved estimate",
      },
      {
        id: `${LOCAL_TEST_PROJECT_CODE}:BOM-003`,
        projectId,
        inventoryItemId: "inv-enclosure",
        itemDescription: "Existing inventory reference · PC/ABS enclosure candidate",
        quantity: 1,
        unit: "pcs",
        supplier: "",
        leadTimeWeeks: "",
        estimatedUnitCostUsd: 12,
        estimateNote:
          "Candidate reference only; S10 fit, environment and IP suitability are unknown.",
        approvalStatus: "Draft · unapproved estimate",
      },
      {
        id: `${LOCAL_TEST_PROJECT_CODE}:BOM-004`,
        projectId,
        inventoryItemId: "inv-cal-fixture",
        itemDescription: "Existing inventory reference · bench harness verification fixture",
        quantity: 1,
        unit: "sets",
        supplier: "",
        leadTimeWeeks: "",
        estimatedUnitCostUsd: 4,
        estimateNote: "Bench-fixture reference only; not a selected vehicle harness.",
        approvalStatus: "Draft · unapproved estimate",
      },
    ],
    budgetLines: [
      {
        id: `${LOCAL_TEST_PROJECT_CODE}:BUDGET-ENG`,
        projectId,
        category: "Illustrative engineering allowance",
        amountUsd: 350,
        estimateNote: "Local worksheet value only; no customer target or commercial offer.",
        approvalStatus: "Draft · unapproved estimate",
      },
      {
        id: `${LOCAL_TEST_PROJECT_CODE}:BUDGET-TEST`,
        projectId,
        category: "Illustrative bench/evidence allowance",
        amountUsd: 120,
        estimateNote:
          "Placeholder only; no test plan, lab booking, or certification scope is approved.",
        approvalStatus: "Draft · unapproved estimate",
      },
    ],
    draftRecords: [
      {
        id: `${LOCAL_TEST_PROJECT_CODE}:DRAFT-REQ`,
        projectId,
        kind: "Requirements",
        title: "S10 EHW Requirements Draft",
        revision: "00",
        status: "Draft · editable",
      },
      {
        id: `${LOCAL_TEST_PROJECT_CODE}:DRAFT-FEAS`,
        projectId,
        kind: "Feasibility",
        title: "S10 EHW Feasibility Draft",
        revision: "00",
        status: "Draft · editable",
      },
      {
        id: `${LOCAL_TEST_PROJECT_CODE}:DRAFT-BOM`,
        projectId,
        kind: "BOM",
        title: "S10 Tentative BOM Draft",
        revision: "00",
        status: "Draft · editable",
      },
      {
        id: `${LOCAL_TEST_PROJECT_CODE}:DRAFT-BUDGET`,
        projectId,
        kind: "Budget",
        title: "S10 Planning Budget Draft",
        revision: "00",
        status: "Draft · editable",
      },
    ],
    binaryDeliverables: binaryDeliverableRows.map(([key, title, kind]) => ({
      id: `${LOCAL_TEST_PROJECT_CODE}:BINARY-${key}`,
      projectId,
      kind,
      title,
      status: "Not uploaded · metadata only" as const,
      uploaded: false as const,
      storageUrl: "" as const,
    })),
    contingencyPercent: 15,
  };
}

function requireS10Scenario() {
  const scenario = getScenario("S10");
  if (!scenario) throw new Error("S10_DEMO_SCENARIO_UNAVAILABLE");
  return scenario;
}

function makeTask(
  id: string,
  stageCode: string,
  department: string,
  title: string,
  description: string,
  assignee: string,
  status: LocalTaskStatus,
): LocalWorkspaceTask {
  return {
    id,
    fixtureKey: LOCAL_TEST_FIXTURE_KEY,
    projectId: LOCAL_TEST_PROJECT_ID,
    projectCode: LOCAL_TEST_PROJECT_CODE,
    enquiryId: LOCAL_TEST_ENQUIRY_ID,
    feasibilitySheetId: LOCAL_TEST_FEASIBILITY_SHEET_ID,
    stageCode,
    department,
    title,
    description,
    assignee,
    status,
    subtasks: [
      { id: `${id}:scope`, label: "Confirm the question scope", done: status === "completed" },
      { id: `${id}:evidence`, label: "Record evidence or mark it unknown", done: false },
    ],
    comments: [],
  };
}

function createLocalTestFixture(): LocalTestWorkspaceState {
  const scenario = requireS10Scenario();
  const seededSources = withS10DemoFeasibilitySources([], scenario);
  const project = seededSources.find((record) => record.reference === LOCAL_TEST_PROJECT_CODE);
  if (!project) throw new Error("S10_DEMO_PROJECT_SOURCE_UNAVAILABLE");
  const enquiry = seededSources.find((record) => record.reference === LOCAL_TEST_ENQUIRY_CODE);
  if (!enquiry) throw new Error("S10_DEMO_ENQUIRY_SOURCE_UNAVAILABLE");

  const records = seededSources.map((record) => ({
    ...record,
    title:
      record.type === "Project"
        ? "Vehicle telematics tracker PoC"
        : "Vehicle telematics tracker enquiry",
    fixtureKey: LOCAL_TEST_FIXTURE_KEY,
    linkedRecordIds: record.type === "Project" ? [enquiry.id] : [project.id],
  })) as LocalFixtureRecord[];
  const createdSheet = createDemoFeasibilitySheet(
    { sheets: [], events: [] },
    records,
    project.id,
    "Internal",
    BASE_TIME,
    scenario,
  );
  const sheet = createdSheet.sheets[0];
  if (!sheet) throw new Error("S10_DEMO_FEASIBILITY_SHEET_UNAVAILABLE");
  const hardwareMaster = createS10HardwareMaster(sheet);

  const tasks: LocalWorkspaceTask[] = [
    makeTask(
      `${LOCAL_TEST_PROJECT_CODE}:CM_01:INTAKE`,
      "CM_01",
      "SAL",
      "Capture the enquiry and link the feasibility draft",
      "Record the supplied scenario brief and leave open decisions visible.",
      "Priya Sharma",
      "completed",
    ),
    makeTask(
      `${LOCAL_TEST_PROJECT_CODE}:CM_02:SAL`,
      "CM_02",
      "SAL",
      "Clarify use context, connectivity and PoC evidence",
      "Ask how requested 4G relates to operation without internet using LoRa; no architecture is assumed.",
      "Priya Sharma",
      "in_progress",
    ),
    makeTask(
      `${LOCAL_TEST_PROJECT_CODE}:CM_02:EHW`,
      "CM_02",
      "EHW",
      "Review receiver and antenna evidence questions",
      "Identify candidate evidence needed for requested IRNSS/NavIC; capability and performance remain unverified.",
      "Avery Vale",
      "blocked",
    ),
    makeTask(
      `${LOCAL_TEST_PROJECT_CODE}:CM_02:FW`,
      "CM_02",
      "FW",
      "Review offline acquisition and buffering questions",
      "Clarify desired acquisition, local buffering and later synchronization behavior; values remain unknown.",
      "Devon Lane",
      "in_review",
    ),
    makeTask(
      `${LOCAL_TEST_PROJECT_CODE}:CM_02:SW`,
      "CM_02",
      "SW",
      "Map the LoRa topology and 4G coexistence question",
      "Keep local peers, gateway, capacity, range and regional band unanswered pending evidence.",
      "Siddharth Roy",
      "todo",
    ),
    makeTask(
      `${LOCAL_TEST_PROJECT_CODE}:CM_02:MECH`,
      "CM_02",
      "MECH",
      "Collect mounting and environment needs",
      "Ask about mounting context, environment and enclosure needs without assuming dimensions or ratings.",
      "Samira Holt",
      "todo",
    ),
    makeTask(
      `${LOCAL_TEST_PROJECT_CODE}:CM_02:PUR`,
      "CM_02",
      "PUR",
      "Identify candidate availability evidence",
      "List evidence to gather for candidate component availability and lead time; no sourcing commitment.",
      "Morgan Reed",
      "todo",
    ),
    makeTask(
      `${LOCAL_TEST_PROJECT_CODE}:CM_02:QA`,
      "CM_02",
      "QA",
      "Define PoC evidence and conditional compliance questions",
      "Separate internal PoC evidence from any certification applicability decision.",
      "Jordan Blake",
      "todo",
    ),
  ];
  tasks[0]?.comments.push({
    id: `${tasks[0].id}:comment-1`,
    author: "Priya Sharma · sample Sales role",
    body: "Intake captured as a fictional, unverified scenario; no customer decision is recorded.",
    createdAt: BASE_TIME,
  });
  tasks[1]?.comments.push({
    id: `${tasks[1].id}:comment-1`,
    author: "Avery Vale · sample EHW role",
    body: "Receiver/antenna evidence is still a question; no part capability is asserted.",
    createdAt: BASE_TIME,
  });

  return {
    version: 2,
    fixtureKey: LOCAL_TEST_FIXTURE_KEY,
    androidFixtureReference: LOCAL_TEST_ANDROID_FIXTURE_REFERENCE,
    records,
    sheets: [{ ...sheet, fixtureKey: LOCAL_TEST_FIXTURE_KEY }],
    tasks,
    handoffs: [
      {
        id: "DEMO-PROJ-010:HF-SAL-EHW",
        fixtureKey: LOCAL_TEST_FIXTURE_KEY,
        projectId: LOCAL_TEST_PROJECT_ID,
        fromDepartment: "SAL",
        toDepartment: "EHW",
        title: "NavIC receiver evidence question",
        status: "Draft",
        note: "Feasibility question only; no receiver, antenna, or performance evidence has been confirmed.",
        requiresFreeze: false,
      },
      {
        id: "DEMO-PROJ-010:HF-FW-SW",
        fixtureKey: LOCAL_TEST_FIXTURE_KEY,
        projectId: LOCAL_TEST_PROJECT_ID,
        fromDepartment: "FW",
        toDepartment: "SW",
        title: "Offline behavior and data-exchange clarification",
        status: "Awaiting review",
        note: "Question exchange only; 4G/LoRa architecture remains unresolved.",
        requiresFreeze: false,
      },
      {
        id: "DEMO-PROJ-010:HF-HW-FW-INTERFACE",
        fixtureKey: LOCAL_TEST_FIXTURE_KEY,
        projectId: LOCAL_TEST_PROJECT_ID,
        fromDepartment: "EHW",
        toDepartment: "FW",
        title: "Future HW–FW interface handoff",
        status: "Draft",
        note: "Conditional roadmap handoff; blocked until authorized feasibility freeze and later interface evidence.",
        requiresFreeze: true,
      },
    ],
    documents: [
      {
        id: "DEMO-PROJ-010:DOC-REQ-SUMMARY",
        fixtureKey: LOCAL_TEST_FIXTURE_KEY,
        projectId: LOCAL_TEST_PROJECT_ID,
        reference: "DEMO-DOC-S10-001",
        title: "Feasibility input summary",
        department: "SAL",
        revision: "00",
        status: "Draft metadata",
        classification: "Internal · local test",
        filePresent: false,
        released: false,
      },
      {
        id: "DEMO-PROJ-010:DOC-INTERFACE-PLAN",
        fixtureKey: LOCAL_TEST_FIXTURE_KEY,
        projectId: LOCAL_TEST_PROJECT_ID,
        reference: "DEMO-DOC-S10-002",
        title: "Conditional interface evidence outline",
        department: "EHW / FW",
        revision: "00",
        status: "Future planned",
        classification: "Internal · local test",
        filePresent: false,
        released: false,
      },
    ],
    documentDrafts: [],
    binarySelections: [],
    feedback: [],
    departments: [
      {
        id: "local-sal",
        fixtureKey: LOCAL_TEST_FIXTURE_KEY,
        code: "SAL",
        name: "Sales & Commercial",
        lead: "Priya Sharma",
      },
      {
        id: "local-ehw",
        fixtureKey: LOCAL_TEST_FIXTURE_KEY,
        code: "EHW",
        name: "Embedded Hardware",
        lead: "Avery Vale",
      },
      {
        id: "local-fw",
        fixtureKey: LOCAL_TEST_FIXTURE_KEY,
        code: "FW",
        name: "Firmware",
        lead: "Devon Lane",
      },
      {
        id: "local-sw",
        fixtureKey: LOCAL_TEST_FIXTURE_KEY,
        code: "SW",
        name: "Cloud & Application Software",
        lead: "Siddharth Roy",
      },
      {
        id: "local-mech",
        fixtureKey: LOCAL_TEST_FIXTURE_KEY,
        code: "MECH",
        name: "Mechanical Engineering",
        lead: "Samira Holt",
      },
      {
        id: "local-pur",
        fixtureKey: LOCAL_TEST_FIXTURE_KEY,
        code: "PUR",
        name: "Purchasing & SCM",
        lead: "Morgan Reed",
      },
      {
        id: "local-qa",
        fixtureKey: LOCAL_TEST_FIXTURE_KEY,
        code: "QA",
        name: "Quality Assurance & APQP",
        lead: "Jordan Blake",
      },
      {
        id: "local-emf",
        fixtureKey: LOCAL_TEST_FIXTURE_KEY,
        code: "EMF",
        name: "Electronics Manufacturing",
        lead: "Casey Rowan",
      },
      {
        id: "local-mmf",
        fixtureKey: LOCAL_TEST_FIXTURE_KEY,
        code: "MMF",
        name: "Mechanical Manufacturing",
        lead: "Vikram Kapoor",
      },
    ],
    events: [
      {
        id: "DEMO-PROJ-010:EVENT-SEEDED",
        fixtureKey: LOCAL_TEST_FIXTURE_KEY,
        at: BASE_TIME,
        actor: SAMPLE_ACTOR,
        action: "Local test sample loaded",
        detail: "Synthetic fixture only; not a customer decision or project authorization.",
      },
    ],
    completedStageCodes: ["CM_01"],
    inProgressStageCodes: ["CM_02"],
    hardwareMaster,
  };
}

function ensureCompatibleState(state: LocalTestWorkspaceState): LocalTestWorkspaceState {
  if (
    (state.version !== 1 && state.version !== 2) ||
    state.fixtureKey !== LOCAL_TEST_FIXTURE_KEY ||
    (state.version === 2 &&
      state.androidFixtureReference !== LOCAL_TEST_ANDROID_FIXTURE_REFERENCE) ||
    (state.androidFixtureReference !== undefined &&
      state.androidFixtureReference !== LOCAL_TEST_ANDROID_FIXTURE_REFERENCE) ||
    !Array.isArray(state.records) ||
    !Array.isArray(state.sheets) ||
    !Array.isArray(state.tasks) ||
    !Array.isArray(state.handoffs) ||
    !Array.isArray(state.documents) ||
    !Array.isArray(state.documentDrafts ?? []) ||
    !Array.isArray(state.binarySelections ?? []) ||
    !Array.isArray(state.feedback) ||
    !Array.isArray(state.departments) ||
    !Array.isArray(state.events) ||
    (state.hardwareMaster !== undefined &&
      (!Array.isArray(state.hardwareMaster.requirements) ||
        !Array.isArray(state.hardwareMaster.assets) ||
        !Array.isArray(state.hardwareMaster.tentativeBom) ||
        !Array.isArray(state.hardwareMaster.budgetLines) ||
        !Array.isArray(state.hardwareMaster.draftRecords) ||
        !Array.isArray(state.hardwareMaster.binaryDeliverables)))
  ) {
    throw new Error("LOCAL_TEST_WORKSPACE_STATE_INVALID");
  }
  return {
    ...state,
    documentDrafts: state.documentDrafts ?? [],
    binarySelections: state.binarySelections ?? [],
  };
}

function mergeMissingById<T extends { id: string }>(
  existing: T[],
  seeded: T[],
): { values: T[]; changed: boolean } {
  const ids = new Set(existing.map((item) => item.id));
  const missing = seeded.filter((item) => !ids.has(item.id));
  return {
    values: missing.length ? [...existing, ...missing] : existing,
    changed: missing.length > 0,
  };
}

export function loadLocalTestFixture(
  saved?: LocalTestWorkspaceState | null,
): LocalTestWorkspaceState {
  const seeded = createLocalTestFixture();
  if (!saved) return seeded;
  const state = ensureCompatibleState(saved);

  const recordsByReference = new Map(state.records.map((record) => [record.reference, record]));
  const recordsById = new Map(state.records.map((record) => [record.id, record]));
  for (const record of seeded.records) {
    if (state.records.filter((existing) => existing.reference === record.reference).length > 1) {
      throw new Error(`LOCAL_TEST_RECORD_REFERENCE_CONFLICT:${record.reference}`);
    }
    if (state.records.filter((existing) => existing.id === record.id).length > 1) {
      throw new Error(`LOCAL_TEST_RECORD_ID_CONFLICT:${record.id}`);
    }
    const sameReference = recordsByReference.get(record.reference);
    const sameId = recordsById.get(record.id);
    if (sameReference && (sameReference.id !== record.id || sameReference.type !== record.type)) {
      throw new Error(`LOCAL_TEST_RECORD_REFERENCE_CONFLICT:${record.reference}`);
    }
    if (
      sameId &&
      (sameId.reference !== record.reference ||
        sameId.type !== record.type ||
        (sameId.fixtureKey !== LOCAL_TEST_FIXTURE_KEY &&
          sameId.fields["demoFixtureKey"] !== LOCAL_TEST_FIXTURE_KEY))
    ) {
      throw new Error(`LOCAL_TEST_RECORD_ID_CONFLICT:${record.id}`);
    }
  }

  const records = mergeMissingById(state.records, seeded.records);
  const sheets = mergeMissingById(state.sheets, seeded.sheets);
  const tasks = mergeMissingById(state.tasks, seeded.tasks);
  const handoffs = mergeMissingById(state.handoffs, seeded.handoffs);
  const documents = mergeMissingById(state.documents, seeded.documents);
  const feedback = mergeMissingById(state.feedback, seeded.feedback);
  const departments = mergeMissingById(state.departments, seeded.departments);
  const events = mergeMissingById(state.events, seeded.events);
  const existingS10Sheet = state.sheets.find(
    (sheet) =>
      sheet.fixtureKey === LOCAL_TEST_FIXTURE_KEY ||
      sheet.source_record_id === LOCAL_TEST_PROJECT_ID ||
      sheet.id === LOCAL_TEST_FEASIBILITY_SHEET_ID,
  );
  const existingHardware =
    state.hardwareMaster ?? createS10HardwareMaster(existingS10Sheet ?? seeded.sheets[0]!);
  const seededHardware = seeded.hardwareMaster!;
  const requirements = mergeMissingById(existingHardware.requirements, seededHardware.requirements);
  const assets = mergeMissingById(existingHardware.assets, seededHardware.assets);
  const tentativeBom = mergeMissingById(existingHardware.tentativeBom, seededHardware.tentativeBom);
  const budgetLines = mergeMissingById(existingHardware.budgetLines, seededHardware.budgetLines);
  const draftRecords = mergeMissingById(existingHardware.draftRecords, seededHardware.draftRecords);
  const binaryDeliverables = mergeMissingById(
    existingHardware.binaryDeliverables,
    seededHardware.binaryDeliverables,
  );
  const hardwareMasterChanged =
    requirements.changed ||
    assets.changed ||
    tentativeBom.changed ||
    budgetLines.changed ||
    draftRecords.changed ||
    binaryDeliverables.changed;
  const changed =
    state.version !== 2 ||
    records.changed ||
    sheets.changed ||
    tasks.changed ||
    handoffs.changed ||
    documents.changed ||
    feedback.changed ||
    departments.changed ||
    events.changed ||
    hardwareMasterChanged;
  if (!changed) return state;

  return {
    ...state,
    version: 2,
    androidFixtureReference: seeded.androidFixtureReference,
    records: records.values,
    sheets: sheets.values,
    tasks: tasks.values,
    handoffs: handoffs.values,
    documents: documents.values,
    documentDrafts: state.documentDrafts,
    binarySelections: state.binarySelections,
    feedback: feedback.values,
    departments: departments.values,
    events: events.values,
    completedStageCodes: state.completedStageCodes ?? seeded.completedStageCodes,
    inProgressStageCodes: state.inProgressStageCodes ?? seeded.inProgressStageCodes,
    hardwareMaster: {
      ...existingHardware,
      projectId: LOCAL_TEST_PROJECT_ID,
      requirements: requirements.values,
      assets: assets.values,
      tentativeBom: tentativeBom.values,
      budgetLines: budgetLines.values,
      draftRecords: draftRecords.values,
      binaryDeliverables: binaryDeliverables.values,
    },
  };
}

function nextEventId(state: LocalTestWorkspaceState, fixtureKey = LOCAL_TEST_FIXTURE_KEY): string {
  let suffix = state.events.length + 1;
  const prefix = fixtureKey === LOCAL_TEST_FIXTURE_KEY ? LOCAL_TEST_PROJECT_CODE : fixtureKey;
  let id = `${prefix}:EVENT-${suffix}`;
  const ids = new Set(state.events.map((event) => event.id));
  while (ids.has(id)) id = `${prefix}:EVENT-${++suffix}`;
  return id;
}

function appendEvent(
  state: LocalTestWorkspaceState,
  action: string,
  detail: string,
  actor: string,
  at: string,
  fixtureKey = LOCAL_TEST_FIXTURE_KEY,
): LocalTestWorkspaceState {
  return {
    ...state,
    events: [
      ...state.events,
      {
        id: nextEventId(state, fixtureKey),
        fixtureKey,
        at,
        actor,
        action,
        detail,
      },
    ],
  };
}

export function reloadLocalTestFixture(
  state: LocalTestWorkspaceState,
  at: string,
): LocalTestWorkspaceState {
  const loaded = loadLocalTestFixture(state);
  return appendEvent(
    loaded,
    "Local test sample reloaded",
    "Existing fixture edits and unrelated local data were preserved.",
    SAMPLE_ACTOR,
    at,
  );
}

function isLocalFixtureRecord(record: { fixtureKey?: string; fields?: Record<string, string> }) {
  return (
    record.fixtureKey === LOCAL_TEST_FIXTURE_KEY ||
    record.fields?.["demoFixtureKey"] === LOCAL_TEST_FIXTURE_KEY
  );
}

export function resetLocalTestFixture(state: LocalTestWorkspaceState): LocalTestWorkspaceState {
  const resetState = { ...state };
  delete resetState.hardwareMaster;
  return {
    ...resetState,
    records: state.records.filter((record) => !isLocalFixtureRecord(record)),
    sheets: state.sheets.filter(
      (sheet) =>
        !(
          sheet.id === LOCAL_TEST_FEASIBILITY_SHEET_ID &&
          sheet.source_record_id === LOCAL_TEST_PROJECT_ID
        ),
    ),
    tasks: state.tasks.filter((task) => task.fixtureKey !== LOCAL_TEST_FIXTURE_KEY),
    handoffs: state.handoffs.filter((handoff) => handoff.fixtureKey !== LOCAL_TEST_FIXTURE_KEY),
    documents: state.documents.filter((document) => document.fixtureKey !== LOCAL_TEST_FIXTURE_KEY),
    documentDrafts: state.documentDrafts.filter(
      (draft) => draft.fixtureKey !== LOCAL_TEST_FIXTURE_KEY,
    ),
    binarySelections: state.binarySelections.filter(
      (selection) => selection.fixtureKey !== LOCAL_TEST_FIXTURE_KEY,
    ),
    feedback: state.feedback.filter((item) => item.fixtureKey !== LOCAL_TEST_FIXTURE_KEY),
    departments: state.departments.filter(
      (department) => department.fixtureKey !== LOCAL_TEST_FIXTURE_KEY,
    ),
    events: state.events.filter((event) => event.fixtureKey !== LOCAL_TEST_FIXTURE_KEY),
    completedStageCodes: ["CM_01"],
    inProgressStageCodes: ["CM_02"],
  };
}

export function updateLocalHardwareRequirement(
  state: LocalTestWorkspaceState,
  requirementId: string,
  value: string,
  actor: string,
  at: string,
): LocalTestWorkspaceState {
  const master = state.hardwareMaster;
  const requirement = master?.requirements.find((item) => item.id === requirementId);
  if (!master || !requirement) throw new Error("LOCAL_TEST_REQUIREMENT_NOT_FOUND");
  if (requirement.provenance !== "fixture_assumption") {
    throw new Error("LOCAL_TEST_USER_BRIEF_FACT_READ_ONLY");
  }
  const next = {
    ...state,
    hardwareMaster: {
      ...master,
      requirements: master.requirements.map((item) =>
        item.id === requirementId ? { ...item, value } : item,
      ),
    },
  };
  return appendEvent(
    next,
    "Local EHW requirement draft updated",
    `${requirement.label} · editable test assumption only; not approved or frozen.`,
    actor,
    at,
  );
}

export function updateLocalTentativeBomLine(
  state: LocalTestWorkspaceState,
  lineId: string,
  patch: Partial<
    Pick<LocalTentativeBomLine, "quantity" | "supplier" | "leadTimeWeeks" | "estimatedUnitCostUsd">
  >,
  actor: string,
  at: string,
): LocalTestWorkspaceState {
  const master = state.hardwareMaster;
  const line = master?.tentativeBom.find((item) => item.id === lineId);
  if (!master || !line) throw new Error("LOCAL_TEST_BOM_LINE_NOT_FOUND");
  if (
    (patch.quantity !== undefined && (!Number.isFinite(patch.quantity) || patch.quantity <= 0)) ||
    (patch.estimatedUnitCostUsd !== undefined &&
      (!Number.isFinite(patch.estimatedUnitCostUsd) || patch.estimatedUnitCostUsd < 0))
  ) {
    throw new Error("LOCAL_TEST_BOM_VALUE_INVALID");
  }
  const next = {
    ...state,
    hardwareMaster: {
      ...master,
      tentativeBom: master.tentativeBom.map((item) =>
        item.id === lineId ? { ...item, ...patch } : item,
      ),
    },
  };
  return appendEvent(
    next,
    "Local tentative BOM draft updated",
    `${line.inventoryItemId} · estimate only; no order, reservation, or supplier commitment.`,
    actor,
    at,
  );
}

export function updateLocalBudgetLine(
  state: LocalTestWorkspaceState,
  lineId: string,
  amountUsd: number,
  actor: string,
  at: string,
): LocalTestWorkspaceState {
  const master = state.hardwareMaster;
  const line = master?.budgetLines.find((item) => item.id === lineId);
  if (!master || !line) throw new Error("LOCAL_TEST_BUDGET_LINE_NOT_FOUND");
  if (!Number.isFinite(amountUsd) || amountUsd < 0) {
    throw new Error("LOCAL_TEST_BUDGET_VALUE_INVALID");
  }
  const next = {
    ...state,
    hardwareMaster: {
      ...master,
      budgetLines: master.budgetLines.map((item) =>
        item.id === lineId ? { ...item, amountUsd } : item,
      ),
    },
  };
  return appendEvent(
    next,
    "Local planning budget draft updated",
    `${line.category} · estimate only; not a quote, cost target, or authorized spend.`,
    actor,
    at,
  );
}

export function localHardwareBudgetSummary(master: LocalHardwareMasterData) {
  const tentativeBomSubtotal = master.tentativeBom.reduce(
    (sum, line) => sum + line.quantity * line.estimatedUnitCostUsd,
    0,
  );
  const allowancesSubtotal = master.budgetLines.reduce((sum, line) => sum + line.amountUsd, 0);
  const subtotal = tentativeBomSubtotal + allowancesSubtotal;
  const contingency = subtotal * (master.contingencyPercent / 100);
  return {
    tentativeBomSubtotal,
    allowancesSubtotal,
    subtotal,
    contingency,
    estimatedPlanningTotal: subtotal + contingency,
  };
}

export function deriveLocalWorkspaceView(state: LocalTestWorkspaceState, departmentCode?: string) {
  const lifecycle = computeProgressiveStageAndTaskState({
    projectId: LOCAL_TEST_PROJECT_ID,
    track: "hardware_firmware_software",
    completedStageCodes: state.completedStageCodes,
    inProgressStageCodes: state.inProgressStageCodes,
    requireAuthorizedFeasibilityFreeze: true,
    customTasks: state.tasks
      .filter(
        (task) =>
          task.fixtureKey === LOCAL_TEST_FIXTURE_KEY && CURRENT_STAGE_CODES.has(task.stageCode),
      )
      .map(projectTaskForLifecycle),
  });
  const eligibleStageCodes = new Set(
    lifecycle.stages
      .filter((stage) => ["completed", "ready", "in_progress"].includes(stage.status))
      .map((stage) => stage.stageCode),
  );
  const department = departmentCode?.trim().toUpperCase();
  const activeTasks = state.tasks.filter(
    (task) =>
      task.fixtureKey === LOCAL_TEST_FIXTURE_KEY &&
      eligibleStageCodes.has(task.stageCode) &&
      (!department || task.department === department),
  );
  const plannedTaskPreviews = lifecycle.plannedTaskPreviews.filter(
    (task) =>
      PREVIEW_STAGE_CODES.has(task.stageCode) && (!department || task.department === department),
  );
  const blockedDownstreamStages = lifecycle.stages.filter(
    (stage) => !CURRENT_STAGE_CODES.has(stage.stageCode) && stage.status === "planned",
  );
  return {
    lifecycle,
    activeTasks,
    plannedTaskPreviews,
    blockedDownstreamStages,
    downstreamTaskGenerationBlocked:
      lifecycle.activeTasks.every((task) => CURRENT_STAGE_CODES.has(task.stageCode)) &&
      blockedDownstreamStages.length > 0 &&
      !lifecycle.stages.some(
        (stage) =>
          !CURRENT_STAGE_CODES.has(stage.stageCode) &&
          ["ready", "in_progress", "completed"].includes(stage.status),
      ),
  };
}

const ALLOWED_TASK_TRANSITIONS: Record<LocalTaskStatus, LocalTaskStatus[]> = {
  todo: ["in_progress"],
  in_progress: ["in_review", "blocked", "completed"],
  in_review: ["in_progress", "blocked", "completed"],
  blocked: ["in_progress"],
  completed: [],
};

export function allowedLocalTaskTransitions(status: LocalTaskStatus): LocalTaskStatus[] {
  return [...ALLOWED_TASK_TRANSITIONS[status]];
}

export function transitionLocalTask(
  state: LocalTestWorkspaceState,
  taskId: string,
  nextStatus: LocalTaskStatus,
  actor: string,
  at: string,
): LocalTestWorkspaceState {
  const task = state.tasks.find(
    (item) => item.id === taskId && item.fixtureKey === LOCAL_TEST_FIXTURE_KEY,
  );
  if (!task) throw new Error("LOCAL_TEST_TASK_NOT_FOUND");
  if (!deriveLocalWorkspaceView(state).activeTasks.some((item) => item.id === taskId)) {
    throw new Error("LOCAL_TEST_TASK_STAGE_BLOCKED");
  }
  if (!ALLOWED_TASK_TRANSITIONS[task.status].includes(nextStatus)) {
    throw new Error("LOCAL_TEST_TASK_TRANSITION_INVALID");
  }
  const next = {
    ...state,
    tasks: state.tasks.map((item) => (item.id === taskId ? { ...task, status: nextStatus } : item)),
  };
  return appendEvent(
    next,
    "Local task status changed",
    `${task.department} · ${task.title} · ${task.status} → ${nextStatus}. Lifecycle gates were not changed.`,
    actor,
    at,
  );
}

export function toggleLocalTaskSubtask(
  state: LocalTestWorkspaceState,
  taskId: string,
  subtaskId: string,
  actor: string,
  at: string,
): LocalTestWorkspaceState {
  const task = state.tasks.find(
    (item) => item.id === taskId && item.fixtureKey === LOCAL_TEST_FIXTURE_KEY,
  );
  if (!task || !deriveLocalWorkspaceView(state).activeTasks.some((item) => item.id === taskId)) {
    throw new Error("LOCAL_TEST_TASK_NOT_FOUND_OR_BLOCKED");
  }
  const subtask = task.subtasks.find((item) => item.id === subtaskId);
  if (!subtask) throw new Error("LOCAL_TEST_SUBTASK_NOT_FOUND");
  const next = {
    ...state,
    tasks: state.tasks.map((item) =>
      item.id === taskId
        ? {
            ...task,
            subtasks: task.subtasks.map((entry) =>
              entry.id === subtaskId ? { ...entry, done: !entry.done } : entry,
            ),
          }
        : item,
    ),
  };
  return appendEvent(
    next,
    "Local task checklist updated",
    `${task.title} · ${subtask.label}`,
    actor,
    at,
  );
}

export function addLocalTaskComment(
  state: LocalTestWorkspaceState,
  taskId: string,
  body: string,
  author: string,
  at: string,
): LocalTestWorkspaceState {
  const task = state.tasks.find(
    (item) => item.id === taskId && item.fixtureKey === LOCAL_TEST_FIXTURE_KEY,
  );
  const content = body.trim();
  if (!task || !deriveLocalWorkspaceView(state).activeTasks.some((item) => item.id === taskId)) {
    throw new Error("LOCAL_TEST_TASK_NOT_FOUND_OR_BLOCKED");
  }
  if (!content) throw new Error("LOCAL_TEST_COMMENT_EMPTY");
  const next = {
    ...state,
    tasks: state.tasks.map((item) =>
      item.id === taskId
        ? {
            ...task,
            comments: [
              ...task.comments,
              {
                id: `${taskId}:comment-${task.comments.length + 1}`,
                author,
                body: content,
                createdAt: at,
              },
            ],
          }
        : item,
    ),
  };
  return appendEvent(
    next,
    "Local review comment added",
    `${task.department} · ${task.title}`,
    author,
    at,
  );
}

export function transitionLocalHandoff(
  state: LocalTestWorkspaceState,
  handoffId: string,
  nextStatus: LocalWorkspaceStatus,
  actor: string,
  at: string,
): LocalTestWorkspaceState {
  const handoff = state.handoffs.find((item) => item.id === handoffId);
  if (!handoff) throw new Error("LOCAL_TEST_HANDOFF_NOT_FOUND");
  if (handoff.fixtureKey !== LOCAL_TEST_FIXTURE_KEY) {
    throw new Error("LOCAL_TEST_HANDOFF_NOT_FOUND");
  }
  if (handoff.requiresFreeze) {
    throw new Error("LOCAL_TEST_HANDOFF_STAGE_BLOCKED");
  }
  const allowed =
    (handoff.status === "Draft" && nextStatus === "Awaiting review") ||
    (handoff.status === "Awaiting review" && nextStatus === "Returned with questions") ||
    (handoff.status === "Returned with questions" && nextStatus === "Draft");
  if (!allowed) throw new Error("LOCAL_TEST_HANDOFF_TRANSITION_INVALID");
  const next = {
    ...state,
    handoffs: state.handoffs.map((item) =>
      item.id === handoffId ? { ...handoff, status: nextStatus } : item,
    ),
  };
  return appendEvent(
    next,
    "Local handoff status changed",
    `${handoff.fromDepartment} → ${handoff.toDepartment} · ${handoff.title} · ${nextStatus}. No gate was accepted.`,
    actor,
    at,
  );
}

export function addLocalFeedback(
  state: LocalTestWorkspaceState,
  taskId: string,
  body: string,
  author: string,
  at: string,
): LocalTestWorkspaceState {
  const content = body.trim();
  const task = state.tasks.find(
    (item) => item.id === taskId && item.fixtureKey === LOCAL_TEST_FIXTURE_KEY,
  );
  if (!task || !deriveLocalWorkspaceView(state).activeTasks.some((item) => item.id === taskId)) {
    throw new Error("LOCAL_TEST_FEEDBACK_TASK_NOT_FOUND_OR_BLOCKED");
  }
  if (!content) throw new Error("LOCAL_TEST_FEEDBACK_EMPTY");
  const id = `${taskId}:feedback-${state.feedback.length + 1}`;
  const next = {
    ...state,
    feedback: [
      ...state.feedback,
      {
        id,
        fixtureKey: LOCAL_TEST_FIXTURE_KEY,
        projectId: LOCAL_TEST_PROJECT_ID,
        taskId,
        author,
        body: content,
        status: "Open" as const,
        response: "",
      },
    ],
  };
  return appendEvent(
    next,
    "Local scenario feedback recorded",
    `${task.title} · Internal test note; not client feedback.`,
    author,
    at,
  );
}

export function reviewLocalFeedback(
  state: LocalTestWorkspaceState,
  feedbackId: string,
  response: string,
  actor: string,
  at: string,
): LocalTestWorkspaceState {
  const feedback = state.feedback.find((item) => item.id === feedbackId);
  const content = response.trim();
  if (!feedback) throw new Error("LOCAL_TEST_FEEDBACK_NOT_FOUND");
  if (!content) throw new Error("LOCAL_TEST_FEEDBACK_RESPONSE_EMPTY");
  if (feedback.status !== "Open") {
    throw new Error("LOCAL_TEST_FEEDBACK_ALREADY_REVIEWED");
  }
  const next = {
    ...state,
    feedback: state.feedback.map((item) =>
      item.id === feedbackId
        ? { ...feedback, status: "Noted locally" as const, response: content }
        : item,
    ),
  };
  return appendEvent(
    next,
    "Local scenario feedback reviewed",
    `${feedback.body} · Response: ${content}. Draft values and approval state were not changed.`,
    actor,
    at,
  );
}

export function projectTaskForLifecycle(task: LocalWorkspaceTask): ProjectTaskInstance {
  return {
    id: task.id,
    projectId: task.projectId,
    stageCode: task.stageCode,
    stageKey: `LOCAL-TEST:${task.stageCode}`,
    title: task.title,
    description: task.description,
    department: task.department,
    assignee: task.assignee,
    status: task.status === "blocked" ? "todo" : task.status,
    priority: "Normal",
    order: 1,
  };
}

export function departmentCodesForLocalFixture(state: LocalTestWorkspaceState): string[] {
  return state.departments
    .filter((department) => department.fixtureKey === LOCAL_TEST_FIXTURE_KEY)
    .map((department) => department.code);
}

const LOCAL_DOCUMENT_DEPARTMENT_ALIASES: Record<string, string> = {
  SALES: "SAL",
  SAL: "SAL",
  EHW: "EHW",
  FW: "FW",
  SW: "SW",
  MECH: "MECH",
  PUR: "PUR",
  QA: "QA",
  EMF: "EMF",
  MMF: "MMF",
};

export function localDocumentDepartmentFilter(value?: string | null): string {
  const department = value?.trim().toUpperCase();
  return department ? (LOCAL_DOCUMENT_DEPARTMENT_ALIASES[department] ?? "All") : "All";
}

const PORTFOLIO_EXAMPLE_KEYS = [
  { key: "no-project-enquiry", fixtureKey: "LC2-E02", scenarioId: "S02" },
  { key: "active-feasibility", fixtureKey: "S10", scenarioId: "S10" },
  { key: "hardware-only", fixtureKey: "LC2-P01", scenarioId: "S01" },
  { key: "hardware-firmware-poc", fixtureKey: "LC2-P03", scenarioId: "S03" },
  { key: "three-track-pilot", fixtureKey: "LC2-P04", scenarioId: "S04" },
  { key: "qa-regression-feedback", fixtureKey: "LC2-P05", scenarioId: "S05" },
] as const;

function scenarioForPortfolioExample(
  id: (typeof PORTFOLIO_EXAMPLE_KEYS)[number]["scenarioId"],
): LifecycleScenario {
  const scenario = getScenario(id);
  if (!scenario) throw new Error(`LOCAL_TEST_PORTFOLIO_SCENARIO_MISSING:${id}`);
  return scenario;
}

function canonicalExample(fixtureKey: string): CanonicalSampleProject {
  const sample = CANONICAL_SAMPLE_PROJECTS.find((item) => item.fixtureKey === fixtureKey);
  if (!sample) throw new Error(`LOCAL_TEST_CANONICAL_SAMPLE_MISSING:${fixtureKey}`);
  return sample;
}

export function getRepresentativePortfolioCoverage(
  state?: LocalTestWorkspaceState,
): LocalPortfolioEntry[] {
  return PORTFOLIO_EXAMPLE_KEYS.map((example) => {
    const scenario = scenarioForPortfolioExample(example.scenarioId);
    if (example.fixtureKey === "S10") {
      const activeTasks =
        state?.tasks.filter(
          (task) =>
            task.fixtureKey === LOCAL_TEST_FIXTURE_KEY &&
            ["CM_01", "CM_02"].includes(task.stageCode),
        ) ?? [];
      return {
        key: example.key,
        fixtureKey: scenario.fixtureKey,
        title: scenario.title.replace(/^DEMO_ONLY\s*/i, ""),
        ...(scenario.projectCode ? { projectCode: scenario.projectCode } : {}),
        ...(scenario.enquiryCode ? { enquiryCode: scenario.enquiryCode } : {}),
        track: "hardware_firmware_software · conditional",
        phase: "CM_02 · feasibility under review",
        status: "DEMO ONLY · pending / unapproved / unfrozen",
        departmentCodes: Array.from(new Set(activeTasks.map((task) => task.department))),
        completedStageCount: scenario.stageHistory.filter((stage) => stage.status === "Completed")
          .length,
        inProgressStageCount: scenario.stageHistory.filter(
          (stage) => stage.status === "Under_Review" || stage.status === "In_Progress",
        ).length,
        activeTaskCount: activeTasks.length,
        plannedPreviewCount: state ? deriveLocalWorkspaceView(state).plannedTaskPreviews.length : 0,
        stages: scenario.stageHistory.map((stage) => ({
          code: stage.stageId,
          name: stage.stageName,
          status: stage.status,
        })),
        tasks: activeTasks.map((task) => ({
          id: task.id,
          title: task.title,
          department: task.department,
          status: task.status,
        })),
        handoffs: scenario.dependencies.map((dependency) => ({
          id: dependency.id,
          title: dependency.whatNeeded,
          provider: dependency.providerDept,
          waiting: dependency.waitingDept,
          status: dependency.state,
        })),
        origin: "Existing S10 lifecycle scenario",
      };
    }

    const sample = canonicalExample(example.fixtureKey);
    const enquiry = sample.records.find((record) => record.type === "Enquiry");
    const sampleEnquiryCode = sample.enquiryCode ?? enquiry?.reference;
    const stages = sample.stages;
    const activeDepartments = new Set(sample.activeTasks.map((task) => task.department));
    const handoffs = scenario.dependencies.map((dependency) => ({
      id: dependency.id,
      title: dependency.whatNeeded,
      provider: dependency.providerDept,
      waiting: dependency.waitingDept,
      status: dependency.state,
    }));
    return {
      key: example.key,
      fixtureKey: sample.fixtureKey,
      title: sample.title,
      ...(sample.projectCode ? { projectCode: sample.projectCode } : {}),
      ...(sampleEnquiryCode ? { enquiryCode: sampleEnquiryCode } : {}),
      track: sample.track,
      phase: sample.currentActiveStage,
      status:
        sample.fixtureKey === "LC2-E02"
          ? "Terminal enquiry · no project"
          : sample.activeSamplePointRemark,
      departmentCodes: [...activeDepartments].sort(),
      completedStageCount: stages.filter((stage) => stage.status === "completed").length,
      inProgressStageCount: stages.filter((stage) => stage.status === "in_progress").length,
      activeTaskCount: sample.activeTasks.length,
      plannedPreviewCount: sample.plannedTaskPreviews.length,
      stages:
        sample.fixtureKey === "LC2-E02"
          ? scenario.stageHistory.map((stage) => ({
              code: stage.stageId,
              name: stage.stageName,
              status: stage.status,
            }))
          : stages.map((stage) => ({
              code: stage.stageCode,
              name: stage.name,
              status: stage.status,
            })),
      tasks: sample.activeTasks.map((task) => ({
        id: task.id,
        title: task.title,
        department: task.department,
        status: task.status,
      })),
      handoffs,
      origin: "Existing canonical sample",
    };
  });
}

export function searchLocalDocumentPortfolio(
  entries: LocalPortfolioEntry[],
  query: string,
): LocalPortfolioEntry[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return entries;

  return entries.filter((entry) =>
    [
      entry.fixtureKey,
      entry.projectCode,
      entry.enquiryCode,
      entry.title,
      entry.track,
      entry.phase,
      entry.status,
      ...entry.departmentCodes,
    ]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase().includes(normalizedQuery)),
  );
}

function documentDueStatus(stageStatus: string, freezeBlocked: boolean): string {
  if (freezeBlocked) return "Blocked · pending feasibility freeze";
  const status = stageStatus.toLowerCase().replaceAll("_", " ");
  if (status.includes("declined")) return "Terminal enquiry · no project deliverable due";
  if (status.includes("complete")) return "Stage complete · no local file attached";
  if (status.includes("in progress") || status.includes("review") || status === "ready") {
    return "Active stage · review due";
  }
  if (status.includes("block")) return "Blocked · prerequisite pending";
  return "Planned · not due";
}

function registerItem(
  entry: LocalPortfolioEntry,
  stage: LocalPortfolioEntry["stages"][number],
  idSuffix: string,
  title: string,
  department: string,
  context: string,
  kind: LocalDocumentRegisterItem["kind"],
  projectId?: string,
  freezeBlocked = false,
): LocalDocumentRegisterItem {
  return {
    id: `${entry.fixtureKey}:DOC:${stage.code}:${idSuffix}`,
    fixtureKey: entry.fixtureKey,
    ...(projectId ? { projectId } : {}),
    ...(entry.projectCode ? { projectCode: entry.projectCode } : {}),
    projectTitle: entry.title,
    stageCode: stage.code,
    stageName: stage.name,
    stageStatus: stage.status,
    stageExitContext: `${context} Stage exit: ${stage.name}.`,
    department,
    title,
    revision: "00",
    kind,
    dueStatus: documentDueStatus(stage.status, freezeBlocked),
  };
}

export function getLocalDocumentRegister(
  state: LocalTestWorkspaceState,
  portfolioKey: string,
  departmentCode?: string,
): LocalDocumentRegisterItem[] {
  const entry = getRepresentativePortfolioCoverage(state).find((item) => item.key === portfolioKey);
  if (!entry) throw new Error(`LOCAL_TEST_PORTFOLIO_ENTRY_NOT_FOUND:${portfolioKey}`);
  const sample = CANONICAL_SAMPLE_PROJECTS.find((item) => item.fixtureKey === entry.fixtureKey);
  const projectId =
    entry.key === "active-feasibility" ? LOCAL_TEST_PROJECT_ID : sample?.projectRecord?.id;
  const stageMap = new Map(entry.stages.map((stage) => [stage.code, stage]));
  const items: LocalDocumentRegisterItem[] = [];

  if (entry.key === "active-feasibility" || entry.key === "no-project-enquiry") {
    const scenarioId = entry.key === "active-feasibility" ? "S10" : "S02";
    const scenario = getScenario(scenarioId);
    if (!scenario) throw new Error(`LOCAL_TEST_PORTFOLIO_SCENARIO_MISSING:${scenarioId}`);
    for (const stage of entry.stages) {
      const sourceStage = scenario.stageHistory.find((item) => item.stageId === stage.code);
      const isS10Future = entry.key === "active-feasibility" && stage.status === "Pending";
      items.push(
        registerItem(
          entry,
          stage,
          "CONTROL",
          `${sourceStage?.stageName ?? stage.name} review record`,
          "SAL",
          sourceStage?.stageRemark
            ? `Editable local review notes. Scenario context: ${sourceStage.stageRemark}`
            : "Editable local stage review notes; no source file or approval is represented.",
          "Controlled draft",
          projectId,
          isS10Future,
        ),
      );
    }

    if (entry.key === "active-feasibility") {
      const feasibilityStage = entry.stages.find((stage) => stage.code === "DEMO-CM-02");
      if (!feasibilityStage) throw new Error("LOCAL_TEST_S10_FEASIBILITY_STAGE_MISSING");
      const feasibilityTasks = state.tasks.filter(
        (task) =>
          task.fixtureKey === LOCAL_TEST_FIXTURE_KEY &&
          task.stageCode === "CM_02" &&
          task.projectId === LOCAL_TEST_PROJECT_ID,
      );
      for (const task of feasibilityTasks) {
        const canonicalStage = CANONICAL_STAGE_TEMPLATES.find(
          (template) => template.stageCode === task.stageCode,
        );
        const item = registerItem(
          entry,
          feasibilityStage,
          `TASK-${task.department}`,
          `${task.title} · review record`,
          task.department,
          `${task.description} Stage-exit notes are editable local draft metadata; task owner ${task.department}, canonical stage owner ${canonicalStage?.defaultOwner ?? "TBD"}.`,
          "Controlled draft",
          LOCAL_TEST_PROJECT_ID,
        );
        items.push({
          ...item,
          sourceTaskId: task.id,
          ...(task.status === "blocked"
            ? { dueStatus: "Blocked · owner task awaiting review" }
            : {}),
        });
      }

      const futureStage: LocalPortfolioEntry["stages"][number] = {
        code: "DEMO-HW-FW-SW-PLAN",
        name: "Conditional HW/FW/SW development and PoC",
        status: "Pending",
      };
      const futureArtifacts: Array<[string, string, string]> = [
        ["SCHEMATIC", "Schematic", "EHW"],
        ["GERBER", "Gerber", "EHW"],
        ["STEP", "CAD / STEP model", "MECH"],
        ["DRAWING", "Engineering drawings", "MECH"],
        ["FIRMWARE", "Firmware package", "FW"],
        ["TEST", "Executed test evidence", "QA"],
        ["CERT", "Certification report (if applicable)", "QA"],
      ];
      for (const [key, title, department] of futureArtifacts) {
        const item = registerItem(
          entry,
          futureStage,
          `BINARY-${key}`,
          title,
          department,
          "External binary artifact selection only; no file is uploaded or shared. Certification applicability remains unassessed.",
          "Binary artifact",
          projectId,
          true,
        );
        items.push({ ...item, id: `${LOCAL_TEST_PROJECT_CODE}:BINARY-${key}` });
      }
    }
  } else {
    const milestones = CONTROLLED_DOCUMENT_MILESTONES.filter((milestone) =>
      stageMap.has(milestone.stageCode),
    );
    for (const milestone of milestones) {
      const stage = stageMap.get(milestone.stageCode)!;
      const template = CANONICAL_STAGE_TEMPLATES.find(
        (item) => item.stageCode === milestone.stageCode,
      );
      items.push(
        registerItem(
          entry,
          stage,
          "CONTROL",
          milestone.title,
          template?.t01.defaultOwner ?? template?.defaultOwner ?? milestone.department,
          `${milestone.context} Canonical stage owner: ${template?.defaultOwner ?? milestone.department}.`,
          "Controlled draft",
          projectId,
        ),
      );
    }

    const binaryMilestones: Array<{
      key: string;
      title: string;
      department: string;
      stageCode: string;
    }> = [];
    for (const [key, title, department, stageCode] of [
      ["SCHEMATIC", "Schematic source", "EHW", "HW_03"],
      ["GERBER", "Gerber fabrication package", "EHW", "HW_03"],
      ["STEP", "CAD / STEP model", "MECH", "HW_04"],
      ["DRAWING", "Engineering drawings", "MECH", "HW_04"],
      ["FIRMWARE", "Firmware package", "FW", "FW_01"],
    ] as const) {
      if (stageMap.has(stageCode)) binaryMilestones.push({ key, title, department, stageCode });
    }
    const testStageCode = stageMap.has("INT_01")
      ? "INT_01"
      : stageMap.has("FW_11")
        ? "FW_11"
        : undefined;
    if (testStageCode) {
      binaryMilestones.push({
        key: "TEST",
        title: "Executed test evidence",
        department: "QA",
        stageCode: testStageCode,
      });
    }
    if (stageMap.has("CL_01")) {
      binaryMilestones.push({
        key: "CERT",
        title: "Certification report (if applicable)",
        department: "QA",
        stageCode: "CL_01",
      });
    }
    for (const artifact of binaryMilestones) {
      const stage = stageMap.get(artifact.stageCode)!;
      items.push(
        registerItem(
          entry,
          stage,
          `BINARY-${artifact.key}`,
          artifact.title,
          artifact.department,
          artifact.key === "CERT"
            ? "Project-configuration certification evidence is separate from reusable-asset certificates; applicability and evidence are unverified."
            : "External binary artifact selection only; the selected file remains browser-local and unshared.",
          "Binary artifact",
          projectId,
        ),
      );
    }
  }

  const drafts = new Map(state.documentDrafts.map((draft) => [draft.id, draft]));
  const filtered = departmentCode
    ? items.filter((item) => item.department === departmentCode.trim().toUpperCase())
    : items;
  return filtered.map((item) => {
    const draft = drafts.get(item.id);
    return draft
      ? {
          ...item,
          title: draft.title,
          revision: draft.revision,
          stageExitContext: draft.stageExitContext,
        }
      : item;
  });
}

export function saveLocalControlledDocumentDraft(
  state: LocalTestWorkspaceState,
  portfolioKey: string,
  documentId: string,
  fields: LocalDocumentDraftFields,
  actor: string,
  at: string,
): LocalTestWorkspaceState {
  const item = getLocalDocumentRegister(state, portfolioKey).find(
    (document) => document.id === documentId && document.kind === "Controlled draft",
  );
  if (!item) throw new Error("LOCAL_TEST_CONTROLLED_DOCUMENT_NOT_FOUND");
  const existing = state.documentDrafts.find((draft) => draft.id === documentId);
  const snapshot: LocalDocumentDraftHistoryEntry = {
    ...fields,
    version: (existing?.history.length ?? 0) + 1,
    savedAt: at,
  };
  const draft: LocalControlledDocumentDraft = {
    id: item.id,
    fixtureKey: item.fixtureKey,
    ...(item.projectId ? { projectId: item.projectId } : {}),
    ...fields,
    savedAt: at,
    history: [...(existing?.history ?? []), snapshot],
  };
  const documentDrafts = existing
    ? state.documentDrafts.map((current) => (current.id === documentId ? draft : current))
    : [...state.documentDrafts, draft];
  return appendEvent(
    { ...state, documentDrafts },
    "Local controlled document draft saved",
    `${item.title} · draft version ${snapshot.version}; no approval, release, freeze, or gate authorization.`,
    actor,
    at,
    item.fixtureKey,
  );
}

export function selectLocalBinaryArtifactFile(
  state: LocalTestWorkspaceState,
  portfolioKey: string,
  artifactId: string,
  file: { name: string; size: number; type: string; lastModified: number },
  actor: string,
  at: string,
): LocalTestWorkspaceState {
  const item = getLocalDocumentRegister(state, portfolioKey).find(
    (document) => document.id === artifactId && document.kind === "Binary artifact",
  );
  if (!item) throw new Error("LOCAL_TEST_BINARY_ARTIFACT_NOT_FOUND");
  if (!file.name || !Number.isFinite(file.size) || file.size < 0) {
    throw new Error("LOCAL_TEST_BINARY_FILE_METADATA_INVALID");
  }
  const selection: LocalBinaryFileSelection = {
    id: item.id,
    fixtureKey: item.fixtureKey,
    ...(item.projectId ? { projectId: item.projectId } : {}),
    fileName: file.name,
    sizeBytes: file.size,
    mimeType: file.type,
    lastModified: file.lastModified,
    selectedAt: at,
    storageState: "Selected locally · not uploaded or shared",
    uploaded: false,
  };
  const exists = state.binarySelections.some((current) => current.id === artifactId);
  const binarySelections = exists
    ? state.binarySelections.map((current) => (current.id === artifactId ? selection : current))
    : [...state.binarySelections, selection];
  return appendEvent(
    { ...state, binarySelections },
    "Local binary file selected",
    `${file.name} · filename and file metadata only; bytes were not uploaded, stored, or shared.`,
    actor,
    at,
    item.fixtureKey,
  );
}
