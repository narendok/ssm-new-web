import type { SharedInventoryPartMaster } from "./shared-inventory.schema";

export const UNCATEGORIZED_INVENTORY_FILTER = "__ssm_uncategorized__";
export const UNMAPPED_INVENTORY_DEPARTMENT_FILTER = "__ssm_unmapped_department__";

export type SharedInventoryFilterOption = { value: string; label: string };
type FilterablePart = Pick<
  SharedInventoryPartMaster,
  "category" | "departmentViews" | "primaryDepartment" | "reference" | "title" | "mpn"
>;

const normalized = (value: string | null | undefined) => value?.trim() ?? "";

const partDepartments = (part: FilterablePart) =>
  new Set(
    [...(part.departmentViews ?? []), part.primaryDepartment ?? ""]
      .map(normalized)
      .filter(Boolean),
  );

export function sharedInventoryCategoryOptions(
  parts: readonly FilterablePart[],
): SharedInventoryFilterOption[] {
  const categories = Array.from(
    new Set(parts.map(part => normalized(part.category)).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  return [
    ...categories.map(category => ({ value: category, label: category })),
    ...(parts.some(part => !normalized(part.category))
      ? [{ value: UNCATEGORIZED_INVENTORY_FILTER, label: "Uncategorized" }]
      : []),
  ];
}

export function sharedInventoryDepartmentOptions(
  parts: readonly FilterablePart[],
): SharedInventoryFilterOption[] {
  const departments = Array.from(new Set(parts.flatMap(part => [...partDepartments(part)])))
    .sort((a, b) => a.localeCompare(b));
  return [
    ...departments.map(department => ({ value: department, label: department })),
    ...(parts.some(part => partDepartments(part).size === 0)
      ? [{ value: UNMAPPED_INVENTORY_DEPARTMENT_FILTER, label: "Unmapped" }]
      : []),
  ];
}

export function filterSharedInventoryParts<T extends FilterablePart>(
  parts: readonly T[],
  categoryFilter: string,
  departmentFilter: string,
  search: string,
): T[] {
  const query = search.trim().toLocaleLowerCase();
  return parts.filter(part => {
    const category = normalized(part.category);
    const departments = partDepartments(part);
    const matchesCategory = categoryFilter === "All"
      || (categoryFilter === UNCATEGORIZED_INVENTORY_FILTER ? !category : category === categoryFilter);
    const matchesDepartment = departmentFilter === "All"
      || (departmentFilter === UNMAPPED_INVENTORY_DEPARTMENT_FILTER
        ? departments.size === 0
        : departments.has(departmentFilter));
    const matchesSearch = !query || [part.reference, part.title, part.mpn ?? "", part.category ?? ""]
      .some(value => value.toLocaleLowerCase().includes(query));
    return matchesCategory && matchesDepartment && matchesSearch;
  });
}
