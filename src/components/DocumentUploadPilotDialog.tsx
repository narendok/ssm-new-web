import { useEffect, useRef, useState } from "react";
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
  CATALOGUE_FAMILY_BY_UPLOAD_TYPE,
  type UploadDepartment,
  type UploadDocument,
  type UploadMetadata,
  type UploadProject,
  type UploadScope,
  type UploadType,
} from "@/lib/document-upload-pilot";
import {
  extractDocumentContent,
  type IngestionExtractionResult,
  type ExtractedField,
} from "@/lib/document-ingestion-extractor";
import {
  resolveAllEntities,
  type CanonicalMatchSummary,
} from "@/lib/document-canonical-matching";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertCircle, FileSearch, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

export type UploadDraft = ReturnType<typeof prepareUploadDraft>;
type Props = {
  initialFile: File | null;
  initialProjectId?: string | undefined;
  initialType?: UploadType | undefined;
  projects: UploadProject[];
  departments: UploadDepartment[];
  documents: UploadDocument[];
  initialScope: UploadScope;
  actor: { id: string; kind: string; name: string; departmentId?: string | undefined };
  onClose: () => void;
  onSave: (document: UploadDraft, file?: File | null) => Promise<boolean>;
};

const fieldClass =
  "mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground";

export function DocumentUploadPilotDialog({
  initialFile,
  initialProjectId,
  initialType = "FILE",
  projects,
  departments,
  documents,
  initialScope,
  actor,
  onClose,
  onSave,
}: Props) {
  const [file, setFile] = useState<File | null>(initialFile);
  const [metadata, setMetadata] = useState<UploadMetadata>({
    title: initialFile?.name.replace(/\.[^.]+$/, "") ?? "",
    type: initialType,
    scope: initialScope,
    projectId: initialProjectId ?? "",
    departmentId: actor.departmentId ?? "",
    revision: "01",
    sourceDocumentId: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [extractionResult, setExtractionResult] = useState<IngestionExtractionResult | null>(null);
  const [matchSummary, setMatchSummary] = useState<CanonicalMatchSummary | null>(null);
  const [showExtractedFields, setShowExtractedFields] = useState(true);
  const saving = useRef(false);

  const project = projects.find((p) => p.id === metadata.projectId);
  const lifecycleContext = project ? projectLifecycleContext(project.fields ?? {}) : undefined;
  const packages = sourceGerberPackages(documents, project);
  const needsSource = metadata.type === "PANEL" || metadata.type === "STENCIL";
  const needsProject = metadata.scope === "internal" || metadata.scope === "client";
  const type = UPLOAD_TYPES.find((t) => t.id === metadata.type)!;
  const catalogueFamily = CATALOGUE_FAMILY_BY_UPLOAD_TYPE[metadata.type] ?? "D01";

  const set = <K extends keyof UploadMetadata>(key: K, value: UploadMetadata[K]) =>
    setMetadata((m) => ({ ...m, [key]: value }));

  // Run extraction when file or type changes
  useEffect(() => {
    if (!file) {
      setExtractionResult(null);
      setMatchSummary(null);
      return;
    }

    let isSubscribed = true;
    const processFile = async () => {
      try {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        const isTextual = ["csv", "tsv", "json", "txt"].includes(ext);
        let textBuffer: string | undefined;
        let binaryBuffer: ArrayBuffer | undefined;

        if (isTextual) {
          textBuffer = await file.text();
        } else {
          binaryBuffer = await file.arrayBuffer();
        }

        const result = await extractDocumentContent({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || "application/octet-stream",
          textBuffer,
          binaryBuffer,
          uploadType: metadata.type,
        });

        if (!isSubscribed) return;
        setExtractionResult(result);

        // Resolve entities against canonical masters
        const matches = resolveAllEntities({
          detectedEntities: result.detectedEntities,
          projects,
        });
        setMatchSummary(matches);

        // If exact project matched and no project currently chosen, auto-select
        if (
          matches.projectResolution.status === "EXACT_MATCH" &&
          matches.projectResolution.matchedId &&
          !metadata.projectId &&
          needsProject
        ) {
          setMetadata((m) => ({ ...m, projectId: matches.projectResolution.matchedId! }));
        }
      } catch (err) {
        if (!isSubscribed) return;
        console.warn("File extraction notice:", err);
      }
    };

    void processFile();
    return () => {
      isSubscribed = false;
    };
  }, [file, metadata.type, projects, needsProject]);

  const handleFieldChange = (fieldId: string, newValue: string) => {
    if (!extractionResult) return;
    setExtractionResult((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        extractedFields: prev.extractedFields.map((f) =>
          f.id === fieldId ? { ...f, value: newValue } : f,
        ),
      };
    });
  };

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
        checksum: extractionResult?.checksum || "0".repeat(64),
        timestamp: new Date().toISOString(),
      };
      prepareUploadDraft(args);

      const checksum =
        extractionResult?.checksum && /^[a-f0-9]{64}$/i.test(extractionResult.checksum)
          ? extractionResult.checksum
          : Array.from(
              new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())),
              (b) => b.toString(16).padStart(2, "0"),
            ).join("");

      const draft = prepareUploadDraft({ ...args, checksum });
      await saveLocalAttachment(args.fileId, file);
      fileId = args.fileId;
      if (!(await onSave(draft, file)))
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
        className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>Smart Upload &amp; Document Ingestion</DialogTitle>
            <Badge variant="outline" className="font-mono text-[11px]">
              Family {catalogueFamily}
            </Badge>
          </div>
          <DialogDescription>
            Controlled Document Intake · Retains original binary &amp; SHA-256 · Saved as Draft.
            Shared upload, approval and client release remain separate review gates.
          </DialogDescription>
        </DialogHeader>

        <fieldset disabled={busy} className="space-y-3.5 disabled:opacity-70">
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
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/30 p-2 text-xs">
              <span className="font-medium text-foreground">{file.name}</span>
              <span className="text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB · Original binary registered
              </span>
              {extractionResult?.checksum && (
                <span className="w-full font-mono text-[10px] text-muted-foreground truncate">
                  SHA-256: {extractionResult.checksum}
                </span>
              )}
            </div>
          )}

          {/* Intelligent Extraction Preview & Field Review */}
          {extractionResult && (
            <div className="rounded-lg border border-border/80 bg-background/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSearch className="size-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground">
                    Intelligent Extraction &amp; Provenance
                  </span>
                  <Badge
                    variant={extractionResult.status === "SUCCESS" ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {extractionResult.status === "SUCCESS"
                      ? "Structured Data"
                      : "Manual Review Mode"}
                  </Badge>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => setShowExtractedFields((v) => !v)}
                >
                  {showExtractedFields ? (
                    <>
                      Hide <ChevronUp className="size-3" />
                    </>
                  ) : (
                    <>
                      Show ({extractionResult.extractedFields.length}){" "}
                      <ChevronDown className="size-3" />
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-muted-foreground">
                {extractionResult.summaryMessage}
              </p>

              {/* Canonical Entity Matching Badges */}
              {matchSummary && (
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50 text-[11px]">
                  <span className="font-medium text-foreground">Entity Resolution:</span>
                  {matchSummary.projectResolution.status !== "NOT_SPECIFIED" && (
                    <span
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
                        matchSummary.projectResolution.status === "EXACT_MATCH"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {matchSummary.projectResolution.status === "EXACT_MATCH" ? (
                        <CheckCircle2 className="size-3" />
                      ) : (
                        <AlertCircle className="size-3" />
                      )}
                      Project: {matchSummary.projectResolution.matchedReference ?? "Ambiguous"} (
                      {matchSummary.projectResolution.reason})
                    </span>
                  )}
                  {matchSummary.supplierResolution.status !== "NOT_SPECIFIED" && (
                    <span
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
                        matchSummary.supplierResolution.status === "EXACT_MATCH"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      Supplier: {matchSummary.supplierResolution.matchedLabel ?? "Unresolved"} (
                      {matchSummary.supplierResolution.reason})
                    </span>
                  )}
                </div>
              )}

              {/* Editable Extracted Fields List */}
              {showExtractedFields && extractionResult.extractedFields.length > 0 && (
                <div className="max-h-40 space-y-1.5 overflow-y-auto pt-1">
                  {extractionResult.extractedFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-2 rounded bg-muted/40 px-2 py-1 text-xs"
                    >
                      <span className="w-1/3 truncate font-medium text-foreground" title={field.label}>
                        {field.label}
                      </span>
                      <input
                        type="text"
                        value={field.value}
                        aria-label={`Extracted ${field.label}`}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className="flex-1 rounded border border-input bg-background px-1.5 py-0.5 text-xs font-mono"
                      />
                      <span
                        className="text-[10px] text-muted-foreground shrink-0 font-mono"
                        title={JSON.stringify(field.provenance)}
                      >
                        {field.provenance.row ? `Row ${field.provenance.row}` : field.provenance.locator ?? "Header"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                options={projects
                  .filter((p) => !p.archived)
                  .map((p) => ({
                    value: p.id,
                    label: `${p.reference} · ${p.title}`,
                  }))}
                onChange={(projectId) =>
                  setMetadata((m) => ({ ...m, projectId, sourceDocumentId: "" }))
                }
              />
              {metadata.projectId && (
                <p className="text-[11px] text-muted-foreground">
                  Project context: {lifecycleContext?.phase ?? "Phase not mapped"} ·{" "}
                  {lifecycleContext?.stage ?? "Stage not recorded"}. Upload remains Draft; this does
                  not complete a stage or approve the file.
                </p>
              )}
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

          {/* Interlock Safety Card */}
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-400">
              <ShieldCheck className="size-4 shrink-0" />
              Guarded Save Interlocks Active
            </div>
            <p className="text-[11px] leading-relaxed">
              Saved as <strong>Draft</strong> in Document Vault. Ingestion will <strong>not</strong>{" "}
              approve documents, release to client, create purchase orders, or adjust stock balances.
            </p>
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
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
