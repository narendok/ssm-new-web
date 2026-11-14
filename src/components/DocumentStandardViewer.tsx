import React, { useState } from "react";
import {
  FileText,
  Printer,
  Copy,
  Check,
  Download,
  Settings,
  ShieldCheck,
  AlertTriangle,
  Clock,
  UserCheck,
  Layers,
  FileCode,
  X,
} from "lucide-react";
import { supportsDraftDocx, type buildDocumentDraft, type DraftSource } from "@/lib/document-draft";
import { NativeAttachmentCard } from "./NativeAttachmentCard";

export type PrintableDocumentProps = {
  documentId: string;
  title: string;
  stage: string;
  project: string;
  revision: string;
  date?: string;
  classification?: string;
  status?: string;
  preparedBy?: { name: string; role: string; date: string; status: "Completed" | "Pending" };
  reviewedBy?: { name: string; role: string; date: string; status: "Completed" | "Pending" | "Rejected" };
  approvedBy?: { name: string; role: string; date: string; status: "Completed" | "Pending" | "Rejected" };
};

export type TemplateSettingsProps = {
  companyName: string;
  logoBadge: string;
  accreditationMarks: string;
  techCenter: string;
  plantLocation: string;
  confidentialityNotice: string;
  complianceFooter: string;
};

