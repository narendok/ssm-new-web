import { useState } from "react";
import type { InputSheet } from "@/lib/project-inputs";
import type { InputEvent } from "@/lib/project-inputs.functions";
import { ProjectPhaseTimeline } from "./ProjectPhaseTimeline";
import {
  defaultLifecycleRevision,
  projectLifecycleStages,
  readLifecycleBaseline,
  recordedStageOmissions,
} from "@/lib/lifecycle-baseline";
import { getRecordedProjectTrack } from "@/lib/canonical-lifecycle";
import { pmssPrintHtml, printPmss } from "@/lib/pmss-print";
type RecordRow = {
  id: string;
  reference: string;
  title: string;
  type: string;
  status: string;
  fields: Record<string, string>;
};
const tabs = [
  "Overview",
  "Operating requirements",
  "Compliance baseline",
  "Commercial & BOM",
  "Phases & gates",
  "Change control",
  "Linked records",
  "Revision history",
] as const;
export function ProjectMasterSpecSheet({
  project,
  records,
  documents,
  onOpenInputs,
  onOpenRecord,
  onOpenDocument,
  onOpenStageRecords,
  canViewCommercial,
  inputSheet,
  inputEvents,
}: {
  onOpenStageRecords?: ((stage: string) => void) | undefined;
  inputSheet?: InputSheet | undefined;
  inputEvents?: InputEvent[] | undefined;
  project: RecordRow;
  records: RecordRow[];
  documents: { id: string; title: string; type: string; revision?: string | undefined }[];
  onOpenInputs?: (() => void) | undefined;
  onOpenRecord: (id: string) => void;
  onOpenDocument: (id: string) => void;
  canViewCommercial: boolean;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const f = project.fields;
  const baseline = readLifecycleBaseline(f["lifecycleBaseline"]);
  const track = getRecordedProjectTrack(f);
  const stages = track
    ? projectLifecycleStages(
        baseline ?? defaultLifecycleRevision(),
        track,
        f["certificationRequired"] === "true",
      )
    : [];
  const omissions = recordedStageOmissions(f["omittedStages"]);
  const values = (keys: string[]) =>
    keys.map((key) => (
      <div key={key} className="rounded border border-border p-3">
        <dt className="text-xs text-muted-foreground">{key.replace(/([A-Z])/g, " $1")}</dt>
        <dd className="mt-1 whitespace-pre-wrap text-sm">
          {inputSheet?.parameter_values[key]?.finalValue ||
            inputSheet?.parameter_values[key]?.input ||
            f[key] ||
            "Not recorded"}
        </dd>
      </div>
    ));
  const linked = records.filter((r) => r.type !== "Project" && r.type !== "Task");
  const changes = linked.filter((r) => /change|ECR|ECO|ECN/i.test(r.type + " " + r.title));
  const events = (inputEvents ?? [])
    .filter((e) => e.sheet_id === inputSheet?.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const print = () =>
    printPmss(
      pmssPrintHtml(
        project,
        linked,
        Object.fromEntries(
          Object.entries(inputSheet?.parameter_values ?? {})
            .filter(
              ([key]) =>
                canViewCommercial ||
                !/(cost|budget|sourcing|quantity|currency|margin|price)/i.test(key),
            )
            .map(([key, value]) => [key, value.finalValue || value.input]),
        ),
        events.map((e) => ({
          actor: e.actor_name,
          action: e.action,
          revision: e.revision,
          at: e.created_at,
        })),
      ),
    );
  return (
    <section
      aria-label="Project master spec sheet"
      className="space-y-3 rounded-xl border border-border bg-card p-4"
    >
      <button
        className="float-right rounded border border-border px-3 py-2 text-xs"
        onClick={print}
      >
        Print A4 / Save PDF
      </button>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Project Master Spec Sheet</h2>
          <p className="text-xs text-muted-foreground">
            {project.reference} · Current permitted records and pinned lifecycle baseline
          </p>
        </div>
        {onOpenInputs && (
          <button className="rounded border border-border px-3 py-2 text-xs" onClick={onOpenInputs}>
            Edit requirements / request amendment
          </button>
        )}
      </header>
      <nav aria-label="PMSS tabs" className="flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t}
            aria-pressed={tab === t}
            className={`rounded px-3 py-2 text-xs ${tab === t ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      {tab === "Overview" && (
        <dl className="grid gap-2 sm:grid-cols-3">
          {values(["customer", "track", "owner", "targetDate", "scope", "currentStage"])}
        </dl>
      )}
      {tab === "Operating requirements" && (
        <>
          <p className="text-xs">
            Requirements sheet:{" "}
            {inputSheet
              ? `revision ${inputSheet.revision} · ${inputSheet.status}`
              : "Not linked in this scope"}
          </p>
          <p className="text-xs text-muted-foreground">
            The linked Inputs & Feasibility sheet owns editable operating parameters. Missing values
            remain unconfirmed.
          </p>
          <dl className="grid gap-2 sm:grid-cols-3">
            {values([
              "system_voltage",
              "operating_range",
              "temperature",
              "ip",
              "dimensions",
              "use_case",
            ])}
          </dl>
        </>
      )}
      {tab === "Compliance baseline" && (
        <>
          <dl className="grid gap-2 sm:grid-cols-3">
            {values(["certifications", "compliance", "certificationScope"])}
          </dl>
          <p className="text-xs text-muted-foreground">
            Certificates and test reports are evidence records; a catalog requirement is not a
            certificate.
          </p>
        </>
      )}
      {tab === "Commercial & BOM" &&
        (canViewCommercial ? (
          <dl className="grid gap-2 sm:grid-cols-3">
            {values([
              "targetCost",
              "currency",
              "toolingBudget",
              "quantity",
              "bomReference",
              "sourcing",
            ])}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            Commercial values remain in the authorized Purchasing / Finance workspace.
          </p>
        ))}
      {tab === "Phases & gates" && (
        <>
          <ProjectPhaseTimeline fields={f} />
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  {["Stage", "Company phase", "Internal gate", "Owner", "Exit types"].map((h) => (
                    <th key={h} className="p-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stages.map((s) => (
                  <tr key={s.code} className="border-t border-border">
                    <td className="p-2">
                      <button
                        className="text-left hover:underline"
                        onClick={() => onOpenStageRecords?.(s.code)}
                      >
                        {s.code} · {s.name}
                      </button>
                      {omissions[s.code] && <p>N/A · {omissions[s.code]!.reason}</p>}
                    </td>
                    <td>{s.phase}</td>
                    <td>{s.gate}</td>
                    <td>{s.department}</td>
                    <td>{s.exitTypes.join(", ") || "Per recorded gate checklist"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === "Change control" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Post-freeze changes use the existing requirements amendment and authorized impact-review
            workflow.
          </p>
          {changes.map((r) => (
            <button
              className="block text-left text-sm underline"
              key={r.id}
              onClick={() => onOpenRecord(r.id)}
            >
              {r.reference} · {r.title} · {r.status}
            </button>
          ))}
          {!changes.length && (
            <p className="text-sm">No change records are visible in this scope.</p>
          )}
        </div>
      )}
      {tab === "Linked records" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {linked.map((r) => (
            <button
              className="rounded border border-border p-2 text-left text-xs"
              key={r.id}
              onClick={() => onOpenRecord(r.id)}
            >
              {r.reference} · {r.title} · {r.status}
            </button>
          ))}
          {documents.map((d) => (
            <button
              className="rounded border border-border p-2 text-left text-xs"
              key={d.id}
              onClick={() => onOpenDocument(d.id)}
            >
              {d.title} · Rev {d.revision || "not recorded"} · {d.type}
            </button>
          ))}
        </div>
      )}
      {tab === "Revision history" && (
        <>
          <dl className="grid gap-2 sm:grid-cols-2">
            {values([
              "revision",
              "responsibilityVersion",
              "lastStageTransitionAt",
              "lastStageTransitionBy",
              "stageRemark",
            ])}
            <div className="rounded border border-border p-3 text-xs">
              Lifecycle baseline: {baseline?.id || "Legacy/unpinned"}
              <br />
              Saved: {baseline?.createdAt || "Not recorded"}
              <br />
              Detailed approval and amendment receipts remain in their source records.
            </div>
          </dl>
          {events.map((e) => (
            <p className="rounded border border-border p-2 text-xs" key={e.id}>
              Revision {e.revision} · {e.action} · {e.actor_name} · {e.created_at}
            </p>
          ))}
        </>
      )}
    </section>
  );
}
