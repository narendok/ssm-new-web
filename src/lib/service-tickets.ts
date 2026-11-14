/**
 * Service & IT Tickets Management
 * Implements Batch C requirements from ANTIGRAVITY_READY_TO_USE_CONSOLIDATED_HANDOFF_2026-10-21.md §6
 * 
 * Boundaries:
 * - Internal employee tickets: Visible ONLY to requester and authorized Service team (SIT / Admin).
 *   Sales is strictly excluded by default.
 * - Client tickets: Visible to requesting client, authorized Service team (SIT), and Sales team.
 * - Other departments: Explicit assignment only.
 * - Internal notes: Protected and never exposed to clients.
 */

export type TicketPriority = "Critical" | "High" | "Normal" | "Low";

export type TicketStatus = "Open" | "Assigned" | "In Progress" | "Waiting" | "Resolved" | "Closed";

export type TicketSource = "Internal" | "Client";

export type TicketCategory =
  | "Hardware Fault"
  | "Firmware / Telemetry"
  | "Cloud & Gateway"
  | "Field RMA & Replacement"
  | "IT Workstation & Network"
  | "Facility & Power";

export type TicketReply = {
  id: string;
  authorName: string;
  authorRole: string;
  isInternalNote: boolean; // Must NEVER be shown to clients
  message: string;
  createdAt: string;
};

export type DepartmentHelpRequest = {
  id: string;
  ticketId?: string | undefined;
  departmentCode: string;
  departmentName: string;
  summary: string;
  status: "Requested" | "In Progress" | "Responded" | "Closed";
  requestedBy: string;
  createdAt: string;
  response?: string | undefined;
  respondedBy?: string | undefined;
  respondedAt?: string | undefined;
};

export type ServiceTicket = {
  id: string;
  reference: string; // TKT-2026-XXXX
  source: TicketSource;
  requesterName: string;
  requesterEmail: string;
  requesterDepartment?: string | undefined;
  clientOrganization?: string | undefined;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  projectId?: string | undefined;
  assetId?: string | undefined;
  assignedOwner?: string | undefined;
  status: TicketStatus;
  slaDueHours: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | undefined;
  reopenReason?: string | undefined;
  replies: TicketReply[];
  departmentHelpRequests?: DepartmentHelpRequest[] | undefined;
  history: Array<{
    timestamp: string;
    actor: string;
    action: string;
    note?: string | undefined;
  }>;
};

export type RecurringIssueSignal = {
  key: string;
  category: TicketCategory;
  subject: string;
  reportCount: number;
  ticketReferences: string[];
  suggestedDepartment: string;
  exampleTicketId: string;
};

const ISSUE_TITLE_STOP_WORDS = new Set(["a", "an", "and", "at", "during", "for", "from", "in", "intermittently", "on", "the", "to", "with"]);

/** Conservative repeat detection: only matching normalized titles within a category count. */
export function findRecurringIssueSignals(tickets: ServiceTicket[], minimumReports = 2): RecurringIssueSignal[] {
  const departmentByCategory: Record<TicketCategory, string> = {
    "Hardware Fault": "EHW",
    "Firmware / Telemetry": "FW",
    "Cloud & Gateway": "SW",
    "Field RMA & Replacement": "QA",
    "IT Workstation & Network": "SIT",
    "Facility & Power": "HROPS",
  };
  const groups = new Map<string, ServiceTicket[]>();
  for (const ticket of tickets) {
    const normalizedTitle = ticket.subject
      .toLowerCase()
      .replace(/tkt-\d{4}-\d+/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !ISSUE_TITLE_STOP_WORDS.has(word))
      .map((word) => word === "regenerative" ? "regen" : word)
      .sort()
      .join(" ");
    if (!normalizedTitle) continue;
    const key = `${ticket.category.toLowerCase()}::${normalizedTitle}`;
    groups.set(key, [...(groups.get(key) ?? []), ticket]);
  }
  return [...groups.entries()]
    .filter(([, reports]) => new Set(reports.map((ticket) => ticket.id)).size >= minimumReports)
    .map(([key, reports]) => {
      const distinctReports = [...new Map(reports.map((ticket) => [ticket.id, ticket])).values()];
      const firstReport = distinctReports[0]!;
      return {
        key,
        category: firstReport.category,
        subject: firstReport.subject,
        reportCount: distinctReports.length,
        ticketReferences: distinctReports.map((ticket) => ticket.reference),
        suggestedDepartment: departmentByCategory[firstReport.category],
        exampleTicketId: firstReport.id,
      };
    })
    .sort((a, b) => b.reportCount - a.reportCount || a.subject.localeCompare(b.subject));
}

