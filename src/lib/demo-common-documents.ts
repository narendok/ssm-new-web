export type DemoCommonDocumentDepartment = {
  id: string;
  name: string;
  code: string;
  active: boolean;
};

export type DemoCommonDocument = {
  id: string;
  title: string;
  url: string;
  type: string;
  departmentId: string;
  group: string;
  part: string;
  revision: string;
  phase: string;
  lifecycle: "Draft";
  classification: string;
  linkedRecordRefs: string[];
  effectiveDate: string;
  approver: string;
  history: string[];
  uploadScope: "common";
  deliverableKind: "Technical document";
};

const commonPackByCode: Record<string, string> = {
  SAL: "Enquiry intake and opportunity handling work instruction",
  EHW: "Hardware design review and ECAD revision-control work instruction",
  FW: "Firmware branch, build, and release-control work instruction",
  SW: "Software change, security, and API review work instruction",
  MECH: "CAD revision, fit-check, and drawing-control work instruction",
  PUR: "Supplier qualification and purchase-request work instruction",
  QA: "Quality planning, DVP&R, and nonconformance work instruction",
  EMF: "Electronics assembly, ESD, and traveler-control work instruction",
  MMF: "Mechanical fabrication, tooling, and fit-check work instruction",
  TST: "Test-fixture calibration and end-of-line evidence work instruction",
  FIN: "Budget, expense, and commercial-review work instruction",
  SIT: "Service ticket, access, and backup-review work instruction",
  HROPS: "Competency, training, and workplace-safety work instruction",
};

/** One non-effective, metadata-only common-document index per active demo department. */
export function demoDepartmentCommonDocuments(
  departments: DemoCommonDocumentDepartment[],
): DemoCommonDocument[] {
  return departments
    .filter((department) => department.active)
    .map((department) => {
      const code = department.code.replace(/^DEMO-/, "").toUpperCase();
      return {
        id: `demo-common-${code.toLowerCase()}`,
        title: `TEST SAMPLE · ${commonPackByCode[code] ?? `${department.name} common operating pack`}`,
        url: "",
        type: "D01 common-document draft index",
        departmentId: department.id,
        group: "01_Governance_and_QMS",
        part: `D01-${code}`,
        revision: "D0 · TEST",
        phase: "Department common · not project-linked",
        lifecycle: "Draft",
        classification: "Internal · synthetic TEST sample · not effective",
        linkedRecordRefs: [],
        effectiveDate: "Not effective · no original file attached",
        approver: "Department review required",
        history: ["Synthetic browser-local TEST index only; no approved policy or original file is represented."],
        uploadScope: "common",
        deliverableKind: "Technical document",
      };
    });
}

export function mergeDemoDepartmentCommonDocuments<T extends { id: string }>(
  existing: T[],
  departments: DemoCommonDocumentDepartment[],
): Array<T | DemoCommonDocument> {
  const ids = new Set(existing.map((document) => document.id));
  return [
    ...existing,
    ...demoDepartmentCommonDocuments(departments).filter((document) => !ids.has(document.id)),
  ];
}
