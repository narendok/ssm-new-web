import { ProjectMasterSpecSheet } from './ProjectMasterSpecSheet';
import { readLifecycleBaseline, projectLifecycleStages, recordedStageOmissions } from '@/lib/lifecycle-baseline';
import { ProjectLifecycleConfiguration } from './ProjectLifecycleConfiguration';
import { getProjectInputs, type InputSnapshot } from '@/lib/project-inputs.functions';
import { SharedMasterSelect } from "@/components/SharedMasterSelect";
import { SalesEnquiriesAndOpportunities, defaultCustomers, defaultEnquiriesOpportunities } from "./SalesWorkspaceAndCustomerRegister";
import { Sparkles } from "lucide-react";
import { matchesWorkspaceDocument } from "@/lib/sidebar-selection";
import { getSharedTestWorkspace } from "@/lib/shared-test.functions";
import type { TestMembership } from "@/lib/test-auth.functions";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import React, { useState, useEffect } from "react";
import { DepartmentLeadCoordinationCenter, TaskChecklistView, type TaskRecord, type TeamMember } from "./DepartmentLeadCoordinationCenter";
import { ApprovalsFullPageView, type ApprovalRecord } from "./ApprovalsFullPageView";
import type { Persona } from "./RoleAwareSidebar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { recordsForProject, documentsForProject } from "@/lib/project-workspace";
import { recordStageLabel } from "@/lib/lifecycle-record-presentation";
import { businessDate } from "@/lib/business-date";
import { sortTaskRecords, taskLane } from "@/lib/task-board";
import {
  getRecordedProjectTrack,
  getApplicableStagesForTrack,
  CANONICAL_STAGE_TEMPLATES,
  recordedCompletedStageCodes,
  computeProgressiveStageAndTaskState,
} from "@/lib/canonical-lifecycle";
import {
  Plus,
  FileText,
  CheckCircle2,
  Clock,
  Users,
  ShieldCheck,
  ArrowRight,
  FileSpreadsheet,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  Search,
} from "lucide-react";

type WorkspaceDocument = {
  id: string;
  title: string;
  type: string;
  lifecycle?: string | undefined;
  revision?: string | undefined;
  linkedRecordRefs?: string[] | undefined;
};

type Props = {
  salesPipeline?: React.ComponentProps<typeof SalesEnquiriesAndOpportunities> | undefined;
  salesPipelineView?: React.ReactNode;
  departmentCode: string;
  departmentName: string;
  lead: string;
  records: TaskRecord[];
  projects: TaskRecord[];
  documents: WorkspaceDocument[];
  sharedTestMembership?: TestMembership | undefined;
  approvals: ApprovalRecord[];
  approvalPersona?: Persona | undefined;
  approvalCurrentUser?: string | undefined;
  approvalUserRole?: string | undefined;
  onApproveApproval?: (id: string, notes?: string) => boolean | void | Promise<boolean | void>;
  onRejectApproval?: (id: string, reason: string) => boolean | void | Promise<boolean | void>;
  onReturnApproval?: (id: string, reworkNotes: string) => boolean | void | Promise<boolean | void>;
  team: TeamMember[];
  projectScope: string;
  recordTypeFilter?: string | null | undefined;
  onClearRecordTypeFilter?: (()=>void) | undefined;
  initialTab?: "dashboard" | "overview" | "tasks" | "deliverables" | "approvals" | "records" | "team" | "sales-pipeline" | undefined;
  dashboardAudience?: "lead" | "member" | "admin" | undefined;
  dashboardAssignee?: string | undefined;
  dashboardMemberId?: string | undefined;
  onProjectChange: (value: string) => void;
  onCreateRecord: () => void;
  onSmartUploadRecord?: (() => void) | undefined;
  canCreateRecord?: boolean | undefined;
  canCreateTask?: boolean | undefined;
  onOpenAssetCatalog?: (()=>void) | undefined;
  onOpenInputs?: ((sourceId?:string) => void) | undefined;
  onCreateDeliverable?: (() => void) | undefined;
  onCreateProject?: (() => void) | undefined;
  onOpenRecord: (id: string) => void;
  onOpenTask?: ((task: TaskRecord) => void) | undefined;
  onOpenTasks?: (() => void) | undefined;
  onOpenApprovals?: (()=>void) | undefined;
  onToggleTaskTimer?: ((taskId: string, action: "start" | "stop") => void) | undefined;
  onOpenRecords?: (()=>void) | undefined;
  onOpenDocument: (id: string) => void;
  onUpdateTask: (id: string, patch: Partial<TaskRecord>, action: string) => boolean | void | Promise<boolean | void>;
  onCreateTask: (task: {
    title: string;
    priority: TaskRecord["priority"];
    assignee: string;
    projectId: string;
    stageCode?: string;
    dueDate: string;
    notes: string;
  }) => boolean | void | Promise<boolean | void>;
  onRequestStageReview?: ((projectId: string, stageCode: string, notes?: string) => Promise<boolean | void>) | undefined;
  onAdvanceStage?: ((projectId: string, targetStage: string, notes?: string) => Promise<boolean | void>) | undefined;
};