export const INITIAL_SERVICE_TICKETS: ServiceTicket[] = [
  {
    id: "tkt-001",
    reference: "TKT-2026-0101",
    source: "Client",
    requesterName: "Rohan Verma",
    requesterEmail: "rohan.verma@tatamotors.com",
    clientOrganization: "Tata Motors Limited",
    subject: "AIS-140 GPS fix dropping intermittently on Ace EV Pilot Batch",
    description: "During highway road trials between Pune and Mumbai, GPS NMEA fix drops for 3-5 seconds after aggressive regenerative braking. Suspected buck converter EMI or antenna coax strain.",
    category: "Hardware Fault",
    priority: "High",
    projectId: "HLPL-AI4T-01",
    assetId: "ast-yamaha-ys12",
    assignedOwner: "Preeti Joshi (SIT)",
    status: "In Progress",
    slaDueHours: 24,
    createdAt: "2026-10-20T09:30:00Z",
    updatedAt: "2026-10-20T14:15:00Z",
    replies: [
      {
        id: "rep-001",
        authorName: "Preeti Joshi",
        authorRole: "Field RMA Specialist (SIT)",
        isInternalNote: true,
        message: "Internal RMA triage: EHW confirmed buck TVS diode SM5S24A clamp voltage is fine, but L1 inductor layout on Rev A PCB has ground loop. Testing sample on EM Test UCS 500N.",
        createdAt: "2026-10-20T11:00:00Z",
      },
      {
        id: "rep-002",
        authorName: "Kai Morgan",
        authorRole: "Service & IT Lead",
        isInternalNote: false,
        message: "Diagnostic firmware patch v1.0.4 dispatched to Tata Motors test vehicles to capture CAN J1939 logs during regen events.",
        createdAt: "2026-10-20T14:15:00Z",
      },
    ],
    history: [
      { timestamp: "2026-10-20T09:30:00Z", actor: "Rohan Verma (Tata Motors)", action: "Ticket Created" },
      { timestamp: "2026-10-20T10:15:00Z", actor: "Kai Morgan (SIT)", action: "Assigned to Preeti Joshi" },
      { timestamp: "2026-10-20T14:15:00Z", actor: "Kai Morgan (SIT)", action: "Client Reply Dispatched" },
    ],
  },
  {
    id: "tkt-002",
    reference: "TKT-2026-0102",
    source: "Internal",
    requesterName: "Avery Vale",
    requesterEmail: "avery.vale@hexenselabs.com",
    requesterDepartment: "EHW",
    subject: "CAD Workstation Dell Precision BSOD on Altium 3D DRC render",
    description: "Dell Precision 5820 workstation crashes with MEMORY_MANAGEMENT BSOD when opening 8-layer rigid-flex board in Altium 24. DDR4 ECC RAM test needed.",
    category: "IT Workstation & Network",
    priority: "High",
    assetId: "ast-dell-ws-01",
    assignedOwner: "Sameer Khan (SIT)",
    status: "Assigned",
    slaDueHours: 8,
    createdAt: "2026-10-21T08:00:00Z",
    updatedAt: "2026-10-21T08:30:00Z",
    replies: [
      {
        id: "rep-003",
        authorName: "Sameer Khan",
        authorRole: "IT Systems Admin (SIT)",
        isInternalNote: true,
        message: "MemTest86 scheduled over lunch. Replacement 32GB ECC DIMM ready in IT inventory store.",
        createdAt: "2026-10-21T08:30:00Z",
      },
    ],
    history: [
      { timestamp: "2026-10-21T08:00:00Z", actor: "Avery Vale (EHW)", action: "Ticket Created" },
      { timestamp: "2026-10-21T08:30:00Z", actor: "Kai Morgan (SIT)", action: "Assigned to Sameer Khan" },
    ],
  },
  {
    id: "tkt-003",
    reference: "TKT-2026-0103",
    source: "Internal",
    requesterName: "Morgan Reed",
    requesterEmail: "morgan.reed@hexenselabs.com",
    requesterDepartment: "PUR",
    subject: "VPN access token expired for Mouser ERP Procurement API Gateway",
    description: "Automated BOM sync daemon failing on outbound API requests due to IPsec tunnel phase-2 renegotiation failure.",
    category: "Cloud & Gateway",
    priority: "Normal",
    assignedOwner: "Sameer Khan (SIT)",
    status: "Resolved",
    slaDueHours: 48,
    createdAt: "2026-10-19T10:00:00Z",
    updatedAt: "2026-10-19T12:00:00Z",
    resolvedAt: "2026-10-19T12:00:00Z",
    replies: [
      {
        id: "rep-004",
        authorName: "Sameer Khan",
        authorRole: "IT Systems Admin (SIT)",
        isInternalNote: true,
        message: "Cisco ASA IPsec key rotated and Mouser static IP whitelist refreshed. Sync daemon operational.",
        createdAt: "2026-10-19T12:00:00Z",
      },
    ],
    history: [
      { timestamp: "2026-10-19T10:00:00Z", actor: "Morgan Reed (PUR)", action: "Ticket Created" },
      { timestamp: "2026-10-19T12:00:00Z", actor: "Sameer Khan (SIT)", action: "Resolved & Closed" },
    ],
  },
];

