const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,require){const m={exports:{}};new Function('module','exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText)(m,m.exports,require);return m.exports;}
const input=load('src/lib/project-inputs.ts',()=>JSON.parse(fs.readFileSync('src/lib/project-input-template.json','utf8')));
const {readAssessmentDraft}=load('src/lib/assessment-drafts.ts',()=>input);
const row={status:'Conditional',remarks:'Transient test evidence pending',evidence:'',ownerId:'',dueDate:'',authorId:'',reviewedBy:''};
test('department draft recovery retains unfinished assessments without manufacturing approval',()=>{
  const raw=JSON.stringify({revision:2,version:5,values:{system_voltage:row}});
  assert.deepEqual(readAssessmentDraft(raw,2),{version:5,values:{system_voltage:row}});
  assert.equal(readAssessmentDraft(raw,3),undefined);
  assert.equal(readAssessmentDraft(raw,2).values.system_voltage.reviewedBy,'');
});
test('department draft recovery rejects corrupt, invalid-state and malformed stored fields',()=>{
  assert.equal(readAssessmentDraft('{broken',2),undefined);
  for(const bad of [{...row,status:'Approved'},{...row,remarks:12},null]) assert.equal(readAssessmentDraft(JSON.stringify({revision:2,version:5,values:{system_voltage:bad}}),2),undefined);
});
