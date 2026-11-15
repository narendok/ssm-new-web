/**
 * SSM One - Canonical Record Matching & Entity Resolution
 *
 * Implements Phase 3 canonical entity matching:
 * - Matches extracted Customer, Supplier, Project, Part entities against authorized masters
 * - Emits EXACT_MATCH, AMBIGUOUS_MATCH, or NO_MATCH
 * - Prevents unsafe auto-linking from fuzzy names alone
 * - Provides structured candidate resolution details
 */

import type { DetectedEntities } from "./document-ingestion-extractor";
import type { UploadProject } from "./document-upload-pilot";

export type MatchStatus = "EXACT_MATCH" | "AMBIGUOUS_MATCH" | "NO_MATCH" | "NOT_SPECIFIED";

export type EntityResolution<T = any> = {
  entityType: "project" | "customer" | "supplier" | "part";
  extractedText: string;
  status: MatchStatus;
  matchedId?: string | undefined;
  matchedReference?: string | undefined;
  matchedLabel?: string | undefined;
  candidates: { id: string; reference: string; label: string; score: number }[];
  reason: string;
};

export type CanonicalMatchSummary = {
  projectResolution: EntityResolution<UploadProject>;
  customerResolution: EntityResolution;
  supplierResolution: EntityResolution;
  partResolutions: EntityResolution[];
  hasUnresolvedEntities: boolean;
};

export function resolveProjectEntity(
  extractedRef: string | undefined,
  projects: UploadProject[],
): EntityResolution<UploadProject> {
  if (!extractedRef || !extractedRef.trim()) {
    return {
      entityType: "project",
      extractedText: "",
      status: "NOT_SPECIFIED",
      candidates: [],
      reason: "No project reference detected in document source.",
    };
  }

  const query = extractedRef.trim().toLowerCase();
  const activeProjects = projects.filter((p) => !p.archived);

  // Exact reference match
  const exactRef = activeProjects.filter((p) => p.reference.toLowerCase() === query);
  if (exactRef.length === 1) {
    const p = exactRef[0];
    if (p) {
      return {
        entityType: "project",
        extractedText: extractedRef,
        status: "EXACT_MATCH",
        matchedId: p.id,
        matchedReference: p.reference,
        matchedLabel: p.title,
        candidates: [{ id: p.id, reference: p.reference, label: p.title, score: 1.0 }],
        reason: "Exact project reference match.",
      };
    }
  }

  // Exact title match
  const exactTitle = activeProjects.filter((p) => p.title.toLowerCase() === query);
  if (exactTitle.length === 1) {
    const p = exactTitle[0];
    if (p) {
      return {
        entityType: "project",
        extractedText: extractedRef,
        status: "EXACT_MATCH",
        matchedId: p.id,
        matchedReference: p.reference,
        matchedLabel: p.title,
        candidates: [{ id: p.id, reference: p.reference, label: p.title, score: 1.0 }],
        reason: "Exact project title match.",
      };
    }
  }

  // Partial candidate search
  const partials = activeProjects.filter(
    (p) =>
      p.reference.toLowerCase().includes(query) ||
      query.includes(p.reference.toLowerCase()) ||
      p.title.toLowerCase().includes(query),
  );

  if (partials.length > 1) {
    return {
      entityType: "project",
      extractedText: extractedRef,
      status: "AMBIGUOUS_MATCH",
      candidates: partials
        .filter((p): p is UploadProject => Boolean(p))
        .map((p) => ({
          id: p.id,
          reference: p.reference,
          label: p.title,
          score: 0.7,
        })),
      reason: `Found ${partials.length} candidate projects. User disambiguation required.`,
    };
  }

  if (partials.length === 1) {
    const p = partials[0];
    if (p) {
      return {
        entityType: "project",
        extractedText: extractedRef,
        status: "AMBIGUOUS_MATCH",
        candidates: [{ id: p.id, reference: p.reference, label: p.title, score: 0.8 }],
        reason: "Partial match suggested; user confirmation required before linking.",
      };
    }
  }

  return {
    entityType: "project",
    extractedText: extractedRef,
    status: "NO_MATCH",
    candidates: [],
    reason: `Project reference '${extractedRef}' not found in active projects.`,
  };
}

