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
  updated_at: string;
};
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
