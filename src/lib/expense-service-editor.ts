import type { ExpenseCatalogue } from "./expense-settings.functions";

type ServiceOption = ExpenseCatalogue["services"][number];
type ServiceLine = Pick<ServiceOption, "name" | "category" | "provider" | "cycle" | "owner">;

const normalizedName = (value: string) => value.trim().toLocaleLowerCase();
const idFromName = (name: string) => name
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 80);

export function parseExpenseServices(value: string, existingServices: ServiceOption[] = []): ServiceOption[] {
  const rows: ServiceLine[] = value
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const parts = row.split("|").map((part) => part.trim());
      return {
        name: parts[0] || "",
        category: parts[1] || "",
        provider: parts[2] || "",
        cycle: parts[3] || "Annual",
        owner: parts[4] || "Requesting department lead",
      };
    });

  // Reserve all exact-name matches first so adding or reordering a line cannot
  // steal the stable ID (and canonical Supplier link) from another service.
  const existingByName = new Map<string, ServiceOption[]>();
  for (const service of existingServices) {
    const name = normalizedName(service.name);
    existingByName.set(name, [...(existingByName.get(name) || []), service]);
  }

  const matches = new Map<number, ServiceOption>();
  const reservedIds = new Set<string>();
  const consumedNames = new Map<string, number>();
  for (const [index, row] of rows.entries()) {
    const name = normalizedName(row.name);
    const occurrence = consumedNames.get(name) || 0;
    const match = existingByName.get(name)?.[occurrence];
    consumedNames.set(name, occurrence + 1);
    if (match) {
      matches.set(index, match);
      reservedIds.add(match.id);
    }
  }

  const usedIds = new Set<string>();
  return rows.map((row, index) => {
    const exactMatch = matches.get(index);
    const samePosition = existingServices[index];
    const renamedMatch = !exactMatch && samePosition &&
      !reservedIds.has(samePosition.id) && !usedIds.has(samePosition.id)
      ? samePosition
      : undefined;
    const existing = exactMatch || renamedMatch;
    const id = existing?.id || idFromName(row.name);
    usedIds.add(id);
    return { ...existing, ...row, id };
  });
}
