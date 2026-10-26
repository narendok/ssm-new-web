import type { ParsedSorResult } from "./sor-parser";
import type { InputSheet } from "./project-inputs";
import type { SharedJson } from "./shared-test.schema";

export type SorImportRun = {
  signature: string;
  recordRequest: string;
  approvalRequests: Record<string, string>;
  recordId?: string;
};
type Ports = {
  createRecord: (payload: Record<string, SharedJson>, requestId: string) => Promise<{ id?: string }>;
  createSheet: (sourceId: string) => Promise<InputSheet>;
  saveInput: (payload: Record<string, string | number | boolean | null>) => Promise<InputSheet>;
  requestReview: (recordId: string, departmentId: string, requestId: string) => Promise<unknown>;
};

/** Resumable steps using canonical server IDs. Partial completion is reported, never disguised as an atomic save. */
export async function importSharedSor(
  data: ParsedSorResult,
  run: SorImportRun,
  salesDepartmentId: string,
  departmentIds: Record<string, string>,
  parameterIds: ReadonlySet<string>,
  ports: Ports,
): Promise<string> {
  if (!data.projectTitle.trim()) throw new Error("Enter an opportunity title.");
  if (!salesDepartmentId) throw new Error("Sales department is unavailable.");
  if (!data.feasibilityDepartments.length || data.feasibilityDepartments.some(code => !departmentIds[code])) throw new Error("Select valid review departments.");
  if (JSON.stringify(data) !== run.signature) throw new Error("This import has already started with different values. Restore those values to resume, or close and start a separate import.");
  try {
    const reference = `HLPL-GEN-SAL-OPP-${run.recordRequest.replace(/-/g, "").toUpperCase()}-01`;
    const created = await ports.createRecord({
      department_id: salesDepartmentId, project_id: null, record_type: "Opportunity", reference,
      title: data.projectTitle, notes: data.scopeSummary,
      fields: { revision: "01", customer: data.customerName, customerCode: data.customerCode,
        contactPerson: data.spocName, email: data.spocEmail, quantity: data.targetVolume,
        targetDate: data.targetClosureDate, projectTrack: data.projectTrack,
        requiredDepartments: data.feasibilityDepartments.join(","), sourceText: data.rawSnippet || "" },
    }, run.recordRequest);
    if (!created.id) throw new Error("No canonical opportunity ID was returned.");
    run.recordId = created.id;
    let sheet = await ports.createSheet(created.id);
    for (const [id, input] of Object.entries(data.parameterValues)) {
      if (!parameterIds.has(id) || !input.trim()) continue;
      const existing = sheet.parameter_values[id];
      if (existing?.input === input) continue;
      if (sheet.status !== "Draft" || existing?.input?.trim() || existing?.finalValue?.trim()) throw new Error(`Existing ${id} requires review; it was preserved.`);
      sheet = await ports.saveInput({ sheetId: sheet.id, expectedVersion: sheet.version, parameterId: id,
        input, source: `${reference} / SOR import`, finalValue: "", required: existing?.required !== false,
        exclusionReason: existing?.exclusionReason || "" });
    }
    for (const code of new Set(data.feasibilityDepartments)) {
      const requestId = run.approvalRequests[code] ||= crypto.randomUUID();
      await ports.requestReview(created.id, departmentIds[code]!, requestId);
    }
    return created.id;
  } catch (e) {
    throw new Error(`${run.recordId ? "Opportunity is saved; remaining input/review steps are incomplete. Retry this unchanged import to resume. " : "Import was not confirmed; retry with the same values. "}${e instanceof Error ? e.message : "Save failed."}`);
  }
}
