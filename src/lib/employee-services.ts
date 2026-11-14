/**
 * Employee Self-Service, HR Letters, Policies, Training & Forms Model
 * Conforming to BUDGET_HR_AND_TEAM_COMMUNICATION_PLAN_2026-10-21.md
 * 
 * Rules:
 * 1. Every internal person (employee, lead, Admin) has their own self-service profile.
 * 2. Letters reuse controlled document catalogue and require human sign-off (no automatic release).
 * 3. Policy acknowledgment is tied to the exact published revision.
 * 4. Anonymous survey responses have separated response tracking.
 */

import {
  DEMO_ORGANIZATION_ADMIN,
  DEMO_ORGANIZATION_ROSTER,
} from "./demo-organization-roster";

export interface EmployeeProfile {
  id: string;
  employeeCode: string; // e.g. "HLPL-EMP-104"
  name: string;
  email: string;
  phone: string;
  departmentCode: string; // "EHW", "SAL", "PUR", "QA", "FIN", "HROPS"
  departmentName: string;
  roleTitle: string;
  securityClearance: string; // Only populated from an authoritative HR/security source.
  facilityLocation: string;  // Only populated from an authoritative facilities source.
  emergencyContact: string;
  joiningDate: string;
  status: "Active" | "Probation" | "Notice" | "On_Leave";
}

export interface EmployeeLetter {
  id: string;
  employeeId: string;
  templateType: "Appointment" | "Confirmation" | "Promotion" | "Relieving" | "Experience" | "SOP_Notice" | "Bonus_Award";
  referenceNumber: string; // e.g. "HLPL/HR/2026/LTR-104"
  title: string;
  effectiveDate: string;
  version: number;
  status: "Draft" | "Review" | "Approved" | "Issued";
  signerName: string;
  issuedAt?: string | undefined;
  previewUrl?: string | undefined;
  summary: string;
}

export interface AssignedPolicy {
  id: string;
  employeeId?: string | undefined;
  policyCode: string; // e.g. "POL-IATF-08", "POL-IT-SEC-01"
  title: string;
  category: "Quality (IATF 16949)" | "Information Security (ISO 27001)" | "Workplace Health & Safety" | "Code of Conduct";
  revision: string; // e.g. "Rev 2.1"
  effectiveDate: string;
  status: "Pending" | "Acknowledged";
  acknowledgedAt?: string | undefined;
  deadline: string;
  documentRef: string;
  summary: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
}

export interface AssignedTraining {
  id: string;
  employeeId?: string | undefined;
  courseCode: string; // e.g. "TRN-ESD-01", "TRN-CAN-02"
  title: string;
  category: "Automotive Standards" | "ESD & Manufacturing" | "Functional Safety (ISO 26262)" | "Software & Security";
  trainer: string;
  durationHours: number;
  status: "Assigned" | "In_Progress" | "Completed" | "Refresher_Due";
  scorePct?: number | undefined;
  completedAt?: string | undefined;
  expiryDate?: string | undefined;
  certificateRef?: string | undefined;
  quizQuestions: QuizQuestion[];
}

export interface FormQuestion {
  id: string;
  label: string;
  type: "text" | "number" | "choice" | "rating" | "boolean";
  options?: string[] | undefined;
  required: boolean;
}

export interface AssignedFormSurvey {
  id: string;
  employeeId?: string | undefined;
  formCode: string;
  title: string;
  type: "Operational_Form" | "Pulse_Survey" | "Health_Check";
  isAnonymous: boolean;
  status: "Pending" | "Submitted";
  dueDate: string;
  submittedAt?: string | undefined;
  questions: FormQuestion[];
  answers?: Record<string, any> | undefined;
}

export interface EmployeeAssignedAsset {
  id: string;
  employeeId?: string | undefined;
  assetTag: string; // e.g. "AST-IT-NB-2041"
  assetName: string;
  category: "Computing & IT" | "Lab & Measurement Equipment" | "Access & Security Badges" | "Tooling & Jigs";
  serialNumber: string;
  condition: "Brand New" | "Good" | "Needs Maintenance";
  assignedDate: string;
  acknowledged: boolean;
}

