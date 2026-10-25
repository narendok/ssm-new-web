const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const output=ts.transpileModule(fs.readFileSync('src/lib/record-form-catalogue.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m={exports:{}};new Function('module','exports',output)(m,m.exports);
const {recordFormSpec,recordFields,recordFieldValues}=m.exports;
for(const department of ['SAL','EHW','FW','SW','MECH','PUR','QA','EMF','MMF','FIN','SIT','HR']) {
 test(`${department}: every record type retains its fields and validates required input`,()=>{
  const spec=recordFormSpec(department);assert.ok(spec?.types.length);
  for(const type of spec.types){
   const input={revision:'02',hwStage:'unrelated',gate:'unrelated'};
   for(const field of recordFields(spec,type))input[field.key]=field.options?.[0] || (field.kind==='date'?'2026-10-25':'TEST');
   const saved=recordFieldValues(spec,type,input);
   assert.equal(saved.revision,'02');
   for(const field of recordFields(spec,type))assert.equal(saved[field.key],input[field.key]);
   const required=recordFields(spec,type).find(field=>field.required);
   if(required)assert.throws(()=>recordFieldValues(spec,type,{...input,[required.key]:''}),/required/);
   for(const key of ['hwStage','gate'])if(!recordFields(spec,type).some(field=>field.key===key))assert.equal(saved[key],undefined);
  }
  assert.throws(()=>recordFieldValues(spec,'Wrong department type',{}),/Choose a record type/);
 });
}
test('legacy department aliases retain the same catalogue',()=>{
 for(const [alias,canonical] of [['SALES','SAL'],['HROPS','HR'],['EFW','FW'],['CSW','SW']])assert.equal(recordFormSpec(alias),recordFormSpec(canonical));
 assert.equal(recordFormSpec('UNKNOWN'),undefined);
 assert.equal(recordFields(recordFormSpec('EHW'),'PRS').some(field=>field.key==='hwStage'),false);
});

test('Purchasing selects prototype or mass production once, through record type only',()=>{
 const spec=recordFormSpec('PUR');
 for(const type of spec.types)assert.equal(recordFields(spec,type).some(field=>field.key==='procurementTrack'),false);
 assert.equal(recordFieldValues(spec,'Rapid prototype request',{}).procurementTrack,'Rapid prototype');
 assert.equal(recordFieldValues(spec,'Mass production request',{}).procurementTrack,'Mass production');
 assert.equal(recordFieldValues(spec,'F-PUR-10',{}).procurementTrack,undefined);
});

test('all catalogue entries inherit company location instead of requiring repeated entry',()=>{
 for(const spec of Object.values(m.exports.formSpecs))for(const type of spec.types){
  assert.equal(recordFields(spec,type).some(f=>f.master==='locations'),false, type);
  const values={};for(const field of recordFields(spec,type))if(field.required)values[field.key]=field.options?.[0] || 'TEST';
  assert.doesNotThrow(()=>recordFieldValues(spec,type,values),type);
 }
});
test('shared master choices preserve distinct canonical identities even with duplicate MPNs',()=>{
 const code=ts.transpileModule(fs.readFileSync('src/lib/shared-master-options.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const mod={exports:{}};new Function('module','exports',code)(mod,mod.exports);
 const records=[{id:'part-a',reference:'PART-A',record_type:'Part',title:'Resistor A',status:'Draft',fields:{mpn:'SAME'}},{id:'part-b',reference:'PART-B',record_type:'Part',title:'Resistor B',status:'Released',fields:{mpn:'SAME'}},{id:'old',reference:'OLD',record_type:'Part',title:'Old',status:'Archived',fields:{}},{id:'customer',reference:'CUS',record_type:'Customer',title:'Client',status:'Open',fields:{}}];
 const options=mod.exports.sharedMasterOptions(records,['Part']);assert.deepEqual(options.map(o=>o.value),['part-a','part-b']);assert.equal(new Set(options.map(o=>o.label)).size,2);
 assert.deepEqual(mod.exports.sharedMasterOptions([],['Customer']),[]);
});
