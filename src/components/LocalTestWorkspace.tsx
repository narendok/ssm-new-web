import { useEffect, useMemo, useRef, useState } from "react";
import {
  LOCAL_TEST_ENQUIRY_CODE,
  LOCAL_TEST_FEASIBILITY_SHEET_ID,
  LOCAL_TEST_PROJECT_CODE,
  LOCAL_TEST_WORKSPACE_STORAGE_KEY,
  addLocalFeedback,
  addLocalTaskComment,
  allowedLocalTaskTransitions,
  deriveLocalWorkspaceView,
  getLocalDocumentRegister,
  getRepresentativePortfolioCoverage,
  loadLocalTestFixture,
  localDocumentDepartmentFilter,
  localHardwareBudgetSummary,
  reloadLocalTestFixture,
  resetLocalTestFixture,
  reviewLocalFeedback,
  searchLocalDocumentPortfolio,
  saveLocalControlledDocumentDraft,
  selectLocalBinaryArtifactFile,
  toggleLocalTaskSubtask,
  transitionLocalHandoff,
  transitionLocalTask,
  updateLocalBudgetLine,
  updateLocalHardwareRequirement,
  updateLocalTentativeBomLine,
  type LocalTaskStatus,
  type LocalDocumentDraftFields,
  type LocalDocumentRegisterItem,
  type LocalControlledDocumentDraft,
  type LocalBinaryFileSelection,
  type LocalTestWorkspaceState,
} from "@/lib/local-test-workspace";

type Props = {
  onClose: () => void;
  initialSection?: "overview" | "documents";
  initialDepartmentHint?: string;
};

const OVERVIEW = [
  { title: "Enquiry & intake", code: "CM_01" },
  { title: "Feasibility & requirements", code: "CM_02" },
  { title: "Authorized requirement freeze", code: "CM_03" },
  { title: "Conditional HW / FW / SW development", code: "HW_01 · FW_01 · SW_01" },
  { title: "PoC verification", code: "Conditional roadmap phase" },
  { title: "Client demonstration", code: "Conditional roadmap phase" },
  { title: "Closeout", code: "Conditional roadmap phase" },
];

function nowIso() {
  return new Date().toISOString();
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Local TEST workspace operation failed.";
}

function phaseStatus(stageCode: string, activeStageCodes: Set<string>, isFreezeBlocked: boolean) {
  if (activeStageCodes.has(stageCode)) {
    return stageCode === "CM_01" ? "Completed" : "In progress";
  }
  return isFreezeBlocked ? "Blocked · pending freeze" : "Planned";
}

type ControlledDocumentEditorProps = {
  item: LocalDocumentRegisterItem;
  savedDraft?: LocalControlledDocumentDraft | undefined;
  onSave: (fields: LocalDocumentDraftFields) => void;
};

