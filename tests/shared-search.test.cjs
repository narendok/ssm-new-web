const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const output=ts.transpileModule(fs.readFileSync('src/lib/shared-search-data.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m={exports:{}};new Function('module','exports',output)(m,m.exports);
const {sharedSearchResults,filterSharedSearch}=m.exports;
test('shared search preserves canonical destinations and finds decision evidence',()=>{
 const rows=sharedSearchResults({records:[{id:'project-uuid',title:'Tracker',record_type:'Project',reference:'P01',notes:''}],tasks:[],documents:[{id:'document-uuid',title:'Tracker',document_type:'PRS'}]},undefined,{entries:[{id:'decision-uuid',title:'Exception',department_code:'EHW',status:'Recorded',rationale:'supply shortage',conditions:'pilot only',source_references:['REQ-41']}]});
 assert.equal(filterSharedSearch(rows,'REQ-41')[0].id,'decision-uuid');
 assert.equal(filterSharedSearch(rows,'shortage')[0].view,'decisions');
 assert.equal(filterSharedSearch(rows,'Tracker','Document')[0].id,'document-uuid');
 assert.equal(filterSharedSearch(rows,'Tracker','Project')[0].id,'project-uuid');
});
test('unavailable sources never supply browser examples',()=>assert.deepEqual(sharedSearchResults(undefined,undefined,undefined),[]));
test('deduplication retains distinct destination identities and searches tags',()=>{
 const rows=sharedSearchResults(undefined,{items:[{id:'one',kind:'message',data:{text:'Review',tags:['pilot']}}]},undefined);
 const result=filterSharedSearch([...rows,...rows,{...rows[0],view:'Records'}],'PILOT');
 assert.equal(result.length,2);
 assert.deepEqual(result.map(r=>r.view),['communication','Records']);
});
