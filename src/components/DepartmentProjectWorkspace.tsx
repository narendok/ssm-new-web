import { ResponsiveFilterBar, CompactFilterSelect } from "@/components/ResponsiveFilterBar";
import { SalesEnquiriesAndOpportunities, defaultCustomers, defaultEnquiriesOpportunities } from "./SalesWorkspaceAndCustomerRegister";
import { Sparkles } from "lucide-react";
import { matchesWorkspaceDocument } from "@/lib/sidebar-selection";
import { getSharedTestWorkspace } from "@/lib/shared-test.functions";
import type { TestMembership } from "@/lib/test-auth.functions";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import React, { useState, useEffect } from "react";
import { DepartmentLeadCoordinationCenter, type TaskRecord, type TeamMember } from "./DepartmentLeadCoordinationCenter";
import type { ApprovalRecord } from "./ApprovalsFullPageView";
import { recordsForProject, documentsForProject } from "@/lib/project-workspace";
import { getApplicableStagesForTrack, type ProjectTrack } from "@/lib/canonical-lifecycle";
import {
  FolderKanban,
  Plus,
  FileText,
  CheckCircle2,
  Clock,
  Users,
  ShieldCheck,
  ArrowRight,
  Layers,
  FileSpreadsheet,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  LayoutDashboard,
  CheckSquare,
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
  team: TeamMember[];
  projectScope: string;
  recordTypeFilter?: string | null | undefined;
  onClearRecordTypeFilter?: (()=>void) | undefined;
  initialTab?: "overview" | "tasks" | "deliverables" | "approvals" | "records" | "team" | undefined;
  onProjectChange: (value: string) => void;
  onCreateRecord: () => void;
  onOpenInputs?: (() => void) | undefined;
  onCreateDeliverable?: (() => void) | undefined;
  onCreateProject?: (() => void) | undefined;
  onOpenRecord: (id: string) => void;
  onOpenDocument: (id: string) => void;
  onUpdateTask: (id: string, patch: Partial<TaskRecord>, action: string) => void;
  onCreateTask: (task: {
    title: string;
    priority: TaskRecord["priority"];
    assignee: string;
    projectId: string;
    dueDate: string;
    notes: string;
  }) => boolean | void | Promise<boolean | void>;
  onAdvanceStage?: ((projectId: string, targetStage: string, notes?: string) => Promise<boolean | void>) | undefined;
};

