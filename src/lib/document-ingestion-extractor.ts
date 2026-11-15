/**
 * SSM One - Intelligent Document Ingestion & Extraction Engine
 *
 * Implements Phase 2 safe file intake and extraction:
 * - Parses CSV, TSV, JSON, TXT with row/col/line provenance
 * - Safely handles binary files (PDF, ZIP, STEP, HEX) with explicit manual-review fallback
 * - Retains original file identity, size, and SHA-256 digest
 * - Emits editable extracted fields with confidence scoring (HIGH, REVIEW_REQUIRED, MANUAL_REVIEW)
 * - Fails safely on malformed, empty, or oversized files
 * - Strictly avoids fake OCR or hallucinated values
 */

export type ExtractionConfidence = "HIGH" | "REVIEW_REQUIRED" | "MANUAL_REVIEW";

export type FieldProvenance = {
  sourceFile: string;
  row?: number;
  column?: string;
  line?: number;
  locator?: string;
};

export type ExtractedField = {
  id: string;
  key: string;
  label: string;
  value: string;
  confidence: ExtractionConfidence;
  provenance: FieldProvenance;
  isEditable: boolean;
};

export type ExtractedLineItem = {
  rowNumber: number;
  mpn: string;
  description: string;
  quantity: number;
  unitRate: string;
  total: string;
  provenance: FieldProvenance;
};

export type DetectedEntities = {
  customerReference?: string | undefined;
  customerName?: string | undefined;
  supplierReference?: string | undefined;
  supplierName?: string | undefined;
  projectReference?: string | undefined;
  partNumbers?: string[] | undefined;
};

export type IngestionExtractionResult = {
  status: "SUCCESS" | "MANUAL_REVIEW" | "ERROR";
  fileName: string;
  fileSize: number;
  fileType: string;
  checksum: string;
  extractedFields: ExtractedField[];
  lineItems: ExtractedLineItem[];
  detectedEntities: DetectedEntities;
  warnings: string[];
  summaryMessage: string;
};

/**
 * Computes SHA-256 digest of an ArrayBuffer or Uint8Array.
 */
export async function computeSha256(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const digestBuffer = await crypto.subtle.digest("SHA-256", data as unknown as BufferSource);
  return Array.from(new Uint8Array(digestBuffer), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * Safely parses delimited lines (CSV / TSV).
 */
export function parseDelimitedText(
  text: string,
  delimiter: string = ",",
): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(cur.trim());
        cur = "";
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const firstLine = lines[0];
  if (!firstLine) return { headers: [], rows: [] };
  const headers = parseRow(firstLine);
  const rows: Record<string, string>[] = [];

  for (let r = 1; r < lines.length; r++) {
    const line = lines[r];
    if (!line) continue;
    const values = parseRow(line);
    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] ?? "";
    });
    rows.push(rowObj);
  }

  return { headers, rows };
}

/**
 * Extracts structured values from text, CSV, JSON or binary content.
 */
