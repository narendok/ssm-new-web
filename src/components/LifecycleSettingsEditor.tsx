import { useRef, useState } from "react";
import { completeLifecycleDefinitions } from "@/lib/lifecycle-stage-extensions";
import {
  COMPANY_PHASES,
  validateLifecycleRevision,
  type LifecycleRevision,
  type LifecycleStageDefinition,
  type CompanyPhase,
} from "@/lib/lifecycle-baseline";

export function LifecycleSettingsEditor({
  revision,
  onActivate,
  departments,
}: {
  revision: LifecycleRevision;
  onActivate: (value: LifecycleRevision) => void | Promise<void>;
  departments?: { code: string; name: string; active?: boolean }[];
}) {
  const [draft, setDraft] = useState<LifecycleRevision>(() => ({
    ...structuredClone(revision),
    stages: completeLifecycleDefinitions(revision).map((s) => ({
      ...structuredClone(s),
      tasks: s.tasks.map((task) => ({
        ...task,
        description: task.description.replace(/^Workbook HW\+FW\+SW!L\d+\.\s*/, ""),
      })),
      raci: s.raci
        ? structuredClone(s.raci)
        : {
            R: [...new Set([s.department, ...s.tasks.map((t) => t.department)])],
            A: [s.department],
            C: [],
            I: [],
          },
    })),
  }));
  const [selected, setSelected] = useState(revision.stages[0]?.code ?? "");
  const [selectedPhase, setSelectedPhase] = useState<CompanyPhase>(
    revision.stages[0]?.phase ?? "TG_0",
  );
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [search, setSearch] = useState("");
  const [savedStages, setSavedStages] = useState(() => JSON.stringify(draft.stages));
  const pending = useRef<{ signature: string; value: LifecycleRevision } | null>(null);
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
  const visibleStages = draft.stages.filter((s) => s.phase === selectedPhase && matchesFilter(s));
  const saved = JSON.parse(savedStages) as LifecycleStageDefinition[];
  const changedStages = draft.stages.filter(
    (s) => JSON.stringify(s) !== JSON.stringify(saved.find((previous) => previous.code === s.code)),
  );
  const dirty = changedStages.length > 0;
  const selectPhase = (phase: CompanyPhase) => {
    setSelectedPhase(phase);
    setSelected(draft.stages.find((s) => s.phase === phase && matchesFilter(s))?.code ?? "");
  };
  const update = (patch: Partial<LifecycleStageDefinition>) =>
    setDraft((d) => ({
      ...d,
      stages: d.stages.map((s) => (s.code === selected ? { ...s, ...patch } : s)),
    }));
  const field = "w-full rounded border border-input bg-background p-2 text-sm text-foreground";
  const departmentOptions =
    departments?.filter((d) => d.active !== false && d.code !== "CLIENT") ?? [];
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
  return (
    <section className="space-y-4" aria-label="Lifecycle phase and task settings">
      <div>
        <h2 className="font-semibold">Lifecycle stages & default tasks</h2>
        <p className="text-sm text-muted-foreground">
          Company phases stay fixed. Edit internal stages and task defaults here; existing projects
          retain their pinned revision. Stage RACI below controls task ownership and
          completion-review routing. Historical Department chronicles & RACI remain available with
          their saved versions.
        </p>
        <p className="mt-1 text-xs">
          Current revision: {revision.id} · {draft.stages.length} stages ·{" "}
          {draft.stages.reduce((n, s) => n + s.tasks.length, 0)} default tasks
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
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
              {draft.stages.filter((s) => s.phase === code).length} stages
            </span>
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full min-w-[760px] border-collapse text-left text-xs">
          <caption className="p-3 text-left text-sm font-semibold">
            Phase {selectedPhase.slice(3)} · RACI responsibility matrix
          </caption>
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
                className={`border-b border-border align-top ${s.code === selected ? "bg-primary/5" : ""}`}
              >
                <th scope="row" className="p-2 font-medium">
                  <button
                    type="button"
                    className="text-left hover:underline"
                    onClick={() => setSelected(s.code)}
                  >
                    {s.code} · {s.name}
                  </button>
                  <div className="mt-1 text-[11px] font-normal text-muted-foreground">
                    Owner: {s.department}
                  </div>
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
          Changes are saved together as a new lifecycle revision. Task owners must remain within an
          R department; A receives the independent completion review.
        </p>
      </div>
      <label className="block text-sm">
        Stage · Phase {selectedPhase.slice(3)}
        <select
          aria-label="Edit lifecycle stage"
          className={field}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {!visibleStages.length && <option value="">No stages configured in this phase</option>}
          {visibleStages.map((s) => (
            <option key={s.code} value={s.code}>
              {s.code} · {s.name}
            </option>
          ))}
        </select>
      </label>
      {stage && (
        <div className="space-y-3 rounded border border-border p-4">
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
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              Stage name
              <input
                className={field}
                value={stage.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </label>
            <label>
              Company phase
              <select
                className={field}
                value={stage.phase}
                onChange={(e) => {
                  const phase = e.target.value as CompanyPhase;
                  update({ phase });
                  setSelectedPhase(phase);
                }}
              >
                {COMPANY_PHASES.map(([code, title]) => (
                  <option key={code} value={code}>
                    {code} · {title}
                  </option>
                ))}
              </select>
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
            <label>
              Prerequisite stage codes
              <input
                className={field}
                value={stage.prerequisites.join(", ")}
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
              Exit document/record types
              <input
                className={field}
                value={stage.exitTypes.join(", ")}
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
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={stage.optional}
              onChange={(e) => update({ optional: e.target.checked })}
            />
            Optional (project omission requires a recorded decision)
          </label>
          <h3 className="font-semibold">Default tasks</h3>
          <p className="text-xs text-muted-foreground">
            RACI is managed in the phase matrix above. Tasks must belong to an R department; A
            receives the independent completion review. C/I identify participants; access and
            signing permissions are checked separately.
          </p>
          {stage.tasks.map((task, i) => (
            <div
              className="grid gap-2 rounded border border-border p-3 md:grid-cols-[1fr_9rem_auto]"
              key={task.id}
            >
              <input
                aria-label={`Task ${i + 1} title`}
                className={field}
                value={task.title}
                onChange={(e) =>
                  update({
                    tasks: stage.tasks.map((t, n) =>
                      n === i ? { ...t, title: e.target.value } : t,
                    ),
                  })
                }
              />
              {departmentSelect(
                task.department,
                (code) =>
                  update({
                    tasks: stage.tasks.map((t, n) => (n === i ? { ...t, department: code } : t)),
                    raci: {
                      ...defaultRaci(stage),
                      R: [...new Set([...defaultRaci(stage).R, code])],
                    },
                  }),
                `Task ${i + 1} department`,
              )}
              <button
                type="button"
                onClick={() => update({ tasks: stage.tasks.filter((_, n) => n !== i) })}
              >
                Remove default
              </button>
              <textarea
                aria-label={`Task ${i + 1} description`}
                className={`${field} md:col-span-3`}
                value={task.description}
                onChange={(e) =>
                  update({
                    tasks: stage.tasks.map((t, n) =>
                      n === i ? { ...t, description: e.target.value } : t,
                    ),
                  })
                }
              />
            </div>
          ))}
          <button
            type="button"
            className="rounded border border-border px-3 py-2"
            onClick={() =>
              update({
                tasks: [
                  ...stage.tasks,
                  {
                    id: `T-${crypto.randomUUID()}`,
                    title: "New task",
                    description: "",
                    department: stage.department,
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
            {changedStages.length} stage{changedStages.length === 1 ? "" : "s"} changed
          </strong>
          <ul className="mt-2 space-y-1">
            {changedStages.map((s) => (
              <li key={s.code}>
                {s.code} · {s.name} · {s.tasks.length} default tasks
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
              setDraft((d) => ({ ...d, stages: JSON.parse(savedStages) }));
              pending.current = null;
              setNotice("Unsaved lifecycle changes discarded.");
            }}
          >
            Discard changes
          </button>
        </section>
      )}
      {!!errors.length && (
        <ul role="alert" className="text-sm text-destructive">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        disabled={busy || !!errors.length || !dirty}
        className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
        onClick={async () => {
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
            setSavedStages(JSON.stringify(draft.stages));
            pending.current = null;
            setNotice("New default revision saved. Existing project baselines were preserved.");
          } catch (error) {
            setNotice(error instanceof Error ? error.message : "Save failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Save new default revision
      </button>
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
    </section>
  );
}
