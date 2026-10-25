import { recordsForProject, documentsForProject } from "./project-workspace";

export type AnalysisRecord = {
  id: string;
  reference: string;
  title: string;
  type: string;
  status: string;
  area?: string | undefined;
  notes?: string | undefined;
  priority?: string | undefined;
  fields: Record<string, string>;
};
export type AnalysisDocument = {
  id: string;
  title: string;
  type: string;
  lifecycle?: string | undefined;
  linkedRecordRefs?: string[] | undefined;
};
export const approvedInput = (status: string) =>
  ["approved", "released", "frozen"].includes(status.toLowerCase());
export const analysisComplete = (status: string) =>
  approvedInput(status) || ["complete", "completed"].includes(status.toLowerCase());
export function inputState(status: string): string {
  if (approvedInput(status)) return "Approved / Frozen";
  if (/return|rework|reject/i.test(status)) return "Returned / Rework";
  if (/review|pending approval/i.test(status)) return "Under review";
  if (/submit/i.test(status)) return "Submitted";
  if (/draft|open/i.test(status)) return "Draft";
  return status || "Unknown";
}
export function projectAnalysis(
  project: AnalysisRecord,
  records: AnalysisRecord[],
  documents: AnalysisDocument[],
) {
  const work = recordsForProject(records, project).filter((r) => r.id !== project.id);
  const inputs = work.filter((r) => r.type !== "Task");
  const tasks = work.filter((r) => r.type === "Task");
  const keys = new Map(
    records.flatMap(
      (r) =>
        [
          [r.id, r],
          [r.reference, r],
        ] as const,
    ),
  );
  const dependencies = work.flatMap((target) => {
    // Only explicit dependency fields establish an edge; a shared filename/type is never evidence.
    const required = (target.fields["dependsOn"] || target.fields["requiredInputs"] || "")
      .split(/[,;\n]/)
      .map((v) => v.trim())
      .filter(Boolean);
    return required.map((key) => {
      const source = keys.get(key);
      return {
        id: `${target.id}:${key}`,
        reference: key,
        needed: source?.title || "Required input unavailable in this view",
        provider: source?.fields["department"] || source?.area?.toUpperCase() || "Not recorded",
        owner: source?.fields["owner"] || source?.fields["assignee"] || "Unassigned",
        waiting: target.fields["department"] || target.area?.toUpperCase() || "Not recorded",
        waitingRecord: target.reference,
        state: source ? inputState(source.status) : "Missing / restricted",
        blocked: !source || !approvedInput(source.status),
        nextAction: source
          ? source.fields["nextAction"] ||
            (approvedInput(source.status)
              ? "Input available; continue the dependent work"
              : "Complete the input and its required review")
          : "Ask the owner to supply an authorized reference",
        milestone: target.fields["milestone"] || target.fields["stage"] || "Not recorded",
      };
    });
  });
  const departments = Array.from(
    new Set(
      inputs
        .map((r) => r.fields["department"] || r.area?.toUpperCase())
        .filter((v): v is string => Boolean(v)),
    ),
  )
    .sort()
    .map((code) => {
      const rows = inputs.filter((r) => (r.fields["department"] || r.area?.toUpperCase()) === code);
      return {
        code,
        total: rows.length,
        approved: rows.filter((r) => approvedInput(r.status)).length,
      };
    });
  return {
    project,
    work,
    inputs,
    tasks,
    documents: documentsForProject(documents, work, project),
    dependencies,
    departments,
  };
}

export function enquiryAnalysis(records: AnalysisRecord[]) {
  return records
    .filter((r) =>
      ["Enquiry", "Opportunity", "Enquiry & Opportunity", "Lead intake"].includes(r.type),
    )
    .map((enquiry) => ({
      enquiry,
      responses: records.filter(
        (r) => r.fields["enquiryId"] === enquiry.id || r.fields["enquiryId"] === enquiry.reference,
      ),
    }));
}

/** Read saved history only; malformed/unavailable data never falls back to sample constants. */
export function savedLifecycleHistory(value: string | undefined): {id:string;name:string;status:string;remark:string;nextAction:string;startDate:string;endDate:string}[] {
  if (!value) return [];
  try {
    const rows: unknown = JSON.parse(value);
    if (!Array.isArray(rows)) return [];
    return rows.filter((row): row is Record<string,unknown> => row !== null && typeof row === "object" && !Array.isArray(row)).map((row,index) => {
      const text = (key:string) => typeof row[key] === "string" ? row[key] as string : "";
      return {id:text("stageId") || String(index),name:text("stageName"),status:text("status"),remark:text("stageRemark"),nextAction:text("nextAction"),startDate:text("startDate"),endDate:text("endDate")};
    }).filter(row => Boolean(row.name));
  } catch { return []; }
}
