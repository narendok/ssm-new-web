const {test}=require('node:test'),assert=require('node:assert/strict');
const {sharedSalesPipeline}=require('../src/lib/shared-sales.ts');
const record=(id,type,fields={},status='draft')=>({id,record_type:type,reference:`HLPL-${id}-01`,title:id,fields,status,notes:'Source remarks',updated_at:'2026-10-26T01:00:00Z'});
const base=()=>({records:[],approvals:[],departments:[{id:'ehw',code:'EHW'},{id:'qa',code:'QA'}]});
test('shared Sales projection uses canonical customer IDs and leaves missing commercial facts blank',()=>{
  const source=base();source.records=[record('customer','Customer',{spocName:'Actual contact'}),record('enquiry','Enquiry',{customerId:'customer',customer:'Old display name',revision:'01'}),record('other','Schematic')];
  const {customers,enquiries}=sharedSalesPipeline(source);
  assert.equal(customers.length,1);assert.equal(enquiries.length,1);
  assert.equal(enquiries[0].customerCode,'HLPL-customer-01');assert.equal(enquiries[0].customerName,'customer');
  assert.equal(enquiries[0].spocName,'Actual contact');assert.equal(enquiries[0].targetVolume,'');assert.equal(enquiries[0].targetClosureDate,'');assert.equal(enquiries[0].linkedProjectCode,'');
  assert.equal(enquiries[0].totalFeasibilityDepts,0);assert.equal(enquiries[0].status,'Pending Enquiry');
});
test('Sales readiness counts actual current-revision review outcomes, never prior revisions or one signed department',()=>{
  const source=base();source.records=[record('opp','Opportunity',{revision:'02',requiredDepartments:'EHW,QA',feasibilityDispatchedAt:'2026-10-26'})];
  source.approvals=[{record_id:'opp',reviewer_department_id:'ehw',evidence_revision:'02',outcome:'approved'},{record_id:'opp',reviewer_department_id:'qa',evidence_revision:'01',outcome:'approved'}];
  let row=sharedSalesPipeline(source).enquiries[0];assert.equal(row.status,'Sent for Feasibility');assert.deepEqual(row.feasibilitySignedDepts,['EHW']);
  source.approvals.push({record_id:'opp',reviewer_department_id:'qa',evidence_revision:'02',outcome:'approved'});
  row=sharedSalesPipeline(source).enquiries[0];assert.equal(row.status,'Feasibility Complete');assert.equal(row.totalFeasibilityDepts,2);
  source.records[0].status='declined';assert.equal(sharedSalesPipeline(source).enquiries[0].status,'Declined');
  source.records[0].status='archived';source.records[0].fields.outcome='Declined';assert.equal(sharedSalesPipeline(source).enquiries[0].status,'Declined');
});
