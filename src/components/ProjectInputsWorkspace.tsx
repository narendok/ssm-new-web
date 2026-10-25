import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { changedInputDrafts, readInputDraft } from "@/lib/project-input-drafts";
import { useServerFn } from "@tanstack/react-start";
import { getProjectInputs, mutateProjectInputs } from "@/lib/project-inputs.functions";
import { getSharedTestWorkspace } from "@/lib/shared-test.functions";
import {
  PROJECT_INPUT_PARAMETERS,
  FEASIBILITY_STATES,
  inputReadiness,
  type InputSheet,
  type ParameterValue,
  type ParameterResponse,
} from "@/lib/project-inputs";
import type { TestMembership } from "@/lib/test-auth.functions";
import type { AnalysisRecord } from "@/lib/project-analysis-data";
import { SharedMasterSelect } from "./SharedMasterSelect";
import { SmartParameterField } from "./SmartParameterField";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
const field = "w-full rounded border border-input bg-background p-2 text-xs";
const emptyRow: ParameterValue = {
  input: "",
  source: "",
  finalValue: "",
  required: true,
  responses: {},
};
const emptyResponse: ParameterResponse = {
  status: "Pending",
  remarks: "",
  evidence: "",
  ownerId: "",
  dueDate: "",
  authorId: "",
  reviewedBy: "",
};
type Action =
  | "create"
  | "input"
  | "respond"
  | "review_response"
  | "approve"
  | "revise"
  | "client_evidence"
  | "link_project"
  | "assign_owner"
  | "add_parameter";
