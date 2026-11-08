import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSharedTestWorkspace } from "@/lib/shared-test.functions";
import {
  configureProjectLifecycle,
  setProjectCertificationScope,
  getLifecycleWorkspace,
  getProjectLifecycleDecisions,
} from "@/lib/lifecycle-workspace.functions";
import { readLifecycleBaseline, recordedStageOmissions } from "@/lib/lifecycle-baseline";

export function ProjectLifecycleConfiguration({
  projectId,
  scopeKey,
  isAdmin,
  canManageCertification,
}: {
  projectId: string;
  scopeKey: string;
  isAdmin: boolean;
  canManageCertification: boolean;
}) {
  const load = useServerFn(getSharedTestWorkspace),
    settings = useServerFn(getLifecycleWorkspace),
    history = useServerFn(getProjectLifecycleDecisions),
    write = useServerFn(configureProjectLifecycle),
    cache = useQueryClient();
  const [stage, setStage] = useState(""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const retry = useRef<{ signature: string; id: string } | null>(null);
  const decideCertification = useServerFn(setProjectCertificationScope);
  const [certification, setCertification] = useState("");
  const query = useQuery({
    queryKey: ["project-lifecycle-configuration", scopeKey, projectId],
    queryFn: async () => {
      const [workspace, lifecycle, decisions] = await Promise.all([
        load(),
        settings(),
        history({ data: { projectId } }),
      ]);
      return {
        project: workspace.records.find((r) => r.id === projectId),
        tasks: workspace.tasks,
        lifecycle,
        decisions,
      };
    },
  });
  if (query.isPending) return <p className="text-xs">Loading project lifecycle configuration…</p>;
  if (query.error || !query.data?.project)
    return (
      <p role="alert" className="text-xs">
        Project lifecycle configuration unavailable. {query.error?.message}
      </p>
    );
  const { project, lifecycle, tasks, decisions } = query.data;
  const baseline = readLifecycleBaseline(String(project.fields["lifecycleBaseline"] ?? "")),
    target = lifecycle.revision
      ? readLifecycleBaseline(JSON.stringify(lifecycle.revision.definition))
      : undefined;
  const omissions = recordedStageOmissions(project.fields["omittedStages"]);
  const optional = (baseline?.stages ?? []).filter(
    (s) =>
      s.optional &&
      !omissions[s.code] &&
      s.code !== project.fields["currentStage"] &&
      !tasks.some((t) => t.record_id === projectId && t.stage_code === s.code),
  );
  const changes =
    target?.stages.filter(
      (s) =>
        JSON.stringify(s) !== JSON.stringify(baseline?.stages.find((old) => old.code === s.code)),
    ) ?? [];
  const canMigrate =
    isAdmin &&
    target &&
    target.id !== baseline?.id &&
    target.stages.some((s) => s.code === (project.fields["currentStage"] || project.stage));
  async function save(action: "omit_optional" | "migrate_baseline") {
    if (reason.trim().length < 10) return;
    setBusy(true);
    setNotice("");
    const payload = {
      projectId,
      expectedUpdatedAt: project!.updated_at,
      action,
      reason,
      ...(action === "omit_optional"
        ? { stageCode: stage }
        : { revisionId: lifecycle.revision!.id }),
    };
    const signature = JSON.stringify(payload);
    if (retry.current?.signature !== signature)
      retry.current = { signature, id: crypto.randomUUID() };
    try {
      await write({ data: { ...payload, requestId: retry.current.id } });
      retry.current = null;
      await query.refetch();
      await cache.invalidateQueries({ queryKey: ["shared-test-workspace"] });
      setReason("");
      setStage("");
      setNotice("Decision saved. Existing tasks and completed evidence were preserved.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Decision failed.");
    } finally {
      setBusy(false);
    }
  }
  async function saveCertification() {
    if (!certification || reason.trim().length < 10) return;
    setBusy(true);
    setNotice("");
    const payload = {
      projectId,
      expectedUpdatedAt: project!.updated_at,
      required: certification === "yes",
      reason,
    };
    const signature = JSON.stringify(payload);
    if (retry.current?.signature !== signature)
      retry.current = { signature, id: crypto.randomUUID() };
    try {
      await decideCertification({ data: { ...payload, requestId: retry.current.id } });
      retry.current = null;
      await query.refetch();
      await cache.invalidateQueries({ queryKey: ["shared-test-workspace"] });
      setReason("");
      setCertification("");
      setNotice(
        "Certification applicability recorded. No certificate, approval or release was created.",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Scope decision failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="rounded-xl border border-border p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Lifecycle configuration & decision history
      </summary>
      <div className="mt-3 space-y-3 text-xs">
        <p>
          Project baseline: {baseline?.id ?? "Legacy / unpinned"} · Latest settings:{" "}
          {target?.id ?? "Not saved"}
        </p>
        <p>
          Regulatory certification:{" "}
          {project.fields["certificationRequired"] === true
            ? "Applicable"
            : project.fields["certificationRequired"] === false
              ? "Not applicable · recorded decision"
              : "Scope decision pending"}
        </p>
        {!!Object.keys(omissions).length && (
          <div>
            {Object.entries(omissions).map(([code, value]) => (
              <p key={code}>
                {code} · N/A · {value.reason}
              </p>
            ))}
          </div>
        )}
        {canMigrate && (
          <div className="rounded border border-border p-3">
            <p className="font-semibold">
              Migration preview: {changes.length} stage definitions change
            </p>
            <p>
              Current tasks, completed stages and original evidence stay unchanged. Future stage
              activations use the selected settings revision.
            </p>
            <ul className="max-h-32 overflow-auto">
              {changes.map((s) => (
                <li key={s.code}>
                  {s.code} · {s.name} · {s.phase} · {s.gate} · {s.tasks.length} defaults
                </li>
              ))}
            </ul>
          </div>
        )}
        {!!optional.length && (
          <label className="block">
            Optional stage to mark N/A
            <select
              aria-label="Optional stage to mark N/A"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="mt-1 w-full rounded border border-input bg-background p-2"
            >
              <option value="">Select unstarted optional stage…</option>
              {optional.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} · {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {canManageCertification && baseline && (
          <label className="block">
            Regulatory certification scope
            <select
              aria-label="Regulatory certification scope"
              className="mt-1 w-full rounded border border-input bg-background p-2"
              value={certification}
              onChange={(e) => setCertification(e.target.value)}
            >
              <option value="">Select a scope decision…</option>
              <option value="yes">Certification applies</option>
              <option value="no">Not applicable — justification required</option>
            </select>
          </label>
        )}
        {(canMigrate || optional.length > 0 || (canManageCertification && baseline)) && (
          <>
            <label className="block">
              Decision reason
              <textarea
                aria-label="Lifecycle decision reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded border border-input bg-background p-2"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {canMigrate && (
                <button
                  disabled={busy || reason.trim().length < 10}
                  className="rounded border border-border p-2 disabled:opacity-50"
                  onClick={() => void save("migrate_baseline")}
                >
                  Apply reviewed baseline migration
                </button>
              )}
              {!!optional.length && (
                <button
                  disabled={busy || !stage || reason.trim().length < 10}
                  className="rounded border border-border p-2 disabled:opacity-50"
                  onClick={() => void save("omit_optional")}
                >
                  Record optional stage as N/A
                </button>
              )}
              {canManageCertification && baseline && (
                <button
                  className="rounded border border-border p-2 disabled:opacity-50"
                  disabled={busy || !certification || reason.trim().length < 10}
                  onClick={() => void saveCertification()}
                >
                  Record certification scope
                </button>
              )}
            </div>
          </>
        )}
        <p className="text-muted-foreground">
          N/A is a scope decision, never a completed test or gate approval. Started stages cannot be
          omitted.
        </p>
        {decisions.map((d) => (
          <p className="rounded border border-border p-2" key={d.id}>
            {d.action === "omit_optional"
              ? `${d.stageCode} · N/A`
              : d.action === "set_certification"
                ? `Certification · ${d.stageCode === "CERT_REQUIRED" ? "Applicable" : "Not applicable"}`
                : `Baseline ${d.previousRevision ?? "Legacy"} → ${d.nextRevision}`}{" "}
            · {d.actor} · {d.createdAt}
            <br />
            {d.reason}
          </p>
        ))}
        {notice && <p role="status">{notice}</p>}
      </div>
    </details>
  );
}
