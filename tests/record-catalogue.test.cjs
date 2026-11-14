const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const output=ts.transpileModule(fs.readFileSync('src/lib/record-form-catalogue.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m={exports:{}};new Function('module','exports',output)(m,m.exports);
const {recordFormSpec,recordFields,recordFieldValues,hardwareStageForRecordType,hardwareAttachmentForRecordType}=m.exports;
for(const department of ['SAL','EHW','FW','SW','MECH','PUR','QA','EMF','MMF','FIN','SIT','HR']) {
 test(`${department}: every record type retains its fields and validates required input`,()=>{
  const spec=recordFormSpec(department);assert.ok(spec?.types.length);
  for(const type of spec.types){
   const input={revision:'02',hwStage:'unrelated',gate:'unrelated'};
   for(const field of recordFields(spec,type))input[field.key]=field.automaticValue || field.options?.[0] || (field.kind==='date'?'2026-10-25':'TEST');
   const saved=recordFieldValues(spec,type,input);
   assert.equal(saved.revision,'02');
   for(const field of recordFields(spec,type))assert.equal(saved[field.key],field.automaticValue || input[field.key]);
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
 const hardwareStages={PRS:'HW_02','Hardware tracker':'HW_01',Schematic:'HW_15',BOM:'HW_19','Gerber release':'HW_24'};
 for(const [type,stage] of Object.entries(hardwareStages)){
  const field=recordFields(recordFormSpec('EHW'),type).find(item=>item.key==='hwStage');
  assert.equal(field.readOnly,true,type);assert.equal(field.automaticValue,stage,type);
  assert.equal(recordFieldValues(recordFormSpec('EHW'),type,{hwStage:'HW_37'}).hwStage,stage,type);
 }
 assert.equal(hardwareStageForRecordType('unknown'),undefined);
 const attachments={PRS:['Technical document','HW_02'],'Hardware tracker':['Technical document','HW_01'],Schematic:['Schematic PDF','HW_15'],BOM:['BOM','HW_19'],'Gerber release':['Gerber ZIP','HW_24']};
 for(const [type,[documentType,stageCode]] of Object.entries(attachments)){
  const attachment=hardwareAttachmentForRecordType(type);
  assert.equal(attachment.documentType,documentType,type);
  assert.equal(attachment.stageCode,stageCode,type);
  assert.ok(attachment.label,type);
  assert.ok(attachment.accept,type);
 }
 assert.equal(hardwareAttachmentForRecordType('unknown'),undefined);
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
test('shared master choices preserve distinct canonical identities and exclude inactive records',()=>{
 const code=ts.transpileModule(fs.readFileSync('src/lib/shared-master-options.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const mod={exports:{}};new Function('module','exports',code)(mod,mod.exports);
 const records=[{id:'part-a',reference:'PART-A',record_type:'Part',title:'Resistor A',status:'Draft',fields:{mpn:'SAME'}},{id:'part-b',reference:'PART-B',record_type:'Part',title:'Resistor B',status:'Released',fields:{mpn:'SAME'}},{id:'old',reference:'OLD',record_type:'Part',title:'Old',status:'Archived',fields:{}},{id:'obsolete',reference:'OBS',record_type:'Part',title:'Obsolete',status:'Obsolete',fields:{}},{id:'rejected',reference:'REJ',record_type:'Part',title:'Rejected',status:'Rejected',fields:{}},{id:'inactive',reference:'OFF',record_type:'Part',title:'Inactive',status:'Inactive',fields:{}},{id:'customer',reference:'CUS',record_type:'Customer',title:'Client',status:'Open',fields:{}}];
 const options=mod.exports.sharedMasterOptions(records,['Part']);assert.deepEqual(options.map(o=>o.value),['part-a','part-b']);assert.equal(new Set(options.map(o=>o.label)).size,2);
 assert.deepEqual(mod.exports.sharedMasterOptions([],['Customer']),[]);
 assert.equal(mod.exports.isSelectableMasterStatus('Draft'),true);
 assert.equal(mod.exports.isSelectableMasterStatus('rejected'),false);
 assert.equal(mod.exports.isSelectableMasterStatus('inactive'),false);
});
test('EHW record creation can attach its original in the same modal with idempotent retry',()=>{
 const component=fs.readFileSync('src/components/SharedOperationalWorkspace.tsx','utf8');
 assert.match(component,/hardwareAttachmentForRecordType/);
 assert.match(component,/Save record & upload original/);
 assert.match(component,/registerDocument\(\{ data:/);
 assert.match(component,/uploadRecordAttachment\(documentId, recordFile, linkedRecord\.revision\)/);
 assert.match(component,/scope:\s*"internal"/);
 assert.match(component,/recordId:\s*linkedRecord\.id/);
 assert.match(component,/createRecordRequestId\.current \|\|= crypto\.randomUUID\(\)/);
 assert.match(component,/keep it selected and retry/);
 assert.match(component,/It is not approved or released/);
 assert.match(component,/Legacy stage label:/);
 assert.match(component,/canonical stage code not recorded/);
 assert.match(component,/projectStageCandidates\.find\(code=>configuredRecordStages\.some/);
 const sharedTest=fs.readFileSync('src/components/SharedTestWorkspace.tsx','utf8');
 assert.match(sharedTest,/Save record & upload original/);
 assert.match(sharedTest,/saveRecordWithOriginal\(payload\)/);
 assert.match(sharedTest,/registerDocument\(\{data:/);
 assert.match(sharedTest,/completeUpload\(\{data:\{fileId:uploadResult\.file\.id\}\}\)/);
 assert.match(sharedTest,/recordAttachmentAllowed/);
 assert.match(sharedTest,/Draft\. It is not approved or released/);
 assert.match(sharedTest,/Legacy stage label:/);
 assert.match(sharedTest,/recordProjectStageCandidates\.find\(code=>configuredRecordStages\.some/);
});
