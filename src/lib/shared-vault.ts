import type { VaultDocument } from "./shared-vault.functions";
import type { AnalysisRecord } from "./project-analysis-data";

export type VaultDisplayDocument={id:string;title:string;type:string;url:string;cloudDocumentId:string;departmentId?:string|undefined;projectId?:string|undefined;linkedRecordRefs:string[];part:string;revision?:string|undefined;lifecycle:"Draft";classification:string;uploadScope:"common"|"internal"|"client"|"department"};
const text=(value:unknown)=>typeof value==="string"?value:"";
export function vaultProjectId(doc:VaultDocument,records:AnalysisRecord[]):string|undefined {
  const source=records.find(r=>r.id===doc.record_id);
  const key=text(doc.metadata["projectId"]) || (source?.type==="Project"?source.id:source?.fields["projectId"] || source?.fields["projectCode"]);
  return records.find(r=>r.type==="Project"&&(r.id===key||r.reference===key))?.id;
}
export function vaultDisplayDocuments(documents:VaultDocument[],records:AnalysisRecord[]):VaultDisplayDocument[]{
  return documents.map(doc=>{
    const projectId=vaultProjectId(doc,records),scope=text(doc.metadata["scope"]);
    return {id:doc.id,title:doc.title,type:doc.document_type,url:"",cloudDocumentId:doc.id,departmentId:doc.department_id||undefined,projectId,
      linkedRecordRefs:[doc.record_id,projectId].filter((id):id is string=>!!id),part:text(doc.metadata["reference"]),revision:text(doc.metadata["revision"])||undefined,
      lifecycle:"Draft",classification:"Internal",uploadScope:(["common","internal","client","department"].includes(scope)?scope:"department") as VaultDisplayDocument["uploadScope"]};
  });
}
export function attachmentRevisionOptions(files:{revision:string}[]):string[]{
  const existing=[...new Set(files.map(f=>f.revision).filter(v=>/^\d+$/.test(v)))];
  const next=String(Math.max(0,...existing.map(Number))+1).padStart(2,"0");
  return [...existing.sort((a,b)=>Number(a)-Number(b)),next];
}
