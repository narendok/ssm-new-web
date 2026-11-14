import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getSharedTestWorkspace } from '@/lib/shared-test.functions';
import { useOrganizationConfiguration, DEPARTMENT_MODULES } from '@/lib/organization-configuration';
import { taskProjectId } from '@/lib/department-scope';
import type { TestMembership } from '@/lib/test-auth.functions';
import { CompanyDirectoryModal } from './CompanyDirectoryAndLegalHub';
import { buildDepartmentDirectoryMetadata, CommonDepartmentSearchView, type AreaId } from './CommonDepartmentSearchView';

export function SharedOrganizationDepartments({membership,onOpen}:{membership:TestMembership;onOpen:(area:string,view?:string)=>void}) {
  const query=useOrganizationConfiguration(membership.membershipId);
  const load=useServerFn(getSharedTestWorkspace);
  const workspace=useQuery({queryKey:['shared-test-workspace',membership.organizationId,membership.membershipId],queryFn:()=>load(),retry:false});
  if(query.isLoading||workspace.isLoading)return <p role="status">Loading organization departments…</p>;
  if(!query.data||query.error||!workspace.data||workspace.error)return <p role="alert">Organization departments could not load. <button onClick={()=>{void query.refetch();void workspace.refetch();}}>Retry</button></p>;
  const data=query.data, departments=data.departments.filter(d=>d.active);
  const snapshot=workspace.data;
  const configured=buildDepartmentDirectoryMetadata(departments.map(d=>({...d,lead:data.leads.find(l=>l.id===d.leadMemberId)?.name||'Unassigned'})));
  return <CommonDepartmentSearchView departments={configured} currentDepartment={(DEPARTMENT_MODULES[membership.departmentCode||'']||'ehw') as AreaId}
    onSelectDepartment={(area,view)=>{if(membership.role==='admin'||DEPARTMENT_MODULES[membership.departmentCode||'']===area)onOpen(area,view);}}
    openTaskCounts={Object.fromEntries(departments.map(d=>[DEPARTMENT_MODULES[d.code],snapshot.tasks.filter(task=>task.department_id===d.id&&!['Complete','Cancelled','cancelled'].includes(task.status)).length]))}
    approvalCounts={Object.fromEntries(departments.map(d=>[DEPARTMENT_MODULES[d.code],snapshot.approvals.filter(approval=>approval.reviewer_department_id===d.id&&approval.outcome==='pending').length]))}
    projectCounts={Object.fromEntries(departments.map(d=>[DEPARTMENT_MODULES[d.code],new Set([...snapshot.records.filter(record=>record.record_type==='Project'&&record.department_id===d.id).map(record=>record.id),...snapshot.tasks.filter(task=>task.department_id===d.id).map(task=>taskProjectId({recordId:task.record_id},snapshot.records.map(record=>({...record,type:record.record_type})))).filter(Boolean)]).size]))}
  />;
}

export function SharedCompanyDirectory({membership,onClose}:{membership:TestMembership;onClose:()=>void}) {
  const load=useServerFn(getSharedTestWorkspace);
  const query=useQuery({queryKey:['shared-test-workspace',membership.organizationId,membership.membershipId],queryFn:()=>load(),retry:false});
  if(query.isLoading)return <section role="status" className="fixed inset-8 z-50 rounded-xl border bg-card p-6">Loading shared directory… <button onClick={onClose}>Close</button></section>;
  if(!query.data||query.error)return <section role="alert" className="fixed inset-8 z-50 rounded-xl border bg-card p-6">The shared directory could not load. <button onClick={()=>void query.refetch()}>Retry</button> <button onClick={onClose}>Close</button></section>;
  const data=query.data;
  return <CompanyDirectoryModal onClose={onClose} contacts={data.members.map(member=>{
    const department=data.departments.find(d=>d.id===member.department_id),name=member.display_name||'Unnamed member';
    return {id:member.id,name,departmentCode:department?.code||'ADMIN',departmentName:department?.name||'Executive administration',designation:member.role.replace(/_/g,' '),reportingManager:data.members.find(m=>m.id===department?.lead_member_id)?.display_name||'Not recorded',workEmail:'',deskExtension:'Not recorded',facilityLocation:'Not recorded',primarySkills:[],avatarInitial:name.split(' ').map(part=>part[0]).join('').slice(0,2)};
  })}/>;
}
