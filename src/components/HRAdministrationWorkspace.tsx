import React, { useState } from "react";
import {
  Users,
  FileText,
  ShieldCheck,
  GraduationCap,
  ClipboardList,
  Plus,
  Search,
  CheckCircle,
  Clock,
  Lock,
  Eye,
  AlertCircle,
  Calendar,
  Send,
  Building,
} from "lucide-react";
import {
  EmployeeLetter,
  AssignedPolicy,
  AssignedTraining,
  AssignedFormSurvey,
  DEFAULT_EMPLOYEE_LETTERS,
  DEFAULT_ASSIGNED_POLICIES,
  DEFAULT_ASSIGNED_TRAININGS,
  DEFAULT_ASSIGNED_FORMS,
} from "../lib/employee-services";

export type HREmployeeRecord = {
  id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  status: "Active" | "Probation" | "On Leave" | "Exited";
  joinedDate: string;
};

export const INITIAL_HR_EMPLOYEES: HREmployeeRecord[] = [
  { id: "HLPL-EMP-101", name: "Executive Admin", email: "admin@hexenselabs.com", department: "ADMIN", designation: "Managing Director", status: "Active", joinedDate: "2024-01-15" },
  { id: "HLPL-EMP-102", name: "Priya Sharma", email: "priya.sharma@hexenselabs.com", department: "SAL", designation: "Sales & BD Lead", status: "Active", joinedDate: "2024-03-01" },
  { id: "HLPL-EMP-103", name: "Avery Vale", email: "avery.vale@hexenselabs.com", department: "EHW", designation: "Hardware Lead", status: "Active", joinedDate: "2024-02-10" },
  { id: "HLPL-EMP-104", name: "Devon Lane", email: "devon.lane@hexenselabs.com", department: "ESW", designation: "Firmware Lead", status: "Active", joinedDate: "2024-02-15" },
  { id: "HLPL-EMP-105", name: "Samira Holt", email: "samira.holt@hexenselabs.com", department: "MECH", designation: "Mechanical Lead", status: "Active", joinedDate: "2024-04-01" },
  { id: "HLPL-EMP-106", name: "Morgan Reed", email: "morgan.reed@hexenselabs.com", department: "PUR", designation: "Procurement Lead", status: "Active", joinedDate: "2024-01-20" },
  { id: "HLPL-EMP-107", name: "Jordan Blake", email: "jordan.blake@hexenselabs.com", department: "QA", designation: "Quality Assurance Lead", status: "Active", joinedDate: "2024-03-15" },
  { id: "HLPL-EMP-108", name: "Casey Rowan", email: "casey.rowan@hexenselabs.com", department: "EMF", designation: "Manufacturing Lead", status: "Active", joinedDate: "2024-05-01" },
  { id: "HLPL-EMP-109", name: "Mina Cross", email: "mina.cross@hexenselabs.com", department: "TST", designation: "EOL Testing Lead", status: "Active", joinedDate: "2024-06-15" },
  { id: "HLPL-EMP-110", name: "Priya Voss", email: "priya.voss@hexenselabs.com", department: "FIN", designation: "Finance Lead", status: "Active", joinedDate: "2024-02-01" },
  { id: "HLPL-EMP-111", name: "Kai Morgan", email: "kai.morgan@hexenselabs.com", department: "SIT", designation: "Service & IT Lead", status: "Active", joinedDate: "2024-03-10" },
  { id: "HLPL-EMP-112", name: "Taylor Quinn", email: "taylor.quinn@hexenselabs.com", department: "HROPS", designation: "HR & Operations Lead", status: "Active", joinedDate: "2024-01-10" },
  { id: "HLPL-EMP-201", name: "EHW Test Engineer", email: "ehw.test@hexenselabs.com", department: "EHW", designation: "Hardware Test Engineer", status: "Active", joinedDate: "2025-02-01" },
];

