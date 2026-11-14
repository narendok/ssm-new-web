const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const tsModuleCache = new Map();

function loadTsModule(relativePath) {
  const filename = path.resolve(__dirname, relativePath);
  if (tsModuleCache.has(filename)) return tsModuleCache.get(filename);
  const mod = { exports: {} };
  tsModuleCache.set(filename, mod.exports);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('module', 'exports', 'require', compiled)(mod, mod.exports, (request) => {
    if (!request.startsWith('.')) return require(request);
    const target = path.resolve(path.dirname(filename), request.endsWith('.ts') ? request : `${request}.ts`);
    return loadTsModule(path.relative(__dirname, target));
  });
  tsModuleCache.set(filename, mod.exports);
  return mod.exports;
}

const budgetLib = loadTsModule('../src/lib/department-budgets.ts');
const employeeLib = loadTsModule('../src/lib/employee-services.ts');
const commsLib = loadTsModule('../src/lib/team-communication.ts');

const {
  calculateAvailableBudget,
  canUserApproveExpense,
  createExpenseRequest,
  executeExpenseApproval,
  executeExpenseRejection,
  DEFAULT_DEPARTMENT_ALLOCATIONS,
} = budgetLib;

const { resolveEmployeeProfile, DEFAULT_EMPLOYEE_PROFILES } = employeeLib;
const { canUserAccessChannel, voteOnChatPoll, DEFAULT_CHANNELS } = commsLib;

// 1. Budget Ledger & Available Balance Tests
test('financial ledger: available amount equals allocated minus committed minus spent', () => {
  const allocation = {
    id: 'ALLOC-TEST-01',
    departmentCode: 'EHW',
    departmentName: 'Hardware',
    periodId: 'FY-2026-Q3',
    category: 'Consumables & Lab Supplies',
    allocatedAmount: 500000,
    committedAmount: 100000,
    spentAmount: 150000,
    projectId: 'HLPL-AI4T-01',
    version: 1,
    effectiveDate: '2026-10-01',
    approvedBy: 'Finance Lead',
  };

  const available = calculateAvailableBudget(allocation);
  assert.equal(available, 250000, '500k - 100k - 150k must equal 250k');
});

// 2. Non-Self Approval Enforcement
test('budget security: requester cannot self-approve their own claim (routes to alternate approver)', () => {
  const selfRequest = {
    id: 'EXP-EHW-001',
    reference: 'EXP-EHW-2026-101',
    requesterId: 'usr-ehw-avery',
    requesterName: 'Avery Vale',
    requesterDept: 'EHW',
    category: 'Consumables & Lab Supplies',
    amount: 25000,
    currency: 'INR',
    purpose: 'Prototype components',
    requiredDate: '2026-11-01',
    status: 'Pending_Dept_Review',
    currentApproverRole: 'EHW Lead',
    alternateApprover: 'Executive Admin',
    createdAt: '2026-10-21T00:00:00Z',
    updatedAt: '2026-10-21T00:00:00Z',
  };

  const averyLeadPersona = {
    kind: 'lead',
    person: 'Avery Vale · Embedded Hardware',
    departmentId: 'ehw',
    id: 'usr-ehw-avery',
  };

  const check = canUserApproveExpense(selfRequest, averyLeadPersona);
  assert.equal(check.canApprove, false, 'Requester must not approve own claim');
  assert.match(check.reason, /Self-approval prohibited/, 'Reason must mention alternate approver routing');
});

// 3. Client Has Zero Financial Authority
test('budget security: client accounts have zero approval authority over company budgets', () => {
  const req = {
    id: 'EXP-EHW-002',
    reference: 'EXP-EHW-2026-102',
    requesterId: 'usr-staff-01',
    requesterName: 'Staff Engineer',
    requesterDept: 'EHW',
    category: 'Consumables & Lab Supplies',
    amount: 15000,
    currency: 'INR',
    purpose: 'Test jigs',
    requiredDate: '2026-11-01',
    status: 'Pending_Dept_Review',
    currentApproverRole: 'EHW Lead',
    createdAt: '2026-10-21T00:00:00Z',
    updatedAt: '2026-10-21T00:00:00Z',
  };

  const clientPersona = { kind: 'client', person: 'Rohan Verma · Tata Motors', id: 'client-tata' };
  const check = canUserApproveExpense(req, clientPersona);
  assert.equal(check.canApprove, false);
  assert.match(check.reason, /Client accounts do not have internal budget authority/);
});

