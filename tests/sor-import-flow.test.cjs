const {test}=require('node:test'), assert=require('node:assert/strict');
const {importSharedSor}=require('../src/lib/sor-import-flow.ts');
const {parseSorText}=require('../src/lib/sor-extract.ts');

test('shared SOR import resumes failed review without duplicate records, values or approvals', async()=>{
  const data=parseSorText('Project: Test intake\nSystem Voltage: 12 V');data.feasibilityDepartments=['EHW','QA'];
  const run={signature:JSON.stringify(data),recordRequest:crypto.randomUUID(),approvalRequests:{}};
  let created=0,saves=0,fail=true;const records=new Map(),reviews=new Map();
  let sheet={id:'sheet',version:1,status:'Draft',parameter_values:{}};
  const ports={
    createRecord:async(payload,id)=>{assert.equal(payload.project_id,null);assert.equal(payload.fields.customer,'');if(!records.has(id)){created++;records.set(id,{id:'canonical-opportunity'});}return records.get(id);},
    createSheet:async(id)=>{assert.equal(id,'canonical-opportunity');return sheet;},
    saveInput:async(payload)=>{assert.equal(payload.expectedVersion,sheet.version);assert.equal(payload.finalValue,'');saves++;sheet={...sheet,version:sheet.version+1,parameter_values:{...sheet.parameter_values,[payload.parameterId]:{input:payload.input,source:payload.source,finalValue:''}}};return sheet;},
    requestReview:async(id,dept,request)=>{if(dept==='qa'&&fail){fail=false;throw Error('network');}reviews.set(request,{id,dept});},
  };
  await assert.rejects(importSharedSor(data,run,'sales',{EHW:'hw',QA:'qa'},new Set(['system_voltage']),ports),/Opportunity is saved.*incomplete/);
  assert.equal(await importSharedSor(data,run,'sales',{EHW:'hw',QA:'qa'},new Set(['system_voltage']),ports),'canonical-opportunity');
  assert.equal(created,1);assert.equal(saves,1);assert.equal(reviews.size,2);
  await assert.rejects(importSharedSor({...data,projectTitle:'Changed'},run,'sales',{EHW:'hw',QA:'qa'},new Set(['system_voltage']),ports),/different values/);
});

test('shared SOR import preserves existing agreed values and fails before dispatch',async()=>{
  const data=parseSorText('Project: Existing input\nSystem Voltage: 12 V');data.feasibilityDepartments=['EHW'];
  const run={signature:JSON.stringify(data),recordRequest:crypto.randomUUID(),approvalRequests:{}};
  let writes=0;
  const ports={createRecord:async()=>({id:'opportunity'}),createSheet:async()=>({id:'sheet',version:2,status:'Draft',parameter_values:{system_voltage:{input:'24 V',finalValue:'24 V'}}}),saveInput:async()=>{writes++;},requestReview:async()=>{writes++;}};
  await assert.rejects(importSharedSor(data,run,'sales',{EHW:'hw'},new Set(['system_voltage']),ports),/requires review; it was preserved/);
  assert.equal(writes,0);
});
