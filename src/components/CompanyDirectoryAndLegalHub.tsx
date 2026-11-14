import { departmentCode } from "@/lib/department-scope";
import { DEMO_ORGANIZATION_ROSTER } from "@/lib/demo-organization-roster";
import { useState, useId } from "react";
import {
  Users,
  Building,
  FileText,
  Shield,
  Download,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  MapPin,
  Printer,
  ChevronRight,
  ExternalLink,
  BookOpen,
  Filter,
  Check,
  Building2,
  Award,
} from "lucide-react";

// ==========================================
// 1. Signed-in Company Directory (Master Plan §9)
// ==========================================
export type DirectoryContact = {
  id: string;
  name: string;
  departmentCode: string;
  departmentName: string;
  designation: string;
  reportingManager: string;
  workEmail: string;
  deskExtension: string;
  facilityLocation: string;
  primarySkills: string[];
  avatarInitial: string;
};

export const defaultCompanyDirectory: DirectoryContact[] = DEMO_ORGANIZATION_ROSTER.map((person) => {
  const manager = DEMO_ORGANIZATION_ROSTER.find((candidate) => candidate.fixtureKey === person.reportsToFixtureKey);
  return {
    id: person.employeeCode,
    name: person.name,
    departmentCode: person.departmentCode,
    departmentName: person.departmentName,
    designation: person.roleTitle,
    reportingManager: manager?.name ?? "DEMO ONLY · Executive Admin",
    workEmail: person.workEmail,
    deskExtension: "DEMO ONLY · no direct extension",
    facilityLocation: person.facilityLocation,
    primarySkills: person.skills,
    avatarInitial: person.name.split(" ").map((part) => part[0]).join("").slice(0, 2),
  };
});

