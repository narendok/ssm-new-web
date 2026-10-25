import { ResponsiveFilterBar, CompactFilterSelect } from "@/components/ResponsiveFilterBar";
import React, { useState } from "react";
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Search,
  Filter,
  ArrowLeft,
  FileCheck2,
  AlertTriangle,
  Clock,
  Building2,
  Award,
  ChevronRight,
  ExternalLink,
  Lock,
  Plus,
  Bell,
  Send,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Persona } from "@/components/RoleAwareSidebar";
import { approvalInDepartment, canDepartmentSign, departmentCode } from "@/lib/department-scope";

export interface ApprovalRecord {
  id: string;
  title: string;
  recordId: string;
  outcome: "Pending" | "Approved" | "Rejected" | "Returned";
  updatedAt: string;
  requester?: string | undefined;
  department?: string | undefined;
  approverAuthority?: string | undefined;
  project?: string | undefined;
  description?: string | undefined;
  riskLevel?: "Low" | "Medium" | "High" | "Critical" | undefined;
  iatfClause?: string | undefined;
  comments?: string | undefined;
  signedBy?: string | undefined;
  signedAt?: string | undefined;
}

interface ApprovalsFullPageViewProps {
  approvals: ApprovalRecord[];
  projects?: { id?: string; reference: string; title: string }[] | undefined;
  records?: { id: string; reference: string; title: string; fields: Record<string, string> }[] | undefined;
  onApprove: (id: string, notes?: string) => boolean | void | Promise<boolean | void>;
  onReject: (id: string, reason: string) => boolean | void | Promise<boolean | void>;
  onReturn: (id: string, reworkNotes: string) => boolean | void | Promise<boolean | void>;
  onBack: () => void;
  currentUser?: string | undefined;
  userRole?: string | undefined;
  persona?: Persona | undefined;
  departmentScope?: string | undefined;
  onRequestApproval?: ((newApproval: Omit<ApprovalRecord, "id" | "outcome" | "updatedAt">) => boolean | void | Promise<boolean | void>) | undefined;
}

