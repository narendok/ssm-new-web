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

export interface EmployeeProfile {
  id: string;
  employeeCode: string; // e.g. "HLPL-EMP-104"
  name: string;
  email: string;
  phone: string;
  departmentCode: string; // "EHW", "SAL", "PUR", "QA", "FIN", "HROPS"
  departmentName: string;
  roleTitle: string;
  securityClearance: string; // "Level 4 Master", "Level 3 Engineering Lead", "Level 2 Staff"
  facilityLocation: string;  // "Noida Tech Center & Greater Noida SMT 2"
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
export const DEFAULT_EMPLOYEE_PROFILES: Record<string, EmployeeProfile> = {
  "admin": {
    id: "usr-admin-exec",
    employeeCode: "HLPL-EXEC-001",
    name: "Executive Admin",
    email: "admin@example.com",
    phone: "+91 98765 43000",
    departmentCode: "ADMIN",
    departmentName: "Executive Command / MD",
    roleTitle: "Managing Director & Executive Admin",
    securityClearance: "Level 5 Universal Authority",
    facilityLocation: "Hexense Labs Headquarters, Noida",
    emergencyContact: "Board Secretariat (+91 98765 00000)",
    joiningDate: "2021-01-01",
    status: "Active",
  },
  "sales": {
    id: "usr-sal-priya",
    employeeCode: "HLPL-EMP-102",
    name: "Priya Sharma",
    email: "priya.sharma@example.com",
    phone: "+91 98765 43201",
    departmentCode: "SAL",
    departmentName: "Sales & Business Development",
    roleTitle: "Sales & BD Lead",
    securityClearance: "Level 3 Commercial Executive",
    facilityLocation: "Noida Tech Center — Corporate Wing",
    emergencyContact: "Raj Sharma (+91 98765 00101)",
    joiningDate: "2023-04-15",
    status: "Active",
  },
  "ehw": {
    id: "usr-ehw-avery",
    employeeCode: "HLPL-EMP-103",
    name: "Avery Vale",
    email: "avery.vale@example.com",
    phone: "+91 98765 43202",
    departmentCode: "EHW",
    departmentName: "Hardware Engineering",
    roleTitle: "Hardware Lead",
    securityClearance: "Level 4 Engineering Master",
    facilityLocation: "Noida Tech Center — R&D Lab 1",
    emergencyContact: "Elena Vale (+91 98765 00102)",
    joiningDate: "2022-08-01",
    status: "Active",
  },
  "fw": {
    id: "usr-fw-devon",
    employeeCode: "HLPL-EMP-104",
    name: "Devon Lane",
    email: "devon.lane@example.com",
    phone: "+91 98765 43203",
    departmentCode: "FW",
    departmentName: "Firmware Engineering",
    roleTitle: "Firmware Lead",
    securityClearance: "Level 3 Technical Specialist",
    facilityLocation: "Noida Tech Center — Embedded Lab",
    emergencyContact: "Claire Lane (+91 98765 00103)",
    joiningDate: "2023-02-15",
    status: "Active",
  },
  "sw": {
    id: "usr-sw-siddharth",
    employeeCode: "HLPL-EMP-105",
    name: "Siddharth Roy",
    email: "siddharth.roy@example.com",
    phone: "+91 98765 43204",
    departmentCode: "SW",
    departmentName: "Cloud & Software",
    roleTitle: "Software Lead",
    securityClearance: "Level 3 Technical Specialist",
    facilityLocation: "Noida Tech Center — Software Wing",
    emergencyContact: "Ananya Roy (+91 98765 00104)",
    joiningDate: "2023-03-01",
    status: "Active",
  },
  "mech": {
    id: "usr-mech-samira",
    employeeCode: "HLPL-EMP-106",
    name: "Samira Holt",
    email: "samira.holt@example.com",
    phone: "+91 98765 43205",
    departmentCode: "MECH",
    departmentName: "Mechanical Engineering",
    roleTitle: "Mechanical Lead",
    securityClearance: "Level 3 Technical Specialist",
    facilityLocation: "Noida Tech Center — Prototyping Bay",
    emergencyContact: "Zain Holt (+91 98765 00105)",
    joiningDate: "2023-05-10",
    status: "Active",
  },
  "pur": {
    id: "usr-pur-morgan",
    employeeCode: "HLPL-EMP-107",
    name: "Morgan Reed",
    email: "morgan.reed@example.com",
    phone: "+91 98765 43206",
    departmentCode: "PUR",
    departmentName: "Purchasing & SCM",
    roleTitle: "Purchasing Lead",
    securityClearance: "Level 3 Commercial Executive",
    facilityLocation: "Greater Noida SMT Plant 2 — Supply Base",
    emergencyContact: "David Reed (+91 98765 00106)",
    joiningDate: "2023-01-10",
    status: "Active",
  },
  "qa": {
    id: "usr-qa-jordan",
    employeeCode: "HLPL-EMP-108",
    name: "Jordan Blake",
    email: "jordan.blake@example.com",
    phone: "+91 98765 43207",
    departmentCode: "QA",
    departmentName: "Quality Assurance & APQP",
    roleTitle: "Quality Assurance Lead",
    securityClearance: "Level 4 Quality Lead",
    facilityLocation: "Greater Noida SMT Plant 2 — Reliability Lab",
    emergencyContact: "Sarah Blake (+91 98765 00107)",
    joiningDate: "2022-11-20",
    status: "Active",
  },
  "emf": {
    id: "usr-emf-casey",
    employeeCode: "HLPL-EMP-109",
    name: "Casey Rowan",
    email: "casey.rowan@example.com",
    phone: "+91 98765 43208",
    departmentCode: "EMF",
    departmentName: "Electronics Manufacturing",
    roleTitle: "Manufacturing Lead",
    securityClearance: "Level 3 Operations Specialist",
    facilityLocation: "Greater Noida SMT Plant 2 — Production Floor",
    emergencyContact: "Alex Rowan (+91 98765 00108)",
    joiningDate: "2023-06-01",
    status: "Active",
  },
  "mmf": {
    id: "usr-mmf-lead",
    employeeCode: "HLPL-EMP-110",
    name: "Mechanical Manufacturing Lead",
    email: "mmf.lead@example.com",
    phone: "+91 98765 43209",
    departmentCode: "MMF",
    departmentName: "Mechanical Manufacturing",
    roleTitle: "Mechanical Manufacturing Lead",
    securityClearance: "Level 3 Operations Specialist",
    facilityLocation: "Greater Noida Plant — CNC & Tooling Bay",
    emergencyContact: "Facility Admin (+91 98765 00109)",
    joiningDate: "2023-07-15",
    status: "Active",
  },
  "fin": {
    id: "usr-fin-priya",
    employeeCode: "HLPL-EMP-111",
    name: "Priya Voss",
    email: "priya.voss@example.com",
    phone: "+91 98765 43210",
    departmentCode: "FIN",
    departmentName: "Finance & Accounts",
    roleTitle: "Finance Lead",
    securityClearance: "Level 4 Financial Controller",
    facilityLocation: "Hexense Labs Headquarters, Noida",
    emergencyContact: "Vikram Voss (+91 98765 00110)",
    joiningDate: "2022-09-01",
    status: "Active",
  },
  "sit": {
    id: "usr-sit-kai",
    employeeCode: "HLPL-EMP-112",
    name: "Kai Morgan",
    email: "kai.morgan@example.com",
    phone: "+91 98765 43211",
    departmentCode: "SIT",
    departmentName: "Service & IT Infrastructure",
    roleTitle: "Service & IT Lead",
    securityClearance: "Level 4 Infrastructure Administrator",
    facilityLocation: "Hexense Labs Headquarters, Noida",
    emergencyContact: "Taylor Morgan (+91 98765 00111)",
    joiningDate: "2023-08-20",
    status: "Active",
  },
  "hrops": {
    id: "usr-hrops-taylor",
    employeeCode: "HLPL-EMP-113",
    name: "Taylor Quinn",
    email: "taylor.quinn@example.com",
    phone: "+91 98765 43212",
    departmentCode: "HROPS",
    departmentName: "HR & Operations",
    roleTitle: "HR & Operations Manager",
    securityClearance: "Level 4 Personnel Administrator",
    facilityLocation: "Hexense Labs Headquarters, Noida",
    emergencyContact: "Jordan Quinn (+91 98765 00112)",
    joiningDate: "2022-05-15",
    status: "Active",
  },
};

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
    // If exact member profile exists in directory by ID
    if (persona.id && DEFAULT_EMPLOYEE_PROFILES[persona.id]) {
      return DEFAULT_EMPLOYEE_PROFILES[persona.id];
    }
    // If persona has no recognized department, fail closed
    if (!persona.departmentId || !DEFAULT_EMPLOYEE_PROFILES[persona.departmentId.toLowerCase()]) {
      return undefined;
    }
    // Return a scoped member profile; never substitute Avery Vale or any other lead!
    const deptKey = persona.departmentId.toLowerCase();
    const leadTemplate = DEFAULT_EMPLOYEE_PROFILES[deptKey];
    if (!leadTemplate) {
      return undefined;
    }
    const deptCode = leadTemplate.departmentCode;
    const deptName = leadTemplate.departmentName;
    return {
      id: `demo-mem-${deptKey}-${persona.id || "01"}`,
      employeeCode: `HLPL-EMP-DEMO-${(persona.id || "01").toUpperCase()}`,
      name: persona.person || `${deptCode} Employee`,
      email: `${(persona.person || "employee").toLowerCase().replace(/\s+/g, ".")}@example.com`,
      phone: "+91 98765 00000",
      departmentCode: deptCode,
      departmentName: deptName,
      roleTitle: `${deptName} Engineer`,
      securityClearance: "Level 1 Operational Contributor",
      facilityLocation: "Hexense Labs Headquarters, Noida",
      emergencyContact: "HR Department (+91 98765 43212)",
      joiningDate: "2024-01-15",
      status: "Active",
    };
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