export function DocumentStandardViewer({
  document,
  draft,
  source,
  settings,
  onClose,
  onOpenSettings,
  settingsSourceNotice,
}: {
  document: PrintableDocumentProps;
  draft: ReturnType<typeof buildDocumentDraft>;
  source?: DraftSource | undefined;
  settings: TemplateSettingsProps;
  onClose: () => void;
  onOpenSettings?: () => void;
  settingsSourceNotice?: string;
}) {
  const [copiedMd, setCopiedMd] = useState(false);
  const [wordExportError, setWordExportError] = useState(false);

  const exportWord = async () => {
    setWordExportError(false);
    try {
      const { buildDraftDocx } = await import("@/lib/document-draft-docx");
      const bytes = buildDraftDocx(document, draft, settings);
      const blob = new Blob([Uint8Array.from(bytes).buffer], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `${document.documentId.replace(/[^\w.-]/g, "_")}-draft.docx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setWordExportError(true);
    }
  };

  const formattedDate = document.date || new Date().toISOString().slice(0, 10);

  const copyMarkdown = () => {
    const md = [
      `# ${document.title}`,
      `**Document ID:** ${document.documentId} | **Rev:** ${document.revision} | **Date:** ${formattedDate}`,
      `**Project:** ${document.project} | **Stage:** ${document.stage} | **Classification:** ${draft.snapshot.classification}`,
      `**Catalogue Family:** ${draft.catalogueFamilyId ?? "N/A"} | **Template:** ${draft.type ?? "Generic"} / ${draft.templateVersion}`,
      "",
      "---",
      "",
      `### Scope & Source Baseline: ${source?.reference || "None"}`,
      source?.notes ? `> Notes: ${source.notes}\n` : "",
      ...draft.sections.map((sec, idx) =>
        [
          `### ${idx + 1}.0 ${sec.title}`,
          "| Field | Available Information | Source Reference |",
          "| :--- | :--- | :--- |",
          ...sec.rows.map((row) => `| ${row[0] ?? ""} | ${row[1] ?? ""} | ${row[2] ?? ""} |`),
          "",
        ].join("\n")
      ),
      "### Review & Sign-off Ledger",
      `| Role | Name | Status | Date |`,
      `| :--- | :--- | :--- | :--- |`,
      `| Prepared By | ${document.preparedBy?.name || "Author"} | ${document.preparedBy?.status || "Draft"} | ${document.preparedBy?.date || formattedDate} |`,
      `| Reviewed By | ${document.reviewedBy?.name || "Department HOD"} | ${document.reviewedBy?.status || "Pending"} | ${document.reviewedBy?.date || "—"} |`,
      `| Approved By | ${document.approvedBy?.name || "Lead Authority / Admin"} | ${document.approvedBy?.status || "Pending"} | ${document.approvedBy?.date || "—"} |`,
      "",
      `*${settings.confidentialityNotice}*`,
    ].join("\n");

    navigator.clipboard.writeText(md);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const exportSourceJson = () => {
    const blob = new Blob([JSON.stringify(draft.snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${document.documentId}-source-snapshot.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-ink/40 backdrop-blur-sm md:place-items-center md:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={document.title}
        className="surface-card max-h-[94vh] w-full max-w-5xl overflow-auto border border-border bg-popover shadow-2xl rounded-xl"
      >
        {/* Modal Toolbar (hidden in print) */}
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-popover/95 px-5 py-3 backdrop-blur no-print">
          <div className="flex items-center gap-2 min-w-0">
            <span className="grid size-7 place-items-center rounded bg-primary/10 text-primary font-bold text-xs">
              DOC
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-foreground truncate">{document.title}</h2>
              {settingsSourceNotice && <p className="text-[10px] text-muted-foreground">{settingsSourceNotice}</p>}
              <p className="text-[10px] font-mono text-muted-foreground truncate">
                {document.documentId} · Rev {document.revision}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyMarkdown}
              className="flex items-center gap-1 rounded border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-secondary transition"
              title="Copy Full Markdown"
            >
              {copiedMd ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
              <span>{copiedMd ? "Copied" : "Copy Markdown"}</span>
            </button>

            <button
              type="button"
              onClick={exportSourceJson}
              className="flex items-center gap-1 rounded border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-secondary transition"
              title="Download machine-readable source JSON snapshot"
            >
              <Download className="size-3.5" />
              <span>Export Snapshot</span>
            </button>
            {draft.supported && supportsDraftDocx(draft.type) && (
              <button type="button" onClick={exportWord} className="flex items-center gap-1 rounded border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-secondary transition" title="Download the unissued draft as a Word document">
                <Download className="size-3.5" /> Download Word draft
              </button>
            )}
            {wordExportError && <span role="alert">Word download failed. Try again.</span>}

            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="flex items-center gap-1 rounded border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-secondary transition"
                title="Customize Header & Footer Settings"
              >
                <Settings className="size-3.5" />
                <span>Header & Footer</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
              title="Print document or save as PDF"
            >
              <Printer className="size-3.5" />
              <span>🖨️ Print / Save PDF</span>
            </button>

            <button
              aria-label="Close"
              onClick={onClose}
              className="grid size-7 place-items-center rounded border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground transition ml-1"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {/* Printable A4 Document Content */}
        <div className="p-4 sm:p-8 bg-muted/20">
          <article
            id="printable-document"
            className="print-document printable-document-content mx-auto max-w-[794px] border border-border bg-card p-6 sm:p-10 text-foreground shadow-xl rounded-lg"
          >
            {/* TIER 1: CONTROLLED DOCUMENT HEADER */}
            <header className="grid gap-px overflow-hidden border-2 border-foreground/40 bg-border sm:grid-cols-[1.2fr_1.6fr_1.2fr] rounded-t">
              {/* Left: Organization Identity */}
              <div className="bg-card p-3.5 flex flex-col justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary font-bold text-primary-foreground text-sm">
                    {settings.logoBadge || "SSM"}
                  </span>
                  <div>
                    <p className="text-xs font-bold leading-tight text-foreground">{settings.companyName}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">Automotive Tech Center</p>
                  </div>
                </div>
                <p className="mt-3 text-[9px] leading-4 text-muted-foreground border-t border-border/40 pt-1.5">
                  {settings.accreditationMarks || "TEST sample · standards targets only · certification status unverified"}
                </p>
              </div>

              {/* Center: Title & Project Context */}
              <div className="bg-card p-3.5 text-center flex flex-col justify-center">
                <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  Automotive Controlled Record
                </span>
                <h1 className="text-sm font-bold text-foreground mt-0.5 leading-snug">{document.title}</h1>
                <p className="mt-1 text-[10px] font-medium text-steel font-mono">
                  {document.stage} · {document.project}
                </p>
                {draft.catalogueFamilyId && (
                  <span className="mt-1 inline-block self-center rounded bg-secondary px-2 py-0.5 text-[9px] font-mono font-bold text-muted-foreground">
                    Family: {draft.catalogueFamilyId} · Template v{draft.templateVersion}
                  </span>
                )}
              </div>

              {/* Right: Controlled Numbers, Classification & Status */}
              <div className="bg-card p-3.5 text-[10px] flex flex-col justify-between">
                <div className="space-y-1">
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Doc ID:</span>
                    <strong className="font-mono text-foreground">{document.documentId}</strong>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Revision:</span>
                    <strong className="font-mono text-foreground">{document.revision}</strong>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Effective Date:</span>
                    <span className="font-mono">{formattedDate}</span>
                  </p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase font-mono ${
                      draft.isClientDeliverable
                        ? "bg-accent/15 text-accent border border-accent/30"
                        : "bg-steel/15 text-steel border border-steel/30"
                    }`}
                  >
                    {draft.isClientDeliverable ? "Client Deliverable" : "Internal Engineering"}
                  </span>
                  <span className="inline-block px-2 py-0.5 rounded bg-warning/15 text-warning font-bold text-[9px] uppercase font-mono">
                    {document.status || "Draft"}
                  </span>
                </div>
              </div>
            </header>

            {/* Plant Locations Subheader */}
            <section className="border-x-2 border-b-2 border-foreground/40 bg-panel px-4 py-2 text-[10px] flex flex-wrap justify-between gap-2 border-t-0">
              <p>
                <span className="font-mono text-muted-foreground uppercase text-[9px]">Tech Center:</span>{" "}
                <span className="font-semibold text-foreground">{settings.techCenter}</span>
              </p>
              <p>
                <span className="font-mono text-muted-foreground uppercase text-[9px]">Manufacturing Plant:</span>{" "}
                <span className="font-semibold text-foreground">{settings.plantLocation}</span>
              </p>
            </section>

            {/* Warning Banner: Human Review Required */}
            <section className="mt-5 rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs flex items-start gap-2.5">
              <AlertTriangle className="size-4 shrink-0 text-warning mt-0.5" />
              <div>
                <p className="font-bold text-foreground">
                  Unissued Controlled Draft · Technical Review Required Prior to Release
                </p>
                <p className="text-muted-foreground text-[11px] mt-0.5 leading-normal">
                  Template Type: <strong>{draft.type ?? "Generic / Fallback"}</strong> (v{draft.templateVersion}) ·{" "}
                  Completion: <strong>{draft.completionPercentage}%</strong> ({draft.missingFields.length} missing fields).
                  Values below are compiled with strict provenance. Missing parameters strictly render as TBD.
                </p>
              </div>
            </section>

            {/* TIER 2: SCOPE, BASELINE REFERENCES & NATIVE ATTACHMENTS */}
            <section className="mt-6 border border-border rounded-lg bg-panel p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-foreground flex items-center gap-1.5">
                  <Layers className="size-3.5 text-primary" />
                  Program Scope & Baseline Linkage
                </h3>
                <span className="text-[10px] font-mono text-muted-foreground">
                  Source Ref: {source?.reference || "Direct Entry"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-mono text-muted-foreground block">Customer Program</span>
                  <span className="font-medium text-foreground">{document.project}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono text-muted-foreground block">Operating Phase Gate</span>
                  <span className="font-medium text-foreground">{document.stage}</span>
                </div>
              </div>

              {source?.notes && (
                <div className="pt-2 border-t border-border">
                  <span className="text-[10px] uppercase font-mono text-muted-foreground block">Source Baseline Notes</span>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-foreground bg-card p-2.5 rounded border border-border">
                    {source.notes}
                  </p>
                </div>
              )}

              {/* Native Attachments Vault */}
              {draft.attachments.length > 0 && (
                <div className="pt-3 border-t border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono font-bold text-foreground flex items-center gap-1">
                      <FileCode className="size-3 text-steel" />
                      Controlled Native Attachments ({draft.attachments.length})
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono">
                      Cryptographic SHA-256 Verified
                    </span>
                  </div>
                  <div className="space-y-2">
                    {draft.attachments.map((att, idx) => (
                      <NativeAttachmentCard key={`${att.filename}-${idx}`} attachment={att} />
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* TIER 3: DOMAIN TECHNICAL / COMMERCIAL PAYLOAD */}
            <div className="mt-6 space-y-6">
              {draft.sections.map((section, idx) => (
                <section key={section.title} className="space-y-2">
                  <div className="flex items-center justify-between border-b border-foreground/30 pb-1">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">
                      {idx + 1}.0 {section.title}
                    </h3>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {section.rows.length} parameters
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-border rounded-lg">
                    <table className="w-full min-w-[580px] text-left text-xs">
                      <thead className="bg-panel font-mono text-[10px] uppercase text-muted-foreground">
                        <tr>
                          <th className="p-2.5 w-[35%] font-semibold">Specification Parameter</th>
                          <th className="p-2.5 w-[40%] font-semibold">Recorded / Verified Information</th>
                          <th className="p-2.5 w-[25%] font-semibold">Provenance Reference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.map((row, rIdx) => {
                          const isTbd = Boolean(row[1]?.startsWith("TBD"));
                          return (
                            <tr
                              key={`${row[0] ?? ""}-${rIdx}`}
                              className="border-t border-border hover:bg-muted/10 transition-colors"
                            >
                              <td className="p-2.5 font-medium text-foreground align-top font-mono text-[11px]">
                                {row[0] ?? ""}
                              </td>
                              <td className="p-2.5 align-top">
                                {isTbd ? (
                                  <span className="rounded bg-warning/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-warning border border-warning/20">
                                    {row[1] ?? ""}
                                  </span>
                                ) : (
                                  <span className="text-foreground font-semibold">{row[1] ?? ""}</span>
                                )}
                              </td>
                              <td className="p-2.5 align-top font-mono text-[10px] text-muted-foreground">
                                {row[2] ?? ""}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>

            {/* TIER 4: ROLE-BASED SIGN-OFF LEDGER */}
            <section className="mt-8 border-t-2 border-foreground/40 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wide font-mono flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-primary" />
                  Controlled Verification & Sign-off Ledger
                </h3>
                <span className="text-[9px] font-mono text-muted-foreground">
                  Internal draft history · source verification and human review required
                </span>
              </div>

              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full min-w-[580px] text-left text-xs">
                  <thead className="bg-panel font-mono text-[10px] uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2.5 font-semibold">Authority Role</th>
                      <th className="p-2.5 font-semibold">Designated Signer</th>
                      <th className="p-2.5 font-semibold">Decision / Status</th>
                      <th className="p-2.5 font-semibold">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Prepared By */}
                    <tr className="border-t border-border">
                      <td className="p-2.5 font-semibold text-foreground">1. Prepared By (Author)</td>
                      <td className="p-2.5 text-foreground">{document.preparedBy?.name || "Not recorded"}</td>
                      <td className="p-2.5">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${document.preparedBy?.status === "Completed" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                          {document.preparedBy?.status || "Pending"}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-[10px] text-muted-foreground">
                        {document.preparedBy?.date || "Not recorded"}
                      </td>
                    </tr>

                    {/* Reviewed By */}
                    <tr className="border-t border-border">
                      <td className="p-2.5 font-semibold text-foreground">2. Technical Review (HOD)</td>
                      <td className="p-2.5 text-foreground">{document.reviewedBy?.name || "Department Lead"}</td>
                      <td className="p-2.5">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            document.reviewedBy?.status === "Completed"
                              ? "bg-success/15 text-success"
                              : "bg-warning/15 text-warning"
                          }`}
                        >
                          {document.reviewedBy?.status || "Pending Technical Endorsement"}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-[10px] text-muted-foreground">
                        {document.reviewedBy?.date || "Awaiting Gate"}
                      </td>
                    </tr>

                    {/* Approved By */}
                    <tr className="border-t border-border">
                      <td className="p-2.5 font-semibold text-foreground">3. Lead Authority / Executive</td>
                      <td className="p-2.5 text-foreground">{document.approvedBy?.name || "Lead Authority"}</td>
                      <td className="p-2.5">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            document.approvedBy?.status === "Completed"
                              ? "bg-success/15 text-success"
                              : "bg-warning/15 text-warning"
                          }`}
                        >
                          {document.approvedBy?.status || "Pending Release Authorization"}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-[10px] text-muted-foreground">
                        {document.approvedBy?.date || "Awaiting Release"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Document Footer */}
            <footer className="mt-8 border-t-2 border-foreground/40 pt-4 text-center text-[9px] leading-relaxed text-muted-foreground">
              <p className="font-semibold">{settings.confidentialityNotice}</p>
              <p className="mt-1">{settings.complianceFooter}</p>
              <p className="mt-2 text-steel font-mono">
                Classification: {draft.snapshot.classification} · Printed: {new Date().toLocaleString("en-IN")}
              </p>
              <div className="no-print mt-4">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="rounded bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow"
                >
                  🖨️ Print / Save PDF
                </button>
              </div>
            </footer>
          </article>
        </div>
      </section>
    </div>
  );
}
