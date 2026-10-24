const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const m={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('src/lib/record-form-options.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m,m.exports);
const {procurementTrack,revisionOptions,referenceAtRevision,sharedSupplierOptions}=m.exports;
test('request types imply a procurement track; other types retain a choice',()=>{assert.equal(procurementTrack('Rapid prototype request'),'Rapid prototype');assert.equal(procurementTrack('Mass production request'),'Mass production');assert.equal(procurementTrack('PPAP Level 3'),undefined);});
test('revision sequence is scoped to the same controlled reference family',()=>{const records=[{reference:'HLPL-A-PUR-PPAP-01',fields:{revision:'01'}},{reference:'HLPL-A-PUR-PPAP-02',fields:{revision:'02'}},{reference:'HLPL-B-PUR-PPAP-99',fields:{revision:'99'}},{reference:'HLPL-A-EHW-PRS-50',fields:{revision:'50'}}];assert.equal(revisionOptions('HLPL-A-PUR-PPAP-01',records)[0].value,'03');assert.equal(revisionOptions('',records)[0].value,'01');assert.deepEqual(revisionOptions('HLPL-A-PUR-PPAP-02',records,'02').map(option=>option.value),['02','03']);assert.equal(referenceAtRevision('HLPL-A-PUR-PPAP-01','03'),'HLPL-A-PUR-PPAP-03');assert.equal(referenceAtRevision('HLPL-A-PUR-PPAP','01'),'HLPL-A-PUR-PPAP');});
test('supplier choices come only from actual accessible supplier records',()=>{const records=[{id:'a',title:'Supplier A',reference:'HLPL-SUP-A',record_type:'Supplier',status:'Draft'},{id:'b',title:'Unrelated',reference:'HLPL-OTHER',record_type:'ASL/ACML',status:'Draft'},{id:'c',title:'Retired',reference:'HLPL-SUP-C',record_type:'Supplier',status:'Archived'}];assert.deepEqual(sharedSupplierOptions(records),[{value:'a',label:'HLPL-SUP-A · Supplier A'}]);assert.deepEqual(sharedSupplierOptions([]),[]);});
test('automatic references bind project department type and revision without using titles',()=>{
 const {automaticRecordReference}=m.exports;
 assert.equal(automaticRecordReference('HLPL-OBD0374783-01','PUR','Mass production request','02'),'HLPL-OBD0374783-PUR-MASSPRODUCTIONREQUEST-02');
 assert.equal(automaticRecordReference('','PUR','PRS'),'');
 assert.equal(automaticRecordReference('HLPL-OBD-01','','PRS'),'');
 assert.notEqual(automaticRecordReference('HLPL-OBD-01','PUR','F-PUR-10'),automaticRecordReference('HLPL-OBD-01','PUR','F-PUR-16'));
 assert.notEqual(automaticRecordReference('HLPL-OBD-01','PUR','PRS'),automaticRecordReference('HLPL-OBD-01','EHW','PRS'));
 const reference=automaticRecordReference('HLPL-OBD-01','PUR','Rapid prototype request');
 const existing=[{reference,fields:{revision:'01'}}];
 const next=revisionOptions(reference,existing)[0].value;
 assert.equal(automaticRecordReference('HLPL-OBD-01','PUR','Rapid prototype request',next),'HLPL-OBD-PUR-RAPIDPROTOTYPEREQUEST-02');
 assert.equal(revisionOptions(automaticRecordReference('HLPL-OTHER-01','PUR','Rapid prototype request'),existing)[0].value,'01');
});
