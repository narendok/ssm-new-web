import { departmentCode } from './department-scope';
import { pinLifecycleRevision, type LifecycleRevision } from './lifecycle-baseline';

export type FeasibilityDepartment = {id:string;code:string;name:string;lead:string;active:boolean};

/** Resolve the pre-project review from current Settings, without selecting a project track. */
export function feasibilityRouting(revision:LifecycleRevision, departments:FeasibilityDepartment[]) {
  const stage=revision.stages.find(s=>s.code==='CM_02');
  if(!stage?.raci)throw new Error('Configure the CM_02 feasibility stage and its RACI in Settings.');
  const find=(code:string)=>departments.find(d=>d.active&&departmentCode(d.code.replace(/^DEMO-/,''))===code);
  const responsible=stage.raci.R.map(code=>{
    const department=find(code);
    if(!department)throw new Error(`Feasibility department ${code} is unavailable. Update Settings.`);
    return {...department,code,tasks:stage.tasks.filter(task=>task.department===code)};
  });
  const coordinator=responsible.find(d=>d.code===stage.department);
  const accountable=find(stage.raci.A[0]??'');
  if(!coordinator||!accountable||stage.raci.A.length!==1)throw new Error('Configure feasibility coordination and one Accountable department.');
  return {stage,coordinator,accountable,reviewers:responsible.filter(d=>d.code!==coordinator.code)};
}

export function planFeasibilityDispatch(revision:LifecycleRevision, departments:FeasibilityDepartment[], selected:string[]) {
  const routing=feasibilityRouting(revision,departments);
  if(!selected.length||new Set(selected).size!==selected.length)throw new Error('Choose distinct participating feasibility departments.');
  const reviewers=selected.map(code=>{
    const department=routing.reviewers.find(d=>d.code===code);
    if(!department)throw new Error(`${code} is not a configured feasibility review department.`);
    if(!department.lead.trim())throw new Error(`Assign the ${code} lead in Settings before dispatch.`);
    if(!department.tasks.length)throw new Error(`Configure at least one CM_02 default task for ${code} before dispatch.`);
    return department;
  });
  if(!routing.coordinator.lead.trim())throw new Error('Assign the feasibility coordinator lead in Settings.');
  if(!routing.coordinator.tasks.length)throw new Error('Configure at least one CM_02 default task for the feasibility coordinator before dispatch.');
  const scopes=[routing.coordinator,...reviewers];
  return {...routing,reviewers,baseline:pinLifecycleRevision(revision),tasks:scopes.flatMap(d=>d.tasks.map(task=>({...task,departmentId:d.id,assignee:d.lead,reviewDepartment:d.code===routing.coordinator.code?'':d.code})))};
}
