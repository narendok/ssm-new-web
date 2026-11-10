import { CANONICAL_TRACK_METADATA, type CanonicalProjectTrack } from './canonical-lifecycle';
import { COMPANY_PHASES, pinLifecycleRevision, projectLifecycleStages, type LifecycleRevision } from './lifecycle-baseline';
import { departmentCode } from './department-scope';
import type { EnquiryOpportunity } from '../components/SalesWorkspaceAndCustomerRegister';

export const ROLE_LIFECYCLE_PACK = 'SCMS-ROLE-LIFECYCLE-2026-11-10-v1';
const areaMap = {SAL:'sales',EHW:'ehw',FW:'fw',SW:'sw',MECH:'mech',PUR:'pur',QA:'qa',EMF:'emf',MMF:'mmf',FIN:'fin',SIT:'sit',HR:'hrops'} as const;
type SampleDepartment = {id:string;code:string;name:string;lead:string;active:boolean};
export type RoleSampleRecord = {
  id:string; reference:string; type:string; title:string; area:(typeof areaMap)[keyof typeof areaMap];
  departmentId:string; status:'Draft'|'Open';priority:'Normal';createdAt:string;updatedAt:string;notes:string;fields:Record<string,string>;
};
export type RoleLifecyclePackManifest = {
  version:string;environment:'browser-local TEST';loadedAt:string;lifecycleRevision:string;
  configuration:{departments:{id:string;code:string;lead:string}[];phaseCount:number;stageCount:number;defaultTaskCount:number};
  records:string[];walkthroughs:{scenario:string;title:string;intendedTrack:CanonicalProjectTrack;enquiryId:string}[];
  checkpoints:{scenario:string;title:string;track:CanonicalProjectTrack;projectId:string;projectReference:string;applicableStages:number;plannedTasks:number;phaseCoverage:string[]}[];
  gaps:string[];
};
const scenarios: {key:string;title:string;track:CanonicalProjectTrack;internal?:boolean}[] = [
  {key:'LC2-P01',title:'Internal harness continuity jig',track:'hardware_only',internal:true},
  {key:'LC2-P05',title:'Existing controller firmware correction',track:'firmware_only'},
  {key:'LC2-P07',title:'Internal service application',track:'software_only',internal:true},
  {key:'LC2-P03',title:'Fleet tracker hardware and firmware PoC',track:'hardware_firmware'},
  {key:'LC2-P09',title:'Existing device connectivity upgrade',track:'firmware_software_existing_hardware'},
  {key:'LC2-P04',title:'Connected vehicle gateway pilot',track:'hardware_firmware_software'},
  {key:'LC2-P08',title:'Existing product deployment',track:'ready_made'},
];