function ControlledDocumentEditor({ item, savedDraft, onSave }: ControlledDocumentEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(savedDraft?.title ?? item.title);
  const [revision, setRevision] = useState(savedDraft?.revision ?? item.revision);
  const [stageExitContext, setStageExitContext] = useState(
    savedDraft?.stageExitContext ?? item.stageExitContext,
  );

  if (!isEditing) {
    return (
      <article className="rounded border border-border p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold">
              {item.department} · {item.stageCode} · {item.dueStatus}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {item.projectCode ?? item.fixtureKey} · {item.stageName}
            </p>
            <p className="mt-1 text-sm font-medium">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">Revision: {revision}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stageExitContext}</p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="rounded border border-border px-2 py-1 text-[10px]">
              Auto-drafted · local only
            </span>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded border border-primary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"
            >
              Edit
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">
            {item.department} · {item.stageCode} · {item.dueStatus}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {item.projectCode ?? item.fixtureKey} · {item.stageName}
          </p>
        </div>
        <span className="rounded border border-border px-2 py-1 text-[10px]">
          Auto-drafted · local only
        </span>
      </div>
      <label className="mt-3 block text-xs font-medium">
        Document title
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-1 block w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        />
      </label>
      <label className="mt-2 block text-xs font-medium">
        Revision
        <input
          value={revision}
          onChange={(event) => setRevision(event.target.value)}
          className="mt-1 block w-28 rounded border border-border bg-background px-2 py-1.5 text-sm"
        />
      </label>
      <label className="mt-2 block text-xs font-medium">
        Stage-exit context / draft notes
        <textarea
          value={stageExitContext}
          onChange={(event) => setStageExitContext(event.target.value)}
          rows={3}
          className="mt-1 block w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            onSave({ title, revision, stageExitContext });
            setIsEditing(false);
          }}
          className="rounded border border-primary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"
        >
          Save Draft
        </button>
        <button
          type="button"
          onClick={() => {
            setTitle(savedDraft?.title ?? item.title);
            setRevision(savedDraft?.revision ?? item.revision);
            setStageExitContext(savedDraft?.stageExitContext ?? item.stageExitContext);
            setIsEditing(false);
          }}
          className="rounded border border-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/5"
        >
          Cancel
        </button>
        <span className="text-[11px] text-muted-foreground">
          {savedDraft
            ? `Draft · ${savedDraft.history.length} local save(s) · ${savedDraft.savedAt}`
            : "Draft · not saved"}
        </span>
      </div>
      {savedDraft && (
        <details className="mt-3 border-t border-border pt-2">
          <summary className="cursor-pointer text-xs font-semibold">
            Local draft history ({savedDraft.history.length})
          </summary>
          <ol className="mt-2 space-y-2">
            {savedDraft.history
              .slice()
              .reverse()
              .map((entry) => (
                <li
                  key={`${savedDraft.id}:${entry.version}`}
                  className="rounded bg-secondary/40 p-2 text-[11px]"
                >
                  <p className="font-semibold">
                    Draft v{entry.version} · {entry.savedAt}
                  </p>
                  <p className="mt-1">
                    {entry.title} · Rev {entry.revision}
                  </p>
                  <p className="mt-1 text-muted-foreground">{entry.stageExitContext}</p>
                </li>
              ))}
          </ol>
        </details>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">
        Saving records editable local draft metadata only; it does not approve, release, freeze, or
        authorize a lifecycle gate.
      </p>
    </article>
  );
}

export function LocalTestWorkspace({
  onClose,
  initialSection = "overview",
  initialDepartmentHint,
}: Props) {
  const [workspace, setWorkspace] = useState<LocalTestWorkspaceState | null>(null);
  const [storageError, setStorageError] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [feedbackResponses, setFeedbackResponses] = useState<Record<string, string>>({});
  const [selectedPortfolioKey, setSelectedPortfolioKey] = useState("active-feasibility");
  const [documentProjectSearch, setDocumentProjectSearch] = useState("");
  const [documentDepartmentFilter, setDocumentDepartmentFilter] = useState(() =>
    localDocumentDepartmentFilter(initialDepartmentHint),
  );
  const documentsSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LOCAL_TEST_WORKSPACE_STORAGE_KEY);
      const saved = raw ? (JSON.parse(raw) as LocalTestWorkspaceState) : null;
      const loaded = loadLocalTestFixture(saved);
      if (!raw) {
        window.localStorage.setItem(LOCAL_TEST_WORKSPACE_STORAGE_KEY, JSON.stringify(loaded));
      }
      setWorkspace(loaded);
    } catch (error) {
      setStorageError(errorText(error));
    }
  }, []);

  useEffect(() => {
    if (initialSection === "documents" && workspace) {
      documentsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [initialSection, workspace]);

  const persist = (next: LocalTestWorkspaceState): boolean => {
    try {
      window.localStorage.setItem(LOCAL_TEST_WORKSPACE_STORAGE_KEY, JSON.stringify(next));
      setWorkspace(next);
      setStorageError("");
      return true;
    } catch (error) {
      setStorageError(errorText(error));
      return false;
    }
  };

  const runLocal = (
    action: (state: LocalTestWorkspaceState) => LocalTestWorkspaceState,
  ): boolean => {
    if (!workspace) return false;
    try {
      return persist(action(workspace));
    } catch (error) {
      setStorageError(errorText(error));
      return false;
    }
  };

  const sampleLoaded = Boolean(
    workspace?.records.some((record) => record.reference === LOCAL_TEST_PROJECT_CODE),
  );
  const project = workspace?.records.find((record) => record.reference === LOCAL_TEST_PROJECT_CODE);
  const enquiry = workspace?.records.find((record) => record.reference === LOCAL_TEST_ENQUIRY_CODE);
  const sheet = workspace?.sheets.find((item) => item.id === LOCAL_TEST_FEASIBILITY_SHEET_ID);
  const view = useMemo(
    () =>
      workspace
        ? deriveLocalWorkspaceView(
            workspace,
            departmentFilter === "All" ? undefined : departmentFilter,
          )
        : null,
    [workspace, departmentFilter],
  );
  const activeStageCodes = new Set(
    view?.lifecycle.stages
      .filter((stage) => ["completed", "ready", "in_progress"].includes(stage.status))
      .map((stage) => stage.stageCode) ?? [],
  );
  const questions = sheet?.custom_parameters ?? [];
  const currentInputValues = sheet?.parameter_values ?? {};
  const scopedTasks = view?.activeTasks ?? [];
  const filteredEvents =
    workspace?.events.filter((event) => event.fixtureKey === workspace.fixtureKey) ?? [];
  const portfolio = workspace ? getRepresentativePortfolioCoverage(workspace) : [];
  const selectedPortfolio = portfolio.find((entry) => entry.key === selectedPortfolioKey);
  const matchingDocumentPortfolio = searchLocalDocumentPortfolio(portfolio, documentProjectSearch);
  const matchingPortfolioKeys = new Set(matchingDocumentPortfolio.map((entry) => entry.key));
  const documentPortfolioOptions = selectedPortfolio
    ? [
        selectedPortfolio,
        ...matchingDocumentPortfolio.filter((entry) => entry.key !== selectedPortfolio.key),
      ]
    : matchingDocumentPortfolio;
  const documentRegister = workspace
    ? getLocalDocumentRegister(
        workspace,
        selectedPortfolioKey,
        documentDepartmentFilter === "All" ? undefined : documentDepartmentFilter,
      )
    : [];
  const controlledDocumentRows = documentRegister.filter(
    (item) => item.kind === "Controlled draft",
  );
  const binaryDocumentRows = documentRegister.filter((item) => item.kind === "Binary artifact");
  const documentStageChecklist = Array.from(
    documentRegister.reduce((stages, item) => {
      const current = stages.get(item.stageCode);
      if (current) {
        current.departments.add(item.department);
        current.deliverableCount += 1;
      } else {
        stages.set(item.stageCode, {
          stageCode: item.stageCode,
          stageName: item.stageName,
          stageStatus: item.stageStatus,
          dueStatus: item.dueStatus,
          departments: new Set([item.department]),
          deliverableCount: 1,
          context: item.stageExitContext,
        });
      }
      return stages;
    }, new Map()),
  ).map(([, stage]) => stage);
  const documentDrafts = new Map(
    (workspace?.documentDrafts ?? []).map((draft) => [draft.id, draft]),
  );
  const binarySelections = new Map(
    (workspace?.binarySelections ?? []).map((selection) => [selection.id, selection]),
  );
  const documentDepartments = Array.from(
    new Set(
      getLocalDocumentRegister(workspace ?? loadLocalTestFixture(), selectedPortfolioKey).map(
        (item) => item.department,
      ),
    ),
  ).sort();
  const hardware = workspace?.hardwareMaster;
  const budget = hardware ? localHardwareBudgetSummary(hardware) : undefined;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded border border-warning/40 bg-warning/10 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-warning">
              TEST WORKSPACE
              <span className="font-normal">· browser-local</span>
            </div>
            <h1 className="mt-2 text-xl font-semibold">Northstar Field Systems · tracker PoC</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Fictional sample · editable test assumptions · no shared or authenticated records
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (!workspace) {
                  try {
                    persist(loadLocalTestFixture());
                  } catch (error) {
                    setStorageError(errorText(error));
                  }
                  return;
                }
                try {
                  persist(reloadLocalTestFixture(workspace, nowIso()));
                } catch (error) {
                  setStorageError(errorText(error));
                }
              }}
              disabled={!workspace}
              className="rounded border border-border px-3 py-2 text-sm hover:bg-secondary"
            >
              {sampleLoaded ? "Reload sample" : "Load sample"}
            </button>
            {sampleLoaded && workspace && (
              <button
                type="button"
                onClick={() => {
                  try {
                    persist(resetLocalTestFixture(workspace));
                  } catch (error) {
                    setStorageError(errorText(error));
                  }
                }}
                className="rounded border border-border px-3 py-2 text-sm hover:bg-secondary"
              >
                Remove this sample
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-border px-3 py-2 text-sm hover:bg-secondary"
            >
              Back to portal
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 pb-12 md:px-8">
        {storageError && (
          <p
            role="alert"
            className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm"
          >
            Local workspace error: {storageError}
          </p>
        )}
        {!workspace ? (
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-semibold">Local sample could not be opened</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              No fallback to shared TEST records was attempted. Resolve the browser-local storage
              issue or reload the sample.
            </p>
          </section>
        ) : !sampleLoaded ? (
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-semibold">Sample removed</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Only this S10 fixture was removed. Unrelated local records and history remain
              untouched.
            </p>
          </section>
        ) : (
          <>
            <section className="grid gap-3 md:grid-cols-4">
              <InfoCard
                label="Enquiry"
                value={enquiry?.reference ?? LOCAL_TEST_ENQUIRY_CODE}
                detail={enquiry?.title ?? ""}
              />
              <InfoCard
                label="Project"
                value={project?.reference ?? LOCAL_TEST_PROJECT_CODE}
                detail={`${project?.title ?? ""} · Android fixture reference ${workspace.androidFixtureReference} (reference only; no sync)`}
              />
              <InfoCard
                label="Feasibility sheet"
                value={sheet?.id ?? LOCAL_TEST_FEASIBILITY_SHEET_ID}
                detail="Draft · pending review"
              />
              <InfoCard
                label="Freeze gate"
                value="UNAPPROVED · UNFROZEN"
                detail="No downstream work is authorized or generated"
              />
            </section>

            <section className="rounded-lg border border-warning/40 bg-warning/5 p-4">
              <h2 className="font-semibold">Local scenario boundary</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                User-provided scenario inputs are limited to a custom vehicle telematics/GPS
                tracker, requested 4G, requested IRNSS/NavIC positioning, and investigating LoRa for
                operation/data exchange without internet. Their relationship is unresolved.
                Assignments, work statuses, comments, handoffs and document rows below are synthetic
                editable test data, not customer confirmation, measurements, certification,
                approval, readiness, or an authorized release.
              </p>
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Existing TEST sample portfolio</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Navigator references the checked-in canonical samples and lifecycle scenarios.
                    It does not duplicate or import those projects into S10 local state. All
                    statuses and feedback are synthetic demo examples.
                  </p>
                </div>
                <span className="rounded border border-warning/40 bg-warning/10 px-2 py-1 text-[11px] font-semibold text-warning">
                  FIXTURE REFERENCE ONLY
                </span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {portfolio.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    aria-pressed={selectedPortfolioKey === entry.key}
                    onClick={() => setSelectedPortfolioKey(entry.key)}
                    className={`rounded border p-3 text-left ${selectedPortfolioKey === entry.key ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"}`}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {entry.fixtureKey} · {entry.origin}
                    </p>
                    <p className="mt-1 text-sm font-semibold">{entry.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {entry.projectCode ? `${entry.projectCode} · ` : "No project · "}
                      {entry.track}
                    </p>
                    <p className="mt-2 text-xs">
                      {entry.phase} · {entry.completedStageCount} complete ·{" "}
                      {entry.inProgressStageCount} active · {entry.activeTaskCount} task(s)
                    </p>
                  </button>
                ))}
              </div>
              {selectedPortfolio && (
                <div className="mt-4 grid gap-4 border-t border-border pt-4 lg:grid-cols-3">
                  <div>
                    <h3 className="text-sm font-semibold">Stage/status distribution</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {selectedPortfolio.status}
                    </p>
                    <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                      {selectedPortfolio.stages.map((stage) => (
                        <li key={`${selectedPortfolio.key}:${stage.code}`} className="text-xs">
                          <span className="font-mono font-semibold">{stage.code}</span> ·{" "}
                          {stage.name} · {stage.status}
                        </li>
                      ))}
                    </ul>
                    {selectedPortfolio.key === "no-project-enquiry" && (
                      <p className="mt-2 text-xs font-semibold text-warning">
                        Enquiry only: no project record or downstream project task is present.
                      </p>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Department tasks</h3>
                    <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                      {selectedPortfolio.tasks.map((task) => (
                        <li key={task.id} className="text-xs leading-5">
                          <span className="font-semibold">{task.department}</span> · {task.status} ·{" "}
                          {task.title}
                        </li>
                      ))}
                      {!selectedPortfolio.tasks.length && (
                        <li className="text-xs text-muted-foreground">
                          No project tasks for this terminal enquiry.
                        </li>
                      )}
                    </ul>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Active departments: {selectedPortfolio.departmentCodes.join(", ") || "none"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Scenario handoffs</h3>
                    <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                      {selectedPortfolio.handoffs.map((handoff) => (
                        <li key={handoff.id} className="text-xs leading-5">
                          <span className="font-semibold">
                            {handoff.provider} → {handoff.waiting}
                          </span>
                          <br />
                          {handoff.title} · {handoff.status}
                        </li>
                      ))}
                      {!selectedPortfolio.handoffs.length && (
                        <li className="text-xs text-muted-foreground">
                          No sample handoff defined.
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Lifecycle overview</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Canonical CM/HW/FW/SW stages are calculated by the lifecycle engine. Later PoC,
                    demo and closeout are conditional roadmap previews.
                  </p>
                </div>
                <span className="rounded border border-warning/40 bg-warning/10 px-2 py-1 text-xs font-semibold text-warning">
                  FEASIBILITY PENDING
                </span>
              </div>
              <ol className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {OVERVIEW.map((phase, index) => {
                  const blocked = index > 1;
                  return (
                    <li key={phase.title} className="rounded border border-border p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Phase {index + 1} · {phase.code}
                      </p>
                      <p className="mt-1 text-sm font-medium">{phase.title}</p>
                      <p
                        className={`mt-2 text-xs ${blocked ? "text-warning" : "text-muted-foreground"}`}
                      >
                        {blocked
                          ? "Blocked · authorized freeze required"
                          : phaseStatus(phase.code, activeStageCodes, false)}
                      </p>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 text-xs text-muted-foreground">
                A completed task or local review does not complete a lifecycle gate. No freeze
                action is available in this local demo.
              </p>
            </section>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,.9fr)]">
              <section className="rounded-lg border border-border bg-card p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">Department feasibility questions</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Values remain blank until reviewed; owners are TBD and all answers are
                      unreviewed.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-warning">Draft / not approved</span>
                </div>
                <div className="space-y-3">
                  {questions.map((question) => {
                    const value = currentInputValues[question.id];
                    return (
                      <article key={question.id} className="rounded border border-border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold">{question.label}</h3>
                          <span className="text-[11px] text-muted-foreground">
                            {question.lead} · owner TBD · unreviewed
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-5 text-muted-foreground">
                          {question.hint}
                        </p>
                        <p className="mt-2 text-xs">
                          Final value:{" "}
                          <span className="text-muted-foreground">
                            {value?.finalValue || "Blank / unanswered"}
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Responses:{" "}
                          {Object.keys(value?.responses ?? {}).length ? "Pending review" : "None"}
                        </p>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-5">
                <div className="rounded-lg border border-border bg-card p-4">
                  <h2 className="font-semibold">Brief inputs and provenance</h2>
                  {sheet && (
                    <div className="mt-3 space-y-3">
                      {["use_case", "cellular", "gnss", "special"].map((id) => {
                        const value = sheet.parameter_values[id];
                        return (
                          <div key={id} className="border-t border-border pt-3">
                            <p className="text-xs font-semibold uppercase">
                              {id.replace("_", " ")}
                            </p>
                            <p className="mt-1 text-sm leading-5">{value?.input || "Blank"}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {value?.source || "No source recorded"} · final value remains blank
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">
                    Unspecified performance, power, enclosure, volume, cost, certification and
                    acceptance details remain unknown.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">Work by department</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Only current CM_01 / CM_02 tasks are interactive.
                      </p>
                    </div>
                    <label className="text-xs">
                      Department
                      <select
                        value={departmentFilter}
                        onChange={(event) => setDepartmentFilter(event.target.value)}
                        className="ml-2 rounded border border-border bg-background px-2 py-1 text-sm"
                      >
                        <option>All</option>
                        {workspace.departments.map((department) => (
                          <option key={department.id} value={department.code}>
                            {department.code}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="mt-3 space-y-3">
                    {scopedTasks.map((task) => (
                      <article key={task.id} className="rounded border border-border p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground">
                              {task.department} · {task.stageCode} · {task.assignee} (sample role)
                            </p>
                            <h3 className="mt-1 text-sm font-semibold">{task.title}</h3>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {task.description}
                            </p>
                          </div>
                          <label className="text-xs">
                            Status
                            <select
                              value={task.status}
                              onChange={(event) =>
                                runLocal((state) =>
                                  transitionLocalTask(
                                    state,
                                    task.id,
                                    event.target.value as LocalTaskStatus,
                                    "Local demo participant",
                                    nowIso(),
                                  ),
                                )
                              }
                              className="ml-2 rounded border border-border bg-background px-2 py-1"
                            >
                              <option value={task.status}>{task.status.replace("_", " ")}</option>
                              {allowedLocalTaskTransitions(task.status).map((next) => (
                                <option key={next} value={next}>
                                  {next.replace("_", " ")}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="mt-3 space-y-2 border-t border-border pt-3">
                          {task.subtasks.map((subtask) => (
                            <label key={subtask.id} className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={subtask.done}
                                onChange={() =>
                                  runLocal((state) =>
                                    toggleLocalTaskSubtask(
                                      state,
                                      task.id,
                                      subtask.id,
                                      "Local demo participant",
                                      nowIso(),
                                    ),
                                  )
                                }
                              />
                              {subtask.label}
                            </label>
                          ))}
                        </div>
                        <div className="mt-3 space-y-2 border-t border-border pt-3">
                          {task.comments.map((comment) => (
                            <p key={comment.id} className="text-xs leading-5 text-muted-foreground">
                              <span className="font-semibold text-foreground">
                                {comment.author}:
                              </span>{" "}
                              {comment.body}
                            </p>
                          ))}
                          <div className="flex gap-2">
                            <input
                              value={commentDrafts[task.id] ?? ""}
                              onChange={(event) =>
                                setCommentDrafts((drafts) => ({
                                  ...drafts,
                                  [task.id]: event.target.value,
                                }))
                              }
                              aria-label={`Review comment for ${task.title}`}
                              placeholder="Add a local review comment"
                              className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1.5 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const body = commentDrafts[task.id] ?? "";
                                const saved = runLocal((state) =>
                                  addLocalTaskComment(
                                    state,
                                    task.id,
                                    body,
                                    "Local demo participant",
                                    nowIso(),
                                  ),
                                );
                                if (saved) {
                                  setCommentDrafts((drafts) => ({ ...drafts, [task.id]: "" }));
                                }
                              }}
                              className="rounded border border-border px-2 py-1 text-xs hover:bg-secondary"
                            >
                              Add note
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                    {!scopedTasks.length && (
                      <p className="rounded border border-dashed border-border p-3 text-sm text-muted-foreground">
                        No active work is assigned to this department in the current feasibility
                        stages.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <h2 className="font-semibold">Future planned work · preview only</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Canonical task templates are displayed as ungenerated previews. No downstream
                    task rows, engineering assignments, or production work are created before an
                    explicit authorized freeze.
                  </p>
                  <div className="mt-3 space-y-2">
                    {(view?.plannedTaskPreviews ?? []).map((task) => (
                      <p key={task.id} className="rounded border border-border px-3 py-2 text-xs">
                        <span className="font-semibold">
                          {task.stageCode} · {task.department}
                        </span>{" "}
                        · {task.title}
                      </p>
                    ))}
                    <p className="rounded border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                      PoC verification → client demo → closeout remain conditional roadmap phases;
                      no tasks or evidence are present.
                    </p>
                  </div>
                  <p className="mt-3 text-xs font-semibold text-warning">
                    {view?.downstreamTaskGenerationBlocked
                      ? "Downstream generation blocked by pending, unapproved, unfrozen feasibility."
                      : "Check lifecycle gate state before any work proceeds."}
                  </p>
                </div>
              </section>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-lg border border-border bg-card p-4">
                <h2 className="font-semibold">Department handoffs</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Local review-request/return actions only. No handoff action accepts a gate.
                </p>
                <div className="mt-3 space-y-3">
                  {workspace.handoffs.map((handoff) => (
                    <article key={handoff.id} className="rounded border border-border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold">
                            {handoff.fromDepartment} → {handoff.toDepartment}
                          </p>
                          <h3 className="mt-1 text-sm font-semibold">{handoff.title}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">{handoff.note}</p>
                        </div>
                        <span className="rounded border border-border px-2 py-1 text-[11px]">
                          {handoff.status}
                        </span>
                      </div>
                      {handoff.requiresFreeze ? (
                        <p className="mt-2 text-xs text-warning">
                          Blocked until authorized freeze; local action disabled.
                        </p>
                      ) : (
                        <div className="mt-3 flex gap-2">
                          {handoff.status !== "Awaiting review" && (
                            <button
                              type="button"
                              onClick={() =>
                                runLocal((state) =>
                                  transitionLocalHandoff(
                                    state,
                                    handoff.id,
                                    "Awaiting review",
                                    "Local demo participant",
                                    nowIso(),
                                  ),
                                )
                              }
                              className="rounded border border-border px-2 py-1 text-xs hover:bg-secondary"
                            >
                              Request local review
                            </button>
                          )}
                          {handoff.status === "Awaiting review" && (
                            <button
                              type="button"
                              onClick={() =>
                                runLocal((state) =>
                                  transitionLocalHandoff(
                                    state,
                                    handoff.id,
                                    "Returned with questions",
                                    "Local demo participant",
                                    nowIso(),
                                  ),
                                )
                              }
                              className="rounded border border-border px-2 py-1 text-xs hover:bg-secondary"
                            >
                              Return with questions
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-border bg-card p-4">
                <h2 className="font-semibold">Internal demo feedback loop</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  These are local tester notes, not customer communications or customer-change
                  requests.
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    value={feedbackDraft}
                    onChange={(event) => setFeedbackDraft(event.target.value)}
                    aria-label="Internal demo feedback"
                    placeholder="Record a local scenario review note"
                    className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    disabled={!scopedTasks[0]}
                    onClick={() => {
                      const taskId = scopedTasks[0]?.id;
                      if (!taskId) return;
                      const saved = runLocal((state) =>
                        addLocalFeedback(
                          state,
                          taskId,
                          feedbackDraft,
                          "Local demo participant",
                          nowIso(),
                        ),
                      );
                      if (saved) setFeedbackDraft("");
                    }}
                    className="rounded border border-border px-2 py-1 text-xs hover:bg-secondary disabled:opacity-50"
                  >
                    Record note
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  {workspace.feedback.map((item) => (
                    <article key={item.id} className="rounded border border-border p-3">
                      <p className="text-[11px] text-muted-foreground">
                        {item.author} · {item.status}
                      </p>
                      <p className="mt-1 text-sm">{item.body}</p>
                      {item.status === "Open" ? (
                        <div className="mt-2 flex gap-2">
                          <input
                            value={feedbackResponses[item.id] ?? ""}
                            onChange={(event) =>
                              setFeedbackResponses((responses) => ({
                                ...responses,
                                [item.id]: event.target.value,
                              }))
                            }
                            aria-label="Local feedback review response"
                            placeholder="Add a local review response"
                            className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              runLocal((state) =>
                                reviewLocalFeedback(
                                  state,
                                  item.id,
                                  feedbackResponses[item.id] ?? "",
                                  "Local demo participant",
                                  nowIso(),
                                ),
                              )
                            }
                            className="rounded border border-border px-2 py-1 text-xs hover:bg-secondary"
                          >
                            Note locally
                          </button>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Local response: {item.response}
                        </p>
                      )}
                    </article>
                  ))}
                  {!workspace.feedback.length && (
                    <p className="rounded border border-dashed border-border p-3 text-xs text-muted-foreground">
                      No customer feedback is present. Use internal notes only to exercise this
                      review loop.
                    </p>
                  )}
                </div>
              </section>
            </div>

            {hardware && budget && (
              <section className="space-y-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      EHW hardware master data · {LOCAL_TEST_PROJECT_CODE}
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Browser-local draft planning only. No inventory quantity is reserved or
                      changed, and no part, design, budget, or project configuration is approved.
                    </p>
                  </div>
                  <span className="rounded border border-warning/40 bg-warning/10 px-2 py-1 text-[11px] font-semibold text-warning">
                    DRAFT · UNAPPROVED · UNFROZEN
                  </span>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  <section className="rounded-lg border border-border bg-card p-4">
                    <h3 className="font-semibold">Requirements & provenance</h3>
                    <div className="mt-3 space-y-3">
                      {hardware.requirements.map((requirement) => (
                        <article key={requirement.id} className="rounded border border-border p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-sm font-semibold">{requirement.label}</h4>
                            <span
                              className={`text-[10px] font-semibold ${requirement.provenance === "user_brief" ? "text-primary" : "text-warning"}`}
                            >
                              {requirement.provenance === "user_brief"
                                ? "USER-PROVIDED BRIEF"
                                : "TEST ASSUMPTION"}
                            </span>
                          </div>
                          {requirement.provenance === "fixture_assumption" ? (
                            <DraftTextField
                              label={`Editable assumption: ${requirement.label}`}
                              value={requirement.value}
                              onSave={(value) =>
                                runLocal((state) =>
                                  updateLocalHardwareRequirement(
                                    state,
                                    requirement.id,
                                    value,
                                    "Local demo participant",
                                    nowIso(),
                                  ),
                                )
                              }
                            />
                          ) : (
                            <p className="mt-2 text-sm leading-5">{requirement.value}</p>
                          )}
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            Source: {requirement.source} · {requirement.decisionStatus}
                          </p>
                        </article>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      User brief facts are read-only source references here. Only explicitly marked
                      test assumptions are editable; editing does not write into the feasibility
                      sheet or approve/freeze a value.
                    </p>
                  </section>

                  <section className="rounded-lg border border-border bg-card p-4">
                    <h3 className="font-semibold">Reusable hardware assets</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Candidate library references, not selected or linked to a released design.
                    </p>
                    <div className="mt-3 space-y-3">
                      {hardware.assets.map((asset) => (
                        <article key={asset.id} className="rounded border border-border p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-[11px] font-mono text-muted-foreground">
                                {asset.code} · Rev {asset.revision} · {asset.kind}
                              </p>
                              <h4 className="mt-1 text-sm font-semibold">{asset.title}</h4>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Asset ID: {asset.id} · Project: {asset.projectId} · {asset.status}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-2">
                            <p className="text-xs">
                              <span className="font-semibold">Asset certificate metadata:</span>
                              <br />
                              {asset.certificateMetadata.status}; reference/issuer not recorded.
                            </p>
                            <p className="text-xs">
                              <span className="font-semibold">
                                Project-configuration certification:
                              </span>
                              <br />
                              {asset.projectConfigurationCertification.status} ·{" "}
                              {asset.projectConfigurationCertification.note}
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,.8fr)]">
                  <section className="rounded-lg border border-border bg-card p-4">
                    <h3 className="font-semibold">Tentative BOM · linked inventory references</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Each line references an existing local demo inventory item ID. Quantities and
                      costs are editable spreadsheet assumptions only; supplier and lead-time are
                      blank because no verified values are available. No allocation, purchase, or
                      inventory mutation occurs.
                    </p>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[780px] border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground">
                            <th className="p-2">Inventory link / item</th>
                            <th className="p-2">Qty</th>
                            <th className="p-2">Est. unit USD</th>
                            <th className="p-2">Supplier (unverified)</th>
                            <th className="p-2">Lead time (weeks)</th>
                            <th className="p-2">Extended estimate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hardware.tentativeBom.map((line) => (
                            <tr key={line.id} className="border-b border-border/70 align-top">
                              <td className="p-2">
                                <span className="font-mono font-semibold">
                                  {line.inventoryItemId}
                                </span>
                                <br />
                                <span className="text-muted-foreground">
                                  {line.itemDescription}
                                </span>
                                <br />
                                <span className="text-[10px] text-warning">
                                  {line.approvalStatus}
                                </span>
                              </td>
                              <td className="p-2">
                                <DraftNumberField
                                  label={`Quantity for ${line.inventoryItemId}`}
                                  value={line.quantity}
                                  min={1}
                                  step={1}
                                  onSave={(quantity) =>
                                    runLocal((state) =>
                                      updateLocalTentativeBomLine(
                                        state,
                                        line.id,
                                        { quantity },
                                        "Local demo participant",
                                        nowIso(),
                                      ),
                                    )
                                  }
                                />
                                <span className="ml-1">{line.unit}</span>
                              </td>
                              <td className="p-2">
                                <DraftNumberField
                                  label={`Estimated unit cost for ${line.inventoryItemId}`}
                                  value={line.estimatedUnitCostUsd}
                                  min={0}
                                  step={0.01}
                                  onSave={(estimatedUnitCostUsd) =>
                                    runLocal((state) =>
                                      updateLocalTentativeBomLine(
                                        state,
                                        line.id,
                                        { estimatedUnitCostUsd },
                                        "Local demo participant",
                                        nowIso(),
                                      ),
                                    )
                                  }
                                />
                                <span className="block text-[10px] text-warning">
                                  estimate only
                                </span>
                              </td>
                              <td className="p-2">
                                <DraftTextField
                                  label={`Supplier note for ${line.inventoryItemId}`}
                                  value={line.supplier}
                                  placeholder="Not recorded"
                                  compact
                                  onSave={(supplier) =>
                                    runLocal((state) =>
                                      updateLocalTentativeBomLine(
                                        state,
                                        line.id,
                                        { supplier },
                                        "Local demo participant",
                                        nowIso(),
                                      ),
                                    )
                                  }
                                />
                              </td>
                              <td className="p-2">
                                <DraftTextField
                                  label={`Lead-time note for ${line.inventoryItemId}`}
                                  value={line.leadTimeWeeks}
                                  placeholder="Not recorded"
                                  compact
                                  onSave={(leadTimeWeeks) =>
                                    runLocal((state) =>
                                      updateLocalTentativeBomLine(
                                        state,
                                        line.id,
                                        { leadTimeWeeks },
                                        "Local demo participant",
                                        nowIso(),
                                      ),
                                    )
                                  }
                                />
                              </td>
                              <td className="p-2 font-mono">
                                ${(line.quantity * line.estimatedUnitCostUsd).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="rounded-lg border border-border bg-card p-4">
                    <h3 className="font-semibold">Transparent planning budget</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Illustrative local planning worksheet in USD, not a quotation, customer
                      target, committed cost, or authorized spend.
                    </p>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt>Tentative BOM subtotal</dt>
                        <dd className="font-mono">${budget.tentativeBomSubtotal.toFixed(2)}</dd>
                      </div>
                    </dl>
                    <div className="mt-3 space-y-3 border-t border-border pt-3">
                      {hardware.budgetLines.map((line) => (
                        <div
                          key={line.id}
                          className="grid grid-cols-[1fr_auto] items-center gap-2 text-xs"
                        >
                          <div>
                            <p className="font-semibold">{line.category}</p>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {line.estimateNote}
                            </p>
                          </div>
                          <DraftNumberField
                            label={`Estimated USD amount for ${line.category}`}
                            value={line.amountUsd}
                            min={0}
                            step={1}
                            onSave={(amountUsd) =>
                              runLocal((state) =>
                                updateLocalBudgetLine(
                                  state,
                                  line.id,
                                  amountUsd,
                                  "Local demo participant",
                                  nowIso(),
                                ),
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <dl className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt>Allowances subtotal</dt>
                        <dd className="font-mono">${budget.allowancesSubtotal.toFixed(2)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Subtotal</dt>
                        <dd className="font-mono">${budget.subtotal.toFixed(2)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Fixture contingency assumption ({hardware.contingencyPercent}%)</dt>
                        <dd className="font-mono">${budget.contingency.toFixed(2)}</dd>
                      </div>
                      <div className="flex justify-between gap-3 border-t border-border pt-2 font-semibold">
                        <dt>Illustrative planning total · unapproved</dt>
                        <dd className="font-mono">${budget.estimatedPlanningTotal.toFixed(2)}</dd>
                      </div>
                    </dl>
                  </section>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  <section className="rounded-lg border border-border bg-card p-4">
                    <h3 className="font-semibold">Editable draft records</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Generated local records are drafts, not uploaded binary deliverables.
                    </p>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {hardware.draftRecords.map((record) => (
                        <li key={record.id} className="rounded border border-border p-3 text-xs">
                          <p className="font-semibold">
                            {record.kind} · {record.title}
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            {record.id} · Rev {record.revision} · {record.status} · Project{" "}
                            {record.projectId}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="rounded-lg border border-border bg-card p-4">
                    <h3 className="font-semibold">Binary deliverables</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      S10 binary catalog only. Use Documents for optional local file selection;
                      selected metadata is unshared, and no server upload, storage URL, signature,
                      or release state is created.
                    </p>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {hardware.binaryDeliverables.map((item) => (
                        <li
                          key={item.id}
                          className="rounded border border-dashed border-border p-3 text-xs"
                        >
                          <p className="font-semibold">
                            {item.kind} · {item.title}
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            {workspace.binarySelections.find(
                              (selection) => selection.id === item.id,
                            )?.storageState ?? item.status}{" "}
                            · {item.id}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              </section>
            )}

            <section
              ref={documentsSectionRef}
              id="local-test-documents-register"
              className="scroll-mt-24 rounded-lg border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Documents · local project register</h2>
                  <p className="mt-1 max-w-4xl text-xs leading-5 text-muted-foreground">
                    Uses existing portfolio fixture IDs; no project records are copied into this
                    register. Drafts and selected-file metadata remain in this browser-local TEST
                    workspace. File selection is not a server upload, shared document, download, or
                    release.
                  </p>
                </div>
                <span className="rounded border border-warning/40 bg-warning/10 px-2 py-1 text-[10px] font-semibold text-warning">
                  LOCAL · UNSHARED
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="text-xs font-medium">
                  Find a project or enquiry
                  <input
                    type="search"
                    value={documentProjectSearch}
                    onChange={(event) => setDocumentProjectSearch(event.target.value)}
                    placeholder="Fixture, project code, track, department…"
                    aria-label="Search project or enquiry fixtures"
                    className="mt-1 block min-w-64 rounded border border-border bg-background px-2 py-1.5 text-sm"
                  />
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {matchingDocumentPortfolio.length} matching fixture(s)
                  </span>
                </label>
                <label className="text-xs font-medium">
                  Project / enquiry fixture
                  <select
                    value={selectedPortfolioKey}
                    onChange={(event) => setSelectedPortfolioKey(event.target.value)}
                    className="mt-1 block min-w-64 rounded border border-border bg-background px-2 py-1.5 text-sm"
                  >
                    {documentPortfolioOptions.map((entry) => (
                      <option key={entry.key} value={entry.key}>
                        {entry.fixtureKey} · {entry.projectCode ?? entry.enquiryCode} ·{" "}
                        {entry.title}
                        {entry.key === selectedPortfolioKey &&
                        documentProjectSearch.trim() &&
                        !matchingPortfolioKeys.has(entry.key)
                          ? " · current selection"
                          : ""}
                      </option>
                    ))}
                  </select>
                  {documentProjectSearch.trim() && matchingDocumentPortfolio.length === 0 && (
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      No other fixture matches; the current selection stays available.
                    </span>
                  )}
                </label>
                <label className="text-xs font-medium">
                  Department · local view filter
                  <select
                    value={documentDepartmentFilter}
                    onChange={(event) => setDocumentDepartmentFilter(event.target.value)}
                    className="mt-1 block min-w-40 rounded border border-border bg-background px-2 py-1.5 text-sm"
                  >
                    <option value="All">All departments</option>
                    {documentDepartments.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="max-w-xl text-[11px] leading-4 text-muted-foreground">
                  Selected local display filter:{" "}
                  <span className="font-semibold">
                    {documentDepartmentFilter === "All"
                      ? "All departments"
                      : documentDepartmentFilter}
                  </span>
                  . This filter only changes which fictional register rows are shown; it is not
                  authorization and does not change access to shared records.
                </p>
              </div>
              {selectedPortfolio && (
                <div className="mt-3 rounded border border-border bg-secondary/30 p-3 text-xs">
                  <p className="font-semibold">
                    {selectedPortfolio.fixtureKey} ·{" "}
                    {selectedPortfolio.projectCode ?? "No project record"}
                    {selectedPortfolio.enquiryCode
                      ? ` · Enquiry ${selectedPortfolio.enquiryCode}`
                      : ""}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {selectedPortfolio.title} · Track: {selectedPortfolio.track} ·{" "}
                    {selectedPortfolio.status}
                  </p>
                </div>
              )}
              <section className="mt-4 rounded border border-border p-3">
                <h3 className="text-sm font-semibold">Stage-exit checklist · selected fixture</h3>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  View-only lifecycle context from the selected local sample and current department
                  filter; document metadata does not complete a stage.
                </p>
                {documentStageChecklist.length ? (
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {documentStageChecklist.map((stage) => (
                      <li
                        key={`${selectedPortfolioKey}:${stage.stageCode}`}
                        className="rounded bg-secondary/30 p-2 text-xs"
                      >
                        <p className="font-semibold">
                          {stage.stageCode} · {stage.stageName}
                        </p>
                        <p className="mt-1">
                          {stage.dueStatus} · owner: {[...stage.departments].join(", ")} ·{" "}
                          {stage.deliverableCount} listed item(s)
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{stage.context}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    No stage-exit items match this department filter.
                  </p>
                )}
              </section>

              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <section aria-labelledby="controlled-drafts-heading">
                  <h3 id="controlled-drafts-heading" className="font-semibold">
                    Auto-drafted controlled-document records
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Editable metadata and stage-exit notes; separate from external binary files.
                  </p>
                  <div className="mt-3 space-y-3">
                    {controlledDocumentRows.map((item) => {
                      const savedDraft = documentDrafts.get(item.id);
                      return (
                        <ControlledDocumentEditor
                          key={`${item.id}:${savedDraft?.history.length ?? 0}`}
                          item={item}
                          savedDraft={savedDraft}
                          onSave={(fields) =>
                            runLocal((state) =>
                              saveLocalControlledDocumentDraft(
                                state,
                                selectedPortfolioKey,
                                item.id,
                                fields,
                                "Local demo participant",
                                nowIso(),
                              ),
                            )
                          }
                        />
                      );
                    })}
                    {!controlledDocumentRows.length && (
                      <p className="rounded border border-dashed border-border p-3 text-xs text-muted-foreground">
                        No controlled-document rows match this department filter.
                      </p>
                    )}
                  </div>
                </section>

                <section aria-labelledby="binary-artifacts-heading">
                  <h3 id="binary-artifacts-heading" className="font-semibold">
                    Externally authored binary artifacts
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Schematic, Gerber, STEP/drawings, firmware, executed test evidence and
                    certification-report placeholders are separate from draft records. Use the
                    picker to select a local file; only filename and file metadata are retained in
                    browser storage. File bytes are not uploaded or saved.
                  </p>
                  <div className="mt-3 space-y-3">
                    {binaryDocumentRows.map((item) => {
                      const selection = binarySelections.get(item.id);
                      const inputId = `local-binary-file-${item.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
                      return (
                        <article
                          key={item.id}
                          className="rounded border border-dashed border-border p-3"
                        >
                          <p className="text-xs font-semibold">
                            {item.department} · {item.stageCode} · {item.dueStatus}
                          </p>
                          <p className="mt-1 text-sm font-medium">{item.title}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {item.projectCode ?? item.fixtureKey} · {item.stageName}
                          </p>
                          {item.title.toLowerCase().includes("certification") && (
                            <p className="mt-1 text-[11px] text-warning">
                              Project-configuration evidence only; reusable-asset certificate
                              metadata is maintained separately. Applicability is not assessed.
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <label
                              htmlFor={inputId}
                              className="cursor-pointer rounded border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                            >
                              Upload / Select File
                            </label>
                            <input
                              id={inputId}
                              type="file"
                              className="sr-only"
                              aria-label={`Select local file for ${item.title}`}
                              onChange={(event) => {
                                const file = event.currentTarget.files?.[0];
                                if (file) {
                                  runLocal((state) =>
                                    selectLocalBinaryArtifactFile(
                                      state,
                                      selectedPortfolioKey,
                                      item.id,
                                      {
                                        name: file.name,
                                        size: file.size,
                                        type: file.type,
                                        lastModified: file.lastModified,
                                      },
                                      "Local demo participant",
                                      nowIso(),
                                    ),
                                  );
                                }
                                event.currentTarget.value = "";
                              }}
                            />
                            <span className="text-[11px] text-muted-foreground">
                              {selection
                                ? `${selection.fileName} · ${selection.sizeBytes} bytes · selected locally, not uploaded/shared`
                                : "Not selected · no file attached"}
                            </span>
                          </div>
                          <p className="mt-2 text-[10px] text-muted-foreground">
                            No server storage URL, signature, release, or authorized download is
                            created.
                          </p>
                        </article>
                      );
                    })}
                    {!binaryDocumentRows.length && (
                      <p className="rounded border border-dashed border-border p-3 text-xs text-muted-foreground">
                        This enquiry/track has no binary project artifact due in its represented
                        lifecycle. No project or downstream deliverable is created.
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-lg border border-border bg-card p-4">
                <h2 className="font-semibold">Fictional department roster & local history</h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {workspace.departments.map((department) => (
                    <p key={department.id} className="rounded border border-border p-2 text-xs">
                      <span className="font-semibold">{department.code}</span> · {department.name}
                      <br />
                      {department.lead} · sample assignee, not an account
                    </p>
                  ))}
                </div>
                <div className="mt-4 border-t border-border pt-3">
                  <h3 className="text-sm font-semibold">Local history</h3>
                  <ul className="mt-2 space-y-2">
                    {filteredEvents
                      .slice()
                      .reverse()
                      .map((event) => (
                        <li key={event.id} className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{event.action}</span> ·{" "}
                          {event.detail}
                        </li>
                      ))}
                  </ul>
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function InfoCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-all font-mono text-sm font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function DraftTextField({
  label,
  value,
  placeholder,
  compact = false,
  onSave,
}: {
  label: string;
  value: string;
  placeholder?: string;
  compact?: boolean;
  onSave: (value: string) => boolean;
}) {
  return (
    <input
      type="text"
      aria-label={label}
      defaultValue={value}
      placeholder={placeholder}
      onBlur={(event) => {
        const next = event.currentTarget.value;
        if (next !== value && !onSave(next)) event.currentTarget.value = value;
      }}
      className={`mt-2 w-full rounded border border-border bg-background px-2 py-1.5 ${compact ? "max-w-36" : "text-sm"}`}
    />
  );
}

function DraftNumberField({
  label,
  value,
  min,
  step,
  onSave,
}: {
  label: string;
  value: number;
  min: number;
  step: number;
  onSave: (value: number) => boolean;
}) {
  return (
    <input
      type="number"
      aria-label={label}
      defaultValue={value}
      min={min}
      step={step}
      onBlur={(event) => {
        const next = Number(event.currentTarget.value);
        if (!Number.isFinite(next) || next < min) {
          event.currentTarget.value = String(value);
          return;
        }
        if (next !== value && !onSave(next)) event.currentTarget.value = String(value);
      }}
      className="w-24 rounded border border-border bg-background px-2 py-1.5 font-mono"
    />
  );
}
