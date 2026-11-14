import { useRef, useState } from "react";
import { completeLifecycleDefinitions } from "@/lib/lifecycle-stage-extensions";
import {
  COMPANY_PHASES,
  DEFAULT_PHASE_DURATIONS,
  getDefaultStageDurationDays,
  validateLifecycleRevision,
  type LifecycleRevision,
  type LifecycleStageDefinition,
  type CompanyPhase,
} from "@/lib/lifecycle-baseline";

export function LifecycleSettingsEditor({
  revision,
  onActivate,
  departments,
  editableDepartmentCodes,
  assigneeRolesByDepartment,
}: {
  revision: LifecycleRevision;
  onActivate: (value: LifecycleRevision) => void | Promise<void>;
  departments?: { code: string; name: string; active?: boolean }[];
  /** null/undefined means unrestricted Admin editor; [] is read-only. */
  editableDepartmentCodes?: string[] | null;
  assigneeRolesByDepartment?: Record<string, { id: string; name: string; holders: string[]; hierarchyLevel?: number | null }[]>;
}) {
  const initialSelectedStage =
    editableDepartmentCodes == null
      ? (revision.stages[0]?.code ?? "")
      : ((
          revision.stages.find((s) => editableDepartmentCodes.includes(s.department)) ??
          revision.stages.find((s) =>
            s.tasks.some((task) => editableDepartmentCodes.includes(task.department)),
          )
        )?.code ?? "");
  const initialSelectedPhase =
    revision.stages.find((s) => s.code === initialSelectedStage)?.phase ?? "TG_0";
  const [draft, setDraft] = useState<LifecycleRevision>(() => ({
    ...structuredClone(revision),
    stages: (editableDepartmentCodes == null
      ? completeLifecycleDefinitions(revision)
      : structuredClone(revision.stages)
    ).map((s) => ({
      ...structuredClone(s),
      durationDays: getDefaultStageDurationDays(revision, s),
      tasks: s.tasks.map((task) => ({
        ...task,
        description:
          editableDepartmentCodes == null
            ? task.description.replace(/^Workbook HW\+FW\+SW!L\d+\.\s*/, "")
            : task.description,
      })),
      ...(s.raci
        ? { raci: structuredClone(s.raci) }
        : editableDepartmentCodes == null
          ? { raci: {
              R: [...new Set([s.department, ...s.tasks.map((t) => t.department)])],
              A: [s.department],
              C: [],
              I: [],
            } }
          : {}),
    })),
  }));
  const [selected, setSelected] = useState(initialSelectedStage);
  const [selectedPhase, setSelectedPhase] = useState<CompanyPhase>(initialSelectedPhase);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [search, setSearch] = useState("");
  const [savedRevision, setSavedRevision] = useState(() => JSON.stringify(draft));
  const pending = useRef<{ signature: string; value: LifecycleRevision } | null>(null);
  const scopedCodes = editableDepartmentCodes == null ? null : new Set(editableDepartmentCodes);
  const canEditAll = scopedCodes === null;
  const stage = draft.stages.find((s) => s.code === selected);
  const matchesFilter = (
    s: LifecycleStageDefinition,
    department = departmentFilter,
    text = search,
  ) =>
    (!department ||
      s.department === department ||
      s.tasks.some((t) => t.department === department) ||
      Object.values(s.raci ?? {}).some((values) => values.includes(department))) &&
    (!text.trim() ||
      `${s.code} ${s.name} ${s.tasks.map((t) => t.title).join(" ")}`
        .toLowerCase()
        .includes(text.trim().toLowerCase()));
  const inLeadTaskScope = (s: LifecycleStageDefinition) =>
    canEditAll || (!!scopedCodes?.size && s.tasks.some((task) => scopedCodes.has(task.department)));
  const visibleStages = draft.stages.filter(
    (s) => s.phase === selectedPhase && inLeadTaskScope(s) && matchesFilter(s),
  );
  const phaseStages = draft.stages.filter((s) => s.phase === selectedPhase && matchesFilter(s));
  const leadStages = draft.stages.filter(inLeadTaskScope);
  const saved = JSON.parse(savedRevision) as LifecycleRevision;
  const changedStages = draft.stages.filter(
    (s) => JSON.stringify(s) !== JSON.stringify(saved.stages.find((previous) => previous.code === s.code)),
  );
  const savedStageDefinitions = [...saved.stages, ...(saved.retiredStages ?? [])];
  const draftStageDefinitions = [...draft.stages, ...(draft.retiredStages ?? [])];
  const changedStageCodes = [...new Set([...savedStageDefinitions, ...draftStageDefinitions].map((s) => s.code))]
    .filter((code) => JSON.stringify(savedStageDefinitions.find((s) => s.code === code)) !== JSON.stringify(draftStageDefinitions.find((s) => s.code === code)));
  const retiredStageCodes = new Set((draft.retiredStages ?? []).map((s) => s.code));
  const changedPhases = COMPANY_PHASES.filter(([phase]) =>
    JSON.stringify(draft.phaseDurations?.[phase]) !== JSON.stringify(saved.phaseDurations?.[phase]),
  );
  const dirty = changedStageCodes.length > 0 || changedPhases.length > 0;
  const selectPhase = (phase: CompanyPhase) => {
    setSelectedPhase(phase);
    setSelected(
      draft.stages.find((s) => s.phase === phase && inLeadTaskScope(s) && matchesFilter(s))?.code ??
        "",
    );
  };
  const update = (patch: Partial<LifecycleStageDefinition>) =>
    setDraft((d) => ({
      ...d,
      stages: d.stages.map((s) => (s.code === selected ? { ...s, ...patch } : s)),
    }));
  const field = "w-full rounded border border-input bg-background p-2 text-sm text-foreground";
  const departmentOptions =
    departments?.filter((d) => d.active !== false && d.code !== "CLIENT") ?? [];
  const canEditStage = (s: LifecycleStageDefinition) =>
    canEditAll || (!!scopedCodes?.size && scopedCodes.has(s.department));
  const canEditTask = (task: LifecycleStageDefinition["tasks"][number]) =>
    canEditAll || (!!scopedCodes?.size && scopedCodes.has(task.department));
  const configuredCodes = new Set(departmentOptions.map((d) => d.code.replace(/^DEMO-/, "")));
  const errors = [
    ...validateLifecycleRevision(draft),
    ...draft.stages.flatMap((s) =>
      [s.department, ...s.tasks.map((t) => t.department), ...Object.values(s.raci ?? {}).flat()]
        .filter((code) => !configuredCodes.has(code))
        .map((code) => `${s.code}: department ${code} is not active in Settings`),
    ),
  ].filter((value, index, all) => all.indexOf(value) === index);
  const departmentSelect = (value: string, onChange: (code: string) => void, label: string) => (
    <select
      aria-label={label}
      className={field}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {!configuredCodes.has(value) && <option value={value}>{value} · unavailable</option>}
      {departmentOptions.map((d) => (
        <option key={d.code} value={d.code.replace(/^DEMO-/, "")}>
          {d.code.replace(/^DEMO-/, "")} · {d.name}
        </option>
      ))}
    </select>
  );
  const roleNames = { R: "Responsible", A: "Accountable", C: "Consulted", I: "Informed" } as const;
  const defaultRaci = (s: LifecycleStageDefinition) =>
    s.raci ?? {
      R: [...new Set([s.department, ...s.tasks.map((t) => t.department)])],
      A: [s.department],
      C: [],
      I: [],
    };
  const updateStageRaci = (code: string, role: "R" | "A" | "C" | "I", values: string[]) =>
    setDraft((d) => ({
      ...d,
      stages: d.stages.map((s) =>
        s.code !== code ? s : { ...s, raci: { ...defaultRaci(s), [role]: values } },
      ),
    }));
  const roleCell = (s: LifecycleStageDefinition, role: "R" | "A" | "C" | "I") => {
    const values = defaultRaci(s)[role];
    if (!canEditAll)
      return (
        <span aria-label={`${roleNames[role]} departments for ${s.code}`}>
          {values.length ? values.join(", ") : "—"}
        </span>
      );
    if (role === "A")
      return (
        <select
          className="max-w-48 rounded border border-input bg-background p-1 text-xs"
          aria-label={`Accountable department for ${s.code}`}
          value={values[0] ?? ""}
          onChange={(e) => updateStageRaci(s.code, "A", [e.target.value])}
        >
          <option value="" disabled>
            Choose accountable
          </option>
          {values[0] && !configuredCodes.has(values[0]) && (
            <option value={values[0]}>{values[0]} · unavailable</option>
          )}
          {departmentOptions.map((d) => (
            <option key={d.code} value={d.code.replace(/^DEMO-/, "")}>
              {d.code.replace(/^DEMO-/, "")} · {d.name}
            </option>
          ))}
        </select>
      );
    return (
      <details className="relative min-w-28">
        <summary
          className="cursor-pointer list-none rounded border border-input px-2 py-1 text-xs hover:bg-muted"
          aria-label={`${roleNames[role]} departments for ${s.code}`}
        >
          {values.length ? values.join(", ") : "Select…"} ▾
        </summary>
        <div className="absolute z-20 mt-1 max-h-56 min-w-48 overflow-auto rounded border border-border bg-popover p-2 shadow-lg">
          {departmentOptions.map((d) => {
            const code = d.code.replace(/^DEMO-/, "");
            const checked = values.includes(code);
            return (
              <label
                key={d.code}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked ? values.filter((v) => v !== code) : [...values, code];
                    updateStageRaci(s.code, role, next);
                  }}
                />
                {d.name} <span className="text-muted-foreground">{code}</span>
              </label>
            );
          })}
          {!departmentOptions.length && (
            <p className="text-xs text-muted-foreground">No active departments configured.</p>
          )}
        </div>
      </details>
    );
  };
  const saveRevision = async () => {
    setBusy(true);
    try {
      const signature = JSON.stringify(draft);
      if (pending.current?.signature !== signature)
        pending.current = {
          signature,
          value: {
            ...structuredClone(draft),
            id: `LC-TG-${crypto.randomUUID()}`,
            createdAt: new Date().toISOString(),
          },
        };
      await onActivate(pending.current.value);
      setSavedRevision(JSON.stringify(draft));
      pending.current = null;
      setNotice("New default revision saved. Existing project baselines were preserved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-4" aria-label="Lifecycle phase and task settings">
      <div>
        <h2 className="font-semibold">Lifecycle stages & default tasks</h2>
        <p className="text-sm text-muted-foreground">
          Company phases stay fixed. Edit internal stages and task defaults here; existing projects
          retain their pinned revision. Stage RACI below controls task ownership and
          completion-review routing. Historical Department chronicles & RACI remain available with
          their saved versions. Stage codes are stable references; retire or restore a stage to
          control future projects without rewriting history.
        </p>
        {scopedCodes !== null && (
          <p className="mt-1 text-xs text-muted-foreground">
            Department lead access is limited to default tasks owned by:{" "}
            {scopedCodes.size ? [...scopedCodes].join(", ") : "no configured department"}. Phase
            definitions, stage ownership, RACI and other departments’ tasks are read-only.
          </p>
        )}
        <p className="mt-1 text-xs">
          Current revision: {revision.id} ·{" "}
          {canEditAll
            ? `${draft.stages.length} stages · ${draft.stages.reduce((n, s) => n + s.tasks.length, 0)} default tasks`
            : `${leadStages.length} department stages · ${leadStages.reduce((n, s) => n + s.tasks.filter((task) => canEditTask(task)).length, 0)} department defaults`}
        </p>
      </div>
      <section className="rounded-lg border border-border bg-card p-3" aria-label="Default phase planning targets">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Phase planning targets and task SLAs</h3>
            <p className="text-xs text-muted-foreground">These are phase roll-up targets and reference task SLAs. Admin sets each stage’s task-planning duration in that stage’s configuration below.</p>
          </div>
          <span className="text-[10px] text-muted-foreground">Working days · task SLA hours</span>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-5">
          {COMPANY_PHASES.map(([phase, label]) => {
            const value = draft.phaseDurations?.[phase] ?? DEFAULT_PHASE_DURATIONS[phase];
            const setValue = (key: keyof typeof value, raw: string) => {
              const number = Number(raw);
              setDraft((current) => ({
                ...current,
                phaseDurations: {
                  ...DEFAULT_PHASE_DURATIONS,
                  ...current.phaseDurations,
                  [phase]: { ...value, ...current.phaseDurations?.[phase], [key]: Number.isFinite(number) ? number : 0 },
                },
              }));
            };
            return (
              <fieldset key={phase} className="rounded border border-border p-2" disabled={!canEditAll}>
                <legend className="px-1 text-[11px] font-semibold">{phase.replace("_", "-")}</legend>
                <p className="mb-2 truncate text-[10px] text-muted-foreground" title={label}>{label}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {([["minWorkingDays", "Days min"], ["maxWorkingDays", "Days max"], ["taskSlaMinHours", "Task h min"], ["taskSlaMaxHours", "Task h max"]] as const).map(([key, caption]) => (
                    <label key={key} className="text-[9px] text-muted-foreground">
                      {caption}
                      <input aria-label={`${phase} ${caption}`} type="number" min="1" className={`${field} mt-0.5 px-1.5 py-1 text-xs`} value={value[key]} onChange={(event) => setValue(key, event.target.value)} />
                    </label>
                  ))}
                </div>
                {phase === "TG_9" && <p className="mt-1 text-[9px] text-muted-foreground">Active through product life; days apply to EOL closure.</p>}
              </fieldset>
            );
          })}
        </div>
      </section>
      <div className="grid gap-2 sm:grid-cols-2">
        {canEditAll ? (
          <label className="text-xs">
            Department scope
            <select
              aria-label="Filter lifecycle departments"
              className={field}
              value={departmentFilter}
              onChange={(e) => {
                const code = e.target.value;
                setDepartmentFilter(code);
                setSelected(
                  draft.stages.find((s) => s.phase === selectedPhase && matchesFilter(s, code))
                    ?.code ?? "",
                );
              }}
            >
              <option value="">All configured departments</option>
              {departmentOptions.map((d) => (
                <option key={d.code} value={d.code.replace(/^DEMO-/, "")}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="text-xs">
            Your department
            <div className={`${field} mt-1 text-muted-foreground`}>
              {[...(scopedCodes ?? [])].join(", ") || "No department assigned"}
            </div>
          </div>
        )}
        <label className="text-xs">
          Find stage or task
          <input
            aria-label="Search lifecycle stages"
            className={field}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelected(
                draft.stages.find(
                  (s) =>
                    s.phase === selectedPhase && matchesFilter(s, departmentFilter, e.target.value),
                )?.code ?? "",
              );
            }}
            placeholder="Stage code, title or task…"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {COMPANY_PHASES.map(([code, title]) => (
          <button
            type="button"
            key={code}
            aria-label={`Phase ${code.slice(3)}: ${title}`}
            aria-pressed={selectedPhase === code}
            onClick={() => selectPhase(code)}
            className={`rounded border p-2 text-left text-xs ${selectedPhase === code ? "border-primary bg-primary/10" : "border-border"}`}
          >
            <strong>{code.replace("_", "-")}</strong>
            <p>{title}</p>
            <span className="text-muted-foreground">
              {(canEditAll ? draft.stages : leadStages).filter((s) => s.phase === code).length}{" "}
              stages
            </span>
          </button>
        ))}
      </div>
      {!canEditAll ? (
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full min-w-[820px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-y border-border bg-muted/50">
                <th className="p-2">Stage</th>
                <th className="p-2">R · Responsible</th>
                <th className="p-2">A · Accountable</th>
                <th className="p-2">C · Consulted</th>
                <th className="p-2">I · Informed</th>
                <th className="p-2">Your default tasks</th>
              </tr>
            </thead>
            <tbody>
              {phaseStages.map((s) => {
                const ownTasks = s.tasks.filter((task) => scopedCodes?.has(task.department));
                return (
                  <tr
                    key={s.code}
                    aria-selected={s.code === selected}
                    className={`border-b border-border align-top ${s.code === selected ? "bg-primary/10 ring-1 ring-inset ring-primary/60" : ""}`}
                  >
                    <th scope="row" className="p-2 font-medium">
                      {inLeadTaskScope(s) ? (
                        <button
                          type="button"
                          className={`text-left hover:underline ${s.code === selected ? "font-semibold text-primary" : ""}`}
                          aria-current={s.code === selected ? "true" : undefined}
                          onClick={() => setSelected(s.code)}
                        >
                          {s.code} · {s.name}
                        </button>
                      ) : (
                        <span>
                          {s.code} · {s.name}
                        </span>
                      )}
                    </th>
                    {(["R", "A", "C", "I"] as const).map((role) => (
                      <td key={role} className="p-2">
                        {roleCell(s, role)}
                      </td>
                    ))}
                    <td className="p-2">
                      {ownTasks.length ? ownTasks.map((task) => task.title).join("; ") : "—"}
                    </td>
                  </tr>
                );
              })}
              {!phaseStages.length && (
                <tr>
                  <td colSpan={6} className="p-3 text-muted-foreground">
                    No stages configured in this phase.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="px-3 pb-3 text-xs text-muted-foreground">
            Company-wide RACI is visible for coordination and read-only for department leads. Only
            your department’s default-task content is shown and editable.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-y border-border bg-muted/50">
                <th className="p-2">Stage</th>
                <th className="p-2">R · Responsible</th>
                <th className="p-2">A · Accountable</th>
                <th className="p-2">C · Consulted</th>
                <th className="p-2">I · Informed</th>
              </tr>
            </thead>
            <tbody>
              {visibleStages.map((s) => (
                <tr
                  key={s.code}
                  aria-selected={s.code === selected}
                  className={`border-b border-border align-top ${s.code === selected ? "bg-primary/10 ring-1 ring-inset ring-primary/60" : ""}`}
                >
                  <th scope="row" className="p-2 font-medium">
                    <button
                      type="button"
                      className={`text-left hover:underline ${s.code === selected ? "font-semibold text-primary" : ""}`}
                      aria-current={s.code === selected ? "true" : undefined}
                      onClick={() => setSelected(s.code)}
                    >
                      {s.code} · {s.name}
                    </button>
                  </th>
                  {(["R", "A", "C", "I"] as const).map((role) => (
                    <td key={role} className="p-2">
                      {roleCell(s, role)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 pb-3 text-xs text-muted-foreground">
            Changes are saved together as a new lifecycle revision. Task owners must remain within
            an R department; A receives the independent completion review.
          </p>
        </div>
      )}
      {stage && (
        <div className="space-y-2 rounded border border-border p-3">
          {stage.sourceReference && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Deliverables & review roles</summary>
              <p className="whitespace-pre-line">{stage.sourceReference.deliverables}</p>
              <p>
                Preparer: {stage.sourceReference.preparer} · Reviewer:{" "}
                {stage.sourceReference.reviewer}
              </p>
            </details>
          )}
          <div className="grid gap-2 rounded border border-border p-2 text-xs sm:grid-cols-2">
            <label>
              Prerequisites
              <input
                className={field}
                value={stage.prerequisites.join(", ")}
                disabled={!canEditAll}
                onChange={(e) =>
                  update({
                    prerequisites: e.target.value
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
            <label>
              Required exit records
              <input
                className={field}
                value={stage.exitTypes.join(", ")}
                disabled={!canEditAll}
                onChange={(e) =>
                  update({
                    exitTypes: e.target.value
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
          </div>
          {canEditAll && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">
                Stage configuration
              </summary>
              {canEditAll && (() => {
                const protectedCoreStage = /^(CM_0[1-4]|CL_0[1-3])$/.test(stage.code);
                const dependents = draft.stages.filter((candidate) => candidate.code !== stage.code && candidate.prerequisites.includes(stage.code));
                const reason = protectedCoreStage
                  ? "Core intake and closeout stages must remain available."
                  : dependents.length
                    ? "Required by " + dependents.map((dependent) => dependent.code).join(", ") + ". Update those prerequisites first."
                    : "Removes this stage from future project defaults. Existing project baselines remain unchanged.";
                return (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      className="rounded border border-destructive/50 px-2 py-1.5 text-xs text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                      title={reason}
                      aria-label={"Retire " + stage.code + " from future lifecycle defaults"}
                      disabled={protectedCoreStage || dependents.length > 0}
                      onClick={() => {
                        setDraft((current) => ({
                          ...current,
                          stages: current.stages.filter((item) => item.code !== stage.code),
                          retiredStages: [...(current.retiredStages ?? []).filter((item) => item.code !== stage.code), stage],
                        }));
                        setSelected(draft.stages.find((item) => item.code !== stage.code && item.phase === selectedPhase)?.code ?? "");
                      }}
                    >
                      Retire from future defaults
                    </button>
                  </div>
                );
              })()}
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <label>
                  Default stage duration (working days)
                  <input
                    aria-label={`${stage.code} default stage duration days`}
                    className={field}
                    type="number"
                    min="1"
                    max="365"
                    value={stage.durationDays ?? 1}
                    onChange={(e) => update({ durationDays: Number(e.target.value) || 1 })}
                  />
                  <span className="text-[10px] text-muted-foreground">Admin default; feasibility tasks are scheduled within this stage window.</span>
                </label>
                <label>
                  Stage name
                  <input
                    className={field}
                    value={stage.name}
                    onChange={(e) => update({ name: e.target.value })}
                  />
                </label>
                <label>
                  Internal gate
                  <input
                    className={field}
                    value={stage.gate}
                    onChange={(e) => update({ gate: e.target.value })}
                  />
                </label>
                <label>
                  Owner department
                  {departmentSelect(
                    stage.department,
                    (code) =>
                      update({
                        department: code,
                        raci: {
                          ...defaultRaci(stage),
                          R: [...new Set([...defaultRaci(stage).R, code])],
                        },
                      }),
                    "Owner department",
                  )}
                </label>
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={stage.optional}
                    onChange={(e) => update({ optional: e.target.checked })}
                  />
                  Optional (project omission requires a recorded decision)
                </label>
              </div>
            </details>
          )}
          <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
            <div>
              <h3 className="font-semibold">Default task templates</h3>
              <p className="text-xs text-muted-foreground">
                {canEditAll
                  ? "Future task generation · task descriptions are optional drafting guidance."
                  : `Future task generation · ${[...(scopedCodes ?? [])].join(", ")} defaults; descriptions are optional drafting guidance.`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {canEditAll
                  ? stage.tasks.length
                  : stage.tasks.filter((task) => canEditTask(task)).length}{" "}
                tasks
              </span>
              <button
                type="button"
                disabled={busy || !!errors.length || !dirty}
                className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
                onClick={saveRevision}
              >
                Save defaults
              </button>
            </div>
          </div>
          {(canEditAll ? stage.tasks : stage.tasks.filter((task) => canEditTask(task))).map(
            (task, i) => (
              <div className="space-y-1.5 rounded border border-border p-2" key={task.id}>
                <div className="flex items-center gap-2">
                  <input
                    aria-label={`Task ${i + 1} title`}
                    className={`${field} min-w-0 flex-1`}
                    value={task.title}
                    disabled={!canEditTask(task)}
                    onChange={(e) =>
                      update({
                        tasks: stage.tasks.map((t, n) =>
                          n === i ? { ...t, title: e.target.value } : t,
                        ),
                      })
                    }
                  />
                  {canEditTask(task) &&
                    canEditAll &&
                    departmentSelect(
                      task.department,
                      (code) =>
                        update({
                          tasks: stage.tasks.map((t, n) =>
                          n === i ? { ...t, department: code, assigneeRoleId: null, assigneeRoleLevels: {} } : t,
                          ),
                          raci: {
                            ...defaultRaci(stage),
                            R: [...new Set([...defaultRaci(stage).R, code])],
                          },
                        }),
                      `Task ${i + 1} department`,
                    )}
                  <button
                    type="button"
                    disabled={!canEditTask(task)}
                    className="shrink-0 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                    onClick={() => update({ tasks: stage.tasks.filter((_, n) => n !== i) })}
                  >
                    Remove
                  </button>
                </div>
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    Description / drafting guidance
                  </summary>
                  <textarea
                    aria-label={`Task ${i + 1} description`}
                    rows={2}
                    className={`${field} mt-1`}
                    value={task.description}
                    disabled={!canEditTask(task)}
                    onChange={(e) =>
                      update({
                        tasks: stage.tasks.map((t, n) =>
                          n === i ? { ...t, description: e.target.value } : t,
                        ),
                      })
                    }
                  />
                </details>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-muted-foreground">
                    Task effort min (hours)
                    <input aria-label={`Task ${i + 1} minimum estimated hours`} type="number" min="1" className={`${field} mt-1`} value={task.estimatedHoursMin ?? draft.phaseDurations?.[stage.phase]?.taskSlaMinHours ?? ""} disabled={!canEditTask(task)} onChange={(e) => update({ tasks: stage.tasks.map((t, n) => { if (n !== i) return t; const { estimatedHoursMin: _old, ...rest } = t; return e.target.value === "" ? rest : { ...t, estimatedHoursMin: Number(e.target.value) }; }) })} />
                  </label>
                  <label className="text-[10px] text-muted-foreground">
                    Task effort max (hours)
                    <input aria-label={`Task ${i + 1} maximum estimated hours`} type="number" min="1" className={`${field} mt-1`} value={task.estimatedHoursMax ?? draft.phaseDurations?.[stage.phase]?.taskSlaMaxHours ?? ""} disabled={!canEditTask(task)} onChange={(e) => update({ tasks: stage.tasks.map((t, n) => { if (n !== i) return t; const { estimatedHoursMax: _old, ...rest } = t; return e.target.value === "" ? rest : { ...t, estimatedHoursMax: Number(e.target.value) }; }) })} />
                  </label>
                </div>
                <div className="space-y-1.5 rounded bg-muted/30 p-2">
                  <p className="text-[10px] font-medium text-muted-foreground">Assignee ladder · L1 lead → L2 senior/specialist → L3 associate/technician → L4 operator/trainee</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["L1", "L2", "L3", "L4"] as const).map((level) => {
                      const selected = task.assigneeRoleLevels?.[level] ?? (level === "L1" ? task.assigneeRoleId ?? "" : "");
                      return <label key={level} className="text-[10px] text-muted-foreground">{level} {({L1:"Lead",L2:"Senior / specialist",L3:"Associate / technician",L4:"Operator / trainee"})[level]}
                        <select aria-label={`Task ${i + 1} ${level} assignee role`} className={`${field} mt-1`} value={selected} disabled={!canEditTask(task)} onChange={(e) => update({ tasks: stage.tasks.map((t,n) => n === i ? { ...t, ...(level === "L1" ? { assigneeRoleId: e.target.value || null } : {}), assigneeRoleLevels: { ...(t.assigneeRoleLevels ?? {}), [level]: e.target.value || null } } : t) })}>
                          <option value="">No preference</option>
                          {(assigneeRolesByDepartment?.[task.department] ?? []).filter((role) => role.hierarchyLevel === Number(level.slice(1))).map((role) => <option key={role.id} value={role.id} disabled={role.holders.length > 1}>{role.name} · {role.holders.length === 1 ? role.holders[0] : role.holders.length ? `${role.holders.length} members · choose one` : "Unassigned · fallback"}</option>)}
                        </select>
                      </label>;
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground">At task creation, use the first configured level that has exactly one active member; otherwise fall back toward L1, then the department lead. Existing tasks stay unchanged.</p>
                </div>
              </div>
            ),
          )}
          <button
            type="button"
            disabled={!canEditAll && !scopedCodes?.size}
            className="rounded border border-border px-3 py-2"
            onClick={() =>
              update({
                tasks: [
                  ...stage.tasks,
                  {
                    id: `T-${crypto.randomUUID()}`,
                    title: "New task",
                    description: "",
                    department: canEditAll
                      ? stage.department
                      : ([...(scopedCodes ?? [])][0] ?? stage.department),
                  },
                ],
              })
            }
          >
            Add default task
          </button>
        </div>
      )}
      {dirty && (
        <section
          aria-label="Lifecycle changes to save"
          className="rounded border border-border p-3 text-sm"
        >
          <strong>
            {changedStageCodes.length} stage{changedStageCodes.length === 1 ? "" : "s"} · {changedPhases.length} phase duration{changedPhases.length === 1 ? "" : "s"} changed
          </strong>
          <ul className="mt-2 space-y-1">
            {[...changedStages, ...(draft.retiredStages ?? []).filter((s) => changedStageCodes.includes(s.code) && retiredStageCodes.has(s.code))].map((s) => (
              <li key={s.code}>
                {s.code} · {s.name}{retiredStageCodes.has(s.code) ? " · retired from future defaults" : ""} ·{" "}
                {canEditAll ? s.tasks.length : s.tasks.filter((task) => canEditTask(task)).length}{" "}
                default tasks
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Saving creates defaults for future work. Existing project baselines and generated tasks
            retain their recorded configuration.
          </p>
          <button
            type="button"
            disabled={busy}
            className="mt-2 underline"
            onClick={() => {
              setDraft(JSON.parse(savedRevision));
              pending.current = null;
              setNotice("Unsaved lifecycle changes discarded.");
            }}
          >
            Discard changes
          </button>
        </section>
      )}
      {canEditAll && (draft.retiredStages ?? []).length > 0 && (
        <details className="rounded border border-border p-3 text-xs">
          <summary className="cursor-pointer font-medium">Retired stages · {(draft.retiredStages ?? []).length}</summary>
          <ul className="mt-2 space-y-2">
            {(draft.retiredStages ?? []).map((retired) => {
              const missingPrerequisites = retired.prerequisites.filter((code) => !draft.stages.some((candidate) => candidate.code === code));
              return (
                <li key={retired.code} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2">
                  <span>{retired.code} · {retired.name} · {retired.phase.replace("_", "-")}</span>
                  <button
                    type="button"
                    className="rounded border px-2 py-1 disabled:opacity-50"
                    disabled={missingPrerequisites.length > 0}
                    title={missingPrerequisites.length ? "Restore prerequisite stages first: " + missingPrerequisites.join(", ") : "Restore to future project defaults"}
                    onClick={() => setDraft((current) => ({
                      ...current,
                      stages: [...current.stages, retired],
                      retiredStages: (current.retiredStages ?? []).filter((item) => item.code !== retired.code),
                    }))}
                  >
                    Restore
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      {!!errors.length && (
        <ul role="alert" className="text-sm text-destructive">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
    </section>
  );
}
