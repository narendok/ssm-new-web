/**
 * Team Communication, Channels, Threads & Polls Model
 * Conforming to BUDGET_HR_AND_TEAM_COMMUNICATION_PLAN_2026-10-21.md
 * 
 * Rules:
 * 1. Chat mentions or poll results NEVER bypass financial approval or stage sign-off.
 * 2. Shared data model between Web and Mobile (replacing local in-memory mutations).
 * 3. Structured links reference original records (tasks, documents, expenses, projects).
 * 4. Channel membership revocation removes message & attachment access.
 */

export interface ChatPollOption {
  id: string;
  text: string;
  votes: number;
}

export interface SharedChatPoll {
  id: string;
  question: string;
  options: ChatPollOption[];
  voters: Record<string, string>; // userId -> optionId (one vote per user)
  isClosed: boolean;
  isAnonymous: boolean;
  createdBy: string;
  createdAt: string;
}

export interface ChatRecordLink {
  type: "project" | "task" | "document" | "expense" | "inventory";
  id: string;
  reference: string;
  title: string;
}

export interface ChatThreadReply {
  id: string;
  messageId: string;
  senderId: string;
  senderName: string;
  senderDept: string;
  text: string;
  timestamp: string;
}

export interface SharedChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderDept: string;
  text: string;
  timestamp: string;
  isUrgent: boolean;
  conversationType?: string;
  tags?: string[];
  mentions: string[]; // e.g. ["@Avery", "@Jordan"]
  replies: ChatThreadReply[];
  recordLink?: ChatRecordLink | undefined;
  poll?: SharedChatPoll | undefined;
}

export interface TeamChannel {
  id: string;
  name: string; // e.g. "#general", "#engineering-hw"
  topic: string;
  isPrivate: boolean;
  deptScope?: string | undefined; // e.g. "ALL" or specific dept
  memberCount: number;
  unreadCount?: number | undefined;
}

/** Check if a persona is authorized to view and participate in a channel */
export function canUserAccessChannel(
  channel: TeamChannel,
  persona: { kind: string; departmentId?: string | undefined; id?: string | undefined }
): boolean {
  // Clients are completely isolated from internal team communication
  if (persona.kind === "client") return false;

  // Admin has universal channel access
  if (persona.kind === "admin") return true;

  // Company-wide channels are accessible to all internal employees & leads
  if (!channel.deptScope || channel.deptScope === "ALL") return true;

  const userDept = persona.departmentId?.toLowerCase();
  const channelDept = channel.deptScope.toLowerCase();

  // Direct department match
  if (userDept && userDept === channelDept) return true;

  // Cross-engineering access for hardware, firmware and software
  if (channelDept === "ehw" && (userDept === "fw" || userDept === "sw" || userDept === "mech")) return true;

  // Finance and Purchasing cross-collaboration
  if (channelDept === "pur" && userDept === "fin") return true;
  if (channelDept === "fin" && (userDept === "pur" || userDept === "sales")) return true;

  // Quality and Manufacturing cross-collaboration
  if (channelDept === "qa" && (userDept === "emf" || userDept === "mmf")) return true;

  return false;
}

/** Safely vote on a poll, strictly preventing voting on closed polls */
export function voteOnChatPoll(
  poll: SharedChatPoll,
  optionId: string,
  voterId: string
): { success: boolean; poll?: SharedChatPoll | undefined; reason?: string | undefined } {
  if (poll.isClosed) {
    return { success: false, reason: "Voting closed. Poll results are finalized." };
  }

  const currentVote = poll.voters[voterId];
  if (currentVote === optionId) {
    return { success: true, poll }; // No change
  }

  const updatedOptions = poll.options.map((opt) => {
    let delta = 0;
    if (opt.id === optionId) delta += 1;
    if (opt.id === currentVote) delta -= 1;
    return { ...opt, votes: Math.max(0, opt.votes + delta) };
  });

  const updatedPoll: SharedChatPoll = {
    ...poll,
    options: updatedOptions,
    voters: {
      ...poll.voters,
      [voterId]: optionId,
    },
  };

  return { success: true, poll: updatedPoll };
}

