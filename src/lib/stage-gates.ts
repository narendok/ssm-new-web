/**
 * Automotive APQP Stage Gate Verification & Requirement Freezes.
 * Implements Stage 2 Multi-Department Feasibility Freeze and Stage 3 Requirements Baseline Freeze.
 * In accordance with SSM One Master Plan §4 & §5.
 */

export interface StageGateVerificationResult {
  allowed: boolean;
  gateIndex: number;
  gateName: string;
  reason?: string;
  requiredDocuments: string[];
  missingDocuments: string[];
  mode: "demo_simulation" | "production_enforced";
}

export interface GateDocumentItem {
  id?: string | undefined;
  part?: string | undefined;
  title: string;
  type?: string | undefined;
  lifecycle?: string | undefined;
  status?: string | undefined;
  linkedRecordRefs?: string[] | undefined;
}

export interface GateRecordItem {
  reference: string;
  type: string;
  status?: string | undefined;
  fields?: Record<string, string> | undefined;
}

export interface GateVerificationContext {
  targetStageIndex: number; // 0-based: 0 = Stage 1, 1 = Stage 2, 2 = Stage 3, etc.
  currentStageIndex: number;
  projectId?: string;
  documents?: GateDocumentItem[];
  records?: GateRecordItem[];
  isDemo?: boolean;
  naRationale?: Record<string, string>;
}

/**
 * Checks whether a document or record matching any of the candidate identifiers/types is approved.
 */
function isDocumentApproved(
  candidates: string[],
  documents: GateDocumentItem[] = [],
  records: GateRecordItem[] = [],
  projectId?: string,
): boolean {
  // Check documents list
  const docMatch = documents.find((doc) => {
    const docId = (doc.part || doc.id || "").toUpperCase();
    const docTitle = (doc.title || "").toUpperCase();
    const docType = (doc.type || "").toUpperCase();
    const matchesCandidate = candidates.some((c) => {
      const cu = c.toUpperCase();
      return docId.includes(cu) || docTitle.includes(cu) || docType.includes(cu);
    });
    if (!matchesCandidate) return false;
    // If project is specified and doc has linked records, ensure relevance
    if (projectId && doc.linkedRecordRefs && doc.linkedRecordRefs.length > 0) {
      const relatesToProject = doc.linkedRecordRefs.includes(projectId);
      if (!relatesToProject) return false;
    }
    const state = (doc.lifecycle || doc.status || "").toLowerCase();
    return state === "approved" || state === "released";
  });

  if (docMatch) return true;

  // Check records list
  const recordMatch = records.find((rec) => {
    const recRef = (rec.reference || "").toUpperCase();
    const recType = (rec.type || "").toUpperCase();
    const matchesCandidate = candidates.some((c) => {
      const cu = c.toUpperCase();
      return recRef.includes(cu) || recType.includes(cu);
    });
    if (!matchesCandidate) return false;
    const recStatus = (rec.status || "").toLowerCase();
    return recStatus === "approved" || recStatus === "released";
  });

  return Boolean(recordMatch);
}

/**
 * Verifies stage transition prerequisites.
 *
 * Rules:
 * 1. Production mode (isDemo === false): Client-side bypass disabled. Gate transitions require verified server transaction.
 * 2. Advancing to Stage 3 (targetStageIndex >= 2):
 *    Requires Stage 2 Multi-Department Feasibility Freeze (HLPL/F/MKT/01 Contract Review Record).
 * 3. Advancing to Stage 4+ (targetStageIndex >= 3):
 *    Requires Stage 3 Requirements Baseline Freeze (EHW-PRS, FW-FRS, SW-SRS, MECH-MRS, QUO).
 * 4. Advancing to Stage 5+ (targetStageIndex >= 4):
 *    Requires Stage 4 Hardware Schematics Prerequisite (EHW-SCH-01).
 */