export function DepartmentProjectWorkspace(props: Props) {
  const { departmentCode, departmentName, lead, projects, projectScope } = props;
  const loadSharedWorkspace = useServerFn(getSharedTestWorkspace);
  const loadInputSheets=useServerFn(getProjectInputs);
  const inputSheets=useQuery({queryKey:['project-inputs',props.sharedTestMembership?.organizationId,props.sharedTestMembership?.membershipId],queryFn:()=>loadInputSheets(),enabled:Boolean(props.sharedTestMembership)});
  const sharedWorkspace = useQuery({
    queryKey: ["shared-test-workspace", props.sharedTestMembership?.organizationId, props.sharedTestMembership?.membershipId],
    queryFn: () => loadSharedWorkspace(),
    enabled: Boolean(props.sharedTestMembership),
    refetchInterval: 15000,
  });
  const sharedDocs: WorkspaceDocument[] = (sharedWorkspace.data?.documents || []).map((document) => ({
    id: document.id,
    title: document.title,
    type: document.document_type,
    lifecycle: "Registered",
    revision: "Not recorded",
    linkedRecordRefs: document.record_id ? [document.record_id] : [],
  }));
  const workspaceDocuments: WorkspaceDocument[] = [
    ...props.documents,
    ...sharedDocs.filter((sd) => !props.documents.some((d) => d.id === sd.id || d.title === sd.title)),
  ];
  const isSalesDept = departmentCode.toUpperCase() === "SAL";
  const initialWorkspaceTab = props.initialTab === "team"
    ? "overview"
    : props.initialTab === "deliverables"
      ? "records"
      : props.initialTab ?? "overview";
  const [activeTab, setActiveTab] = useState<"dashboard" | "overview" | "tasks" | "deliverables" | "approvals" | "records" | "sales-pipeline">(initialWorkspaceTab);

  useEffect(() => {
    if (props.initialTab) {
      setActiveTab(props.initialTab === "team" ? "overview" : props.initialTab === "deliverables" ? "records" : props.initialTab);
    }
  }, [props.initialTab]);
  const [recordSearch, setRecordSearch] = useState(props.recordTypeFilter ?? "");
  useEffect(() => {
    setRecordSearch(props.recordTypeFilter ?? "");
  }, [props.recordTypeFilter]);
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [quickViewApprovalId, setQuickViewApprovalId] = useState<string | null>(null);
  const [selectedTargetStage, setSelectedTargetStage] = useState("");
  const [advanceNotes, setAdvanceNotes] = useState("");
  const [advanceBusy, setAdvanceBusy] = useState(false);
  const [advanceError, setAdvanceError] = useState("");
  const [advanceNotice, setAdvanceNotice] = useState("");
  const [quickTaskOpen, setQuickTaskOpen] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [quickTaskProject, setQuickTaskProject] = useState("");
  const [quickTaskStageCode, setQuickTaskStageCode] = useState("");
  const [quickTaskAssignee, setQuickTaskAssignee] = useState("");
  const [quickTaskDueDate, setQuickTaskDueDate] = useState("");
  const [quickTaskSaving, setQuickTaskSaving] = useState(false);
  const [quickTaskError, setQuickTaskError] = useState("");

  const project = projects.find((item) => item.reference === projectScope || item.id === projectScope);
  const quickSelectedProject = projects.find((item) => item.id === quickTaskProject || item.reference === quickTaskProject);
  const quickSelectedTrack = quickSelectedProject ? getRecordedProjectTrack(quickSelectedProject.fields) : null;
  const quickStageOptions = quickSelectedTrack ? getApplicableStagesForTrack(quickSelectedTrack) : [];
  const quickCurrentStage = quickSelectedProject?.fields["currentStage"] || quickSelectedProject?.fields["lifecycleStage"] || quickSelectedProject?.fields["stage"] || "";
  const workspaceProjectSelection = project?.id || (projectScope === "all" ? "all" : projectScope);
  const openProjectInputs=()=>props.onOpenInputs?.(project?.fields['sourceOpportunityId'] || project?.id);
  let inputSnapshot:InputSnapshot|undefined=inputSheets.data;
  if(!props.sharedTestMembership && typeof window!=='undefined'){
    try{const saved=JSON.parse(localStorage.getItem('ssm:demo-project-input-sheets:v1')||'null') as InputSnapshot|null;if(saved&&Array.isArray(saved.sheets)&&Array.isArray(saved.events))inputSnapshot=saved;}catch{/* Absent local draft data stays absent. */}
  }
  const inputSheet=inputSnapshot?.sheets.filter(s=>[project?.id,project?.fields['sourceOpportunityId']].includes(s.project_record_id||'') || [project?.id,project?.fields['sourceOpportunityId']].includes(s.source_record_id)).sort((a,b)=>b.revision-a.revision)[0];
  const track = getRecordedProjectTrack(project?.fields);


  useEffect(() => {
    setSelectedTargetStage("");
    setAdvanceError("");
    setAdvanceNotice("");
  }, [project?.id, track]);

  const currentStageCode = String(
    project?.fields?.["currentStage"] ||
    project?.fields?.["lifecycleStage"] ||
    project?.fields?.["stage"] ||
    (project as { stage?: string } | undefined)?.stage ||
    "CM_01"
  );

  const completedStageCodes = React.useMemo(() => {
    if (!project) return [];
    const fromFields = (project.fields?.["completedStages"] || project.fields?.["completed_stages"] || []) as string[];
    return recordedCompletedStageCodes(fromFields);
  }, [project]);

  const eligibleStages = React.useMemo(() => {
    if (!project || !track || !(readLifecycleBaseline(project.fields['lifecycleBaseline'])?.stages.some(stage=>stage.code===currentStageCode) || CANONICAL_STAGE_TEMPLATES.some(stage => stage.stageCode === currentStageCode))) return [];
    const effectiveCompleted = completedStageCodes;
    const progressiveState = computeProgressiveStageAndTaskState({
      projectId: project.id,
      track,
      stageDefinitions: readLifecycleBaseline(project.fields['lifecycleBaseline']) ? projectLifecycleStages(readLifecycleBaseline(project.fields['lifecycleBaseline'])!, track,project.fields['certificationRequired']==='true') : undefined,
      enableCertification:project.fields['certificationRequired']==='true',
      omittedStageCodes:Object.keys(recordedStageOmissions(project.fields['omittedStages'])),
      completedStageCodes: effectiveCompleted,
      inProgressStageCodes: [currentStageCode].filter(Boolean),
    });
    return progressiveState.stages.filter(
      (stg) => stg.status === "ready" && (stg.stageCode!=='CL_01'||!readLifecycleBaseline(project.fields['lifecycleBaseline'])||['true','false'].includes(project.fields['certificationRequired']||''))
    );
  }, [project, track, completedStageCodes, currentStageCode]);
  const all = projectScope === "all" || activeTab === "dashboard";
  const records = all ? props.records : recordsForProject(props.records, project);
  const documents = (all ? workspaceDocuments : project ? documentsForProject(workspaceDocuments, records, project) : []).filter(document => matchesWorkspaceDocument(document, props.recordTypeFilter));
  const sourceIds = new Set(records.map((record) => record.id));
  const approvals = props.approvals.filter(
    (approval) =>
      all ||
      sourceIds.has(approval.recordId) ||
      Boolean(project && [project.id, project.reference].includes(approval.project ?? ""))
  );
  const work = records.filter((record) => record.type !== "Project" && record.status !== "Archived");
  const taskRecords = work.filter((record) => record.type === "Task");
  const dashboardTaskRecords = props.dashboardAudience === "member" && props.dashboardAssignee
    ? taskRecords.filter((task) => (task.fields["assignee"] || "").trim().toLowerCase() === props.dashboardAssignee!.trim().toLowerCase())
    : taskRecords;
  const today = businessDate();
  const todayTasks = sortTaskRecords(dashboardTaskRecords.filter((task) => {
    const lane = taskLane(task, today);
    return lane === "today" || (lane === "review" && (!task.fields["dueDate"] || task.fields["dueDate"]! <= today));
  }), today).slice(0, 5);
  const plannedTasks = sortTaskRecords(dashboardTaskRecords.filter((task) => {
    const lane = taskLane(task, today);
    return lane === "todo" || (lane === "review" && Boolean(task.fields["dueDate"]) && task.fields["dueDate"]! > today);
  }), today).slice(0, 5);
  const dashboardCompletedTasks = dashboardTaskRecords.filter((task) => taskLane(task, today) === "completed").length;
  const dashboardPendingApprovals = approvals.filter((approval) => approval.outcome === "Pending");
  const deptWorkRecords = work.filter((record) => record.type !== "Task");
  const completed = work.filter((record) => record.status === "Approved" || record.status === "Released").length;
  const progress = work.length ? Math.round((completed / work.length) * 100) : 0;
  const owners = new Set(taskRecords.map((record) => record.fields["assignee"]));
  const team = all ? props.team : props.team.filter((member) => owners.has(member.name));
  const shownProjects = all ? projects : project ? [project] : [];

  const normalizedRecordSearch = recordSearch.trim().toLowerCase();
  const documentsForRecord = (record: TaskRecord) =>
    documents.filter((document) =>
      document.linkedRecordRefs?.some((reference) => reference === record.id || reference === record.reference)
    );
  const recordMatchesSearch = (record: TaskRecord) => {
    if (!normalizedRecordSearch) return true;
    const linkedDocuments = documentsForRecord(record);
    return [record.title, record.reference, record.type, record.fields["lifecycleStage"], ...Object.values(record.fields)]
      .some((value) => String(value || "").toLowerCase().includes(normalizedRecordSearch)) ||
      linkedDocuments.some((document) => `${document.title} ${document.type}`.toLowerCase().includes(normalizedRecordSearch));
  };
  const filteredDeptRecords = deptWorkRecords.filter(recordMatchesSearch);
  const duplicateReferenceCounts = new Map<string, number>();
  for (const record of filteredDeptRecords) {
    const reference = record.reference.trim().toUpperCase();
    duplicateReferenceCounts.set(reference, (duplicateReferenceCounts.get(reference) ?? 0) + 1);
  }
  const standaloneDocuments = documents.filter((document) =>
    !deptWorkRecords.some((record) =>
      document.linkedRecordRefs?.some((reference) => reference === record.id || reference === record.reference)
    ) && (!normalizedRecordSearch || `${document.title} ${document.type} ${document.id}`.toLowerCase().includes(normalizedRecordSearch))
  );
  const registerRowCount = filteredDeptRecords.length + standaloneDocuments.length;

  return (
    <main className="space-y-4" aria-label={activeTab === "dashboard" ? "Department dashboard" : "Department project workspace"}>
      {/* 1. Compact Header: Left title/lead, Right compact project selector and action */}
      <header className="rounded-xl border border-border/80 bg-card px-3 py-2 shadow-xs">
        <div className="grid gap-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-primary">
              {departmentCode} · {activeTab === "dashboard" ? "DASHBOARD" : "WORKSPACE"}
            </span>
            <h1 title={`${departmentName} — ${activeTab === "dashboard" ? "Dashboard" : "Project Workspace"}`} className="min-w-0 flex-1 truncate text-sm font-bold leading-5 tracking-tight text-foreground">
              {departmentName} — {activeTab === "dashboard" ? "Dashboard" : "Project Workspace"}
            </h1>
            <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground sm:inline">
              Lead: <strong className="text-foreground">{lead}</strong>
            </span>
          </div>

          {activeTab !== "dashboard" && <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5">
            <div className="w-44 shrink-0"><SharedMasterSelect label="Workspace project" value={workspaceProjectSelection} onChange={props.onProjectChange} options={[{value:"all",label:"All projects"},...(!all && !project ? [{value:projectScope,label:`Selected project unavailable · ${projectScope}`}]:[]),...projects.map(item=>({value:item.id,label:`${item.reference} · ${item.title}`}))]}/></div>

            {props.onCreateProject && <button type="button" onClick={props.onCreateProject} className="shrink-0 whitespace-nowrap rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold">New Project</button>}
            <button
              type="button"
              onClick={openProjectInputs}
              disabled={!props.onOpenInputs}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary shadow-xs hover:bg-primary/20 transition-colors cursor-pointer whitespace-nowrap"
              title="Open project inputs and feasibility; the input coordinator can import requirements there"
            >
              <Sparkles className="size-3" />
              <span>Inputs & Feasibility</span>
            </button>
            <button
              type="button"
              onClick={props.onCreateRecord}
              disabled={props.canCreateRecord === false}
              title={props.canCreateRecord === false ? "This role does not have Create records permission in this department." : undefined}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="size-3" />
              <span>Add Record</span>
            </button>
            <button
              type="button"
              onClick={props.onSmartUploadRecord}
              disabled={props.canCreateRecord === false || !props.onSmartUploadRecord}
              title={props.canCreateRecord === false
                ? "This role does not have Create records permission in this department."
                : !props.onSmartUploadRecord
                  ? "Sign in to the shared workspace to use Smart Upload. The local TEST DATA sample view does not upload or synchronize record files."
                  : "Start a record from a source file and attach the original to that record."}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary shadow-xs hover:bg-primary/10 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
            >
              <FileText className="size-3" />
              <span>Smart Upload</span>
            </button>
            {props.onOpenAssetCatalog && <button type="button" onClick={props.onOpenAssetCatalog} className="shrink-0 whitespace-nowrap rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold">Reusable assets</button>}
          </div>}
        </div>

        {!all && !project && (
          <p role="status" className="mt-2 text-xs text-amber-500 font-medium">
            This project is not linked to your department. Choose an available project.
          </p>
        )}
      </header>

      {activeTab === "overview" && project && <ProjectMasterSpecSheet project={project} records={records} documents={documents} inputSheet={inputSheet} inputEvents={inputSnapshot?.events.filter(e=>e.sheet_id===inputSheet?.id)} onOpenStageRecords={code=>{setActiveTab("records");setRecordSearch(code);}} onOpenInputs={openProjectInputs} onOpenRecord={props.onOpenRecord} onOpenDocument={props.onOpenDocument} canViewCommercial={["FIN","PUR"].includes(departmentCode.toUpperCase())}/>}
      {activeTab === "overview" && project && props.sharedTestMembership && <ProjectLifecycleConfiguration key={project.id} projectId={project.id} scopeKey={props.sharedTestMembership.membershipId} isAdmin={props.sharedTestMembership.role==='admin'} canManageCertification={props.sharedTestMembership.role==='admin'||(props.sharedTestMembership.role==='department_lead'&&props.sharedTestMembership.departmentCode==='QA')}/>}
      {/* 2. Compact Project Overview Banner (if a specific project is selected) */}
      {activeTab === "overview" && project && (
        <section aria-label="Selected project overview" className="rounded-xl border border-border/80 bg-card p-3.5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-2.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {project.reference}
                </span>
                <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] font-semibold text-secondary-foreground">
                  {project.status}
                </span>
              </div>
              <h2 className="text-sm font-bold text-foreground mt-1">{project.title}</h2>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Department Deliverable:</span>
              <strong className="text-foreground font-mono text-[11px]">
                {project.fields["deliverable"] || "Not recorded"}
              </strong>
            </div>
          </div>

          <dl className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
            <div>
              <dt className="text-[10px] uppercase font-mono text-muted-foreground">Customer</dt>
              <dd className="mt-0.5 font-medium text-foreground">{project.fields["customer"] || "Not recorded"}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase font-mono text-muted-foreground">Lifecycle Stage</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 font-medium text-foreground">
                <span className="font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[11px]">
                  {project.fields["currentStage"] || project.fields["lifecycleStage"] || project.fields["stage"] || "Not recorded"}
                </span>
                {props.onAdvanceStage && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTargetStage("");
                      setAdvanceNotes("");
                      setAdvanceError("");
                      setAdvanceModalOpen(true);
                    }}
                    className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                  >
                    Advance
                  </button>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase font-mono text-muted-foreground">Target Date</dt>
              <dd className="mt-0.5 font-medium text-foreground">{project.fields["targetDate"] || "Not recorded"}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase font-mono text-muted-foreground">Volume Target</dt>
              <dd className="mt-0.5 font-medium text-foreground">{project.fields["quantity"] || "Not recorded"}</dd>
            </div>
          </dl>
        </section>
      )}

      {/* 3. Compact 4-Metric Workspace Summary */}
      {(activeTab === "overview" || activeTab === "dashboard") && <section aria-label={activeTab === "dashboard" ? "Department dashboard analytics" : "Workspace summary"} className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          ["Department progress", `${progress}%`, `${completed} of ${work.length} records complete`],
          ["Tasks", String(dashboardTaskRecords.length), `${dashboardTaskRecords.length - dashboardCompletedTasks} open · ${dashboardCompletedTasks} completed · manage in Tasks`],
          ["Project deliverables", String(documents.length), activeTab === "dashboard" ? "All department files" : "Selected project files only"],
          ...(props.dashboardAudience === "member" && activeTab === "dashboard" ? [] : [["Pending approvals", String(dashboardPendingApprovals.length), "Human decisions required"]]),
        ].map(([label, value, detail]) => (
          <div key={label} className="rounded-xl border border-border/80 bg-card p-3 shadow-xs">
            <p className="text-[11px] font-mono uppercase text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{detail}</p>
          </div>
        ))}
      </section>}

      {activeTab === "dashboard" && (
        <section aria-label="Department daily focus" className="rounded-xl border border-border bg-card p-3 shadow-xs">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wide">Today and planned · priority order</h2>
            <button type="button" onClick={() => props.onOpenTasks ? props.onOpenTasks() : setActiveTab("tasks")} className="text-[11px] font-semibold text-primary hover:underline">
              Open full task list
            </button>
          </div>
          <TaskChecklistView
            tasks={[...todayTasks, ...plannedTasks]}
            teamMembers={props.team}
            onUpdateAssignee={(taskId, assignee) => { void props.onUpdateTask(taskId, { fields: { assignee } }, "Task assigned"); }}
            onUpdateStatus={(taskId, status, notes) => { void props.onUpdateTask(taskId, { status, ...(notes ? { notes } : {}) }, "Task status updated"); }}
            onOpenTask={props.onOpenTask || ((task) => props.onOpenRecord(task.id))}
            departmentLead={lead}
            readOnly={false}
            hidePriority
            dashboardAudience={props.dashboardAudience}
            dashboardMemberId={props.dashboardMemberId}
            onToggleTaskTimer={props.onToggleTaskTimer}
            onSaveReviewDue={(taskId, dueDate) => props.onUpdateTask(taskId, { fields: { dueDate } }, "Task review date updated")}
            hideCompleted
          />
        </section>
      )}

      {activeTab === "dashboard" && props.dashboardAudience !== "member" && props.canCreateTask && (
        <section aria-label="Assign a department task" className="rounded-xl border border-border bg-card p-3 shadow-xs">
          {!quickTaskOpen ? (
            <button type="button" onClick={() => { const selectedProjectId = project?.id || (projects.length === 1 ? projects[0]!.id : ""); const selectedProject = projects.find((item) => item.id === selectedProjectId); setQuickTaskProject(selectedProjectId); setQuickTaskStageCode(selectedProject?.fields["currentStage"] || selectedProject?.fields["lifecycleStage"] || selectedProject?.fields["stage"] || ""); setQuickTaskAssignee(""); setQuickTaskDueDate(""); setQuickTaskError(""); setQuickTaskOpen(true); }} className="rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10">
              + Assign a task
            </button>
          ) : (
            <form className="grid gap-2 sm:grid-cols-[minmax(160px,1.3fr)_minmax(140px,1fr)_minmax(125px,1fr)_minmax(150px,1.2fr)_minmax(130px,0.8fr)_auto] sm:items-end" onSubmit={async (event) => {
              event.preventDefault();
              setQuickTaskError("");
              if (!quickTaskTitle.trim() || !quickTaskProject || !quickTaskStageCode || !quickTaskAssignee) { setQuickTaskError("Add a task title, project, lifecycle stage, and team assignee."); return; }
              if (!props.onCreateTask) return;
              setQuickTaskSaving(true);
              try {
                const saved = await props.onCreateTask({ title: quickTaskTitle.trim(), priority: "Normal", assignee: quickTaskAssignee, projectId: quickTaskProject, stageCode: quickTaskStageCode, dueDate: quickTaskDueDate, notes: "" });
                if (saved !== false) { setQuickTaskTitle(""); setQuickTaskOpen(false); }
              } catch (error) {
                setQuickTaskError(error instanceof Error ? error.message : "Task could not be assigned.");
              } finally { setQuickTaskSaving(false); }
            }}>
              <label className="grid gap-1 text-[10px] text-muted-foreground">Task<input aria-label="New task title" value={quickTaskTitle} onChange={(event) => setQuickTaskTitle(event.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground" placeholder="Describe the work" /></label>
              <label className="grid gap-1 text-[10px] text-muted-foreground">Project<select aria-label="New task project" value={quickTaskProject} onChange={(event) => { const nextProject = projects.find((item) => item.id === event.target.value); setQuickTaskProject(event.target.value); setQuickTaskStageCode(nextProject?.fields["currentStage"] || nextProject?.fields["lifecycleStage"] || nextProject?.fields["stage"] || ""); }} className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"><option value="">Select project</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.reference} · {item.title}</option>)}</select></label>
              <label className="grid gap-1 text-[10px] text-muted-foreground">Lifecycle stage<select aria-label="New task lifecycle stage" value={quickTaskStageCode} onChange={(event) => setQuickTaskStageCode(event.target.value)} disabled={!quickTaskProject} className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"><option value="">Choose stage</option>{quickStageOptions.map((stage) => <option key={stage.stageCode} value={stage.stageCode}>{stage.stageCode} · {stage.name}</option>)}</select></label>
              <label className="grid gap-1 text-[10px] text-muted-foreground">Team member<select aria-label="New task assignee" value={quickTaskAssignee} onChange={(event) => setQuickTaskAssignee(event.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"><option value="">Choose assignee</option>{[...new Set(props.team.map((member) => member.name).filter(Boolean))].map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
              <label className="grid gap-1 text-[10px] text-muted-foreground">Review due<input type="date" aria-label="New task review due date" value={quickTaskDueDate} onChange={(event) => setQuickTaskDueDate(event.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground" /></label>
              <div className="flex gap-1"><button type="submit" disabled={quickTaskSaving} className="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60">{quickTaskSaving ? "Saving…" : "Assign"}</button><button type="button" disabled={quickTaskSaving} onClick={() => setQuickTaskOpen(false)} className="h-8 rounded-md border border-border px-2 text-xs">Cancel</button></div>
              {quickTaskError && <p role="alert" className="text-xs text-destructive sm:col-span-full">{quickTaskError}</p>}
            </form>
          )}
        </section>
      )}

      {activeTab === "dashboard" && props.dashboardAudience !== "member" && (
        <section aria-label="Pending department approvals" className="rounded-xl border border-border bg-card p-3 shadow-xs">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wide">Pending approvals</h2>
              <p className="text-[10px] text-muted-foreground">Lead review focus · {dashboardPendingApprovals.length} waiting</p>
            </div>
            <button type="button" onClick={() => props.onOpenApprovals ? props.onOpenApprovals() : setActiveTab("approvals")} className="text-[11px] font-semibold text-primary hover:underline">
              Review approvals
            </button>
          </div>
          {dashboardPendingApprovals.length ? (
            <div className="divide-y divide-border/60">
              {dashboardPendingApprovals.slice(0, 5).map((approval) => (
                <div key={approval.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                  <button type="button" onClick={() => setQuickViewApprovalId(approval.id)} className="min-w-0 truncate text-left font-semibold hover:text-primary hover:underline">{approval.title}</button>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{approval.approverAuthority || "Reviewer not assigned"}</span>
                  <button type="button" aria-label={`Quick view ${approval.title}`} onClick={() => setQuickViewApprovalId(approval.id)} className="shrink-0 rounded-md border border-primary/30 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/5">Quick view</button>
                </div>
              ))}
            </div>
          ) : <p className="py-2 text-xs text-muted-foreground">No pending approvals for this department.</p>}
        </section>
      )}

      {/* Sidebar destinations set the active workspace view; keep this page focused without a second tab bar. */}
      {/* SUBVIEW 0: SALES PIPELINE (FOR SALES DEPT) */}
      {isSalesDept && activeTab === "sales-pipeline" && (
        <div className="space-y-4">
          {props.salesPipelineView ?? (props.salesPipeline ? <SalesEnquiriesAndOpportunities {...props.salesPipeline} /> : <p className="text-xs text-muted-foreground">Open the Sales workspace to manage intake.</p>)}
        </div>
      )}

      {/* SUBVIEW 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {all && (
            <section aria-label="Department projects" className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Active Department Projects ({projects.length})
                </h3>
                <span className="text-[11px] text-muted-foreground">Click a project to scope work</span>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {projects.length ? (
                  projects.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => props.onProjectChange(item.reference)}
                      className="rounded-lg border border-border bg-muted/20 p-3 text-left transition-all hover:border-primary/50 hover:bg-muted/40 cursor-pointer"
                    >
                      <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        {item.reference}
                      </span>
                      <strong className="block text-xs text-foreground mt-1.5 truncate">{item.title}</strong>
                      <p className="mt-1 text-[11px] text-muted-foreground truncate">{item.status}</p>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No projects linked to this department yet.</p>
                )}
              </div>
            </section>
          )}

          {/* Compact Previews for Deliverables & Approvals */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section aria-label="Project documents" className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Project Deliverables ({documents.length})
                </h3>
                <button
                  onClick={() => props.onOpenRecords ? props.onOpenRecords() : setActiveTab("records")}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  View all in Board <ArrowRight className="size-3" />
                </button>
              </div>
              <div className="space-y-2">
                {documents.slice(0, 4).map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => props.onOpenDocument(doc.id)}
                    className="block w-full rounded-lg border border-border/70 p-2.5 text-left hover:bg-secondary/50 transition-colors cursor-pointer"
                  >
                    <strong className="text-xs text-foreground block truncate">{doc.title}</strong>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {doc.type} · {doc.lifecycle || "Draft"} · {doc.revision && doc.revision !== "Not recorded" ? `Rev ${doc.revision}` : "Revision not recorded"}
                    </p>
                  </button>
                ))}
                {!documents.length && (
                  <p className="text-xs text-muted-foreground py-2">No documents linked to this scope.</p>
                )}
              </div>
            </section>

            <section aria-label="Project approvals" className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Approvals & Reviews ({approvals.length})
                </h3>
                <button
                  onClick={() => props.onOpenApprovals ? props.onOpenApprovals() : setActiveTab("approvals")}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  View all approvals <ArrowRight className="size-3" />
                </button>
              </div>
              <div className="space-y-2">
                {approvals.slice(0, 4).map((approval) => (
                  <article key={approval.id} className="rounded-lg border border-border/70 p-2.5 text-xs space-y-1">
                    <strong className="text-foreground block truncate">{approval.title}</strong>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Status: {approval.outcome}</span>
                      <span>Reviewer: {approval.approverAuthority || "Not assigned"}</span>
                    </div>
                  </article>
                ))}
                {!approvals.length && (
                  <p className="text-xs text-muted-foreground py-2">No pending approvals in this scope.</p>
                )}
              </div>
            </section>
          </div>
          <details className="rounded-xl border border-border bg-card px-3 py-2.5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold">
              <span className="flex items-center gap-2"><Users className="size-3.5 text-primary" />Team & capacity</span>
              <span className="text-muted-foreground">{team.length} members · open roster</span>
            </summary>
            <div className="mt-2 grid gap-1.5 border-t border-border/60 pt-2 sm:grid-cols-2 lg:grid-cols-3">
              {team.map((member) => (
                <div key={member.name} className="flex min-w-0 items-center justify-between gap-2 rounded border border-border/60 px-2 py-1.5 text-[11px]">
                  <span className="min-w-0 truncate"><strong className="text-foreground">{member.name}</strong><span className="ml-1 text-muted-foreground">{member.role}</span></span>
                  <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-primary">{member.level}</span>
                </div>
              ))}
              {!team.length && <p className="text-[11px] text-muted-foreground">No team members recorded in this scope.</p>}
            </div>
          </details>
        </div>
      )}

      {/* SUBVIEW 2: FULL TASKS BOARD */}
      {activeTab === "tasks" && (
        <section aria-label="Department tasks full view" className="space-y-4">
          <DepartmentLeadCoordinationCenter
            key={`${departmentCode}:${projectScope}-tasks`}
            hideHeader
            hideProjectSelector
            hideProjectsAndTeam
            recordsAreScoped
              canCreateTask={props.canCreateTask}
            departmentCode={departmentCode}
            departmentName={departmentName}
            departmentLead={lead}
            records={records}
            teamMembers={props.team}
            projects={shownProjects.map((item) => ({
              id: item.id,
              reference: item.reference,
              name: item.title,
              customer: item.fields["customer"] || "Not recorded",
              currentStage: item.fields["lifecycleStage"] || "Not recorded",
              targetDate: item.fields["targetDate"] || "Not recorded",
              volume: item.fields["quantity"] || "Not recorded",
            }))}
            projectScope={projectScope}
            onProjectScopeChange={props.onProjectChange}
            onCreateTask={props.onCreateTask}
            onUpdateTaskAssignee={(id, assignee) =>
              props.onUpdateTask(id, { fields: { assignee } }, "Task reassigned")
            }
            onUpdateTaskStatus={(id, status) =>
              props.onUpdateTask(
                id,
                { status, ...(status === "Open" ? { fields: { workStatus: "To do" } } : {}) },
                "Task status updated"
              )
            }
            onUpdateTaskReviewDue={(id, dueDate) =>
              props.onUpdateTask(id, { fields: { dueDate } }, "Task review date updated")
            }
            onStartTask={(id) =>
              props.onUpdateTask(id, { status: "Open", fields: { workStatus: "In progress" } }, "Task started")
            }
            onOpenTask={props.onOpenTask}
          />
        </section>
      )}

      {/* SUBVIEW 3: ONE PROJECT-SCOPED RECORDS & DELIVERABLES REGISTER */}
      {activeTab === "records" && (
        <section aria-label="Records and deliverables register" className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <FileSpreadsheet className="size-4 text-primary" />
                Records & Deliverables ({registerRowCount})
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                One project-scoped list. A department record and its linked original file appear together; approvals remain in Approvals.
              </p>
            </div>
            {props.onCreateDeliverable && <button type="button" onClick={props.onCreateDeliverable} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"><Plus className="size-3.5"/>Add document</button>}
            <div className="relative min-w-56">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search records and files..."
                value={recordSearch}
                onChange={(e) => setRecordSearch(e.target.value)}
                className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {props.recordTypeFilter && (
            <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
              <span className="font-medium text-foreground">Filtered to {props.recordTypeFilter}</span>
              <button
                type="button"
                onClick={() => { setRecordSearch(""); props.onClearRecordTypeFilter?.(); }}
                className="rounded-md border border-border bg-background px-2.5 py-1 font-semibold text-foreground hover:bg-secondary"
              >
                Show all records
              </button>
            </div>
          )}

          {registerRowCount === 0 ? (
            <div role="status" className="py-8 text-center text-xs text-muted-foreground">
              {props.recordTypeFilter
                ? `No ${props.recordTypeFilter} records or deliverables are linked in this project scope yet.`
                : "No records or deliverables match this project and search."}
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {filteredDeptRecords.map((record) => {
                const linkedDocuments = documentsForRecord(record);
                return (
                  <article key={record.id} className="space-y-2 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <button type="button" onClick={() => props.onOpenRecord(record.id)} className="min-w-0 text-left hover:underline">
                        <span className="font-mono text-[10px] font-bold text-primary">{record.reference}</span>
                        <strong className="block text-xs font-semibold text-foreground mt-0.5">{record.title}</strong>
                        <span className="text-[11px] text-muted-foreground">{record.type} · {recordStageLabel(record.fields, record.type, project?.fields)}</span>
                        {(duplicateReferenceCounts.get(record.reference.trim().toUpperCase()) ?? 0) > 1 && <span role="status" className="mt-1 inline-flex rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">Conflicting duplicate reference · {duplicateReferenceCounts.get(record.reference.trim().toUpperCase())} records retained</span>}
                      </button>
                      <span className="self-start rounded border border-border bg-muted/30 px-2 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">{record.status}</span>
                    </div>
                    {linkedDocuments.map((document) => (
                      <div key={document.id} className="ml-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 sm:ml-6">
                        <div className="min-w-0">
                          <strong className="block truncate text-xs font-medium">{document.title}</strong>
                          <span className="text-[11px] text-muted-foreground">{document.type} · {document.revision && document.revision !== "Not recorded" ? `Rev ${document.revision}` : "Revision not recorded"} · {document.lifecycle || "Draft"}</span>
                        </div>
                        <button type="button" onClick={() => props.onOpenDocument(document.id)} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-secondary/80">
                          Open file details <ExternalLink className="size-3 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </article>
                );
              })}
              {standaloneDocuments.map((document) => (
                <article key={document.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <strong className="block truncate text-xs font-semibold text-foreground">{document.title}</strong>
                    <span className="text-[11px] text-muted-foreground">{document.type} · {document.revision && document.revision !== "Not recorded" ? `Rev ${document.revision}` : "Revision not recorded"} · {document.lifecycle || "Draft"}</span>
                  </div>
                  <button type="button" onClick={() => props.onOpenDocument(document.id)} className="inline-flex shrink-0 items-center gap-1 self-start rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-secondary/80 sm:self-auto">
                    Open file details <ExternalLink className="size-3 text-muted-foreground" />
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* SUBVIEW 4: APPROVALS & REVIEWS */}
      {activeTab === "approvals" && (
        <section aria-label="Project approvals register" className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                Approvals & Gate Sign-Offs
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Human governance decisions and stage-gate approvals in the selected project scope.
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-foreground">
              {approvals.length} Records
            </span>
          </div>

          <div className="space-y-2">
            {approvals.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No gate sign-offs or approvals recorded in this scope.
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {approvals.map((approval) => (
                  <article key={approval.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <strong className="text-xs font-semibold text-foreground block">{approval.title}</strong>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Outcome: <span className="font-semibold text-foreground">{approval.outcome}</span> · Authority: {approval.approverAuthority || approval.department || "Not assigned"}
                      </p>
                    </div>
                    {props.onOpenApprovals && <button type="button" onClick={props.onOpenApprovals} className="text-xs text-primary font-semibold hover:underline">Open approval review →</button>}
                    {sourceIds.has(approval.recordId) && (
                      <button
                        type="button"
                        onClick={() => props.onOpenRecord(approval.recordId)}
                        className="text-xs text-primary font-semibold hover:underline self-start sm:self-auto cursor-pointer"
                      >
                        Open source record →
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <Dialog open={quickViewApprovalId !== null} onOpenChange={(open) => { if (!open) setQuickViewApprovalId(null); }}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Approval review</DialogTitle>
            <DialogDescription>Complete request details and the same sign-off actions used on the Approvals page.</DialogDescription>
          </DialogHeader>
          <ApprovalsFullPageView
            approvals={props.approvals}
            projects={props.projects.map((item) => ({ id: item.id, reference: item.reference, title: item.title }))}
            records={props.records.map((item) => ({ id: item.id, reference: item.reference, title: item.title, fields: item.fields }))}
            currentUser={props.approvalCurrentUser}
            userRole={props.approvalUserRole}
            persona={props.approvalPersona}
            departmentScope={props.departmentCode === "ALL" ? undefined : props.departmentCode}
            onApprove={props.onApproveApproval || (() => false)}
            onReject={props.onRejectApproval || (() => false)}
            onReturn={props.onReturnApproval || (() => false)}
            quickViewApprovalId={quickViewApprovalId || undefined}
            onDecisionComplete={() => setQuickViewApprovalId(null)}
          />
        </DialogContent>
      </Dialog>

      {advanceModalOpen && project && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Advance Lifecycle Stage</h3>
                <p className="text-xs text-muted-foreground">{project.reference} · {project.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setAdvanceModalOpen(false)}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Current Stage</label>
                <div className="font-mono text-xs font-bold bg-muted/40 p-2 rounded border border-border">
                  {currentStageCode}
                </div>
              </div>

              {props.onRequestStageReview && track && CANONICAL_STAGE_TEMPLATES.some(stage => stage.stageCode === currentStageCode) && (
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Finish all tasks for {currentStageCode}, then submit its evidence to the existing Approvals queue. Another authorized reviewer must approve before dependent stages can start.</p>
                  <button type="button" className="text-xs font-semibold text-primary disabled:opacity-50"
                    disabled={advanceBusy || completedStageCodes.includes(currentStageCode)}
                    onClick={async () => {
                      setAdvanceBusy(true); setAdvanceError(""); setAdvanceNotice("");
                      try {
                        const saved = await props.onRequestStageReview?.(project.id, currentStageCode, advanceNotes);
                        if (saved !== false) setAdvanceNotice("Review submitted. Open Approvals to review its task evidence.");
                        else setAdvanceError("Review was not saved. Check the workspace notice and retry.");
                      } catch (error) { setAdvanceError(error instanceof Error ? error.message : "Review submission failed."); }
                      finally { setAdvanceBusy(false); }
                    }}>
                    {completedStageCodes.includes(currentStageCode) ? "Stage approved" : "Submit current stage for review"}
                  </button>
                </div>
              )}

                            {!CANONICAL_STAGE_TEMPLATES.some(stage => stage.stageCode === currentStageCode) && (
                <p role="note" className="text-xs text-muted-foreground">Legacy stage history is retained. Review and adopt a canonical lifecycle plan before using these new stage controls.</p>
              )}
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Target Stage ({eligibleStages.length} eligible transitions)
                </label>
                <select
                  value={selectedTargetStage}
                  onChange={(e) => setSelectedTargetStage(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-medium outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="">Select Eligible Target Stage...</option>
                  {eligibleStages.length === 0 ? (
                    <option value="" disabled>
                      {track ? "No eligible transitions available (complete open tasks or prerequisites first)" : "Project track is missing or unrecognized; confirm the project scope first"}
                    </option>
                  ) : (
                    eligibleStages.map((stg) => (
                      <option key={stg.stageCode} value={stg.stageCode}>
                        {stg.stageCode} · {stg.name} ({stg.ownerDepartment})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Stage Notes / Evidence Reference (Optional)</label>
                <textarea
                  value={advanceNotes}
                  onChange={(e) => setAdvanceNotes(e.target.value)}
                  placeholder="e.g. Design review gate passed, schematic approved"
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background p-2 text-xs font-normal outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {advanceNotice && <p role="status" className="text-xs text-primary">{advanceNotice}</p>}
              {advanceError && (
                <p role="alert" className="text-xs text-destructive font-medium">
                  {advanceError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
              <button
                type="button"
                onClick={() => setAdvanceModalOpen(false)}
                disabled={advanceBusy}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={advanceBusy || !eligibleStages.some((stage) => stage.stageCode === selectedTargetStage)}
                onClick={async () => {
                  if (!eligibleStages.some((stage) => stage.stageCode === selectedTargetStage)) return;
                  setAdvanceBusy(true);
                  setAdvanceError("");
                  try {
                    const res = await props.onAdvanceStage?.(project.id, selectedTargetStage, advanceNotes);
                    if (res !== false) {
                      setAdvanceModalOpen(false);
                    }
                  } catch (err) {
                    setAdvanceError(err instanceof Error ? err.message : "Failed to advance stage.");
                  } finally {
                    setAdvanceBusy(false);
                  }
                }}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {advanceBusy ? "Advancing..." : "Advance Stage"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
