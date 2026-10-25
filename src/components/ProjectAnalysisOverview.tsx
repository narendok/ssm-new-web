import type { ReactNode } from "react";
import { PROJECT_INPUT_PARAMETERS } from "@/lib/project-inputs";
import { useMemo, useState } from "react";
import {
  FolderKanban,
  Search,
  ArrowRight,
  Layers,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Box,
  XCircle,
  FileText,
  Building,
  Check,
} from "lucide-react";
import { ResponsiveFilterBar, CompactFilterSelect } from "@/components/ResponsiveFilterBar";
import {
  projectAnalysis,
  savedLifecycleHistory,
  analysisComplete,
  approvedInput,
  type AnalysisRecord,
  type AnalysisDocument,
} from "@/lib/project-analysis-data";
import {
  LIFECYCLE_SCENARIOS,
  type LifecycleScenario,
  type ScenarioDependency,
} from "@/lib/lifecycle-scenarios";

export function ProjectAnalysisOverview({
  projects,
  records,
  documents,
  onOpenProject,
  showReferenceScenarios = true,
  renderProjectInputs,
}: {
  projects: AnalysisRecord[];
  records: AnalysisRecord[];
  documents: AnalysisDocument[];
  onOpenProject?: ((project: AnalysisRecord) => void) | undefined;
  showReferenceScenarios?: boolean;
  renderProjectInputs?: ((projectId:string)=>ReactNode) | undefined;
}) {
  const [projectId, setProjectId] = useState("all");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"analysis" | "scenarios" | "inputs">("inputs");
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("all");

  const visible = projects.filter(
    (p) =>
      (projectId === "all" || p.id === projectId) &&
      `${p.reference} ${p.title}`.toLowerCase().includes(query.toLowerCase()),
  );
  const analyses = useMemo(
    () => visible.map((p) => projectAnalysis(p, records, documents)),
    [visible, records, documents],
  );
  const dependencies = analyses.flatMap((a) =>
    a.dependencies.map((d) => ({ ...d, project: a.project.reference })),
  );
  const inputs = analyses.flatMap((a) => a.inputs);
  const approved = inputs.filter((r) => approvedInput(r.status)).length;
  const deptCodes = Array.from(
    new Set(analyses.flatMap((a) => a.departments.map((d) => d.code))),
  ).sort();

  const filteredScenarios = LIFECYCLE_SCENARIOS.filter((s) => {
    if (selectedScenarioId !== "all" && s.id !== selectedScenarioId) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.fixtureKey.toLowerCase().includes(q) ||
      (s.projectCode?.toLowerCase().includes(q) ?? false) ||
      (s.enquiryCode?.toLowerCase().includes(q) ?? false) ||
      (s.clientName?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3 border-b border-border/40 pb-3">
        <div>
          <h1 className="text-xl font-semibold">Project Analysis</h1>
          <p className="text-xs text-muted-foreground">
            One shared feasibility sheet per enquiry or project; overview tracks lifecycle progress and dependencies.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1 text-xs">
          <button
            className={`rounded px-3 py-1.5 font-medium transition-colors ${tab === "analysis" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("analysis")}
          >
            Readiness & Dependencies
          </button>
          <button className={`rounded px-3 py-1.5 font-medium ${tab === "inputs" ? "bg-background shadow-xs" : "text-muted-foreground"}`} onClick={()=>setTab("inputs")}>Project Inputs & Feasibility</button>
          {showReferenceScenarios && <button
            className={`rounded px-3 py-1.5 font-medium flex items-center gap-1.5 transition-colors ${tab === "scenarios" ? "bg-background shadow-xs text-primary font-semibold" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("scenarios")}
          >
            <Layers className="size-3.5" />
            Lifecycle Scenarios (§14.14)
          </button>}
        </div>
      </header>

      {tab !== "inputs" && (
        <ResponsiveFilterBar label="Project analysis filters">
          <div className="filter-search">
            <Search />
            <input
              aria-label="Search project analysis"
              placeholder="Search code, title or client…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {tab !== "scenarios" && (
            <CompactFilterSelect
              label="Project"
              icon={FolderKanban}
              value={projectId}
              onChange={setProjectId}
              options={[
                { value: "all", label: "All permitted projects" },
                ...projects.map((p) => ({ value: p.id, label: `${p.reference} · ${p.title}` })),
              ]}
            />
          )}
        </ResponsiveFilterBar>
      )}

      {tab === "inputs" ? (renderProjectInputs ? renderProjectInputs(projectId) : <section className="space-y-3"><h2 className="font-semibold">Project Input & Feasibility Template</h2><p className="text-xs text-muted-foreground">Sign in to the shared TEST workspace to save requirements and department assessments against an enquiry or project.</p><div className="overflow-auto rounded border"><table className="w-full text-xs"><thead><tr>{["Section / parameter","Input to confirm","Primary review","Supporting reviews","Dependent teams"].map(t=><th className="p-2 text-left" key={t}>{t}</th>)}</tr></thead><tbody>{PROJECT_INPUT_PARAMETERS.map(p=><tr key={p.id} className="border-t"><td className="p-2">{p.section}<strong className="block">{p.label}</strong></td><td className="p-2">{p.hint}</td><td className="p-2">{p.lead}</td><td className="p-2">{p.reviewers.join(", ")}</td><td className="p-2">{p.consumers.join(", ")}</td></tr>)}</tbody></table></div></section>) : tab === "scenarios" ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-primary uppercase tracking-wide">
                Six Realistic Automotive Lifecycle Scenarios (§14.14 · Reference &amp; Training)
              </span>
              <span className="text-[11px] text-muted-foreground">
                Synthetic connected verification pack · No real production side effects
              </span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Demonstrates five actual sample projects plus one declined pre-project enquiry.
              Includes verified clientless boundary (S01), terminal declination with zero project creation (S02),
              client PoC (S03), system pilot (S04), pilot refinement regression (S05), and mathematically reconciled bulk production (S06).
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelectedScenarioId("all")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium border transition-colors ${selectedScenarioId === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"}`}
              >
                All Scenarios (6)
              </button>
              {LIFECYCLE_SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedScenarioId(s.id)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium border transition-colors ${selectedScenarioId === s.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"}`}
                >
                  {s.id}: {s.fixtureKey}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {filteredScenarios.map((scenario) => (
              <article
                key={scenario.id}
                className="rounded-xl border border-border/80 bg-card p-5 space-y-4 text-xs shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                        {scenario.id}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {scenario.fixtureKey}
                      </span>
                      {scenario.projectCode ? (
                        <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs font-semibold">
                          Project: {scenario.projectCode}
                        </span>
                      ) : (
                        <span className="rounded bg-destructive/10 px-2 py-0.5 font-mono text-xs font-semibold text-destructive">
                          No Project Created (§14.14 Invariant)
                        </span>
                      )}
                      {scenario.enquiryCode && (
                        <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                          Enquiry: {scenario.enquiryCode}
                        </span>
                      )}
                    </div>
                    <h2 className="text-base font-semibold text-foreground mt-1.5">
                      {scenario.title}
                    </h2>
                    <p className="text-muted-foreground mt-0.5">
                      {scenario.isExternalClient
                        ? `Client: ${scenario.clientName}`
                        : `Internal Scope: ${scenario.clientName} (Clientless Boundary)`}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                      Fixture Status
                    </span>
                    <p className="font-semibold text-primary">{scenario.fixtureKey}</p>
                    {scenario.projectCode && onOpenProject && projects.find((p) => p.reference === scenario.projectCode) && (
                      <button
                        type="button"
                        className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                        onClick={() => {
                          const match = projects.find((p) => p.reference === scenario.projectCode);
                          if (match) onOpenProject(match);
                        }}
                      >
                        Open Live Project
                        <ArrowRight className="size-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1.5">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <Clock className="size-3.5 text-primary" />
                      Lifecycle Position & History
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      {scenario.currentPosition}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1.5">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5 text-amber-500" />
                      Current Gate Remark & Next Action
                    </p>
                    <p className="text-foreground font-medium">
                      {scenario.stageRemark}
                    </p>
                    <p className="text-primary font-medium mt-1">
                      Next: {scenario.currentNextAction}
                    </p>
                  </div>
                </div>

                {scenario.productionReconciliation && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="size-4" />
                        Production Reconciliation Matrix (Strict §14.14 Invariant)
                      </span>
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                        150 + 5 + 45 = 200 | 500 - 200 = 300
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2">
                      <div className="rounded-md border border-border bg-card p-2 text-center">
                        <span className="text-[10px] text-muted-foreground uppercase">Total Planned</span>
                        <p className="text-base font-bold text-foreground">
                          {scenario.productionReconciliation.totalPlannedUnits}
                        </p>
                      </div>
                      <div className="rounded-md border border-border bg-card p-2 text-center">
                        <span className="text-[10px] text-muted-foreground uppercase">Lot 1 Quantity</span>
                        <p className="text-base font-bold text-foreground">
                          {scenario.productionReconciliation.lotQuantity}
                        </p>
                      </div>
                      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2 text-center">
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase font-semibold">Accepted</span>
                        <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                          {scenario.productionReconciliation.acceptedUnits}
                        </p>
                      </div>
                      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-center">
                        <span className="text-[10px] text-amber-700 dark:text-amber-300 uppercase font-semibold">MRB Held</span>
                        <p className="text-base font-bold text-amber-700 dark:text-amber-300">
                          {scenario.productionReconciliation.heldUnits}
                        </p>
                      </div>
                      <div className="rounded-md border border-border bg-card p-2 text-center">
                        <span className="text-[10px] text-muted-foreground uppercase">Pending Insp</span>
                        <p className="text-base font-bold text-foreground">
                          {scenario.productionReconciliation.pendingInspectionUnits}
                        </p>
                      </div>
                      <div className="rounded-md border border-border bg-card p-2 text-center">
                        <span className="text-[10px] text-muted-foreground uppercase">Remaining Planned</span>
                        <p className="text-base font-bold text-foreground">
                          {scenario.productionReconciliation.remainingPlannedUnits}
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground pt-1">
                      * Only 150 accepted units eligible for dispatch. 5 held units undergo SMT solder rework. Zero inventory simulated without verified inspection.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground flex items-center gap-1.5">
                    <Layers className="size-3.5 text-primary" />
                    Cross-Department Dependencies ({scenario.dependencies.length})
                  </h3>
                  <div className="rounded-lg border border-border/70 overflow-hidden">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border/60 text-muted-foreground">
                          <th className="p-2 font-medium">What is Needed</th>
                          <th className="p-2 font-medium">Deliverable</th>
                          <th className="p-2 font-medium">Provider & Lead</th>
                          <th className="p-2 font-medium">Waiting Department</th>
                          <th className="p-2 font-medium">State</th>
                          <th className="p-2 font-medium">Next Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {scenario.dependencies.map((dep) => (
                          <tr key={dep.id} className="hover:bg-muted/20">
                            <td className="p-2 font-medium text-foreground">
                              {dep.whatNeeded}
                              {dep.criticalPath && (
                                <span className="ml-1.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300">
                                  Critical Path
                                </span>
                              )}
                            </td>
                            <td className="p-2 font-mono text-primary">{dep.deliverableCode}</td>
                            <td className="p-2">
                              {dep.providerDept} · <span className="text-muted-foreground">{dep.providerLead}</span>
                            </td>
                            <td className="p-2">{dep.waitingDept}</td>
                            <td className="p-2">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium border ${
                                  dep.state === "Approved/Frozen"
                                    ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300"
                                    : dep.state === "Under Review"
                                      ? "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-300"
                                      : dep.state === "Returned/Rework"
                                        ? "bg-destructive/10 text-destructive border-destructive/30"
                                        : "bg-muted text-muted-foreground border-border"
                                }`}
                              >
                                {dep.state}
                              </span>
                            </td>
                            <td className="p-2 text-muted-foreground max-w-xs">{dep.nextAction}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <details className="pt-1">
                  <summary className="cursor-pointer font-medium text-primary hover:underline">
                    View Complete Stage History ({scenario.stageHistory.length} Stages)
                  </summary>
                  <div className="mt-2 space-y-2 border-t border-border/50 pt-2">
                    {scenario.stageHistory.map((stg) => (
                      <div key={stg.stageId} className="rounded border border-border/50 p-2 text-[11px] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">
                            {stg.stageId}: {stg.stageName}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              stg.status === "Completed"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : stg.status === "Declined"
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {stg.status}
                          </span>
                        </div>
                        <p className="text-muted-foreground">
                          <strong>Prerequisite:</strong> {stg.prerequisite}
                        </p>
                        <p className="text-muted-foreground">
                          <strong>Remark:</strong> {stg.stageRemark}
                        </p>
                        <p className="text-primary font-medium">
                          <strong>Decision / Reason:</strong> {stg.decisionOrReason}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ["Projects", analyses.length],
              ["Approved department records", `${approved} / ${inputs.length}`],
              ["Open dependencies", dependencies.filter((d) => d.blocked).length],
              ["Departments with records", deptCodes.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border/70 bg-card p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-semibold mt-1">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Counts describe permitted saved records, not certified lifecycle completion. Unmapped
            requirements remain unknown.
          </p>
          <section className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold">Department work records</h2>
            <div className="flex flex-wrap gap-2">
              {deptCodes.length ? (
                deptCodes.map((code) => {
                  const rows = analyses
                    .flatMap((a) => a.departments)
                    .filter((d) => d.code === code);
                  return (
                    <div key={code} className="rounded-lg border border-border/60 p-3 text-xs">
                      <strong>{code}</strong>
                      <p>
                        {rows.reduce((n, d) => n + d.approved, 0)} /{" "}
                        {rows.reduce((n, d) => n + d.total, 0)} approved records
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground">No department work records recorded.</p>
              )}
            </div>
          </section>
          <section className="rounded-xl border border-border/70 bg-card overflow-hidden">
            <div className="border-b border-border/60 p-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Layers className="size-4" />
                Dependencies
              </h2>
              <p className="text-xs text-muted-foreground">
                Required input → provider / owner → waiting department → status → next action
              </p>
            </div>
            {!dependencies.length && (
              <p className="p-4 text-xs text-muted-foreground">
                No explicit dependency links recorded. This does not mean the project has no
                blockers.
              </p>
            )}
            {dependencies.map((d) => (
              <div
                key={`${d.project}:${d.id}`}
                className="border-b border-border/40 p-3 text-xs grid gap-2 md:grid-cols-3"
              >
                <div>
                  <p className="font-mono text-primary">
                    {d.project} · {d.reference}
                  </p>
                  <strong>{d.needed}</strong>
                  <p>
                    {d.provider} / {d.owner} → {d.waiting}
                  </p>
                </div>
                <div>
                  <span
                    className={`rounded border px-2 py-1 ${d.blocked ? "text-amber-600 border-amber-500/30" : "text-emerald-600 border-emerald-500/30"}`}
                  >
                    {d.state}
                  </span>
                  <p className="mt-2">Dependent record: {d.waitingRecord}</p>
                  <p>Milestone: {d.milestone}</p>
                </div>
                <p>{d.nextAction}</p>
              </div>
            ))}
          </section>
          <div className="grid gap-3 lg:grid-cols-2">
            {analyses.map((a) => (
              <article
                key={a.project.id}
                className="rounded-xl border border-border/70 bg-card p-4 space-y-3 text-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-primary">{a.project.reference}</p>
                    <h2 className="text-sm font-semibold">{a.project.title}</h2>
                  </div>
                  <span className="rounded border border-border px-2 py-1">{a.project.status}</span>
                </div>
                <dl className="grid grid-cols-2 gap-3">
                  {[
                    [
                      "Current stage",
                      a.project.fields["currentStage"] ||
                        a.project.fields["lifecycleStage"] ||
                        "Not recorded",
                    ],
                    ["Target", a.project.fields["targetDate"] || "Not recorded"],
                    [
                      "Tasks completed",
                      `${a.tasks.filter((r) => analysisComplete(r.status)).length} / ${a.tasks.length}`,
                    ],
                    ["Linked documents", a.documents.length],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                {a.inputs.filter(record => ["totalPlannedUnits","lotQuantity","acceptedUnits","heldUnits","pendingInspectionUnits","remainingPlannedUnits"].every(key => /^\d+$/.test(record.fields[key] || ""))).map(record => <div key={record.id} className="rounded border border-border p-2 space-y-1">
                  <p className="font-medium">Saved production disposition · {record.reference}</p>
                  <p>{record.fields["acceptedUnits"]} accepted + {record.fields["heldUnits"]} held + {record.fields["pendingInspectionUnits"]} pending inspection = {record.fields["lotQuantity"]} lot units</p>
                  <p>{record.fields["totalPlannedUnits"]} planned · {record.fields["remainingPlannedUnits"]} remaining</p>
                  {(Number(record.fields["acceptedUnits"])+Number(record.fields["heldUnits"])+Number(record.fields["pendingInspectionUnits"]) !== Number(record.fields["lotQuantity"]) || Number(record.fields["totalPlannedUnits"])-Number(record.fields["lotQuantity"]) !== Number(record.fields["remainingPlannedUnits"])) && <p role="alert" className="text-destructive">Source quantities do not reconcile.</p>}
                </div>)}
                {a.project.fields["stageRemark"] && <p className="text-muted-foreground">{a.project.fields["stageRemark"]}</p>}
                {a.project.fields["nextAction"] && <p><strong>Next action:</strong> {a.project.fields["nextAction"]}</p>}
                {savedLifecycleHistory(a.project.fields["stageHistory"]).length > 0 && <details>
                  <summary className="cursor-pointer font-medium">Saved stage history {a.project.fields["fixtureRunId"] ? "· TEST sample" : ""}</summary>
                  <div className="mt-2 space-y-2">{savedLifecycleHistory(a.project.fields["stageHistory"]).map(step => <div key={step.id} className="rounded border border-border/60 p-2 space-y-1">
                    <p className="font-medium">{step.name} · {step.status.replaceAll("_"," ")}</p><p className="text-muted-foreground">{step.startDate}{step.endDate ? ` → ${step.endDate}` : ""}</p><p>{step.remark}</p>{step.nextAction && <p>Next: {step.nextAction}</p>}
                  </div>)}</div>
                </details>}
                {onOpenProject && (
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 hover:bg-secondary"
                    onClick={() => onOpenProject(a.project)}
                  >
                    Open project workspace
                    <ArrowRight className="size-3" />
                  </button>
                )}
              </article>
            ))}
          </div>
          {!analyses.length && (
            <p className="text-sm text-muted-foreground">No permitted projects match this view.</p>
          )}
        </>
      )}
    </div>
  );
}
