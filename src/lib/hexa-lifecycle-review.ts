import { HEXA_PHASES, HEXA_STAGES } from './hexa-workbook-source';
import type { LifecycleRevision } from './lifecycle-baseline';
import { DEPARTMENT_MODULES } from './department-modules';
const sourceStageCode=(stage:{row:number;code:string})=>stage.row===77?'G8_04':stage.code;

/** Match stable identifiers only. Unresolved identities never acquire invented authority. */
export function reviewHexaWorkbook(revision: LifecycleRevision) {
  const known = new Set(revision.stages.map(stage => stage.code));
  return {
    phases: HEXA_PHASES,
    matched: HEXA_STAGES.filter(stage => known.has(sourceStageCode(stage))),
    unresolved: HEXA_STAGES.filter(stage => !known.has(sourceStageCode(stage))),
    retained: revision.stages.filter(stage => !HEXA_STAGES.some(source => sourceStageCode(source) === stage.code)),
  };
}

/** Explicit, reversible settings draft; preserve routing, prerequisites, exits and custom work. */
export function applyHexaStageCorrections(revision: LifecycleRevision): LifecycleRevision {
  return {...structuredClone(revision), stages: revision.stages.map(stage => {
    const source = HEXA_STAGES.find(row => sourceStageCode(row) === stage.code);
    const aliases = {...HEXA_CONFIRMED_ROLE_DEPARTMENTS, ...revision.roleDepartments};
    const owner = source ? aliases[source.track] || source.track : stage.department;
    const department = DEPARTMENT_MODULES[owner] ? owner : stage.department;
    return source ? {...structuredClone(stage), name: source.name, phase: source.phase,
      department,
      tasks: stage.tasks.map(task=>({...task,department:task.department===stage.department ? department : task.department})),
      ...(stage.raci ? {raci:{...structuredClone(stage.raci),R:[...new Set([...stage.raci.R,department])]}} : {}),
      sourceReference:{workbook:'New Hexa Format.xlsx',sheet:'HW+FW+SW',row:source.row,deliverables:source.deliverables,preparer:source.preparer,reviewer:source.reviewer},
    } : structuredClone(stage);
  })};
}

export function applyHexaTaskDefaults(revision: LifecycleRevision): LifecycleRevision {
  return {...structuredClone(revision), stages: revision.stages.map(stage=>{
    const source=HEXA_STAGES.find(row=>sourceStageCode(row)===stage.code);
    if(!source)return structuredClone(stage);
    const tasks=source.tasks.map((title,index)=>({id:`HEXA-${source.row}-T${index+1}`,title,description:title,department:stage.tasks[index]?.department ?? stage.department}));
    const raci=stage.raci ? {...structuredClone(stage.raci),R:[...new Set([...stage.raci.R,stage.department,...tasks.map(task=>task.department)])]} : undefined;
    return {...structuredClone(stage),tasks,...(raci?{raci}:{})};
  })};
}

export const HEXA_ROLE_ALIASES = ['PM', 'CFT', 'OPS', 'SCM', 'Service', 'Admin', 'MMF'] as const;
/** User clarification: CFT and PM are Operations, currently the HR & Operations module. */
export const HEXA_CONFIRMED_ROLE_DEPARTMENTS: Record<string,string> = {PM:'HR', CFT:'HR', OPS:'HR', MMF:'MMF'};

export function resolveHexaDepartments(raw: string, aliases: Record<string,string>, known: Set<string>) {
  const tokens = raw.split(',').flatMap(value => (value.trim().split('(')[0]||'').trim().split('/')).map(value=>value.trim()).filter(Boolean);
  const unresolved = tokens.filter(token => !(aliases[token] && known.has(aliases[token])) && !known.has(token));
  return {departments: [...new Set(tokens.map(token => aliases[token] || token).filter(code => known.has(code)))], unresolved};
}

/** Routing changes are a separate explicit draft action, after reviewing department aliases. */
export function applyHexaRaci(revision: LifecycleRevision, known: Set<string>): LifecycleRevision {
  const aliases = {...HEXA_CONFIRMED_ROLE_DEPARTMENTS, ...revision.roleDepartments};
  return {...structuredClone(revision), roleDepartments: aliases, stages: revision.stages.map(stage => {
    const source = HEXA_STAGES.find(row => sourceStageCode(row) === stage.code);
    if (!source) return structuredClone(stage);
    const raci = structuredClone(stage.raci ?? {R:[stage.department], A:[stage.department], C:[], I:[]});
    for (const [role, raw] of [['R',source.responsible],['A',source.accountable],['C',source.consulted],['I',source.informed]] as const) {
      const result = resolveHexaDepartments(raw, aliases, known);
      if (!result.unresolved.length && (role !== 'A' || result.departments.length === 1) && (role !== 'R' || result.departments.length)) raci[role] = result.departments;
    }
    // Existing executing task owners keep responsibility; importing a group never orphans work.
    raci.R = [...new Set([...raci.R, stage.department, ...stage.tasks.map(task=>task.department)])];
    return {...structuredClone(stage), raci};
  })};
}
