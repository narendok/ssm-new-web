import { FEASIBILITY_STATES, type ParameterResponse } from "./project-inputs";

export function readAssessmentDraft(raw: string | null, revision: number):
  { version: number; values: Record<string, ParameterResponse> } | undefined {
  try {
    const value = JSON.parse(raw || "null");
    if (!value || value.revision !== revision || !Number.isInteger(value.version) || !value.values || typeof value.values !== "object" || Array.isArray(value.values)) return;
    const keys = ["remarks", "evidence", "ownerId", "dueDate", "authorId", "reviewedBy"];
    if (Object.values(value.values).some((row: any) => !row || !FEASIBILITY_STATES.includes(row.status) || keys.some(key => typeof row[key] !== "string"))) return;
    return { version: value.version, values: value.values };
  } catch { return; }
}
