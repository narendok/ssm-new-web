import type { BusinessItem } from "./business-workspace.functions";
import type { SharedDecisionEntry } from "./shared-decisions.functions";
export type SharedSearchResult={id:string;title:string;type:string;summary:string;view:string;details:string};
type Workspace={records:{id:string;title:string;record_type:string;reference:string;notes:string}[];tasks:{id:string;title:string;status:string;due_at:string|null}[];documents:{id:string;title:string;document_type:string}[]};
/** Inputs are authorized server snapshots only. No browser example fallback. */
export function sharedSearchResults(workspace:Workspace|undefined,business:{items:BusinessItem[]}|undefined,decisions:{entries:SharedDecisionEntry[]}|undefined):SharedSearchResult[]{
  return [
    ...(workspace?.records||[]).map(r=>({id:r.id,title:r.title,type:r.record_type,summary:r.reference,view:r.record_type==="Project"?"Projects":"Records",details:r.notes})),
    ...(workspace?.tasks||[]).map(r=>({id:r.id,title:r.title,type:"Task",summary:r.status,view:"Tasks",details:r.due_at||""})),
    ...(workspace?.documents||[]).map(r=>({id:r.id,title:r.title,type:"Document",summary:r.document_type,view:"Documents",details:""})),
    ...(business?.items||[]).filter(i=>["expense","ticket","message"].includes(i.kind)).map(i=>({id:i.id,title:String(i.data["subject"]||i.data["purpose"]||i.data["text"]||i.kind),type:i.kind,summary:[i.data["status"],i.data["type"],...(Array.isArray(i.data["tags"])?i.data["tags"]:[])].filter(Boolean).join(" · "),view:i.kind==="ticket"?"tickets":i.kind==="message"?"communication":"budgets",details:i.kind==="ticket"?String(i.data["description"]||""):""})),
    ...(decisions?.entries||[]).map(e=>({id:e.id,title:e.title,type:"Decision & Deviation",summary:[e.department_code,e.project_code,e.status].filter(Boolean).join(" · "),view:"decisions",details:[e.rationale,e.conditions,...e.source_references].join(" ")})),
  ];
}
export function filterSharedSearch(results:SharedSearchResult[],query:string,type="all"){
  const seen=new Set<string>();
  return results.filter(r=>{const key=`${r.view}:${r.id}`;if(seen.has(key))return false;seen.add(key);return (type==="all"||r.type===type)&&`${r.title} ${r.summary} ${r.details}`.toLowerCase().includes(query.trim().toLowerCase());}).slice(0,50);
}
