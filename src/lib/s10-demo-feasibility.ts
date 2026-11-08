import type { LifecycleScenario } from "./lifecycle-scenarios";
import type { AnalysisRecord } from "./project-analysis-data";
import type {
  InputParameter,
  InputSheet,
} from "./project-inputs";

const DEMO_ENQUIRY_ID = "demo-s10-enquiry";
const DEMO_PROJECT_ID = "demo-s10-project";
const S10_BRIEF_PROVENANCE =
  "DEMO ONLY · User-provided scenario brief · tentative, unverified";

const S10_BRIEF_INPUTS: Record<string, string> = {
  use_case: "Custom vehicle telematics/GPS tracker; intended PoC/demo.",
  cellular:
    "Requested 4G connectivity. Network/bands/operator and how 4G relates to operation without internet using LoRa are unanswered.",
  gnss:
    "Requested IRNSS/NavIC positioning. Receiver/antenna capability and positioning performance are unverified.",
  special:
    "Investigate LoRa for operation/data exchange without internet. Relationship to requested 4G connectivity is unresolved; no architecture is selected.",
};

const S10_DEPARTMENT_QUESTIONS: InputParameter[] = [
  {
    id: "s10_ehw_receiver_evidence",
    section: "S10 DEMO ONLY · Generated department questions",
    label: "EHW · NavIC receiver, antenna and hardware evidence",
    hint: "Owner: TBD. Question: What receiver/antenna evidence is available for requested IRNSS/NavIC, and what accuracy, update interval, power and vehicle-interface needs must be confirmed? No capability or target is established.",
    lead: "EHW",
    reviewers: [],
    consumers: [],
    required: true,
  },
  {
    id: "s10_fw_offline_behavior",
    section: "S10 DEMO ONLY · Generated department questions",
    label: "FW · Offline acquisition and buffering behavior",
    hint: "Owner: TBD. Question: What should the tracker acquire and buffer when internet is unavailable, for how long, and how should data be synchronized later? Storage capacity and update behavior are unknown.",
    lead: "FW",
    reviewers: [],
    consumers: [],
    required: true,
  },
  {
    id: "s10_sw_lora_topology",
    section: "S10 DEMO ONLY · Generated department questions",
    label: "SW · LoRa topology and 4G / no-internet coexistence",
    hint: "Owner: TBD. Question: What local LoRa peers/gateway and data exchange are intended, and what does 'without internet' mean alongside requested 4G? Do not assume topology, range, capacity or legal band.",
    lead: "SW",
    reviewers: [],
    consumers: [],
    required: true,
  },
  {
    id: "s10_mech_installation_needs",
    section: "S10 DEMO ONLY · Generated department questions",
    label: "MECH · Mounting, environment and enclosure needs",
    hint: "Owner: TBD. Question: Which vehicle mounting points, clearances and environmental conditions apply, and is any enclosure/IP need specified? Dimensions and ratings are unknown.",
    lead: "MECH",
    reviewers: [],
    consumers: [],
    required: true,
  },
  {
    id: "s10_pur_candidate_supply",
    section: "S10 DEMO ONLY · Generated department questions",
    label: "PUR · Candidate availability and lead time",
    hint: "Owner: TBD. Question: Which receiver, 4G and LoRa candidates may be evaluated, and what sourced availability/lifecycle/lead-time evidence can be provided? No candidate or commitment is selected.",
    lead: "PUR",
    reviewers: [],
    consumers: [],
    required: true,
  },
  {
    id: "s10_qa_poc_evidence",
    section: "S10 DEMO ONLY · Generated department questions",
    label: "QA · PoC evidence and conditional certification applicability",
    hint: "Owner: TBD. Question: What evidence would demonstrate PoC behavior, and which certification requirements, if any, apply to the clarified market and scope? No acceptance or certification is asserted.",
    lead: "QA",
    reviewers: [],
    consumers: [],
    required: true,
  },
  {
    id: "s10_sal_client_clarification",
    section: "S10 DEMO ONLY · Generated department questions",
    label: "SAL · Client use, connectivity and PoC acceptance",
    hint: "Owner: TBD. Question: Clarify vehicle/use context, 4G versus no-internet/LoRa operation, demo acceptance evidence, PoC quantity, any production volume and target cost. None is confirmed. Keep enquiry → multi-department feasibility → authorized requirement freeze as gates before any conditional HW/FW/SW development, PoC verification/demo and closeout.",
    lead: "SAL",
    reviewers: [],
    consumers: [],
    required: true,
  },
  {
    id: "s10_emf_conditional_build",
    section: "S10 DEMO ONLY · Conditional generated questions",
    label: "EMF · Conditional PoC build feasibility",
    hint: "Owner: TBD. Conditional only if a physical PoC build is later authorized: what assembly, tooling and traceability needs would apply? No manufacturing work is authorized.",
    lead: "EMF",
    reviewers: [],
    consumers: [],
    required: true,
  },
  {
    id: "s10_mmf_conditional_build",
    section: "S10 DEMO ONLY · Conditional generated questions",
    label: "MMF · Conditional mechanical build feasibility",
    hint: "Owner: TBD. Conditional only if a physical PoC build is later authorized: what enclosure fabrication/mounting feasibility evidence would be needed? No manufacturing work is authorized.",
    lead: "MMF",
    reviewers: [],
    consumers: [],
    required: true,
  },
];

