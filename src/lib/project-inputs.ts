import template from "./project-input-template.json";
export const PROJECT_INPUT_PARAMETERS = template;
export type InputParameter = (typeof PROJECT_INPUT_PARAMETERS)[number];
export type FeasibilityState =
  | "Pending"
  | "Feasible"
  | "Conditional"
  | "Not feasible"
  | "Clarification needed"
  | "Not applicable";
export const FEASIBILITY_STATES: FeasibilityState[] = [
  "Pending",
  "Feasible",
  "Conditional",
  "Not feasible",
  "Clarification needed",
  "Not applicable",
];
export type ParameterResponse = {
  status: FeasibilityState;
  remarks: string;
  evidence: string;
  ownerId: string;
  dueDate: string;
  authorId: string;
  reviewedBy: string;
};
export type ParameterValue = {
  input: string;
  source: string;
  finalValue: string;
  required: boolean;
  responses: Record<string, ParameterResponse>;
  exclusionReason?: string;
};
export type InputSheet = {
  id: string;
  source_record_id: string;
  project_record_id: string | null;
  scope: "Client" | "Internal";
  input_owner_id: string;
  revision: number;
  version: number;
  status: "Draft" | "Approved";
  parameter_values: Record<string, ParameterValue>;
  custom_parameters: InputParameter[];
  client_evidence: string;
  department_estimates?: Record<string, DepartmentFeasibilityEstimate>;
  updated_at: string;
};
export type DepartmentFeasibilityEstimate = {
  currency: string;
  departmentCode?: string;
  engineeringHours: number;
  lifecycleRevisionId?: string;
  stageDurationDays?: Record<string, number>;
  plannedDurationDays: number;
  taskPlan: Record<string, { stageCode?: string; phase?: string; effortHours: number; startOffsetDays: number; durationDays: number }>;
  preliminaryBomCost: number;
  reusableMaterialValue: number;
  consumableCost: number;
  labCertificationFees: number;
  toolingCapex: number;
  assumptions: string;
};

/** Departments a lead may actually manage in shared feasibility work. */
export function feasibilityDepartmentCodes(
  departments: readonly { id: string; code: string; active?: boolean }[],
  roles: readonly { departmentId: string; active: boolean; memberIds: string[]; permissions: string[]; hierarchyLevel?: number | null | undefined }[],
  membershipId: string,
  primaryDepartmentCode: string | null | undefined,
) {
  const available = new Map(departments.filter(department => department.active !== false).map(department => [department.id, department.code]));
  const codes = new Set<string>();
  if (primaryDepartmentCode && departments.some(department => department.code === primaryDepartmentCode && department.active !== false)) codes.add(primaryDepartmentCode);
  for (const role of roles) {
    const code = available.get(role.departmentId);
    // Only an explicitly classified L1 role is an organization-chart lead.
    // Unclassified roles must not inherit feasibility-lead behavior.
    if (role.active && role.hierarchyLevel === 1 && role.memberIds.includes(membershipId) && role.permissions.includes("records:edit") && code) codes.add(code);
  }
  return [...codes].sort((a, b) => a.localeCompare(b));
}

/** Preserve a lead's saved schedule; fill only newly added tasks from the current suggestion. */
export function mergeFeasibilityTaskPlan(
  tasks: readonly { key: string; stageCode: string; phase: string }[],
  saved: DepartmentFeasibilityEstimate["taskPlan"] | undefined,
  suggested: DepartmentFeasibilityEstimate["taskPlan"],
): DepartmentFeasibilityEstimate["taskPlan"] {
  return Object.fromEntries(tasks.map(({ key, stageCode, phase }) => [
    key,
    { ...suggested[key], ...saved?.[key], stageCode, phase },
  ])) as DepartmentFeasibilityEstimate["taskPlan"];
}

/** Flag lifecycle or stage-window changes so saved lead plans are reviewed explicitly. */
export function feasibilityEstimateReview(
  saved: Pick<DepartmentFeasibilityEstimate, "lifecycleRevisionId" | "stageDurationDays">,
  currentRevisionId: string | undefined,
  currentStageDays: Record<string, number>,
) {
  const lifecycleChanged = Boolean(saved.lifecycleRevisionId && currentRevisionId && saved.lifecycleRevisionId !== currentRevisionId);
  const changedStageCodes = Object.entries(currentStageDays)
    .filter(([stageCode, days]) => saved.stageDurationDays?.[stageCode] !== days)
    .map(([stageCode]) => stageCode);
  return { lifecycleChanged, changedStageCodes, requiresReview: lifecycleChanged || changedStageCodes.length > 0 };
}
export function inputReadiness(
  values: InputSheet["parameter_values"],
  parameters: InputParameter[] = PROJECT_INPUT_PARAMETERS,
) {
  let missing = 0,
    awaitingAgreement = 0,
    blocked = 0,
    pending = 0,
    ready = 0;
  for (const p of parameters) {
    const row = values[p.id];
    if (!row || row.required !== false || (row.exclusionReason || "").trim().length < 5) {
      if (!row?.input?.trim()) missing++;
      else if (!row?.finalValue?.trim()) awaitingAgreement++;
      const responses = [p.lead, ...p.reviewers].map((d) => row?.responses?.[d]);
      if (
        responses.some(
          (r) =>
            r?.status === "Not feasible" ||
            r?.status === "Conditional" ||
            r?.status === "Clarification needed",
        )
      )
        blocked++;
      if (
        responses.some(
          (r) => !r || !["Feasible", "Not applicable"].includes(r.status) || !r.reviewedBy,
        )
      )
        pending++;
      else if (row?.input?.trim() && row.finalValue?.trim()) ready++;
    }
  }
  return { missing, awaitingAgreement, blocked, pending, ready, total: parameters.length };
}
