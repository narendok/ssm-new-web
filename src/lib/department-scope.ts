/** Canonical department codes used by the browser-local portal. Backend RLS remains authoritative. */
export function departmentCode(value?: string | null): string {
  const code = (value ?? "").trim().toUpperCase();
  return (
    {
      SALES: "SAL",
      HROPS: "HR",
      "HR/OPS": "HR",
      OPS: "HR",
      PRODUCTION: "EMF",
      QUALITY: "QA",
      STORES: "PUR",
      EFW: "FW",
      FW: "FW",
      FIRMWARE: "FW",
      "EMBEDDED FIRMWARE": "FW",
      CSW: "SW",
      SW: "SW",
      SOFTWARE: "SW",
      "CLOUD SOFTWARE": "SW",
      "CLOUD & APPLICATION SOFTWARE": "SW",
      MMF: "MMF",
      "MECHANICAL MANUFACTURING": "MMF",
      "MECH MFG": "MMF",
    } as Record<string, string>
  )[code] ?? code;
}

export function approvalInDepartment(
  approval: { department?: string | undefined; approverAuthority?: string | undefined },
  department?: string,
): boolean {
  const code = departmentCode(department);
  return Boolean(code && (departmentCode(approval.department) === code || departmentCode(approval.approverAuthority) === code));
}

export function canDepartmentSign(approval: { department?: string | undefined; approverAuthority?: string | undefined }, department?: string): boolean {
  const code = departmentCode(department);
  const authority = departmentCode(approval.approverAuthority);
  return Boolean(code && authority && authority !== "ADMIN" && authority === code);
}

/** Compatibility for the three identified legacy DEMO records only. Never infer authority for real records. */
export function approvalScope<T extends { id: string; department?: string | undefined; approverAuthority?: string | undefined }>(approval: T): T {
  const legacy: Record<string, { department: string; approverAuthority: string }> = {
    "demo-approval-quality-release": { department: "QA", approverAuthority: "Admin" },
    "demo-approval-ecn-002": { department: "EHW", approverAuthority: "QA" },
    "demo-approval-fin-advance": { department: "FIN", approverAuthority: "Admin" },
  };
  const defaults = legacy[approval.id];
  return defaults ? { ...defaults, ...approval, department: approval.department ?? defaults.department, approverAuthority: approval.approverAuthority ?? defaults.approverAuthority } : approval;
}

type ProjectLinkedRecord = {
  id: string;
  reference: string;
  type: string;
  fields: Record<string, unknown>;
};

const fieldText = (fields: Record<string, unknown>, key: string) =>
  typeof fields[key] === "string" ? fields[key].trim() : "";

export function projectReferences(record: ProjectLinkedRecord): string[] {
  const explicit = ["project_id", "projectId", "project_code", "projectCode", "linkedProjectId", "projectReference"]
    .map((key) => fieldText(record.fields, key))
    .filter(Boolean);
  const links = ["project", "linkedRecords"]
    .map((key) => fieldText(record.fields, key))
    .flatMap(value => value.split(/[,·]/).map(part => part.trim()).filter(Boolean));
  if (record.type === "Project") explicit.push(record.reference);
  return [...new Set([...explicit, ...links, ...links.flatMap(value => value.match(/\bHLPL-[A-Z0-9]+-\d+\b/g) ?? [])])];
}

export function taskProjectId(
  task: { recordId: string | null; projectId?: string | null },
  records: ProjectLinkedRecord[],
): string | null {
  const projects = records.filter((record) => record.type === "Project");
  for (const link of [task.projectId, task.recordId]) {
    if (!link) continue;
    const directProject = projects.find((project) => project.id === link || project.reference === link);
    if (directProject) return directProject.id;
  }
  const linkedRecord = records.find((record) => record.id === task.recordId);
  if (!linkedRecord) return null;
  const references = projectReferences(linkedRecord);
  return projects.find((project) => references.includes(project.id) || references.includes(project.reference))?.id ?? null;
}