/** Directory of Active Internal Personas for My Profile */
function profileFromDemoRoster(person: (typeof DEMO_ORGANIZATION_ROSTER)[number]): EmployeeProfile {
  return {
    id: person.profileId ?? `demo-profile-${person.fixtureKey.toLowerCase()}`,
    employeeCode: person.employeeCode,
    name: person.name,
    email: person.workEmail,
    phone: person.workPhone,
    departmentCode: person.departmentCode,
    departmentName: person.departmentName,
    roleTitle: person.roleTitle,
    securityClearance: person.securityClearance,
    facilityLocation: person.facilityLocation,
    emergencyContact: `${person.emergencyContactName} · ${person.emergencyContactPhone}`,
    joiningDate: person.joiningDate,
    status: "Active",
  };
}

const demoAdminProfile: EmployeeProfile = {
  id: DEMO_ORGANIZATION_ADMIN.profileId,
  employeeCode: DEMO_ORGANIZATION_ADMIN.employeeCode,
  name: DEMO_ORGANIZATION_ADMIN.name,
  email: DEMO_ORGANIZATION_ADMIN.workEmail,
  phone: DEMO_ORGANIZATION_ADMIN.workPhone,
  departmentCode: DEMO_ORGANIZATION_ADMIN.departmentCode,
  departmentName: DEMO_ORGANIZATION_ADMIN.departmentName,
  roleTitle: DEMO_ORGANIZATION_ADMIN.roleTitle,
  securityClearance: DEMO_ORGANIZATION_ADMIN.securityClearance,
  facilityLocation: DEMO_ORGANIZATION_ADMIN.facilityLocation,
  emergencyContact: `${DEMO_ORGANIZATION_ADMIN.emergencyContactName} · ${DEMO_ORGANIZATION_ADMIN.emergencyContactPhone}`,
  joiningDate: DEMO_ORGANIZATION_ADMIN.joiningDate,
  status: "Active",
};

export const DEFAULT_EMPLOYEE_PROFILES: Record<string, EmployeeProfile> = Object.fromEntries([
  ["admin", demoAdminProfile],
  ...DEMO_ORGANIZATION_ROSTER.flatMap((person) => {
    const profile = profileFromDemoRoster(person);
    return [
      [person.fixtureKey, profile],
      [person.employeeCode, profile],
      [person.name.toLowerCase(), profile],
      ...(person.profileKey ? [[person.profileKey, profile]] : []),
      ...(person.personaId ? [[person.personaId, profile]] : []),
    ];
  }),
]) as Record<string, EmployeeProfile>;
// Aliases for backwards compatibility with email keys
if (DEFAULT_EMPLOYEE_PROFILES["admin"]) DEFAULT_EMPLOYEE_PROFILES["admin@example.com"] = DEFAULT_EMPLOYEE_PROFILES["admin"];
if (DEFAULT_EMPLOYEE_PROFILES["sales"]) DEFAULT_EMPLOYEE_PROFILES["priya.sharma@example.com"] = DEFAULT_EMPLOYEE_PROFILES["sales"];
if (DEFAULT_EMPLOYEE_PROFILES["ehw"]) DEFAULT_EMPLOYEE_PROFILES["avery.vale@example.com"] = DEFAULT_EMPLOYEE_PROFILES["ehw"];
if (DEFAULT_EMPLOYEE_PROFILES["fw"]) DEFAULT_EMPLOYEE_PROFILES["devon.lane@example.com"] = DEFAULT_EMPLOYEE_PROFILES["fw"];
if (DEFAULT_EMPLOYEE_PROFILES["sw"]) DEFAULT_EMPLOYEE_PROFILES["siddharth.roy@example.com"] = DEFAULT_EMPLOYEE_PROFILES["sw"];
if (DEFAULT_EMPLOYEE_PROFILES["mech"]) DEFAULT_EMPLOYEE_PROFILES["samira.holt@example.com"] = DEFAULT_EMPLOYEE_PROFILES["mech"];
if (DEFAULT_EMPLOYEE_PROFILES["pur"]) DEFAULT_EMPLOYEE_PROFILES["morgan.reed@example.com"] = DEFAULT_EMPLOYEE_PROFILES["pur"];
if (DEFAULT_EMPLOYEE_PROFILES["qa"]) DEFAULT_EMPLOYEE_PROFILES["jordan.blake@example.com"] = DEFAULT_EMPLOYEE_PROFILES["qa"];
if (DEFAULT_EMPLOYEE_PROFILES["emf"]) DEFAULT_EMPLOYEE_PROFILES["casey.rowan@example.com"] = DEFAULT_EMPLOYEE_PROFILES["emf"];
if (DEFAULT_EMPLOYEE_PROFILES["fin"]) DEFAULT_EMPLOYEE_PROFILES["priya.voss@example.com"] = DEFAULT_EMPLOYEE_PROFILES["fin"];
if (DEFAULT_EMPLOYEE_PROFILES["sit"]) DEFAULT_EMPLOYEE_PROFILES["kai.morgan@example.com"] = DEFAULT_EMPLOYEE_PROFILES["sit"];
if (DEFAULT_EMPLOYEE_PROFILES["hrops"]) DEFAULT_EMPLOYEE_PROFILES["taylor.quinn@example.com"] = DEFAULT_EMPLOYEE_PROFILES["hrops"];

