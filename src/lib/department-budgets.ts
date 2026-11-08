/**
 * Department Budgets, Allocations & Expense Requests Model
 * Conforming to BUDGET_HR_AND_TEAM_COMMUNICATION_PLAN_2026-10-21.md
 * 
 * Rules:
 * 1. Budget ownership is a department; project link is optional.
 * 2. Available = approved allocation - posted actuals - outstanding commitments.
 * 3. No requester approves their own claim (alternate approver rule).
 * 4. Advances are tracked separately from final expense recognition.
 */

export interface BudgetPeriod {
  id: string;
  name: string; // e.g. "FY 2026-27 Q3"
  startDate: string;
  endDate: string;
  currency: string;
  status: "Active" | "Closed" | "Draft";
}

export type BudgetCategory =
  | "Travel & Transport"
  | "Accommodation & Stay"
  | "Consumables & Lab Supplies"
  | "Equipment & Tools (CapEx)"
  | "Software & Subscriptions"
  | "Maintenance & Calibration"
  | "Training & Certifications"
  | "Office & Operations";

export interface DepartmentAllocation {
  id: string;
  departmentCode: string; // e.g. "EHW", "SAL", "PUR", "QA", "FIN"
  departmentName: string;
  periodId: string;
  category: BudgetCategory;
  allocatedAmount: number;
  committedAmount: number; // outstanding unposted approved requests
  spentAmount: number;     // posted actual expenditure
  projectId?: string | null; // optional link to automotive project
  version: number;
  effectiveDate: string;
  approvedBy: string;
}

export interface BudgetRevision {
  id: string;
  allocationId: string;
  originalAmount: number;
  revisedAmount: number;
  deltaAmount: number;
  reason: string;
  proposedBy: string;
  approvedBy: string;
  status: "Pending" | "Approved" | "Rejected";
  createdAt: string;
}

export interface TravelDetail {
  destination: string;
  startDate: string;
  endDate: string;
  purpose: string;
  transportEstimate: number;
  stayEstimate: number;
  dailyAllowanceEstimate: number;
  requestedAdvance: number;
  advanceSettled: boolean;
}

export interface AssetRequestDetail {
  itemSpecification: string;
  quantity: number;
  replacementJustification?: string;
  targetLocation: string;
  requiredDate: string;
  linkedAssetTag?: string;
}

