import { unzipSync } from "fflate";
import { parseDelimitedText } from "@/lib/document-ingestion-extractor";

export type RecordSourcePair = { id: string; label: string; value: string };
export type RecordSourceField = { key: string; label: string; master?: string; readOnly?: boolean; options?: string[] };

const normalized = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "").trim();
const aliases: Record<string, string[]> = {
  controllednumber: ["record number", "record no", "document number", "document no", "reference number", "reference no", "enquiry number", "enquiry no", "po number", "po no", "purchase order number"],
  title: ["record title", "document title", "request title", "enquiry title", "subject"],
  targetdate: ["target date", "required date", "planned date", "due date"],
  duedate: ["due date", "required date", "target date"],
  invoicenumber: ["invoice no", "invoice number", "bill number", "bill no"],
  ponumber: ["po", "po no", "po number", "purchase order", "purchase order number"],
  customerreference: ["customer id", "customer code", "client id"],
  supplierreference: ["supplier id", "supplier code", "vendor id", "vendor code"],
};

export function parseRecordSourcePairs(text: string): RecordSourcePair[] {
  const lines = text.replace(/\r/g, "").split("\n").map(line => line.trim()).filter(Boolean);
  const found = new Map<string, RecordSourcePair>();
  for (let index = 0; index < lines.length && found.size < 40; index++) {
    const line = lines[index];
    const match = line.match(/^([^:：=\t]{2,80})\s*[:：=\t]\s*(.*)$/);
    if (!match) continue;
    const label = match[1].trim().replace(/^[•*\-\s]+|[\s:：=]+$/g, "");
    let value = match[2].trim();
    if (!value) {
      const next = lines[index + 1]?.trim() ?? "";
      if (next && next.length <= 180 && !/^[^:：=\t]{2,80}\s*[:：=\t]/.test(next)) value = next;
    }
    if (!label || !value || value.length > 240) continue;
    const id = normalized(label);
    if (!id || found.has(id)) continue;
    found.set(id, { id, label, value });
  }
  return [...found.values()];
}

export function suggestRecordFieldKey(label: string, fields: RecordSourceField[]): string {
  const target = normalized(label);
  const matches = fields.filter(field => {
    if (field.master || field.readOnly || (field.options?.length ?? 0) > 0) return false;
    const key = normalized(field.key);
    const candidates = [field.key, field.label, ...(aliases[key] ?? [])].map(normalized);
    return candidates.includes(target);
  });
  return matches.length === 1 ? matches[0].key : "";
}

function xmlText(xml: string, localName: string): string[] {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) return [];
  return Array.from(document.getElementsByTagNameNS("*", localName), node => node.textContent ?? "").filter(Boolean);
}

function docxText(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const xml = files["word/document.xml"];
  if (!xml) return "";
  const document = new DOMParser().parseFromString(new TextDecoder().decode(xml), "application/xml");
  return Array.from(document.getElementsByTagNameNS("*", "p"), paragraph =>
    Array.from(paragraph.getElementsByTagNameNS("*", "t"), node => node.textContent ?? "").join(""),
  ).filter(Boolean).join("\n");
}

function xlsxText(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const sharedXml = files["xl/sharedStrings.xml"] ? new TextDecoder().decode(files["xl/sharedStrings.xml"]) : "";
  const shared = xmlText(sharedXml, "si").map(value => value.replace(/\s+/g, " ").trim());
  const sheetPath = Object.keys(files).filter(path => /^xl\/worksheets\/sheet\d+\.xml$/.test(path)).sort()[0];
  if (!sheetPath) return "";
  const doc = new DOMParser().parseFromString(new TextDecoder().decode(files[sheetPath]), "application/xml");
  const rows = Array.from(doc.getElementsByTagNameNS("*", "row"), row => Array.from(row.getElementsByTagNameNS("*", "c"), cell => {
    const ref = cell.getAttribute("r") ?? "";
    const column = ref.match(/^[A-Z]+/)?.[0] ?? "";
    const type = cell.getAttribute("t");
    const raw = cell.getElementsByTagNameNS("*", "v")[0]?.textContent ?? "";
    const inline = Array.from(cell.getElementsByTagNameNS("*", "t"), node => node.textContent ?? "").join("");
    return { column, value: type === "s" ? shared[Number(raw)] ?? "" : inline || raw };
  }).filter(cell => cell.column));
  const headers = rows[0] ?? [];
  const firstData = rows.slice(1).find(row => row.some(cell => cell.value.trim()));
  if (!firstData) return "";
  return headers.map((header, index) => {
    const value = firstData[index]?.value.trim();
    return header.value.trim() && value ? `${header.value.trim()}: ${value}` : "";
  }).filter(Boolean).join("\n");
}

