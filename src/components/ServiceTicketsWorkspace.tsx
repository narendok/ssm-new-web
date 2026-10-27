import React, { useState } from "react";
import {
  ServiceTicket,
  TicketPriority,
  TicketStatus,
  TicketCategory,
  TicketSource,
  TicketReply,
  filterAuthorizedTickets,
  filterAuthorizedReplies,
} from "../lib/service-tickets";
import {
  LifeBuoy,
  Plus,
  AlertCircle,
  Clock,
  CheckCircle,
  Lock,
  MessageSquare,
  ShieldAlert,
  Send,
  Eye,
  Search,
  ExternalLink,
  Laptop,
} from "lucide-react";

export type ServiceTicketsWorkspaceProps = {
  sharedActions?: {onCreate:()=>void;onStatus:(id:string)=>void;onReply:(id:string,text:string,internal:boolean)=>Promise<boolean>} | undefined;
  tickets: ServiceTicket[];
  currentUser: {
    role: string;
    name: string;
    email: string;
    department?: string | undefined;
    organization?: string | undefined;
  };
  onUpdateTickets: (tickets: ServiceTicket[]) => void;
  onOpenAssetDetail?: (assetId: string) => void;
  onOpenProjectDetail?: (projectId: string) => void;
  onBack?: () => void;
};