function isS10Project(
  source: AnalysisRecord | undefined,
  scenario: LifecycleScenario,
): boolean {
  return Boolean(
    source &&
      source.type === "Project" &&
      source.reference === scenario.projectCode &&
      source.fields["demoFixtureKey"] === scenario.fixtureKey &&
      source.fields["demoOnly"] === "true",
  );
}

function seedS10DraftSheet(
  sheet: InputSheet,
  source: AnalysisRecord | undefined,
  scenario: LifecycleScenario,
): InputSheet {
  if (sheet.status !== "Draft" || !isS10Project(source, scenario)) return sheet;

  let changed = false;
  const parameterValues = { ...sheet.parameter_values };
  for (const [parameterId, value] of Object.entries(S10_BRIEF_INPUTS)) {
    if (Object.prototype.hasOwnProperty.call(parameterValues, parameterId)) continue;
    parameterValues[parameterId] = {
      input: value,
      source: S10_BRIEF_PROVENANCE,
      finalValue: "",
      required: true,
      responses: {},
    };
    changed = true;
  }

  const customParameters = [...sheet.custom_parameters];
  const knownParameterIds = new Set(customParameters.map((parameter) => parameter.id));
  const customValues = { ...parameterValues };
  for (const parameter of S10_DEPARTMENT_QUESTIONS) {
    if (!knownParameterIds.has(parameter.id)) {
      customParameters.push(parameter);
      knownParameterIds.add(parameter.id);
      changed = true;
    }
    if (!Object.prototype.hasOwnProperty.call(customValues, parameter.id)) {
      customValues[parameter.id] = {
        input: "",
        source: "",
        finalValue: "",
        required: true,
        responses: {},
      };
      changed = true;
    }
  }

  if (!changed) return sheet;
  return {
    ...sheet,
    version: sheet.version + 1,
    updated_at: new Date().toISOString(),
    parameter_values: customValues,
    custom_parameters: customParameters,
  };
}

export function seedS10DemoFeasibilitySnapshot<TEvent>(
  snapshot: DemoInputSnapshot<TEvent>,
  sources: AnalysisRecord[],
  scenario: LifecycleScenario,
): DemoInputSnapshot<TEvent> {
  const project = sources.find((source) => isS10Project(source, scenario));
  if (!project) return snapshot;
  let changed = false;
  const sheets = snapshot.sheets.map((sheet) => {
    if (
      sheet.source_record_id !== project.id &&
      sheet.project_record_id !== project.id
    ) {
      return sheet;
    }
    const seeded = seedS10DraftSheet(sheet, project, scenario);
    changed ||= seeded !== sheet;
    return seeded;
  });
  return changed ? { ...snapshot, sheets } : snapshot;
}

function nextAvailableId(preferred: string, records: AnalysisRecord[]): string {
  const occupied = new Set(records.map((record) => record.id));
  if (!occupied.has(preferred)) return preferred;
  let suffix = 2;
  while (occupied.has(`${preferred}-${suffix}`)) suffix++;
  return `${preferred}-${suffix}`;
}

function existingFixtureRecord(
  records: AnalysisRecord[],
  reference: string,
  type: string,
  fixtureKey: string,
): AnalysisRecord | undefined {
  const matches = records.filter((record) => record.reference === reference);
  if (matches.length > 1) {
    throw new Error(`DEMO_SOURCE_REFERENCE_CONFLICT: ${reference}`);
  }
  const existing = matches[0];
  if (
    existing &&
    (existing.type !== type || existing.fields["demoFixtureKey"] !== fixtureKey)
  ) {
    throw new Error(`DEMO_SOURCE_REFERENCE_CONFLICT: ${reference}`);
  }
  return existing;
}