/**
 * Resolves an authenticated internal employee profile based on persona and optional testMembership.
 * FAILS CLOSED: Returns undefined if persona is Client, unknown, or has no profile.
 * NEVER defaults to Admin or leaks a Department Lead's profile to a regular member!
 */
export function resolveEmployeeProfile(
  persona: {
    id?: string | undefined;
    person?: string | undefined;
    kind?: string | undefined;
    departmentId?: string | undefined;
  },
  testMembership?: {
    organizationId?: string | undefined;
    organizationName?: string | undefined;
    membershipId: string;
    displayName: string;
    role: "admin" | "department_lead" | "member" | "viewer" | string;
    departmentCode: string | null;
    departmentName: string | null;
    isClient: boolean;
  } | null
): EmployeeProfile | undefined {
  if (!persona || persona.kind === "client" || testMembership?.isClient) {
    return undefined; // Client fails closed
  }

  if (testMembership) {
    if (!testMembership.membershipId || !testMembership.displayName || !["admin", "department_lead", "member"].includes(testMembership.role)) return undefined;
    return {
      id: testMembership.membershipId,
      employeeCode: "Not recorded",
      name: testMembership.displayName,
      email: "Not recorded", phone: "Not recorded",
      departmentCode: testMembership.departmentCode ?? "Not recorded",
      departmentName: testMembership.departmentName ?? "Not recorded",
      roleTitle: testMembership.role === "admin" ? "Administrator" : testMembership.role === "department_lead" ? "Department lead" : "Employee",
      securityClearance: "Not recorded", facilityLocation: "Not recorded",
      emergencyContact: "Not recorded", joiningDate: "Not recorded", status: "Active",
    };
  }

  // 2. DEMO Mode
  // If persona is a member: NEVER return the department lead!
  if (persona.kind === "member") {
    const deptKey = persona.departmentId?.toLowerCase();
    if (!deptKey) return undefined;
    const exact = persona.id ? DEFAULT_EMPLOYEE_PROFILES[persona.id] : undefined;
    if (exact && exact.departmentCode.toLowerCase() === deptKey) return exact;
    const scoped = DEMO_ORGANIZATION_ROSTER.find((person) =>
      person.area.toLowerCase() === deptKey &&
      persona.person?.toLowerCase() === person.name.toLowerCase(),
    ) ?? DEMO_ORGANIZATION_ROSTER.find((person) => person.area.toLowerCase() === deptKey && person.hierarchyLevel === 3);
    return scoped ? profileFromDemoRoster(scoped) : undefined;
  }

  // Admin persona
  if (persona.kind === "admin") {
    return DEFAULT_EMPLOYEE_PROFILES["admin"];
  }

  // Lead persona: ONLY return the lead if persona is explicitly a lead!
  if (persona.kind === "lead" && persona.departmentId && DEFAULT_EMPLOYEE_PROFILES[persona.departmentId]) {
    return DEFAULT_EMPLOYEE_PROFILES[persona.departmentId];
  }

  // If matching exact persona.id in directory
  if (persona.id && DEFAULT_EMPLOYEE_PROFILES[persona.id]) {
    return DEFAULT_EMPLOYEE_PROFILES[persona.id];
  }

  // Fail closed: unrecognized persona does not receive any employee profile
  return undefined;
}

