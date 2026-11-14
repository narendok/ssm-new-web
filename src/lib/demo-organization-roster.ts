/**
 * Canonical fictional employee and organization-chart fixture.
 *
 * This is demonstration data only. It is never an authority for authenticated
 * membership, HR facts, clearance, approvals, or production task ownership.
 */

export const DEMO_ORG_LEVELS = {
  1: "L1 · Lead",
  2: "L2 · Senior / specialist",
  3: "L3 · Associate / technician",
  4: "L4 · Operator / trainee",
} as const;

export type DemoOrgLevel = keyof typeof DEMO_ORG_LEVELS;

export const DEMO_ORGANIZATION_DEPARTMENTS = [
  { code: "SAL", area: "sales", name: "Sales & Business Development", facility: "DEMO ONLY · Noida sample office" },
  { code: "EHW", area: "ehw", name: "Embedded Hardware Engineering", facility: "DEMO ONLY · Hardware sample lab" },
  { code: "FW", area: "fw", name: "Firmware Engineering", facility: "DEMO ONLY · Firmware sample lab" },
  { code: "SW", area: "sw", name: "Cloud & Application Software", facility: "DEMO ONLY · Software sample office" },
  { code: "MECH", area: "mech", name: "Mechanical Engineering", facility: "DEMO ONLY · Mechanical sample bay" },
  { code: "PUR", area: "pur", name: "Purchasing & Supply Chain", facility: "DEMO ONLY · Sample stores" },
  { code: "QA", area: "qa", name: "Quality Assurance & APQP", facility: "DEMO ONLY · Quality sample lab" },
  { code: "EMF", area: "emf", name: "Electronics Manufacturing", facility: "DEMO ONLY · Box-build sample floor" },
  { code: "MMF", area: "mmf", name: "Mechanical Manufacturing", facility: "DEMO ONLY · Mechanical sample shop" },
  { code: "FIN", area: "fin", name: "Finance & Accounts", facility: "DEMO ONLY · Finance sample office" },
  { code: "SIT", area: "sit", name: "Service & IT", facility: "DEMO ONLY · IT sample room" },
  { code: "HR", area: "hrops", name: "HR & Operations", facility: "DEMO ONLY · Operations sample office" },
] as const;

export type DemoDepartmentCode = (typeof DEMO_ORGANIZATION_DEPARTMENTS)[number]["code"];
export type DemoDepartmentArea = (typeof DEMO_ORGANIZATION_DEPARTMENTS)[number]["area"];

export interface DemoOrganizationPerson {
  fixtureKey: string;
  employeeCode: string;
  profileKey?: string | undefined;
  personaId?: string | undefined;
  profileId?: string | undefined;
  name: string;
  departmentCode: DemoDepartmentCode;
  area: DemoDepartmentArea;
  departmentName: string;
  roleTitle: string;
  hierarchyLevel: DemoOrgLevel;
  reportsToFixtureKey: string;
  workEmail: string;
  workPhone: string;
  facilityLocation: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  joiningDate: string;
  skills: string[];
  sampleAssessment: "Not assessed · DEMO ONLY";
  securityClearance: "Not recorded";
  status: "DEMO_ONLY";
}

const deptByCode = Object.fromEntries(DEMO_ORGANIZATION_DEPARTMENTS.map((department) => [department.code, department])) as Record<DemoDepartmentCode, (typeof DEMO_ORGANIZATION_DEPARTMENTS)[number]>;

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
}

