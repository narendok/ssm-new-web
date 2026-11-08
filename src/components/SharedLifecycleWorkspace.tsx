import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getLifecycleWorkspace,
  mutateLifecycleWorkspace,
} from "@/lib/lifecycle-workspace.functions";
import { getSharedTestWorkspace } from "@/lib/shared-test.functions";
import { defaultLifecycleRevision, readLifecycleBaseline } from "@/lib/lifecycle-baseline";
import type { ReusableAssetRevision } from "@/lib/reusable-assets";
import { LifecycleSettingsEditor } from "./LifecycleSettingsEditor";
import { ReusableAssetsWorkspace } from "./ReusableAssetsWorkspace";

export function SharedLifecycleWorkspace({
  mode,
  onClose,
  scopeKey,
}: {
  scopeKey: string;
  mode: "settings" | "assets";
  onClose: () => void;
}) {
  const load = useServerFn(getLifecycleWorkspace),
    workspace = useServerFn(getSharedTestWorkspace),
    write = useServerFn(mutateLifecycleWorkspace);
  const requests = useRef(new Map<string, string>());
  const data = useQuery({
    queryKey: ["lifecycle-workspace", scopeKey],
    queryFn: () => load(),
    retry: false,
  });
  const common = useQuery({
    queryKey: ["lifecycle-project-options", scopeKey],
    queryFn: () => workspace(),
    retry: false,
  });
  async function mutate(
    action: "save_revision" | "publish_asset" | "link_asset",
    payload: Record<string, unknown>,
  ) {
    const signature = JSON.stringify({ action, payload });
    const requestId = requests.current.get(signature) ?? crypto.randomUUID();
    requests.current.set(signature, requestId);
    await write({ data: { action, payload: JSON.parse(JSON.stringify(payload)), requestId } });
    await data.refetch();
    requests.current.delete(signature);
  }
  if (data.isLoading || common.isLoading)
    return (
      <p role="status" className="p-4">
        Loading shared lifecycle catalog…
      </p>
    );
  if (data.error || common.error || !data.data || !common.data)
    return (
      <section role="alert" className="rounded border border-border p-4">
        <p>
          Shared lifecycle catalog unavailable.{" "}
          {String(data.error?.message || common.error?.message || "No response")}
        </p>
        <button
          onClick={() => {
            void data.refetch();
            void common.refetch();
          }}
        >
          Retry
        </button>
        <button className="ml-4" onClick={onClose}>
          Close
        </button>
      </section>
    );
  const state = data.data;
  const snapshot = common.data;
  const definition = state.revision
    ? readLifecycleBaseline(JSON.stringify(state.revision.definition))
    : defaultLifecycleRevision();
  if (mode === "settings")
    return (
      <LifecycleSettingsEditor
        departments={snapshot.departments}
        key={state.revision?.id ?? "initial"}
        revision={definition ?? defaultLifecycleRevision()}
        onActivate={async (revision) => {
          await mutate("save_revision", {
            definition: revision,
            expectedRevision: state.revision?.id ?? null,
          });
        }}
      />
    );
  const assets = state.assets.map(
    (row) =>
      ({
        ...row.definition,
        id: row.id,
        originProject: row.sourceProject,
        documentId: row.fileId,
        createdAt: row.createdAt,
      }) as unknown as ReusableAssetRevision,
  );
  return (
    <ReusableAssetsWorkspace
      assets={assets}
      uses={state.uses.map((u) => ({ ...u, createdBy: "" }))}
      projects={snapshot.records
        .filter((r) => r.record_type === "Project")
        .map((r) => ({ id: r.id, title: r.title }))}
      documents={state.files.map((f) => ({ id: f.id, title: f.title, revision: f.revision }))}
      inventory={snapshot.records
        .filter((r) => r.record_type === "Part")
        .map((r) => ({ id: r.id, title: r.title }))}
      actor={snapshot.membership.display_name}
      onClose={onClose}
      onPublish={async (asset) => {
        const file = state.files.find((f) => f.id === asset.documentId);
        if (!file) throw Error("Choose an available verified original.");
        await mutate("publish_asset", {
          sourceProject: asset.originProject,
          documentId: file.documentId,
          fileId: file.id,
          definition: asset,
        });
      }}
      onLink={async (use) => {
        await mutate("link_asset", {
          projectId: use.projectId,
          assetRevisionId: use.assetRevisionId,
          assessment: use.assessment,
        });
      }}
    />
  );
}
