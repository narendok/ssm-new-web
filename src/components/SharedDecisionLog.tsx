import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { OfficialDecisionLogModal } from "./DecisionDeviationLog";
import { getSharedDecisions,mutateSharedDecision,type SharedDecisionPayload } from "@/lib/shared-decisions.functions";
import { getSharedTestWorkspace } from "@/lib/shared-test.functions";
import { getCoordination } from "./SharedProjectAnalysis";
import { CANONICAL_STAGES } from "@/lib/department-chronicles";
import type { TestMembership } from "@/lib/test-auth.functions";
import type { DecisionRecord } from "./CompanyDirectoryAndLegalHub";
export function SharedDecisionLog({membership,departmentCode,activeProject,onClose}:{membership:TestMembership;departmentCode?:string|undefined;activeProject?:string|undefined;onClose:()=>void}){
  const load=useServerFn(getSharedDecisions),snapshot=useServerFn(getSharedTestWorkspace),coordination=useServerFn(getCoordination),mutate=useServerFn(mutateSharedDecision);
  const query=useQuery({queryKey:["shared-decisions",membership.organizationId,membership.membershipId],queryFn:()=>load(),refetchInterval:15000});
  const workspace=useQuery({queryKey:["shared-test-workspace",membership.organizationId,membership.membershipId],queryFn:()=>snapshot()});
  const common=useQuery({queryKey:["project-coordination",membership.organizationId,membership.membershipId],queryFn:()=>coordination()});
  const [notice,setNotice]=useState(""),[visibilityError,setVisibilityError]=useState(""),[visibilityBusy,setVisibilityBusy]=useState(false);
  const pending=useRef(new Map<string,string>());
  const actor=workspace.data?.membership;
  const code=membership.role==="admin"?({sales:"SAL",sal:"SAL",hrops:"HR"}[departmentCode||""]||departmentCode?.toUpperCase()):membership.departmentCode;
  const department=workspace.data?.departments.find(d=>d.code===code);
  const projects=(common.data?.records||[]).filter(r=>r.type==="Project");
  const entries:DecisionRecord[]=(query.data?.entries||[]).map(e=>({id:e.id,projectCode:e.project_code||"",timestamp:e.created_at,actor:e.author_name,actorRole:e.author_role.replaceAll("_"," "),scope:e.scope,stage:e.stage||undefined,departmentCode:e.department_code,authorId:e.author_id,status:e.status,title:e.title,rationale:e.rationale,impactedDocuments:e.source_references,actionItems:e.conditions,...(e.reviewer_name?{approvedBy:e.reviewer_name}:{}),...(e.reviewed_at?{approvedAt:e.reviewed_at}:{})}));
  async function write(action:"create"|"approve"|"reject"|"visibility",payload:SharedDecisionPayload,key?:string){
    const signature=JSON.stringify([action,payload]);const requestId=key||pending.current.get(signature)||crypto.randomUUID();pending.current.set(signature,requestId);
    await mutate({data:{action,payload,requestId}});pending.current.delete(signature);const refreshed=await query.refetch();setNotice(refreshed.error?"Saved to the company account. The list is refreshing; do not submit again.":"Saved to the company account.");return true;
  }
  const canReview=(entry:DecisionRecord)=>!!actor&&entry.authorId!==actor.membership_id&&(actor.role==="admin"||(actor.role==="department_lead"&&entry.departmentCode===actor.department_code));
  const failure=query.error||workspace.error||common.error;
  return <OfficialDecisionLogModal shared loading={query.isPending||workspace.isPending||common.isPending} onClose={onClose} activeProject={projects.find(p=>p.id===activeProject||p.reference===activeProject)?.reference}
    persona={{id:membership.membershipId,label:membership.role.replaceAll("_"," "),person:actor?.display_name||membership.displayName,kind:membership.role==="admin"?"admin":membership.role==="department_lead"?"lead":membership.isClient?"client":"member"}}
    authorId={membership.membershipId} projects={projects} stageOptions={CANONICAL_STAGES.map(s=>`${s[0]}: ${s[1]}`)} decisions={entries}
    sourceOptions={(workspace.data?.records||[]).map(r=>({value:r.reference,label:`${r.reference} · ${r.title}`}))}
    readOnlyReason={failure instanceof Error?failure.message:undefined}
    canApproveEntry={canReview}
    onSave={async entry=>{if(!department)throw new Error("Choose your department using the top header before recording a decision.");const project=projects.find(p=>p.reference===entry.projectCode);return write("create",{departmentId:department.id,title:entry.title,rationale:entry.rationale,scope:entry.scope,conditions:entry.actionItems,sourceReferences:entry.impactedDocuments,...(entry.scope!=="common"?{projectId:project?.id,stage:entry.stage}:{})},entry.id);}}
    onApprove={async id=>{const entry=query.data?.entries.find(e=>e.id===id);if(!entry)throw new Error("This submission is no longer available.");return write("approve",{id,expectedVersion:entry.version});}}
    onReject={async(id,reason)=>{const entry=query.data?.entries.find(e=>e.id===id);if(!entry)throw new Error("This submission is no longer available.");return write("reject",{id,expectedVersion:entry.version,reason});}}
    headerContent={<>{notice&&<p role="status" className="text-xs text-muted-foreground">{notice}</p>}{failure&&<button type="button" className="text-xs underline" onClick={()=>{void query.refetch();void workspace.refetch();void common.refetch();}}>Retry loading</button>}{membership.role==="admin"&&department&&<details className="rounded-lg border border-border p-2 text-xs"><summary>Department visibility · {department.name}</summary><p className="my-2 text-muted-foreground">Own department is visible by default. These grants let other department leads read this department’s log; they do not grant review authority.</p>{workspace.data?.departments.filter(d=>d.id!==department.id&&d.code!=="CLIENT").map(d=><label key={d.id} className="flex items-center gap-2 py-1"><input type="checkbox" disabled={visibilityBusy} checked={query.data?.visibility.some(v=>v.owner_department_id===department.id&&v.viewer_department_id===d.id&&v.enabled)||false} onChange={async e=>{setVisibilityBusy(true);setVisibilityError("");try{await write("visibility",{departmentId:department.id,viewerDepartmentId:d.id,enabled:e.target.checked});}catch(error){setVisibilityError(error instanceof Error?error.message:"Visibility could not be saved.");}finally{setVisibilityBusy(false);}}}/>{d.name}</label>)}{visibilityError&&<p role="alert">{visibilityError}</p>}</details>}</>}
  />;
}
