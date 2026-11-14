import { startLifecycleProject, getLifecycleWorkspace } from '@/lib/lifecycle-workspace.functions';
import { readLifecycleBaseline } from '@/lib/lifecycle-baseline';
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { SalesEnquiriesAndOpportunities, type CustomerRecord, type EnquiryOpportunity } from "./SalesWorkspaceAndCustomerRegister";
import { InlineCustomerModal } from "./InlineCustomerModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { sharedSalesPipeline } from "@/lib/shared-sales";
import { decideSalesTrackAfterFeasibility, saveSalesIntake, type SalesIntakePayload } from "@/lib/sales-intake.functions";
import { CANONICAL_TRACK_METADATA, type CanonicalProjectTrack } from "@/lib/canonical-lifecycle";
import { mutateSharedTestWorkspace } from "@/lib/shared-test.functions";
import type { SharedTestSnapshot } from "@/lib/shared-test.schema";

export function SharedSalesPipeline({snapshot,onRefresh,onOpenInputs}:{
  snapshot: SharedTestSnapshot; onRefresh:()=>Promise<unknown>; onOpenInputs?:((sourceId?:string)=>void) | undefined;
}) {
  const startProject=useServerFn(startLifecycleProject);
  const loadLifecycle=useServerFn(getLifecycleWorkspace);
  const lifecycle=useQuery({queryKey:['lifecycle-workspace',snapshot.membership.membership_id],queryFn:()=>loadLifecycle(),retry:false});
  const [projectStart,setProjectStart]=useState<{source:EnquiryOpportunity;reference:string;title:string;requestId:string}|null>(null);
  const save=useServerFn(saveSalesIntake),decideTrack=useServerFn(decideSalesTrackAfterFeasibility),write=useServerFn(mutateSharedTestWorkspace),cache=useQueryClient();
  const retry=useRef<string|null>(null),trackRetry=useRef<string|null>(null),lock=useRef(false);
  const [notice,setNotice]=useState(""),[error,setError]=useState("");
  const [customersOpen,setCustomersOpen]=useState(false),[addCustomer,setAddCustomer]=useState(false);
  const [dispatch,setDispatch]=useState<{source:EnquiryOpportunity;departments:string[];due:string;revision:string;consulted:string[];informed:string[]}|null>(null);
  const [trackDecision,setTrackDecision]=useState<{source:EnquiryOpportunity;track:CanonicalProjectTrack|""}|null>(null);
  const [busy,setBusy]=useState(false);
  const {customers,enquiries}=sharedSalesPipeline(snapshot);
  const feasibilityRaci = (() => {
    const saved = lifecycle.data?.revision;
    if (!saved) return null;
    const definition = readLifecycleBaseline(JSON.stringify(saved.definition));
    const stage = definition?.stages.find(item => item.code === "CM_02");
    if (!definition || !stage?.raci?.R.length) return null;
    return { revision: definition.id, departmentCodes: [...stage.raci.R] };
  })();
  const refresh=async()=>{
    await Promise.all([onRefresh(),cache.invalidateQueries({queryKey:["project-inputs"]}),cache.invalidateQueries({queryKey:["project-coordination"]})]);
  };
  async function commit(payload: SalesIntakePayload) {
    if(lock.current) throw new Error("A Sales request is already being saved.");
    lock.current=true;setBusy(true);setError("");setNotice("");
    retry.current ||= crypto.randomUUID();
    try {
      const result=await save({data:{payload,requestId:retry.current}});
      retry.current=null;
      // A confirmed transaction must remain successful if a subsequent read cannot refresh.
      try {await refresh();} catch {setNotice("Saved to your shared account. Refresh the list to see the latest state.");}
      setNotice(`${result.reference} saved · ${result.reviewCount} department reviews requested.`);
      return result;
    } finally {lock.current=false;setBusy(false);}
  }
  async function createCustomer(values:{name:string;contact:string;email:string;operationId:string}):Promise<CustomerRecord>{
    const reference=`HLPL-CUS-${values.operationId.replace(/-/g,"").toUpperCase()}`;
    const result=await write({data:{action:"create_record",requestId:values.operationId,payload:{record_type:"Customer",reference,title:values.name,fields:{revision:"01",name:values.name,spocName:values.contact,spocEmail:values.email}}}}) as {id?:string;saved_at?:string};
    if(!result?.id) throw new Error("Customer save did not return a canonical ID.");
    try {await refresh();} catch { /* The confirmed canonical ID remains selectable in the parent draft. */ }
    return {id:result.id,code:reference,name:values.name,spocName:values.contact,spocEmail:values.email,division:"",spocPhone:"",cityState:"",gstin:"",status:"Prospect",activeOpportunitiesCount:0,assignedLead:"",createdAt:result.saved_at || ""};
  }
  async function startDispatch(source:EnquiryOpportunity){
    setError('');
    const fresh=await lifecycle.refetch();
    const definition=fresh.data?.revision ? readLifecycleBaseline(JSON.stringify(fresh.data.revision.definition)) : undefined;
    const raci=definition?.stages.find(s=>s.code==='CM_02')?.raci;
    if(!definition || !raci?.R.length){setError('Configure the feasibility stage responsibilities in Phases, stages & RACI settings before dispatch.');return;}
    setDispatch({source,departments:[...raci.R],due:source.targetClosureDate,revision:definition.id,consulted:[...raci.C],informed:[...raci.I]});
  }
  function startTrackDecision(source:EnquiryOpportunity){trackRetry.current=null;setTrackDecision({source,track:""});setError("");}
  async function commitTrackDecision(){
    if(!trackDecision?.track) return;
    if(lock.current) throw new Error("A Sales request is already being saved.");
    lock.current=true;setBusy(true);setError("");setNotice("");trackRetry.current ||= crypto.randomUUID();
    try{
      const result=await decideTrack({data:{opportunityId:trackDecision.source.id,expectedUpdatedAt:trackDecision.source.updatedAt,track:trackDecision.track,requestId:trackRetry.current}});
      trackRetry.current=null;setTrackDecision(null);
      try{await refresh();}catch{setNotice("Track decision saved to your shared account. Refresh the list to see the latest state.");}
      setNotice(`${result.reference} · engineering track recorded after feasibility.`);
    }catch(e){setError(e instanceof Error?e.message:"Track decision failed; your selection is preserved.");}
    finally{lock.current=false;setBusy(false);}
  }
  if (snapshot.membership.is_client || (snapshot.membership.role!=="admin" && (snapshot.membership.role!=="department_lead" || snapshot.membership.department_code!=="SAL"))) return <div className="space-y-3"><p className="text-xs text-muted-foreground">Sales intake changes require the Sales lead or Admin.</p>{enquiries.map(e=><div key={e.id} className="rounded-lg border p-3 text-sm"><strong>{e.title}</strong><p className="text-xs">{e.reference} · {e.status}</p><Button type="button" variant="outline" onClick={()=>onOpenInputs?.(e.id)}>View inputs</Button></div>)}</div>;
  return <>
    {notice&&<p role="status" className="text-xs text-muted-foreground">{notice}</p>}
    <SalesEnquiriesAndOpportunities customers={customers} enquiries={enquiries}
      reviewDepartments={snapshot.departments.filter(d=>d.code!=="CLIENT")}
      feasibilityRaci={feasibilityRaci}
      onOpenNewEnquiry={()=>setNotice("Use Add Enquiry to create a shared Sales intake.")}
      onOpenCustomerRegister={()=>setCustomersOpen(true)}
      onOpenFeasibilityGate={id=>onOpenInputs?.(id)} onOpenSourceInputs={id=>onOpenInputs?.(id)}
      onSendForFeasibility={startDispatch} onDecideTrack={startTrackDecision} onStartProject={source=>setProjectStart({source,reference:`HLPL-PRJ-${crypto.randomUUID().slice(0,8).toUpperCase()}`,title:source.title,requestId:crypto.randomUUID()})} onCreateCustomer={createCustomer}
      onSubmitIntake={async data=>{
        const {enquiryIdToConvert,expectedUpdatedAt,customerId,...rest}=data;
        await commit({...rest,...(customerId?{customerId}:{}),...(data.mode==="convert"?{sourceId:enquiryIdToConvert,expectedUpdatedAt}: {})});
      }}/>
    <Dialog open={!!trackDecision} onOpenChange={open=>{if(!open&&!busy){trackRetry.current=null;setTrackDecision(null);}}}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Choose engineering track after feasibility</DialogTitle><DialogDescription>{trackDecision?.source.title} · all required department reviews are complete. This is an internal scope decision, not customer approval.</DialogDescription></DialogHeader>
      <div className="space-y-3"><label className="grid gap-1 text-xs font-medium">Applicable engineering scope<select className="rounded border bg-background p-2" value={trackDecision?.track||""} disabled={busy} onChange={e=>{trackRetry.current=null;setError("");setTrackDecision(prev=>prev?{...prev,track:e.target.value as CanonicalProjectTrack|""}:prev);}}><option value="">Choose a track after review…</option>{Object.values(CANONICAL_TRACK_METADATA).map(option=><option key={option.track} value={option.track}>{option.label}</option>)}</select></label>{trackDecision?.track&&<p className="rounded border bg-muted/40 p-3 text-xs text-muted-foreground">{CANONICAL_TRACK_METADATA[trackDecision.track].shortDescription}</p>}{error&&<p role="alert" className="text-xs text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>{trackRetry.current=null;setTrackDecision(null);}}>Cancel</Button><Button type="button" disabled={busy||!trackDecision?.track} onClick={()=>void commitTrackDecision()}>{busy?"Saving…":"Save engineering track"}</Button></div></div>
    </DialogContent></Dialog>
    <Dialog open={!!dispatch} onOpenChange={open=>{if(!open&&!busy)setDispatch(null);}}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Send for feasibility</DialogTitle><DialogDescription>{dispatch?.source.title} · Source information and history remain linked.</DialogDescription></DialogHeader>
      <form className="space-y-3" onSubmit={async e=>{e.preventDefault();if(!dispatch)return;try{
        const source=snapshot.records.find(r=>r.id===dispatch.source.id);
        const result=await commit({mode:dispatch.source.kind==="enquiry"?"convert":"dispatch",sourceId:dispatch.source.id,expectedUpdatedAt:dispatch.source.updatedAt,
          ...(dispatch.source.kind==="enquiry"?{title:dispatch.source.title}:{}),dispatchFeasibility:true,feasibilityDepts:dispatch.departments,feasibilityRaciRevision:dispatch.revision,
          targetClosureDate:dispatch.due});
        setDispatch(null);setNotice(`${result.reviewCount} department review requests and linked tasks saved.`);
      }catch(e){setError(e instanceof Error?e.message:"Save failed; your selection is preserved.");}}}>
        <fieldset className="grid grid-cols-2 gap-2"><legend className="mb-2 text-xs font-semibold">Required reviews · saved feasibility RACI</legend>{snapshot.departments.filter(d=>dispatch?.departments.includes(d.code)).map(d=><label key={d.id} className="flex gap-2 text-xs" title={d.name}><input type="checkbox" checked disabled/>{d.code} · {d.name}</label>)}</fieldset>
        <p className="text-xs text-muted-foreground">Required reviewers come from settings. Consulted: {dispatch?.consulted.join(', ')||'None assigned'} · Informed: {dispatch?.informed.join(', ')||'None assigned'}. Existing dispatches retain their saved version.</p>
        <label className="grid gap-1 text-xs">Review target date (optional)<input type="date" className="rounded border bg-background p-2" value={dispatch?.due||""} disabled={busy} onChange={e=>setDispatch(prev=>prev?{...prev,due:e.target.value}:prev)}/></label>
        {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>setDispatch(null)}>Cancel</Button><Button disabled={busy||!dispatch?.departments.length}>{busy?"Saving…":"Send for feasibility"}</Button></div>
      </form></DialogContent></Dialog>
    <Dialog open={customersOpen} onOpenChange={setCustomersOpen}><DialogContent><DialogHeader><DialogTitle>Customers</DialogTitle><DialogDescription>Canonical customer records within your account access.</DialogDescription></DialogHeader><div className="max-h-80 space-y-2 overflow-y-auto">{customers.map(c=><div key={c.id} className="rounded border p-2 text-xs"><strong>{c.name}</strong><p>{c.code}</p></div>)}{!customers.length&&<p className="text-xs">No customers registered yet.</p>}</div><Button onClick={()=>setAddCustomer(true)}>Add customer</Button></DialogContent></Dialog>
    <Dialog open={!!projectStart} onOpenChange={open=>{if(!open&&!busy)setProjectStart(null);}}><DialogContent><DialogHeader><DialogTitle>Start project from feasibility</DialogTitle><DialogDescription>The server rechecks department reviews and the recorded engineering track. Starting creates draft work, not a release.</DialogDescription></DialogHeader><form className="space-y-3" onSubmit={async e=>{e.preventDefault();if(!projectStart||busy)return;setBusy(true);setError('');try{const result=await startProject({data:{opportunityId:projectStart.source.id,expectedUpdatedAt:projectStart.source.updatedAt,reference:projectStart.reference,title:projectStart.title,requestId:projectStart.requestId}});setProjectStart(null);await refresh();setNotice(`${result.reference} created with the current pinned lifecycle defaults.`);}catch(error){setError(error instanceof Error?error.message:'Project start failed.');}finally{setBusy(false);}}}><label className="block text-xs">Project code<input className="w-full rounded border bg-background p-2" required value={projectStart?.reference||''} onChange={e=>setProjectStart(p=>p?{...p,reference:e.target.value.toUpperCase()}:p)}/></label><label className="block text-xs">Project title<input className="w-full rounded border bg-background p-2" required value={projectStart?.title||''} onChange={e=>setProjectStart(p=>p?{...p,title:e.target.value}:p)}/></label><p className="text-xs">Recorded scope: {projectStart?.source.projectTrack}</p>{error&&<p role="alert" className="text-xs text-destructive">{error}</p>}<Button disabled={busy}>Start project</Button></form></DialogContent></Dialog>
    {addCustomer&&<InlineCustomerModal onClose={()=>setAddCustomer(false)} onSave={async values=>{await createCustomer(values);setAddCustomer(false);}}/>}
  </>;
}
