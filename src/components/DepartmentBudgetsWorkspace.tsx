import React, { useState, useEffect } from "react";
import {
  Wallet,
  TrendingUp,
  Receipt,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Plane,
  Package,
  Search,
  DollarSign,
  Lock,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type DepartmentAllocation,
  type ExpenseRequest,
  type BudgetCategory,
  DEFAULT_DEPARTMENT_ALLOCATIONS,
  DEFAULT_EXPENSE_REQUESTS,
  DEFAULT_BUDGET_PERIOD,
  calculateAvailableBudget,
  canUserApproveExpense,
  executeExpenseApproval,
  executeExpenseSettlement,
  executeExpenseRejection,
  createExpenseRequest,
} from "@/lib/department-budgets";
import type { Persona } from "@/components/RoleAwareSidebar";

interface DepartmentBudgetsWorkspaceProps {
  sharedPresentation?: { summary: React.ReactNode; requests: React.ReactNode; allocations: React.ReactNode; requestCount:number; allocationCount:number; onNewRequest:()=>void; actions?:React.ReactNode } | undefined;
  persona: Persona;
  departmentScope?: string | undefined;
  selectedProjectId?: string | null;
  onOpenProjectDetail?: (projectId: string) => void;
  allocations?: DepartmentAllocation[];
  expenseRequests?: ExpenseRequest[];
  onUpdateAllocations?: (allocations: DepartmentAllocation[]) => void;
  onUpdateRequests?: (requests: ExpenseRequest[]) => void;
  testMembership?: {
    organizationId?: string | undefined;
    organizationName?: string | undefined;
    membershipId: string;
    displayName: string;
    role: "admin" | "department_lead" | "member" | "viewer" | string;
    departmentCode: string | null;
    departmentName: string | null;
    isClient: boolean;
  } | null;
}

