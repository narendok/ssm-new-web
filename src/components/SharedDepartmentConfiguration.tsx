import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useOrganizationConfiguration } from '@/lib/organization-configuration';
import { updateOrganizationDepartment, type OrganizationConfiguration } from '@/lib/organization-configuration.functions';

type Department = OrganizationConfiguration['departments'][number];
export function SharedDepartmentConfiguration({scopeKey}:{scopeKey:string}) {
  const query=useOrganizationConfiguration(scopeKey), cache=useQueryClient(), save=useServerFn(updateOrganizationDepartment);
  const [draft,setDraft]=useState<Department|null>(null), [notice,setNotice]=useState(''), [busy,setBusy]=useState(false);
  if(query.isLoading)return <p role="status">Loading shared department settings…</p>;
  if(query.error||!query.data)return <div role="alert">Department settings could not load. <button onClick={()=>void query.refetch()}>Retry</button></div>;
  const data=query.data;
  const field='h-9 w-full rounded border border-input bg-background px-2 text-sm';
  return <section aria-label="Shared department configuration" className="space-y-3">
    <p className="text-sm text-muted-foreground">{data.departments.filter(d=>d.active).length} active departments. Names, leads and ordering come from this shared organization master. Department codes retain linked records and responsibilities.</p>
    <div className="overflow-auto rounded border border-border"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border"><th className="p-2">Department</th><th>Lead</th><th>Status</th><th /></tr></thead><tbody>{data.departments.map(d=><tr key={d.id} className="border-b border-border"><td className="p-2">{d.code} · {d.name}{d.workspaceDepartmentId&&<small className="block text-muted-foreground">Workspace: {data.departments.find(parent=>parent.id===d.workspaceDepartmentId)?.name}</small>}</td><td>{data.leads.find(l=>l.id===d.leadMemberId)?.name||'Unassigned'}</td><td>{d.active?'Active':'Inactive'}</td><td className="p-2"><button className="text-primary" disabled={!data.canManage} onClick={()=>{setDraft({...d});setNotice('');}}>Configure</button></td></tr>)}</tbody></table></div>
    {draft&&<form className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2" onSubmit={async e=>{
      e.preventDefault();setBusy(true);setNotice('');
      try{const saved=await save({data:{id:draft.id,expectedUpdatedAt:draft.updatedAt,name:draft.name,type:draft.type,active:draft.active,sortOrder:draft.sortOrder,leadMemberId:draft.leadMemberId,ticketGroups:draft.ticketGroups,workspaceDepartmentId:draft.workspaceDepartmentId}});cache.setQueryData(['organization-configuration',scopeKey],saved);await cache.invalidateQueries();setDraft(null);setNotice('Department saved to the shared organization master.');}
      catch(error){setNotice(error instanceof Error?error.message:'Department could not be saved.');}
      finally{setBusy(false);}
    }}>
      <p className="text-sm font-semibold sm:col-span-2">Configure {draft.code}</p>
      <label className="text-xs">Department name<input required className={field} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
      <label className="text-xs">Department type<input required className={field} value={draft.type} onChange={e=>setDraft({...draft,type:e.target.value})}/></label>
      <label className="text-xs">Department lead<select className={field} value={draft.leadMemberId??''} onChange={e=>setDraft({...draft,leadMemberId:e.target.value||null})}><option value="">Unassigned</option>{data.leads.map(l=><option key={l.id} value={l.id}>{l.name}{l.departmentId&&l.departmentId!==draft.id?' · also leads another department':''}</option>)}</select><span className="mt-1 block text-[11px] text-muted-foreground">A lead can own more than one department. Their access remains limited to the departments assigned here.</span></label>
      <label className="text-xs">Display order<input className={field} type="number" min={0} max={999} value={draft.sortOrder} onChange={e=>setDraft({...draft,sortOrder:Number(e.target.value)})}/></label>
      <label className="text-xs">Main workspace<select className={field} value={draft.workspaceDepartmentId||''} onChange={e=>setDraft({...draft,workspaceDepartmentId:e.target.value||null})}><option value="">Own department workspace</option>{data.departments.filter(d=>d.active&&d.id!==draft.id&&!d.workspaceDepartmentId).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <fieldset className="flex flex-wrap gap-4 sm:col-span-2"><legend className="mb-2 text-xs">Ticket responsibilities</legend>{(['service','it'] as const).map(key=><label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.ticketGroups.includes(key)} onChange={e=>setDraft({...draft,ticketGroups:e.target.checked?[...draft.ticketGroups,key]:draft.ticketGroups.filter(v=>v!==key)})}/>{key==='service'?'Service & Field':'IT & Facilities'}</label>)}</fieldset>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/>Active</label>
      <div className="flex justify-end gap-2"><button type="button" onClick={()=>setDraft(null)}>Cancel</button><button disabled={busy} className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground">{busy?'Saving…':'Save department'}</button></div>
    </form>}
    {notice&&<p role="status" className="text-sm">{notice}</p>}
  </section>;
}
