import type { EnquiryOpportunity } from "../components/SalesWorkspaceAndCustomerRegister";

type IntakeRecord = {
  id: string;
  reference: string;
  type: string;
  title: string;
  notes?: string;
  fields: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
};

/** Sales intake can precede a project. Later operational records still require one. */
export const isPreProjectIntake = (type: string): boolean =>
  ["Enquiry", "Opportunity", "Enquiry & Opportunity", "Lead intake"].includes(type);

export function suggestIntakeReference(
  records: Pick<IntakeRecord, "reference">[],
  type: string,
): string {
  const prefix = type === "Opportunity" ? "HLPL-SAL-OPP" : "HLPL-SAL-ENQ";
  const used = new Set(records.map((record) => record.reference.toUpperCase()));
  let next = 1;
  while (used.has(`${prefix}-${String(next).padStart(4, "0")}`)) next++;
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

export function validateIntakeProject(
  records: Pick<IntakeRecord, "id" | "reference" | "type" | "archived">[],
  type: string,
  projectId: string,
): string {
  const code = projectId.trim();
  if (type === "Project") {
    if (!/^HLPL-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(code))
      throw new Error("Enter a unique project code, for example HLPL-OBDTEST-01.");
    if (records.some((record) => record.reference.toUpperCase() === code))
      throw new Error("This project code already exists, including archived records.");
    return code;
  }
  if (!code && isPreProjectIntake(type)) return "";
  if (
    !code ||
    !records.some(
      (record) =>
        record.type === "Project" &&
        !record.archived &&
        [record.id, record.reference].includes(code),
    )
  ) {
    throw new Error("Select an existing project, or create a project first.");
  }
  return code;
}

export function salesEnquiryFromRecord(
  record: IntakeRecord,
  customers: { code: string; name: string; spocName: string; spocEmail: string }[],
): EnquiryOpportunity {
  const customer = customers.find((item) => item.name === record.fields["customer"]);
  return {
    id: record.id,
    reference: record.reference,
    kind: record.type === "Opportunity" ? "opportunity" : "enquiry",
    title: record.title,
    customerCode: customer?.code ?? "",
    customerName: customer?.name ?? record.fields["customer"] ?? "Not recorded",
    spocName: customer?.spocName ?? "",
    spocEmail: customer?.spocEmail ?? "",
    scopeSummary: record.fields["scope"] ?? "",
    targetVolume: record.fields["targetVolume"] ?? record.fields["quantity"] ?? "Not recorded",
    targetClosureDate: record.fields["targetDate"] ?? "",
    salesOwner: record.fields["owner"] ?? "Not assigned",
    status: "Pending Enquiry",
    feasibilitySignedDepts: [],
    totalFeasibilityDepts: 0,
    linkedProjectCode: record.fields["projectId"] ?? "",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/** Repair the derived Sales projection from its source intake record without replacing explicit Sales edits. */
export function reconcileSalesEnquiries(
  enquiries: EnquiryOpportunity[],
  records: IntakeRecord[],
): EnquiryOpportunity[] {
  return enquiries.flatMap((enquiry) => {
    const source = records.find((record) => record.id === enquiry.id);
    if (source?.archived) return [];
    const fields = source?.fields ?? {};
    return [{
      ...enquiry,
      targetVolume:
        enquiry.targetVolume && enquiry.targetVolume !== "Not recorded"
          ? enquiry.targetVolume
          : fields["targetVolume"] || fields["quantity"] || enquiry.targetVolume || "Not recorded",
      targetClosureDate:
        enquiry.targetClosureDate || fields["targetDate"] || "",
      scopeSummary:
        enquiry.scopeSummary || source?.notes || fields["scope"] || "",
    }];
  });
}

type LinkedIntakeRecord = {
  id: string;
  reference: string;
  type: string;
  fields: Record<string, string>;
  archived?: boolean;
};
/** Feasibility is owned by the inquiry until a real project exists. No sample code is substituted. */
export function feasibilityIntakeContext(
  records: LinkedIntakeRecord[],
  enquiry: { id: string; reference: string; linkedProjectCode?: string | undefined },
) {
  if (enquiry.linkedProjectCode)
    validateIntakeProject(records, "Enquiry", enquiry.linkedProjectCode);
  return {
    contractReference: `${enquiry.reference}-CONTRACT-01`,
    projectCode: enquiry.linkedProjectCode ?? "",
  };
}
/** Parent must authorize the actor. Change relationship metadata only; retain IDs, review outcomes and evidence. */
export function linkIntakeProject<
  R extends LinkedIntakeRecord,
  E extends { id: string; linkedProjectCode?: string | undefined },
  A extends { recordId: string; project?: string | undefined },
>(records: R[], enquiries: E[], approvals: A[], sourceId: string, projectCode: string) {
  const source = records.find((record) => record.id === sourceId && !record.archived);
  if (!source || !isPreProjectIntake(source.type)) throw new Error("Active inquiry not found.");
  validateIntakeProject(records, source.type, projectCode);
  const contracts = records.filter((record) => record.fields["enquiryId"] === sourceId);
  const previous = source.fields["projectId"] ?? "";
  if (contracts.length && previous && previous !== projectCode)
    throw new Error(
      "A dispatched inquiry already linked to a project requires a reviewed change before moving or unlinking.",
    );
  const contractKeys = new Set(contracts.flatMap((record) => [record.id, record.reference]));
  return {
    records: records.map((record) =>
      record.id === sourceId ||
      record.fields["enquiryId"] === sourceId ||
      (record.type === "Task" &&
        (record.fields["linkedRecords"] ?? "")
          .split(/[,·]/)
          .some((key) => contractKeys.has(key.trim())))
        ? { ...record, fields: { ...record.fields, projectId: projectCode, projectCode } }
        : record,
    ),
    enquiries: enquiries.map((enquiry) =>
      enquiry.id === sourceId ? { ...enquiry, linkedProjectCode: projectCode } : enquiry,
    ),
    approvals: approvals.map((approval) =>
      contractKeys.has(approval.recordId) ? { ...approval, project: projectCode } : approval,
    ),
  };
}
