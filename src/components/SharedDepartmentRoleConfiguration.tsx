import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getSharedDepartmentRoleConfiguration, saveSharedDepartmentRole, type SharedDepartmentRoleConfiguration } from '@/lib/department-roles.functions';

type Role = SharedDepartmentRoleConfiguration['roles'][number];
const permissions = [
  ['records:view','View department records'], ['records:create','Create records'], ['records:edit','Edit records'],
  ['tasks:assign','Assign tasks'], ['approvals:decide','Approve assigned department gates'], ['documents:manage','Manage documents'],
  ['documents:approve','Approve documents'], ['settings:manage','Manage department default tasks'], ['audit:manage','Manage audit records'],
] as const;
const roleKeyFromName=(name:string)=>{const key=name.trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,64);return key.length>=2?key:`role_${key||'new'}`;};
const field='h-9 w-full rounded border border-input bg-background px-2 text-sm';
const blank = () => ({id:null as string|null,expectedUpdatedAt:null as string|null,departmentId:'',name:'',roleKey:'',active:true,hierarchyLevel:null as number|null,permissions:[] as string[],memberIds:[] as string[]});
export function SharedDepartmentRoleConfiguration({scopeKey}:{scopeKey:string}) {
  const cache=useQueryClient(), load=useServerFn(getSharedDepartmentRoleConfiguration), save=useServerFn(saveSharedDepartmentRole);
  const query=useQuery({queryKey:['shared-department-role-configuration',scopeKey],queryFn:()=>load(),enabled:!!scopeKey,retry:false,refetchOnWindowFocus:true,refetchInterval:30000});
  const [draft,setDraft]=useState<ReturnType<typeof blank>|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const eligibleMembers=useMemo(()=>query.data?.members??[],[query.data]);
  const missingViewPermission=!!draft&&draft.active&&draft.memberIds.length>0&&!draft.permissions.includes('records:view');
  if(query.isLoading)return <p role="status">Loading shared roles and permissions…</p>;
  if(query.error||!query.data)return <div role="alert" className="space-y-2 text-sm">Shared role settings could not load. {query.error instanceof Error?query.error.message:''}<div><button className="rounded border px-3 py-1" onClick={()=>void query.refetch()}>Retry</button></div></div>;
  const data=query.data;
  const activeRoles=data.roles.filter(role=>role.active);
  const unclassifiedRoles=activeRoles.filter(role=>role.hierarchyLevel==null).length;
  const unassignedRoles=activeRoles.filter(role=>role.memberIds.length===0).length;
  const beginEdit=(role:Role)=>{setNotice('');setDraft({id:role.id,expectedUpdatedAt:role.updatedAt,departmentId:role.departmentId,name:role.name,roleKey:role.roleKey,active:role.active,hierarchyLevel:role.hierarchyLevel ?? null,permissions:[...role.permissions],memberIds:[...role.memberIds]});};
  const beginNew=()=>{setNotice('');setDraft({...blank(),departmentId:data.departments.find(d=>d.active&&d.code==='EMF')?.id??data.departments.find(d=>d.active)?.id??''});};
  return <section aria-label="Shared department roles and permissions" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">Configure separate roles within each department. One active member can hold multiple roles across departments. Changes are shared and audited.</p><button type="button" disabled={!data.canManage} onClick={beginNew} className="rounded bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Add role</button></div>
    {!data.canManage&&<p className="rounded border border-border p-2 text-sm">You can view this shared configuration. An organization Admin manages role assignments and permissions.</p>}
    {(unclassifiedRoles>0||unassignedRoles>0)&&<div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs"><strong className="font-semibold text-amber-700 dark:text-amber-300">Role routing needs setup</strong>{unclassifiedRoles>0&&<span>{unclassifiedRoles} active {unclassifiedRoles===1?'role has':'roles have'} no L1–L4 level</span>}{unassignedRoles>0&&<span>{unassignedRoles} active {unassignedRoles===1?'role has':'roles have'} no assigned person</span>}<span className="text-muted-foreground">Set levels from the organization chart and assign the correct members; names and profile details are not inferred.</span></div>}
    <div className="overflow-auto rounded border border-border"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-border bg-muted/40"><th className="p-2">Department</th><th>Role</th><th>Org level</th><th>Assigned members</th><th>Permissions</th><th>Status</th><th /></tr></thead><tbody>{data.roles.map(role=><tr key={role.id} className="border-b border-border align-top"><td className="p-2">{role.departmentCode} · {role.departmentName}</td><td className="p-2">{role.name}</td><td className="p-2">{role.hierarchyLevel?`L${role.hierarchyLevel}`:'Not set'}</td><td className="p-2">{role.memberIds.map(id=>eligibleMembers.find(m=>m.id===id)?.name??'Inactive member').join(', ')||'Unassigned'}</td><td className="p-2">{role.permissions.length?role.permissions.map(key=>permissions.find(([value])=>value===key)?.[1]??key).join(', '):'None'}</td><td className="p-2">{role.active?'Active':'Inactive'}</td><td className="p-2"><button type="button" disabled={!data.canManage} className="text-primary underline" onClick={()=>beginEdit(role)}>Configure</button></td></tr>)}{!data.roles.length&&<tr><td colSpan={7} className="p-5 text-center text-muted-foreground">No department roles are configured.</td></tr>}</tbody></table></div>
    {draft&&<form className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-2" onSubmit={async e=>{
      e.preventDefault();setBusy(true);setNotice('');
      try{const result=await save({data:{...draft,permissions:draft.permissions as typeof permissions[number][0][]}});cache.setQueryData(['shared-department-role-configuration',scopeKey],result);await cache.invalidateQueries({queryKey:['shared-department-role-configuration']});setDraft(null);setNotice('Shared department role saved and recorded in the audit log.');}
      catch(error){setNotice(error instanceof Error?error.message:'Role configuration could not be saved. Reload and retry.');}
      finally{setBusy(false);}
    }}>
      <h3 className="text-sm font-semibold md:col-span-2">{draft.id?'Configure role':'Add department role'}</h3>
      <label className="text-xs">Department<select required className={field} value={draft.departmentId} disabled={!!draft.id} onChange={e=>setDraft({...draft,departmentId:e.target.value})}>{data.departments.filter(d=>d.active).map(d=><option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}</select></label>
      <label className="text-xs">Role name<input required minLength={2} maxLength={100} className={field} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value,roleKey:draft.id?draft.roleKey:roleKeyFromName(e.target.value)})}/></label>
      <label className="text-xs">Organization level<select className={field} value={draft.hierarchyLevel ?? ''} onChange={e=>setDraft({...draft,hierarchyLevel:e.target.value?Number(e.target.value):null})}><option value="">Not classified</option><option value="1">L1 · Lead</option><option value="2">L2 · Senior / specialist</option><option value="3">L3 · Associate / technician</option><option value="4">L4 · Operator / trainee</option></select></label>
      <fieldset className="rounded border border-border p-2.5 md:col-span-2"><legend className="px-1 text-xs font-medium">People assigned</legend><div className="grid max-h-40 gap-1 overflow-y-auto sm:grid-cols-2">{eligibleMembers.map(m=><label key={m.id} className="flex min-w-0 items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted/40"><input type="checkbox" checked={draft.memberIds.includes(m.id)} onChange={e=>setDraft({...draft,memberIds:e.target.checked?[...draft.memberIds,m.id]:draft.memberIds.filter(id=>id!==m.id)})}/><span className="min-w-0 truncate">{m.name}<span className="ml-1 text-muted-foreground">{m.departmentId?'· '+(data.departments.find(d=>d.id===m.departmentId)?.code??'member dept'):'· organization member'}</span></span></label>)}</div>{!eligibleMembers.length&&<p className="text-xs text-muted-foreground">No active members are available to assign.</p>}<span className="mt-1 block text-[11px] text-muted-foreground">Select more than one person here, or assign one person to multiple roles. Role membership is separate from employee display names.</span></fieldset>
      <fieldset className="grid gap-2 sm:grid-cols-2 md:col-span-2"><legend className="mb-1 text-xs font-semibold">Permissions for this department role</legend>{permissions.map(([key,label])=><label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.permissions.includes(key)} onChange={e=>setDraft({...draft,permissions:e.target.checked?[...draft.permissions,key]:draft.permissions.filter(p=>p!==key)})}/>{label}</label>)}</fieldset>
      {missingViewPermission&&<p role="alert" className="text-sm text-destructive md:col-span-2">Choose “View department records” before assigning an active role. Without it, the role will not grant department access.</p>}
      <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/>Role is active</label>
      <div className="flex justify-end gap-2 md:col-span-2"><button type="button" className="rounded border px-3 py-2 text-sm" disabled={busy} onClick={()=>setDraft(null)}>Cancel</button><button disabled={busy||!data.canManage||missingViewPermission} className="rounded bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">{busy?'Saving…':'Save shared role'}</button></div>
    </form>}
    {notice&&<p role="status" className="text-sm">{notice}</p>}
  </section>;
}