function jsonText(value: unknown, prefix = "", rows: string[] = []): string {
  if (rows.length >= 40) return rows.join("\n");
  if (Array.isArray(value)) {
    if (value.length && typeof value[0] === "object") return jsonText(value[0], prefix, rows);
    return rows.join("\n");
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) jsonText(child, prefix ? `${prefix} ${key}` : key, rows);
  } else if (prefix && value !== null && value !== undefined) {
    rows.push(`${prefix}: ${String(value)}`);
  }
  return rows.join("\n");
}

async function imageData(file: File): Promise<CanvasImageSource> {
  return createImageBitmap(file);
}

async function recognizeImage(source: CanvasImageSource, worker: Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>): Promise<string> {
  const canvas = document.createElement("canvas");
  const width = "width" in source ? Number(source.width) : 0;
  const height = "height" in source ? Number(source.height) : 0;
  if (!width || !height) return "";
  const scale = Math.min(1, 1800 / width);
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Local OCR canvas is unavailable in this browser.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return (await worker.recognize(canvas)).data.text;
}

/** Extract text on the current device. The selected file is never sent to an OCR endpoint. */
export async function extractRecordSourceText(file: File, onProgress?: (message: string) => void): Promise<string> {
  if (!file.size || file.size > 25 * 1024 * 1024) throw new Error("Choose a non-empty source file up to 25 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["txt", "csv", "tsv"].includes(ext)) {
    const text = await file.text();
    if (ext === "txt") return text.slice(0, 30_000);
    const { headers, rows } = parseDelimitedText(text, ext === "tsv" ? "\t" : ",");
    return rows.slice(0, 40).flatMap(row => headers.map(header => row[header] ? `${header}: ${row[header]}` : "")).filter(Boolean).join("\n").slice(0, 30_000);
  }
  if (ext === "json") return jsonText(JSON.parse(await file.text())).slice(0, 30_000);
  if (ext === "docx") return docxText(new Uint8Array(await file.arrayBuffer())).slice(0, 30_000);
  if (["xlsx", "xlsm"].includes(ext)) return xlsxText(new Uint8Array(await file.arrayBuffer())).slice(0, 30_000);
  if (ext === "doc" || ext === "xls") throw new Error("This legacy Office file can be attached, but its contents cannot be extracted. Use DOCX/XLSX or fill the form manually.");

  const { createWorker } = await import("tesseract.js");
  onProgress?.("Loading on-device OCR models…");
  const worker = await createWorker("eng+hin");
  try {
    if (ext === "pdf" || file.type === "application/pdf") {
      const pdfjs = await import("pdfjs-dist");
      const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      const results: string[] = [];
      const pageCount = Math.min(pdf.numPages, 12);
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
        onProgress?.(`Reading PDF page ${pageNumber} of ${pageCount} locally…`);
        const page = await pdf.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(2, 1800 / base.width);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("PDF preview canvas is unavailable.");
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        results.push((await worker.recognize(canvas)).data.text);
        page.cleanup();
      }
      return results.join("\n\n").slice(0, 30_000);
    }
    if (file.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff"].includes(ext)) {
      onProgress?.("Reading image locally…");
      const bitmap = await imageData(file);
      try { return (await recognizeImage(bitmap, worker)).slice(0, 30_000); }
      finally { bitmap.close(); }
    }
    throw new Error("OCR supports PDF and common images. Text/CSV/JSON/DOCX/XLSX are extracted locally; other formats remain attachable for manual entry.");
  } finally {
    await worker.terminate();
  }
}
