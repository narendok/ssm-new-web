const {test}=require('node:test'),assert=require('node:assert/strict');
const {sharedSalesPipeline}=require('../src/lib/shared-sales.ts');
const record=(id,type,fields={},status='draft')=>({id,record_type:type,reference:`HLPL-${id}-01`,title:id,fields,status,notes:'Source remarks',updated_at:'2026-10-26T01:00:00Z'});
const base=()=>({records:[],approvals:[],departments:[{id:'ehw',code:'EHW'},{id:'qa',code:'QA'}]});
test('shared Sales projection uses canonical customer IDs and leaves missing commercial facts blank',()=>{
  const source=base();source.records=[record('customer','Customer',{spocName:'Actual contact'}),record('enquiry','Enquiry',{customerId:'customer',customer:'Old display name',revision:'01'}),record('other','Schematic')];
  const {customers,enquiries}=sharedSalesPipeline(source);
  assert.equal(customers.length,1);assert.equal(enquiries.length,1);
  assert.equal(enquiries[0].customerId,'customer');
  assert.equal(enquiries[0].customerCode,'HLPL-customer-01');assert.equal(enquiries[0].customerName,'customer');
  assert.equal(enquiries[0].spocName,'Actual contact');assert.equal(enquiries[0].targetVolume,'');assert.equal(enquiries[0].targetClosureDate,'');assert.equal(enquiries[0].linkedProjectCode,'');
  assert.equal(enquiries[0].totalFeasibilityDepts,0);assert.equal(enquiries[0].status,'Pending Enquiry');
});
test('Sales projection resolves snake-case customer IDs and refuses duplicate customer-code matches',()=>{
  const source=base();
  const unique=record('customer-unique','Customer',{spocName:'Unique contact'});
  unique.reference='CUS-UNIQUE';
  const duplicateA=record('customer-a','Customer');duplicateA.reference='CUS-DUP';
  const duplicateB=record('customer-b','Customer');duplicateB.reference='CUS-DUP';
  source.records=[unique,duplicateA,duplicateB,
    record('opportunity-linked','Opportunity',{customer_id:'customer-unique',customer_code:'CUS-UNIQUE'}),
    record('opportunity-ambiguous','Opportunity',{customerCode:'CUS-DUP'})];
  const {customers,enquiries}=sharedSalesPipeline(source);
  const linked=enquiries.find(item=>item.id==='opportunity-linked');
  const ambiguous=enquiries.find(item=>item.id==='opportunity-ambiguous');
  assert.equal(linked.customerId,'customer-unique');
  assert.equal(linked.customerCode,'CUS-UNIQUE');
  assert.equal(linked.customerName,'customer-unique');
  assert.equal(customers.find(item=>item.id==='customer-unique').activeOpportunitiesCount,1);
  assert.equal(ambiguous.customerId,undefined,'duplicate exact codes do not select an arbitrary customer');
  assert.equal(ambiguous.customerCode,'CUS-DUP','unresolved source code remains visible for explicit correction');
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
test('Sales recognizes canonical project aliases and keeps conflicting links unresolved',()=>{
  const source=base();
  source.records=[
    record('project-1','Project'),
    record('project-2','Project'),
    record('opportunity-snake','Opportunity',{project_id:'project-1'}),
    record('opportunity-linked','Opportunity',{linkedProjectId:'HLPL-project-2-01'}),
    record('opportunity-conflict','Opportunity',{projectId:'project-1',project_id:'project-2'}),
  ];
  const rows=sharedSalesPipeline(source).enquiries;
  const byId=id=>rows.find(row=>row.id===id);
  assert.equal(byId('opportunity-snake').status,'Project Started');
  assert.equal(byId('opportunity-snake').linkedProjectCode,'HLPL-project-1-01');
  assert.equal(byId('opportunity-linked').status,'Project Started');
  assert.equal(byId('opportunity-linked').linkedProjectCode,'HLPL-project-2-01');
  assert.equal(byId('opportunity-conflict').status,'Pending Enquiry');
  assert.equal(byId('opportunity-conflict').linkedProjectCode,'project-1');
});
test('Sales resolves project status from the shared project directory when full records are scoped out',()=>{
  const source=base();
  source.projectOptions=[{id:'project-shared',reference:'PRJ-SHARED',title:'Shared Project',status:'Active'}];
  source.records=[record('opportunity','Opportunity',{project_id:'project-shared'})];
  const row=sharedSalesPipeline(source).enquiries[0];
  assert.equal(row.status,'Project Started');
  assert.equal(row.linkedProjectCode,'PRJ-SHARED');
});
test('Sales does not pick one customer when canonical ID aliases conflict',()=>{
  const source=base();
  source.records=[
    record('customer-a','Customer'),
    record('customer-b','Customer'),
    record('opportunity-conflict','Opportunity',{customerId:'customer-a',customer_id:'customer-b',customerCode:'HLPL-customer-a-01'}),
  ];
  const row=sharedSalesPipeline(source).enquiries[0];
  assert.equal(row.customerId,undefined);
  assert.equal(row.customerName,'');
  assert.equal(row.customerCode,'HLPL-customer-a-01');
});