function inferScope(source: AnalysisRecord | undefined): "Client" | "Internal" {
  if (!source) return "Client";
  if (source.type === "Enquiry" || source.type === "Opportunity") return "Client";
  const marker = [
    source.fields["projectType"],
    source.fields["projectOrigin"],
    source.fields["scopeType"],
    source.fields["classification"],
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/internal|in.house|company project/.test(marker)) return "Internal";
  if (/client|external/.test(marker)) return "Client";
  if ([source.fields["customer"], source.fields["customerName"], source.fields["client"], source.fields["clientName"]].some((value) => Boolean(value?.trim()))) return "Client";
  return "Client";
}
export function ProjectInputsWorkspace({
  membership,
  sources,
  initialSourceId,
}: {
  membership: TestMembership;
  sources: AnalysisRecord[];
  initialSourceId?: string | undefined;
}) {
  const load = useServerFn(getProjectInputs),
    write = useServerFn(mutateProjectInputs),
    loadMembers = useServerFn(getSharedTestWorkspace);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["project-inputs", membership.organizationId, membership.membershipId],
    queryFn: () => load(),
    refetchInterval: 15000,
  });
  const people = useQuery({
    queryKey: ["shared-test-workspace", membership.organizationId, membership.membershipId],
    queryFn: () => loadMembers(),
  });
  const [sourceId, setSourceId] = useState(
    initialSourceId && initialSourceId !== "all" ? initialSourceId : "",
  );
  const [scope, setScope] = useState<"Client" | "Internal">(() =>
    inferScope(sources.find((source) => source.id === initialSourceId)),
  ),
    [filter, setFilter] = useState(""),
    [section, setSection] = useState("All");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [newQuestion, setNewQuestion] = useState(false),
    [questionLabel, setQuestionLabel] = useState(""),
    [questionHint, setQuestionHint] = useState(""),
    [questionReviewers, setQuestionReviewers] = useState<string[]>([]);
  const [reason, setReason] = useState(""),
    [clientEvidence, setClientEvidence] = useState(""),
    [linkId, setLinkId] = useState("");
  const [departmentView, setDepartmentView] = useState("All");
  const [quickInputsDraft, setQuickInputsDraft] = useState<Record<string, { input: string; source: string; finalValue: string }>>({});
  const [inputDraftDirty, setInputDraftDirty] = useState(false);
  const [autoSavePaused, setAutoSavePaused] = useState(false);
  const [draftRecoveryError, setDraftRecoveryError] = useState("");
  const inputEditGeneration = useRef(0);
  const inputSaveInFlight = useRef(false);
  const [assessmentDrafts, setAssessmentDrafts] = useState<Record<string, ParameterResponse>>({});
  const [assessmentDraftDirty, setAssessmentDraftDirty] = useState(false);
  const inputDraftSheetId = useRef("");
  const assessmentDraftScope = useRef("");
  const sheet = query.data?.sheets.find(
    (s) => s.source_record_id === sourceId || s.project_record_id === sourceId,
  );
  const savedSheets = (query.data?.sheets || []).filter((saved) => {
    if (sourceId && saved.source_record_id !== sourceId && saved.project_record_id !== sourceId) return false;
    const source = sources.find((record) => record.id === saved.source_record_id || record.id === saved.project_record_id);
    return !filter || `${source?.reference || ""} ${source?.title || ""} ${saved.scope} ${saved.status}`.toLowerCase().includes(filter.toLowerCase());
  });
  const availableSources = sources.filter((record) => {
    if (!["Project", "Enquiry", "Opportunity"].includes(record.type)) return false;
    if (sourceId && record.id !== sourceId) return false;
    const exists = (query.data?.sheets || []).some((saved) => saved.source_record_id === record.id || saved.project_record_id === record.id);
    return !exists && `${record.reference} ${record.title} ${record.fields["customer"] || record.fields["client"] || ""}`.toLowerCase().includes(filter.toLowerCase());
  });
  const portfolioTotals = savedSheets.reduce(
    (totals, saved) => {
      const readiness = inputReadiness(saved.parameter_values, [...PROJECT_INPUT_PARAMETERS, ...saved.custom_parameters]);
      return {
        ready: totals.ready + readiness.ready,
        missing: totals.missing + readiness.missing,
        pending: totals.pending + readiness.pending,
        blocked: totals.blocked + readiness.blocked,
      };
    },
    { ready: 0, missing: 0, pending: 0, blocked: 0 },
  );
  const inputOwner =
    !!sheet && (sheet.input_owner_id === membership.membershipId || membership.role === "admin");
  const editable = sheet?.status === "Draft";
  const dept = membership.departmentCode || "";
  const members =
    people.data?.members.filter(
      (m) => m.department_id === people.data?.departments.find((d) => d.code === dept)?.id,
    ) || [];
  const parameters = [...PROJECT_INPUT_PARAMETERS, ...(sheet?.custom_parameters || [])];
  const draftKey = sheet ? `ssm:input-draft:${membership.organizationId}:${membership.membershipId}:${sheet.id}` : "";
  const draftMatchesSheet = !!sheet && inputDraftSheetId.current === sheet.id;
  useEffect(() => {
    if (!sheet) {
      inputDraftSheetId.current = "";
      setQuickInputsDraft({});
      return;
    }
    const sheetChanged = inputDraftSheetId.current !== sheet.id;
    if (!sheetChanged && inputDraftDirty) return;
    inputDraftSheetId.current = sheet.id;
    const savedValues = Object.fromEntries(parameters.map((p) => {
      const value = sheet.parameter_values[p.id] || emptyRow;
      return [p.id, { input: value.input || "", source: value.source || "", finalValue: value.finalValue || "" }];
    }));
    let recovered: ReturnType<typeof readInputDraft>;
    if (sheetChanged && editable && inputOwner) {
      try { recovered = readInputDraft(localStorage.getItem(draftKey), sheet.revision); } catch { /* Storage can be disabled. */ }
    }
    const recoveredValues = Object.fromEntries(Object.entries(recovered?.values || {}).filter(([id]) => parameters.some(p => p.id === id)));
    setQuickInputsDraft({ ...savedValues, ...recoveredValues });
    if (sheetChanged) {
      setInputDraftDirty(Object.keys(changedInputDrafts(recoveredValues, savedValues)).length > 0);
      setAutoSavePaused(!!recovered && recovered.version !== sheet.version);
      setError(recovered && recovered.version !== sheet.version ? "Recovered your draft, but the shared sheet has changed. Review the values and click Save inputs before autosave resumes." : "");
      setDraftRecoveryError("");
    }
  }, [sheet?.id, sheet?.version, inputDraftDirty]);
  useEffect(() => {
    if (!sheet || !draftKey || !draftMatchesSheet || !inputDraftDirty || !editable || !inputOwner) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ revision: sheet.revision, version: sheet.version, values: changedInputDrafts(quickInputsDraft, sheet.parameter_values) }));
      setDraftRecoveryError("");
    } catch { setDraftRecoveryError("Browser recovery storage is unavailable. Keep this page open until the shared save succeeds."); }
  }, [quickInputsDraft, inputDraftDirty, sheet?.id, sheet?.version, editable, inputOwner, draftKey, draftMatchesSheet]);
  useEffect(() => {
    if (!inputDraftDirty || !editable || !inputOwner || busy || autoSavePaused || !draftMatchesSheet) return;
    const timer = window.setTimeout(() => { void saveQuickInputs(); }, 1500);
    return () => window.clearTimeout(timer);
  }, [quickInputsDraft, inputDraftDirty, editable, inputOwner, busy, autoSavePaused, sheet?.id, draftMatchesSheet]);
  useEffect(() => {
    if (!sheet) {
      assessmentDraftScope.current = "";
      setAssessmentDrafts({});
      return;
    }
    const currentScope = `${sheet.id}:${dept}`;
    const scopeChanged = assessmentDraftScope.current !== currentScope;
    if (!scopeChanged && assessmentDraftDirty) return;
    assessmentDraftScope.current = currentScope;
    setAssessmentDrafts(Object.fromEntries(parameters
      .filter((p) => p.lead === dept || p.reviewers.includes(dept))
      .map((p) => [p.id, { ...emptyResponse, ...sheet.parameter_values[p.id]?.responses[dept] }])));
    if (scopeChanged) setAssessmentDraftDirty(false);
  }, [sheet?.id, sheet?.version, dept, assessmentDraftDirty]);
  const stats = inputReadiness(sheet?.parameter_values || {}, parameters);
  const changedInputCount = sheet ? parameters.filter((p) => {
    const before = sheet.parameter_values[p.id] || emptyRow;
    const after = quickInputsDraft[p.id] || { input: "", source: "", finalValue: "" };
    return before.input !== after.input || before.source !== after.source || before.finalValue !== after.finalValue;
  }).length : 0;
  const assessmentParameters = parameters.filter((p) => p.lead === dept || p.reviewers.includes(dept));
  const changedAssessmentCount = sheet ? assessmentParameters.filter((p) => {
    const before = sheet.parameter_values[p.id]?.responses[dept] || emptyResponse;
    const after = assessmentDrafts[p.id] || emptyResponse;
    return before.status !== after.status || before.remarks !== after.remarks || before.evidence !== after.evidence || before.ownerId !== after.ownerId || before.dueDate !== after.dueDate;
  }).length : 0;
  async function save(
    action: Action,
    payload: Record<string, string | number | boolean | null>,
    version = sheet?.version,
  ) {
    if (busy) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await write({
        data: {
          action,
          payload: {
            ...(sheet ? { sheetId: sheet.id, expectedVersion: version! } : {}),
            ...payload,
          },
        },
      });
      await query.refetch();
      setNotice("Saved to shared project inputs.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed. Your input is preserved.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const rows = parameters.filter(
    (p) =>
      (section === "All" || p.section === section) &&
      (departmentView === "All" || [p.lead, ...p.reviewers, ...p.consumers].includes(departmentView)) &&
      `${p.label} ${p.hint} ${sheet?.parameter_values[p.id]?.input || ""}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
  );
  const departments = [...new Set(parameters.flatMap((p) => [p.lead, ...p.reviewers, ...p.consumers]))].sort();
  async function saveQuickInputs() {
    if (!sheet || busy || inputSaveInFlight.current || !editable || !inputOwner) return;
    inputSaveInFlight.current = true;
    const savingSheetId = sheet.id;
    const savingDraftKey = draftKey;
    const generation = inputEditGeneration.current;
    const snapshot = quickInputsDraft;
    setBusy(true);
    setError("");
    setNotice("");
    let currentVersion = sheet.version;
    let saved = 0;
    const changed = parameters.filter((p) => {
      const before = sheet.parameter_values[p.id] || emptyRow;
      const after = snapshot[p.id] || { input: "", source: "", finalValue: "" };
      return before.input !== after.input || before.source !== after.source || before.finalValue !== after.finalValue;
    });
    try {
      for (const p of changed) {
        const current = sheet.parameter_values[p.id] || emptyRow;
        const result = await write({ data: { action: "input", payload: {
          sheetId: sheet.id,
          expectedVersion: currentVersion,
          parameterId: p.id,
          input: snapshot[p.id]?.input || "",
          source: snapshot[p.id]?.source || "",
          finalValue: snapshot[p.id]?.finalValue || "",
          required: current.required !== false,
          exclusionReason: (current as ParameterValue & { exclusionReason?: string }).exclusionReason || "",
        } } });
        currentVersion = result.version;
        queryClient.setQueryData<import("@/lib/project-inputs.functions").InputSnapshot>(["project-inputs", membership.organizationId, membership.membershipId], current => current ? { ...current, sheets: current.sheets.map(existing => existing.id === result.id ? result : existing) } : current);
        saved += 1;
      }
      await query.refetch();
      if (inputDraftSheetId.current === savingSheetId) {
        if (inputEditGeneration.current === generation) {
          setInputDraftDirty(false);
          try { localStorage.removeItem(savingDraftKey); } catch { /* Server save is already confirmed. */ }
        }
        setAutoSavePaused(false);
        setNotice(changed.length ? `Saved ${saved} parameter${saved === 1 ? "" : "s"} to the shared project sheet.` : "No input changes to save.");
      }
    } catch (e) {
      await query.refetch();
      if (inputDraftSheetId.current === savingSheetId) {
      setAutoSavePaused(true);
      setError(saved
        ? `Saved ${saved} of ${changed.length} changed parameters. The remaining inputs are still in this editor; refresh the sheet before retrying. ${e instanceof Error ? e.message : "Save failed."}`
        : e instanceof Error ? e.message : "Save failed. Your input is preserved.");
      }
    } finally {
      inputSaveInFlight.current = false;
      setBusy(false);
    }
  }
  async function saveDepartmentInputs() {
    if (!sheet || busy) return;
    const changed = assessmentParameters.filter((p) => {
      const before = sheet.parameter_values[p.id]?.responses[dept] || emptyResponse;
      const after = assessmentDrafts[p.id] || emptyResponse;
      return before.status !== after.status || before.remarks !== after.remarks || before.evidence !== after.evidence || before.ownerId !== after.ownerId || before.dueDate !== after.dueDate;
    });
    if (changed.some((p) => !(assessmentDrafts[p.id]?.remarks || "").trim())) {
      setError("Add an assessment or review comment to each changed parameter before saving.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    let currentVersion = sheet.version;
    let saved = 0;
    try {
      for (const p of changed) {
        const response = assessmentDrafts[p.id] || emptyResponse;
        const result = await write({ data: { action: "respond", payload: {
          sheetId: sheet.id,
          expectedVersion: currentVersion,
          parameterId: p.id,
          department: dept,
          status: response.status,
          remarks: response.remarks,
          evidence: response.evidence,
          ownerId: response.ownerId,
          dueDate: response.dueDate,
        } } });
        currentVersion = result.version;
        saved += 1;
      }
      await query.refetch();
      setAssessmentDraftDirty(false);
      setNotice(changed.length ? `Saved ${saved} ${dept} department assessment${saved === 1 ? "" : "s"}.` : "No department assessment changes to save.");
    } catch (e) {
      await query.refetch();
      setError(saved
        ? `Saved ${saved} of ${changed.length} department updates. Remaining edits are still here; refresh the shared sheet before retrying. ${e instanceof Error ? e.message : "Save failed."}`
        : e instanceof Error ? e.message : "Department update failed. Your edits are preserved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4" aria-label="Project inputs and feasibility">
      <div>
        <h2 className="font-semibold">Inputs & Feasibility</h2>
        <p className="text-xs text-muted-foreground">
          Client or internal requirements, departmental assessments and an approved specification
          baseline. Example hints are not decided values.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-56 flex-1">
          <SharedMasterSelect
            label="Enquiry or project"
            options={sources
              .filter((s) => ["Project", "Enquiry", "Opportunity"].includes(s.type))
              .map((s) => ({ value: s.id, label: `${s.reference} · ${s.title}` }))}
            value={sourceId}
            onChange={(id) => {
              setSourceId(id);
              setScope(inferScope(sources.find((source) => source.id === id)));
              setError("");
              setNotice("");
            }}
          />
        </div>
        {sheet && (
          <span className="text-xs">
            {sheet.scope} · Rev {String(sheet.revision).padStart(2, "0")} · {sheet.status}
          </span>
        )}
      </div>
      {query.isPending && <p className="text-xs">Loading saved inputs…</p>}
      {query.error && (
        <p role="alert" className="text-xs text-destructive">
          Shared input service unavailable:{" "}
          {query.error instanceof Error ? query.error.message : "Unable to load"}. No local save is
          used.
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-xs text-emerald-600">
          {notice}
        </p>
      )}
      {!sheet && sourceId && !query.isPending && !query.error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-3">
          <div>
            <p className="text-xs font-medium">No input sheet yet</p>
            <p className="text-[11px] text-muted-foreground">Start the shared feasibility sheet for this entry.</p>
          </div>
          {["admin", "department_lead"].includes(membership.role) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Scope</span>
              <div className="inline-flex rounded-md bg-muted p-0.5" role="group" aria-label="Project scope">
                {(["Client", "Internal"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={scope === value}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${scope === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setScope(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <Button size="sm" disabled={busy} onClick={() => void save("create", { sourceId, scope })}>
                Start sheet
              </Button>
            </div>
          )}
        </div>
      )}
      {!sourceId && !query.isPending && !query.error && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">All permitted project inputs</h3>
              <p className="text-xs text-muted-foreground">One shared sheet holds requirements and every assigned department’s assessment.</p>
            </div>
            <span className="text-xs text-muted-foreground">{savedSheets.length} saved {savedSheets.length === 1 ? "sheet" : "sheets"}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Ready", portfolioTotals.ready],
              ["Missing", portfolioTotals.missing],
              ["Reviews due", portfolioTotals.pending],
              ["Blocked", portfolioTotals.blocked],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-border/60 bg-card px-3 py-2">
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p className="text-base font-semibold leading-tight">{value}</p>
              </div>
            ))}
          </div>
          {savedSheets.length ? (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {savedSheets.map((saved) => {
                const source = sources.find((record) => record.id === saved.source_record_id || record.id === saved.project_record_id);
                const readiness = inputReadiness(saved.parameter_values, [...PROJECT_INPUT_PARAMETERS, ...saved.custom_parameters]);
                return (
                  <article key={saved.id} className="rounded-lg border border-border/70 bg-card p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs text-primary">{source?.reference || "Enquiry / project"}</p>
                        <h4 className="truncate text-sm font-medium">{source?.title || "Source record is not in this view"}</h4>
                      </div>
                      <span className="shrink-0 rounded border px-2 py-0.5 text-[10px]">{saved.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{saved.scope} · Rev {String(saved.revision).padStart(2, "0")} · {readiness.ready}/{readiness.total} ready · {readiness.pending} awaiting review · {readiness.missing} missing</p>
                  <Button size="sm" variant="outline" onClick={() => { setSourceId(saved.project_record_id || saved.source_record_id); setFilter(""); }}>Open shared sheet</Button>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">No saved input sheets are available yet. Select an enquiry, opportunity or project below to start one. Nothing needs to be entered twice.</p>
          )}
          <details className="rounded-lg border border-border/70 bg-card">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium">Enquiries and projects without a sheet ({availableSources.length})</summary>
            <div className="space-y-2 border-t border-border/50 p-3">
              <input className={field} aria-label="Search enquiries and projects" placeholder="Search code, title or client…" value={filter} onChange={(event) => setFilter(event.target.value)} />
              {availableSources.length ? availableSources.map((record) => (
                <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/50 p-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-primary">{record.reference}</p>
                    <p className="truncate text-xs">{record.title} <span className="text-muted-foreground">· {record.type}</span></p>
                  </div>
                  <Button size="sm" variant="outline" disabled={busy || !["admin", "department_lead"].includes(membership.role)} onClick={() => { setSourceId(record.id); setScope(inferScope(record)); setFilter(""); }}>
                    Select to start
                  </Button>
                </div>
              )) : <p className="text-xs text-muted-foreground">No unstarted records match this search.</p>}
            </div>
          </details>
        </div>
      )}
      {sheet && (
        <>
          {editable && membership.role === "admin" && (
            <label className="grid gap-1 text-xs">
              Input coordinator (department lead)
              <select
                className={field}
                value={sheet.input_owner_id}
                disabled={busy}
                onChange={(e) => void save("assign_owner", { ownerId: e.target.value })}
              >
                <option value={sheet.input_owner_id}>
                  {people.data?.members.find((m) => m.id === sheet.input_owner_id)?.display_name ||
                    "Current coordinator"}
                </option>
                {people.data?.members
                  .filter((m) => m.role === "department_lead" && m.id !== sheet.input_owner_id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {[
              ["Missing inputs", stats.missing],
              ["Awaiting agreed value", stats.awaitingAgreement],
              ["Blocked / conditional", stats.blocked],
              ["Awaiting department review", stats.pending],
              ["Ready parameters", stats.ready],
            ].map(([label, n]) => (
              <div className="rounded-lg border p-3" key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-semibold">{n}</p>
              </div>
            ))}
          </div>
          {editable && inputOwner && <p role="status" className="text-[11px] text-muted-foreground">{busy ? "Saving to shared project inputs…" : autoSavePaused ? "Automatic save paused — review your draft and use Save inputs to retry." : inputDraftDirty ? "Draft changed · automatically saving after you finish typing…" : "Inputs saved · draft autosave is on."}{draftRecoveryError ? ` ${draftRecoveryError}` : ""}</p>}
          <div className="flex flex-wrap gap-2">
            <input
              aria-label="Search input parameters"
              className={`${field} flex-1 min-w-40`}
              placeholder="Search parameters or requirements…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <select
              aria-label="Parameter section"
              className="rounded border bg-background p-2 text-xs max-w-64"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              {["All", ...new Set(parameters.map((p) => p.section))].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select aria-label="Department responsibility" className="max-w-56 rounded border bg-background p-2 text-xs" value={departmentView} onChange={(event) => setDepartmentView(event.target.value)}>
              <option value="All">All departments · {parameters.length}</option>
              {departments.map((code) => {
                const count = parameters.filter((p) => [p.lead, ...p.reviewers, ...p.consumers].includes(code)).length;
                const leadCount = parameters.filter((p) => p.lead === code).length;
                const reviewCount = parameters.filter((p) => p.reviewers.includes(code)).length;
                return <option key={code} value={code}>{code} · {count} related ({leadCount} lead / {reviewCount} review)</option>;
              })}
            </select>
            {editable && inputOwner && (
              <Button size="sm" disabled={busy || changedInputCount === 0} onClick={() => void saveQuickInputs()}>
                {busy ? "Saving…" : `Save inputs${changedInputCount ? ` · ${changedInputCount}` : ""}`}
              </Button>
            )}
            {editable && membership.role === "department_lead" && changedAssessmentCount > 0 && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void saveDepartmentInputs()}>
                {busy ? "Saving…" : `Save ${dept} updates · ${changedAssessmentCount}`}
              </Button>
            )}
          </div>
          {departmentView !== "All" && <p className="text-[11px] text-muted-foreground">Showing {rows.length} shared parameters related to {departmentView}; lead fields are editable only by that primary department, while assigned reviewers can add review questions.</p>}
          <div className="space-y-2">
            {rows.map((p) => {
              const row = sheet.parameter_values[p.id] || emptyRow;
              const assigned = [p.lead, ...p.reviewers];
              const inputDraft = quickInputsDraft[p.id] || { input: "", source: "", finalValue: "" };
              return (
                <article key={p.id} className="rounded-lg border border-border/70 bg-card p-3">
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground">{p.section} · Primary {p.lead}{p.reviewers.length ? ` · Review ${p.reviewers.join(", ")}` : ""}</p>
                      <h3 className="text-sm font-semibold">{p.label}</h3>
                      <p className="text-[11px] text-muted-foreground">{p.hint}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded border px-2 py-0.5 text-[10px]">{row.required === false ? "Not required" : row.finalValue ? "Value agreed" : row.input?.trim() ? "Input received · awaiting agreement" : "Input pending"}</span>
                    </div>
                  </div>
                  <SmartParameterField
                    parameterId={p.id}
                    label={p.label}
                    section={p.section}
                    hint={p.hint}
                    inputDraft={inputDraft}
                    disabled={!editable || !inputOwner}
                    onChange={(patch) => {
                      inputEditGeneration.current++;
                      setInputDraftDirty(true);
                      setQuickInputsDraft((prev) => ({
                        ...prev,
                        [p.id]: {
                          ...inputDraft,
                          ...(patch.input !== undefined ? { input: patch.input } : {}),
                          ...(patch.source !== undefined ? { source: patch.source } : {}),
                          ...(patch.finalValue !== undefined ? { finalValue: patch.finalValue } : {}),
                        },
                      }));
                    }}
                  />
                  {row.required === false && <p className="mt-1 text-[10px] text-muted-foreground">Excluded: {(row as ParameterValue & { exclusionReason?: string }).exclusionReason}</p>}
                  <details className="mt-2 rounded border border-border/50 px-2.5 py-2">
                    <summary className="cursor-pointer text-[11px] font-medium">Department inputs & comments · {assigned.length} responsible / review teams</summary>
                    <p className="mt-2 text-[10px] text-muted-foreground">Dependent teams: {p.consumers.join(", ") || "None listed"}</p>
                    {assigned.map((code) => {
                      const response = row.responses[code];
                      const canAssess = code === dept && p.lead === dept && editable && membership.role === "department_lead";
                      const canQuery = code === dept && p.lead !== dept && p.reviewers.includes(dept) && editable && membership.role === "department_lead";
                      const responseDraft = assessmentDrafts[p.id] || { ...emptyResponse, ...response };
                      return (
                        <div className="mt-2 border-t border-border/50 pt-2" key={code}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-medium">{code} · {response?.status || "Awaiting assessment"}{response?.reviewedBy ? " · Reviewed" : ""}{p.lead === code ? " · Primary owner" : " · Reviewer"}</p>
                            {canAssess && response && response.status !== "Pending" && !response.reviewedBy && <Button size="sm" variant="outline" disabled={busy} onClick={() => void save("review_response", { parameterId: p.id, department: dept })}>Confirm department review</Button>}
                          </div>
                          {canAssess && <div className="mt-2 grid gap-2 md:grid-cols-2">
                            <label className="grid gap-1 text-[10px] text-muted-foreground">Department feasibility
                              <select className={field} value={responseDraft.status} onChange={(event) => { setAssessmentDraftDirty(true); setAssessmentDrafts((prev) => ({ ...prev, [p.id]: { ...responseDraft, status: event.target.value as ParameterResponse["status"] } })); }}>
                                {FEASIBILITY_STATES.map((value) => <option key={value}>{value}</option>)}
                              </select>
                            </label>
                            <label className="grid gap-1 text-[10px] text-muted-foreground">Responsible member
                              <select className={field} value={responseDraft.ownerId} onChange={(event) => { setAssessmentDraftDirty(true); setAssessmentDrafts((prev) => ({ ...prev, [p.id]: { ...responseDraft, ownerId: event.target.value } })); }}>
                                <option value="">Unassigned</option>
                                {members.map((member) => <option value={member.id} key={member.id}>{member.display_name}</option>)}
                              </select>
                            </label>
                          </div>}
                          {(canAssess || canQuery) ? <div className="mt-2 grid gap-2 md:grid-cols-2">
                            <label className="grid gap-1 text-[10px] text-muted-foreground">{canAssess ? "Department assessment / comments" : "Review question / comment"}
                              <textarea rows={2} className={field} placeholder={canAssess ? "Feasibility, constraints, assumptions or clarification needed" : "Ask the responsible department a question or add a review comment"} value={responseDraft.remarks} onChange={(event) => { setAssessmentDraftDirty(true); setAssessmentDrafts((prev) => ({ ...prev, [p.id]: { ...responseDraft, remarks: event.target.value } })); }} />
                            </label>
                            <div className="grid gap-2">
                              <label className="grid gap-1 text-[10px] text-muted-foreground">Evidence reference
                                <textarea rows={1} className={field} placeholder="Document or record reference" value={responseDraft.evidence} onChange={(event) => { setAssessmentDraftDirty(true); setAssessmentDrafts((prev) => ({ ...prev, [p.id]: { ...responseDraft, evidence: event.target.value } })); }} />
                              </label>
                              {canAssess && <label className="grid gap-1 text-[10px] text-muted-foreground">Target date
                                <input type="date" className={field} value={responseDraft.dueDate} onChange={(event) => { setAssessmentDraftDirty(true); setAssessmentDrafts((prev) => ({ ...prev, [p.id]: { ...responseDraft, dueDate: event.target.value } })); }} />
                              </label>}
                            </div>
                          </div> : <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{response?.remarks || "No department comment yet."}</p>}
                          {response?.ownerId && <p className="mt-1 text-[10px]">Owner: {people.data?.members.find((m) => m.id === response.ownerId)?.display_name || "Assigned member"}</p>}
                          {response?.dueDate && <p className="text-[10px]">Target: {response.dueDate}</p>}
                        </div>
                      );
                    })}
                  </details>
                </article>
              );
            })}
            {!rows.length && <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">No parameters match these filters.</p>}
            <div className="flex justify-end gap-2">
              {editable && membership.role === "department_lead" && changedAssessmentCount > 0 && <Button variant="outline" disabled={busy} onClick={() => void saveDepartmentInputs()}>{busy ? "Saving…" : `Save ${dept} assessments · ${changedAssessmentCount}`}</Button>}
              {editable && inputOwner && <Button disabled={busy || changedInputCount === 0} onClick={() => void saveQuickInputs()}>{busy ? "Saving…" : `Save project inputs${changedInputCount ? ` · ${changedInputCount} changed` : ""}`}</Button>}
            </div>
          </div>
          {/* Previous table view replaced by the inline shared input cards.
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-left">
                <tr>
                  {[
                    "Parameter / responsibility",
                    "Project / client input & source",
                    "Department assessment & comments",
                    "Final agreed value",
                    "Details",
                  ].map((t) => (
                    <th className="p-3" key={t}>
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const row = sheet.parameter_values[p.id] || emptyRow;
                  const assigned = [p.lead, ...p.reviewers];
                  return (
                    <tr key={p.id} className="border-t align-top">
                      <td className="p-3 min-w-48">
                        <p className="text-muted-foreground text-[10px]">{p.section}</p>
                        <p className="font-semibold">{p.label}</p>
                        <p>Primary: {p.lead}</p>
                        <p className="text-muted-foreground">Review: {p.reviewers.join(", ")}</p>
                      </td>
                      <td className="p-3 min-w-48 whitespace-pre-wrap">
                        {row.input || (
                          <span className="text-muted-foreground">To be confirmed</span>
                        )}
                        {row.source && (
                          <p className="mt-1 text-muted-foreground">Source: {row.source}</p>
                        )}
                        {row.required === false && (
                          <p>
                            Excluded:{" "}
                            {(row as ParameterValue & { exclusionReason?: string }).exclusionReason}
                          </p>
                        )}
                      </td>
                      <td className="p-3 min-w-48 space-y-1">
                        {assigned.map((d) => (
                          <p key={d} className="mb-1">
                            {d}: {row.responses[d]?.status || "Pending"}
                            {row.responses[d]?.reviewedBy ? " · Reviewed" : ""}
                            {row.responses[d]?.remarks && <span className="block max-w-64 truncate text-muted-foreground">{row.responses[d]?.remarks}</span>}
                          </p>
                        ))}
                      </td>
                      <td className="p-3 min-w-40 whitespace-pre-wrap">
                        {row.finalValue || "Not agreed"}
                      </td>
                      <td className="p-3 min-w-64">
                        <details>
                          <summary className="cursor-pointer font-medium">
                            Requirements & assessments
                          </summary>
                          <p className="mt-2 text-muted-foreground">{p.hint}</p>
                          <p className="mt-1">Dependent teams: {p.consumers.join(", ")}</p>
                          {assigned.map((d) => {
                            const response = row.responses[d];
                            return (
                              <div className="mt-2 border-t pt-2" key={d}>
                                <p className="font-medium">
                                  {d} · {response?.status || "Awaiting assessment"}
                                </p>
                                <p className="whitespace-pre-wrap">
                                  {response?.remarks || "No technical remarks yet."}
                                </p>
                                {response?.evidence && <p>Evidence: {response.evidence}</p>}
                                {response?.ownerId && (
                                  <p>
                                    Owner:{" "}
                                    {people.data?.members.find((m) => m.id === response.ownerId)
                                      ?.display_name || "Assigned member"}
                                  </p>
                                )}
                                {response?.dueDate && <p>Target: {response.dueDate}</p>}
                              </div>
                            );
                          })}
                          <div className="mt-2 flex flex-wrap gap-2">
                            {editable && inputOwner && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => edit(p.id, "input")}
                              >
                                Edit requirement
                              </Button>
                            )}
                            {editable && assigned.includes(dept) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => edit(p.id, "respond")}
                              >
                                My assessment
                              </Button>
                            )}
                            {editable &&
                              assigned.includes(dept) &&
                              membership.role === "department_lead" &&
                              row.responses[dept] &&
                              !row.responses[dept]?.reviewedBy && (
                                <Button
                                  size="sm"
                                  disabled={busy}
                                  onClick={() =>
                                    void save("review_response", {
                                      parameterId: p.id,
                                      department: dept,
                                    })
                                  }
                                >
                                  Confirm department review
                                </Button>
                              )}
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          */}
          {editable && inputOwner && sheet.scope === "Client" && (
            <div className="rounded border p-3 space-y-2">
              <p className="text-xs font-medium">Client approval evidence reference</p>
              <p className="text-xs text-muted-foreground">
                Reference the signed approval document or record. Entering a reference does not
                create or verify a client signature.
              </p>
              <input
                aria-label="Client approval evidence"
                className={field}
                placeholder={sheet.client_evidence || "Signed document / approval record reference"}
                value={clientEvidence}
                onChange={(e) => setClientEvidence(e.target.value)}
              />
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void save("client_evidence", { evidence: clientEvidence })}
              >
                Save evidence reference
              </Button>
            </div>
          )}
          {!sheet.project_record_id && (membership.role === "admin" || dept === "SAL") && (
            <div className="flex gap-2">
              <div className="flex-1">
                <SharedMasterSelect
                  label="Link accepted project"
                  options={sources
                    .filter((s) => s.type === "Project")
                    .map((s) => ({ value: s.id, label: `${s.reference} · ${s.title}` }))}
                  value={linkId}
                  onChange={setLinkId}
                />
              </div>
              <Button
                disabled={busy || !linkId}
                onClick={() => void save("link_project", { projectId: linkId })}
              >
                Link existing project
              </Button>
            </div>
          )}
          {editable && membership.role === "admin" && (
            <Button
              disabled={busy || sheet.input_owner_id === membership.membershipId}
              onClick={() => void save("approve", {})}
            >
              Approve baseline
            </Button>
          )}
          {sheet.status === "Approved" && inputOwner && (
            <div className="flex gap-2">
              <input
                aria-label="Revision reason"
                className={field}
                placeholder="Reason for a new revision"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button
                disabled={busy || reason.trim().length < 5}
                onClick={() => void save("revise", { reason })}
              >
                Start revision
              </Button>
            </div>
          )}
          <details className="rounded border p-3">
            <summary className="cursor-pointer text-xs font-medium">
              Revision & activity history
            </summary>
            {query.data?.events
              .filter((e) => e.sheet_id === sheet.id)
              .map((e) => (
                <div className="mt-2 text-xs" key={e.id}>
                  <p>
                    Rev {e.revision} · {e.action} · {e.actor_name} ·{" "}
                    {new Date(e.created_at).toLocaleString()}
                  </p>
                  {e.action === "approve" && (
                    <details>
                      <summary className="cursor-pointer">Approved specification snapshot</summary>
                      <pre className="overflow-auto whitespace-pre-wrap">
                        {JSON.stringify(e.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
          </details>
        </>
      )}
      {editable && ["admin", "department_lead"].includes(membership.role) && dept && (
        <Button variant="outline" onClick={() => setNewQuestion(true)}>
          Add department question
        </Button>
      )}
      <Dialog
        open={newQuestion}
        onOpenChange={(open) => {
          if (!busy) setNewQuestion(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add department question</DialogTitle>
            <DialogDescription>
              {dept} is responsible for the assessment. Select supporting reviewers only where
              needed.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await save("add_parameter", {
                  label: questionLabel,
                  hint: questionHint,
                  reviewers: questionReviewers.join(","),
                })
              ) {
                setNewQuestion(false);
                setQuestionLabel("");
                setQuestionHint("");
                setQuestionReviewers([]);
              }
            }}
          >
            <label className="grid gap-1 text-xs">
              Parameter / question
              <input
                className={field}
                required
                minLength={3}
                value={questionLabel}
                onChange={(e) => setQuestionLabel(e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs">
              Information needed
              <textarea
                className={field}
                value={questionHint}
                onChange={(e) => setQuestionHint(e.target.value)}
              />
            </label>
            <fieldset className="flex flex-wrap gap-2 text-xs">
              <legend>Supporting department reviews</legend>
              {people.data?.departments
                .filter((d) => d.code !== "CLIENT" && d.code !== dept)
                .map((d) => (
                  <label key={d.id} className="flex gap-1">
                    <input
                      type="checkbox"
                      checked={questionReviewers.includes(d.code)}
                      onChange={(e) =>
                        setQuestionReviewers((prev) =>
                          e.target.checked ? [...prev, d.code] : prev.filter((c) => c !== d.code),
                        )
                      }
                    />
                    {d.code}
                  </label>
                ))}
            </fieldset>
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <Button disabled={busy}>Add question</Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