export function DepartmentProjectWorkspace(props: Props) {
  const { departmentCode, departmentName, lead, projects, projectScope } = props;
  const loadSharedWorkspace = useServerFn(getSharedTestWorkspace);
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
  const [activeTab, setActiveTab] = useState<"overview" | "tasks" | "deliverables" | "approvals" | "records" | "team" | "sales-pipeline">(
    props.initialTab ?? (isSalesDept ? "sales-pipeline" : "overview")
  );

  useEffect(() => {
    if (props.initialTab) {
      setActiveTab(props.initialTab);
    }
  }, [props.initialTab]);
  const [recordSearch, setRecordSearch] = useState("");
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [selectedTargetStage, setSelectedTargetStage] = useState("");
  const [advanceNotes, setAdvanceNotes] = useState("");
  const [advanceBusy, setAdvanceBusy] = useState(false);
  const [advanceError, setAdvanceError] = useState("");

  const project = projects.find((item) => item.reference === projectScope || item.id === projectScope);
  const track = (project?.fields?.["track"] || "hardware_firmware") as ProjectTrack;
  const applicableStages = project ? getApplicableStagesForTrack(track) : [];
  const all = projectScope === "all";
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
  const deptWorkRecords = work.filter((record) => record.type !== "Task");
  const completed = work.filter((record) => record.status === "Approved" || record.status === "Released").length;
  const progress = work.length ? Math.round((completed / work.length) * 100) : 0;
  const owners = new Set(taskRecords.map((record) => record.fields["assignee"]));
  const team = all ? props.team : props.team.filter((member) => owners.has(member.name));
  const shownProjects = all ? projects : project ? [project] : [];

  const filteredDeptRecords = deptWorkRecords.filter((rec) => {
    if (!recordSearch.trim()) return true;
    const q = recordSearch.toLowerCase();
    return rec.title.toLowerCase().includes(q) || rec.reference.toLowerCase().includes(q) || (rec.type || "").toLowerCase().includes(q);
  });

  return (
    <main className="space-y-4" aria-label="Department project workspace">
      {/* 1. Compact Header: Left title/lead, Right compact project selector and action */}
      <header className="rounded-xl border border-border/80 bg-card px-4 py-3 shadow-xs">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                {departmentCode} · WORKSPACE
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                Lead: <strong className="text-foreground">{lead}</strong>
              </span>
            </div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              {departmentName} — Project Workspace
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 max-w-72"><CompactFilterSelect label="Workspace project" shortLabel="Project" icon={FolderKanban} value={projectScope} onChange={props.onProjectChange} options={[{value:"all",label:"All projects"},...(!all && !project ? [{value:projectScope,label:"Selected project unavailable"}] : []),...projects.map(item=>({value:item.reference,label:`${item.reference} · ${item.title}`}))]}/></div>

            {props.onCreateProject && <button type="button" onClick={props.onCreateProject} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">New Project</button>}
            <button
              type="button"
              onClick={props.onOpenInputs}
              disabled={!props.onOpenInputs}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary shadow-xs hover:bg-primary/20 transition-colors cursor-pointer"
              title="Open project inputs and feasibility; the input coordinator can import requirements there"
            >
              <Sparkles className="size-3.5" />
              <span>Inputs & Feasibility</span>
            </button>
            <button
              type="button"
              onClick={props.onCreateRecord}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Add Record</span>
            </button>
          </div>
        </div>

        {!all && !project && (
          <p role="status" className="mt-2 text-xs text-amber-500 font-medium">
            This project is not linked to your department. Choose an available project.
          </p>
        )}
      </header>

      {/* 2. Compact Project Overview Banner (if a specific project is selected) */}
      {project && (
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
      <section aria-label="Workspace summary" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          ["Department progress", `${progress}%`, `${completed} of ${work.length} records complete`],
          ["Tasks", String(taskRecords.length), "Checklist, Kanban & Table"],
          ["Project deliverables", String(documents.length), "Selected project files only"],
          ["Pending approvals", String(approvals.filter((approval) => approval.outcome === "Pending").length), "Human decisions required"],
        ].map(([label, value, detail]) => (
          <div key={label} className="rounded-xl border border-border/80 bg-card p-3 shadow-xs">
            <p className="text-[11px] font-mono uppercase text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{detail}</p>
          </div>
        ))}
      </section>

      {/* 4. Sub-Navigation Tabs */}
      <nav aria-label="Workspace subviews" className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-border bg-muted/40 p-1">
        {[
          ...(isSalesDept ? [{ key: "sales-pipeline", label: "Opportunities & Enquiries", icon: Sparkles }] : []),
          { key: "overview", label: "Overview", icon: LayoutDashboard },
          { key: "tasks", label: `Tasks (${taskRecords.length})`, icon: CheckSquare },
          { key: "deliverables", label: `Project Deliverables (${documents.length})`, icon: FileSpreadsheet },
          { key: "approvals", label: `Approvals (${approvals.length})`, icon: ShieldCheck },
          { key: "records", label: `Department Records (${deptWorkRecords.length})`, icon: Layers },
          { key: "team", label: `Team & Capacity (${team.length})`, icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

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

          {/* Embedded Coordination Center (Tasks with Checklist, Kanban, Table) */}
          <section aria-label="Department tasks coordination" className="space-y-2">
            <DepartmentLeadCoordinationCenter
              key={`${departmentCode}:${projectScope}`}
              hideHeader
              hideProjectSelector
              hideProjectsAndTeam
              recordsAreScoped
              departmentCode={departmentCode}
              departmentName={departmentName}
              departmentLead={lead}
              records={records}
              teamMembers={props.team}
              projects={shownProjects.map((item) => ({
                id: item.reference,
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
              onStartTask={(id) =>
                props.onUpdateTask(id, { status: "Open", fields: { workStatus: "In progress" } }, "Task started")
              }
              onOpenTask={(task) => props.onOpenRecord(task.id)}
            />
          </section>

          {/* Compact Previews for Deliverables & Approvals */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section aria-label="Project documents" className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Project Deliverables ({documents.length})
                </h3>
                <button
                  onClick={() => setActiveTab("deliverables")}
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
                  onClick={() => setActiveTab("approvals")}
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
            departmentCode={departmentCode}
            departmentName={departmentName}
            departmentLead={lead}
            records={records}
            teamMembers={props.team}
            projects={shownProjects.map((item) => ({
              id: item.reference,
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
            onStartTask={(id) =>
              props.onUpdateTask(id, { status: "Open", fields: { workStatus: "In progress" } }, "Task started")
            }
            onOpenTask={(task) => props.onOpenRecord(task.id)}
          />
        </section>
      )}

      {/* SUBVIEW 3: UNIFIED TECHNICAL DELIVERABLES & LIFECYCLE BOARD */}
      {activeTab === "deliverables" && (
        <section aria-label="Unified technical deliverables board" className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
          {props.recordTypeFilter && <div className="flex items-center justify-between text-xs"><span>Document view: {props.recordTypeFilter === "SCHEMATIC" ? "Schematics & BOM" : props.recordTypeFilter === "DFMEA" ? "DFMEA & Gerber" : "Requirements / PRS"}</span><button type="button" onClick={props.onClearRecordTypeFilter} className="text-primary hover:underline">Show all document types</button></div>}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <FileSpreadsheet className="size-4 text-primary" />
                Project Deliverables & Linked Files
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Authorized files and deliverable records for the selected project. Open Project Documents & Vault to search across all projects you can access.
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded">
              {documents.length} Authorized Documents
            </span>
            {props.onCreateDeliverable && <button type="button" onClick={props.onCreateDeliverable} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"><Plus className="size-3.5"/>Add Deliverable</button>}
          </div>

          <div className="space-y-3">
            {documents.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No authorized deliverables or documents recorded for {projectScope}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-muted/40 font-mono uppercase tracking-wider text-muted-foreground text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Deliverable & Title</th>
                      <th className="px-3 py-3">Category</th>
                      <th className="px-3 py-3">Revision</th>
                      <th className="px-3 py-3">Lifecycle State</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <span className="font-mono text-[10px] font-bold text-primary block">
                            {doc.id}
                          </span>
                          <strong className="text-xs text-foreground block mt-0.5">
                            {doc.title}
                          </strong>
                        </td>
                        <td className="px-3 py-3">
                          <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] text-secondary-foreground font-semibold">
                            {doc.type}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono text-[11px] font-semibold text-foreground">
                          {doc.revision && doc.revision !== "Not recorded" ? `Rev ${doc.revision}` : "Not recorded"}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                              doc.lifecycle === "Approved" || doc.lifecycle === "Released"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : doc.lifecycle === "In review"
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            }`}
                          >
                            {doc.lifecycle || "Draft"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => props.onOpenDocument(doc.id)}
                            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
                          >
                            <span>Inspect File</span>
                            <ExternalLink className="size-3 text-muted-foreground" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
                        Outcome: <span className="font-semibold text-foreground">{approval.outcome}</span> · Authority: {approval.approverAuthority || "Not assigned"}
                      </p>
                    </div>
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

      {/* SUBVIEW 5: DEPARTMENT RECORDS REGISTER */}
      {activeTab === "records" && (
        <section aria-label="Department records full register" className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                Department Records Register ({deptWorkRecords.length})
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Full-page column view of non-task operational records, technical trackers, and governed documents.
              </p>
            </div>

            <div className="relative min-w-56">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search records..."
                value={recordSearch}
                onChange={(e) => setRecordSearch(e.target.value)}
                className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-2">
            {filteredDeptRecords.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No department records match the active search.
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {filteredDeptRecords.map((record) => (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => props.onOpenRecord(record.id)}
                    className="flex w-full items-center justify-between py-3 text-left hover:bg-secondary/40 px-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <div>
                      <span className="font-mono text-[10px] font-bold text-primary">{record.reference}</span>
                      <strong className="block text-xs font-semibold text-foreground mt-0.5">{record.title}</strong>
                      <span className="text-[11px] text-muted-foreground">{record.type} · {record.fields["lifecycleStage"] || "Operational"}</span>
                    </div>
                    <span className="rounded border border-border bg-muted/30 px-2 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                      {record.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* SUBVIEW 6: TEAM & CAPACITY */}
      {activeTab === "team" && (
        <section aria-label="Department team roster" className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
          <div className="border-b border-border/60 pb-3">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Users className="size-4 text-primary" />
              {all ? "Department Team & Competency" : "Assigned Task Owners"} ({team.length})
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Active engineering personnel assigned to department commitments.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((member) => (
              <div key={member.name} className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <strong className="text-xs font-bold text-foreground block">{member.name}</strong>
                    <span className="text-[11px] text-muted-foreground">{member.role}</span>
                  </div>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-primary">
                    {member.level}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 pt-1 border-t border-border/40">
                  {member.skills?.slice(0, 3).map((skill) => (
                    <span key={skill} className="rounded bg-secondary/80 px-1.5 py-0.2 font-mono text-[9px] text-secondary-foreground">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {!team.length && (
              <p className="text-xs text-muted-foreground py-4 col-span-3">No team members recorded in this project scope.</p>
            )}
          </div>
        </section>
      )}
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
                  {project.fields["currentStage"] || project.fields["lifecycleStage"] || project.fields["stage"] || "CM_01"}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Target Stage</label>
                <select
                  value={selectedTargetStage}
                  onChange={(e) => setSelectedTargetStage(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-medium outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="">Select Target Stage...</option>
                  {applicableStages.map((stg) => (
                    <option key={stg.stageCode} value={stg.stageCode}>
                      {stg.stageCode} · {stg.name} ({stg.defaultOwner})
                    </option>
                  ))}
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
                disabled={advanceBusy || !selectedTargetStage}
                onClick={async () => {
                  if (!selectedTargetStage) return;
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
