export function procurementTrack(type: string): string | undefined {
  return type === "Rapid prototype request" ? "Rapid prototype" : type === "Mass production request" ? "Mass production" : undefined;
}
type RevisionRecord = {reference: string; fields: Record<string, unknown>};
function family(reference: string) { return reference.trim().replace(/-\d{2,}$/, ""); }
export function revisionOptions(reference: string, records: RevisionRecord[], current?: string): {value:string;label:string}[] {
  const revisions = reference.trim() ? records.filter(record => family(record.reference) === family(reference)).map(record => String(record.fields["revision"] || "")).filter(value => /^\d+$/.test(value)).map(Number) : [];
  const next = String(Math.max(0,...revisions) + 1).padStart(2,"0");
  return current ? [{value:current,label:`${current} · Current`},...(next !== current ? [{value:next,label:`${next} · Next revision`}] : [])] : [{value:next,label:revisions.length ? `${next} · Next revision` : `${next} · Initial revision`}];
}
export function referenceAtRevision(reference: string, revision: string): string {
  return /-\d{2,}$/.test(reference) ? reference.replace(/-\d{2,}$/,`-${revision}`) : reference;
}
export function sharedSupplierOptions(records: {id:string;title:string;reference:string;record_type:string;status:string}[]) {
  return records.filter(record => record.record_type.toLowerCase() === "supplier" && !["archived","obsolete","rejected"].includes(record.status.toLowerCase())).map(record => ({value:record.id,label:`${record.reference} · ${record.title}`}));
}