export interface ExpenseRequest {
  id: string;
  reference: string; // e.g. "EXP-2026-EHW-012"
  requesterId: string;
  requesterName: string;
  requesterDept: string;
  category: BudgetCategory;
  amount: number;
  currency: string;
  purpose: string;
  projectId?: string | null | undefined; // optional
  requiredDate: string;
  status: "Draft" | "Pending_Dept_Review" | "Pending_Finance" | "Pending_Admin" | "Approved" | "Rejected" | "Returned" | "Settled";
  currentApproverRole: string; // e.g. "FIN Lead", "Executive Admin"
  alternateApprover?: string | undefined;  // designated when requester is lead or Admin
  iatfClause?: string | undefined;        // e.g. "IATF 16949 §8.3.4"
  receiptEvidence?: string[] | undefined;  // uploaded receipts or attachment filenames
  travelDetail?: TravelDetail | undefined;
  assetDetail?: AssetRequestDetail | undefined;
  claimSettlement?: {
    actualAmount: number;
    advanceDeducted: number;
    netPayable: number;
    financePostingRef: string;
    settledAt: string;
  } | undefined;
  comments?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalPolicy {
  financeLeadLimit: number; // default: 100,000 INR
  dualApprovalRequiredAbove: number; // default: 250,000 INR
  prohibitSelfApproval: boolean;
}

export const DEFAULT_APPROVAL_POLICY: ApprovalPolicy = {
  financeLeadLimit: 100000,
  dualApprovalRequiredAbove: 250000,
  prohibitSelfApproval: true,
};

/** Compute available balance: allocation - spent - committed */
export function calculateAvailableBudget(allocation: DepartmentAllocation): number {
  return allocation.allocatedAmount - allocation.spentAmount - allocation.committedAmount;
}

/** Check if user can approve the request, enforcing no self-approval and stage requirements */
export function canUserApproveExpense(
  request: ExpenseRequest,
  userPersona: { kind: string; person: string; departmentId?: string | undefined; id?: string | undefined }
): { canApprove: boolean; reason?: string | undefined } {
  // Rule 1: No requester approves their own request (stable ID + person name comparison)
  if (
    (userPersona.id && request.requesterId === userPersona.id) ||
    request.requesterName.toLowerCase().includes(userPersona.person.toLowerCase()) ||
    (userPersona.person && request.requesterName.toLowerCase() === userPersona.person.toLowerCase())
  ) {
    return {
      canApprove: false,
      reason: "Self-approval prohibited. Request routed to designated alternate approver (Finance / Admin).",
    };
  }

  // Rule 2: Client has zero internal financial approval authority
  if (userPersona.kind === "client") {
    return { canApprove: false, reason: "Client accounts do not have internal budget authority." };
  }

  // Rule 3: Terminal states
  if (request.status === "Approved" || request.status === "Rejected" || request.status === "Settled") {
    return { canApprove: false, reason: `Request is already ${request.status}.` };
  }

  // Rule 4: Admin has universal approval authority (except for own requests)
  if (userPersona.kind === "admin") {
    return { canApprove: true };
  }

  // Rule 5: Department Lead can approve for their own department at Pending_Dept_Review
  if (request.status === "Pending_Dept_Review") {
    if (
      userPersona.kind === "lead" &&
      userPersona.departmentId?.toLowerCase() === request.requesterDept.toLowerCase()
    ) {
      return { canApprove: true };
    }
    return { canApprove: false, reason: `Requires ${request.requesterDept} Lead approval.` };
  }

  // Rule 6: Finance Lead can approve at Pending_Finance stage
  if (request.status === "Pending_Finance") {
    if (
      (userPersona.kind === "lead" || userPersona.kind === "admin") &&
      userPersona.departmentId?.toLowerCase() === "fin"
    ) {
      return { canApprove: true };
    }
    return { canApprove: false, reason: "Requires Finance Lead (FIN) sign-off." };
  }

  // Rule 7: Admin review stage
  if (request.status === "Pending_Admin") {
    if (userPersona.kind === "admin") {
      return { canApprove: true };
    }
    return { canApprove: false, reason: "Requires Executive Admin sign-off." };
  }

  return { canApprove: false, reason: `Requires ${request.currentApproverRole} approval.` };
}

/**
 * Executes a transactional expense state transition and ledger commitment:
 * - Checks approval authority & non-self approval
 * - Staged transition: Pending_Dept_Review -> Pending_Finance -> (Pending_Admin if > 100k) -> Approved
 * - Ledger check: if transitioning to Approved, verifies available balance in exact allocation
 * - Rejects with overdraft error if amount > available
 */
export function executeExpenseApproval(
  request: ExpenseRequest,
  allocations: DepartmentAllocation[],
  userPersona: { kind: string; person: string; departmentId?: string | undefined; id?: string | undefined },
  policy?: ApprovalPolicy
): {
  success: boolean;
  nextRequest?: ExpenseRequest | undefined;
  updatedAllocations?: DepartmentAllocation[] | undefined;
  message: string;
} {
  const check = canUserApproveExpense(request, userPersona);
  if (!check.canApprove) {
    return { success: false, message: `Approval Denied: ${check.reason}` };
  }

  // Find exact allocation
  const matchingAllocationIndex = allocations.findIndex((a) => {
    const deptMatch = a.departmentCode.toLowerCase() === request.requesterDept.toLowerCase();
    const catMatch = a.category === request.category;
    if (!deptMatch || !catMatch) return false;
    if (request.projectId && a.projectId) {
      return a.projectId === request.projectId;
    }
    return true;
  });

  if (matchingAllocationIndex === -1) {
    return {
      success: false,
      message: `Approval Denied: No budget allocation found for department ${request.requesterDept} and category "${request.category}".`,
    };
  }

  const targetAllocation = allocations[matchingAllocationIndex];
  if (!targetAllocation) {
    return {
      success: false,
      message: `Approval Denied: Target allocation not found for ${request.requesterDept} - ${request.category}.`,
    };
  }
  const available = calculateAvailableBudget(targetAllocation);

  // Determine next stage using configurable policy
  let nextStatus: ExpenseRequest["status"] = "Approved";
  let nextApprover = "None (Approved)";
  const threshold = policy?.financeLeadLimit ?? DEFAULT_APPROVAL_POLICY.financeLeadLimit;

  if (request.status === "Pending_Dept_Review") {
    nextStatus = "Pending_Finance";
    nextApprover = "FIN Lead";
  } else if (request.status === "Pending_Finance") {
    if (request.amount > threshold && userPersona.kind !== "admin") {
      nextStatus = "Pending_Admin";
      nextApprover = "Executive Admin";
    } else {
      nextStatus = "Approved";
      nextApprover = "None (Approved)";
    }
  } else if (request.status === "Pending_Admin") {
    nextStatus = "Approved";
    nextApprover = "None (Approved)";
  }

  // If next status is Approved, check budget balance and commit atomically
  let newAllocations = allocations;
  if (nextStatus === "Approved") {
    if (request.amount > available) {
      return {
        success: false,
        message: `Approval Denied: Overdraft. Requested amount (₹${request.amount.toLocaleString()}) exceeds available budget (₹${available.toLocaleString()}) for ${targetAllocation.departmentCode} - ${targetAllocation.category}.`,
      };
    }

    newAllocations = allocations.map((alloc, idx) => {
      if (idx !== matchingAllocationIndex) return alloc;
      return {
        ...alloc,
        committedAmount: alloc.committedAmount + request.amount,
        version: alloc.version + 1,
      };
    });
  }

  const nextRequest: ExpenseRequest = {
    ...request,
    status: nextStatus,
    currentApproverRole: nextApprover,
    comments: `Advanced to ${nextStatus} by ${userPersona.person} (${userPersona.kind}).`,
    updatedAt: new Date().toISOString(),
  };

  return {
    success: true,
    nextRequest,
    updatedAllocations: newAllocations,
    message: nextStatus === "Approved"
      ? `Request ${request.reference} approved. ₹${request.amount.toLocaleString()} committed to ${targetAllocation.departmentCode} allocation.`
      : `Request ${request.reference} advanced to ${nextStatus} (${nextApprover}).`,
  };
}

/**
 * Executes verified expense posting / settlement:
 * - Only Finance Lead (FIN) or Executive Admin can post actual settlement
 * - Request must be in "Approved" state
 * - Clears committedAmount and records spentAmount atomically:
 *   alloc.committedAmount -= request.amount;
 *   alloc.spentAmount += actualSpent;
 * - Marks request status as "Settled"
 * - Prevents double counting!
 */
export function executeExpenseSettlement(
  request: ExpenseRequest,
  allocations: DepartmentAllocation[],
  userPersona: { kind: string; person: string; departmentId?: string | undefined; id?: string | undefined },
  postingRef: string,
  actualSpentAmount?: number
): {
  success: boolean;
  nextRequest?: ExpenseRequest | undefined;
  updatedAllocations?: DepartmentAllocation[] | undefined;
  message: string;
} {
  if (userPersona.kind === "client") {
    return { success: false, message: "Client accounts do not have financial settlement authority." };
  }
  const isFin = userPersona.departmentId?.toLowerCase() === "fin";
  const isAdmin = userPersona.kind === "admin";
  if (!isFin && !isAdmin) {
    return { success: false, message: "Only Finance Lead (FIN) or Executive Admin can post verified expense settlements." };
  }
  if (request.status !== "Approved") {
    return { success: false, message: `Only approved claims can be posted for settlement. Current status: ${request.status}.` };
  }

  const matchingAllocationIndex = allocations.findIndex((a) => {
    const deptMatch = a.departmentCode.toLowerCase() === request.requesterDept.toLowerCase();
    const catMatch = a.category === request.category;
    if (!deptMatch || !catMatch) return false;
    if (request.projectId && a.projectId) return a.projectId === request.projectId;
    return true;
  });

  if (matchingAllocationIndex === -1) {
    return { success: false, message: `No matching budget allocation found to settle ${request.reference}.` };
  }

  const actualDisbursement = actualSpentAmount !== undefined && actualSpentAmount > 0 ? actualSpentAmount : request.amount;

  const newAllocations = allocations.map((alloc, idx) => {
    if (idx !== matchingAllocationIndex) return alloc;
    return {
      ...alloc,
      committedAmount: Math.max(0, alloc.committedAmount - request.amount),
      spentAmount: alloc.spentAmount + actualDisbursement,
      version: alloc.version + 1,
    };
  });

  const nextRequest: ExpenseRequest = {
    ...request,
    status: "Settled",
    currentApproverRole: "None (Settled)",
    claimSettlement: {
      actualAmount: actualDisbursement,
      advanceDeducted: request.travelDetail?.requestedAdvance ?? 0,
      netPayable: Math.max(0, actualDisbursement - (request.travelDetail?.requestedAdvance ?? 0)),
      financePostingRef: postingRef,
      settledAt: new Date().toISOString(),
    },
    comments: `Settled and posted by ${userPersona.person} under ref ${postingRef}.`,
    updatedAt: new Date().toISOString(),
  };

  return {
    success: true,
    nextRequest,
    updatedAllocations: newAllocations,
    message: `Expense claim ${request.reference} successfully settled. ₹${actualDisbursement.toLocaleString()} posted to actual expenditure.`,
  };
}

/**
 * Rejects an expense request with authorization check and releases any committed funds
 */
export function executeExpenseRejection(
  request: ExpenseRequest,
  userPersona: { kind: string; person: string; departmentId?: string | undefined; id?: string | undefined },
  reason?: string,
  allocations?: DepartmentAllocation[]
): { success: boolean; nextRequest?: ExpenseRequest | undefined; updatedAllocations?: DepartmentAllocation[] | undefined; message: string } {
  if (userPersona.kind === "client") {
    return { success: false, message: "Client accounts do not have approval or rejection authority." };
  }

  const canReview =
    userPersona.kind === "admin" ||
    (userPersona.kind === "lead" && userPersona.departmentId?.toLowerCase() === request.requesterDept.toLowerCase()) ||
    (userPersona.kind === "lead" && userPersona.departmentId?.toLowerCase() === "fin");

  if (!canReview) {
    return { success: false, message: "Unauthorized to reject this request." };
  }

  // If rejecting a previously Approved request, release the commitment!
  let newAllocations = allocations;
  if (request.status === "Approved" && allocations) {
    const matchingAllocationIndex = allocations.findIndex((a) => {
      const deptMatch = a.departmentCode.toLowerCase() === request.requesterDept.toLowerCase();
      const catMatch = a.category === request.category;
      if (!deptMatch || !catMatch) return false;
      if (request.projectId && a.projectId) return a.projectId === request.projectId;
      return true;
    });
    if (matchingAllocationIndex !== -1) {
      newAllocations = allocations.map((alloc, idx) => {
        if (idx !== matchingAllocationIndex) return alloc;
        return {
          ...alloc,
          committedAmount: Math.max(0, alloc.committedAmount - request.amount),
          version: alloc.version + 1,
        };
      });
    }
  }

  const nextRequest: ExpenseRequest = {
    ...request,
    status: "Rejected",
    currentApproverRole: "None",
    comments: `Rejected by ${userPersona.person}: ${reason || "Does not meet policy criteria."}`,
    updatedAt: new Date().toISOString(),
  };

  return {
    success: true,
    nextRequest,
    updatedAllocations: newAllocations,
    message: `Request ${request.reference} rejected.`,
  };
}

/**
 * Creates a new expense request with staged approver routing
 */
export function createExpenseRequest(
  input: {
    category: BudgetCategory;
    amount: number;
    currency?: string | undefined;
    purpose: string;
    projectId?: string | null | undefined;
    requiredDate: string;
    travelDetail?: TravelDetail | undefined;
    assetDetail?: AssetRequestDetail | undefined;
    receiptEvidence?: string[] | undefined;
  },
  requesterPersona: { kind: string; person: string; departmentId?: string | undefined; id?: string | undefined }
): ExpenseRequest {
  const dept = requesterPersona.departmentId?.toUpperCase() || "OPS";
  const isLead = requesterPersona.kind === "lead";
  const isFin = requesterPersona.departmentId?.toLowerCase() === "fin";
  const isAdmin = requesterPersona.kind === "admin";

  let initialStatus: ExpenseRequest["status"] = "Pending_Dept_Review";
  let currentApprover = `${dept} Lead`;
  let alternateApprover = "Executive Admin";

  if (isAdmin) {
    initialStatus = "Pending_Finance";
    currentApprover = "FIN Lead";
  } else if (isFin) {
    initialStatus = "Pending_Admin";
    currentApprover = "Executive Admin";
  } else if (isLead) {
    initialStatus = "Pending_Finance";
    currentApprover = "FIN Lead";
    alternateApprover = "Executive Admin";
  }

  return {
    id: `EXP-2026-${Date.now().toString().slice(-4)}`,
    reference: `EXP-${dept}-2026-${Math.floor(100 + Math.random() * 900)}`,
    requesterId: requesterPersona.id || "usr-current",
    requesterName: requesterPersona.person,
    requesterDept: dept,
    category: input.category,
    amount: input.amount,
    currency: input.currency || "INR",
    purpose: input.purpose,
    projectId: input.projectId || null,
    requiredDate: input.requiredDate,
    status: initialStatus,
    currentApproverRole: currentApprover,
    alternateApprover,
    iatfClause: "IATF 16949 §8.3.4",
    ...(input.travelDetail ? { travelDetail: input.travelDetail } : {}),
    ...(input.assetDetail ? { assetDetail: input.assetDetail } : {}),
    ...(input.receiptEvidence ? { receiptEvidence: input.receiptEvidence } : {}),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** Default Active Budget Period */
export const DEFAULT_BUDGET_PERIOD: BudgetPeriod = {
  id: "FY-2026-Q3",
  name: "FY 2026-27 Q3 (Oct - Dec 2026)",
  startDate: "2026-10-01",
  endDate: "2026-12-31",
  currency: "INR",
  status: "Active",
};

/** Default Department Allocations */
export const DEFAULT_DEPARTMENT_ALLOCATIONS: DepartmentAllocation[] = [
  {
    id: "ALLOC-EHW-01",
    departmentCode: "EHW",
    departmentName: "Hardware Engineering",
    periodId: "FY-2026-Q3",
    category: "Consumables & Lab Supplies",
    allocatedAmount: 450000,
    committedAmount: 85000,
    spentAmount: 195000,
    projectId: "HLPL-AI4T-01",
    version: 1,
    effectiveDate: "2026-10-01",
    approvedBy: "Priya Voss (Finance Lead)",
  },
  {
    id: "ALLOC-EHW-02",
    departmentCode: "EHW",
    departmentName: "Hardware Engineering",
    periodId: "FY-2026-Q3",
    category: "Equipment & Tools (CapEx)",
    allocatedAmount: 1200000,
    committedAmount: 320000,
    spentAmount: 480000,
    projectId: "HLPL-AI4T-01",
    version: 1,
    effectiveDate: "2026-10-01",
    approvedBy: "Executive Admin",
  },
  {
    id: "ALLOC-PUR-01",
    departmentCode: "PUR",
    departmentName: "Purchasing & SCM",
    periodId: "FY-2026-Q3",
    category: "Consumables & Lab Supplies",
    allocatedAmount: 350000,
    committedAmount: 42000,
    spentAmount: 118000,
    projectId: null, // Department operational spend
    version: 1,
    effectiveDate: "2026-10-01",
    approvedBy: "Priya Voss (Finance Lead)",
  },
  {
    id: "ALLOC-QA-01",
    departmentCode: "QA",
    departmentName: "Quality Assurance & APQP",
    periodId: "FY-2026-Q3",
    category: "Maintenance & Calibration",
    allocatedAmount: 600000,
    committedAmount: 150000,
    spentAmount: 220000,
    projectId: "HLPL-AI4T-01",
    version: 1,
    effectiveDate: "2026-10-01",
    approvedBy: "Executive Admin",
  },
  {
    id: "ALLOC-SAL-01",
    departmentCode: "SAL",
    departmentName: "Sales & Business Development",
    periodId: "FY-2026-Q3",
    category: "Travel & Transport",
    allocatedAmount: 500000,
    committedAmount: 90000,
    spentAmount: 215000,
    projectId: "HLPL-AI4T-01",
    version: 1,
    effectiveDate: "2026-10-01",
    approvedBy: "Priya Voss (Finance Lead)",
  },
  {
    id: "ALLOC-FIN-01",
    departmentCode: "FIN",
    departmentName: "Accounts & Finance",
    periodId: "FY-2026-Q3",
    category: "Software & Subscriptions",
    allocatedAmount: 800000,
    committedAmount: 60000,
    spentAmount: 520000,
    projectId: null,
    version: 1,
    effectiveDate: "2026-10-01",
    approvedBy: "Executive Admin",
  },
  {
    id: "ALLOC-HR-01",
    departmentCode: "HROPS",
    departmentName: "HR & Operations",
    periodId: "FY-2026-Q3",
    category: "Training & Certifications",
    allocatedAmount: 400000,
    committedAmount: 75000,
    spentAmount: 145000,
    projectId: null,
    version: 1,
    effectiveDate: "2026-10-01",
    approvedBy: "Priya Voss (Finance Lead)",
  },
];

/** Default Initial Expense & Travel Requests */
export const DEFAULT_EXPENSE_REQUESTS: ExpenseRequest[] = [
  {
    id: "EXP-2026-001",
    reference: "EXP-EHW-2026-081",
    requesterId: "usr-ehw-avery",
    requesterName: "Avery Vale",
    requesterDept: "EHW",
    category: "Consumables & Lab Supplies",
    amount: 38500,
    currency: "INR",
    purpose: "Precision SMD rework nozzles and solder paste alloy SAC305 for Phase 2 MCU prototype evaluation",
    projectId: "HLPL-AI4T-01",
    requiredDate: "2026-10-25",
    status: "Pending_Finance",
    currentApproverRole: "FIN Lead",
    alternateApprover: "Executive Admin",
    iatfClause: "IATF 16949 §8.3.4 (Design Verification)",
    receiptEvidence: ["proforma_smd_nozzles_robu.pdf"],
    createdAt: "2026-10-18T10:30:00Z",
    updatedAt: "2026-10-19T14:15:00Z",
  },
  {
    id: "EXP-2026-002",
    reference: "TRV-SAL-2026-042",
    requesterId: "usr-sal-priya",
    requesterName: "Priya Sharma",
    requesterDept: "SAL",
    category: "Travel & Transport",
    amount: 24800,
    currency: "INR",
    purpose: "Customer commercial technical sign-off meeting at Tata Motors EV Fleet Division, Pune",
    projectId: "HLPL-AI4T-01",
    requiredDate: "2026-10-28",
    status: "Approved",
    currentApproverRole: "FIN Lead",
    alternateApprover: "Executive Admin",
    iatfClause: "IATF 16949 §8.2.3 (Review of Customer Requirements)",
    travelDetail: {
      destination: "Tata Motors Ltd, Pimpri, Pune",
      startDate: "2026-10-28",
      endDate: "2026-10-29",
      purpose: "Phase 0 contract review and indicative commercial reconciliation",
      transportEstimate: 14500,
      stayEstimate: 7500,
      dailyAllowanceEstimate: 2800,
      requestedAdvance: 20000,
      advanceSettled: false,
    },
    receiptEvidence: ["flight_del_pnq_indigo.pdf"],
    createdAt: "2026-10-15T09:00:00Z",
    updatedAt: "2026-10-16T11:45:00Z",
  },
  {
    id: "EXP-2026-003",
    reference: "AST-QA-2026-019",
    requesterId: "usr-qa-jordan",
    requesterName: "Jordan Blake",
    requesterDept: "QA",
    category: "Maintenance & Calibration",
    amount: 65000,
    currency: "INR",
    purpose: "NABL annual calibration certificate for Chroma 8000 EOL test jig and Rohde & Schwarz EMI receiver",
    projectId: "HLPL-AI4T-01",
    requiredDate: "2026-11-05",
    status: "Pending_Admin",
    currentApproverRole: "Executive Admin",
    iatfClause: "IATF 16949 §7.1.5.2 (Measurement Traceability)",
    assetDetail: {
      itemSpecification: "Calibration Services — Accredited ISO/IEC 17025 Lab",
      quantity: 2,
      replacementJustification: "Annual calibration review before Phase 8 repeat production",
      targetLocation: "Hexense Reliability & DVP Lab, Greater Noida",
      requiredDate: "2026-11-05",
      linkedAssetTag: "AST-CAL-JIG-8000",
    },
    receiptEvidence: ["nabl_calib_quotation_2026.pdf"],
    createdAt: "2026-10-20T11:00:00Z",
    updatedAt: "2026-10-20T16:30:00Z",
  },
  {
    id: "EXP-2026-004",
    reference: "EXP-PUR-2026-055",
    requesterId: "usr-pur-morgan",
    requesterName: "Morgan Reed",
    requesterDept: "PUR",
    category: "Consumables & Lab Supplies",
    amount: 18200,
    currency: "INR",
    purpose: "ESD safe conductive totes and reel storage bins for SMT Line 2 feeder preparation",
    projectId: null,
    requiredDate: "2026-10-30",
    status: "Pending_Dept_Review",
    currentApproverRole: "PUR Lead",
    alternateApprover: "Executive Admin",
    iatfClause: "IATF 16949 §8.5.4 (Preservation)",
    receiptEvidence: ["esd_totes_proforma.pdf"],
    createdAt: "2026-10-21T08:15:00Z",
    updatedAt: "2026-10-21T08:15:00Z",
  },
];
