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
