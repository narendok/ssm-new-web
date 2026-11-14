import type { VaultDocument } from "./shared-vault.functions";
import type { AnalysisRecord } from "./project-analysis-data";
import type { PersistedDocumentDraftSnapshot } from "./document-draft";

export type VaultDraftSnapshot=PersistedDocumentDraftSnapshot;
export type VaultDisplayDocument={id:string;title:string;type:string;url:string;cloudDocumentId:string;departmentId?:string|undefined;projectId?:string|undefined;linkedRecordRefs:string[];part:string;revision?:string|undefined;lifecycle:"Draft";classification:string;uploadScope:"common"|"internal"|"client"|"department";autoDraftSnapshot?:VaultDraftSnapshot|undefined};
const text=(value:unknown)=>typeof value==="string"?value:"";
const projectAliasKeys=["projectId","project_id","linkedProjectId","projectCode","project_code","projectReference","project"] as const;
function exactProjectLink(fields:Record<string,string>,projects:AnalysisRecord[]):string|undefined{
  const tokens=[...new Set(projectAliasKeys.map(key=>text(fields[key]).trim()).filter(Boolean))];
  if(!tokens.length)return undefined;
  const matches=tokens.map(token=>projects.filter(project=>project.type==="Project"&&(project.id===token||project.reference===token)));
  if(matches.some(projectsForToken=>projectsForToken.length!==1))return undefined;
  const ids=new Set(matches.map(projectsForToken=>projectsForToken[0]?.id).filter((id):id is string=>Boolean(id)));
  return ids.size===1?[...ids][0]:undefined;
}
export function vaultProjectId(doc:VaultDocument,records:AnalysisRecord[]):string|undefined {
  const source=records.find(r=>r.id===doc.record_id);
  const projects=records.filter(record=>record.type==="Project");
  const metadataProject=text(doc.metadata["projectId"]).trim();
  const metadataMatch=metadataProject?projects.find(project=>project.id===metadataProject||project.reference===metadataProject)?.id:undefined;
  const sourceProject=source?.type==="Project"?source.id:source?exactProjectLink(source.fields,projects):undefined;
  if(metadataProject&&!metadataMatch)return undefined;
  if(source&&sourceProject===undefined)return undefined;
  if(metadataMatch&&sourceProject&&metadataMatch!==sourceProject)return undefined;
  return metadataMatch||sourceProject;
}
/** Only actual non-task records with an unambiguous exact project link can be attached as a document source. */
export function vaultRelatedRecords(records:AnalysisRecord[],projectId:string):AnalysisRecord[]{
  const projects=records.filter(record=>record.type==="Project");
  if(!projects.some(project=>project.id===projectId))return [];
  return records.filter(record=>record.id!==projectId&&record.type!=="Project"&&record.type!=="Task"&&exactProjectLink(record.fields,projects)===projectId);
}
export function vaultDisplayDocuments(documents:VaultDocument[],records:AnalysisRecord[]):VaultDisplayDocument[]{
  return documents.map(doc=>{
    const projectId=vaultProjectId(doc,records),scope=text(doc.metadata["scope"]);
    const candidate=doc.metadata["draftSnapshot"];
    const autoDraftSnapshot=parseVaultDraftSnapshot(candidate);
    return {id:doc.id,title:doc.title,type:doc.document_type,url:"",cloudDocumentId:doc.id,departmentId:doc.department_id||undefined,projectId,autoDraftSnapshot,
      linkedRecordRefs:[doc.record_id,projectId].filter((id):id is string=>!!id),part:text(doc.metadata["reference"]),revision:text(doc.metadata["revision"])||undefined,
      lifecycle:"Draft",classification:"Internal",uploadScope:(["common","internal","client","department"].includes(scope)?scope:"department") as VaultDisplayDocument["uploadScope"]};
  });
}

export function parseVaultDraftSnapshot(value:unknown):VaultDraftSnapshot|undefined{
  if(!value||typeof value!=="object"||Array.isArray(value))return undefined;
  const snapshot=value as Record<string,unknown>;
  const validText=(input:unknown):input is string=>typeof input==="string";
  if(snapshot["releaseStatus"]!=="Unissued"||!validText(snapshot["templateVersion"])||!Array.isArray(snapshot["missingFields"])||!snapshot["missingFields"].every(validText)||!Array.isArray(snapshot["sections"]))return undefined;
  if(!(snapshot["templateType"]===null||validText(snapshot["templateType"]))||!(snapshot["catalogueFamilyId"]===null||validText(snapshot["catalogueFamilyId"])))return undefined;
  if(!(snapshot["sourceRecordId"]===null||validText(snapshot["sourceRecordId"]))||!(snapshot["projectRecordId"]===null||validText(snapshot["projectRecordId"])))return undefined;
  if(typeof snapshot["completionPercentage"]!=="number"||snapshot["completionPercentage"]<0||snapshot["completionPercentage"]>100)return undefined;
  const sections=snapshot["sections"];
  if(!sections.every(section=>!!section&&typeof section==="object"&&!Array.isArray(section)&&validText((section as Record<string,unknown>)["title"])&&Array.isArray((section as Record<string,unknown>)["rows"])&&((section as Record<string,unknown>)["rows"] as unknown[]).every(row=>Array.isArray(row)&&row.length>=2&&row.every(validText))))return undefined;
  return {
    templateType:snapshot["templateType"] as string|null,
    templateVersion:snapshot["templateVersion"],
    catalogueFamilyId:snapshot["catalogueFamilyId"] as string|null,
    sourceRecordId:snapshot["sourceRecordId"] as string|null,
    projectRecordId:snapshot["projectRecordId"] as string|null,
    sourceReference:validText(snapshot["sourceReference"])?snapshot["sourceReference"]:null,
    projectReference:validText(snapshot["projectReference"])?snapshot["projectReference"]:null,
    projectPhase:validText(snapshot["projectPhase"])?snapshot["projectPhase"]:null,
    projectStage:validText(snapshot["projectStage"])?snapshot["projectStage"]:null,
    ...(validText(snapshot["classification"])?{classification:snapshot["classification"]}:{}),
    releaseStatus:"Unissued",
    completionPercentage:snapshot["completionPercentage"],
    missingFields:snapshot["missingFields"] as string[],
    sections:sections.map(section=>({title:(section as Record<string,unknown>)["title"] as string,rows:(section as Record<string,unknown>)["rows"] as string[][]})),
  };
}
export function attachmentRevisionOptions(files:{revision:string}[]):string[]{
  const existing=[...new Set(files.map(f=>f.revision).filter(v=>/^\d+$/.test(v)))];
  const next=String(Math.max(0,...existing.map(Number))+1).padStart(2,"0");
  return [...existing.sort((a,b)=>Number(a)-Number(b)),next];
}
