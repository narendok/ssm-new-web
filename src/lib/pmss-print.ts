type Row = { reference: string; title: string; type: string; status: string };
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
/** Escaped snapshot only: never grants a signature, acceptance or production release. */
export function pmssPrintHtml(
  project: { reference: string; title: string; fields: Record<string, string> },
  rows: Row[],
  requirements: Record<string, string>,
  history: { actor: string; action: string; revision: number; at: string }[],
) {
  const table = (entries: [string, unknown][]) =>
    `<table>${entries.map(([key, value]) => `<tr><th>${escape(key)}</th><td>${escape(value || "Not recorded")}</td></tr>`).join("")}</table>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(project.reference)} — PMSS</title><style>@page{size:A4;margin:16mm}body{font:11px Arial,sans-serif;color:#17212b}h1{font-size:20px}h2{font-size:14px;margin-top:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccd3dc;padding:6px;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere}th{width:30%}tr{break-inside:avoid}.notice{padding:10px;border:1px solid #ccd3dc}</style></head><body><h1>Project Master Spec Sheet</h1><p>${escape(project.reference)} · ${escape(project.title)}</p><p class="notice">Snapshot of permitted records. This printout does not grant approval, certification or customer acceptance. Original decision receipts remain authoritative.</p><h2>Overview</h2>${table(["customer", "track", "owner", "currentStage", "companyPhase", "portfolioStatus", "revision", "responsibilityVersion"].map((k) => [k, project.fields[k]]))}<h2>Operating requirements and compliance</h2>${table(Object.entries(requirements))}<h2>Linked records</h2>${table(rows.map((r) => [`${r.reference} · ${r.type}`, `${r.title} · ${r.status}`]))}<h2>Requirements revision history</h2>${table(history.map((h) => [`Revision ${h.revision} · ${h.at}`, `${h.actor} · ${h.action}`]))}<h2>Lifecycle baseline</h2><p>${escape(
    (() => {
      try {
        return JSON.parse(project.fields["lifecycleBaseline"] || "{}").id || "Legacy / unpinned";
      } catch {
        return "Legacy / unpinned";
      }
    })(),
  )}</p></body></html>`;
}
export function printPmss(html: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("title", "Printable project master spec sheet");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0";
  document.body.append(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const view = frame.contentWindow;
  if (!view) {
    frame.remove();
    return;
  }
  view.addEventListener("afterprint", () => frame.remove(), { once: true });
  view.focus();
  view.print();
}
