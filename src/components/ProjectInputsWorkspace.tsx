import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { changedInputDrafts, readInputDraft } from "@/lib/project-input-drafts";
import { useServerFn } from "@tanstack/react-start";
import { getProjectInputs, mutateProjectInputs, saveDepartmentFeasibilityEstimate } from "@/lib/project-inputs.functions";
import { getSharedTestWorkspace } from "@/lib/shared-test.functions";
import {
  PROJECT_INPUT_PARAMETERS,
  FEASIBILITY_STATES,
  inputReadiness,
  feasibilityEstimateReview,
  feasibilityDepartmentCodes,
  mergeFeasibilityTaskPlan,
  type InputSheet,
  type ParameterValue,
  type ParameterResponse,
  type DepartmentFeasibilityEstimate,
} from "@/lib/project-inputs";
import { COMPANY_PHASES, DEFAULT_PHASE_DURATIONS, defaultLifecycleRevision, getDefaultStageDurationDays, readLifecycleBaseline, type CompanyPhase, type PhaseDurationDefault } from "@/lib/lifecycle-baseline";
import { feasibilityLifecycleStages } from "@/lib/feasibility-lifecycle";
import { getLifecycleWorkspace } from "@/lib/lifecycle-workspace.functions";
import { getSharedDepartmentRoleConfiguration } from "@/lib/department-roles.functions";
import type { TestMembership } from "@/lib/test-auth.functions";
import type { AnalysisRecord } from "@/lib/project-analysis-data";
import { isSelectableMasterStatus } from "@/lib/shared-master-options";
import { SharedMasterSelect } from "./SharedMasterSelect";
import { CustomerChangeRequestsPanel } from "./CustomerChangeRequestsPanel";
import { SmartParameterField } from "./SmartParameterField";
import { SmartSorImporterModal } from "./SmartSorImporterModal";
import { readAssessmentDraft } from "@/lib/assessment-drafts";
import {
  availableFeasibilitySources,
  createDemoFeasibilitySheet,
  isDemoInputActionAllowed,
  seedS10DemoFeasibilitySnapshot,
  withS10DemoFeasibilitySources,
} from "@/lib/s10-demo-feasibility";
import { getScenario } from "@/lib/lifecycle-scenarios";
import { Sparkles } from "lucide-react";
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
function createDemoProjectInputsData(sources: AnalysisRecord[]): import("@/lib/project-inputs.functions").InputSnapshot {
  const prj = sources.find((s) => (s.type === "Project" || s.reference?.includes("PRJ")) && s.reference !== "DEMO-PROJ-010") || sources.find((source) => source.reference !== "DEMO-PROJ-010");
  const sourceId = prj?.id || "demo-prj-01";
  const snapshot: import("@/lib/project-inputs.functions").InputSnapshot = {
    sheets: [
      {
        id: "sheet-demo-01",
        source_record_id: sourceId,
        project_record_id: sourceId,
        scope: "Client",
        input_owner_id: "demo-admin-id",
        revision: 1,
        version: 1,
        status: "Draft",
        updated_at: new Date().toISOString(),
        client_evidence: "OEM Statement of Requirements & Customer Technical Specification Rev 2.0",
        custom_parameters: [],
        parameter_values: {
          system_voltage: {
            input: "12V / 24V DC Auto-detect",
            source: "Customer SOR §3.1",
            finalValue: "12V / 24V DC",
            required: true,
            responses: {},
          },
          operating_range: {
            input: "9V - 36V DC Continuous (ISO 7637-2)",
            source: "AIS-140 Annexure 2",
            finalValue: "9V - 36V DC",
            required: true,
            responses: {},
          },
          cellular: {
            input: "4G LTE Cat-1 with 2G Fallback",
            source: "Automotive Cellular Modem Spec",
            finalValue: "4G LTE Cat-1 + 2G",
            required: true,
            responses: {},
          },
          ip: {
            input: "IP67 Ingress Protection",
            source: "Mechanical Enclosure Spec",
            finalValue: "IP67",
            required: true,
            responses: {},
          },
        },
      },
    ],
    events: [],
  };
  const scenario = getScenario("S10");
  if (!scenario) throw new Error("S10_DEMO_SCENARIO_UNAVAILABLE");
  const s10Project = sources.find(
    (source) =>
      source.type === "Project" &&
      source.reference === scenario.projectCode &&
      source.fields["demoFixtureKey"] === scenario.fixtureKey,
  );
  return s10Project
    ? createDemoFeasibilitySheet(
        snapshot,
        sources,
        s10Project.id,
        "Client",
        new Date().toISOString(),
        scenario,
      )
    : seedS10DemoFeasibilitySnapshot(snapshot, sources, scenario);
}

const demoInputStorageKey = "ssm:demo-project-input-sheets:v1";
function loadDemoProjectInputs(sources: AnalysisRecord[]): import("@/lib/project-inputs.functions").InputSnapshot {
  let saved: { sheets?: unknown; events?: unknown } | null = null;
  if (typeof window !== "undefined") {
    try {
      saved = JSON.parse(localStorage.getItem(demoInputStorageKey) || "null");
    } catch { /* Invalid demo recovery data cannot replace the initial sample. */ }
  }
  if (
    saved &&
    Array.isArray(saved.sheets) &&
    Array.isArray(saved.events)
  ) {
    const sheets = saved.sheets.filter((row: InputSheet) => row && row.id && Number.isInteger(row.version) && row.parameter_values && sources.some(source => source.id === row.source_record_id || source.id === row.project_record_id));
    if (sheets.length) {
      const scenario = getScenario("S10");
      if (!scenario) throw new Error("S10_DEMO_SCENARIO_UNAVAILABLE");
      const snapshot = seedS10DemoFeasibilitySnapshot(
        { sheets, events: saved.events },
        sources,
        scenario,
      );
      const s10Project = sources.find(
        (source) =>
          source.type === "Project" &&
          source.reference === scenario.projectCode &&
          source.fields["demoFixtureKey"] === scenario.fixtureKey,
      );
      const withS10Sheet =
        s10Project &&
        !snapshot.sheets.some(
          (sheet) =>
            sheet.source_record_id === s10Project.id ||
            sheet.project_record_id === s10Project.id,
        )
          ? createDemoFeasibilitySheet(
              snapshot,
              sources,
              s10Project.id,
              "Client",
              new Date().toISOString(),
              scenario,
            )
          : snapshot;
      if (withS10Sheet.sheets.some((sheet, index) => sheet !== sheets[index])) {
        localStorage.setItem(demoInputStorageKey, JSON.stringify(withS10Sheet));
      }
      return withS10Sheet;
    }
  }
  return createDemoProjectInputsData(sources);
}