/** Default Letters for Employee */
export const DEFAULT_EMPLOYEE_LETTERS: EmployeeLetter[] = [
  {
    id: "LTR-2026-001",
    employeeId: "usr-ehw-avery",
    templateType: "Appointment",
    referenceNumber: "HLPL/HR/2022/APT-089",
    title: "Official Appointment Letter — Principal Hardware Engineer",
    effectiveDate: "2022-08-01",
    version: 1,
    status: "Issued",
    signerName: "Taylor Quinn (HR Lead)",
    issuedAt: "2022-08-01",
    summary: "Formal employment terms, compensation structure, IATF 16949 IP assignment, and confidentiality covenants.",
  },
  {
    id: "LTR-2026-002",
    employeeId: "usr-ehw-avery",
    templateType: "Promotion",
    referenceNumber: "HLPL/HR/2025/PRM-031",
    title: "Promotion & Designation Elevation — Hardware Engineering Lead",
    effectiveDate: "2025-04-01",
    version: 1,
    status: "Issued",
    signerName: "Executive Admin & Taylor Quinn",
    issuedAt: "2025-04-01",
    summary: "Promotion to Department Lead with engineering signing authority under IATF 16949 §8.3 Design & Development.",
  },
  {
    id: "LTR-2026-003",
    employeeId: "usr-ehw-avery",
    templateType: "SOP_Notice",
    referenceNumber: "HLPL/HR/2026/SOP-014",
    title: "Authorized Stage-Gate Signing Authority Assignment (Rev 2)",
    effectiveDate: "2026-10-01",
    version: 2,
    status: "Issued",
    signerName: "Executive Admin",
    issuedAt: "2026-10-01",
    summary: "TEST delegation example for Phase 3 hardware schematics and controlled BOM review. Actual signing authority follows configured permissions.",
  },
];

/** Default Policies to Acknowledge */
export const DEFAULT_ASSIGNED_POLICIES: AssignedPolicy[] = [
  {
    id: "POL-001",
    policyCode: "POL-IATF-08",
    title: "IATF 16949 Automotive Product Safety & Design Verification Policy",
    category: "Quality (IATF 16949)",
    revision: "Rev 3.0",
    effectiveDate: "2026-10-01",
    status: "Acknowledged",
    acknowledgedAt: "2026-10-05T09:30:00Z",
    deadline: "2026-10-15",
    documentRef: "HLPL-CORP-QA-POL-08",
    summary: "Mandatory zero-defect verification, DFMEA risk mitigation, and prototype traceability guidelines.",
  },
  {
    id: "POL-002",
    policyCode: "POL-SEC-04",
    title: "ISO 27001 Engineering Intellectual Property & Clean Desk Standard",
    category: "Information Security (ISO 27001)",
    revision: "Rev 2.2",
    effectiveDate: "2026-10-15",
    status: "Pending",
    deadline: "2026-10-31",
    documentRef: "HLPL-CORP-IT-POL-04",
    summary: "Protection of CAD schematics, client firmware keys, CAN telemetry credentials, and strict NDA adherence.",
  },
  {
    id: "POL-003",
    policyCode: "POL-ESD-02",
    title: "ANSI/ESD S20.20 Electrostatic Discharge Safe Handling in Electronics Labs",
    category: "Workplace Health & Safety",
    revision: "Rev 1.4",
    effectiveDate: "2026-09-01",
    status: "Acknowledged",
    acknowledgedAt: "2026-09-02T11:20:00Z",
    deadline: "2026-09-10",
    documentRef: "HLPL-CORP-OPS-POL-02",
    summary: "Grounding straps, dissipative mat verification, and ionization standards across all SMT and R&D workstations.",
  },
];