export const ServiceTicketsWorkspace: React.FC<ServiceTicketsWorkspaceProps> = ({
  sharedActions,
  tickets,
  currentUser,
  onUpdateTickets,
  onOpenAssetDetail,
  onOpenProjectDetail,
  onBack,
}) => {
  const isClient = currentUser.role.toLowerCase() === "client";
  const isServiceOrAdmin =
    currentUser.role.toLowerCase() === "admin" ||
    currentUser.role.toLowerCase() === "sit" ||
    currentUser.department?.toLowerCase() === "sit";

  // Filter visible tickets strictly according to role boundaries
  const authorizedTickets = sharedActions ? tickets : filterAuthorizedTickets(tickets, {
    role: currentUser.role,
    email: currentUser.email,
    organization: currentUser.organization,
    department: currentUser.department,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(
    authorizedTickets[0]?.id ?? null
  );

  // New ticket modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState<TicketCategory>("Hardware Fault");
  const [newPriority, setNewPriority] = useState<TicketPriority>("Normal");
  const [newProjectId, setNewProjectId] = useState("HLPL-AI4T-01");
  const [newAssetId, setNewAssetId] = useState("");

  // New reply state
  const [replyText, setReplyText] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);

  // Reopen modal
  const [isReopenOpen, setIsReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  const filteredTickets = authorizedTickets.filter((t) => {
    const matchesSearch =
      t.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.requesterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.projectId && t.projectId.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = selectedStatus === "All" || t.status === selectedStatus;
    const matchesCategory = selectedCategory === "All" || t.category === selectedCategory;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const activeTicket = authorizedTickets.find((t) => t.id === selectedTicketId) || (sharedActions ? authorizedTickets[0] : undefined);

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newDescription.trim()) return;

    const newTicket: ServiceTicket = {
      id: `tkt-${Date.now()}`,
      reference: `TKT-2026-${String(tickets.length + 1).padStart(4, "0")}`,
      source: isClient ? "Client" : "Internal",
      requesterName: currentUser.name,
      requesterEmail: currentUser.email,
      requesterDepartment: currentUser.department,
      clientOrganization: isClient ? currentUser.organization ?? "Client OEM" : undefined,
      subject: newSubject.trim(),
      description: newDescription.trim(),
      category: newCategory,
      priority: newPriority,
      projectId: newProjectId ? newProjectId : undefined,
      assetId: newAssetId ? newAssetId : undefined,
      assignedOwner: isServiceOrAdmin ? "Kai Morgan (SIT)" : undefined,
      status: "Open",
      slaDueHours: newPriority === "Critical" ? 4 : newPriority === "High" ? 12 : 24,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      replies: [],
      history: [
        {
          timestamp: new Date().toISOString(),
          actor: `${currentUser.name} (${currentUser.role.toUpperCase()})`,
          action: "Ticket Created",
        },
      ],
    };

    const updated = [newTicket, ...tickets];
    onUpdateTickets(updated);
    setSelectedTicketId(newTicket.id);
    setIsCreateOpen(false);
    setNewSubject("");
    setNewDescription("");
    setNewAssetId("");
  };

  const handleAddReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeTicket) return;
    if(sharedActions){if(await sharedActions.onReply(activeTicket.id,replyText.trim(),!isClient&&isInternalNote)){setReplyText("");setIsInternalNote(false);}return;}

    const newReply: TicketReply = {
      id: `rep-${Date.now()}`,
      authorName: currentUser.name,
      authorRole: currentUser.role.toUpperCase(),
      isInternalNote: isClient ? false : isInternalNote,
      message: replyText.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedTicket: ServiceTicket = {
      ...activeTicket,
      updatedAt: new Date().toISOString(),
      replies: [...activeTicket.replies, newReply],
      history: [
        ...activeTicket.history,
        {
          timestamp: new Date().toISOString(),
          actor: `${currentUser.name} (${currentUser.role.toUpperCase()})`,
          action: newReply.isInternalNote ? "Internal Note Added" : "Reply Dispatched",
        },
      ],
    };

    onUpdateTickets(tickets.map((t) => (t.id === updatedTicket.id ? updatedTicket : t)));
    setReplyText("");
    setIsInternalNote(false);
  };

  const handleStatusChange = (newStatus: TicketStatus) => {
    if (!activeTicket) return;

    const updatedTicket: ServiceTicket = {
      ...activeTicket,
      status: newStatus,
      updatedAt: new Date().toISOString(),
      resolvedAt: newStatus === "Resolved" || newStatus === "Closed" ? new Date().toISOString() : undefined,
      history: [
        ...activeTicket.history,
        {
          timestamp: new Date().toISOString(),
          actor: `${currentUser.name} (${currentUser.role.toUpperCase()})`,
          action: `Status changed to ${newStatus}`,
        },
      ],
    };

    onUpdateTickets(tickets.map((t) => (t.id === updatedTicket.id ? updatedTicket : t)));
  };

  const handleReopenTicket = () => {
    if (!activeTicket || !reopenReason.trim()) return;

    const updatedTicket: ServiceTicket = {
      ...activeTicket,
      status: "In Progress",
      reopenReason: reopenReason.trim(),
      updatedAt: new Date().toISOString(),
      history: [
        ...activeTicket.history,
        {
          timestamp: new Date().toISOString(),
          actor: `${currentUser.name} (${currentUser.role.toUpperCase()})`,
          action: "Ticket Reopened",
          note: reopenReason.trim(),
        },
      ],
    };

    onUpdateTickets(tickets.map((t) => (t.id === updatedTicket.id ? updatedTicket : t)));
    setIsReopenOpen(false);
    setReopenReason("");
  };

  const getPriorityBadgeClass = (priority: TicketPriority) => {
    switch (priority) {
      case "Critical":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30";
      case "High":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "Normal":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30";
      case "Low":
        return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30";
    }
  };

  const getStatusBadgeClass = (status: TicketStatus) => {
    switch (status) {
      case "Open":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      case "Assigned":
      case "In Progress":
        return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30";
      case "Waiting":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "Resolved":
      case "Closed":
        return "bg-slate-500/10 text-slate-500 border-slate-500/30";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <LifeBuoy className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                Service Tickets
              </h1>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted border border-border">
                {currentUser.role.toUpperCase()} View
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {isClient
                ? "Manage and track client support requests, field observations, and RMA intake."
                : isServiceOrAdmin
                ? "Service & IT triage desk, internal equipment requests, client escalations, and SLA tracking."
                : "Your requested IT, facility, and hardware support tickets."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted"
            >
              Back
            </button>
          )}
          <button
            onClick={() => sharedActions ? sharedActions.onCreate() : setIsCreateOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Ticket</span>
          </button>
        </div>
      </div>

      {/* Filters and search */}
      <div className="flex flex-wrap items-center gap-2 bg-muted/40 p-2.5 rounded-lg border border-border/50 text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tickets by ID, subject, requester, or project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1 rounded bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary text-xs"
          />
        </div>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-2 py-1 rounded bg-background border border-border focus:outline-none text-xs"
        >
          <option value="All">All Statuses</option>
          <option value="Open">Open</option>
          <option value="Assigned">Assigned</option>
          <option value="In Progress">In Progress</option>
          <option value="Waiting">Waiting</option>
          <option value="Resolved">Resolved</option>
          <option value="Closed">Closed</option>
        </select>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-2 py-1 rounded bg-background border border-border focus:outline-none text-xs"
        >
          <option value="All">All Categories</option>
          <option value="Hardware Fault">Hardware Fault</option>
          <option value="Firmware / Telemetry">Firmware / Telemetry</option>
          <option value="Cloud & Gateway">Cloud & Gateway</option>
          <option value="Field RMA & Replacement">Field RMA</option>
          <option value="IT Workstation & Network">IT & Network</option>
          <option value="Facility & Power">Facility & Power</option>
        </select>
      </div>

      {/* Main 2-column layout: Tickets List & Ticket Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[500px]">
        {/* Left Column: Tickets Register Table / List */}
        <div className="lg:col-span-5 flex flex-col space-y-2 border border-border rounded-lg bg-card p-3 shadow-xs overflow-y-auto max-h-[750px]">
          <div className="flex items-center justify-between pb-2 border-b border-border/40 text-xs font-semibold text-muted-foreground">
            <span>Ticket Register ({filteredTickets.length})</span>
            <span className="text-[10px]">Strict Role Scoped</span>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
              <LifeBuoy className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="font-medium">No service tickets found</p>
              <p className="text-[11px]">
                {currentUser.role.toLowerCase() === "sal" || currentUser.role.toLowerCase() === "sales"
                  ? "Sales view is restricted to client tickets. Internal tickets are protected."
                  : "Create a ticket or adjust active filters."}
              </p>
            </div>
          ) : (
            filteredTickets.map((ticket) => {
              const isSelected = ticket.id === selectedTicketId;
              return (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors space-y-1.5 ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-xs"
                      : "border-border/60 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-primary">
                      {ticket.reference}
                    </span>
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${getPriorityBadgeClass(
                          ticket.priority
                        )}`}
                      >
                        {ticket.priority}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${getStatusBadgeClass(
                          ticket.status
                        )}`}
                      >
                        {ticket.status}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-medium text-foreground line-clamp-1">
                    {ticket.subject}
                  </h3>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="truncate max-w-[150px]">
                      {ticket.source === "Client"
                        ? `🏢 ${ticket.clientOrganization || ticket.requesterName}`
                        : `👤 ${ticket.requesterName} (${ticket.requesterDepartment || "Staff"})`}
                    </span>
                    <span className="text-[10px]">{ticket.category}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Ticket Detail Workspace */}
        <div className="lg:col-span-7 border border-border rounded-lg bg-card p-4 shadow-xs flex flex-col justify-between">
          {activeTicket ? (
            <div className="space-y-4">
              {/* Ticket Top bar */}
              <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-border/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-primary">
                      {activeTicket.reference}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${getStatusBadgeClass(
                        activeTicket.status
                      )}`}
                    >
                      {activeTicket.status}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${getPriorityBadgeClass(
                        activeTicket.priority
                      )}`}
                    >
                      {activeTicket.priority} Priority
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-muted border border-border text-muted-foreground">
                      {activeTicket.source}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-foreground">
                    {activeTicket.subject}
                  </h2>
                </div>

                {/* Status action buttons */}
                {isServiceOrAdmin && (sharedActions ? <button className="rounded border border-border px-3 py-1.5 text-xs" onClick={()=>sharedActions.onStatus(activeTicket.id)}>Update status</button> : (
                  <div className="flex items-center gap-1.5 text-xs">
                    {activeTicket.status === "Open" && (
                      <button
                        onClick={() => handleStatusChange("In Progress")}
                        className="px-2.5 py-1 rounded bg-sky-600 text-white hover:bg-sky-700"
                      >
                        Start Work
                      </button>
                    )}
                    {activeTicket.status === "In Progress" && (
                      <button
                        onClick={() => handleStatusChange("Waiting")}
                        className="px-2.5 py-1 rounded border border-border hover:bg-muted"
                      >
                        Mark Waiting
                      </button>
                    )}
                    {(activeTicket.status === "In Progress" || activeTicket.status === "Waiting") && (
                      <button
                        onClick={() => handleStatusChange("Resolved")}
                        className="px-2.5 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        Resolve
                      </button>
                    )}
                    {activeTicket.status === "Resolved" && (
                      <button
                        onClick={() => handleStatusChange("Closed")}
                        className="px-2.5 py-1 rounded bg-slate-700 text-white hover:bg-slate-800"
                      >
                        Close Ticket
                      </button>
                    )}
                    {(activeTicket.status === "Resolved" || activeTicket.status === "Closed") && (
                      <button
                        onClick={() => setIsReopenOpen(true)}
                        className="px-2.5 py-1 rounded border border-rose-500/50 text-rose-600 hover:bg-rose-500/10"
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Metadata strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/40 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Requester</span>
                  <span className="font-medium text-foreground">
                    {activeTicket.requesterName}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Assigned Owner</span>
                  <span className="font-medium text-foreground">
                    {activeTicket.assignedOwner || "Unassigned"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Linked Project</span>
                  {activeTicket.projectId ? (
                    <button
                      onClick={() => onOpenProjectDetail?.(activeTicket.projectId!)}
                      className="text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                      <span>{activeTicket.projectId}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  ) : (
                    <span className="text-muted-foreground italic">None</span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Linked Asset</span>
                  {activeTicket.assetId ? (
                    <button
                      onClick={() => onOpenAssetDetail?.(activeTicket.assetId!)}
                      className="text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                      <Laptop className="w-3 h-3" />
                      <span>{activeTicket.assetId}</span>
                    </button>
                  ) : (
                    <span className="text-muted-foreground italic">None</span>
                  )}
                </div>
              </div>

              {/* Description box */}
              <div className="p-3 rounded-lg bg-background border border-border/60 text-xs space-y-1">
                <span className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider block">
                  Description
                </span>
                <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                  {activeTicket.description}
                </p>
              </div>

              {/* Activity / Discussion History */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground pb-1 border-b border-border/30">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Communication & Activity Stream</span>
                  </span>
                  <span className="text-[10px]">
                    {isClient ? "Client Visible Only" : "Internal Notes Protected"}
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                  {filterAuthorizedReplies(activeTicket.replies, isClient).map((reply) => (
                    <div
                      key={reply.id}
                      className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                        reply.isInternalNote
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200"
                          : "bg-muted/40 border-border/60 text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">{reply.authorName}</span>
                          <span className="opacity-70">({reply.authorRole})</span>
                          {reply.isInternalNote && (
                            <span className="flex items-center gap-1 text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold border border-amber-500/40">
                              <Lock className="w-2.5 h-2.5" />
                              <span>INTERNAL NOTE (HIDDEN FROM CLIENT)</span>
                            </span>
                          )}
                        </div>
                        <span className="opacity-60">{new Date(reply.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-xs">{reply.message}</p>
                    </div>
                  ))}

                  {filterAuthorizedReplies(activeTicket.replies, isClient).length === 0 && (
                    <p className="text-center py-4 text-xs text-muted-foreground italic">
                      No replies recorded yet.
                    </p>
                  )}
                </div>
              </div>

              {/* Reply Box */}
              <form onSubmit={handleAddReply} className="space-y-2 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-foreground">
                    Add Response / Update
                  </label>
                  {!isClient && (
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isInternalNote}
                        onChange={(e) => setIsInternalNote(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-0"
                      />
                      <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Internal Note (Hidden from client)
                      </span>
                    </label>
                  )}
                </div>
                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={
                      isInternalNote
                        ? "Enter internal diagnostic notes, root cause discussion, or supplier notes..."
                        : "Enter reply to requester..."
                    }
                    className="flex-1 p-2 rounded-md bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim()}
                    className="px-3 py-1.5 self-end rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-muted-foreground">
              Select a ticket on the left to view details and communication history.
            </div>
          )}
        </div>
      </div>

      {/* Create Ticket Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
              <div className="flex items-center gap-2">
                <LifeBuoy className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm text-foreground">
                  Create New Service Ticket
                </h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1 font-medium">
                  Subject / Summary *
                </label>
                <input
                  type="text"
                  required
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="e.g. Telematics Gateway dropping GPS lock during regen"
                  className="w-full p-2 rounded bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as TicketCategory)}
                    className="w-full p-2 rounded bg-background border border-border text-xs"
                  >
                    <option value="Hardware Fault">Hardware Fault</option>
                    <option value="Firmware / Telemetry">Firmware / Telemetry</option>
                    <option value="Cloud & Gateway">Cloud & Gateway</option>
                    <option value="Field RMA & Replacement">Field RMA</option>
                    <option value="IT Workstation & Network">IT & Network</option>
                    <option value="Facility & Power">Facility & Power</option>
                  </select>
                </div>

                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TicketPriority)}
                    className="w-full p-2 rounded bg-background border border-border text-xs"
                  >
                    <option value="Critical">Critical (4h SLA)</option>
                    <option value="High">High (12h SLA)</option>
                    <option value="Normal">Normal (24h SLA)</option>
                    <option value="Low">Low (48h SLA)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">
                    Linked Project (Optional)
                  </label>
                  <input
                    type="text"
                    value={newProjectId}
                    onChange={(e) => setNewProjectId(e.target.value)}
                    placeholder="e.g. HLPL-AI4T-01"
                    className="w-full p-2 rounded bg-background border border-border text-xs"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">
                    Linked Asset ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={newAssetId}
                    onChange={(e) => setNewAssetId(e.target.value)}
                    placeholder="e.g. ast-yamaha-ys12"
                    className="w-full p-2 rounded bg-background border border-border text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">
                  Detailed Description *
                </label>
                <textarea
                  required
                  rows={4}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Provide detailed observation, vehicle/bench setup, reproduction steps, or equipment error codes..."
                  className="w-full p-2 rounded bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3 py-1.5 rounded border border-border text-xs hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
                >
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reopen Reason Modal */}
      {isReopenOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-sm w-full p-4 space-y-3 text-xs">
            <h3 className="font-bold text-sm text-foreground">
              Reopen Service Ticket
            </h3>
            <p className="text-muted-foreground text-[11px]">
              Record the reason for reopening this ticket for audit traceability:
            </p>
            <textarea
              rows={3}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="e.g. Issue recurred during subsequent vehicle test run..."
              className="w-full p-2 rounded bg-background border border-border text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsReopenOpen(false)}
                className="px-3 py-1 rounded border border-border hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reopenReason.trim()}
                onClick={handleReopenTicket}
                className="px-3 py-1 rounded bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Confirm Reopen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