function person(
  departmentCode: DemoDepartmentCode,
  order: number,
  employeeCode: string,
  name: string,
  roleTitle: string,
  hierarchyLevel: DemoOrgLevel,
  skills: string[],
  options: { profileKey?: string; personaId?: string; profileId?: string; joiningDate?: string } = {},
): DemoOrganizationPerson {
  const department = deptByCode[departmentCode];
  const fixtureKey = `DEMO-EMP-${departmentCode}-${String(order).padStart(2, "0")}`;
  const reportsToFixtureKey = hierarchyLevel === 1
    ? "DEMO-ORG-ADMIN"
    : `DEMO-EMP-${departmentCode}-${String(Math.max(1, order - 1)).padStart(2, "0")}`;
  const key = slug(name);
  return {
    fixtureKey,
    employeeCode,
    ...(options.profileKey ? { profileKey: options.profileKey } : {}),
    ...(options.personaId ? { personaId: options.personaId } : {}),
    ...(options.profileId ? { profileId: options.profileId } : {}),
    name,
    departmentCode,
    area: department.area,
    departmentName: department.name,
    roleTitle,
    hierarchyLevel,
    reportsToFixtureKey,
    workEmail: `${key}@demo.ssm-one.test`,
    workPhone: "+91 00000 00000 · fictional, non-callable",
    facilityLocation: department.facility,
    emergencyContactName: `DEMO ONLY · Emergency contact for ${name}`,
    emergencyContactPhone: "+91 00000 00000 · fictional, non-callable",
    joiningDate: options.joiningDate ?? "2024-01-15",
    skills,
    sampleAssessment: "Not assessed · DEMO ONLY",
    securityClearance: "Not recorded",
    status: "DEMO_ONLY",
  };
}

