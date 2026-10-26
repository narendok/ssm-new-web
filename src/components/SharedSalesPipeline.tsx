import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { SalesEnquiriesAndOpportunities, type CustomerRecord, type EnquiryOpportunity } from "./SalesWorkspaceAndCustomerRegister";
import { InlineCustomerModal } from "./InlineCustomerModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { sharedSalesPipeline } from "@/lib/shared-sales";
import { saveSalesIntake, type SalesIntakePayload } from "@/lib/sales-intake.functions";
import { mutateSharedTestWorkspace } from "@/lib/shared-test.functions";
import type { SharedTestSnapshot } from "@/lib/shared-test.schema";

export function SharedSalesPipeline({snapshot,onRefresh,onOpenInputs}:{
  snapshot: SharedTestSnapshot; onRefresh:()=>Promise<unknown>; onOpenInputs?:((sourceId?:string)=>void) | undefined;
}) {
  const save=useServerFn(saveSalesIntake),write=useServerFn(mutateSharedTestWorkspace),cache=useQueryClient();
  const retry=useRef<string|null>(null),lock=useRef(false);
  const [notice,setNotice]=useState(""),[error,setError]=useState("");
  const [customersOpen,setCustomersOpen]=useState(false),[addCustomer,setAddCustomer]=useState(false);
  const [dispatch,setDispatch]=useState<{source:EnquiryOpportunity;departments:string[];due:string}|null>(null);
  const [busy,setBusy]=useState(false);
  const {customers,enquiries}=sharedSalesPipeline(snapshot);
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
  function startDispatch(source:EnquiryOpportunity){
    const defaults=source.projectTrack==="ready_made"?["SAL","FIN"]:["EHW","FW","SW","MECH","PUR","QA","EMF","MMF"];
    setDispatch({source,departments:defaults.filter(code=>snapshot.departments.some(d=>d.code===code)),due:source.targetClosureDate});
    setError("");
  }
  if (snapshot.membership.is_client || (snapshot.membership.role!=="admin" && (snapshot.membership.role!=="department_lead" || snapshot.membership.department_code!=="SAL"))) return <div className="space-y-3"><p className="text-xs text-muted-foreground">Sales intake changes require the Sales lead or Admin.</p>{enquiries.map(e=><div key={e.id} className="rounded-lg border p-3 text-sm"><strong>{e.title}</strong><p className="text-xs">{e.reference} · {e.status}</p><Button type="button" variant="outline" onClick={()=>onOpenInputs?.(e.id)}>View inputs</Button></div>)}</div>;
  return <>
    {notice&&<p role="status" className="text-xs text-muted-foreground">{notice}</p>}
    <SalesEnquiriesAndOpportunities customers={customers} enquiries={enquiries}
      reviewDepartments={snapshot.departments.filter(d=>d.code!=="CLIENT")}
      onOpenNewEnquiry={()=>setNotice("Use Add Enquiry to create a shared Sales intake.")}
      onOpenCustomerRegister={()=>setCustomersOpen(true)}
      onOpenFeasibilityGate={id=>onOpenInputs?.(id)} onOpenSourceInputs={id=>onOpenInputs?.(id)}
      onSendForFeasibility={startDispatch} onCreateCustomer={createCustomer}
      onSubmitIntake={async data=>{
        const {enquiryIdToConvert,expectedUpdatedAt,customerId,...rest}=data;
        await commit({...rest,...(customerId?{customerId}:{}),...(data.mode==="convert"?{sourceId:enquiryIdToConvert,expectedUpdatedAt}: {})});
      }}/>
    <Dialog open={!!dispatch} onOpenChange={open=>{if(!open&&!busy)setDispatch(null);}}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Send for feasibility</DialogTitle><DialogDescription>{dispatch?.source.title} · Source information and history remain linked.</DialogDescription></DialogHeader>
      <form className="space-y-3" onSubmit={async e=>{e.preventDefault();if(!dispatch)return;try{
        const source=snapshot.records.find(r=>r.id===dispatch.source.id);
        const result=await commit({mode:dispatch.source.kind==="enquiry"?"convert":"dispatch",sourceId:dispatch.source.id,expectedUpdatedAt:dispatch.source.updatedAt,
          ...(dispatch.source.kind==="enquiry"?{title:dispatch.source.title}:{}),dispatchFeasibility:true,feasibilityDepts:dispatch.departments,
          targetClosureDate:dispatch.due,...(source?.fields["projectTrack"]?{track:source.fields["projectTrack"] as SalesIntakePayload["track"]}:{})});
        setDispatch(null);setNotice(`${result.reviewCount} department review requests and linked tasks saved.`);
      }catch(e){setError(e instanceof Error?e.message:"Save failed; your selection is preserved.");}}}>
        <fieldset disabled={busy} className="grid grid-cols-2 gap-2"><legend className="mb-2 text-xs font-semibold">Review departments</legend>{snapshot.departments.filter(d=>d.code!=="CLIENT").map(d=><label key={d.id} className="flex gap-2 text-xs" title={d.name}><input type="checkbox" checked={dispatch?.departments.includes(d.code)||false} onChange={e=>setDispatch(prev=>prev?{...prev,departments:e.target.checked?[...prev.departments,d.code]:prev.departments.filter(code=>code!==d.code)}:prev)}/>{d.code} · {d.name}</label>)}</fieldset>
        <label className="grid gap-1 text-xs">Review target date (optional)<input type="date" className="rounded border bg-background p-2" value={dispatch?.due||""} disabled={busy} onChange={e=>setDispatch(prev=>prev?{...prev,due:e.target.value}:prev)}/></label>
        {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>setDispatch(null)}>Cancel</Button><Button disabled={busy||!dispatch?.departments.length}>{busy?"Saving…":"Send for feasibility"}</Button></div>
      </form></DialogContent></Dialog>
    <Dialog open={customersOpen} onOpenChange={setCustomersOpen}><DialogContent><DialogHeader><DialogTitle>Customers</DialogTitle><DialogDescription>Canonical customer records within your account access.</DialogDescription></DialogHeader><div className="max-h-80 space-y-2 overflow-y-auto">{customers.map(c=><div key={c.id} className="rounded border p-2 text-xs"><strong>{c.name}</strong><p>{c.code}</p></div>)}{!customers.length&&<p className="text-xs">No customers registered yet.</p>}</div><Button onClick={()=>setAddCustomer(true)}>Add customer</Button></DialogContent></Dialog>
    {addCustomer&&<InlineCustomerModal onClose={()=>setAddCustomer(false)} onSave={async values=>{await createCustomer(values);setAddCustomer(false);}}/>}
  </>;
}
