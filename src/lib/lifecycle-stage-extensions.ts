import { HEXA_STAGES } from './hexa-workbook-source';
import type { LifecycleStageDefinition } from './lifecycle-baseline';
import { resolveHexaDepartments } from './hexa-lifecycle-review';
import { DEPARTMENT_MODULES } from './department-modules';

const ALL = ['hardware_only','firmware_only','software_only','hardware_firmware','firmware_software_existing_hardware','hardware_firmware_software','ready_made'];
const HW = ['hardware_only','hardware_firmware','hardware_firmware_software'];
const FW = ['firmware_only','hardware_firmware','firmware_software_existing_hardware','hardware_firmware_software'];
const SW = ['software_only','firmware_software_existing_hardware','hardware_firmware_software'];
export const LIFECYCLE_ROLE_DEPARTMENTS: Record<string,string> = {PM:'HR',CFT:'HR',OPS:'HR',MMF:'MMF',SCM:'PUR',Service:'SIT'};
/** Row 77 has no code in the reference. Allocate the next unused Phase-8 identifier. */
export const finalizedSourceStageCode = (row:{row:number;code:string}) => row.row===77 ? 'G8_04' : row.code;
const dependencies: Record<string,string[]> = {
  G0_01:['CM_01'], G0_02:['G0_01'], G0_03:['G0_01'], G0_04:['G0_01'], G0_05:['G0_01'],
  G0_06:['G0_02','G0_03','G0_04','G0_05'], G2_01:['HW_06','HW_12'],
  G7_01:['FW_12','FW_13'], G7_02:['HW_34','G7_01'], G7_03:['HW_32','G7_02'], G7_04:['HW_34','HW_08'],
  G8_01:['G7_03','G7_04','HW_35','HW_36'], G8_02:['G7_02','G8_01'], G8_03:['HW_35','FW_12','G8_01'], G8_04:['G8_02','G8_03'],
  G9_01:['G8_04','SW_11','FW_13'], G9_02:['G9_01'], G9_03:['G9_01'],
  G9_04:['G9_02','G9_03'], G9_05:['G9_04'], G9_06:['G9_05'],
};
export function extensionApplicableTracks(code:string): string[] {
  if(['G0_02','G0_03','G2_01','G7_02','G7_04','G8_01','G8_02','G8_03','G8_04'].includes(code))return [...HW];
  if(['G0_04','G7_01'].includes(code))return [...FW];
  if(code==='G0_05')return [...SW];
  return [...ALL];
}
export const STAGE_DELIVERABLE_BINDINGS = HEXA_STAGES.map(row=>{
  const code=finalizedSourceStageCode(row);
  const family = row.phase==='TG_0' ? 'D05' : code==='G7_04' ? 'D18' : code==='G8_01' ? 'D19' : code==='G9_02' ? 'D26' : code==='G9_03' ? 'D30' : code==='G9_04' ? 'D25' : code==='G9_05' ? 'D10' : /^G[789]_/.test(code) ? 'D32' : code==='HW_37' ? 'D31' : row.track==='QA' ? 'D13' : 'D10';
  return {stage:code,recordType:`Stage evidence · ${code}`,family,title:row.name,department:LIFECYCLE_ROLE_DEPARTMENTS[row.track]||row.track,
    original:['HW_15','HW_17','HW_20','HW_21','HW_24','HW_26','HW_35','HW_37','FW_12','G8_03','G9_05'].includes(code),
    deliverables:row.deliverables, row:row.row};
});
export function additionalLifecycleStages():LifecycleStageDefinition[] {
  const known=new Set(Object.keys(DEPARTMENT_MODULES));
  return HEXA_STAGES.filter(row=>row.code.startsWith('G')||row.row===77).map(row=>{
    const code=finalizedSourceStageCode(row), department=LIFECYCLE_ROLE_DEPARTMENTS[row.track]||row.track;
    const resolve=(value:string)=>resolveHexaDepartments(value,LIFECYCLE_ROLE_DEPARTMENTS,known).departments;
    const tasks=row.tasks.map((title,index)=>({id:`T${String(index+1).padStart(2,'0')}`,title,description:title,department}));
    const binding=STAGE_DELIVERABLE_BINDINGS.find(item=>item.stage===code)!;
    return {code,name:row.name,phase:row.phase,gate:row.phase.replace('_','-'),department,
      prerequisites:[...(dependencies[code]||[])],exitTypes:[binding.recordType],optional:code==='G2_01'||code==='G8_01',tasks,
      raci:{R:[...new Set([...resolve(row.responsible),department])],A:resolve(row.accountable),C:resolve(row.consulted),I:resolve(row.informed)},
      sourceReference:{workbook:'New Hexa Format.xlsx',sheet:'HW+FW+SW',row:row.row,deliverables:row.deliverables,preparer:row.preparer,reviewer:row.reviewer},
    };
  });
}

/** Publish a new configuration; never mutate a pinned project or generated task. */
export function completeLifecycleDefinitions(revision:{stages:LifecycleStageDefinition[]}):LifecycleStageDefinition[] {
  const additional=additionalLifecycleStages();
  if(additional.every(stage=>revision.stages.some(existing=>existing.code===stage.code)))return structuredClone(revision.stages);
  return [...revision.stages.map(stage=>{
    const binding=STAGE_DELIVERABLE_BINDINGS.find(item=>item.stage===stage.code);
    const exits=stage.exitTypes.length ? [...stage.exitTypes] : binding ? [binding.recordType] : [];
    // Technical sizing feeds the shared feasibility decision before requirements are frozen.
    const prerequisites=stage.code==='CM_02' ? [...new Set([...stage.prerequisites,'G0_06'])] : [...stage.prerequisites];
    const tasks=stage.code==='CM_02' ? [...stage.tasks,...Object.keys(DEPARTMENT_MODULES).filter(code=>!stage.tasks.some(task=>task.department===code)).map(code=>({id:`FEASIBILITY-${code}`,title:`Review ${code} feasibility inputs`,description:'Assess source requirements, assumptions, effort, budget dependencies and unresolved questions for this department.',department:code}))] : stage.tasks;
    const raci=stage.code==='CM_02' ? {...(stage.raci||{A:[stage.department],C:[],I:[]}),R:Object.keys(DEPARTMENT_MODULES)} : stage.raci;
    return {...structuredClone(stage),prerequisites,exitTypes:exits,tasks:structuredClone(tasks),...(raci?{raci}: {})};
  }),...additional.filter(stage=>!revision.stages.some(existing=>existing.code===stage.code))];
}
