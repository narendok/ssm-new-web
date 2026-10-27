import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSharedTestWorkspace } from "@/lib/shared-test.functions";
import { getBusinessWorkspace } from "@/lib/business-workspace.functions";
import { getSharedDecisions } from "@/lib/shared-decisions.functions";
import { filterSharedSearch,sharedSearchResults } from "@/lib/shared-search-data";
import type { TestMembership } from "@/lib/test-auth.functions";
export function SharedPortalSearch({membership,query,onQueryChange,onOpen}:{membership:TestMembership;query:string;onQueryChange:(q:string)=>void;onOpen:(view:string,id:string,title:string)=>void}){
  const loadRecords=useServerFn(getSharedTestWorkspace),loadBusiness=useServerFn(getBusinessWorkspace),loadDecisions=useServerFn(getSharedDecisions);
  const records=useQuery({queryKey:["shared-test-workspace",membership.organizationId,membership.membershipId],queryFn:()=>loadRecords(),retry:1});
  const business=useQuery({queryKey:["business-workspace",membership.organizationId,membership.membershipId],queryFn:()=>loadBusiness(),retry:1});
  const decisions=useQuery({queryKey:["shared-decisions",membership.organizationId,membership.membershipId],queryFn:()=>loadDecisions(),retry:1});
  const [type,setType]=useState("all");
  const options=sharedSearchResults(records.error?undefined:records.data,business.error?undefined:business.data,decisions.error?undefined:decisions.data);
  const visible=filterSharedSearch(options,query,type),loading=records.isPending||business.isPending||decisions.isPending;
  return <div className="space-y-3">
    <div className="flex gap-2"><input autoFocus aria-label="Search shared records" className="min-w-0 flex-1 rounded border border-input bg-background px-3 py-2 text-sm" value={query} onChange={e=>onQueryChange(e.target.value)} placeholder="Search records, decisions, tasks or tags…"/>
      <select aria-label="Record type" className="max-w-36 rounded border border-input bg-background px-2 text-sm" value={type} onChange={e=>setType(e.target.value)}><option value="all">All types</option>{[...new Set(options.map(r=>r.type))].sort().map(t=><option key={t}>{t}</option>)}</select>
    </div>
    {loading&&<p className="text-xs text-muted-foreground">Loading permitted records…</p>}
    {(records.error||business.error||decisions.error)&&<p role="alert" className="text-xs text-destructive">Some account records could not be loaded. Results below include only available authorized sources.</p>}
    <div className="max-h-[45vh] space-y-1 overflow-y-auto">{visible.map(r=><button key={`${r.view}:${r.id}`} className="block w-full rounded-lg border border-border/50 p-3 text-left hover:bg-muted" title={`Open ${r.type}`} onClick={()=>onOpen(r.view,r.id,r.title)}><p className="text-xs text-primary">{r.type} · {r.summary}</p><p className="line-clamp-2 text-sm">{r.title}</p>{r.details&&<p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{r.details}</p>}</button>)}{!visible.length&&!loading&&<p className="p-3 text-sm text-muted-foreground">No permitted results.</p>}</div>
  </div>;
}