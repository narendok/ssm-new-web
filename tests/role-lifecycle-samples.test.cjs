const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function load(name) {
  if(cache.has(name))return cache.get(name);
  const mod={exports:{}};cache.set(name,mod.exports);
  const source=fs.readFileSync(path.join(__dirname,'../src/lib',`${name}.ts`),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('module','exports','require',js)(mod,mod.exports,s=>s.startsWith('./')?load(s.slice(2)):require(s));
  return mod.exports;
}
const {buildRoleLifecyclePack}=load('role-lifecycle-samples');
const {defaultLifecycleRevision}=load('lifecycle-baseline');
const departments=Object.keys(load('department-modules').DEPARTMENT_MODULES).map(code=>({id:`test-${code}`,code:code==='HR'?'HROPS':code,name:code,active:true,lead:`Fictional ${code} lead`}));
test('updated pack uses seven pinned track checkpoints and genuinely pre-project requests',()=>{
  const revision=defaultLifecycleRevision();
  const first=revision.stages.find(s=>s.code==='CM_01');
  first.tasks[0].title='Configured current intake task';
  first.tasks[0].department='EHW';first.raci.R.push('EHW');
  const pack=buildRoleLifecyclePack(revision,departments,'2026-11-10T12:00:00Z');
  assert.equal(pack.manifest.checkpoints.length,7);
  assert.equal(new Set(pack.manifest.checkpoints.map(x=>x.track)).size,7);
  assert.equal(pack.enquiries.length,7);
  assert.ok(pack.enquiries.every(e=>!e.projectTrack&&!e.linkedProjectCode&&e.status==='Pending Enquiry'));
  assert.equal(new Set(pack.records.map(r=>r.id)).size,pack.records.length);
  assert.equal(new Set(pack.records.map(r=>r.reference)).size,pack.records.length);
  const tasks=pack.records.filter(r=>r.type==='Task'&&r.fields.projectId);
  assert.equal(tasks.length,7*first.tasks.length);
  assert.ok(tasks.every(t=>t.fields.stageCode==='CM_01'));
  assert.equal(tasks.filter(t=>t.fields.assignee==='Fictional EHW lead'&&t.title.includes('Configured current intake task')).length,7);
  assert.ok(pack.records.filter(r=>r.type==='Project').every(p=>JSON.parse(p.fields.lifecycleBaseline).id===revision.id&&p.fields.completedStages==='[]'&&p.fields.syntheticHistory));
  assert.equal(pack.records.filter(r=>r.fields.workflowKind==='operational').length,12);
  assert.ok(pack.manifest.checkpoints.every(c=>c.applicableStages>0&&c.plannedTasks>=first.tasks.length));
  const replay=buildRoleLifecyclePack(revision,departments,'2026-11-11T12:00:00Z');
  assert.deepEqual(pack.manifest.records,replay.manifest.records);
  revision.stages[0].tasks[0].title='Later change';
  assert.ok(JSON.parse(pack.records.find(r=>r.type==='Project').fields.lifecycleBaseline).stages.find(s=>s.code==='CM_01').tasks[0].title!=='Later change');
});
test('missing task-owning department blocks construction instead of assigning unrelated work',()=>{
  const revision=defaultLifecycleRevision();
  const first=revision.stages.find(s=>s.code==='CM_01');first.tasks[0].department='EHW';first.raci.R.push('EHW');
  assert.throws(()=>buildRoleLifecyclePack(revision,departments.filter(d=>d.code!=='EHW'),'2026-11-10'),/Configure the active EHW/);
});