export function ProjectInputsWorkspace({
  membership,
  sources: sourceRecords,
  initialSourceId,
}: {
  membership?: TestMembership | undefined;
  sources: AnalysisRecord[];
  initialSourceId?: string | undefined;
}) {
  const load = useServerFn(getProjectInputs),
    write = useServerFn(mutateProjectInputs),
    loadMembers = useServerFn(getSharedTestWorkspace),
    loadLifecycle = useServerFn(getLifecycleWorkspace),
    loadDepartmentRoles = useServerFn(getSharedDepartmentRoleConfiguration),
    saveEstimate = useServerFn(saveDepartmentFeasibilityEstimate);
  const effectiveMembership: TestMembership = membership ?? {
    membershipId: "demo-admin-id",
    organizationId: "demo-org-id",
    role: "admin",
    departmentCode: "SAL",
    departmentName: "Sales & Business Development",
    organizationName: "XYZ Pvt Ltd (Demo)",
    displayName: "Demo input coordinator",
    isClient: false,
  };
  const s10Scenario = getScenario("S10");
  if (!s10Scenario) throw new Error("S10_DEMO_SCENARIO_UNAVAILABLE");
  const sources =
    membership || !s10Scenario
      ? sourceRecords
      : withS10DemoFeasibilitySources(sourceRecords, s10Scenario);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["project-inputs", effectiveMembership.organizationId, effectiveMembership.membershipId],
    queryFn: () => (membership ? load() : Promise.resolve(loadDemoProjectInputs(sources))),
    refetchInterval: membership ? 15000 : false,
  });
  const people = useQuery({
    queryKey: ["shared-test-workspace", effectiveMembership.organizationId, effectiveMembership.membershipId],
    queryFn: () => loadMembers(),
    enabled: !!membership,
  });
  const lifecycle = useQuery({
    queryKey: ["lifecycle-workspace", effectiveMembership.organizationId, effectiveMembership.membershipId],
    queryFn: () => membership ? loadLifecycle() : Promise.resolve(null),
    enabled: !!membership,
    retry: false,
  });
  const departmentRoles = useQuery({
    queryKey: ["shared-department-role-configuration", effectiveMembership.organizationId, effectiveMembership.membershipId],
    queryFn: () => loadDepartmentRoles(),
    enabled: !!membership && effectiveMembership.role === "department_lead",
    retry: false,
  });
  const [sourceId, setSourceId] = useState(
    initialSourceId && initialSourceId !== "all" ? initialSourceId : "",
  );
  const [scope, setScope] = useState<"Client" | "Internal">(() =>
    inferScope(sources.find((source) => source.id === initialSourceId)),
  ),
    [filter, setFilter] = useState(""),
    [section, setSection] = useState("All");
  const [sorModalOpen, setSorModalOpen] = useState(false);
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
  const editedInputIds = useRef(new Set<string>());
  const inputBaseVersion = useRef(0);
  const [assessmentDrafts, setAssessmentDrafts] = useState<Record<string, ParameterResponse>>({});
  const [assessmentDraftDirty, setAssessmentDraftDirty] = useState(false);
  const [estimateDraft, setEstimateDraft] = useState<DepartmentFeasibilityEstimate | null>(null);
  const [estimateScheduleReviewed, setEstimateScheduleReviewed] = useState(false);
  const [estimateDepartmentCode, setEstimateDepartmentCode] = useState(membership?.departmentCode || "");
  const [estimateBusy, setEstimateBusy] = useState(false);
  const inputDraftSheetId = useRef("");
  const assessmentDraftScope = useRef("");
  const assessmentGeneration = useRef(0);
  const sheet = query.data?.sheets.find(
    (s) => s.source_record_id === sourceId || s.project_record_id === sourceId,
  );
  const lifecycleRevision = (lifecycle.data?.revision
    ? readLifecycleBaseline(JSON.stringify(lifecycle.data.revision.definition))
    : undefined) ?? defaultLifecycleRevision();
  const savedSheets = (query.data?.sheets || []).filter((saved) => {
    if (sourceId && saved.source_record_id !== sourceId && saved.project_record_id !== sourceId) return false;
    const source = sources.find((record) => record.id === saved.source_record_id || record.id === saved.project_record_id);
    return !filter || `${source?.reference || ""} ${source?.title || ""} ${saved.scope} ${saved.status}`.toLowerCase().includes(filter.toLowerCase());
  });
  const availableSources = availableFeasibilitySources(
    sources,
    query.data?.sheets || [],
    sourceId,
    filter,
  );
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
    !!sheet && (sheet.input_owner_id === effectiveMembership.membershipId || effectiveMembership.role === "admin");
  const editable = sheet?.status === "Draft";
  const dept = effectiveMembership.departmentCode || "";
  const estimateDepartments = membership && effectiveMembership.role === "department_lead"
    ? feasibilityDepartmentCodes(
        departmentRoles.data?.departments ?? people.data?.departments ?? [],
        departmentRoles.data?.roles ?? [],
        effectiveMembership.membershipId,
        dept,
      )
    : [];
  const estimateDept = estimateDepartments.includes(estimateDepartmentCode)
    ? estimateDepartmentCode
    : estimateDepartments[0] || "";
  useEffect(() => {
    if (estimateDept && estimateDept !== estimateDepartmentCode) setEstimateDepartmentCode(estimateDept);
  }, [estimateDept, estimateDepartmentCode]);
  const members =
    people.data?.members.filter(
      (m) => m.department_id === people.data?.departments.find((d) => d.code === estimateDept)?.id,
    ) || [];
  const parameters = [...PROJECT_INPUT_PARAMETERS, ...(sheet?.custom_parameters || [])];
  const estimateForDepartment = sheet?.department_estimates?.[estimateDept];
  const selectedFeasibilitySource = sources.find((source) => source.id === sourceId);
  const { track: recordedTrack, stages: applicableLifecycleStages } = feasibilityLifecycleStages(lifecycleRevision, selectedFeasibilitySource?.fields);
  const departmentLifecycleTasks = applicableLifecycleStages.flatMap((stage) => stage.tasks.filter((task) => task.department === estimateDept).map((task) => ({ stage, task, key: `${stage.code}:${task.id}` })));
  const phaseDurationDefaults = Object.fromEntries(COMPANY_PHASES.map(([phase]) => [phase, lifecycleRevision.phaseDurations?.[phase] ?? DEFAULT_PHASE_DURATIONS[phase]])) as Record<CompanyPhase, PhaseDurationDefault>;
  const defaultStageDurationDays = Object.fromEntries(applicableLifecycleStages.map((stage) => [stage.code, getDefaultStageDurationDays(lifecycleRevision, stage)])) as Record<string, number>;
  const estimateReview = estimateDraft && lifecycle.data?.revision?.id
    ? feasibilityEstimateReview(estimateDraft, lifecycle.data.revision.id, defaultStageDurationDays)
    : null;
  const phaseZeroDuration = phaseDurationDefaults.TG_0;
  const autoPlanFeasibilityTasks = (stageDays: Record<string, number>) => Object.fromEntries(departmentLifecycleTasks.map(({ stage, task, key }) => {
    const stageTasks = departmentLifecycleTasks.filter((item) => item.stage.code === stage.code);
    const stageIndex = stageTasks.findIndex((item) => item.key === key);
    const duration = Math.max(1, stageDays[stage.code] ?? defaultStageDurationDays[stage.code] ?? 1);
    return [key, {
      stageCode: stage.code, phase: stage.phase,
      effortHours: task.estimatedHoursMin ?? phaseDurationDefaults[stage.phase].taskSlaMinHours,
      startOffsetDays: stageTasks.length ? Math.min(duration - 1, Math.floor(stageIndex * duration / stageTasks.length)) : 0,
      durationDays: 1,
    }];
  }));
  const visibleEstimates = sheet?.department_estimates ?? {};
  const estimateTotal = Object.values(visibleEstimates).reduce((total, estimate) => total + estimate.preliminaryBomCost + estimate.reusableMaterialValue + estimate.consumableCost + estimate.labCertificationFees + estimate.toolingCapex, 0);
  useEffect(() => {
    setEstimateScheduleReviewed(false);
    if (!sheet) { setEstimateDraft(null); return; }
    const saved = sheet.department_estimates?.[dept];
    if (saved) {
      const suggested = autoPlanFeasibilityTasks(defaultStageDurationDays);
      const taskPlan = mergeFeasibilityTaskPlan(
        departmentLifecycleTasks.map(({ stage, key }) => ({ key, stageCode: stage.code, phase: stage.phase })),
        saved.taskPlan,
        suggested,
      );
      setEstimateDraft({ ...structuredClone(saved), stageDurationDays: saved.stageDurationDays ?? defaultStageDurationDays, taskPlan });
      return;
    }
    setEstimateDraft({
      currency: "INR", engineeringHours: 0, plannedDurationDays: Math.round((phaseZeroDuration.minWorkingDays + phaseZeroDuration.maxWorkingDays) / 2), stageDurationDays: defaultStageDurationDays,
      taskPlan: autoPlanFeasibilityTasks(defaultStageDurationDays), preliminaryBomCost: 0, reusableMaterialValue: 0,
      consumableCost: 0, labCertificationFees: 0, toolingCapex: 0, assumptions: "",
    });
  }, [sheet?.id, sheet?.version, estimateDept, lifecycle.data?.revision?.id]);
  const draftKey = sheet ? `ssm:input-draft:${effectiveMembership.organizationId}:${effectiveMembership.membershipId}:${sheet.id}:${sheet.revision}` : "";
  const draftMatchesSheet = !!sheet && inputDraftSheetId.current === draftKey;
  const assessmentKey = draftKey ? `${draftKey}:assessment:${estimateDept}` : "";
  useEffect(() => {
    if (!sheet) {
      inputDraftSheetId.current = "";
      setQuickInputsDraft({});
      return;
    }
    const sheetChanged = inputDraftSheetId.current !== draftKey;
    if (!sheetChanged && inputDraftDirty) return;
    inputDraftSheetId.current = draftKey;
    const savedValues = Object.fromEntries(parameters.map((p) => {
      const value = sheet.parameter_values[p.id] || emptyRow;
      return [p.id, { input: value.input || "", source: value.source || "", finalValue: value.finalValue || "" }];
    }));
    let recovered: ReturnType<typeof readInputDraft>;
    if (sheetChanged && editable && inputOwner) {
      try { recovered = readInputDraft(localStorage.getItem(draftKey), sheet.revision); } catch { /* Storage can be disabled. */ }
    }
    const recoveredValues = Object.fromEntries(Object.entries(recovered?.values || {}).filter(([id]) => parameters.some(p => p.id === id)));
    const recoveredChanges = changedInputDrafts(recoveredValues, savedValues);
    setQuickInputsDraft({ ...savedValues, ...recoveredValues });
    if (sheetChanged) {
      editedInputIds.current = new Set(Object.keys(recoveredChanges));
      inputBaseVersion.current = recovered?.version ?? sheet.version;
      const needsReview = editedInputIds.current.size > 0 && !!recovered && recovered.version !== sheet.version;
      setInputDraftDirty(editedInputIds.current.size > 0);
      setAutoSavePaused(needsReview);
      setError(needsReview ? "Recovered your draft, but the shared sheet has changed. Review the values and click Save inputs before autosave resumes." : "");
      if (recovered && !editedInputIds.current.size) {
        try { localStorage.removeItem(draftKey); } catch { /* Recovery is optional. */ }
      }
      setDraftRecoveryError("");
    }
  }, [sheet?.id, sheet?.version, inputDraftDirty, draftKey]);
  useEffect(() => {
    if (!sheet || !draftKey || !draftMatchesSheet || !inputDraftDirty || !editable || !inputOwner) return;
    try {
      const editedValues = Object.fromEntries(Object.entries(quickInputsDraft).filter(([id]) => editedInputIds.current.has(id)));
      localStorage.setItem(draftKey, JSON.stringify({ revision: sheet.revision, version: inputBaseVersion.current, values: changedInputDrafts(editedValues, sheet.parameter_values) }));
      setDraftRecoveryError("");
    } catch { setDraftRecoveryError("Browser recovery storage is unavailable. Keep this page open until the shared save succeeds."); }
  }, [quickInputsDraft, inputDraftDirty, sheet?.id, sheet?.version, editable, inputOwner, draftKey, draftMatchesSheet]);
  useEffect(() => {
    if (!inputDraftDirty || !editable || !inputOwner || busy || autoSavePaused || !draftMatchesSheet) return;
    const timer = window.setTimeout(() => { void saveQuickInputs(true); }, 1500);
    return () => window.clearTimeout(timer);
  }, [quickInputsDraft, inputDraftDirty, editable, inputOwner, busy, autoSavePaused, sheet?.id, draftMatchesSheet]);
  useEffect(() => {
    if (!sheet) {
      assessmentDraftScope.current = "";
      setAssessmentDrafts({});
      return;
    }
    const currentScope = assessmentKey;
    const scopeChanged = assessmentDraftScope.current !== currentScope;
    if (!scopeChanged && assessmentDraftDirty) return;
    assessmentDraftScope.current = currentScope;
    const saved = Object.fromEntries(parameters
      .filter((p) => p.lead === estimateDept || p.reviewers.includes(estimateDept))
      .map((p) => [p.id, { ...emptyResponse, ...sheet.parameter_values[p.id]?.responses[estimateDept] }]));
    let recovered: ReturnType<typeof readAssessmentDraft>;
    if (scopeChanged && editable && membership) {
      try { recovered = readAssessmentDraft(localStorage.getItem(assessmentKey), sheet.revision); } catch { /* Recovery is optional. */ }
    }
    const restored = Object.fromEntries(Object.entries(recovered?.values || {}).filter(([id]) => id in saved));
    setAssessmentDrafts({ ...saved, ...restored });
    if (scopeChanged) {
      assessmentGeneration.current++;
      setAssessmentDraftDirty(Object.keys(restored).length > 0);
      if (Object.keys(restored).length) setNotice("Recovered your department assessment draft. Review it before saving; no approval was submitted.");
    }
  }, [sheet?.id, sheet?.version, estimateDept, assessmentDraftDirty, assessmentKey]);
  useEffect(() => {
    if (!sheet || !editable || !membership || !assessmentDraftDirty || assessmentDraftScope.current !== assessmentKey) return;
    assessmentGeneration.current++;
    try {
      const changed = Object.fromEntries(Object.entries(assessmentDrafts).filter(([id, row]) => {
        const saved = sheet.parameter_values[id]?.responses[estimateDept] || emptyResponse;
        return ["status", "remarks", "evidence", "ownerId", "dueDate"].some(key => row[key as keyof ParameterResponse] !== saved[key as keyof ParameterResponse]);
      }));
      localStorage.setItem(assessmentKey, JSON.stringify({revision: sheet.revision, version: sheet.version, values: changed}));
    } catch { setDraftRecoveryError("Browser recovery storage is unavailable. Save department inputs before leaving this page."); }
  }, [assessmentDrafts, assessmentDraftDirty, assessmentKey, editable, membership]);
  const stats = inputReadiness(sheet?.parameter_values || {}, parameters);
  const changedInputCount = sheet ? parameters.filter((p) => {
    if (!editedInputIds.current.has(p.id)) return false;
    const before = sheet.parameter_values[p.id] || emptyRow;
    const after = quickInputsDraft[p.id] || { input: "", source: "", finalValue: "" };
    return before.input !== after.input || before.source !== after.source || before.finalValue !== after.finalValue;
  }).length : 0;
  const assessmentParameters = parameters.filter((p) => p.lead === estimateDept || p.reviewers.includes(estimateDept));
  const changedAssessmentCount = sheet ? assessmentParameters.filter((p) => {
    const before = sheet.parameter_values[p.id]?.responses[estimateDept] || emptyResponse;
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
    if (!membership) {
      if (!isDemoInputActionAllowed(action)) {
        setError("DEMO ONLY preview supports local draft inputs only. Approval, freeze, and downstream workflow actions require an authorized shared workspace.");
        setBusy(false);
        return false;
      }
      try {
        const selectedSourceId = payload["sourceId"];
        const selectedScope = payload["scope"];
        if (
          typeof selectedSourceId !== "string" ||
          (selectedScope !== "Client" && selectedScope !== "Internal")
        ) {
          throw new Error("DEMO_INPUT_SOURCE_INVALID");
        }
        const snapshot = createDemoFeasibilitySheet(
          query.data || { sheets: [], events: [] },
          sources,
          selectedSourceId,
          selectedScope,
          new Date().toISOString(),
          s10Scenario!,
        );
        localStorage.setItem(demoInputStorageKey, JSON.stringify(snapshot));
        queryClient.setQueryData(
          ["project-inputs", effectiveMembership.organizationId, effectiveMembership.membershipId],
          snapshot,
        );
        setNotice("DEMO ONLY · Created a browser-local Draft feasibility sheet. No approval, freeze, or downstream tasks were created.");
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to create the local demo draft.");
        return false;
      } finally {
        setBusy(false);
      }
    }
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
  async function saveQuickInputs(automatic = false) {
    if (!sheet || busy || inputSaveInFlight.current || !editable || !inputOwner) return;
    inputSaveInFlight.current = true;
    const savingDraftKey = draftKey;
    const generation = inputEditGeneration.current;
    const snapshot = quickInputsDraft;
    setBusy(true);
    setError("");
    setNotice("");
    let currentVersion = automatic ? inputBaseVersion.current : sheet.version;
    let localSheet = sheet;
    let saved = 0;
    const changed = parameters.filter((p) => {
      if (!editedInputIds.current.has(p.id)) return false;
      const before = sheet.parameter_values[p.id] || emptyRow;
      const after = snapshot[p.id] || { input: "", source: "", finalValue: "" };
      return before.input !== after.input || before.source !== after.source || before.finalValue !== after.finalValue;
    });
    try {
      for (const p of changed) {
        const current = sheet.parameter_values[p.id] || emptyRow;
        const payload = {
          sheetId: sheet.id,
          expectedVersion: currentVersion,
          parameterId: p.id,
          input: snapshot[p.id]?.input || "",
          source: snapshot[p.id]?.source || "",
          finalValue: snapshot[p.id]?.finalValue || "",
          required: current.required !== false,
          exclusionReason: (current as ParameterValue & { exclusionReason?: string }).exclusionReason || "",
        };
        let result: InputSheet;
        if (membership) {
          result = await write({ data: { action: "input", payload } });
        } else {
          result = { ...localSheet, version: currentVersion + 1, updated_at: new Date().toISOString(), parameter_values: { ...localSheet.parameter_values, [p.id]: { ...current, input: payload.input, source: payload.source, finalValue: payload.finalValue } } };
          const demoSnapshot = { sheets: (query.data?.sheets || []).map(existing => existing.id === result.id ? result : existing), events: query.data?.events || [] };
          localStorage.setItem(demoInputStorageKey, JSON.stringify(demoSnapshot));
          localSheet = result;
        }
        currentVersion = result.version;
        queryClient.setQueryData<import("@/lib/project-inputs.functions").InputSnapshot>(["project-inputs", effectiveMembership.organizationId, effectiveMembership.membershipId], current => current ? { ...current, sheets: current.sheets.map(existing => existing.id === result.id && existing.version <= result.version ? result : existing) } : current);
        saved += 1;
      }
      await query.refetch();
      if (inputDraftSheetId.current === savingDraftKey) {
        inputBaseVersion.current = currentVersion;
        if (inputEditGeneration.current === generation) {
          editedInputIds.current.clear();
          setInputDraftDirty(false);
          try { localStorage.removeItem(savingDraftKey); } catch { /* Server save is already confirmed. */ }
        }
        setAutoSavePaused(false);
        setNotice(changed.length ? `Saved ${saved} parameter${saved === 1 ? "" : "s"} ${membership ? "to the shared project sheet" : "in this browser’s demo workspace"}.` : "No input changes to save.");
      }
    } catch (e) {
      await query.refetch();
      if (inputDraftSheetId.current === savingDraftKey) {
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
    if (!membership) { setError("Sign in to save department assessments to the shared workspace."); return; }
    const savingScope = assessmentKey;
    const generation = assessmentGeneration.current;
    const changed = assessmentParameters.filter((p) => {
      const before = sheet.parameter_values[p.id]?.responses[estimateDept] || emptyResponse;
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
          department: estimateDept,
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
      if (assessmentDraftScope.current === savingScope && assessmentGeneration.current === generation) {
        setAssessmentDraftDirty(false);
        try { localStorage.removeItem(savingScope); } catch { /* Shared save is confirmed. */ }
      }
      setNotice(changed.length ? `Saved ${saved} ${estimateDept} department assessment${saved === 1 ? "" : "s"}.` : "No department assessment changes to save.");
    } catch (e) {
      await query.refetch();
      setError(saved
        ? `Saved ${saved} of ${changed.length} department updates. Remaining edits are still here; refresh the shared sheet before retrying. ${e instanceof Error ? e.message : "Save failed."}`
        : e instanceof Error ? e.message : "Department update failed. Your edits are preserved.");
    } finally {
      setBusy(false);
    }
  }
  async function saveFeasibilityEstimate() {
    if (!sheet || !estimateDraft || !membership || effectiveMembership.role !== "department_lead" || !estimateDept) return;
    if (!lifecycle.data?.revision?.id) { setError("The saved lifecycle settings could not be confirmed. Reload settings before saving this estimate."); return; }
    const stageDays = { ...defaultStageDurationDays };
    const tasks = departmentLifecycleTasks.map(({ stage, task, key }) => ({ stage, task, plan: estimateDraft.taskPlan[key] }));
    if (tasks.some(({ stage, plan }) => !plan || plan.effortHours <= 0 || plan.durationDays <= 0 || plan.startOffsetDays < 0 || plan.startOffsetDays + plan.durationDays > (stageDays[stage.code] ?? 1))) {
      setError("Give each configured department task an effort estimate and a timeline within its own stage duration.");
      return;
    }
    setEstimateBusy(true);
    setError("");
    setNotice("");
    try {
      const engineeringHours = tasks.reduce((total, item) => total + (item.plan?.effortHours || 0), 0);
      await saveEstimate({ data: {
        sheetId: sheet.id,
        expectedVersion: sheet.version,
        estimate: { ...estimateDraft, departmentCode: estimateDept, lifecycleRevisionId: lifecycle.data.revision.id, stageDurationDays: stageDays, taskPlan: Object.fromEntries(Object.entries(estimateDraft.taskPlan).map(([key, plan]) => [key, { ...plan, phase: plan.phase, stageCode: plan.stageCode }])), engineeringHours },
      } });
      await query.refetch();
      setNotice(`${estimateDept} task schedule and feasibility estimate saved to the shared sheet. This is a planning estimate, not spend approval.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Estimate did not save. Reload the sheet before retrying.");
      void query.refetch();
    } finally {
      setEstimateBusy(false);
    }
  }
  return (
    <section className="space-y-4" aria-label="Project inputs and feasibility">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-base flex items-center gap-2">
            <span>Inputs & Feasibility</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Client or internal requirements, departmental assessments and an approved specification
            baseline. Example hints are not decided values.
          </p>
          {!membership && (
            <p role="note" className="text-xs font-medium text-amber-700 dark:text-amber-300">
              DEMO ONLY · Browser-local draft preview. No client approval, measurements,
              certification, readiness, feasibility freeze, or downstream work is asserted.
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSorModalOpen(true)}
          className="inline-flex items-center gap-1.5 border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 shadow-xs cursor-pointer font-semibold"
          title="Import OEM Statement of Requirements (SOR) to pre-fill parameters and Opportunity"
        >
          <Sparkles className="size-3.5" />
          <span>Smart SOR Importer</span>
        </Button>
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
            {!membership ? "DEMO ONLY · " : ""}
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
            <p className="text-[11px] text-muted-foreground">
              {!membership
                ? "Start a browser-local DEMO ONLY draft sheet. Approval and downstream work stay blocked."
                : "Start the shared feasibility sheet for this entry."}
            </p>
          </div>
          {["admin", "department_lead"].includes(effectiveMembership.role) && (
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
                {!membership ? "Start DEMO ONLY draft" : "Start sheet"}
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
                  <Button size="sm" variant="outline" disabled={busy || !["admin", "department_lead"].includes(effectiveMembership.role)} onClick={() => { setSourceId(record.id); setScope(inferScope(record)); setFilter(""); }}>
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
          {editable && effectiveMembership.role === "admin" && (
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
          {membership && sheet.status === "Draft" && (
            <section className="space-y-3 rounded-lg border border-border bg-card p-3" aria-label="Department lifecycle budget and task timeline estimate">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Feasibility budget and lifecycle task plan</h3>
                  <p className="text-xs text-muted-foreground">Admin sets each stage’s default duration. During feasibility, department leads estimate their assigned tasks and schedule them inside the applicable stage window.</p>
                </div>
                <span className="rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[10px] font-medium text-amber-800 dark:text-amber-200">Estimate only · no spend approval</span>
              </div>
              {(effectiveMembership.role === "admin" || dept === "FIN") && Object.keys(visibleEstimates).length > 0 && (
                <div className="rounded border border-border p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold">Visible departmental estimate subtotal</span>
                    <span className="font-mono font-semibold">{visibleEstimates[Object.keys(visibleEstimates)[0]!]!.currency} {estimateTotal.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                    {Object.entries(visibleEstimates).map(([code, value]) => <span key={code} className="rounded bg-muted px-2 py-1">{code} · {value.engineeringHours} h · {Object.keys(value.taskPlan).length} lifecycle tasks</span>)}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">Subtotal includes BOM, reusable/consumable materials, lab and tooling. Engineering effort remains in hours until approved role rates are configured.</p>
                </div>
              )}
              {effectiveMembership.role === "department_lead" && estimateDept && (
                <>
                  {estimateDepartments.length > 1 && <label className="grid max-w-sm gap-1 text-xs">Work as configured department role<select aria-label="Feasibility department role" className={field} value={estimateDept} onChange={event => setEstimateDepartmentCode(event.target.value)}>{estimateDepartments.map(code => <option key={code} value={code}>{people.data?.departments.find(department => department.code === code)?.name || code} · {code}</option>)}</select></label>}
                  {departmentRoles.error && <p role="status" className="text-[10px] text-amber-700 dark:text-amber-300">Additional department roles could not be loaded; only your primary department is available until Settings reconnects.</p>}
                  <p className="text-xs font-medium">{estimateDept} · {departmentLifecycleTasks.length} configured lifecycle tasks · {Object.values(estimateDraft?.taskPlan ?? {}).reduce((sum, plan) => sum + plan.effortHours, 0)} estimated engineering hours</p>
                  {!recordedTrack && selectedFeasibilitySource && <p role="status" className="text-[11px] text-muted-foreground">No engineering track is recorded yet. These are provisional tasks across configured candidate tracks; the saved track will filter out stages that do not apply.</p>}
                  <p className="text-[10px] text-muted-foreground" aria-label="Phase duration planning reference">Phase duration ranges remain Admin planning targets; task offsets below are relative to their own stage duration.</p>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <label className="grid gap-1 text-[10px] text-muted-foreground">Preliminary BOM cost ({estimateDraft?.currency || "INR"})<input aria-label="Preliminary BOM estimate" className={field} type="number" min="0" step="0.01" value={estimateDraft?.preliminaryBomCost ?? 0} onChange={(event) => setEstimateDraft((current) => current ? { ...current, preliminaryBomCost: Number(event.target.value) || 0 } : current)} /></label>
                    <label className="grid gap-1 text-[10px] text-muted-foreground">Reusable material value ({estimateDraft?.currency || "INR"})<input aria-label="Reusable material estimate" className={field} type="number" min="0" step="0.01" value={estimateDraft?.reusableMaterialValue ?? 0} onChange={(event) => setEstimateDraft((current) => current ? { ...current, reusableMaterialValue: Number(event.target.value) || 0 } : current)} /></label>
                    <label className="grid gap-1 text-[10px] text-muted-foreground">Consumables ({estimateDraft?.currency || "INR"})<input aria-label="Consumable estimate" className={field} type="number" min="0" step="0.01" value={estimateDraft?.consumableCost ?? 0} onChange={(event) => setEstimateDraft((current) => current ? { ...current, consumableCost: Number(event.target.value) || 0 } : current)} /></label>
                    <label className="grid gap-1 text-[10px] text-muted-foreground">Lab / certification fees ({estimateDraft?.currency || "INR"})<input aria-label="Lab and certification estimate" className={field} type="number" min="0" step="0.01" value={estimateDraft?.labCertificationFees ?? 0} onChange={(event) => setEstimateDraft((current) => current ? { ...current, labCertificationFees: Number(event.target.value) || 0 } : current)} /></label>
                    <label className="grid gap-1 text-[10px] text-muted-foreground">Tooling CapEx ({estimateDraft?.currency || "INR"})<input aria-label="Tooling capital expenditure estimate" className={field} type="number" min="0" step="0.01" value={estimateDraft?.toolingCapex ?? 0} onChange={(event) => setEstimateDraft((current) => current ? { ...current, toolingCapex: Number(event.target.value) || 0 } : current)} /></label>
                  </div>
                  {departmentLifecycleTasks.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium">Tasks are auto-planned within their own stage duration; lead can edit effort and timing</p>
                        <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => { setEstimateDraft((current) => current ? { ...current, ...(lifecycle.data?.revision?.id ? { lifecycleRevisionId: lifecycle.data.revision.id } : {}), stageDurationDays: defaultStageDurationDays, taskPlan: autoPlanFeasibilityTasks(defaultStageDurationDays) } : current); setEstimateScheduleReviewed(true); }}>Auto-plan tasks</button>
                      </div>
                      {estimateReview?.requiresReview && <div className="space-y-2 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs"><p role="status">Lifecycle settings changed{estimateReview.changedStageCodes.length ? ` for ${estimateReview.changedStageCodes.join(", ")}` : ""}. Saved task timings are preserved. Review each task against the current Admin stage window, or choose “Auto-plan tasks” to propose a fresh schedule.</p><label className="flex items-start gap-2"><input aria-label="Confirm feasibility task schedule review" type="checkbox" checked={estimateScheduleReviewed} onChange={event => setEstimateScheduleReviewed(event.target.checked)} /><span>I reviewed this department’s task timeline against the current lifecycle settings.</span></label></div>}
                      {COMPANY_PHASES.map(([phase, label]) => {
                        const phaseStages = [...new Set(departmentLifecycleTasks.filter(({ stage }) => stage.phase === phase).map(({ stage }) => stage.code))];
                        if (!phaseStages.length) return null;
                        return <details key={phase} open={phase === "TG_0"} className="rounded border border-border">
                          <summary className="cursor-pointer bg-muted/40 px-3 py-2 text-xs font-medium">{phase.replace("TG_", "Phase ")} · {label} · {phaseStages.length} stages</summary>
                          <div className="space-y-2 p-2">
                            {phaseStages.map((stageCode) => {
                              const items = departmentLifecycleTasks.filter(({ stage }) => stage.code === stageCode);
                              const stage = items[0]!.stage;
                              const days = defaultStageDurationDays[stage.code] ?? 1;
                              const sla = phaseDurationDefaults[phase].taskSlaMinHours;
                              return <details key={stage.code} open className="rounded border border-border">
                                <summary className="cursor-pointer px-3 py-2 text-xs">{stage.code} · {stage.name} · Admin default {days} working days · {items.length} tasks</summary>
                                <div className="overflow-x-auto">
                                  <table className="w-full min-w-[620px] text-left text-xs">
                                    <thead className="bg-muted/50"><tr><th className="p-2">Task</th><th>Effort (h)</th><th>Start offset (days)</th><th>Duration (days)</th></tr></thead>
                                    <tbody>{items.map(({ task, key }) => {
                                      const plan = estimateDraft?.taskPlan[key] ?? { stageCode: stage.code, phase, effortHours: task.estimatedHoursMin ?? sla, startOffsetDays: 0, durationDays: 1 };
                                      const updatePlan = (patch: Partial<typeof plan>) => setEstimateDraft((current) => current ? { ...current, taskPlan: { ...current.taskPlan, [key]: { ...plan, ...patch, stageCode: stage.code, phase } } } : current);
                                      return <tr className="border-t border-border" key={key}>
                                        <td className="p-2" title={task.description}>{task.title}</td>
                                        <td><input aria-label={`${stage.code} ${task.title} estimated effort hours`} className={`${field} min-w-20`} type="number" min="1" value={plan.effortHours} onChange={(event) => updatePlan({ effortHours: Number(event.target.value) || 0 })} /></td>
                                        <td><input aria-label={`${stage.code} ${task.title} start offset days`} className={`${field} min-w-20`} type="number" min="0" max={Math.max(0, days - 1)} value={plan.startOffsetDays} onChange={(event) => updatePlan({ startOffsetDays: Number(event.target.value) || 0 })} /></td>
                                        <td><input aria-label={`${stage.code} ${task.title} duration days`} className={`${field} min-w-20`} type="number" min="1" max={days} value={plan.durationDays} onChange={(event) => updatePlan({ durationDays: Number(event.target.value) || 0 })} /></td>
                                      </tr>;
                                    })}</tbody>
                                  </table>
                                </div>
                              </details>;
                            })}
                          </div>
                        </details>;
                      })}
                    </div>
                  )}
                  <label className="grid gap-1 text-[10px] text-muted-foreground">Assumptions / exclusions<textarea aria-label="Feasibility estimate assumptions" className={field} rows={2} maxLength={2000} value={estimateDraft?.assumptions || ""} onChange={(event) => setEstimateDraft((current) => current ? { ...current, assumptions: event.target.value } : current)} /></label>
                  <Button size="sm" disabled={estimateBusy || !estimateDraft || !departmentLifecycleTasks.length || Boolean(estimateReview?.requiresReview && !estimateScheduleReviewed)} onClick={() => void saveFeasibilityEstimate()}>{estimateBusy ? "Saving estimate…" : estimateForDepartment ? "Update department estimate" : "Save department estimate"}</Button>
                </>
              )}
              {effectiveMembership.role !== "department_lead" && effectiveMembership.role !== "admin" && <p className="text-xs text-muted-foreground">Department leads submit effort, task timing and cost inputs. Finance reviews the roll-up; saving an estimate does not authorize spend.</p>}
            </section>
          )}
          {editable && inputOwner && <p role="status" className="text-[11px] text-muted-foreground">{busy ? (membership ? "Saving to shared project inputs…" : "Saving browser-local demo inputs…") : autoSavePaused ? "Automatic save paused — review your draft and use Save inputs to retry." : inputDraftDirty ? "Draft changed · automatically saving after you finish typing…" : membership ? "Inputs saved · draft autosave is on." : "Demo inputs saved in this browser · draft autosave is on."}{draftRecoveryError ? ` ${draftRecoveryError}` : ""}</p>}
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
            {editable && effectiveMembership.role === "department_lead" && changedAssessmentCount > 0 && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void saveDepartmentInputs()}>
                {busy ? "Saving…" : `Save ${estimateDept} updates · ${changedAssessmentCount}`}
              </Button>
            )}
          </div>
          {departmentView !== "All" && <p className="text-[11px] text-muted-foreground">Showing {rows.length} shared parameters related to {departmentView}; department actions are enabled only for your configured {estimateDept || dept} role.</p>}
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
                      if (!editedInputIds.current.size) inputBaseVersion.current = sheet.version;
                      editedInputIds.current.add(p.id);
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
                      const canAssess = code === estimateDept && p.lead === estimateDept && editable && effectiveMembership.role === "department_lead" && estimateDepartments.includes(estimateDept);
                      const canQuery = code === estimateDept && p.lead !== estimateDept && p.reviewers.includes(estimateDept) && editable && effectiveMembership.role === "department_lead" && estimateDepartments.includes(estimateDept);
                      const responseDraft = assessmentDrafts[p.id] || { ...emptyResponse, ...response };
                      return (
                        <div className="mt-2 border-t border-border/50 pt-2" key={code}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-medium">{code} · {response?.status || "Awaiting assessment"}{response?.reviewedBy ? " · Reviewed" : ""}{p.lead === code ? " · Primary owner" : " · Reviewer"}</p>
                            {canAssess && response && response.status !== "Pending" && !response.reviewedBy && <Button size="sm" variant="outline" disabled={busy} onClick={() => void save("review_response", { parameterId: p.id, department: estimateDept })}>Confirm department review</Button>}
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
              {editable && effectiveMembership.role === "department_lead" && changedAssessmentCount > 0 && <Button variant="outline" disabled={busy} onClick={() => void saveDepartmentInputs()}>{busy ? "Saving…" : `Save ${estimateDept} assessments · ${changedAssessmentCount}`}</Button>}
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
                              effectiveMembership.role === "department_lead" &&
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
          {membership && editable && inputOwner && sheet.scope === "Client" && (
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
          {membership && !sheet.project_record_id && (effectiveMembership.role === "admin" || dept === "SAL") && (
            <div className="flex gap-2">
              <div className="flex-1">
                <SharedMasterSelect
                  label="Link accepted project"
                  options={sources
                    .filter((s) => s.type === "Project" && isSelectableMasterStatus(s.status))
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
          {membership && editable && effectiveMembership.role === "admin" && (
            <Button
              disabled={busy || sheet.input_owner_id === effectiveMembership.membershipId}
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
          {sheet.project_record_id && (
            <CustomerChangeRequestsPanel
              membership={membership}
              sheet={sheet}
              departments={people.data?.departments.map(({ code, name }) => ({ code, name })) || []}
            />
          )}
        </>
      )}
      {membership && editable && ["admin", "department_lead"].includes(effectiveMembership.role) && dept && (
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
      {sorModalOpen && (
        <SmartSorImporterModal
          isOpen={sorModalOpen}
          purpose="inputs"
          onClose={() => setSorModalOpen(false)}
          onImportSor={async (sorData) => {
            if (!sheet || !editable || !inputOwner) throw new Error("Only the input coordinator can import into a draft sheet.");
            const patch: Record<string, { input: string; source: string; finalValue: string }> = {};
            for (const [key, val] of Object.entries(sorData.parameterValues)) {
              if (!parameters.some(p => p.id === key) || !val.trim()) continue;
              const existing = quickInputsDraft[key];
              if (existing?.input.trim() || existing?.finalValue.trim()) continue;
              if (!editedInputIds.current.size) inputBaseVersion.current = sheet.version;
              editedInputIds.current.add(key);
              patch[key] = {
                input: val,
                source: `Smart SOR Import · ${sorData.customerName || "Customer Requirements"}`,
                finalValue: "",
              };
            }
            inputEditGeneration.current++;
            setInputDraftDirty(Object.keys(patch).length > 0 || inputDraftDirty);
            setQuickInputsDraft((prev) => ({ ...prev, ...patch }));
            setNotice(`Added ${Object.keys(patch).length} source inputs. Existing values were preserved; new values will autosave as drafts.`);
          }}
        />
      )}
    </section>
  );
}