export function resolveSupplierEntity(
  extractedName: string | undefined,
  suppliers: { id: string; reference: string; name: string; status?: string }[],
): EntityResolution {
  if (!extractedName || !extractedName.trim()) {
    return {
      entityType: "supplier",
      extractedText: "",
      status: "NOT_SPECIFIED",
      candidates: [],
      reason: "No supplier detected in document source.",
    };
  }

  const query = extractedName.trim().toLowerCase();
  const exact = suppliers.filter(
    (s) => s.reference.toLowerCase() === query || s.name.toLowerCase() === query,
  );
  if (exact.length === 1) {
    const s = exact[0];
    if (s) {
      return {
        entityType: "supplier",
        extractedText: extractedName,
        status: "EXACT_MATCH",
        matchedId: s.id,
        matchedReference: s.reference,
        matchedLabel: s.name,
        candidates: [{ id: s.id, reference: s.reference, label: s.name, score: 1.0 }],
        reason: "Exact supplier master match.",
      };
    }
  }

  const partials = suppliers.filter(
    (s) => s.name.toLowerCase().includes(query) || query.includes(s.name.toLowerCase()),
  );

  if (partials.length > 1) {
    return {
      entityType: "supplier",
      extractedText: extractedName,
      status: "AMBIGUOUS_MATCH",
      candidates: partials
        .filter((s): s is (typeof suppliers)[number] => Boolean(s))
        .map((s) => ({
          id: s.id,
          reference: s.reference,
          label: s.name,
          score: 0.7,
        })),
      reason: `Found ${partials.length} matching suppliers. User disambiguation required.`,
    };
  }

  if (partials.length === 1) {
    const s = partials[0];
    if (s) {
      return {
        entityType: "supplier",
        extractedText: extractedName,
        status: "AMBIGUOUS_MATCH",
        candidates: [{ id: s.id, reference: s.reference, label: s.name, score: 0.8 }],
        reason: "Partial supplier match suggested; user confirmation required.",
      };
    }
  }

  return {
    entityType: "supplier",
    extractedText: extractedName,
    status: "NO_MATCH",
    candidates: [],
    reason: `Supplier '${extractedName}' not found in authorized supplier directory.`,
  };
}

export function resolveCustomerEntity(
  extractedName: string | undefined,
  customers: { id: string; reference: string; title: string; status?: string }[],
): EntityResolution {
  if (!extractedName || !extractedName.trim()) {
    return {
      entityType: "customer",
      extractedText: "",
      status: "NOT_SPECIFIED",
      candidates: [],
      reason: "No customer detected in document source.",
    };
  }

  const query = extractedName.trim().toLowerCase();
  const exact = customers.filter(
    (c) => c.reference.toLowerCase() === query || c.title.toLowerCase() === query,
  );
  if (exact.length === 1) {
    const c = exact[0];
    if (c) {
      return {
        entityType: "customer",
        extractedText: extractedName,
        status: "EXACT_MATCH",
        matchedId: c.id,
        matchedReference: c.reference,
        matchedLabel: c.title,
        candidates: [{ id: c.id, reference: c.reference, label: c.title, score: 1.0 }],
        reason: "Exact customer master match.",
      };
    }
  }

  const partials = customers.filter(
    (c) => c.title.toLowerCase().includes(query) || query.includes(c.title.toLowerCase()),
  );

  if (partials.length > 1) {
    return {
      entityType: "customer",
      extractedText: extractedName,
      status: "AMBIGUOUS_MATCH",
      candidates: partials
        .filter((c): c is (typeof customers)[number] => Boolean(c))
        .map((c) => ({
          id: c.id,
          reference: c.reference,
          label: c.title,
          score: 0.7,
        })),
      reason: `Found ${partials.length} matching customers. User disambiguation required.`,
    };
  }

  if (partials.length === 1) {
    const c = partials[0];
    if (c) {
      return {
        entityType: "customer",
        extractedText: extractedName,
        status: "AMBIGUOUS_MATCH",
        candidates: [{ id: c.id, reference: c.reference, label: c.title, score: 0.8 }],
        reason: "Partial customer match suggested; user confirmation required.",
      };
    }
  }

  return {
    entityType: "customer",
    extractedText: extractedName,
    status: "NO_MATCH",
    candidates: [],
    reason: `Customer '${extractedName}' not found in customer register.`,
  };
}

export function resolveAllEntities(input: {
  detectedEntities: DetectedEntities;
  projects: UploadProject[];
  customers?: { id: string; reference: string; title: string }[] | undefined;
  suppliers?: { id: string; reference: string; name: string }[] | undefined;
}): CanonicalMatchSummary {
  const projectResolution = resolveProjectEntity(
    input.detectedEntities.projectReference,
    input.projects,
  );
  const customerResolution = resolveCustomerEntity(
    input.detectedEntities.customerName ?? input.detectedEntities.customerReference,
    input.customers ?? [],
  );
  const supplierResolution = resolveSupplierEntity(
    input.detectedEntities.supplierName ?? input.detectedEntities.supplierReference,
    input.suppliers ?? [],
  );

  const hasUnresolvedEntities =
    projectResolution.status === "AMBIGUOUS_MATCH" ||
    customerResolution.status === "AMBIGUOUS_MATCH" ||
    supplierResolution.status === "AMBIGUOUS_MATCH";

  return {
    projectResolution,
    customerResolution,
    supplierResolution,
    partResolutions: [],
    hasUnresolvedEntities,
  };
}