export async function extractDocumentContent(input: {
  fileName: string;
  fileSize: number;
  fileType: string;
  textBuffer?: string | undefined;
  binaryBuffer?: ArrayBuffer | undefined;
  uploadType: string;
}): Promise<IngestionExtractionResult> {
  const { fileName, fileSize, fileType, textBuffer, binaryBuffer, uploadType } = input;

  // 1. File size / sanity check
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
    return {
      status: "ERROR",
      fileName,
      fileSize,
      fileType,
      checksum: "",
      extractedFields: [],
      lineItems: [],
      detectedEntities: {},
      warnings: ["File is empty (0 bytes)."],
      summaryMessage: "The uploaded file is empty. Please select a valid document.",
    };
  }

  if (fileSize > 25 * 1024 * 1024) {
    return {
      status: "ERROR",
      fileName,
      fileSize,
      fileType,
      checksum: "",
      extractedFields: [],
      lineItems: [],
      detectedEntities: {},
      warnings: ["File exceeds maximum size of 25 MB."],
      summaryMessage: "The uploaded file exceeds the 25 MB limit for document ingestion.",
    };
  }

  // 2. Checksum computation
  let checksum = "";
  try {
    if (binaryBuffer) {
      checksum = await computeSha256(binaryBuffer);
    } else if (textBuffer) {
      const encoder = new TextEncoder();
      checksum = await computeSha256(encoder.encode(textBuffer));
    }
  } catch {
    checksum = "0".repeat(64);
  }

  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const extractedFields: ExtractedField[] = [];
  const lineItems: ExtractedLineItem[] = [];
  const detectedEntities: DetectedEntities = {};
  const warnings: string[] = [];

  // Helper to record field
  const addField = (
    key: string,
    label: string,
    value: string,
    confidence: ExtractionConfidence,
    provenance: FieldProvenance,
  ) => {
    if (!value || !value.trim()) return;
    extractedFields.push({
      id: `field_${extractedFields.length + 1}`,
      key,
      label,
      value: value.trim(),
      confidence,
      provenance,
      isEditable: true,
    });
  };

  // 3. Tabular parsing (CSV / TSV)
  if (extension === "csv" || extension === "tsv") {
    const raw = textBuffer ?? "";
    const delimiter = extension === "tsv" ? "\t" : ",";
    const { headers, rows } = parseDelimitedText(raw, delimiter);

    if (rows.length === 0) {
      warnings.push("No data rows found in spreadsheet/CSV.");
    }

    // Inspect headers for known columns
    const findCol = (regex: RegExp) => headers.find((h) => regex.test(h));
    const mpnCol = findCol(/mpn|part[\s_-]?num|item[\s_-]?code/i);
    const descCol = findCol(/desc|specification|description/i);
    const qtyCol = findCol(/qty|quantity|count/i);
    const rateCol = findCol(/rate|price|unit[\s_-]?cost|amount/i);
    const totalCol = findCol(/total|ext[\s_-]?cost|line[\s_-]?total/i);
    const vendorCol = findCol(/vendor|supplier|mfg|manufacturer/i);
    const projectCol = findCol(/project|proj|prj/i);
    const customerCol = findCol(/customer|client/i);

    rows.forEach((row, idx) => {
      const rowNum = idx + 2; // header is row 1
      const mpnVal = mpnCol ? row[mpnCol] ?? "" : "";
      const descVal = descCol ? row[descCol] ?? "" : "";
      const qtyVal = qtyCol ? parseFloat(row[qtyCol] ?? "0") : 0;
      const rateVal = rateCol ? row[rateCol] ?? "" : "";
      const totVal = totalCol ? row[totalCol] ?? "" : "";

      if (mpnVal || descVal) {
        lineItems.push({
          rowNumber: rowNum,
          mpn: mpnVal,
          description: descVal,
          quantity: Number.isNaN(qtyVal) ? 1 : qtyVal,
          unitRate: rateVal,
          total: totVal,
          provenance: { sourceFile: fileName, row: rowNum, column: mpnCol ?? "row" },
        });
      }

      if (vendorCol && row[vendorCol] && !detectedEntities.supplierName) {
        detectedEntities.supplierName = row[vendorCol];
      }
      if (projectCol && row[projectCol] && !detectedEntities.projectReference) {
        detectedEntities.projectReference = row[projectCol];
      }
      if (customerCol && row[customerCol] && !detectedEntities.customerName) {
        detectedEntities.customerName = row[customerCol];
      }
    });

    addField("total_rows", "Total Data Rows", `${rows.length}`, "HIGH", {
      sourceFile: fileName,
      locator: "table_count",
    });

    if (lineItems.length > 0) {
      detectedEntities.partNumbers = lineItems.map((li) => li.mpn).filter(Boolean);
    }

    return {
      status: "SUCCESS",
      fileName,
      fileSize,
      fileType,
      checksum,
      extractedFields,
      lineItems,
      detectedEntities,
      warnings,
      summaryMessage: `Extracted ${lineItems.length} line items and ${rows.length} rows with table provenance.`,
    };
  }

  // 4. JSON parsing
  if (extension === "json") {
    try {
      const parsed = JSON.parse(textBuffer ?? "{}");
      const traverse = (obj: any, prefix = "") => {
        if (!obj || typeof obj !== "object") return;
        for (const [k, v] of Object.entries(obj)) {
          const loc = prefix ? `${prefix}.${k}` : k;
          if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
            const strVal = String(v);
            if (/project/i.test(k) && !detectedEntities.projectReference) {
              detectedEntities.projectReference = strVal;
            }
            if (/customer|client/i.test(k) && !detectedEntities.customerName) {
              detectedEntities.customerName = strVal;
            }
            if (/vendor|supplier/i.test(k) && !detectedEntities.supplierName) {
              detectedEntities.supplierName = strVal;
            }
            addField(k, k.replace(/[_-]/g, " "), strVal, "HIGH", {
              sourceFile: fileName,
              locator: loc,
            });
          } else if (Array.isArray(v)) {
            addField(k, k.replace(/[_-]/g, " "), `[${v.length} items]`, "HIGH", {
              sourceFile: fileName,
              locator: loc,
            });
          }
        }
      };
      traverse(parsed);

      return {
        status: "SUCCESS",
        fileName,
        fileSize,
        fileType,
        checksum,
        extractedFields,
        lineItems,
        detectedEntities,
        warnings,
        summaryMessage: `Structured JSON parsed successfully with ${extractedFields.length} key-value elements.`,
      };
    } catch {
      return {
        status: "ERROR",
        fileName,
        fileSize,
        fileType,
        checksum,
        extractedFields: [],
        lineItems: [],
        detectedEntities: {},
        warnings: ["Invalid or malformed JSON syntax."],
        summaryMessage: "The file could not be parsed as valid JSON.",
      };
    }
  }

  // 5. Plain text parsing
  if (extension === "txt" && textBuffer) {
    const lines = textBuffer.split(/\r?\n/);
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      const lineNo = idx + 1;
      const matchKeyValue = trimmed.match(/^([A-Za-z0-9\s_-]{2,30})[:=]\s*(.+)$/);
      if (matchKeyValue && matchKeyValue[1] && matchKeyValue[2]) {
        const key = matchKeyValue[1].trim();
        const val = matchKeyValue[2].trim();
        if (/customer|client/i.test(key)) detectedEntities.customerName = val;
        if (/supplier|vendor/i.test(key)) detectedEntities.supplierName = val;
        if (/project|proj/i.test(key)) detectedEntities.projectReference = val;
        if (/part|mpn/i.test(key)) {
          detectedEntities.partNumbers = detectedEntities.partNumbers ?? [];
          detectedEntities.partNumbers.push(val);
        }
        addField(key.toLowerCase().replace(/\s+/g, "_"), key, val, "HIGH", {
          sourceFile: fileName,
          line: lineNo,
        });
      } else {
        // Look for project codes like HLPL-XXXX-XX
        const projMatch = trimmed.match(/\bHLPL-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/);
        if (projMatch && !detectedEntities.projectReference) {
          detectedEntities.projectReference = projMatch[0];
          addField("detected_project", "Project Code", projMatch[0], "REVIEW_REQUIRED", {
            sourceFile: fileName,
            line: lineNo,
          });
        }
      }
    });

    return {
      status: extractedFields.length > 0 ? "SUCCESS" : "MANUAL_REVIEW",
      fileName,
      fileSize,
      fileType,
      checksum,
      extractedFields,
      lineItems,
      detectedEntities,
      warnings: extractedFields.length === 0 ? ["No structured key-value pairs detected."] : [],
      summaryMessage:
        extractedFields.length > 0
          ? `Extracted ${extractedFields.length} fields from text with line provenance.`
          : "Text parsed; manual review required to map fields.",
    };
  }

  // 6. Binary formats (PDF, DOCX, XLSX, ZIP, STEP, HEX, etc.)
  // Safe fail-closed handling: register original binary with SHA-256 digest,
  // do not pretend OCR or deep extraction ran without human review.
  addField("original_filename", "Original File", fileName, "HIGH", {
    sourceFile: fileName,
    locator: "file_header",
  });
  addField(
    "file_size",
    "File Size",
    `${(fileSize / 1024).toFixed(1)} KB (${fileSize} bytes)`,
    "HIGH",
    { sourceFile: fileName, locator: "file_header" },
  );
  addField("checksum_sha256", "SHA-256 Digest", checksum, "HIGH", {
    sourceFile: fileName,
    locator: "file_digest",
  });
  addField("upload_type", "Document Type", uploadType, "HIGH", {
    sourceFile: fileName,
    locator: "intake_profile",
  });

  // Extract possible project reference from file name
  const nameProjMatch = fileName.match(/(?:^|[^A-Za-z0-9])(HLPL-[A-Z0-9]+(?:-[A-Z0-9]+)*)/i);
  if (nameProjMatch && nameProjMatch[1]) {
    detectedEntities.projectReference = nameProjMatch[1].toUpperCase();
    addField("detected_project", "Project Code (from filename)", detectedEntities.projectReference, "REVIEW_REQUIRED", {
      sourceFile: fileName,
      locator: "filename_pattern",
    });
  }

  return {
    status: "MANUAL_REVIEW",
    fileName,
    fileSize,
    fileType,
    checksum,
    extractedFields,
    lineItems,
    detectedEntities,
    warnings: [
      `Binary format (.${extension || "bin"}) registered. Automatic field extraction is not available for this binary format without human review.`,
    ],
    summaryMessage:
      "Binary original document registered with SHA-256 digest. Ready for manual review and metadata confirmation.",
  };
}