export function DepartmentBudgetsWorkspace({
  sharedPresentation,
  persona,
  departmentScope,
  selectedProjectId,
  onOpenProjectDetail,
  allocations: propsAllocations,
  expenseRequests: propsExpenseRequests,
  onUpdateAllocations,
  onUpdateRequests,
  testMembership,
}: DepartmentBudgetsWorkspaceProps) {
  if (persona.kind === "client") {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900/60 dark:bg-rose-950/20">
        <Lock className="mx-auto size-8 text-rose-600 dark:text-rose-400 mb-2" />
        <h3 className="text-sm font-bold text-foreground">Access Restricted — Internal Budgets</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
          Department budgets and expense claims are internal operational controls. Client accounts do not have access to internal company finances.
        </p>
      </div>
    );
  }

  // Canonical store-backed state (preserves data across navigation)
  const [allocations, setAllocations] = useState<DepartmentAllocation[]>(
    propsAllocations ?? DEFAULT_DEPARTMENT_ALLOCATIONS
  );
  const [expenseRequests, setExpenseRequests] = useState<ExpenseRequest[]>(
    propsExpenseRequests ?? DEFAULT_EXPENSE_REQUESTS
  );

  useEffect(() => {
    if (propsAllocations) setAllocations(propsAllocations);
  }, [propsAllocations]);

  useEffect(() => {
    if (propsExpenseRequests) setExpenseRequests(propsExpenseRequests);
  }, [propsExpenseRequests]);

  const [activeTab, setActiveTab] = useState<"allocations" | "requests">("requests");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal State
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<BudgetCategory>("Consumables & Lab Supplies");
  const [newAmount, setNewAmount] = useState<string>("");
  const [newPurpose, setNewPurpose] = useState<string>("");
  const [newProject, setNewProject] = useState<string>(selectedProjectId || "");
  const [newRequiredDate, setNewRequiredDate] = useState<string>("2026-11-01");
  const [isTravel, setIsTravel] = useState(false);
  const [travelDestination, setTravelDestination] = useState("");
  const [travelTransport, setTravelTransport] = useState("");
  const [travelStay, setTravelStay] = useState("");
  const [travelDaily, setTravelDaily] = useState("");
  const [travelAdvance, setTravelAdvance] = useState("");
  const [isAsset, setIsAsset] = useState(false);
  const [assetSpec, setAssetSpec] = useState("");
  const [assetQty, setAssetQty] = useState("1");
  const [formError, setFormError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const isFinanceLead = persona.departmentId?.toLowerCase() === "fin";
  const isAdmin = persona.kind === "admin";
  const activeDeptCode = (departmentScope || persona.departmentId)?.toUpperCase();

  // Filtered Allocations (scoped to the active department workspace)
  const filteredAllocations = allocations.filter((alloc) => {
    if (activeDeptCode && activeDeptCode !== "ALL" && activeDeptCode !== "HOME") {
      if (alloc.departmentCode !== activeDeptCode) return false;
    }
    if (selectedProjectId && alloc.projectId && alloc.projectId !== selectedProjectId) return false;
    return true;
  });

  // Financial Metrics accurately reflecting filtered scope
  const totalAllocated = filteredAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
  const totalCommitted = filteredAllocations.reduce((sum, a) => sum + a.committedAmount, 0);
  const totalSpent = filteredAllocations.reduce((sum, a) => sum + a.spentAmount, 0);
  const totalAvailable = totalAllocated - totalCommitted - totalSpent;

  // Filtered Requests (scoped by persona authority and active department workspace)
  const filteredRequests = expenseRequests.filter((req) => {
    if (persona.kind === "member") {
      const isSelf =
        (persona.id && req.requesterId === persona.id) ||
        (persona.person && req.requesterName.toLowerCase().includes(persona.person.toLowerCase()));
      if (!isSelf) return false;
    } else if (activeDeptCode && activeDeptCode !== "ALL" && activeDeptCode !== "HOME") {
      if (req.requesterDept !== activeDeptCode) return false;
    }

    if (selectedProjectId && req.projectId && req.projectId !== selectedProjectId) return false;
    if (statusFilter !== "ALL" && req.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        req.reference.toLowerCase().includes(q) ||
        req.requesterName.toLowerCase().includes(q) ||
        req.purpose.toLowerCase().includes(q) ||
        req.category.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Scope label for KPI display
  const scopeLabel = activeDeptCode && activeDeptCode !== "ALL" && activeDeptCode !== "HOME"
    ? `${activeDeptCode} Department Scope`
    : selectedProjectId
    ? `Project ${selectedProjectId}`
    : "Active Department Scope";

  // Handle Approve with Staged Transition & Commitment Reservation
  const handleApprove = (reqId: string) => {
    if (testMembership) {
      setActionMessage("TEST shared expense synchronization is pending backend RPC deployment. Approval is disabled in TEST shared mode.");
      return;
    }
    const req = expenseRequests.find((r) => r.id === reqId);
    if (!req) return;

    const result = executeExpenseApproval(req, allocations, persona);
    setActionMessage(result.message);
    if (result.success && result.nextRequest) {
      const nextRequests = expenseRequests.map((r) => (r.id === reqId ? result.nextRequest! : r));
      setExpenseRequests(nextRequests);
      onUpdateRequests?.(nextRequests);
      if (result.updatedAllocations) {
        setAllocations(result.updatedAllocations);
        onUpdateAllocations?.(result.updatedAllocations);
      }
    }
  };

  // Handle Verified Expense Posting / Settlement
  const handleSettle = (reqId: string) => {
    if (testMembership) {
      setActionMessage("TEST shared expense settlement is pending backend RPC deployment. Settlement is disabled in TEST shared mode.");
      return;
    }
    const req = expenseRequests.find((r) => r.id === reqId);
    if (!req) return;

    const postingRef = `FIN-SETTLE-${Date.now().toString().slice(-4)}`;
    const result = executeExpenseSettlement(req, allocations, persona, postingRef);
    setActionMessage(result.message);
    if (result.success && result.nextRequest) {
      const nextRequests = expenseRequests.map((r) => (r.id === reqId ? result.nextRequest! : r));
      setExpenseRequests(nextRequests);
      onUpdateRequests?.(nextRequests);
      if (result.updatedAllocations) {
        setAllocations(result.updatedAllocations);
        onUpdateAllocations?.(result.updatedAllocations);
      }
    }
  };

  // Handle Reject with Reviewer Authorization Check & Commitment Release
  const handleReject = (reqId: string) => {
    if (testMembership) {
      setActionMessage("TEST shared expense operations are pending backend RPC deployment. Rejection is disabled in TEST shared mode.");
      return;
    }
    const req = expenseRequests.find((r) => r.id === reqId);
    if (!req) return;

    const result = executeExpenseRejection(req, persona, "Does not comply with departmental budget criteria.", allocations);
    setActionMessage(result.message);
    if (result.success && result.nextRequest) {
      const nextRequests = expenseRequests.map((r) => (r.id === reqId ? result.nextRequest! : r));
      setExpenseRequests(nextRequests);
      onUpdateRequests?.(nextRequests);
      if (result.updatedAllocations) {
        setAllocations(result.updatedAllocations);
        onUpdateAllocations?.(result.updatedAllocations);
      }
    }
  };

  // Handle Create Request with Staged Routing & Form Input Preservation
  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (testMembership) {
      setFormError("TEST shared expense synchronization is pending backend RPC deployment. Claims cannot be submitted in TEST shared mode.");
      return;
    }

    const transportVal = parseFloat(travelTransport) || 0;
    const stayVal = parseFloat(travelStay) || 0;
    const dailyVal = parseFloat(travelDaily) || 0;
    const travelSum = transportVal + stayVal + dailyVal;

    let finalAmount = parseFloat(newAmount);
    if (isTravel && travelSum > 0) {
      finalAmount = travelSum;
    }

    if (isNaN(finalAmount) || finalAmount <= 0) {
      setFormError("Please enter a valid positive expense amount.");
      return;
    }

    if (!newPurpose.trim()) {
      setFormError("Business purpose and justification are required.");
      return;
    }

    try {
      const newReq = createExpenseRequest(
        {
          category: newCategory,
          amount: finalAmount,
          currency: "INR",
          purpose: newPurpose.trim(),
          projectId: newProject || null,
          requiredDate: newRequiredDate,
          ...(isTravel
            ? {
                travelDetail: {
                  destination: travelDestination.trim() || "Customer / OEM Site",
                  startDate: newRequiredDate,
                  endDate: newRequiredDate,
                  purpose: newPurpose.trim(),
                  transportEstimate: transportVal,
                  stayEstimate: stayVal,
                  dailyAllowanceEstimate: dailyVal,
                  requestedAdvance: parseFloat(travelAdvance) || 0,
                  advanceSettled: false,
                },
              }
            : {}),
          ...(isAsset
            ? {
                assetDetail: {
                  itemSpecification: assetSpec.trim() || "Hardware Asset",
                  quantity: parseInt(assetQty, 10) || 1,
                  targetLocation: "Hexense Tech Center",
                  requiredDate: newRequiredDate,
                },
              }
            : {}),
        },
        persona
      );

      const nextRequests = [newReq, ...expenseRequests];
      setExpenseRequests(nextRequests);
      onUpdateRequests?.(nextRequests);

      // Reset modal only on successful save
      setIsNewRequestModalOpen(false);
      setNewAmount("");
      setNewPurpose("");
      setIsTravel(false);
      setTravelDestination("");
      setTravelTransport("");
      setTravelStay("");
      setTravelDaily("");
      setTravelAdvance("");
      setIsAsset(false);
      setAssetSpec("");
      setAssetQty("1");
      setFormError(null);
      setActionMessage(`Expense claim ${newReq.reference} submitted for review (${newReq.currentApproverRole}).`);
    } catch (err: any) {
      setFormError(err?.message || "Failed to submit request. Your entered data has been preserved.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Status Indicator */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              Budgets & Expenses
            </span>
            {testMembership ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                TEST Shared
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" title="Demonstration data stored locally in session">
                DEMO Sandbox
              </span>
            )}
            <span className="text-xs text-muted-foreground font-mono">{sharedPresentation ? "Your authorized account records" : DEFAULT_BUDGET_PERIOD.name}</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground mt-1">
            Budgets & Expenses
          </h2>
          <p className="text-xs text-muted-foreground">
            Department budget allocations, operational expense claims, travel advances, and asset requests with two-step commitment and settlement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              if(sharedPresentation){sharedPresentation.onNewRequest();return;}
              setFormError(null);
              setIsNewRequestModalOpen(true);
            }}
            className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            New Expense / Travel Request
          </Button>
          {sharedPresentation?.actions}
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards */}
      {sharedPresentation ? sharedPresentation.summary : <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Approved Allocation</span>
            <DollarSign className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-black text-foreground mt-1">
            ₹{(totalAllocated / 100000).toFixed(2)} L
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">{scopeLabel}</div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Committed Reserves</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
            ₹{(totalCommitted / 100000).toFixed(2)} L
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Reserved on Approved Claims</div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Posted Actuals</span>
            <Receipt className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            ₹{(totalSpent / 100000).toFixed(2)} L
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Verified Settled Expenditure</div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Available Balance</span>
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-black text-primary mt-1">
            ₹{(totalAvailable / 100000).toFixed(2)} L
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Allocation − Committed − Spent</div>
        </div>
      </div>

      {/* Navigation Tabs & Scoped Filters */}
      </>}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-muted rounded-lg border border-border/50 w-fit">
          <button
            onClick={() => setActiveTab("requests")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === "requests" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Expense & Travel Requests ({sharedPresentation?.requestCount ?? filteredRequests.length})
          </button>
          <button
            onClick={() => setActiveTab("allocations")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === "allocations" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Department Allocations ({sharedPresentation?.allocationCount ?? filteredAllocations.length})
          </button>
        </div>

        {!sharedPresentation && <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search reference, purpose..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-3 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring w-48 md:w-64"
            />
          </div>

          {activeTab === "requests" && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 px-2 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending_Dept_Review">Dept Review</option>
              <option value="Pending_Finance">Pending Finance</option>
              <option value="Pending_Admin">Pending Admin</option>
              <option value="Approved">Approved</option>
              <option value="Settled">Settled</option>
              <option value="Rejected">Rejected</option>
            </select>
          )}
        </div>}
      </div>

      {/* Main Content Areas */}
      {sharedPresentation ? (activeTab === "requests" ? sharedPresentation.requests : sharedPresentation.allocations) : <>
      {activeTab === "requests" ? (
        <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Reference / Requester</th>
                  <th className="py-2.5 px-3">Category & Scope</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Purpose & Details</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Approval Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRequests.map((req) => {
                  const check = canUserApproveExpense(req, persona);
                  const isRequesterSelf =
                    (persona.id && req.requesterId === persona.id) ||
                    (persona.person && req.requesterName.toLowerCase().includes(persona.person.toLowerCase()));

                  return (
                    <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-foreground">{req.reference}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {req.requesterName} · <span className="font-semibold text-primary">{req.requesterDept}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-medium text-foreground">{req.category}</div>
                        {req.projectId ? (
                          <span className="inline-block px-1.5 py-0.5 mt-1 text-[10px] font-mono rounded bg-secondary text-secondary-foreground font-semibold">
                            {req.projectId}
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 mt-1 text-[10px] rounded bg-muted text-muted-foreground">
                            Dept Operational
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-foreground text-sm">
                          ₹{req.amount.toLocaleString()}
                        </div>
                        {req.travelDetail?.requestedAdvance ? (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                            Advance: ₹{req.travelDetail.requestedAdvance.toLocaleString()}
                          </div>
                        ) : null}
                      </td>

                      <td className="py-3 px-3 max-w-xs">
                        <div className="line-clamp-2 text-foreground font-normal">{req.purpose}</div>
                        {req.travelDetail && (
                          <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-1">
                            <Plane className="w-3 h-3" />
                            <span>Destination: {req.travelDetail.destination}</span>
                          </div>
                        )}
                        {req.assetDetail && (
                          <div className="flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400 font-medium mt-1">
                            <Package className="w-3 h-3" />
                            <span>{req.assetDetail.itemSpecification} (Qty: {req.assetDetail.quantity})</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            req.status === "Approved"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : req.status === "Settled"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : req.status === "Rejected"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          }`}
                        >
                          {req.status === "Approved" ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : req.status === "Settled" ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : req.status === "Rejected" ? (
                            <XCircle className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {req.status.replace(/_/g, " ")}
                        </span>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          Approver: {req.currentApproverRole}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right">
                        {req.status !== "Approved" && req.status !== "Settled" && req.status !== "Rejected" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {isRequesterSelf ? (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/50 px-2 py-1 rounded border border-amber-200 dark:border-amber-800">
                                Self-approval prohibited
                              </span>
                            ) : check.canApprove ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleApprove(req.id)}
                                  className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReject(req.id)}
                                  className="h-7 px-2 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
                                >
                                  Reject
                                </Button>
                              </>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">
                                Requires {req.currentApproverRole}
                              </span>
                            )}
                          </div>
                        ) : req.status === "Approved" && (isFinanceLead || isAdmin) ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => handleSettle(req.id)}
                              className="h-7 px-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                            >
                              Post & Settle
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            {req.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredRequests.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                      No expense or travel requests match the active filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Allocations View */
        <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Budget Category</th>
                  <th className="py-2.5 px-3">Project Link</th>
                  <th className="py-2.5 px-3">Allocated</th>
                  <th className="py-2.5 px-3">Committed</th>
                  <th className="py-2.5 px-3">Spent</th>
                  <th className="py-2.5 px-3">Available</th>
                  <th className="py-2.5 px-3 text-right">Utilization</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAllocations.map((alloc) => {
                  const available = calculateAvailableBudget(alloc);
                  const utilPct = Math.round(
                    ((alloc.spentAmount + alloc.committedAmount) / alloc.allocatedAmount) * 100
                  );

                  return (
                    <tr key={alloc.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-bold text-foreground">{alloc.departmentName}</span>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {alloc.departmentCode} · Rev {alloc.version}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-medium text-foreground">{alloc.category}</td>
                      <td className="py-3 px-3">
                        {alloc.projectId ? (
                          <button
                            type="button"
                            onClick={() => onOpenProjectDetail?.(alloc.projectId!)}
                            className="font-mono text-primary hover:underline text-[11px] font-bold"
                          >
                            {alloc.projectId}
                          </button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Operational Spend</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-semibold text-foreground">
                        ₹{alloc.allocatedAmount.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-amber-600 dark:text-amber-400 font-medium">
                        ₹{alloc.committedAmount.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-medium">
                        ₹{alloc.spentAmount.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-bold text-foreground">
                        ₹{available.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                utilPct > 90 ? "bg-rose-500" : utilPct > 70 ? "bg-amber-500" : "bg-primary"
                              }`}
                              style={{ width: `${Math.min(100, utilPct)}%` }}
                            />
                          </div>
                          <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                            {utilPct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredAllocations.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground text-xs">
                      No budget allocations found for the active filter selection.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Request Modal with Direct Inputs & Form Error Preservation */}
      </>}
      <Dialog open={isNewRequestModalOpen} onOpenChange={setIsNewRequestModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              Submit Expense / Travel Request
            </DialogTitle>
          </DialogHeader>

          {formError && (
            <div className="p-2.5 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800 rounded-lg flex items-center justify-between">
              <span>{formError}</span>
              <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => setFormError(null)}>
                Dismiss
              </Button>
            </div>
          )}

          <form onSubmit={handleCreateRequest} className="space-y-3 text-xs">
            <div>
              <label className="font-semibold block mb-1">Expense Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as BudgetCategory)}
                className="w-full h-8 px-2 rounded-lg border border-input bg-background text-xs"
              >
                <option value="Consumables & Lab Supplies">Consumables & Lab Supplies</option>
                <option value="Travel & Transport">Travel & Transport</option>
                <option value="Accommodation & Stay">Accommodation & Stay</option>
                <option value="Equipment & Tools (CapEx)">Equipment & Tools (CapEx)</option>
                <option value="Software & Subscriptions">Software & Subscriptions</option>
                <option value="Maintenance & Calibration">Maintenance & Calibration</option>
                <option value="Training & Certifications">Training & Certifications</option>
                <option value="Office & Operations">Office & Operations</option>
              </select>
            </div>

            <div className="flex items-center gap-4 py-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTravel}
                  onChange={(e) => setIsTravel(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary"
                />
                <span className="font-medium">Business Travel Claim</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAsset}
                  onChange={(e) => setIsAsset(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary"
                />
                <span className="font-medium">Equipment / Asset Request</span>
              </label>
            </div>

            {isTravel ? (
              <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-300">
                  <Plane className="w-3.5 h-3.5" />
                  <span>Travel Details & Actual Estimates</span>
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Destination (e.g. Pune OEM Facility)"
                    value={travelDestination}
                    onChange={(e) => setTravelDestination(e.target.value)}
                    className="w-full h-7 px-2 rounded border border-input bg-background text-xs"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Transport (INR)</label>
                    <input
                      type="number"
                      placeholder="e.g. 15000"
                      value={travelTransport}
                      onChange={(e) => setTravelTransport(e.target.value)}
                      className="w-full h-7 px-2 rounded border border-input bg-background text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Stay / Hotel (INR)</label>
                    <input
                      type="number"
                      placeholder="e.g. 8000"
                      value={travelStay}
                      onChange={(e) => setTravelStay(e.target.value)}
                      className="w-full h-7 px-2 rounded border border-input bg-background text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Daily Allowance</label>
                    <input
                      type="number"
                      placeholder="e.g. 2000"
                      value={travelDaily}
                      onChange={(e) => setTravelDaily(e.target.value)}
                      className="w-full h-7 px-2 rounded border border-input bg-background text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Advance Requested (Optional)</label>
                  <input
                    type="number"
                    placeholder="e.g. 10000"
                    value={travelAdvance}
                    onChange={(e) => setTravelAdvance(e.target.value)}
                    className="w-full h-7 px-2 rounded border border-input bg-background text-xs"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">Estimated Amount (INR)</label>
                  <input
                    type="number"
                    placeholder="e.g. 25000"
                    required
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full h-8 px-2 rounded-lg border border-input bg-background text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Required By Date</label>
                  <input
                    type="date"
                    value={newRequiredDate}
                    onChange={(e) => setNewRequiredDate(e.target.value)}
                    className="w-full h-8 px-2 rounded-lg border border-input bg-background text-xs"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="font-semibold block mb-1">Linked Project (Optional)</label>
              <select
                value={newProject}
                onChange={(e) => setNewProject(e.target.value)}
                className="w-full h-8 px-2 rounded-lg border border-input bg-background text-xs font-mono"
              >
                <option value="">None (Department Operational Expense)</option>
                <option value="HLPL-AI4T-01">HLPL-AI4T-01 · Tata Ace EV 4G</option>
                <option value="HLPL-SLCT-01">HLPL-SLCT-01 · Select Motors AIS-140</option>
                <option value="HLPL-XLINK-03">HLPL-XLINK-03 · CV Dual-CAN Gateway</option>
              </select>
            </div>

            <div>
              <label className="font-semibold block mb-1">Business Purpose & Justification</label>
              <textarea
                rows={2}
                required
                placeholder="Explain justification, scope, and technical requirement..."
                value={newPurpose}
                onChange={(e) => setNewPurpose(e.target.value)}
                className="w-full p-2 rounded-lg border border-input bg-background text-xs resize-none"
              />
            </div>

            {isAsset && (
              <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-purple-900 dark:text-purple-300">
                  <Package className="w-3.5 h-3.5" />
                  <span>Equipment / Asset Specification</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Specification / Make"
                    value={assetSpec}
                    onChange={(e) => setAssetSpec(e.target.value)}
                    className="col-span-2 h-7 px-2 rounded border border-input bg-background text-xs"
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    value={assetQty}
                    onChange={(e) => setAssetQty(e.target.value)}
                    className="h-7 px-2 rounded border border-input bg-background text-xs"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsNewRequestModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-semibold">
                Submit Request
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