// 4. Staged Expense Transitions & Approval Gates
test('staged workflow: employee claim progresses from Dept Review to Finance to Approved', () => {
  const allocations = [
    {
      id: 'ALLOC-EHW-01',
      departmentCode: 'EHW',
      departmentName: 'Hardware',
      periodId: 'FY-2026-Q3',
      category: 'Consumables & Lab Supplies',
      allocatedAmount: 300000,
      committedAmount: 50000,
      spentAmount: 50000,
      projectId: 'HLPL-AI4T-01',
      version: 1,
      effectiveDate: '2026-10-01',
      approvedBy: 'Finance Lead',
    },
  ];

  // A. Creation by member starts in Pending_Dept_Review
  const memberPersona = { kind: 'member', person: 'Ravi Kumar', departmentId: 'ehw', id: 'usr-ehw-ravi' };
  const newReq = createExpenseRequest(
    {
      category: 'Consumables & Lab Supplies',
      amount: 45000,
      purpose: 'Lab solder paste and nozzles',
      projectId: 'HLPL-AI4T-01',
      requiredDate: '2026-11-05',
    },
    memberPersona
  );
  assert.equal(newReq.status, 'Pending_Dept_Review');
  assert.equal(newReq.currentApproverRole, 'EHW Lead');

  // B. Dept Lead approves -> advances to Pending_Finance
  const ehwLeadPersona = { kind: 'lead', person: 'Avery Vale', departmentId: 'ehw', id: 'usr-ehw-avery' };
  const stage1Result = executeExpenseApproval(newReq, allocations, ehwLeadPersona);
  assert.equal(stage1Result.success, true);
  assert.equal(stage1Result.nextRequest.status, 'Pending_Finance');
  assert.equal(stage1Result.nextRequest.currentApproverRole, 'FIN Lead');

  // C. Finance Lead approves -> advances to Approved and commits funds
  const finLeadPersona = { kind: 'lead', person: 'Priya Voss', departmentId: 'fin', id: 'usr-fin-priya' };
  const stage2Result = executeExpenseApproval(stage1Result.nextRequest, allocations, finLeadPersona);
  assert.equal(stage2Result.success, true);
  assert.equal(stage2Result.nextRequest.status, 'Approved');

  // D. Verify exact allocation commitment
  const targetAlloc = stage2Result.updatedAllocations.find((a) => a.id === 'ALLOC-EHW-01');
  assert.equal(targetAlloc.committedAmount, 50000 + 45000, 'Committed amount must increase by 45,000');
});

// 5. Overdraft Prevention Rejection
test('transactional ledger: approval strictly rejected when request exceeds available budget', () => {
  const lowAllocation = [
    {
      id: 'ALLOC-EHW-02',
      departmentCode: 'EHW',
      departmentName: 'Hardware',
      periodId: 'FY-2026-Q3',
      category: 'Consumables & Lab Supplies',
      allocatedAmount: 100000,
      committedAmount: 80000,
      spentAmount: 15000,
      projectId: 'HLPL-AI4T-01',
      version: 1,
      effectiveDate: '2026-10-01',
      approvedBy: 'Finance Lead',
    },
  ];
  // Available is 100k - 80k - 15k = 5,000 INR

  const bigRequest = {
    id: 'EXP-EHW-OVERDRAFT',
    reference: 'EXP-EHW-2026-999',
    requesterId: 'usr-ehw-staff',
    requesterName: 'Staff Member',
    requesterDept: 'EHW',
    category: 'Consumables & Lab Supplies',
    amount: 15000, // 15,000 > 5,000 available
    currency: 'INR',
    purpose: 'Expensive rework station',
    requiredDate: '2026-11-01',
    status: 'Pending_Finance',
    currentApproverRole: 'FIN Lead',
    createdAt: '2026-10-21T00:00:00Z',
    updatedAt: '2026-10-21T00:00:00Z',
  };

  const finLeadPersona = { kind: 'lead', person: 'Priya Voss', departmentId: 'fin', id: 'usr-fin-priya' };
  const result = executeExpenseApproval(bigRequest, lowAllocation, finLeadPersona);
  assert.equal(result.success, false, 'Overdraft approval must be rejected');
  assert.match(result.message, /Overdraft/, 'Error message must specify overdraft');
});

// 6. Employee Self-Service Fail-Closed Security
test('hr self-service: unrecognized identities and client accounts fail closed without defaulting to Admin', () => {
  // Client account fails closed
  const clientPersona = { kind: 'client', person: 'Rohan Verma', id: 'client-01' };
  const clientProfile = resolveEmployeeProfile(clientPersona);
  assert.equal(clientProfile, undefined, 'Client accounts must fail closed with no profile');

  // Unknown external persona fails closed
  const unknownPersona = { kind: 'member', person: 'Unknown Guest', id: 'usr-random-unknown' };
  const unknownProfile = resolveEmployeeProfile(unknownPersona);
  assert.equal(unknownProfile, undefined, 'Unknown persona must fail closed and never default to Admin');

  // Verified hardware lead resolves Avery Vale
  const ehwPersona = { kind: 'lead', person: 'Avery Vale', id: 'ehw', departmentId: 'ehw' };
  const ehwProfile = resolveEmployeeProfile(ehwPersona);
  assert.ok(ehwProfile, 'Avery Vale profile must resolve');
  assert.equal(ehwProfile.employeeCode, 'HLPL-EMP-103');
  assert.equal(ehwProfile.departmentCode, 'EHW');
  assert.equal(ehwProfile.securityClearance, 'Not recorded', 'Demo clearance must not imply verified access rights');
  assert.match(ehwProfile.facilityLocation, /^DEMO ONLY/);
  assert.match(ehwProfile.emergencyContact, /^DEMO ONLY/);
  assert.match(ehwProfile.phone, /non-callable/);

  const qaProfile = DEFAULT_EMPLOYEE_PROFILES.qa;
  assert.equal(qaProfile.securityClearance, 'Not recorded');
  assert.match(qaProfile.emergencyContact, /^DEMO ONLY/);
  assert.ok(Object.values(DEFAULT_EMPLOYEE_PROFILES).every((entry) => entry.securityClearance === 'Not recorded' && entry.facilityLocation.startsWith('DEMO ONLY') && entry.emergencyContact.startsWith('DEMO ONLY') && entry.email.endsWith('.test') && entry.phone.includes('non-callable')), 'Demo profiles must share marked fictional contact data and must not claim clearance');

  // Executive Admin resolves Admin profile explicitly
  const adminPersona = { kind: 'admin', person: 'Full master access', id: 'admin' };
  const adminProfile = resolveEmployeeProfile(adminPersona);
  assert.ok(adminProfile);
  assert.equal(adminProfile.employeeCode, 'HLPL-EXEC-001');
});

