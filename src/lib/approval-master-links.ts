export type ApprovalProjectOption = { id?: string | undefined; reference: string; title: string };

const projectLinkKeys = [
  "projectId",
  "project_id",
  "linkedProjectId",
  "projectCode",
  "project_code",
  "projectReference",
  "project",
] as const;

/** Resolve only exact IDs/references; never infer a project from a title or partial match. */
export function resolveApprovalProjectFromRecord(
  fields: Record<string, string> | undefined,
  projects: readonly ApprovalProjectOption[],
): ApprovalProjectOption | undefined {
  if (!fields) return undefined;
  const links = projectLinkKeys
    .map(key => fields[key]?.trim() || "")
    .filter(Boolean);
  let resolved: ApprovalProjectOption | undefined;
  for (const link of links) {
    const matches = projects.filter(project => project.id === link || project.reference === link);
    if (matches.length !== 1) return undefined;
    const match = matches[0]!;
    if (resolved && (resolved.id || resolved.reference) !== (match.id || match.reference)) return undefined;
    resolved = match;
  }
  return resolved;
}

export function validateApprovalProjectLink(
  fields: Record<string, string>,
  selectedProject: string,
  projects: readonly ApprovalProjectOption[],
): string {
  const hasLink = projectLinkKeys.some(key => fields[key]?.trim());
  const sourceProject = resolveApprovalProjectFromRecord(fields, projects);
  if (hasLink && !sourceProject) throw new Error("The source record has unresolved project links. Review its project before requesting approval.");
  if (!hasLink && selectedProject) throw new Error("The selected project is not linked to this source record.");
  const selected = selectedProject
    ? projects.filter(project => project.id === selectedProject || project.reference === selectedProject)
    : [];
  if (selectedProject && selected.length !== 1) throw new Error("Select a current project from the project register.");
  if (sourceProject && selected[0] !== sourceProject) throw new Error("The approval project must match the source record's project.");
  return selected[0]?.reference || "";
}