export function ApprovalsFullPageView({
  approvals,
  projects = [],
  records = [],
  onApprove,
  onReject,
  onReturn,
  onBack,
  currentUser = "Executive Admin / MD",
  userRole = "Admin",
  persona,
  departmentScope,
  onRequestApproval,
}: ApprovalsFullPageViewProps) {
  const [statusFilter, setStatusFilter] = useState<"ALL" | "Pending" | "Approved" | "Rejected" | "Returned">("ALL");
  const [filterScope, setFilterScope] = useState<"ALL" | "PENDING_ME" | "MY_REQUESTS">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRecord | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "return" | null>(null);
  const [actionNotes, setActionNotes] = useState<string>("");
  const [actionError, setActionError] = useState<string | null>(null);

  // Request new approval modal state
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [reqTitle, setReqTitle] = useState("");
  const [reqRecordId, setReqRecordId] = useState("");
  const [reqAuthority, setReqAuthority] = useState("");
  const [reqProject, setReqProject] = useState("");
  const [reqRiskLevel, setReqRiskLevel] = useState<"Low" | "Medium" | "High" | "Critical">("High");
  const [reqClause, setReqClause] = useState("");
  const [reqDescription, setReqDescription] = useState("");

  const canUserActOnApproval = (appr: ApprovalRecord): boolean => {
    // Clients have zero approval authority
    if (persona?.kind === "client") return false;
    // Admins have universal authority
    if (!persona || persona.kind === "admin") return true;

    return canDepartmentSign(appr, persona.departmentId);
  };

  // Default enriched metadata if missing from raw seed
  const enrichedApprovals: ApprovalRecord[] = approvals.map((appr) => {
    if (appr.id === "demo-approval-quality-release") {
      return {
        ...appr,
        requester: appr.requester ?? "Jordan Blake (Quality Assurance Head)",
        department: appr.department ?? "QA",
        approverAuthority: appr.approverAuthority ?? "Admin",
        project: appr.project ?? "HLPL-AI4T-01 (Tata Ace EV 4G)",
        riskLevel: appr.riskLevel ?? "Critical",
        iatfClause: appr.iatfClause ?? "IATF 16949 §8.5.1 (Production Release Gate)",
        description:
          appr.description ??
          "Authorization for serial production release following successful completion of ARAI Stage 8 Type Approval TAC #842 and 18-point DVP&R environmental verification matrix.",
      };
    }
    if (appr.id === "demo-approval-ecn-002") {
      return {
        ...appr,
        requester: appr.requester ?? "Avery Vale (Embedded Hardware Lead)",
        department: appr.department ?? "EHW",
        approverAuthority: appr.approverAuthority ?? "QA",
        project: appr.project ?? "HLPL-SLCT-01 (AIS-140 Gateway)",
        riskLevel: appr.riskLevel ?? "High",
        iatfClause: appr.iatfClause ?? "IATF 16949 §8.3.4 (Engineering Change Control)",
        description:
          appr.description ??
          "ECN-002: Layout thermal copper relief enhancement around TI Buck Regulator U4 and Vishay 36V TVS clamping diode to improve continuous high-temperature operating envelope up to +85°C.",
      };
    }
    if (appr.id === "demo-approval-fin-advance") {
      return {
        ...appr,
        requester: appr.requester ?? "Priya Voss (Finance Controller)",
        department: appr.department ?? "FIN",
        approverAuthority: appr.approverAuthority ?? "Admin",
        project: appr.project ?? "HLPL-AI4T-01 (Tata Ace EV 4G)",
        riskLevel: appr.riskLevel ?? "Medium",
        iatfClause: appr.iatfClause ?? "ISO 9001 §8.4 (Purchasing & Advance Authorizations)",
        description:
          appr.description ??
          "Advance billing payment disbursement release of ₹14.50 Lakh for Molex sealed connector hard tooling and Quectel LTE Cat-1 modem engineering samples.",
      };
    }
    return {
      ...appr,
      requester: appr.requester ?? "Department Lead",
      department: appr.department,
      approverAuthority: appr.approverAuthority,
      project: appr.project ?? "HLPL-AI4T-01",
      riskLevel: appr.riskLevel ?? "Medium",
      iatfClause: appr.iatfClause ?? "IATF 16949 / ISO 9001",
      description: appr.description ?? "Controlled gateway review requiring designated human sign-off.",
    };
  });

  const myDept = departmentCode(persona?.departmentId || departmentScope);
  const scopedApprovals = enrichedApprovals.filter((approval) => {
    if (departmentScope) {
      return approvalInDepartment(approval, departmentScope);
    }
    return persona?.kind === "admin" || (persona?.kind === "lead" && approvalInDepartment(approval, persona.departmentId));
  });
  const myActionCount = scopedApprovals.filter((a) => a.outcome === "Pending" && canUserActOnApproval(a)).length;
  const myDeptCount = scopedApprovals.filter((a) => departmentCode(a.department) === myDept).length;
  const pendingCount = scopedApprovals.filter((a) => a.outcome === "Pending").length;
  const approvedCount = scopedApprovals.filter((a) => a.outcome === "Approved").length;
  const rejectedCount = scopedApprovals.filter((a) => a.outcome === "Rejected" || a.outcome === "Returned").length;

  const filtered = scopedApprovals.filter((appr) => {
    if (statusFilter !== "ALL" && appr.outcome !== statusFilter) return false;
    if (filterScope === "PENDING_ME" && !(appr.outcome === "Pending" && canUserActOnApproval(appr))) return false;
    if (filterScope === "MY_REQUESTS" && departmentCode(appr.department) !== myDept) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = appr.title.toLowerCase().includes(q);
      const matchRef = appr.recordId.toLowerCase().includes(q);
      const matchReq = (appr.requester ?? "").toLowerCase().includes(q);
      const matchDesc = (appr.description ?? "").toLowerCase().includes(q);
      if (!matchTitle && !matchRef && !matchReq && !matchDesc) return false;
    }
    return true;
  });

  const handleCreateApproval = async () => {
    if (!reqTitle.trim() || !reqAuthority || !reqRecordId.trim()) {
      alert("Enter a title, source record reference and designated approver.");
      return;
    }
    const saved = await onRequestApproval?.({
      title: reqTitle.trim(),
      recordId: reqRecordId.trim() || `GATE-${myDept}-${Date.now().toString().slice(-4)}`,
      requester: `${currentUser} (${userRole})`,
      department: myDept,
      approverAuthority: reqAuthority,
      project: reqProject,
      riskLevel: reqRiskLevel,
      iatfClause: reqClause,
      description: reqDescription.trim() || "Controlled gate review submitted for designated human sign-off.",
    });
    if (saved === false) return;
    setIsRequestModalOpen(false);
    setReqTitle("");
    setReqRecordId("");
    setReqAuthority("");
    setReqDescription("");
  };

  const handleOpenAction = (appr: ApprovalRecord, type: "approve" | "reject" | "return") => {
    if (!canUserActOnApproval(appr)) return;
    setActionError(null);
    setSelectedApproval(appr);
    setActionType(type);
    setActionNotes("");
  };

  const handleConfirmAction = async () => {
    if (!selectedApproval || !actionType || !canUserActOnApproval(selectedApproval)) return;
    if (actionType !== "approve" && !actionNotes.trim()) { setActionError("Enter the reason for rejection or rework."); return; }
    let accepted: boolean | void;
    if (actionType === "approve") accepted = await onApprove(selectedApproval.id, actionNotes.trim() || "Approved by designated reviewer.");
    else if (actionType === "reject") accepted = await onReject(selectedApproval.id, actionNotes.trim());
    else accepted = await onReturn(selectedApproval.id, actionNotes.trim());
    if (accepted === false) { setActionError("The decision could not be saved. Review the latest record before retrying."); return; }
    setSelectedApproval(null);
    setActionType(null);
    setActionNotes("");
    setActionError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="h-8 gap-1 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Return
            </Button>
            <span className="font-mono text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              GOVERNANCE GATE
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <ShieldAlert className="size-6 text-amber-500" />
            Human Approvals & Governance Sign-Off Center
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
            Mandatory human engineering and commercial sign-offs under <strong>IATF 16949:2016</strong> and{" "}
            <strong>ISO 9001:2015</strong>. Automated workflows cannot bypass official quality, procurement, or
            architectural sign-off boundaries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {persona?.kind !== "client" && onRequestApproval && (
            <Button
              onClick={() => {
                setReqRecordId(`GATE-${myDept}-${Date.now().toString().slice(-4)}`);
                setIsRequestModalOpen(true);
              }}
              className="h-9 gap-1.5 px-3.5 text-xs font-semibold bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Plus className="size-3.5" />
              Request Gate Approval
            </Button>
          )}

          <div className="rounded-xl border border-border/60 bg-card px-4 py-2 text-right">
            <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Signer Context
            </span>
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 justify-end">
              <Lock className="size-3 text-emerald-500" />
              {currentUser} ({userRole})
            </span>
          </div>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 transition-all">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Pending Decisions
            </span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-foreground">{pendingCount}</span>
            <span className="text-xs text-muted-foreground">Awaiting human sign-off</span>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 transition-all">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Approved & Endorsed
            </span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-foreground">{approvedCount}</span>
            <span className="text-xs text-muted-foreground">Audit cleared</span>
          </div>
        </div>

        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 transition-all">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-medium uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Rejected / Returned
            </span>
            <XCircle className="size-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-foreground">{rejectedCount}</span>
            <span className="text-xs text-muted-foreground">Needs rework or closed</span>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4 transition-all">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Compliance Standard
            </span>
            <Award className="size-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-base font-bold text-foreground">IATF 16949 §8.3.4</span>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              100% Traceable
            </span>
          </div>
        </div>
      </div>

      <ResponsiveFilterBar label="Approval filters" className="rounded-xl border border-border/60 bg-card p-2" activeCount={Number(statusFilter !== "ALL" || filterScope !== "ALL")}>
        <div className="filter-search"><Search /><input aria-label="Search approvals" placeholder="Search title, reference or requester…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
        <CompactFilterSelect label="Approval scope" shortLabel="Scope" icon={UserCheck} value={filterScope} onChange={value => setFilterScope(value as typeof filterScope)} options={[{value:"ALL",label:"All authorized"},{value:"PENDING_ME",label:`Awaiting my sign-off (${myActionCount})`},{value:"MY_REQUESTS",label:`My department requests (${myDeptCount})`}]} />
        <CompactFilterSelect label="Approval status" shortLabel="Status" icon={Filter} value={statusFilter} onChange={value => setStatusFilter(value as typeof statusFilter)} options={["ALL","Pending","Approved","Rejected","Returned"].map(value => ({value,label:value === "ALL" ? "All statuses" : value}))} />
      </ResponsiveFilterBar>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <FileCheck2 className="mx-auto size-10 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-semibold text-foreground">No approvals match your current filter</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try switching your status filter or clearing your search query.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter("ALL");
                setSearchQuery("");
              }}
              className="mt-4 text-xs"
            >
              Reset Filters
            </Button>
          </div>
        ) : (
          filtered.map((appr) => {
            const isPending = appr.outcome === "Pending";
            const isApproved = appr.outcome === "Approved";
            const isRejected = appr.outcome === "Rejected";
            const isReturned = appr.outcome === "Returned";

            const riskTone =
              appr.riskLevel === "Critical"
                ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                : appr.riskLevel === "High"
                ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                : "bg-blue-500/10 text-blue-600 border-blue-500/30";

            return (
              <div
                key={appr.id}
                className={`rounded-xl border bg-card p-5 transition-all shadow-sm ${
                  isPending
                    ? "border-amber-500/40 hover:border-amber-500/70"
                    : isApproved
                    ? "border-emerald-500/30 bg-emerald-500/[0.02]"
                    : "border-border/60"
                }`}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {appr.recordId}
                      </span>
                      <span className="rounded border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase bg-secondary text-secondary-foreground">
                        Req: {appr.department}
                      </span>
                      <span className="rounded border border-primary/30 px-2 py-0.5 font-mono text-[11px] font-semibold uppercase bg-primary/5 text-primary">
                        Signer: {appr.approverAuthority || (appr.riskLevel === "Critical" ? "QA" : appr.department)}
                      </span>
                      <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${riskTone}`}>
                        Risk: {appr.riskLevel}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {appr.project}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-foreground tracking-tight">{appr.title}</h3>

                    <p className="text-xs text-muted-foreground leading-relaxed max-w-4xl">
                      {appr.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                      <span className="flex items-center gap-1 font-medium">
                        <Building2 className="size-3.5 text-muted-foreground" />
                        Requester: <strong className="text-foreground font-semibold">{appr.requester}</strong>
                      </span>
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Clock className="size-3.5 text-muted-foreground" />
                        Updated: {appr.updatedAt}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-[11px] text-primary">
                        <Award className="size-3.5" />
                        {appr.iatfClause}
                      </span>
                    </div>

                    {/* Signed seal or rejection note if not pending */}
                    {isApproved && (
                      <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>
                          <strong>Digitally Endorsed & Approved</strong> by {appr.signedBy ?? "Executive Signer"} on{" "}
                          {appr.signedAt ?? appr.updatedAt}.{" "}
                          {appr.comments && <em>“{appr.comments}”</em>}
                        </span>
                      </div>
                    )}

                    {(isRejected || isReturned) && (
                      <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-400">
                        <XCircle className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
                        <span>
                          <strong>{isReturned ? "Returned for Rework" : "Rejected"}</strong>:{" "}
                          {appr.comments ?? "Does not meet compliance gating criteria."}
                        </span>
                      </div>
                    )}

                    {/* Synchronized Notification Indicator */}
                    <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-mono">
                      <Bell className="size-3 text-primary shrink-0" />
                      {isApproved ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          ✓ Sync: Requester ({appr.department}) notified of governance sign-off
                        </span>
                      ) : isReturned ? (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          ↻ Sync: Rework modification alert dispatched to {appr.requester}
                        </span>
                      ) : isRejected ? (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">
                          ✕ Sync: Rejection notice dispatched to {appr.department}
                        </span>
                      ) : (
                        <span className="text-amber-500 font-medium">
                          🔔 Sync: Pending sign-off · Approvers ({appr.approverAuthority || (appr.riskLevel === "Critical" ? "QA" : appr.department)}) notified
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-border/40">
                    <div className="flex items-center gap-1.5">
                      {isPending ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Pending Sign-off
                        </span>
                      ) : isApproved ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="size-3.5 text-emerald-500" />
                          Approved
                        </span>
                      ) : isReturned ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          <RotateCcw className="size-3.5 text-amber-500" />
                          Returned
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/30">
                          <XCircle className="size-3.5 text-rose-500" />
                          Rejected
                        </span>
                      )}
                    </div>

                    {isPending && (
                      canUserActOnApproval(appr) ? (
                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            size="sm"
                            onClick={() => handleOpenAction(appr, "approve")}
                            className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3 shadow-sm"
                          >
                            <CheckCircle2 className="size-3.5" />
                            Approve Gate
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenAction(appr, "return")}
                            className="h-8 gap-1.5 text-xs px-2.5 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 border-amber-500/30"
                          >
                            <RotateCcw className="size-3.5" />
                            Return
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenAction(appr, "reject")}
                            className="h-8 gap-1.5 text-xs px-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border-rose-500/30"
                          >
                            <XCircle className="size-3.5" />
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-2">
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-steel/20 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                            <Lock className="size-3 text-steel" />
                            {persona?.kind === "client"
                              ? "Client Audit View · Sign-off Restricted"
                              : `Awaiting ${appr.approverAuthority ?? (appr.riskLevel === "Critical" ? "QA" : appr.department ?? "Designated")} Authority Sign-off`}
                          </span>
                        </div>
                      )
                    )}

                    {!isPending && canUserActOnApproval(appr) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenAction(appr, "approve")}
                        className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        Re-evaluate Decision
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Action Dialog Modal */}
      {selectedApproval && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center gap-3">
              {actionType === "approve" ? (
                <div className="rounded-full bg-emerald-500/15 p-2.5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="size-6" />
                </div>
              ) : actionType === "reject" ? (
                <div className="rounded-full bg-rose-500/15 p-2.5 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                  <XCircle className="size-6" />
                </div>
              ) : (
                <div className="rounded-full bg-amber-500/15 p-2.5 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  <RotateCcw className="size-6" />
                </div>
              )}
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {actionType === "approve"
                    ? "Confirm Governance Sign-off & Approval"
                    : actionType === "reject"
                    ? "Reject Approval Gate with Non-Conformance Note"
                    : "Return Approval for Engineering Rework"}
                </h3>
                <p className="font-mono text-xs text-muted-foreground">
                  Record ID: {selectedApproval.recordId} · {selectedApproval.project}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-3 text-xs space-y-1">
              <p className="font-semibold text-foreground">{selectedApproval.title}</p>
              <p className="text-muted-foreground">{selectedApproval.description}</p>
            </div>

            <div className="mt-4 space-y-2">
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {actionType === "approve"
                  ? "Sign-off Endorsement Note (Optional)"
                  : "Non-Conformance / Modification Rationale (Required)"}
              </label>
              <textarea
                aria-label="Decision notes"
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder={
                  actionType === "approve"
                    ? "e.g. Verified with ARAI report #842 and internal test fixture. Approved for serial pilot release."
                    : "e.g. Clarification needed on transient clamping voltage under ISO 7637-2 pulse 5b."
                }
                className="h-24 w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {actionError && <p role="alert" className="mt-3 text-xs text-destructive">{actionError}</p>}
            <div className="mt-6 flex items-center justify-end gap-2 border-t border-border/40 pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedApproval(null);
                  setActionType(null);
                }}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmAction}
                className={`text-xs font-semibold text-white ${
                  actionType === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : actionType === "reject"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {actionType === "approve"
                  ? "Sign & Approve Gate"
                  : actionType === "reject"
                  ? "Confirm Rejection"
                  : "Confirm Return for Rework"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Request New Approval Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-primary/10 p-2 text-primary border border-primary/20">
                  <ShieldAlert className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Request Governance Gate Approval</h3>
                  <p className="text-xs text-muted-foreground">
                    Submit a deliverable or engineering change for human sign-off
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Approval Title & Scope *
                </label>
                <input
                  type="text"
                  aria-label="Approval title"
                  value={reqTitle}
                  onChange={(e) => setReqTitle(e.target.value)}
                  placeholder="e.g. Stage 5 PCBA Acceptance & Box-Build Review"
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Deliverable / Task Ref ID
                  </label>
                  <select aria-label="Source record" value={reqRecordId} onChange={event => { setReqRecordId(event.target.value); const source = records.find(record => record.reference === event.target.value); const code = source?.fields["projectId"] || source?.fields["projectCode"] || ""; setReqProject(projects.find(project => project.reference === code || project.id === code)?.reference || ""); }} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs"><option value="">Select a source record</option>{records.map(record => <option key={record.id} value={record.reference}>{record.reference} · {record.title}</option>)}</select>
                </div>

                <div>
                  <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Risk Classification
                  </label>
                  <select
                    value={reqRiskLevel}
                    onChange={(e) => setReqRiskLevel(e.target.value as any)}
                    className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="Critical">Critical (Executive / QA Sign-off)</option>
                    <option value="High">High (Department Lead Sign-off)</option>
                    <option value="Medium">Medium (Standard Gate)</option>
                    <option value="Low">Low (Informational)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Designated Approver Authority *
                </label>
                <select
                  aria-label="Approver authority"
                  value={reqAuthority}
                  onChange={(e) => setReqAuthority(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select approver authority</option>
                  <option value="QA">QA (Quality Assurance Lead)</option>
                  <option value="Admin">Admin (Executive Director / Plant Management)</option>
                  <option value="PUR">PUR (Purchasing & Supply Chain Head)</option>
                  <option value="FIN">FIN (Finance Controller)</option>
                  <option value="EHW">EHW (Hardware Engineering Lead)</option>
                  <option value="FW">FW (Firmware Lead)</option>
                  <option value="SW">SW (Cloud & Application Software Lead)</option>
                  <option value="EMF">EMF (Manufacturing Lead)</option>
                  <option value="SAL">SAL (Sales Lead)</option>
                  <option value="MECH">MECH (Mechanical Lead)</option>
                  <option value="TST">TST (Production Test Lead)</option>
                  <option value="SIT">SIT (Service & IT Lead)</option>
                  <option value="HR">HR (HR & Operations Lead)</option>
                </select>
              </div>

              <div>
                <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Target Program / Vehicle
                </label>
                <select
                  aria-label="Approval project"
                  value={reqProject}
                  onChange={(e) => setReqProject(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">No project selected</option>
                  {projects.map(project => <option key={project.reference} value={project.reference}>{project.reference} · {project.title}</option>)}
                </select>
              </div>

              <div>
                <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Governing Automotive Clause
                </label>
                <select
                  value={reqClause}
                  onChange={(e) => setReqClause(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="IATF 16949 §8.3.4 (Engineering Change Control)">IATF 16949 §8.3.4 (Engineering Change Control)</option>
                  <option value="IATF 16949 §8.5.1 (Production Release Gate)">IATF 16949 §8.5.1 (Production Release Gate)</option>
                  <option value="ISO 9001 §8.4 (Purchasing & Advance Authorizations)">ISO 9001 §8.4 (Purchasing & Advance Authorizations)</option>
                  <option value="IATF 16949 §8.6 (Release of Products & Services)">IATF 16949 §8.6 (Release of Products & Services)</option>
                  <option value="AIS-140 TAC (Type Approval Certification)">AIS-140 TAC (Type Approval Certification)</option>
                </select>
              </div>

              <div>
                <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Detailed Engineering Rationale & Evidence Summary
                </label>
                <textarea
                  value={reqDescription}
                  onChange={(e) => setReqDescription(e.target.value)}
                  placeholder="Summarize the verification results, lab test reports, or commercial justification for requesting sign-off..."
                  className="h-20 w-full rounded-lg border border-border bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-[11px] text-muted-foreground flex items-center gap-2">
                <Send className="size-3.5 text-primary shrink-0" />
                <span>
                  Submitted as <strong>{currentUser}</strong> ({myDept} Department). Immediate alert notification will be dispatched to <strong>{reqAuthority}</strong> Approver Authority.
                </span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-border/40 pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsRequestModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreateApproval}
                className="text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Submit Approval Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