// 7. Team Communication Channel Membership Scoping
test('communication scoping: internal channels isolate client and restrict cross-department access', () => {
  const hwChannel = DEFAULT_CHANNELS.find((c) => c.id === 'chan-engineering-hw');
  const purChannel = DEFAULT_CHANNELS.find((c) => c.id === 'chan-purchasing-scm');
  const genChannel = DEFAULT_CHANNELS.find((c) => c.id === 'chan-general');

  assert.ok(hwChannel && purChannel && genChannel);

  // Client cannot access ANY internal channels
  const client = { kind: 'client', person: 'Rohan Verma', id: 'client' };
  assert.equal(canUserAccessChannel(genChannel, client), false);
  assert.equal(canUserAccessChannel(hwChannel, client), false);
  assert.equal(canUserAccessChannel(purChannel, client), false);

  // Hardware member can access General and HW, but NOT Purchasing
  const hwMember = { kind: 'member', person: 'HW Staff', departmentId: 'ehw', id: 'usr-ehw-staff' };
  assert.equal(canUserAccessChannel(genChannel, hwMember), true);
  assert.equal(canUserAccessChannel(hwChannel, hwMember), true);
  assert.equal(canUserAccessChannel(purChannel, hwMember), false);

  // Admin can access all channels
  const admin = { kind: 'admin', person: 'Executive Admin', id: 'admin' };
  assert.equal(canUserAccessChannel(genChannel, admin), true);
  assert.equal(canUserAccessChannel(hwChannel, admin), true);
  assert.equal(canUserAccessChannel(purChannel, admin), true);
});

// 8. Poll Voting Guard: Closed Poll Rejection
test('communication polls: voting on a closed poll is strictly rejected', () => {
  const closedPoll = {
    id: 'POLL-CLOSED-01',
    question: 'Select preferred CAN baud rate for OBD-II connector',
    options: [
      { id: 'opt-1', text: '500 kbps', votes: 12 },
      { id: 'opt-2', text: '250 kbps', votes: 3 },
    ],
    voters: { 'usr-voter-01': 'opt-1' },
    isClosed: true, // CLOSED POLL
    isAnonymous: false,
    createdBy: 'Avery Vale',
    createdAt: '2026-10-20T10:00:00Z',
  };

  const result = voteOnChatPoll(closedPoll, 'opt-2', 'usr-new-voter');
  assert.equal(result.success, false, 'Voting on closed poll must fail');
  assert.match(result.reason, /Voting closed/, 'Must report voting is closed');
});

// 9. Poll Voting: Vote count updates properly and tracks voter ID
test('communication polls: active poll registers votes and handles vote change', () => {
  const activePoll = {
    id: 'POLL-ACTIVE-01',
    question: 'Approve ISO 7637-2 lab facility',
    options: [
      { id: 'opt-1', text: 'ARAI Pune', votes: 5 },
      { id: 'opt-2', text: 'ICAT Manesar', votes: 4 },
    ],
    voters: {},
    isClosed: false,
    isAnonymous: false,
    createdBy: 'Jordan Blake',
    createdAt: '2026-10-21T08:00:00Z',
  };

  // Vote for option 1
  const vote1 = voteOnChatPoll(activePoll, 'opt-1', 'usr-test-user');
  assert.equal(vote1.success, true);
  assert.equal(vote1.poll.options[0].votes, 6);
  assert.equal(vote1.poll.voters['usr-test-user'], 'opt-1');

  // Change vote to option 2
  const vote2 = voteOnChatPoll(vote1.poll, 'opt-2', 'usr-test-user');
  assert.equal(vote2.success, true);
  assert.equal(vote2.poll.options[0].votes, 5, 'Option 1 count must decrement');
  assert.equal(vote2.poll.options[1].votes, 5, 'Option 2 count must increment');
  assert.equal(vote2.poll.voters['usr-test-user'], 'opt-2');
});
