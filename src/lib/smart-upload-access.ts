import type { RoleCode, RoleUseCaseProfile } from "./document-ingestion-profiles";

/** Reviewed mapping from the 25 upload-role codes to the current 12-department chart. */
const departmentByRole: Partial<Record<RoleCode, string>> = {
  QA: "QA",
  MECH_DES: "MECH",
  MECH_MFG: "MMF",
  SIT: "SIT",
  PUR: "PUR",
  STR: "PUR",
  DSP: "PUR",
  SAL: "SAL",
  EHW: "EHW",
  FW: "FW",
  SW_BE: "SW",
  SW_FE: "SW",
  SW_APP: "SW",
  EMF: "EMF",
  TST: "EMF",
  FIN: "FIN",
  OPS: "HR",
  PM: "HR",
  HR: "HR",
};

const departmentAliases: Record<string, string> = {
  SALES: "SAL",
  HROPS: "HR",
  OPS: "HR",
  STORES: "PUR",
  MECHANICAL: "MECH",
  "MECH MFG": "MMF",
  "MECHANICAL MANUFACTURING": "MMF",
  SOFTWARE: "SW",
  "CLOUD & APPLICATION SOFTWARE": "SW",
};

export function normalizeUploadDepartment(value?: string | null): string {
  const code = (value ?? "").trim().toUpperCase();
  return departmentAliases[code] ?? code;
}

export function uploadProfileDepartment(roleCode: RoleCode | string): string | undefined {
  return departmentByRole[roleCode.toUpperCase() as RoleCode];
}

export function roleProfileAvailableToDepartment(
  profile: Pick<RoleUseCaseProfile, "roleCode">,
  departmentCode: string | null | undefined,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true;
  const expected = uploadProfileDepartment(profile.roleCode);
  return Boolean(expected && normalizeUploadDepartment(departmentCode) === expected);
}

const allDepartmentChoices = ["SAL", "EHW", "FW", "SW", "MECH", "PUR", "QA", "EMF", "MMF", "FIN", "SIT", "HR"];
const engineeringDepartments = ["EHW", "FW", "SW", "MECH", "MMF", "EMF", "QA", "SIT"];
const workflowDepartments: Record<string, readonly string[]> = {
  sor: ["SAL"],
  bom: ["PUR"],
  technical: engineeringDepartments,
  quotation: ["PUR"],
  invoice: ["FIN"],
  receipt: ["PUR"],
  role: allDepartmentChoices,
  other: allDepartmentChoices,
};

export function smartUploadChoiceAvailable(
  choice: string,
  departmentCode: string | null | undefined,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true;
  const allowed = workflowDepartments[choice];
  return Boolean(allowed?.includes(normalizeUploadDepartment(departmentCode)));
}

export function smartUploadChoiceDepartment(
  choice: string,
  currentDepartmentCode?: string | null,
): string | undefined {
  const allowed = workflowDepartments[choice];
  if (!allowed) return undefined;
  if (allowed.length === 1) return allowed[0];
  const current = normalizeUploadDepartment(currentDepartmentCode);
  return allowed.includes(current) ? current : undefined;
}
