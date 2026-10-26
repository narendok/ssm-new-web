const {test}=require('node:test');
const assert=require('node:assert/strict');
const {personalAssignments,budgetSummaries}=require('../src/lib/business-presentation.ts');
const item=(id,kind,data={},ownerId=null)=>({id,kind,data,ownerId,departmentId:null,projectId:null,version:1});
test('personal sections retain only own assignments, matched to the actual published template',()=>{
  const rows=[item('p','template',{type:'policy'}),item('s','template',{type:'survey'}),item('mine','assignment',{templateId:'p'},'me'),item('other','assignment',{templateId:'p'},'lead'),item('survey','assignment',{templateId:'s'},'me'),item('orphan','assignment',{templateId:'missing'},'me')];
  assert.deepEqual(personalAssignments(rows,'me','policy').map(x=>x.id),['mine']);
  assert.deepEqual(personalAssignments(rows,'me','form').map(x=>x.id),['survey']);
  assert.deepEqual(personalAssignments(rows,'unknown','policy'),[]);
});
test('budget cards separate currencies, subtract commitments once, and never count claims as allocations',()=>{
  const rows=[item('a','allocation',{currency:'INR',allocatedAmount:1000,committedAmount:200,spentAmount:100}),item('b','allocation',{currency:'USD',allocatedAmount:50,committedAmount:10,spentAmount:5}),item('c','allocation',{currency:'INR',allocatedAmount:100,committedAmount:20,spentAmount:30}),item('claim','expense',{currency:'INR',amount:999})];
  assert.deepEqual(budgetSummaries(rows),[{currency:'INR',allocated:1100,committed:220,spent:130,available:750},{currency:'USD',allocated:50,committed:10,spent:5,available:35}]);
  assert.equal(rows[0].data.committedAmount,200);
});
