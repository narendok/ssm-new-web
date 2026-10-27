import { isDecisionVisible } from "@/lib/decision-log-policy";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { BookOpen, Briefcase, Building2, FolderKanban, Layers, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResponsiveFilterBar, CompactFilterSelect } from "@/components/ResponsiveFilterBar";
import { departmentCode } from "@/lib/department-scope";
import type { Persona } from "@/components/RoleAwareSidebar";
import type { DecisionRecord } from "@/components/CompanyDirectoryAndLegalHub";
import { SharedMasterSelect } from "./SharedMasterSelect";
type Scope = "common" | "internal" | "client";
export function OfficialDecisionLogModal({
  onClose,
  activeProject,
  persona,
  authorId,
  decisions = [],
  projects = [],
  stageOptions = [],
  readOnlyReason,
  onSave,
  onApprove,
  shared = false,
  loading = false,
  headerContent,
  canApproveEntry,
  onReject,
  sourceOptions = [],
}: {
  onClose: () => void;
  activeProject?: string | undefined;
  persona?: Persona | undefined;
  authorId?: string | undefined;
  decisions?: DecisionRecord[];
  projects?: { id: string; reference: string; title: string }[];
  stageOptions?: string[];
  readOnlyReason?: string | undefined;
  onSave?: (record: DecisionRecord) => Promise<boolean>;
  onApprove?: (id: string) => Promise<boolean>;
  shared?:boolean;
  loading?:boolean;
  headerContent?:ReactNode;
  canApproveEntry?:((entry:DecisionRecord)=>boolean)|undefined;
  onReject?:((id:string,reason:string)=>Promise<boolean>)|undefined;
  sourceOptions?:{value:string;label:string}[];
}) {
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState(
    activeProject && projects.some((p) => p.reference === activeProject) ? activeProject : "all",
  );
  const [stageFilter, setStageFilter] = useState("all");
  const [scope, setScope] = useState<Scope | null>(null);
  const [project, setProject] = useState(activeProject ?? "");
  const [stage, setStage] = useState("");
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [source, setSource] = useState("");
  const [conditions, setConditions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId=useRef(crypto.randomUUID());
  const [rejectId,setRejectId]=useState(""),[rejectReason,setRejectReason]=useState("");
  const own = departmentCode(persona?.departmentId);
  const kind = persona?.kind ?? "client";
  const internal = kind === "admin" || kind === "lead" || kind === "member";
  const canSave = internal && Boolean(authorId && onSave) && !readOnlyReason && !loading;
  const canSee = (decision: DecisionRecord) =>
    isDecisionVisible(decision, {
      id: authorId ?? "",
      kind,
      name: persona?.person ?? "",
      role: persona?.label ?? "",
      department: own,
    });
  const permitted = shared ? decisions : decisions.filter(canSee);
  const filtered = permitted.filter(
    (d) =>
      (projectFilter === "all" ||
        (projectFilter === "common" ? d.scope === "common" : d.projectCode === projectFilter)) &&
      (stageFilter === "all" ||
        d.stage === stageFilter ||
        (stageFilter === "na" && d.scope === "common")) &&
      `${d.title} ${d.rationale} ${d.projectCode} ${d.impactedDocuments.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  function open(next: Scope) {
    requestId.current=crypto.randomUUID();
    setScope(next);
    setProject(next === "common" ? "" : (activeProject ?? ""));
    setStage("");
    setTitle("");
    setReason("");
    setSource("");
    setConditions("");
    setError("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSave || !scope || !persona || !authorId || busy) return;
    if (scope !== "common" && !projects.some((p) => p.reference === project)) {
      setError("Choose an existing permitted project.");
      return;
    }
    if (scope !== "common" && !stageOptions.includes(stage)) {
      setError("Choose the applicable workflow stage.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = await onSave!({
        id: requestId.current,
        projectCode: scope === "common" ? "" : project,
        timestamp: new Date().toISOString(),
        actor: persona.person,
        actorRole: persona.label,
        title: title.trim(),
        rationale: reason.trim(),
        impactedDocuments: source
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        actionItems: conditions.trim(),
        scope,
        stage: scope === "common" ? undefined : stage,
        departmentCode: own || "ADMIN",
        authorId,
        status: kind === "member" ? "Pending lead review" : "Recorded",
      });
      if (!saved) throw new Error("The decision was not saved. Your draft remains open.");
      setScope(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Dialog
        open={!scope}
        onOpenChange={(open) => {
          if (!open && !scope) onClose();
        }}
      >
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="size-4" />
              Decision & Deviation Log
            </DialogTitle>
            <DialogDescription>
              Significant exceptions and decisions, linked to their original departmental records.
              {shared ? "Saved to your company account with author and review history." : "Demonstration entries are stored in this browser."}
            </DialogDescription>
          </DialogHeader>
          {headerContent}
          {loading&&<p className="text-xs text-muted-foreground">Loading decisions…</p>}
          {readOnlyReason && (
            <p className="rounded-lg border border-border bg-secondary/40 p-2 text-xs text-muted-foreground">
              {readOnlyReason}
            </p>
          )}
          <ResponsiveFilterBar label="Create decision scope">
            {(
              [
                { value: "common", label: "Common / Department", short: "Common", icon: Building2 },
                {
                  value: "internal",
                  label: "Internal Project",
                  short: "Internal",
                  icon: FolderKanban,
                },
                { value: "client", label: "Client Project", short: "Client", icon: Briefcase },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                type="button"
                disabled={!canSave}
                onClick={() => open(item.value)}
                aria-label={`Record ${item.label} decision`}
                title={`Record ${item.label} decision`}
                className="compact-filter-select border-primary/25 bg-primary/10 text-primary disabled:opacity-50"
              >
                <item.icon className="size-3.5 shrink-0" />
                <span className="filter-full-label">+ {item.label}</span>
                <span className="filter-short-label">+ {item.short}</span>
              </button>
            ))}
          </ResponsiveFilterBar>
          <ResponsiveFilterBar label="Decision filters">
            <div className="filter-search">
              <Search />
              <input
                aria-label="Search decisions"
                placeholder="Search decisions or source references…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <CompactFilterSelect
              label="Project"
              icon={FolderKanban}
              value={projectFilter}
              onChange={setProjectFilter}
              options={[
                { value: "all", label: "All permitted projects / common" },
                { value: "common", label: "Common / Department" },
                ...projects.map((p) => ({
                  value: p.reference,
                  label: `${p.reference} · ${p.title}`,
                })),
              ]}
            />
            <CompactFilterSelect
              label="Workflow stage"
              shortLabel="Stage"
              icon={Layers}
              value={stageFilter}
              onChange={setStageFilter}
              options={[
                { value: "all", label: "All stages" },
                { value: "na", label: "Not applicable (Common)" },
                ...stageOptions.map((value) => ({ value, label: value })),
              ]}
            />
          </ResponsiveFilterBar>
          <div className="space-y-3">
            {filtered.map((entry) => (
              <article key={entry.id} className="rounded-xl border border-border/70 bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] text-primary">
                      {entry.scope === "common"
                        ? "Common / Department"
                        : entry.projectCode || "Project not recorded"}
                      {entry.stage ? ` · ${entry.stage}` : ""}
                    </p>
                    <h3 className="mt-1 text-sm font-semibold">{entry.title}</h3>
                  </div>
                  <span className="shrink-0 rounded border border-border bg-secondary px-2 py-1 text-[10px]">
                    {entry.status ?? "DEMO reference"}
                  </span>
                </div>
                <p className="mt-2 text-xs">{entry.rationale}</p>
                {entry.actionItems && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Conditions / next action: {entry.actionItems}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
                  <span>
                    Author: {entry.actor} · {entry.actorRole}
                  </span>
                  <span>{entry.timestamp}</span>
                </div>
                {entry.impactedDocuments.length > 0 && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Source references: {entry.impactedDocuments.join(", ")}
                  </p>
                )}
                {entry.approvedBy && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Reviewed by {entry.approvedBy}
                  </p>
                )}
                {!readOnlyReason &&
                  onApprove &&
                  (kind === "admin" || kind === "lead") &&
                  entry.status === "Pending lead review" && (
                    (!canApproveEntry || canApproveEntry(entry)) &&
                    <button
                      type="button"
                      disabled={busy}
                      className="mt-2 rounded-lg border border-primary/30 px-3 py-1.5 text-xs text-primary disabled:opacity-50"
                      onClick={async () => {
                        setBusy(true);
                        setError("");
                        try {
                          if (!(await onApprove(entry.id)))
                            setError("The review could not be saved.");
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Review failed.");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Approve department submission
                    </button>
                  )}
                {onReject&&canApproveEntry?.(entry)&&entry.status==="Pending lead review"&&<div className="mt-2 space-y-2">{rejectId===entry.id?<><input aria-label="Decision rejection reason" className="w-full rounded border bg-background px-3 py-2 text-xs" value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Reason for returning this submission"/><button type="button" disabled={busy||rejectReason.trim().length<3} className="rounded border px-3 py-1.5 text-xs" onClick={async()=>{setBusy(true);setError("");try{if(await onReject(entry.id,rejectReason)){setRejectId("");setRejectReason("");}}catch(e){setError(e instanceof Error?e.message:"Review failed");}finally{setBusy(false);}}}>Reject submission</button></>:<button type="button" className="text-xs text-muted-foreground underline" onClick={()=>{setRejectId(entry.id);setRejectReason("");}}>Reject with reason</button>}</div>}
              </article>
            ))}
            {!filtered.length && (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No permitted decisions match these filters.
              </p>
            )}
          </div>
          {error && !scope && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
      {scope && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) setScope(null);
          }}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {scope === "common"
                  ? "Common / Department"
                  : scope === "internal"
                    ? "Internal Project"
                    : "Client Project"}{" "}
                decision
              </DialogTitle>
              <DialogDescription>
                Author: {persona?.person}. Normal workflow approvals stay in their original records.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-3" onSubmit={(event) => void submit(event)}>
              <fieldset disabled={busy} className="space-y-3">
                {scope !== "common" && (
                  <>
                    <label className="block text-xs">
                      Project
                      <select
                        aria-label="Decision project"
                        required
                        value={project}
                        onChange={(e) => {
                          setProject(e.target.value);
                          setStage("");
                        }}
                        className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2"
                      >
                        <option value="">Choose project…</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.reference}>
                            {p.reference} · {p.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs">
                      Workflow stage
                      <select
                        aria-label="Decision workflow stage"
                        required
                        value={stage}
                        onChange={(e) => setStage(e.target.value)}
                        className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2"
                      >
                        <option value="">Choose stage…</option>
                        {stageOptions.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                <label className="block text-xs">
                  Decision / exception title
                  <input
                    required
                    maxLength={180}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2"
                  />
                </label>
                <label className="block text-xs">
                  Reason
                  <textarea
                    required
                    maxLength={4000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1 min-h-20 w-full rounded-lg border border-input bg-background p-2"
                  />
                </label>
                <label className="block text-xs">
                  Original record / evidence references
                  <input
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="Existing reference codes, separated by commas"
                    className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2"
                  />
                </label>
                {sourceOptions.length>0&&<SharedMasterSelect label="Find existing source record" value="" options={sourceOptions} onChange={value=>{if(value)setSource(current=>[...new Set([...current.split(",").map(s=>s.trim()).filter(Boolean),value])].join(", "));}}/>}
                <label className="block text-xs">
                  Conditions / validity / next action
                  <textarea
                    maxLength={2000}
                    value={conditions}
                    onChange={(e) => setConditions(e.target.value)}
                    className="mt-1 min-h-16 w-full rounded-lg border border-input bg-background p-2"
                  />
                </label>
              </fieldset>
              {error && (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setScope(null)}
                  className="rounded-lg border border-border px-3 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !canSave}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {busy
                    ? "Saving…"
                    : kind === "member"
                      ? "Submit for lead review"
                      : "Record decision"}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