/** Build additive fictional fixtures from the selected Settings revision, never from old sample defaults. */
export function buildRoleLifecyclePack(revision:LifecycleRevision, departments:SampleDepartment[], at:string) {
  const baseline=pinLifecycleRevision(revision);
  const active=departments.filter(d=>d.active&&d.code!=='CLIENT');
  const find=(code:string)=>{
    const d=active.find(d=>departmentCode(d.code.replace(/^DEMO-/,''))===code);
    if(!d || !areaMap[code as keyof typeof areaMap])throw new Error(`Configure the active ${code} department before loading lifecycle samples.`);
    return d;
  };
  const sales=find('SAL');
  const records:RoleSampleRecord[]=[];
  const enquiries:EnquiryOpportunity[]=[];
  const manifest:RoleLifecyclePackManifest={version:ROLE_LIFECYCLE_PACK,environment:'browser-local TEST',loadedAt:at,lifecycleRevision:revision.id,
    configuration:{departments:active.map(d=>({id:d.id,code:departmentCode(d.code.replace(/^DEMO-/,'')),lead:d.lead})),phaseCount:COMPANY_PHASES.length,stageCount:revision.stages.length,defaultTaskCount:revision.stages.reduce((n,s)=>n+s.tasks.length,0)},
    records:[],walkthroughs:[],checkpoints:[],gaps:[
      'Shared TEST deployment, authenticated role isolation and Android parity are not verified by this local pack.',
      'Later-phase execution, independent approvals and original-file upload remain walkthrough actions; no approval or attachment is seeded.',
      'Document profile imports and the missing SCMS_Expanded_Intake.json remain pending; planned profiles are not generated files.',
      'Supplemental declined-feasibility, research uncertainty and production-reconciliation checkpoints are not included in this initial seven-track load.',
    ]};
  const add=(key:string,type:string,title:string,department:string,fields:Record<string,string>,notes:string)=>{
    const d=find(department);
    const record:RoleSampleRecord={id:`${ROLE_LIFECYCLE_PACK}:${key}`,reference:`HLPL-ROLE-DEMO-${key}`,type,title:`TEST · ${title}`,area:areaMap[department as keyof typeof areaMap],departmentId:d.id,status:type==='Task'?'Open':'Draft',priority:'Normal',createdAt:at,updatedAt:at,notes,
      fields:{revision:'01',fixturePack:ROLE_LIFECYCLE_PACK,fixtureKey:key,testOnly:'true',...fields}};
    records.push(record);return record;
  };
  for(const [index,scenario] of scenarios.entries()){
    const n=String(index+1).padStart(2,'0');
    const enquiry=add(`ENQ-${n}`,'Enquiry',scenario.title,'SAL',{scope:scenario.internal?'Internal request':'Client request',owner:sales.lead,customer:scenario.internal?'Internal fictional TEST':`Fictional Test Customer ${index%2+1}`,demoIntendedTrack:scenario.track,fixtureMode:'walkthrough'},'Fresh request. Track is scenario intent only; no Project or accepted feasibility exists.');
    enquiries.push({id:enquiry.id,reference:enquiry.reference,kind:'enquiry',title:enquiry.title,customerCode:'',customerName:enquiry.fields['customer']??'Fictional TEST',spocName:'',spocEmail:'',scopeSummary:enquiry.notes,targetVolume:'Not recorded',targetClosureDate:'',salesOwner:sales.lead,status:'Pending Enquiry',feasibilitySignedDepts:[],totalFeasibilityDepts:0,createdAt:at,updatedAt:at});
    manifest.walkthroughs.push({scenario:scenario.key,title:scenario.title,intendedTrack:scenario.track,enquiryId:enquiry.id});
    const stages=projectLifecycleStages(revision,scenario.track);
    const entry=stages.find(s=>s.prerequisites.length===0);
    if(!entry)throw new Error(`${scenario.track}: no eligible entry stage in the selected lifecycle.`);
    const project=add(`PRJ-${n}`,'Project',`${scenario.title} · checkpoint`,entry.department,{track:scenario.track,projectTrack:scenario.track,scope:scenario.internal?'Internal':'Client',lifecycleBaseline:baseline,currentStage:entry.code,lifecycleStage:entry.code,completedStages:'[]',fixtureMode:'checkpoint',syntheticHistory:'Simulated prerequisite feasibility only; no executed review or signature',demoScenario:scenario.key},'Fictional project checkpoint for the selected track. No gate is completed and no approval, release, stock transaction or real business decision is represented.');
    const row={scenario:scenario.key,title:scenario.title,track:scenario.track,projectId:project.id,projectReference:project.reference,applicableStages:stages.length,plannedTasks:stages.reduce((n,s)=>n+s.tasks.length,0),phaseCoverage:[...new Set(stages.map(s=>s.phase))]};
    manifest.checkpoints.push(row);
    for(const task of entry.tasks){
      if(entry.raci&&!entry.raci.R.includes(task.department))throw new Error(`${entry.code}: task ${task.id} owner is outside Responsible departments.`);
      const owner=find(task.department);
      if(!owner.lead)manifest.gaps.push(`${task.department}: lead is unassigned; ${scenario.key}/${entry.code}/${task.id} needs assignment.`);
      add(`TASK-${n}-${task.id}`,'Task',task.title,task.department,{projectId:project.reference,projectCode:project.reference,stageCode:entry.code,lifecycleStage:entry.code,templateTaskKey:`${project.id}:${entry.code}:${task.id}`,lifecycleRevision:revision.id,assignee:owner.lead,workStatus:'To do'},task.description);
    }
  }
  for(const d of active){
    const code=departmentCode(d.code.replace(/^DEMO-/,''));
    if(!areaMap[code as keyof typeof areaMap]){manifest.gaps.push(`${code}: workspace mapping needed before role fixture creation.`);continue;}
    add(`ROLE-${code}`,'Task',`${d.name} role document readiness review`,code,{workflowKind:'operational',assignee:d.lead,workStatus:'To do',expectedAction:'Review applicable common documents, supported record types and role Docs Vault coverage',fixtureMode:'role-action'},'TEST operational review task. No generated document or audit completion is claimed.');
  }
  manifest.records=records.map(r=>r.id);
  return {manifest,records,enquiries,trackLabels:CANONICAL_TRACK_METADATA};
}