/** Default Training Courses & Quizzes */
export const DEFAULT_ASSIGNED_TRAININGS: AssignedTraining[] = [
  {
    id: "TRN-001",
    courseCode: "TRN-IATF-GATE",
    title: "IATF 16949 & VDA 6.3 Stage-Gate Readiness & APQP Protocol",
    category: "Automotive Standards",
    trainer: "Jordan Blake (QA Lead)",
    durationHours: 3.5,
    status: "Completed",
    scorePct: 96,
    completedAt: "2026-09-15",
    expiryDate: "2027-09-15",
    certificateRef: "CERT-IATF-2026-088",
    quizQuestions: [
      {
        id: "Q1",
        question: "Under IATF 16949 §8.3.4, who must sign off on hardware design verification before pilot SMT build?",
        options: ["Sales Lead alone", "Hardware Lead & Quality Assurance Lead", "External client alone", "Any intern"],
        correctOptionIndex: 1,
      },
    ],
  },
  {
    id: "TRN-002",
    courseCode: "TRN-CAN-J1939",
    title: "Automotive Dual-CAN J1939 & OBD-II Diagnostics Protocol Masterclass",
    category: "Software & Security",
    trainer: "Devon Lane (Firmware Lead)",
    durationHours: 4.0,
    status: "In_Progress",
    quizQuestions: [
      {
        id: "Q2",
        question: "What is the standard baud rate for heavy commercial vehicle J1939 powertrain CAN networks?",
        options: ["125 kbps", "250 kbps or 500 kbps", "10 Mbps", "9600 bps"],
        correctOptionIndex: 1,
      },
      {
        id: "Q3",
        question: "Which parameter group number (PGN) carries engine temperature telemetry in J1939?",
        options: ["PGN 65262", "PGN 00000", "PGN 99999", "PGN 12345"],
        correctOptionIndex: 0,
      },
    ],
  },
];

/** Default Forms & Surveys */
export const DEFAULT_ASSIGNED_FORMS: AssignedFormSurvey[] = [
  {
    id: "FRM-001",
    formCode: "FRM-SMT-SAFETY-Q3",
    title: "Q3 Ergonomics, ESD & SMT Facility Safety Inspection",
    type: "Operational_Form",
    isAnonymous: false,
    status: "Pending",
    dueDate: "2026-10-31",
    questions: [
      { id: "F1", label: "Are all ESD wrist strap calibrators verified daily in your lab?", type: "boolean", required: true },
      { id: "F2", label: "Rate current ventilation in the SMD reflow area (1 to 5):", type: "rating", required: true },
      { id: "F3", label: "Note any equipment requiring electrical re-tagging:", type: "text", required: false },
    ],
  },
  {
    id: "SURV-002",
    formCode: "SURV-CULTURE-2026",
    title: "Annual Automotive Engineering Team Collaboration Pulse (Anonymous)",
    type: "Pulse_Survey",
    isAnonymous: true,
    status: "Submitted",
    dueDate: "2026-10-20",
    submittedAt: "2026-10-18T16:00:00Z",
    questions: [
      { id: "S1", label: "Cross-department response time between Hardware & SCM is efficient:", type: "rating", required: true },
      { id: "S2", label: "What is the single biggest bottleneck in prototype turnaround?", type: "text", required: false },
    ],
  },
];

/** Default Employee Assets */
export const DEFAULT_EMPLOYEE_ASSETS: EmployeeAssignedAsset[] = [
  {
    id: "AST-001",
    employeeId: "usr-ehw-avery",
    assetTag: "AST-NB-DELL-5520",
    assetName: "Dell Precision 5520 Mobile Workstation (i7 / 32GB / Quadro)",
    category: "Computing & IT",
    serialNumber: "CN-0F3K88-72872",
    condition: "Good",
    assignedDate: "2022-08-01",
    acknowledged: true,
  },
  {
    id: "AST-002",
    employeeId: "usr-ehw-avery",
    assetTag: "AST-LAB-OSC-RIGOL",
    assetName: "Rigol MSO5000 4-Channel 350MHz Mixed Signal Oscilloscope",
    category: "Lab & Measurement Equipment",
    serialNumber: "MSO5A241100912",
    condition: "Good",
    assignedDate: "2023-02-15",
    acknowledged: true,
  },
  {
    id: "AST-003",
    employeeId: "usr-ehw-avery",
    assetTag: "AST-SEC-BADGE-L4",
    assetName: "Smart RFID Facility Security Keycard — Level 4 Master Access",
    category: "Access & Security Badges",
    serialNumber: "RFID-HEX-103",
    condition: "Brand New",
    assignedDate: "2026-01-05",
    acknowledged: true,
  },
];
