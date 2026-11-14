import type { SharedTestSnapshot } from "./shared-test.schema.ts";
import type { SharedJson } from "./shared-test.schema.ts";

type MasterOption = {
  id: string;
  reference: string;
  title: string;
  status: string;
  mpn?: string | null | undefined;
};
type LinkedRecord = SharedTestSnapshot["records"][number];
type SharedMasterSnapshot = Pick<
  SharedTestSnapshot,
  "customerOptions" | "supplierOptions" | "partOptions" | "productOptions" | "projectOptions" | "records"
>;

function text(value: SharedJson | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionById(options: MasterOption[], id: string): MasterOption | undefined {
  return id ? options.find(option => option.id === id) : undefined;
}

function optionByAliases(options: MasterOption[], ids: string[], references: string[]): MasterOption | undefined {
  const suppliedIds = [...new Set(ids.filter(Boolean))];
  if (suppliedIds.length) {
    let resolved: MasterOption | undefined;
    for (const id of suppliedIds) {
      const matches = options.filter(option => option.id === id || option.reference === id);
      if (matches.length !== 1) return undefined;
      const match = matches[0]!;
      if (resolved && resolved.id !== match.id) return undefined;
      resolved = match;
    }
    return resolved;
  }

  const suppliedReferences = [...new Set(references.filter(Boolean))];
  const referenceMatches = options.filter(option => suppliedReferences.includes(option.reference));
  return referenceMatches.length === 1 ? referenceMatches[0] : undefined;
}

/** Resolve canonical IDs and display labels from IDs or exact unique master references only. */
export function resolveSharedMasterFields<T extends Record<string, SharedJson>>(
  sourceFields: T,
  snapshot: SharedMasterSnapshot,
): T {
  const fields: Record<string, SharedJson> = { ...sourceFields };
  // Project options may include archived, display-only masters. The regular
  // record list remains the source for selectable active projects.
  const projectsById = new Map<string, MasterOption>();
  for (const project of snapshot.records.filter(record => record.record_type === "Project")) {
    projectsById.set(project.id, project);
  }
  for (const project of snapshot.projectOptions ?? []) {
    if (!projectsById.has(project.id)) projectsById.set(project.id, project);
  }
  const projects = [...projectsById.values()];
  const customer = optionByAliases(
    snapshot.customerOptions,
    [text(fields["customerId"]), text(fields["customer_id"])],
    [text(fields["customerCode"]), text(fields["customer_code"]), text(fields["customer"])],
  );
  if (customer) {
    fields["customerId"] = customer.id;
    fields["customer_id"] = customer.id;
    fields["customer"] = customer.title;
    fields["customerName"] = customer.title;
    fields["customer_name"] = customer.title;
    fields["customerCode"] = customer.reference;
    fields["customer_code"] = customer.reference;
  }

  const supplier = optionByAliases(
    snapshot.supplierOptions,
    [text(fields["supplierId"]), text(fields["supplier_id"])],
    [text(fields["supplierCode"]), text(fields["supplier_code"]), text(fields["supplier"])],
  );
  if (supplier) {
    fields["supplierId"] = supplier.id;
    fields["supplier_id"] = supplier.id;
    fields["supplier"] = supplier.title;
    fields["supplierName"] = supplier.title;
    fields["supplier_name"] = supplier.title;
    fields["supplierCode"] = supplier.reference;
    fields["supplier_code"] = supplier.reference;
  }

  const part = optionByAliases(
    snapshot.partOptions,
    [text(fields["partId"]), text(fields["part_id"])],
    [text(fields["partCode"]), text(fields["part_code"]), text(fields["part"])],
  );
  if (part) {
    fields["partId"] = part.id;
    fields["part_id"] = part.id;
    fields["part"] = part.title;
    fields["partCode"] = part.reference;
    fields["mpn"] = part.mpn ?? "";
  }

  const product = optionByAliases(
    snapshot.productOptions,
    [text(fields["productId"]), text(fields["product_id"])],
    [text(fields["productCode"]), text(fields["product_code"]), text(fields["product"])],
  );
  if (product) {
    fields["productId"] = product.id;
    fields["product_id"] = product.id;
    fields["product"] = product.title;
    fields["productCode"] = product.reference;
  }

  const project = optionByAliases(
    projects,
    [text(fields["projectId"]), text(fields["project_id"]), text(fields["linkedProjectId"])],
    [text(fields["projectId"]), text(fields["project_id"]), text(fields["linkedProjectId"]), text(fields["projectCode"]), text(fields["project_code"]), text(fields["projectReference"]), text(fields["project"])],
  );
  if (project) {
    fields["projectId"] = project.id;
    fields["project_id"] = project.id;
    fields["linkedProjectId"] = project.id;
    fields["projectCode"] = project.reference;
    fields["project_code"] = project.reference;
    fields["projectName"] = project.title;
    fields["project_name"] = project.title;
  }
  return fields as T;
}

/** Refresh returned labels from canonical master rows without mutating persisted records. */
export function resolveSharedMasterSnapshotLabels<T extends SharedMasterSnapshot>(snapshot: T): T {
  const records = snapshot.records.map(record => ({
    ...record,
    fields: resolveSharedMasterFields(record.fields, snapshot),
  }));

  return { ...snapshot, records } as T;
}