export function verifyStageTransition(context: GateVerificationContext): StageGateVerificationResult {
  const { targetStageIndex, currentStageIndex, projectId, documents = [], records = [], isDemo = true, naRationale = {} } = context;

  // Backward movement or same stage is always permitted
  if (targetStageIndex <= currentStageIndex) {
    return {
      allowed: true,
      gateIndex: targetStageIndex + 1,
      gateName: `Stage ${targetStageIndex + 1}`,
      requiredDocuments: [],
      missingDocuments: [],
      mode: isDemo ? "demo_simulation" : "production_enforced",
    };
  }

  // Production check: without verified server transaction, operational gates remain locked
  if (!isDemo) {
    return {
      allowed: false,
      gateIndex: targetStageIndex + 1,
      gateName: `Stage ${targetStageIndex + 1} Production Gate`,
      reason: "Production gate progression requires verified authenticated server contract and database transaction. Client-side state progression is disabled.",
      requiredDocuments: [],
      missingDocuments: [],
      mode: "production_enforced",
    };
  }

  // GATE 2 FREEZE: Moving to Stage 3+ requires Contract Review Record (HLPL/F/MKT/01)
  if (targetStageIndex >= 2) {
    const feasibilityApproved = isDocumentApproved(["HLPL/F/MKT/01", "Contract Review", "FEASIBILITY"], documents, records, projectId);
    const hasNaRationale = Boolean(naRationale["HLPL/F/MKT/01"]?.trim());
    if (!feasibilityApproved && !hasNaRationale) {
      return {
        allowed: false,
        gateIndex: 2,
        gateName: "Stage 2 Multi-Department Feasibility Freeze",
        reason: "Stage 2 Multi-Department Feasibility Freeze active: Contract Review Record (HLPL/F/MKT/01) must be signed off by all participating department leads before advancing to Stage 3.",
        requiredDocuments: ["HLPL/F/MKT/01"],
        missingDocuments: ["HLPL/F/MKT/01"],
        mode: "demo_simulation",
      };
    }
  }

  // GATE 3 FREEZE: Moving to Stage 4+ requires Multi-Department Requirements Package
  if (targetStageIndex >= 3) {
    const isSoftwareTrack = Boolean(projectId && (projectId === "HLPL-SW-01" || projectId.toLowerCase().includes("-sw-")));
    const requiredReqDocs = isSoftwareTrack
      ? [
          { key: "SW-SRS", name: "Software Requirement Spec (SW-SRS)", candidates: ["SRS", "SW-SRS", "HLPL-SW-SW-SRS"] },
          { key: "SAL-QUO", name: "Commercial Quotation (QUO)", candidates: ["QUO", "Commercial Quotation", "SAL-QUO", "HLPL-SW-SAL-QUO"] },
          { key: "HROPS-CRS", name: "Competency & Safety Freeze (HR-OPS)", candidates: ["CRS", "HROPS-CRS", "HR-OPS"] },
        ]
      : [
          { key: "EHW-PRS", name: "Product Requirement Spec (PRS)", candidates: ["PRS", "EHW-PRS", "HLPL-SLCT-EHW-PRS"] },
          { key: "FW-FRS", name: "Firmware Functional Spec (FW-FRS)", candidates: ["FRS", "FW-FRS", "HLPL-SLCT-FW-FRS"] },
          { key: "SW-SRS", name: "Software Requirement Spec (SW-SRS)", candidates: ["SRS", "SW-SRS", "HLPL-SLCT-SW-SRS"] },
          { key: "MECH-MRS", name: "Mechanical Requirement Spec (MECH-MRS)", candidates: ["MRS", "MECH-MRS", "HLPL-SLCT-MECH-MRS"] },
          { key: "SAL-QUO", name: "Commercial Quotation (QUO)", candidates: ["QUO", "Commercial Quotation", "SAL-QUO", "HLPL-SLCT-SAL-QUO"] },
        ];

    const missingReqs: string[] = [];
    for (const req of requiredReqDocs) {
      const ok = isDocumentApproved(req.candidates, documents, records, projectId);
      const hasNa = Boolean(naRationale[req.key]?.trim() || naRationale[req.name]?.trim());
      if (!ok && !hasNa) {
        missingReqs.push(req.name);
      }
    }

    if (missingReqs.length > 0) {
      return {
        allowed: false,
        gateIndex: 3,
        gateName: "Stage 3 Requirements Baseline Freeze",
        reason: `Stage 3 Requirements Baseline Freeze active: Mandatory domain requirement specifications (${missingReqs.join(", ")}) must be approved (or justified with approved N/A rationale) before advancing to Stage 4.`,
        requiredDocuments: requiredReqDocs.map((r) => r.name),
        missingDocuments: missingReqs,
        mode: "demo_simulation",
      };
    }
  }

  // GATE 4 PREREQUISITE: Moving to Stage 5, 7, 8, 9 requires Hardware Schematics (Waived for Pure Software)
  if (targetStageIndex >= 4) {
    const isSoftwareTrack = Boolean(projectId && (projectId === "HLPL-SW-01" || projectId.toLowerCase().includes("-sw-")));
    const schematicApproved = isSoftwareTrack || isDocumentApproved(["EHW-SCH", "Schematic", "SCH-01", "SCH-02"], documents, records, projectId);
    const hasNa = Boolean(naRationale["EHW-SCH-01"]?.trim() || naRationale["EHW-SCH"]?.trim());
    if (!schematicApproved && !hasNa) {
      return {
        allowed: false,
        gateIndex: 4,
        gateName: "Stage 4 Hardware Schematic Prerequisite",
        reason: 'Automotive Gate Interlock active: Mandatory Prerequisite "Stage 4 Hardware Schematics (EHW-SCH-01)" must be approved by the Embedded Hardware Lead before Pilot Integration or Production Release can proceed.',
        requiredDocuments: ["EHW-SCH-01"],
        missingDocuments: ["EHW-SCH-01"],
        mode: "demo_simulation",
      };
    }
  }

  return {
    allowed: true,
    gateIndex: targetStageIndex + 1,
    gateName: `Stage ${targetStageIndex + 1}`,
    requiredDocuments: [],
    missingDocuments: [],
    mode: "demo_simulation",
  };
}
