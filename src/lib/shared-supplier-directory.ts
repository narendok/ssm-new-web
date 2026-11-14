import type { SharedTestSnapshot } from "./shared-test.schema";

/** Enrich canonical selector entries with authorized detail records, never demo data. */
export function sharedSupplierDirectory(snapshot: SharedTestSnapshot) {
  const records = snapshot.records.filter((record) => record.record_type === "Supplier");
  const byId = new Map(records.map((record) => [record.id, record]));
  const options = new Map(snapshot.supplierOptions.map((option) => [option.id, option]));
  for (const record of records) options.set(record.id, record);
  return [...options.values()]
    .map((option) => {
      const record = byId.get(option.id);
      return {
        id: option.id,
        reference: option.reference,
        title: option.title,
        status: option.status,
        fields: record?.fields ?? {},
        notes: record?.notes ?? "",
        documents: snapshot.documents.filter((document) => document.record_id === option.id),
        hasDetails: !!record,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}
