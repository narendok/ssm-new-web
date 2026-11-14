export type SharedProjectScopeOption = {
  id: string;
  reference: string;
};

/** Keep a persisted workspace selection only while it still resolves to a selectable project. */
export function resolveSharedProjectScope(
  scope: string,
  projects: readonly SharedProjectScopeOption[],
): string {
  if (scope === "all") return scope;
  return projects.some((project) => project.id === scope || project.reference === scope)
    ? scope
    : "all";
}
