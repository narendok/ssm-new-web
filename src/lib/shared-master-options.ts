type MasterRecord = {id:string;record_type:string;reference:string;title:string;status:string;fields:Record<string,unknown>};
export function sharedMasterOptions(records:MasterRecord[], types:string[]) {
 const allowed=new Set(types.map(t=>t.toLowerCase()));
 return records.filter(r=>allowed.has(r.record_type.toLowerCase()) && !["archived","obsolete"].includes(r.status.toLowerCase())).map(r=>({value:r.id,label:`${r.reference} · ${r.title}${r.fields["mpn"] ? ` · ${r.fields["mpn"]}` : ""}`}));
}
