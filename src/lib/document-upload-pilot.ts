// Browser-local pilot only. This model never grants cloud access or approval.
import { projectLifecycleContext } from "./lifecycle-record-presentation";
export const UPLOAD_TYPES = [
  { id: "SCH", label: "Schematic", extensions: ["pdf", "zip", "schdoc", "kicad_sch"] },
  { id: "PCB", label: "PCB layout", extensions: ["pdf", "zip", "pcbdoc", "kicad_pcb"] },
  { id: "BOM", label: "BOM / parts list", extensions: ["csv", "xlsx", "xls", "pdf"] },
  { id: "GER", label: "Gerber ZIP", extensions: ["zip"] },
  { id: "PANEL", label: "Panel Gerber ZIP", extensions: ["zip"] },
  {
    id: "STENCIL",
    label: "Stencil fabrication files",
    extensions: ["zip", "gbr", "ger", "gtp", "gbp", "dxf", "pdf"],
  },
  { id: "DRAWING", label: "Mechanical drawing", extensions: ["pdf", "dwg", "dxf", "zip"] },
  { id: "STEP", label: "Mechanical STEP model", extensions: ["step", "stp", "zip"] },
  { id: "STL", label: "Prototype STL", extensions: ["stl", "zip"] },
  { id: "DXF", label: "Prototype DXF", extensions: ["dxf", "zip"] },
  { id: "CERT", label: "External certificate / report", extensions: ["pdf", "zip"] },
  {
    id: "FILE",
    label: "Other original document",
    extensions: [
      "pdf",
      "docx",
      "xlsx",
      "ppt",
      "pptx",
      "jpg",
      "jpeg",
      "png",
      "zip",
      "hex",
      "bin",
      "json",
      "csv",
      "txt",
    ],
  },
] as const;
export type UploadType = (typeof UPLOAD_TYPES)[number]["id"];
export type UploadScope = "common" | "internal" | "client" | "department";
export type UploadProject = {
  id: string;
  reference: string;
  title: string;
  archived?: boolean | undefined;
  fields?: Record<string, string> | undefined;
};
export type UploadDepartment = { id: string; code: string; name: string; active: boolean };
export type SourcePackage = {
  documentId: string;
  projectId: string;
  revision: string;
  checksum: string;
};
export type UploadMetadata = {
  title: string;
  type: UploadType;
  scope: UploadScope;
  projectId: string;
  departmentId: string;
  revision: string;
  sourceDocumentId: string;
};
export type UploadDocument = {
  id: string;
  title: string;
  type: string;
  revision?: string | undefined;
  uploadType?: string | undefined;
  projectId?: string | undefined;
  linkedRecordRefs?: string[] | undefined;
  localFiles?: { revision: string; checksum?: string | undefined }[] | undefined;
};
export function eligibleUploadDepartments(
  departments: UploadDepartment[],
  actor: { kind: string; departmentId?: string | undefined },
): UploadDepartment[] {
  return departments.filter(
    (department) =>
      department.active &&
      (actor.kind === "admin" || department.id === actor.departmentId),
  );
}
export function assertUploadContextCurrent(
  draft: {
    departmentId?: string | undefined;
    projectId?: string | undefined;
    sourcePackage?: SourcePackage | undefined;
  },
  projects: UploadProject[],
  departments: UploadDepartment[],
  packages: SourcePackage[],
) {
  if (!departments.some((d) => d.active && d.id === draft.departmentId))
    throw new Error("The owning department is no longer active. Reopen the upload form.");
  if (draft.projectId && !projects.some((p) => p.id === draft.projectId && !p.archived))
    throw new Error("The project changed or was archived. Reopen the upload form.");
  const source = draft.sourcePackage;
  if (
    source &&
    !packages.some(
      (p) =>
        p.documentId === source.documentId &&
        p.projectId === source.projectId &&
        p.revision === source.revision &&
        p.checksum === source.checksum,
    )
  )
    throw new Error("The source Gerber revision changed. Reopen the upload form.");
}
export function sourceGerberPackages(
  documents: UploadDocument[],
  project: UploadProject | undefined,
): SourcePackage[] {
  if (!project) return [];
  return documents.flatMap((doc) => {
    if (doc.uploadType !== "GER" || doc.projectId !== project.id || !doc.revision) return [];
    const file = doc.localFiles?.find(
      (item) => item.revision === doc.revision && /^[a-f0-9]{64}$/i.test(item.checksum ?? ""),
    );
    return file?.checksum
      ? [
          {
            documentId: doc.id,
            projectId: project.id,
            revision: doc.revision,
            checksum: file.checksum,
          },
        ]
      : [];
  });
}
export function prepareUploadDraft(input: {
  metadata: UploadMetadata;
  file: { name: string; size: number; type: string };
  projects: UploadProject[];
  departments: UploadDepartment[];
  sourcePackages: SourcePackage[];
  actor: { id: string; kind: string; name: string; departmentId?: string | undefined };
  documentId: string;
  fileId: string;
  checksum: string;
  timestamp: string;
}) {
  const { metadata: m, actor, file } = input;
  if (!actor.id || !actor.name || !["admin", "lead", "member"].includes(actor.kind))
    throw new Error("An internal author is required.");
  const department = input.departments.find((d) => d.active && d.id === m.departmentId);
  if (!department || (actor.kind !== "admin" && actor.departmentId !== department.id))
    throw new Error("Choose your authorized owning department.");
  if (!["common", "internal", "client", "department"].includes(m.scope))
    throw new Error("Choose a document scope.");
  const isProject = m.scope === "internal" || m.scope === "client";
  const project = isProject
    ? input.projects.find((p) => p.id === m.projectId && !p.archived)
    : undefined;
  if (isProject && !project) throw new Error("Select an existing active project.");
  if (!isProject && m.projectId)
    throw new Error("Common and department documents must not carry a project selection.");
  const type = UPLOAD_TYPES.find((t) => t.id === m.type);
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!type || !(type.extensions as readonly string[]).includes(extension))
    throw new Error("This file extension does not match the selected document type.");
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > 25 * 1024 * 1024)
    throw new Error("Choose a non-empty file up to 25 MB for this pilot.");
  if (
    !m.title.trim() ||
    m.title.length > 180 ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(m.revision)
  )
    throw new Error(
      "Enter a title and valid revision (letters, numbers, dot, underscore or dash).",
    );
  if (!/^[a-f0-9]{64}$/i.test(input.checksum))
    throw new Error("The original file needs a SHA-256 checksum.");
  const needsSource = m.type === "PANEL" || m.type === "STENCIL";
  const source = needsSource
    ? input.sourcePackages.find(
        (s) =>
          s.documentId === m.sourceDocumentId &&
          s.projectId === project?.id &&
          /^[a-f0-9]{64}$/i.test(s.checksum),
      )
    : undefined;
  if (needsSource && !source)
    throw new Error(
      "Select a Gerber package for this project before adding panel or stencil files.",
    );
  if (!needsSource && m.sourceDocumentId)
    throw new Error("A source Gerber link applies only to panel and stencil packages.");
  const scopeCodes = {
    common: "COMMON",
    internal: "INTERNAL",
    client: "CLIENT",
    department: "DEPT",
  };
  const projectCode = project?.reference ?? scopeCodes[m.scope];
  const lifecycleContext = project ? projectLifecycleContext(project.fields ?? {}) : {};
  const prefix = projectCode.startsWith("HLPL-") ? projectCode : `HLPL-${projectCode}`;
  const group = {
    common: "01 Common documents",
    internal: "02 Internal projects",
    client: "03 Client projects",
    department: "04 Other department work",
  }[m.scope];
  return {
    id: input.documentId,
    title: m.title.trim(),
    url: "",
    type: type.label,
    departmentId: department.id,
    revision: m.revision,
    lifecycle: "Draft" as const,
    classification: "Internal",
    group,
    device: project?.title ?? "",
    part: `${prefix}-${department.code}-${type.id}-${m.revision}`,
    linkedRecordRefs: project ? [project.reference] : [],
    projectId: project?.id,
    ...(lifecycleContext.phase ? { phase: lifecycleContext.phase } : {}),
    ...(lifecycleContext.stage ? { lifecycleStage: lifecycleContext.stage } : {}),
    uploadType: type.id,
    uploadScope: m.scope,
    sourcePackage: source ? { ...source } : undefined,
    localFiles: [
      {
        id: input.fileId,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        uploadedAt: input.timestamp,
        uploader: actor.name,
        revision: m.revision,
        storage: "indexeddb" as const,
        checksum: input.checksum,
      },
    ],
    history: [
      `${input.timestamp} · Browser-local draft uploaded by ${actor.name}; no approval or client release`,
    ],
  };
}