export function CompanyDirectoryModal({
  onClose,
  initialDepartment,
  lockedDepartment,
  contacts,
}: {
  onClose: () => void;
  initialDepartment?: string | undefined;
  lockedDepartment?: string | undefined;
  contacts?: DirectoryContact[] | undefined;
}) {
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>(initialDepartment ?? "ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const departments = [
    { code: "ALL", name: "All Departments" },
    { code: "SAL", name: "Sales & BD" },
    { code: "EHW", name: "Embedded Hardware" },
    { code: "FW", name: "Firmware" },
    { code: "SW", name: "Cloud & Application Software" },
    { code: "MECH", name: "Mechanical Eng." },
    { code: "PUR", name: "Purchasing & SCM" },
    { code: "QA", name: "Quality Assurance" },
    { code: "EMF", name: "Electronics Manufacturing" },
    { code: "MMF", name: "Mechanical Manufacturing" },
    { code: "FIN", name: "Finance & Accounts" },
    { code: "SIT", name: "Service & IT" },
    { code: "HR", name: "HR & Operations" },
  ];

  const filtered = (contacts ?? defaultCompanyDirectory).filter((emp) => {
    if (lockedDepartment && departmentCode(emp.departmentCode) !== departmentCode(lockedDepartment)) return false;
    const matchesDept = Boolean(lockedDepartment) || selectedDept === "ALL" || departmentCode(emp.departmentCode) === departmentCode(selectedDept);
    const q = search.toLowerCase();
    const matchesSearch =
      emp.name.toLowerCase().includes(q) ||
      emp.designation.toLowerCase().includes(q) ||
      emp.workEmail.toLowerCase().includes(q) ||
      emp.departmentName.toLowerCase().includes(q) ||
      emp.facilityLocation.toLowerCase().includes(q) ||
      emp.primarySkills.some((s) => s.toLowerCase().includes(q));
    return matchesDept && matchesSearch;
  });

  const handleCopyEmail = (email: string, id: string) => {
    void navigator.clipboard?.writeText(email);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">{lockedDepartment ? `${lockedDepartment} Team Directory` : "Signed-In Company Directory"}</h2>
                <span className="rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                  {contacts ? "Shared TEST" : "DEMO ONLY"} · Work-Contact Projection
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {contacts ? "Account-backed workspace members ·" : "Fictional sample roster ·"} Work contact details are not proof of HR or security clearance.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Directory"
            className="rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, designation, skill..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-xs focus:ring-1 focus:ring-primary focus:outline-hidden"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {departments.filter(dept => !lockedDepartment || departmentCode(dept.code) === departmentCode(lockedDepartment)).slice(0, 7).map((dept) => (
              <button
                key={dept.code}
                onClick={() => setSelectedDept(dept.code)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  selectedDept === dept.code
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "border border-border/60 bg-card text-muted-foreground hover:bg-secondary"
                }`}
              >
                {dept.code}
              </button>
            ))}
            <select
              hidden={Boolean(lockedDepartment)}
              disabled={Boolean(lockedDepartment)}
              aria-label="Filter other departments"
              value={departments.slice(0, 7).some((d) => d.code === selectedDept) ? "" : selectedDept}
              onChange={(e) => {
                if (e.target.value) setSelectedDept(e.target.value);
              }}
              className="h-7 rounded-md border border-input bg-card px-2 text-xs font-medium text-muted-foreground"
            >
              <option value="">More...</option>
              {departments.slice(7).map((d) => (
                <option key={d.code} value={d.code}>
                  {d.code} · {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Directory Cards Grid */}
        <div className="grid flex-1 gap-3 overflow-y-auto p-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((emp) => (
            <div
              key={emp.id}
              className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-4 shadow-2xs transition hover:border-primary/40 hover:shadow-xs"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/80 to-steel/80 font-mono text-sm font-bold text-primary-foreground">
                      {emp.avatarInitial}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{emp.name}</h3>
                      <p className="font-mono text-[10px] text-muted-foreground">{emp.id}</p>
                    </div>
                  </div>
                  <span className="rounded-md border border-border/80 bg-secondary px-2 py-0.5 font-mono text-[10px] font-semibold text-foreground">
                    {emp.departmentCode}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 border-t border-border/40 pt-2.5 text-xs">
                  <p className="font-semibold text-foreground">{emp.designation}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Reports to: <strong className="text-foreground">{emp.reportingManager}</strong>
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <MapPin className="size-3 shrink-0 text-steel" />
                    <span className="truncate">{emp.facilityLocation}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Phone className="size-3 shrink-0 text-steel" />
                    <span>{emp.deskExtension}</span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {emp.primarySkills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
                <span className="truncate font-mono text-[10px] text-muted-foreground">
                  {emp.workEmail}
                </span>
                <button
                  type="button"
                  disabled={!emp.workEmail}
                  onClick={() => handleCopyEmail(emp.workEmail, emp.id)}
                  className="rounded-md border border-border bg-secondary px-2 py-1 text-[10px] font-semibold text-foreground transition hover:bg-muted"
                >
                  {copiedId === emp.id ? "Copied" : "Copy Email"}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-border bg-muted/10 px-5 py-3 text-xs text-muted-foreground">
          <span>{filtered.length} employees displayed</span>
          <span>XYZ Pvt Ltd</span>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. Official Decision Log (Master Plan §10)
// ==========================================
export type DecisionRecord = {
  id: string;
  projectCode: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  scope?: "common" | "internal" | "client";
  stage?: string | undefined;
  departmentCode?: string;
  authorId?: string;
  status?: "Draft" | "Pending lead review" | "Recorded" | "Approved" | "Rejected";
  approvedBy?: string;
  approvedAt?: string;
  category?: "Scope Amendment (Loop 1)" | "Technical Architecture" | "BOM & Sourcing" | "Design Deviation" | "Commercial Lock";
  title: string;
  rationale: string;
  impactedDocuments: string[];
  actionItems: string;
  hash?: string;
};

export const defaultDecisionLogs: DecisionRecord[] = [
  {
    id: "DEC-AI4T-2026-001",
    projectCode: "HLPL-AI4T-01",
    timestamp: "2026-10-15 14:30 IST",
    actor: "Priya Sharma",
    actorRole: "VP Sales & Business Dev",
    category: "Commercial Lock",
    title: "Volume pricing locked at ₹4,067/unit for 50,000 units/year tier",
    rationale: "Approved with client Tata Motors EV Fleet based on confirmed annual volume commitment and amortized NRE tooling.",
    impactedDocuments: ["HLPL-AI4T-SAL-QUO-01", "HLPL/F/MKT/01"],
    actionItems: "Freeze SAL-QUO-01 Rev 01; issue advance billing schedule for prototype tooling PO.",
    hash: "SHA256:7f9a2b8c4d1e",
  },
  {
    id: "DEC-AI4T-2026-002",
    projectCode: "HLPL-AI4T-01",
    timestamp: "2026-10-15 15:45 IST",
    actor: "Avery Vale",
    actorRole: "Lead Hardware Architect",
    category: "Technical Architecture",
    title: "Dual-footprint MCU authorization (STM32F405VG primary / GD32F405 drop-in)",
    rationale: "Mitigates single-source automotive lead time risks. Pin-compatible LQFP-100 footprint verified by EHW layout team.",
    impactedDocuments: ["HLPL-AI4T-EHW-PRS-01", "HLPL-AI4T-EHW-SCH-01", "HLPL-AI4T-EHW-BOM-01"],
    actionItems: "Update preliminary BOM Rev 01 with second-source qualification notes.",
    hash: "SHA256:9c1d3e5f7a2b",
  },
  {
    id: "DEC-AI4T-2026-003",
    projectCode: "HLPL-AI4T-01",
    timestamp: "2026-10-15 16:10 IST",
    actor: "Jordan Blake",
    actorRole: "Quality Assurance Lead",
    category: "Design Deviation",
    title: "Authorize 10-zone reflow temperature ceiling waiver for SMT Line 2 Lot BATCH-04",
    rationale: "Pre-compliance thermal profiling confirms Peak Temp within 242°C-245°C tolerance without delamination risk.",
    impactedDocuments: ["HLPL-AI4T-EMF-CP-01", "HLPL-AI4T-QA-DVP-01"],
    actionItems: "Record thermal thermocouple log in SMT Line 2 maintenance register.",
    hash: "SHA256:3a4b5c6d7e8f",
  },
];

export { OfficialDecisionLogModal } from "./DecisionDeviationLog";

// ==========================================
// 3. Operations Legal Documents & Official Letterhead Hub (Master Plan §9)
// ==========================================
export type LegalDocument = {
  id: string;
  reference: string;
  title: string;
  category: "Mutual NDA" | "Master Service Agreement" | "IP Escrow" | "Letterhead";
  party: string;
  effectiveDate: string;
  status: "Approved & Executed" | "Draft In Review";
  scope: string;
  driveFolder: string;
};

export const defaultLegalDocuments: LegalDocument[] = [
  {
    id: "LEG-001",
    reference: "HLPL-AI4T-OPS-mNDA-01",
    title: "Bilateral Mutual Non-Disclosure Agreement (Tata Motors EV)",
    category: "Mutual NDA",
    party: "Tata Motors Limited · EV Fleet Division, Pune",
    effectiveDate: "2026-10-15",
    status: "Approved & Executed",
    scope: "Confidentiality, IP protection, telematics specifications, and reverse-engineering restrictions under ISO 27001.",
    driveFolder: "/01_Governance_and_QMS/Legal",
  },
  {
    id: "LEG-002",
    reference: "HLPL-SLCT-OPS-mNDA-01",
    title: "Bilateral Mutual Non-Disclosure Agreement (Select Motors)",
    category: "Mutual NDA",
    party: "Select Motors Limited · Telematics Division",
    effectiveDate: "2026-09-01",
    status: "Approved & Executed",
    scope: "Bilateral exchange of vehicle CAN protocols, OBD-II telemetry parameters, and proprietary gateway firmware.",
    driveFolder: "/01_Governance_and_QMS/Legal",
  },
  {
    id: "LEG-003",
    reference: "HLPL-CORP-MSA-01",
    title: "Master Automotive Engineering Services & Supply Agreement",
    category: "Master Service Agreement",
    party: "XYZ Pvt Ltd Standard Corporate Terms",
    effectiveDate: "2026-01-01",
    status: "Approved & Executed",
    scope: "Standard enterprise terms for automotive hardware engineering, APQP milestone signoffs, warranties, and liability.",
    driveFolder: "/01_Governance_and_QMS/Legal",
  },
  {
    id: "LEG-004",
    reference: "HLPL-IP-ESC-01",
    title: "Firmware Source Code Escrow & Intellectual Property Protocol",
    category: "IP Escrow",
    party: "Escrow Associates India & XYZ Pvt Ltd",
    effectiveDate: "2026-03-15",
    status: "Approved & Executed",
    scope: "Tripartite source code escrow protection for AIS-140 telematics cryptographic firmware and bootloader binaries.",
    driveFolder: "/01_Governance_and_QMS/Legal",
  },
];

export function OperationsLegalAndLetterheadModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"agreements" | "letterhead">("letterhead");

  // Letterhead customizer state
  const [recipientName, setRecipientName] = useState("Mr. Rajesh Sharma · Lead D&D EV");
  const [recipientOrg, setRecipientOrg] = useState("Tata Motors Limited (EV Fleet Division, Pune)");
  const [letterSubject, setLetterSubject] = useState("Official Release Notice: AIS-140 Telematics Gateway Phase 1 Closure");
  const [letterRef, setLetterRef] = useState("HLPL/OPS/2026/LTR-084");
  const [letterBody, setLetterBody] = useState(
    `Dear Mr. Sharma,\n\nWe are pleased to formally issue this notice confirming the successful closure of Stage 1 (SOR Intake & Bilateral NDA) and Stage 2 (Multi-Department Feasibility Review HLPL/F/MKT/01) for Project HLPL-AI4T-01 (Tata Ace EV 4G AIS-140 Telematics Gateway).\n\nBoth the Product Requirement Specification (HLPL-AI4T-EHW-PRS-01 Rev 01) and Commercial Quotation (HLPL-AI4T-SAL-QUO-01 Rev 01) have been locked and authorized by all functional HODs (EHW, ESW, MECH, PUR, QA, FIN).\n\nThe engineering squad under Avery Vale has been deployed for the Stage 4 hardware bring-up and firmware CAN J1939 parser verification.\n\nPlease accept this communication as our controlled executive release.`
  );

  const handlePrintLetterhead = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Shield className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">Operations Legal Documents & Official Letterhead Hub</h2>
                <span className="rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                  Master Plan §9
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Authoritative Legal Agreements, Bilateral NDAs, and Official Company Letterheads
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border bg-secondary p-0.5 text-xs">
              <button
                onClick={() => setActiveTab("letterhead")}
                className={`rounded-md px-3 py-1 font-semibold transition ${
                  activeTab === "letterhead" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Corporate Letterhead
              </button>
              <button
                onClick={() => setActiveTab("agreements")}
                className={`rounded-md px-3 py-1 font-semibold transition ${
                  activeTab === "agreements" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Legal Agreements & NDAs
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Legal Hub"
              className="rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab 1: Corporate Letterhead */}
        {activeTab === "letterhead" ? (
          <div className="grid flex-1 gap-6 overflow-y-auto p-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
            {/* Editor controls */}
            <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4 text-xs">
              <p className="font-bold text-foreground">Letterhead Controls</p>

              <div>
                <label className="font-semibold text-muted-foreground">Letter Reference ID</label>
                <input
                  type="text"
                  value={letterRef}
                  onChange={(e) => setLetterRef(e.target.value)}
                  className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2.5 font-mono text-xs focus:ring-1 focus:ring-primary focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-muted-foreground">Recipient Name & Title</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-muted-foreground">Recipient Organization</label>
                <input
                  type="text"
                  value={recipientOrg}
                  onChange={(e) => setRecipientOrg(e.target.value)}
                  className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-muted-foreground">Subject Line</label>
                <input
                  type="text"
                  value={letterSubject}
                  onChange={(e) => setLetterSubject(e.target.value)}
                  className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-muted-foreground">Letter Body Content</label>
                <textarea
                  rows={8}
                  value={letterBody}
                  onChange={(e) => setLetterBody(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background p-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-hidden"
                />
              </div>

              <button
                type="button"
                onClick={handlePrintLetterhead}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:opacity-90"
              >
                <Printer className="size-3.5" />
                Print / Save Official PDF
              </button>
            </div>

            {/* A4 Printable Letterhead Sheet */}
            <div className="rounded-xl border border-border bg-white p-8 text-slate-900 shadow-lg font-sans">
              {/* Letterhead Header */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-slate-900 font-bold text-white text-lg">
                    SS
                  </div>
                  <div>
                    <h1 className="text-base font-bold tracking-tight text-slate-900">
                      XYZ Pvt Ltd
                    </h1>
                    <p className="font-mono text-[10px] font-semibold text-slate-600">
                    Northstar Mobility Systems · FICTIONAL TEST PROFILE
                    </p>
                    <p className="mt-1 text-[9px] text-slate-500">
                      Registration and tax identifiers are not configured in TEST
                    </p>
                  </div>
                </div>

                <div className="text-right text-[10px] text-slate-600 leading-4">
                  <p className="font-semibold">Noida Tech Center:</p>
                  <p>Building 4, Sector 63, Noida, UP - 201301</p>
                  <p className="font-semibold mt-1">SMT Manufacturing Plant:</p>
                  <p>Ecotech II, Greater Noida, UP - 201306</p>
                  <p className="font-mono mt-1 text-[9px] text-slate-500">
                    Standards targets illustrative only · certification unverified
                  </p>
                </div>
              </div>

              {/* Letter Metadata */}
              <div className="mt-6 flex justify-between text-xs text-slate-700">
                <div>
                  <p>
                    <strong>Ref No:</strong> <span className="font-mono">{letterRef}</span>
                  </p>
                  <p className="mt-1">
                    <strong>Date:</strong> {new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}
                  </p>
                </div>
                <div className="text-right">
                  <span className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-800">
                    OFFICIAL CORRESPONDENCE
                  </span>
                </div>
              </div>

              {/* Recipient */}
              <div className="mt-6 text-xs text-slate-800 leading-5">
                <p>To,</p>
                <p className="font-bold">{recipientName}</p>
                <p>{recipientOrg}</p>
              </div>

              {/* Subject */}
              <div className="mt-5 border-y border-slate-200 py-2 text-xs font-bold text-slate-900">
                SUB: {letterSubject}
              </div>

              {/* Letter Body */}
              <div className="mt-5 whitespace-pre-line text-xs leading-6 text-slate-800">
                {letterBody}
              </div>

              {/* Signatory Block */}
              <div className="mt-10 flex justify-between items-end border-t border-slate-200 pt-6 text-xs text-slate-800">
                <div>
                  <p className="font-bold">Authorized Signatory</p>
                  <p className="mt-6 font-semibold">XYZ Pvt Ltd</p>
                  <p className="text-[10px] text-slate-500">Executive Operations & Legal Division</p>
                </div>

                <div className="text-right">
                  <div className="inline-block rounded border border-emerald-600/30 bg-emerald-50 px-3 py-1.5 text-center">
                    <p className="font-mono text-[9px] font-bold uppercase text-emerald-800">
                      Digitally Verified
                    </p>
                    <p className="font-mono text-[8px] text-emerald-700">
                      HLPL-PKI-SIG-2026-9041
                    </p>
                  </div>
                </div>
              </div>

              {/* Letterhead Footer */}
              <div className="mt-12 border-t border-slate-300 pt-3 text-center text-[9px] text-slate-500">
                This document is issued on official XYZ Pvt Ltd letterhead under ISO 9001:2015 and IATF 16949:2016 record controls.
                Confidential · For intended recipient only.
              </div>
            </div>
          </div>
        ) : (
          /* Tab 2: Legal Agreements & NDAs */
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {defaultLegalDocuments.map((doc) => (
              <div
                key={doc.id}
                className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs transition hover:border-primary/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Shield className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-foreground">{doc.reference}</span>
                        <span className="rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                          {doc.category}
                        </span>
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {doc.status}
                        </span>
                      </div>
                      <h3 className="mt-1 text-sm font-bold text-foreground">{doc.title}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">Party: {doc.party}</p>
                    </div>
                  </div>

                  <div className="text-right text-xs">
                    <span className="text-muted-foreground">Effective Date:</span>{" "}
                    <strong className="text-foreground">{doc.effectiveDate}</strong>
                    <p className="font-mono text-[10px] text-steel">{doc.driveFolder}</p>
                  </div>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-foreground border-t border-border/40 pt-3">
                  <strong>Scope & Protection Clause: </strong>
                  {doc.scope}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    Restricted access · Legal and authorized account leads only (Master Plan §9)
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => alert(`Opening controlled file ${doc.reference}...`)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted"
                    >
                      <FileText className="size-3.5" />
                      View Agreement
                    </button>
                    <button
                      type="button"
                      onClick={() => alert(`Downloading verified copy of ${doc.reference}...`)}
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90"
                    >
                      <Download className="size-3.5" />
                      Download Signed Copy
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
