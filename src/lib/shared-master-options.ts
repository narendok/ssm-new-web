type MasterRecord = {id:string;record_type:string;reference:string;title:string;status:string;fields:Record<string,unknown>};
const inactiveMasterStatuses = new Set(["archived", "obsolete", "rejected", "inactive", "cancelled", "canceled", "retired", "disabled"]);
export function isSelectableMasterStatus(status: string): boolean {
 return !inactiveMasterStatuses.has(status.trim().toLowerCase());
}
export function sharedMasterOptions(records:MasterRecord[], types:string[]) {
 const allowed=new Set(types.map(t=>t.toLowerCase()));
 return records.filter(r=>allowed.has(r.record_type.toLowerCase()) && isSelectableMasterStatus(r.status)).map(r=>({value:r.id,label:`${r.reference} · ${r.title}${r.fields["mpn"] ? ` · ${r.fields["mpn"]}` : ""}`}));
}

export type SearchableMasterOption = { value: string; label: string };

/** Filter by literal text so a short query never returns fuzzy, unrelated masters. */
export function filterSharedMasterOptions(
 options: SearchableMasterOption[],
 query: string,
): SearchableMasterOption[] {
 const normalizedQuery = query.trim().toLocaleLowerCase();
 if (!normalizedQuery) return options;
 return options.filter(option =>
  `${option.label} ${option.value}`.toLocaleLowerCase().includes(normalizedQuery),
 );
}

export type CanonicalSupplierOption = {id:string;reference:string;title:string;status:string};
/** Merge the current expense-catalogue supplier list with the periodically refreshed business snapshot by canonical ID. */
export function mergeCanonicalSupplierOptions(
 catalogue: CanonicalSupplierOption[] = [],
 business: CanonicalSupplierOption[] = [],
): CanonicalSupplierOption[] {
 const unique = new Map<string, CanonicalSupplierOption>();
 for (const supplier of [...catalogue, ...business]) {
  if (!isSelectableMasterStatus(supplier.status)) continue;
  if (!unique.has(supplier.id)) unique.set(supplier.id, supplier);
 }
 return [...unique.values()].sort((a, b) => a.reference.localeCompare(b.reference));
}
