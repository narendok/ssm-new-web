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
test('start readiness requires every linked department review, never an unrelated approval',()=>{
  const {assertFeasibilityReviewsReady}=load('feasibility-routing');
  const contract={id:'c1',reference:'TEST-C1',fields:{enquiryId:'e1',requiredDepartments:'FW,QA'}};
  const approvals=[{id:'a1',recordId:'c1',approverAuthority:'FW',outcome:'Approved'},{id:'a2',recordId:'TEST-C1',approverAuthority:'QA',outcome:'Approved'}];
  assert.deepEqual(assertFeasibilityReviewsReady(contract,approvals,'e1').reviewIds,['a1','a2']);
  for(const outcome of ['Pending','Rejected','Returned'])assert.throws(()=>assertFeasibilityReviewsReady(contract,[approvals[0],{...approvals[1],outcome}],'e1'),/QA/);
  assert.throws(()=>assertFeasibilityReviewsReady(contract,[approvals[0],{...approvals[1],recordId:'other'}],'e1'),/QA/);
  assert.throws(()=>assertFeasibilityReviewsReady(contract,[...approvals,{...approvals[1],id:'duplicate'}],'e1'),/QA/);
  assert.throws(()=>assertFeasibilityReviewsReady({...contract,archived:true},approvals,'e1'),/current/);
  assert.throws(()=>assertFeasibilityReviewsReady(contract,approvals,'other-enquiry'),/current/);
  assert.throws(()=>assertFeasibilityReviewsReady({...contract,fields:{...contract.fields,requiredDepartments:''}},approvals,'e1'),/missing/);
});
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
  const customerRecords=pack.records.filter(r=>r.type==='Customer');
  assert.equal(customerRecords.length,2);
  assert.equal(pack.customers.length,2);
  assert.ok(pack.customers.every(c=>customerRecords.some(r=>r.id===c.id&&r.reference===c.code)));
  assert.ok(pack.customers.every(c=>!c.spocName&&!c.spocEmail&&!c.spocPhone&&!c.gstin),"fictional sample masters do not invent personal, tax or contact details");
  assert.ok(pack.enquiries.every(e=>!e.projectTrack&&!e.linkedProjectCode&&e.status==='Pending Enquiry'));
  const projects=pack.records.filter(r=>r.type==='Project');
  assert.equal(projects.filter(p=>p.fields.scope==='Client').length,5);
  assert.ok(projects.filter(p=>p.fields.scope==='Client').every(p=>{
    const customer=pack.customers.find(c=>c.id===p.fields.customerId);
    return customer&&p.fields.customer_id===customer.id&&p.fields.customerCode===customer.code&&p.fields.customer===customer.name;
  }),"client project checkpoints bind the exact canonical fictional Customer identity");
  assert.ok(projects.filter(p=>p.fields.scope==='Internal').every(p=>!p.fields.customerId&&!p.fields.customer_id),"internal projects do not receive an external Customer link");
  assert.ok(pack.enquiries.filter(e=>e.customerId).every(e=>pack.customers.some(c=>c.id===e.customerId&&c.code===e.customerCode)),"client enquiries and projects use the same canonical customer master");
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
test('customer-link refresh upgrades only unchanged fictional sample rows and preserves edits or conflicts',()=>{
  const {linkUnchangedRoleSampleProject,linkUnchangedRoleSampleEnquiry}=load('role-lifecycle-samples');
  const pack=buildRoleLifecyclePack(defaultLifecycleRevision(),departments,'2026-11-14T12:00:00Z');
  const expectedProject=pack.records.find(r=>r.type==='Project'&&r.fields.scope==='Client');
  const expectedEnquiry=pack.enquiries.find(e=>e.customerId);
  assert.ok(expectedProject&&expectedEnquiry);
  const {customerId,customer_id,customerCode,customerName,...oldFields}=expectedProject.fields;
  const oldProject={...expectedProject,fields:oldFields};
  const linkedProject=linkUnchangedRoleSampleProject(oldProject,expectedProject);
  assert.equal(linkedProject.fields.customerId,expectedProject.fields.customerId);
  assert.equal(linkedProject.fields.customer_id,expectedProject.fields.customerId);
  const editedProject={...oldProject,fields:{...oldFields,customer:'Manually edited label'}};
  assert.equal(linkUnchangedRoleSampleProject(editedProject,expectedProject),editedProject);
  const conflictingProject={...oldProject,fields:{...oldFields,customerId:'another-id'}};
  assert.equal(linkUnchangedRoleSampleProject(conflictingProject,expectedProject),conflictingProject);
  const oldEnquiry={...expectedEnquiry,customerId:undefined,customerCode:''};
  assert.equal(linkUnchangedRoleSampleEnquiry(oldEnquiry,expectedEnquiry).customerId,expectedEnquiry.customerId);
  const editedEnquiry={...oldEnquiry,customerName:'Manually edited customer'};
  assert.equal(linkUnchangedRoleSampleEnquiry(editedEnquiry,expectedEnquiry),editedEnquiry);
});
test('missing task-owning department blocks construction instead of assigning unrelated work',()=>{
  const revision=defaultLifecycleRevision();
  const first=revision.stages.find(s=>s.code==='CM_01');first.tasks[0].department='EHW';first.raci.R.push('EHW');
  assert.throws(()=>buildRoleLifecyclePack(revision,departments.filter(d=>d.code!=='EHW'),'2026-11-10'),/Configure the active EHW/);
});
test('feasibility routes variable defaults and multiple department ownership from the selected settings',()=>{
  const {feasibilityRouting,planFeasibilityDispatch}=load('feasibility-routing');
  const revision=defaultLifecycleRevision();
  const stage=revision.stages.find(s=>s.code==='CM_02');
  stage.raci={R:['SAL','FW','QA'],A:['FIN'],C:[],I:[]};
  stage.tasks=[
    {id:'COORD',title:'Consolidate request',description:'Coordinator source',department:'SAL'},
    {id:'FW-A',title:'Configured interface review',description:'First review',department:'FW'},
    {id:'FW-B',title:'Configured resource review',description:'Second review',department:'FW'},
    {id:'QA-A',title:'Quality applicability review',description:'QA review',department:'QA'},
  ];
  const configured=departments.map(d=>['FW','QA'].includes(d.code)?{...d,lead:'Fictional multi-department lead'}:d);
  assert.deepEqual(feasibilityRouting(revision,configured).reviewers.map(d=>d.code),['FW','QA']);
  const plan=planFeasibilityDispatch(revision,configured,['FW','QA']);
  assert.equal(plan.accountable.code,'FIN');
  assert.equal(plan.tasks.length,4);
  assert.equal(plan.tasks.filter(t=>t.assignee==='Fictional multi-department lead').length,3);
  assert.equal(plan.tasks.find(t=>t.id==='FW-B').reviewDepartment,'FW');
  assert.equal(plan.tasks.find(t=>t.id==='COORD').reviewDepartment,'');
  assert.equal(planFeasibilityDispatch(revision,configured,['QA']).tasks.length,2);
  const pinned=plan.baseline;stage.tasks[1].title='Later title';
  assert.equal(JSON.parse(pinned).stages.find(s=>s.code==='CM_02').tasks[1].title,'Configured interface review');
  assert.throws(()=>planFeasibilityDispatch(revision,configured,['FW','FW']),/distinct/);
  assert.throws(()=>planFeasibilityDispatch(revision,configured,['EHW']),/not a configured/);
  assert.throws(()=>planFeasibilityDispatch(revision,configured.map(d=>d.code==='FW'?{...d,active:false}:d),['QA']),/unavailable/);
  assert.throws(()=>planFeasibilityDispatch(revision,configured.map(d=>d.code==='FW'?{...d,lead:''}:d),['FW']),/Assign the FW lead/);
  stage.tasks=stage.tasks.filter(t=>t.department!=='FW');
  assert.throws(()=>planFeasibilityDispatch(revision,configured,['FW']),/at least one CM_02 default/);
  stage.tasks=stage.tasks.filter(t=>t.department!=='SAL');
  assert.throws(()=>planFeasibilityDispatch(revision,configured,['QA']),/default task for the feasibility coordinator/);
});
