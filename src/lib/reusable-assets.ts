export type ReusableAssetRevision = {
  id: string;
  familyId: string;
  revision: number;
  title: string;
  kind: "PCB" | "Harness" | "Enclosure / CAD" | "Firmware / Library" | "Document";
  originProject: string;
  originStage: string;
  documentId: string;
  documentRevision: string;
  inventoryItemId: string;
  compatibility: string;
  parentRevisionId: string;
  status: "Draft";
  createdAt: string;
  createdBy: string;
};
export type ProjectAssetUse = {
  id: string;
  projectId: string;
  assetRevisionId: string;
  assessment: string;
  createdAt: string;
  createdBy: string;
};
export function validateReusableAsset(
  asset: ReusableAssetRevision,
  context: {
    projects: string[];
    documents: { id: string; revision: string }[];
    inventoryIds: string[];
    assets: ReusableAssetRevision[];
  },
): string[] {
  const errors: string[] = [];
  if (!asset.title.trim() || !asset.compatibility.trim() || !asset.originStage.trim())
    errors.push("Title, source stage and compatibility assessment are required.");
  if (!context.projects.includes(asset.originProject))
    errors.push("Choose an existing source project.");
  if (
    !context.documents.some(
      (d) => d.id === asset.documentId && d.revision === asset.documentRevision,
    )
  )
    errors.push("Choose an available exact document revision.");
  if (asset.inventoryItemId && !context.inventoryIds.includes(asset.inventoryItemId))
    errors.push("Choose an existing inventory item master.");
  if (
    context.assets.some(
      (a) => a.id === asset.id || (a.familyId === asset.familyId && a.revision === asset.revision),
    )
  )
    errors.push("This asset revision already exists.");
  if (asset.parentRevisionId) {
    const parent = context.assets.find((a) => a.id === asset.parentRevisionId);
    if (!parent || parent.familyId !== asset.familyId || asset.revision !== parent.revision + 1)
      errors.push("Derivative must reference the preceding revision of the same asset.");
  }
  return errors;
}
export function linkReusableAsset(
  uses: ProjectAssetUse[],
  input: ProjectAssetUse,
  assets: ReusableAssetRevision[],
  projects: string[],
): ProjectAssetUse[] {
  if (!projects.includes(input.projectId) || !assets.some((a) => a.id === input.assetRevisionId))
    throw Error("Project or asset revision is unavailable.");
  if (!input.assessment.trim())
    throw Error("Record compatibility and intended use before linking.");
  if (
    uses.some((u) => u.projectId === input.projectId && u.assetRevisionId === input.assetRevisionId)
  )
    return uses;
  return [...uses, { ...input }];
}