export type HRAdministrationWorkspaceProps = {
  sharedSection?: ((section: "directory" | "policies" | "trainings" | "surveys")=>React.ReactNode) | undefined;
  sharedCounts?: {employees:number;policies:number;trainings:number;forms:number} | undefined;
  currentUser: {
    role: string;
    name: string;
    department?: string | undefined;
  };
  policies: AssignedPolicy[];
  trainings: AssignedTraining[];
  forms: AssignedFormSurvey[];
  onUpdatePolicies: (policies: AssignedPolicy[]) => void;
  onUpdateTrainings: (trainings: AssignedTraining[]) => void;
  onUpdateForms: (forms: AssignedFormSurvey[]) => void;
  onBack?: () => void;
};

export const HRAdministrationWorkspace: React.FC<HRAdministrationWorkspaceProps> = ({
  sharedSection,
  sharedCounts,
  currentUser,
  policies,
  trainings,
  forms,
  onUpdatePolicies,
  onUpdateTrainings,
  onUpdateForms,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<
    "directory" | "policies" | "trainings" | "surveys"
  >("directory");

  const [employees, setEmployees] = useState<HREmployeeRecord[]>(sharedSection ? [] : INITIAL_HR_EMPLOYEES);
  const [searchQuery, setSearchQuery] = useState("");

  // Policy creation modal
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [newPolicyTitle, setNewPolicyTitle] = useState("");
  const [newPolicyCode, setNewPolicyCode] = useState("");
  const [newPolicyDept, setNewPolicyDept] = useState("ALL");

  // Training creation modal
  const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);
  const [newTrainingTitle, setNewTrainingTitle] = useState("");
  const [newTrainingModule, setNewTrainingModule] = useState("");
  const [newTrainingDuration, setNewTrainingDuration] = useState("45 mins");

  // Survey creation modal
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
  const [newSurveyTitle, setNewSurveyTitle] = useState("");
  const [newSurveyDesc, setNewSurveyDesc] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  const filteredEmployees = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.designation.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreatePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPolicyTitle.trim()) return;

    const newPolicy: AssignedPolicy = {
      id: `pol-${Date.now()}`,
      policyCode: newPolicyCode.trim() || `HLPL-POL-${Date.now().toString().slice(-4)}`,
      title: newPolicyTitle.trim(),
      category: "Code of Conduct",
      revision: "Rev 1.0",
      effectiveDate: new Date().toISOString().split("T")[0]!,
      status: "Pending",
      deadline: "2026-12-31",
      documentRef: `HLPL-POL-${Date.now().toString().slice(-4)}`,
      summary: `Organizational policy for ${newPolicyDept}.`,
    };

    onUpdatePolicies([newPolicy, ...policies]);
    setIsPolicyModalOpen(false);
    setNewPolicyTitle("");
    setNewPolicyCode("");
  };

  const handleCreateTraining = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrainingTitle.trim()) return;

    const newTraining: AssignedTraining = {
      id: `trn-${Date.now()}`,
      courseCode: newTrainingModule.trim() || `TRN-${Date.now().toString().slice(-4)}`,
      title: newTrainingTitle.trim(),
      category: "Automotive Standards",
      trainer: "Internal HR / Safety Officer",
      durationHours: parseInt(newTrainingDuration, 10) || 2,
      status: "Assigned",
      quizQuestions: [],
    };

    onUpdateTrainings([newTraining, ...trainings]);
    setIsTrainingModalOpen(false);
    setNewTrainingTitle("");
    setNewTrainingModule("");
  };

  const handleCreateSurvey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSurveyTitle.trim()) return;

    const newSurvey: AssignedFormSurvey = {
      id: `frm-${Date.now()}`,
      formCode: `HLPL-F-HR-${Date.now().toString().slice(-3)}`,
      title: newSurveyTitle.trim(),
      type: isAnonymous ? "Pulse_Survey" : "Operational_Form",
      isAnonymous: isAnonymous,
      status: "Pending",
      dueDate: "2026-11-30",
      questions: [
        { id: "q1", label: newSurveyDesc.trim() || "Feedback Question", type: "rating", required: true }
      ],
    };

    onUpdateForms([newSurvey, ...forms]);
    setIsSurveyModalOpen(false);
    setNewSurveyTitle("");
    setNewSurveyDesc("");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                HR
              </h1>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                People & activities
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Manage organization directory, versioned policies, training programs, and feedback surveys.
            </p>
          </div>
        </div>

        {onBack && (
          <button
            onClick={onBack}
            className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted self-start sm:self-auto"
          >
            Back to Queue
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border/60 pb-1 text-xs">
        <button
          onClick={() => setActiveTab("directory")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
            activeTab === "directory"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Employee Directory ({sharedCounts?.employees ?? employees.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("policies")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
            activeTab === "policies"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Policies & Compliance ({sharedCounts?.policies ?? policies.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("trainings")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
            activeTab === "trainings"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span>Training Matrix ({sharedCounts?.trainings ?? trainings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("surveys")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
            activeTab === "surveys"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>Forms & Surveys ({sharedCounts?.forms ?? forms.length})</span>
        </button>
      </div>

      {/* TAB 1: DIRECTORY */}
      {sharedSection ? sharedSection(activeTab) : <>
      {activeTab === "directory" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by employee name, department, or role..."
                className="w-full pl-8 pr-3 py-1.5 rounded-md bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <span className="text-[11px] text-muted-foreground">
              Showing {filteredEmployees.length} active records
            </span>
          </div>

          <div className="border border-border rounded-lg overflow-hidden bg-card shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border/60 text-[11px] font-semibold text-muted-foreground">
                  <th className="p-2.5">Emp ID</th>
                  <th className="p-2.5">Name</th>
                  <th className="p-2.5">Department</th>
                  <th className="p-2.5">Designation</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-muted/40 transition-colors">
                    <td className="p-2.5 font-mono text-primary font-semibold">
                      {emp.id}
                    </td>
                    <td className="p-2.5 font-medium text-foreground">
                      {emp.name}
                    </td>
                    <td className="p-2.5">
                      <span className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">
                        {emp.department}
                      </span>
                    </td>
                    <td className="p-2.5 text-muted-foreground">{emp.designation}</td>
                    <td className="p-2.5">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                        {emp.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-muted-foreground text-[11px]">
                      {emp.joinedDate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: POLICIES */}
      {activeTab === "policies" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Version-controlled compliance policies and mandatory staff acknowledgment tracking.
            </p>
            <button
              onClick={() => setIsPolicyModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Publish Policy</span>
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {policies.map((policy) => (
              <div
                key={policy.id}
                className="p-3.5 rounded-lg border border-border bg-card shadow-xs space-y-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono font-bold text-primary text-[11px]">
                    {policy.policyCode}
                  </span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border font-semibold">
                    {policy.revision}
                  </span>
                </div>
                <h4 className="font-semibold text-foreground">{policy.title}</h4>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                  <span>Category: {policy.category}</span>
                  <span>Effective: {policy.effectiveDate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: TRAININGS */}
      {activeTab === "trainings" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Automotive skill matrix, training module assignments, and competency refreshes.
            </p>
            <button
              onClick={() => setIsTrainingModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Training</span>
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trainings.map((trn) => (
              <div
                key={trn.id}
                className="p-3.5 rounded-lg border border-border bg-card shadow-xs space-y-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono font-bold text-primary text-[11px]">
                    {trn.courseCode}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-semibold border border-blue-500/20">
                    {trn.category}
                  </span>
                </div>
                <h4 className="font-semibold text-foreground">{trn.title}</h4>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                  <span>Duration: {trn.durationHours} hrs</span>
                  <span className="font-mono font-semibold text-foreground">
                    Status: {trn.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: SURVEYS & FORMS */}
      {activeTab === "surveys" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Internal feedback, safety questionnaires, and anonymous climate surveys.
            </p>
            <button
              onClick={() => setIsSurveyModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Survey / Form</span>
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {forms.map((form) => (
              <div
                key={form.id}
                className="p-3.5 rounded-lg border border-border bg-card shadow-xs space-y-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono font-bold text-primary text-[11px]">
                    {form.formCode}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${
                      form.isAnonymous
                        ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {form.isAnonymous ? "Anonymous Feedback" : form.type}
                  </span>
                </div>
                <h4 className="font-semibold text-foreground">{form.title}</h4>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                  <span>Type: {form.type}</span>
                  <span>{form.questions?.length ?? 1} Questions</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: PUBLISH POLICY */}
      </>}
      {isPolicyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full p-5 space-y-3 text-xs">
            <h3 className="font-bold text-sm text-foreground">
              Publish New Organizational Policy
            </h3>
            <form onSubmit={handleCreatePolicy} className="space-y-3">
              <div>
                <label className="block text-muted-foreground mb-1">Policy Title *</label>
                <input
                  type="text"
                  required
                  value={newPolicyTitle}
                  onChange={(e) => setNewPolicyTitle(e.target.value)}
                  placeholder="e.g. Clean Desk & Hardware Security Policy"
                  className="w-full p-2 rounded bg-background border border-border"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Policy Code</label>
                <input
                  type="text"
                  value={newPolicyCode}
                  onChange={(e) => setNewPolicyCode(e.target.value)}
                  placeholder="e.g. HLPL-POL-SEC-03"
                  className="w-full p-2 rounded bg-background border border-border"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Audience Scope</label>
                <select
                  value={newPolicyDept}
                  onChange={(e) => setNewPolicyDept(e.target.value)}
                  className="w-full p-2 rounded bg-background border border-border"
                >
                  <option value="ALL">All Departments</option>
                  <option value="EHW">Hardware (EHW)</option>
                  <option value="EMF">Manufacturing (EMF)</option>
                  <option value="QA">Quality Assurance (QA)</option>
                  <option value="SIT">Service & IT (SIT)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setIsPolicyModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium hover:bg-primary/90"
                >
                  Publish Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE TRAINING */}
      {isTrainingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full p-5 space-y-3 text-xs">
            <h3 className="font-bold text-sm text-foreground">
              Create New Training Module
            </h3>
            <form onSubmit={handleCreateTraining} className="space-y-3">
              <div>
                <label className="block text-muted-foreground mb-1">Module Title *</label>
                <input
                  type="text"
                  required
                  value={newTrainingTitle}
                  onChange={(e) => setNewTrainingTitle(e.target.value)}
                  placeholder="e.g. High-Voltage BMS Safety & Isolation"
                  className="w-full p-2 rounded bg-background border border-border"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Module Code</label>
                <input
                  type="text"
                  value={newTrainingModule}
                  onChange={(e) => setNewTrainingModule(e.target.value)}
                  placeholder="e.g. TRN-BMS-01"
                  className="w-full p-2 rounded bg-background border border-border"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Expected Duration</label>
                <input
                  type="text"
                  value={newTrainingDuration}
                  onChange={(e) => setNewTrainingDuration(e.target.value)}
                  placeholder="e.g. 60 mins"
                  className="w-full p-2 rounded bg-background border border-border"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setIsTrainingModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium hover:bg-primary/90"
                >
                  Assign Module
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE SURVEY */}
      {isSurveyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full p-5 space-y-3 text-xs">
            <h3 className="font-bold text-sm text-foreground">
              Create Survey / Feedback Questionnaire
            </h3>
            <form onSubmit={handleCreateSurvey} className="space-y-3">
              <div>
                <label className="block text-muted-foreground mb-1">Survey Title *</label>
                <input
                  type="text"
                  required
                  value={newSurveyTitle}
                  onChange={(e) => setNewSurveyTitle(e.target.value)}
                  placeholder="e.g. Q4 Tooling & ECAD Workstation Feedback"
                  className="w-full p-2 rounded bg-background border border-border"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newSurveyDesc}
                  onChange={(e) => setNewSurveyDesc(e.target.value)}
                  placeholder="Describe the purpose of this survey..."
                  className="w-full p-2 rounded bg-background border border-border"
                />
              </div>
              <div className="p-2.5 rounded bg-muted/40 border border-border space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={false} disabled title="Anonymous surveys are available in the authenticated shared HR workflow"
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="rounded border-border text-primary"
                  />
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-500" />
                    Strict Anonymous Survey
                  </span>
                </label>
                <p className="text-[10px] text-muted-foreground pl-5">
                  Anonymous response separation is available only in the shared HR workflow. Local examples use identified submissions.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setIsSurveyModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium hover:bg-primary/90"
                >
                  Launch Survey
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
