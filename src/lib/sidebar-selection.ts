// A parent may stay expanded, but exactly one canonical destination is current.
export function singleActiveDestination<
  T extends { id: string; items: { id: string; isActive: boolean }[] },
>(groups: T[]): T[] {
  const selected = groups.flatMap((group) => group.items).find((item) => item.isActive)?.id;
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({ ...item, isActive: item.id === selected })),
  }));
}
export function matchesWorkspaceDocument(
  document: { title: string; type: string },
  filter: string | null | undefined,
): boolean {
  if (!filter) return true;
  const text = `${document.title} ${document.type}`;
  if (filter === "PRS") return /\bprs\b|requirement|technical spec/i.test(text);
  if (filter === "SCHEMATIC") return /schematic|\bbom\b/i.test(text);
  if (filter === "DFMEA") return /dfmea|gerber|pcb layout/i.test(text);
  if (filter === "DVP&R") return /DVP\s*&?\s*R|design verification|verification plan/i.test(text);
  if (filter === "8D CAPA") return /8D|CAPA|non[-\s]?conformance|corrective action/i.test(text);
  return false;
}