export function withS10DemoFeasibilitySources(
  records: AnalysisRecord[],
  scenario: LifecycleScenario,
): AnalysisRecord[] {
  if (!scenario.enquiryCode || !scenario.projectCode || !scenario.clientName) {
    throw new Error("S10_DEMO_IDENTITY_INCOMPLETE");
  }

  const enquiry = existingFixtureRecord(
    records,
    scenario.enquiryCode,
    "Enquiry",
    scenario.fixtureKey,
  );
  const project = existingFixtureRecord(
    records,
    scenario.projectCode,
    "Project",
    scenario.fixtureKey,
  );
  const enquiryId = enquiry?.id || nextAvailableId(DEMO_ENQUIRY_ID, records);
  const projectId = project?.id || nextAvailableId(DEMO_PROJECT_ID, records);
  const clientName = scenario.clientName.replace(/\s*\(fictional\)\s*/i, "");
  const demoNotes =
    "DEMO ONLY. Fictional pre-freeze evaluation; no client approval, measurements, certification, or readiness is asserted.";

  const enquiryRecord: AnalysisRecord = {
    id: enquiryId,
    reference: scenario.enquiryCode,
    title: `DEMO ONLY · ${scenario.title.replace(/^DEMO_ONLY\s*/i, "")} enquiry`,
    type: "Enquiry",
    status: "DEMO ONLY · Feasibility pending",
    notes: demoNotes,
    fields: {
      ...(enquiry?.fields || {}),
      customer: clientName,
      clientName,
      demoFixtureKey: scenario.fixtureKey,
      demoOnly: "true",
      projectOrigin: "DEMO ONLY",
      linkedProjectId: projectId,
      linkedProjectCode: scenario.projectCode,
      feasibilityStatus: "Pending",
      feasibilityApproval: "Not approved",
      requirementsFreeze: "Not frozen",
    },
  };
  const projectRecord: AnalysisRecord = {
    id: projectId,
    reference: scenario.projectCode,
    title: scenario.title,
    type: "Project",
    status: "DEMO ONLY · Feasibility pending",
    notes: demoNotes,
    fields: {
      ...(project?.fields || {}),
      customer: clientName,
      clientName,
      demoFixtureKey: scenario.fixtureKey,
      demoOnly: "true",
      projectOrigin: "DEMO ONLY",
      enquiryId: enquiryId,
      enquiryCode: scenario.enquiryCode,
      feasibilityStatus: "Pending",
      feasibilityApproval: "Not approved",
      requirementsFreeze: "Not frozen",
    },
  };

  const fixtureIds = new Set([enquiry?.id, project?.id].filter(Boolean));
  const fixtureReferences = new Set([scenario.enquiryCode, scenario.projectCode]);
  return [
    ...records.filter(
      (record) =>
        !fixtureIds.has(record.id) && !fixtureReferences.has(record.reference),
    ),
    enquiryRecord,
    projectRecord,
  ];
}

type DemoInputSnapshot<TEvent> = {
  sheets: InputSheet[];
  events: TEvent[];
};

export function createDemoFeasibilitySheet<TEvent>(
  snapshot: DemoInputSnapshot<TEvent>,
  sources: AnalysisRecord[],
  sourceId: string,
  scope: "Client" | "Internal",
  updatedAt: string,
  scenario: LifecycleScenario,
): DemoInputSnapshot<TEvent> {
  const source = sources.find((record) => record.id === sourceId);
  if (!source || !["Project", "Enquiry", "Opportunity"].includes(source.type)) {
    throw new Error("DEMO_INPUT_SOURCE_UNAVAILABLE");
  }
  if (
    snapshot.sheets.some(
      (sheet) =>
        sheet.source_record_id === source.id || sheet.project_record_id === source.id,
    )
  ) {
    throw new Error("DEMO_INPUT_SHEET_EXISTS");
  }

  const baseId = `demo-input-${source.reference.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const usedSheetIds = new Set(snapshot.sheets.map((sheet) => sheet.id));
  let id = baseId;
  let suffix = 2;
  while (usedSheetIds.has(id)) id = `${baseId}-${suffix++}`;

  const sheet: InputSheet = {
    id,
    source_record_id: source.id,
    project_record_id: source.type === "Project" ? source.id : null,
    scope,
    input_owner_id: "demo-admin-id",
    revision: 1,
    version: 1,
    status: "Draft",
    parameter_values: {},
    custom_parameters: [],
    client_evidence: "",
    updated_at: updatedAt,
  };
  const created = { ...snapshot, sheets: [...snapshot.sheets, sheet] };
  return seedS10DemoFeasibilitySnapshot(created, sources, scenario);
}

export function availableFeasibilitySources(
  sources: AnalysisRecord[],
  sheets: InputSheet[],
  sourceId: string,
  filter: string,
): AnalysisRecord[] {
  const query = filter.toLowerCase();
  return sources.filter((record) => {
    if (!["Project", "Enquiry", "Opportunity"].includes(record.type)) return false;
    if (sourceId && record.id !== sourceId) return false;
    const exists = sheets.some(
      (sheet) =>
        sheet.source_record_id === record.id || sheet.project_record_id === record.id,
    );
    const searchable = `${record.reference} ${record.title} ${record.fields["customer"] || record.fields["client"]}`.toLowerCase();
    return !exists && searchable.includes(query);
  });
}

export function isDemoInputActionAllowed(action: string): boolean {
  return action === "create";
}
