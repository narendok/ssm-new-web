import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { saveLocalAttachment, removeLocalAttachment } from "@/lib/local-attachments";
import { projectLifecycleContext } from "@/lib/lifecycle-record-presentation";
import { SharedMasterSelect } from "@/components/SharedMasterSelect";
import {
  prepareUploadDraft,
  eligibleUploadDepartments,
  sourceGerberPackages,
  UPLOAD_TYPES,
  type UploadDepartment,
  type UploadDocument,
  type UploadMetadata,
  type UploadProject,
  type UploadScope,
  type UploadType,
} from "@/lib/document-upload-pilot";

export type UploadDraft = ReturnType<typeof prepareUploadDraft>;
type Props = {
  initialFile: File | null;
  initialProjectId?: string | undefined;
  projects: UploadProject[];
  departments: UploadDepartment[];
  documents: UploadDocument[];
  initialScope: UploadScope;
  actor: { id: string; kind: string; name: string; departmentId?: string | undefined };
  onClose: () => void;
  onSave: (document: UploadDraft) => Promise<boolean>;
};
const fieldClass =
  "mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground";
export function DocumentUploadPilotDialog({
  initialFile,
  initialProjectId,
  projects,
  departments,
  documents,
  initialScope,
  actor,
  onClose,
  onSave,
}: Props) {
  const [file, setFile] = useState(initialFile);
  const [metadata, setMetadata] = useState<UploadMetadata>({
    title: initialFile?.name.replace(/\.[^.]+$/, "") ?? "",
    type: "FILE",
    scope: initialScope,
    projectId: initialProjectId ?? "",
    departmentId: actor.departmentId ?? "",
    revision: "01",
    sourceDocumentId: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const project = projects.find((p) => p.id === metadata.projectId);
  const lifecycleContext = project ? projectLifecycleContext(project.fields ?? {}) : undefined;
  const packages = sourceGerberPackages(documents, project);
  const needsSource = metadata.type === "PANEL" || metadata.type === "STENCIL";
  const needsProject = metadata.scope === "internal" || metadata.scope === "client";
  const type = UPLOAD_TYPES.find((t) => t.id === metadata.type)!;
  const set = <K extends keyof UploadMetadata>(key: K, value: UploadMetadata[K]) =>
    setMetadata((m) => ({ ...m, [key]: value }));
  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    let fileId: string | undefined;
    try {
      if (!file) throw new Error("Choose an original file.");
      // Validate before reading or storing the binary, then bind the real digest.
      const args = {
        metadata,
        file,
        projects,
        departments,
        sourcePackages: packages,
        actor,
        documentId: crypto.randomUUID(),
        fileId: crypto.randomUUID(),
        checksum: "0".repeat(64),
        timestamp: new Date().toISOString(),
      };
      prepareUploadDraft(args);
      const checksum = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      const draft = prepareUploadDraft({ ...args, checksum });
      await saveLocalAttachment(args.fileId, file);
      fileId = args.fileId;
      if (!(await onSave(draft)))
        throw new Error(
          "The document record was not saved. The attachment has not been registered.",
        );
      fileId = undefined;
      onClose();
    } catch (e) {
      if (fileId) await removeLocalAttachment(fileId).catch(() => undefined);
      setError(e instanceof Error ? e.message : "Upload could not be saved.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving.current) onClose();
      }}
    >
      <DialogContent
        className="max-h-[88vh] overflow-y-auto sm:max-w-xl"
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Upload original document</DialogTitle>
          <DialogDescription>
            Browser-local pilot · Saved as Draft. Shared upload, approval and client release are
            separate steps.
          </DialogDescription>
        </DialogHeader>
        <fieldset disabled={busy} className="space-y-3 disabled:opacity-70">
          <label className="block text-xs font-medium">
            Original file
            <input
              aria-label="Original file"
              type="file"
              accept={type.extensions.map((e) => `.${e}`).join(",")}
              className="mt-1 block w-full text-xs"
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                setFile(next);
                if (next && !metadata.title) set("title", next.name.replace(/\.[^.]+$/, ""));
              }}
            />
          </label>
          {file && (
            <p className="text-xs text-muted-foreground">
              {file.name} · {(file.size / 1024).toFixed(1)} KB · original retained
            </p>
          )}
          <label className="block text-xs font-medium">
            Title
            <input
              aria-label="Document title"
              value={metadata.title}
              maxLength={180}
              onChange={(e) => set("title", e.target.value)}
              className={fieldClass}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium">
              Document type
              <select
                aria-label="Document type"
                value={metadata.type}
                onChange={(e) =>
                  setMetadata((m) => ({
                    ...m,
                    type: e.target.value as UploadType,
                    sourceDocumentId: "",
                  }))
                }
                className={fieldClass}
              >
                {UPLOAD_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium">
              Scope
              <select
                aria-label="Document scope"
                value={metadata.scope}
                onChange={(e) =>
                  setMetadata((m) => ({
                    ...m,
                    scope: e.target.value as UploadScope,
                    projectId: "",
                    sourceDocumentId: "",
                  }))
                }
                className={fieldClass}
              >
                <option value="common">Common / Standards</option>
                <option value="internal">Internal project</option>
                <option value="client">Client project</option>
                <option value="department">Department work</option>
              </select>
            </label>
          </div>
          {needsProject && (
            <div className="space-y-1">
              <SharedMasterSelect
                label="Document project"
                value={metadata.projectId}
                required
                options={projects.filter((p) => !p.archived).map((p) => ({
                  value: p.id,
                  label: `${p.reference} · ${p.title}`,
                }))}
                onChange={(projectId) =>
                  setMetadata((m) => ({ ...m, projectId, sourceDocumentId: "" }))
                }
              />
            {metadata.projectId && <p className="text-[11px] text-muted-foreground">Project context: {lifecycleContext?.phase ?? "Phase not mapped"} · {lifecycleContext?.stage ?? "Stage not recorded"}. Upload remains Draft; this does not complete a stage or approve the file.</p>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 text-xs font-medium">
              <SharedMasterSelect
                label="Owning department"
                value={metadata.departmentId}
                required
                options={eligibleUploadDepartments(departments, actor).map((d) => ({
                  value: d.id,
                  label: `${d.code} · ${d.name}`,
                }))}
                onChange={(departmentId) => set("departmentId", departmentId)}
              />
            </div>
            <label className="text-xs font-medium">
              Revision
              <input
                aria-label="Document revision"
                value={metadata.revision}
                maxLength={40}
                onChange={(e) => set("revision", e.target.value)}
                className={fieldClass}
              />
            </label>
          </div>
          {needsSource && (
            <div className="space-y-1 text-xs font-medium">
              <SharedMasterSelect
                label="Source Gerber package"
                value={metadata.sourceDocumentId}
                required
                options={packages.map((p) => ({
                  value: p.documentId,
                  label: `${documents.find((d) => d.id === p.documentId)?.title ?? p.documentId} · Rev ${p.revision} · ${p.checksum.slice(0, 10)}`,
                }))}
                onChange={(sourceDocumentId) => set("sourceDocumentId", sourceDocumentId)}
              />
              <span className="mt-1 block font-normal text-muted-foreground">
                Upload a Gerber ZIP for this project first. Its exact revision and checksum will be
                linked; this is not approval.
              </span>
            </div>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Saving draft…" : "Save draft upload"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
