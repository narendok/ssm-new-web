import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import {
  validateReusableAsset,
  type ReusableAssetRevision,
  type ProjectAssetUse,
} from "@/lib/reusable-assets";
type Option = { id: string; title: string };
export function ReusableAssetsWorkspace({
  assets,
  uses,
  projects,
  documents,
  inventory,
  actor,
  onPublish,
  onLink,
  onClose,
}: {
  assets: ReusableAssetRevision[];
  uses: ProjectAssetUse[];
  projects: Option[];
  documents: (Option & { revision: string })[];
  inventory: Option[];
  actor: string;
  onPublish: (asset: ReusableAssetRevision) => void | Promise<void>;
  onLink: (use: ProjectAssetUse) => void | Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(""),
    [kind, setKind] = useState<ReusableAssetRevision["kind"]>("PCB"),
    [source, setSource] = useState(""),
    [stage, setStage] = useState(""),
    [doc, setDoc] = useState(""),
    [item, setItem] = useState(""),
    [compatibility, setCompatibility] = useState(""),
    [parent, setParent] = useState(""),
    [selected, setSelected] = useState(""),
    [consumer, setConsumer] = useState(""),
    [assessment, setAssessment] = useState(""),
    [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const cls = "w-full rounded border border-input bg-background p-2 text-sm text-foreground";
  const options = (values: Option[]) => [
    <option key="" value="">
      Select…
    </option>,
    ...values.map((o) => (
      <option key={o.id} value={o.id}>
        {o.title}
      </option>
    )),
  ];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Reusable assets & document revisions</DialogTitle>
          <DialogDescription>
            Reuse an exact source revision across projects. Physical inventory movements remain in
            Inventory.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <section className="space-y-3 rounded border border-border p-3">
            <h3 className="font-semibold">Register reusable revision</h3>
            <label className="block">
              Asset title
              <input className={cls} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="block">
              Kind
              <select
                aria-label="Kind"
                className={cls}
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
              >
                {["PCB", "Harness", "Enclosure / CAD", "Firmware / Library", "Document"].map(
                  (k) => (
                    <option key={k}>{k}</option>
                  ),
                )}
              </select>
            </label>
            <label className="block">
              Source project
              <select
                aria-label="Source project"
                className={cls}
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                {options(projects)}
              </select>
            </label>
            <label className="block">
              Source stage
              <input className={cls} value={stage} onChange={(e) => setStage(e.target.value)} />
            </label>
            <label className="block">
              Original document revision
              <select
                aria-label="Original document revision"
                className={cls}
                value={doc}
                onChange={(e) => setDoc(e.target.value)}
              >
                {options(documents.map((d) => ({ ...d, title: `${d.title} · Rev ${d.revision}` })))}
              </select>
            </label>
            <label className="block">
              Physical inventory item (optional)
              <select
                aria-label="Physical inventory item (optional)"
                className={cls}
                value={item}
                onChange={(e) => setItem(e.target.value)}
              >
                {options(inventory)}
              </select>
            </label>
            <label className="block">
              Derivative of (optional)
              <select
                aria-label="Derivative of (optional)"
                className={cls}
                value={parent}
                onChange={(e) => setParent(e.target.value)}
              >
                {options(assets.map((a) => ({ id: a.id, title: `${a.title} · r${a.revision}` })))}
              </select>
            </label>
            <label className="block">
              Compatibility / limitations
              <textarea
                className={cls}
                value={compatibility}
                onChange={(e) => setCompatibility(e.target.value)}
              />
            </label>
            <button
              className="rounded bg-primary px-3 py-2 text-primary-foreground"
              disabled={busy}
              onClick={async () => {
                const preceding = assets.find((a) => a.id === parent);
                const document = documents.find((d) => d.id === doc);
                const asset: ReusableAssetRevision = {
                  id: crypto.randomUUID(),
                  familyId: preceding?.familyId ?? crypto.randomUUID(),
                  revision: preceding ? preceding.revision + 1 : 1,
                  title,
                  kind,
                  originProject: source,
                  originStage: stage,
                  documentId: doc,
                  documentRevision: document?.revision ?? "",
                  inventoryItemId: item,
                  compatibility,
                  parentRevisionId: parent,
                  status: "Draft",
                  createdAt: new Date().toISOString(),
                  createdBy: actor,
                };
                const errors = validateReusableAsset(asset, {
                  assets,
                  projects: projects.map((p) => p.id),
                  documents,
                  inventoryIds: inventory.map((i) => i.id),
                });
                if (errors.length) {
                  setMessage(errors.join(" "));
                  return;
                }
                setBusy(true);
                try {
                  await onPublish(asset);
                  setTitle("");
                  setMessage(
                    "Reusable draft revision registered; stock quantities were not changed.",
                  );
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "Save failed.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Register draft revision
            </button>
          </section>
          <section className="space-y-3 rounded border border-border p-3">
            <h3 className="font-semibold">Reuse in a project</h3>
            <label className="block">
              Asset revision
              <select
                aria-label="Asset revision"
                className={cls}
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {options(
                  assets.map((a) => ({
                    id: a.id,
                    title: `${a.title} · r${a.revision} · ${a.status}`,
                  })),
                )}
              </select>
            </label>
            <label className="block">
              Consuming project
              <select
                aria-label="Consuming project"
                className={cls}
                value={consumer}
                onChange={(e) => setConsumer(e.target.value)}
              >
                {options(projects)}
              </select>
            </label>
            <label className="block">
              Intended use and compatibility review
              <textarea
                aria-label="Intended use and compatibility review"
                className={cls}
                value={assessment}
                onChange={(e) => setAssessment(e.target.value)}
              />
            </label>
            <button
              className="rounded border border-border px-3 py-2"
              disabled={busy || !selected || !consumer || !assessment.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  await onLink({
                    id: crypto.randomUUID(),
                    projectId: consumer,
                    assetRevisionId: selected,
                    assessment,
                    createdAt: new Date().toISOString(),
                    createdBy: actor,
                  });
                  setMessage(
                    "Exact revision linked for evaluation. No approval or release was recorded.",
                  );
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "Link failed.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Link revision
            </button>
            <div className="space-y-2">
              {assets.map((a) => (
                <article key={a.id} className="rounded border border-border p-2 text-xs">
                  <strong>
                    {a.title} · r{a.revision} · {a.kind}
                  </strong>
                  <p>
                    {a.originProject} · {a.originStage} · Original revision {a.documentRevision}
                  </p>
                  <p>{a.compatibility}</p>
                  <p>
                    {uses.filter((u) => u.assetRevisionId === a.id).length} consuming projects ·{" "}
                    {a.inventoryItemId ? "Inventory item linked" : "Digital asset only"} · Draft
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