export const DEMO_ORGANIZATION_ROSTER: DemoOrganizationPerson[] = [
  person("SAL", 1, "HLPL-EMP-102", "Priya Sharma", "Sales & BD Lead", 1, ["RFQ intake", "Commercial review", "Client communications", "Contract controls"], { profileKey: "sales", personaId: "sales", profileId: "usr-sal-priya", joiningDate: "2023-04-15" }),
  person("SAL", 2, "DEMO-SAL-002", "Rohan Mehta", "Senior Key Account Manager", 2, ["Fleet accounts", "Commercial negotiations", "OEM pipeline"]),
  person("SAL", 3, "DEMO-SAL-003", "Tanya Sen", "OEM Proposals Specialist", 3, ["SOR analysis", "Cost breakdown", "Quotation drafting"]),

  person("EHW", 1, "HLPL-EMP-103", "Avery Vale", "Hardware Engineering Lead", 1, ["Architecture", "Schematics", "PCB release", "DFMEA"], { profileKey: "ehw", personaId: "ehw", profileId: "usr-ehw-avery", joiningDate: "2022-08-01" }),
  person("EHW", 2, "DEMO-EHW-002", "Maya Lin", "Senior PCB Layout Engineer", 2, ["Altium Designer", "High-Speed Routing", "Stackup design", "DFM verification"]),
  person("EHW", 3, "DEMO-EHW-003", "Alex Chen", "Hardware Validation Engineer", 3, ["Power supplies", "ISO 7637-2", "Bench bring-up"]),
  person("EHW", 4, "DEMO-EHW-004", "Raghav Joshi", "Electronics Test Technician", 4, ["Bench setup", "Continuity checks", "Test fixture operation"]),

  person("FW", 1, "HLPL-EMP-104", "Devon Lane", "Firmware Lead", 1, ["RTOS", "MCU HAL", "Bootloader", "CAN driver"], { profileKey: "fw", personaId: "fw", profileId: "usr-fw-devon", joiningDate: "2023-02-15" }),
  person("FW", 2, "DEMO-FW-002", "Sneha Patel", "Senior CAN Protocol Specialist", 2, ["J1939 stack", "OBD-II PIDs", "TLS encryption"]),
  person("FW", 3, "DEMO-FW-003", "Aarav Kulkarni", "Firmware Associate Engineer", 3, ["Device drivers", "Regression tests", "Build notes"]),

  person("SW", 1, "HLPL-EMP-105", "Siddharth Roy", "Cloud & Application Software Lead", 1, ["Telemetry architecture", "MQTT broker", "APIs", "Cloud infrastructure"], { profileKey: "sw", personaId: "sw", profileId: "usr-sw-siddharth", joiningDate: "2023-03-01" }),
  person("SW", 2, "DEMO-SW-002", "Nathan Cole", "Senior Cloud Telemetry Specialist", 2, ["FOTA server", "Device shadows", "Webhooks"]),
  person("SW", 3, "DEMO-SW-003", "Uma Iyer", "Application Software Associate", 3, ["UI implementation", "API tests", "Release notes"]),

  person("MECH", 1, "HLPL-EMP-106", "Samira Holt", "Mechanical Engineering Lead", 1, ["STEP model", "Tolerance stack", "Tooling", "Sealing review"], { profileKey: "mech", personaId: "mech", profileId: "usr-mech-samira", joiningDate: "2023-05-10" }),
  person("MECH", 2, "DEMO-MECH-002", "Vikram Kapoor", "Senior CAD & Mold Specialist", 2, ["SolidWorks", "Injection mold tooling", "Enclosure design"]),
  person("MECH", 3, "DEMO-MECH-003", "Deepak Nair", "Thermal & Ingress Protection Engineer", 3, ["IP67 gaskets", "CFD thermal modeling", "Vibration mounts"]),

  person("PUR", 1, "HLPL-EMP-107", "Morgan Reed", "Purchasing & SCM Lead", 1, ["Supplier qualification", "PPAP", "Cost controls", "Capacity planning"], { profileKey: "pur", personaId: "pur", profileId: "usr-pur-morgan", joiningDate: "2023-01-10" }),
  person("PUR", 2, "DEMO-PUR-002", "Anita Desai", "Strategic Sourcing Specialist", 2, ["Distributor agreements", "Volume pricing", "Lead-time planning"]),
  person("PUR", 3, "DEMO-PUR-003", "Vikram Malhotra", "Vendor Quality Coordinator", 3, ["ASL audits", "Certificate review", "PPAP dossier"]),
  person("PUR", 4, "DEMO-PUR-004", "Kavita Rao", "Inward Stores Operator", 4, ["IQC quarantine", "Bin management", "FIFO stock"]),

  person("QA", 1, "HLPL-EMP-108", "Jordan Blake", "Quality Assurance & APQP Lead", 1, ["APQP", "DVP&R", "CAPA", "Release review"], { profileKey: "qa", personaId: "qa", profileId: "usr-qa-jordan", joiningDate: "2022-11-20" }),
  person("QA", 2, "DEMO-QA-002", "Sneha Kulkarni", "Senior DVP&R Specialist", 2, ["AIS-140 verification", "ISO 7637-2", "Environmental tests"]),
  person("QA", 3, "DEMO-QA-003", "Harish Menon", "Incoming Quality Technician", 3, ["First article inspection", "Lot sampling", "Defect containment"]),

  person("EMF", 1, "HLPL-EMP-109", "Casey Rowan", "Electronics Manufacturing Lead", 1, ["PFD", "PFMEA", "Line startup", "Control plan"], { profileKey: "emf", personaId: "emf", profileId: "usr-emf-casey", joiningDate: "2023-06-01" }),
  person("EMF", 2, "DEMO-EMF-002", "Rajesh Gokhale", "Box-Build Line Supervisor", 2, ["PCBA traceability", "Firmware loading", "First-off checks"]),
  person("EMF", 3, "DEMO-EMF-003", "Ankit Sharma", "Process Quality Technician", 3, ["Assembly checks", "Harness continuity", "Defect logging"]),
  person("EMF", 4, "DEMO-EMF-004", "Sunita Das", "EOL Test Operator", 4, ["Pre-flash", "CAN loopback", "PDI and label checks"]),

  person("MMF", 1, "HLPL-EMP-110", "Neeraj Banerjee", "Mechanical Manufacturing Lead", 1, ["Enclosure manufacturing", "3D model release", "Tooling coordination"], { profileKey: "mmf", personaId: "mmf", profileId: "usr-mmf-lead", joiningDate: "2023-07-15" }),
  person("MMF", 2, "DEMO-MMF-002", "Arjun Basu", "Senior Enclosure & Tooling Specialist", 2, ["CAD-to-tool review", "Moldability", "Tool trials"]),
  person("MMF", 3, "DEMO-MMF-003", "Nikhil Das", "Mechanical Assembly Technician", 3, ["Dimensional checks", "Subassembly", "Fit verification"]),

  person("FIN", 1, "HLPL-EMP-111", "Priya Voss", "Finance & Accounts Lead", 1, ["Invoice control", "GRN validation", "Tax close"], { profileKey: "fin", personaId: "fin", profileId: "usr-fin-priya", joiningDate: "2022-09-01" }),
  person("FIN", 2, "DEMO-FIN-002", "Arun Chawla", "Commercial Invoicing Specialist", 2, ["GST / HSN", "Dispatch reconciliation", "Credit notes"]),
  person("FIN", 3, "DEMO-FIN-003", "Meenakshi S", "Vendor Payables Associate", 3, ["Three-way PO matching", "Vendor ledger", "Audit schedules"]),

  person("SIT", 1, "HLPL-EMP-112", "Kai Morgan", "Service & IT Lead", 1, ["Ticket routing", "Backup assurance", "Support", "ISMS"], { profileKey: "sit", personaId: "sit", profileId: "usr-sit-kai", joiningDate: "2023-08-20" }),
  person("SIT", 2, "DEMO-SIT-002", "Sameer Khan", "Senior Cloud & Server Administrator", 2, ["Kubernetes", "Database operations", "VPN and access"]),
  person("SIT", 3, "DEMO-SIT-003", "Preeti Joshi", "Field Service & RMA Associate", 3, ["Field diagnostics", "RMA intake", "Ticket resolution"]),

  person("HR", 1, "HLPL-EMP-113", "Taylor Quinn", "HR & Operations Lead", 1, ["Competency planning", "Training needs", "Compliance calendar"], { profileKey: "hrops", personaId: "hrops", profileId: "usr-hrops-taylor", joiningDate: "2022-05-15" }),
  person("HR", 2, "DEMO-HR-002", "Shalini Rao", "Senior Training & Competency Specialist", 2, ["Onboarding", "Competency reviews", "Training records"]),
  person("HR", 3, "DEMO-HR-003", "Kunal Varma", "Facilities & EHS Associate", 3, ["EHS checks", "PPE compliance", "Incident reporting"]),
];

