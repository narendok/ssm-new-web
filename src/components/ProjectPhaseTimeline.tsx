import {
  COMPANY_PHASES,
  defaultLifecycleRevision,
  readLifecycleBaseline,
} from "@/lib/lifecycle-baseline";

export function ProjectPhaseTimeline({ fields }: { fields: Record<string, string> }) {
  const pinned = readLifecycleBaseline(fields["lifecycleBaseline"]);
  const revision = pinned ?? defaultLifecycleRevision();
  const code = fields["currentStage"] || fields["lifecycleStage"] || "";
  const current = revision.stages.find((s) => s.code === code)?.phase;
  const responsibility = pinned?.stages.find(s => s.code === code)?.raci;
  const legacy = fields['legacyStage'] || fields['stage'];
  const conflictingLegacy = Boolean(current && legacy && legacy !== code && /^Stage\s+\d+/i.test(legacy));
  return (
    <section
      aria-label="Company lifecycle phases"
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Project phases</h2>
        <span className="text-xs text-muted-foreground">
          {pinned ? `Pinned revision ${pinned.id}` : "Legacy project · default catalog reference"}
        </span>
      </div>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {COMPANY_PHASES.map(([phase, title]) => (
          <li
            key={phase}
            aria-current={phase === current ? "step" : undefined}
            className={`min-w-0 break-words rounded-lg border p-3 text-xs ${phase === current ? "border-primary bg-primary/10" : "border-border"}`}
          >
            <strong>Phase {phase.slice(3)} · {phase.replace("_", "-")}</strong>
            <p>{title}</p>
            {phase === current && (
              <span className="font-semibold text-primary">Current recorded phase</span>
            )}
          </li>
        ))}
      </ol>
      {conflictingLegacy && <p className="mt-2 text-xs text-muted-foreground">Legacy project label {legacy} is retained for history. Phase is derived from the pinned department stage {code}, not the legacy number.</p>}
      {!current && (
        <p className="mt-2 text-xs text-muted-foreground">
          This project needs lifecycle reconciliation: select a valid department stage from its pinned lifecycle settings. No phase is inferred from an old stage number; existing records and evidence remain linked.
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Department stage: {code || "Not assigned"} · Phase summaries follow recorded gate decisions; tasks and uploads do not
        approve a gate.
      </p>
      {responsibility && <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Pinned stage RACI">{(['R','A','C','I'] as const).map(role=><div key={role} className="flex gap-1"><dt className="font-semibold">{role}:</dt><dd>{responsibility[role].join(', ') || 'Unassigned'}</dd></div>)}</dl>}
    </section>
  );
}
