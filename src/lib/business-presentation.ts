import type { BusinessItem } from "./business-workspace.functions";

/** Presentation only: rows have already been authorized by the server. */
export function personalAssignments(items: BusinessItem[], memberId: string, section: string) {
  return items.filter(item => {
    if (item.kind !== "assignment" || item.ownerId !== memberId) return false;
    const template = items.find(candidate => candidate.id === item.data["templateId"] && candidate.kind === "template");
    const type = template?.data["type"];
    return section === "form" ? type === "form" || type === "survey" : type === section;
  });
}

export function budgetSummaries(items: BusinessItem[]) {
  const totals = new Map<string, { currency: string; allocated: number; committed: number; spent: number; available: number }>();
  for (const item of items.filter(item => item.kind === "allocation")) {
    const currency = typeof item.data["currency"] === "string" ? item.data["currency"] : "Unspecified currency";
    const row = totals.get(currency) ?? { currency, allocated: 0, committed: 0, spent: 0, available: 0 };
    const amount = (key: string) => typeof item.data[key] === "number" && Number.isFinite(item.data[key]) ? item.data[key] as number : 0;
    row.allocated += amount("allocatedAmount");
    row.committed += amount("committedAmount");
    row.spent += amount("spentAmount");
    row.available = row.allocated - row.committed - row.spent;
    totals.set(currency, row);
  }
  return [...totals.values()];
}