/**
 * Filter tickets strictly according to Section 6 of the consolidated handoff:
 * 
 * - Internal tickets:
 *   - Requester can view their own.
 *   - Authorized Service team (SIT, Admin) manages and views all.
 *   - EXCLUDED FROM SALES BY DEFAULT!
 * - Client tickets:
 *   - Requesting client sees their permitted ticket (matching their client org / email).
 *   - Authorized Service team (SIT, Admin) manages and views all.
 *   - Sales team sees client tickets within relevant client/project scope.
 * - Other staff:
 *   - Only their own requested tickets or explicit assignment.
 */
export function filterAuthorizedTickets(
  tickets: ServiceTicket[],
  userContext: {
    role: string; // e.g. "admin", "sit", "sal", "sales", "client", "ehw", "pur", etc.
    email: string;
    organization?: string | undefined;
    department?: string | undefined;
  }
): ServiceTicket[] {
  const normalizedRole = userContext.role.trim().toLowerCase();
  const normalizedEmail = userContext.email.trim().toLowerCase();

  // 1. Admin and SIT (Service & IT) have universal visibility
  if (normalizedRole === "admin" || normalizedRole === "sit" || userContext.department?.toLowerCase() === "sit") {
    return tickets;
  }

  // 2. Client Portal: sees only Client tickets for their own organization/email
  if (normalizedRole === "client") {
    return tickets
      .filter((t) => t.source === "Client" && (
        (userContext.organization && t.clientOrganization?.toLowerCase().includes(userContext.organization.toLowerCase())) ||
        t.requesterEmail.toLowerCase() === normalizedEmail
      ))
      .map((t) => ({
        // Strip all internal notes from client view
        ...t,
        replies: t.replies.filter((r) => !r.isInternalNote),
      }));
  }

  // 3. Sales & BD: sees Client tickets for coordination, but NEVER internal employee tickets
  if (normalizedRole === "sal" || normalizedRole === "sales") {
    return tickets.filter((t) => t.source === "Client" || t.requesterEmail.toLowerCase() === normalizedEmail);
  }

  // 4. Other internal employees (EHW, PUR, QA, MECH, FIN, HROPS, etc.):
  // Only see tickets where they are the requester, explicitly assigned owner,
  // or received an explicitly addressed department-help request. The latter is
  // projected to a minimal request-only view: no original ticket thread/notes.
  const departmentCode = userContext.department?.toUpperCase();
  return tickets.flatMap((ticket) => {
    if (ticket.requesterEmail.toLowerCase() === normalizedEmail ||
      (ticket.assignedOwner && ticket.assignedOwner.toLowerCase().includes(normalizedEmail))) return [ticket];
    const request = ticket.departmentHelpRequests?.find((item) => item.departmentCode.toUpperCase() === departmentCode && item.status !== "Closed");
    if (!request) return [];
    return [{
      ...ticket,
      source: "Internal" as const,
      requesterName: `Service & IT · ${ticket.reference}`,
      requesterEmail: "",
      requesterDepartment: "SIT",
      clientOrganization: undefined,
      subject: `Department help · ${ticket.reference}`,
      description: request.summary,
      projectId: undefined,
      assetId: undefined,
      assignedOwner: request.departmentName,
      status: request.status === "Requested" ? "Open" as const : request.status === "Closed" ? "Closed" as const : "In Progress" as const,
      replies: request.response ? [{ id: `${request.id}-response`, authorName: request.respondedBy || request.departmentName, authorRole: request.departmentCode, isInternalNote: false, message: request.response, createdAt: request.respondedAt || request.createdAt }] : [],
      history: [{ timestamp: request.createdAt, actor: request.requestedBy, action: `Help requested from ${request.departmentName}` }],
      departmentHelpRequests: [request],
    }];
  });
}

/**
 * Filter ticket replies to ensure internal notes are never exposed to clients
 */
export function filterAuthorizedReplies(
  replies: TicketReply[],
  isClient: boolean
): TicketReply[] {
  if (isClient) {
    return replies.filter((r) => !r.isInternalNote);
  }
  return replies;
}