export const DEMO_PROFILE_LEADS = DEMO_ORGANIZATION_ROSTER.filter((profile) => profile.profileKey);

export const DEMO_ORGANIZATION_ADMIN = {
  fixtureKey: "DEMO-ORG-ADMIN",
  employeeCode: "HLPL-EXEC-001",
  profileKey: "admin",
  profileId: "usr-admin-exec",
  name: "Executive Admin",
  departmentCode: "ADMIN",
  departmentName: "Executive Command / MD",
  roleTitle: "Managing Director & Executive Admin",
  workEmail: "admin@demo.ssm-one.test",
  workPhone: "+91 00000 00000 · fictional, non-callable",
  facilityLocation: "DEMO ONLY · Sample executive office",
  emergencyContactName: "DEMO ONLY · Emergency contact for Executive Admin",
  emergencyContactPhone: "+91 00000 00000 · fictional, non-callable",
  joiningDate: "2021-01-01",
  hierarchyLevel: 1 as const,
  skills: ["Company configuration", "Lifecycle governance", "Access review"],
  sampleAssessment: "Not assessed · DEMO ONLY" as const,
  securityClearance: "Not recorded" as const,
  status: "DEMO_ONLY" as const,
};

export function demoEmployeeFixtureByName(name: string) {
  return DEMO_ORGANIZATION_ROSTER.find((profile) => profile.name.toLowerCase() === name.toLowerCase());
}