/** Default Channels matching Web and App */
export const DEFAULT_CHANNELS: TeamChannel[] = [
  {
    id: "chan-general",
    name: "#general",
    topic: "Company-wide operational announcements, milestone celebrations, and facility notices",
    isPrivate: false,
    deptScope: "ALL",
    memberCount: 28,
  },
  {
    id: "chan-engineering-hw",
    name: "#engineering-hw",
    topic: "Hardware schematics, DFM review, MCU bring-up, and lab test fixtures",
    isPrivate: false,
    deptScope: "EHW",
    memberCount: 8,
  },
  {
    id: "chan-purchasing-scm",
    name: "#purchasing-scm",
    topic: "Supplier lead times, component shortage triage, and PO allocations",
    isPrivate: false,
    deptScope: "PUR",
    memberCount: 6,
  },
  {
    id: "chan-quality-apqp",
    name: "#quality-apqp",
    topic: "DVP&R compliance, IQC inspection holds, and IATF audit readiness",
    isPrivate: false,
    deptScope: "QA",
    memberCount: 7,
  },
  {
    id: "chan-fin-budgets",
    name: "#fin-budgets",
    topic: "Department allocations, travel advances, and CapEx expense reviews",
    isPrivate: false,
    deptScope: "FIN",
    memberCount: 5,
  },
];

/** Default Initial Shared Messages with Polls and Record Links */
export const DEFAULT_CHAT_MESSAGES: SharedChatMessage[] = [
  {
    id: "MSG-001",
    channelId: "chan-general",
    senderId: "usr-admin-exec",
    senderName: "Executive Admin",
    senderDept: "ADMIN",
    text: "Tata Motors PO (PO-TATA-SLCT-2026-9041) for 50,000 units (₹20.33 Cr) confirmed! Cross-Department Sync Hub is now active. All HODs ensure Stage 4 deliverables are on schedule.",
    timestamp: "Today, 09:15 AM",
    isUrgent: true,
    mentions: ["@AllHODs", "@PriyaSharma"],
    replies: [
      {
        id: "REP-001-1",
        messageId: "MSG-001",
        senderId: "usr-sal-priya",
        senderName: "Priya Sharma",
        senderDept: "SAL",
        text: "Advance payment of ₹6.10 Cr has been reconciled with Pune treasury. Customer SOR freeze confirmed.",
        timestamp: "Today, 09:22 AM",
      },
      {
        id: "REP-001-2",
        messageId: "MSG-001",
        senderId: "usr-ehw-avery",
        senderName: "Avery Vale",
        senderDept: "EHW",
        text: "Schematics netlist EHW-SCH-01 is frozen. SMT Line 2 stencil tooling initiated.",
        timestamp: "Today, 09:30 AM",
      },
    ],
    recordLink: {
      type: "project",
      id: "HLPL-AI4T-01",
      reference: "HLPL-AI4T-01",
      title: "Tata Ace EV 4G Telematics Gateway",
    },
  },
  {
    id: "MSG-002",
    channelId: "chan-engineering-hw",
    senderId: "usr-ehw-avery",
    senderName: "Avery Vale",
    senderDept: "EHW",
    text: "Reviewing Quectel EG915N vs EG912Y footprint compatibility for the new 4G Cat-1 modem batch. Please vote on the alternate footprint plan:",
    timestamp: "Today, 10:05 AM",
    isUrgent: false,
    mentions: ["@DevonLane", "@MorganReed"],
    replies: [],
    poll: {
      id: "POLL-001",
      question: "Which dual-footprint layout strategy should we adopt for Stage 4 Gerber release?",
      options: [
        { id: "OPT-1", text: "Dual LGA footprint (Quectel EG915N + SimCom A7672)", votes: 5 },
        { id: "OPT-2", text: "Single LGA footprint with 20-week long-lead buffer order", votes: 2 },
        { id: "OPT-3", text: "Modular solder-on stamp hole daughtercard", votes: 1 },
      ],
      voters: {
        "usr-ehw-avery": "OPT-1",
        "usr-pur-morgan": "OPT-1",
        "usr-qa-jordan": "OPT-1",
      },
      isClosed: false,
      isAnonymous: false,
      createdBy: "Avery Vale",
      createdAt: "Today, 10:05 AM",
    },
    recordLink: {
      type: "document",
      id: "HLPL-AI4T-EHW-PRS-01",
      reference: "HLPL-AI4T-EHW-PRS-01",
      title: "Product Requirement Specification (Hardware)",
    },
  },
  {
    id: "MSG-003",
    channelId: "chan-fin-budgets",
    senderId: "usr-fin-priya",
    senderName: "Priya Voss",
    senderDept: "FIN",
    text: "Reminder: Q3 Expense claims & travel advances must be settled before month end. All department heads please review pending approvals in the queue.",
    timestamp: "Yesterday, 04:30 PM",
    isUrgent: false,
    mentions: ["@AllLeads"],
    replies: [],
    recordLink: {
      type: "expense",
      id: "EXP-EHW-2026-081",
      reference: "EXP-EHW-2026-081",
      title: "SMD rework nozzles & SAC305 paste",
    },
  },
];
