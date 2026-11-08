import {
  CANONICAL_STAGE_TEMPLATES,
  getApplicableStagesForTrack,
  resolveStagePrerequisites,
  type ProjectTrack,
} from "./canonical-lifecycle";
import { LIFECYCLE_DOCUMENT_EXITS } from "./document-catalogue";
import { COMPANY_PHASES, type CompanyPhase } from './company-phases';
import { DEPARTMENT_MODULES } from './department-modules';
import { HEXA_STAGES } from './hexa-workbook-source';
import { completeLifecycleDefinitions } from './lifecycle-stage-extensions';
import { applyHexaStageCorrections, applyHexaTaskDefaults, applyHexaRaci } from './hexa-lifecycle-review';
export { COMPANY_PHASES, type CompanyPhase } from './company-phases';
export type LifecycleTaskDefault = {
  id: string;
  title: string;
  description: string;
  department: string;
};
export type LifecycleStageDefinition = {
  code: string;
  name: string;
  phase: CompanyPhase;
  gate: string;
  department: string;
  prerequisites: string[];
  exitTypes: string[];
  optional: boolean;
  sourceReference?: { workbook: string; sheet: string; row: number; deliverables: string; preparer: string; reviewer: string };
  tasks: LifecycleTaskDefault[];
  /** Explicit stage responsibilities. Absent on historical, preserved baselines. */
  raci?: { R: string[]; A: string[]; C: string[]; I: string[] };
};
export type LifecycleRevision = {
  id: string;
  createdAt: string;
  /** Workbook role aliases resolve to configured organization department codes. */
  roleDepartments?: Record<string, string>;
  stages: LifecycleStageDefinition[];
};
export const exitTypesForStage = (code: string) => {
  const rows=LIFECYCLE_DOCUMENT_EXITS.filter(row=>row.stage===code);
  const existing=rows.filter(row=>!row.recordType.startsWith('Stage evidence · '));
  return (existing.length ? existing : rows).map(row=>row.recordType as string);
};
export function finalizedStageRefinement(
  stage: LifecycleStageDefinition,
): LifecycleStageDefinition {
  const overrides: Record<string, Partial<LifecycleStageDefinition>> = {
    HW_37: {
      name: "Applicable regulatory homologation readiness",
      department: "QA",
      prerequisites: ["HW_32"],
      optional: true,
      tasks: [
        {
          id: "T01",
          title: "Coordinate the applicable homologation scope and agency evidence",
          description:
            "Link QA certification work and candidate sample provenance; no certificate or approval is assumed.",
          department: "QA",
        },
        {
          id: "T02",
          title: "Review certification reports and unresolved regulatory conditions",
          description:
            "Record verified references or an authorized non-applicability decision before release.",
          department: "QA",
        },
      ],
    },
    FW_13: {
      name: "Field trial diagnostics and controlled update monitoring",
      prerequisites: ["FW_11"],
    },
    SW_11: {
      name: "Canary and OTA provisioning readiness",
      department: "SW",
      tasks: [
        {
          id: "T01",
          title: "Prepare staged canary rollout and device provisioning references",
          description:
            "Verify target configuration, rollback and permitted rollout scope before production release.",
          department: "SW",
        },
        {
          id: "T02",
          title: "Review release monitoring and rollback readiness",
          description:
            "Link the agreed telemetry checks and controlled rollout decision; do not deploy automatically.",
          department: "SW",
        },
      ],
    },
    C11: {
      name: "Candidate golden sample readiness",
      tasks: stage.tasks.map((t) => ({
        ...t,
        description:
          "Verify production-representative candidate BOM, Gerber and firmware revisions. Final release freezing follows certification; no prior production release is implied.",
      })),
    },
    CL_01: {
      prerequisites: [
        "HW_33",
        "HW_34",
        "HW_35",
        "HW_36",
        "HW_37",
        "FW_12",
        "FW_13",
        "SW_11",
        "INT_03",
        "RM_02",
      ],
    },
  };
  return { ...stage, ...overrides[stage.code] };
}
export function recordedStageOmissions(
  value: unknown,
): Record<string, { reason: string; decidedAt?: string }> {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
export function gateForStage(code: string): string {
  const n = Number(code.split("_")[1]);
  if (code.startsWith("HW_"))
    return `HW-G${n <= 5 ? 1 : n <= 16 ? 2 : n <= 24 ? 3 : n <= 32 ? 4 : 5}`;
  if (/^C\d+$/.test(code)) {
    const c = Number(code.slice(1));
    return `CERT-G${c <= 4 ? 1 : c <= 9 ? 2 : c <= 12 ? 3 : 4}`;
  }
  if (code.startsWith("FW_")) return `FW-G${Math.min(n - 1, 11)}`;
  if (code.startsWith("SW_")) return `SW-G${n <= 8 ? n - 1 : n === 9 ? "8/9" : n === 10 ? 10 : 11}`;
  return CANONICAL_STAGE_TEMPLATES.find((s) => s.stageCode === code)?.phaseCode ?? "Common";
}
export function phaseForStage(code: string): CompanyPhase {
  const workbookStage = HEXA_STAGES.find(stage => (stage.row===77 ? 'G8_04' : stage.code) === code);
  if (workbookStage) return workbookStage.phase;
  const n = Number(code.split("_")[1]);
  if (code.startsWith("CM_")) return n <= 2 ? "TG_0" : "TG_1";
  if (code.startsWith("HW_")) {
    if (n <= 5) return "TG_1";
    if ([6, 9, 12].includes(n)) return "TG_2";
    if ([7, 8, 25, 26, 29, 30, 31].includes(n)) return "TG_4";
    if ([27, 28, 32].includes(n)) return "TG_5";
    if ([33, 37].includes(n)) return "TG_6";
    return n >= 34 ? "TG_7" : "TG_3";
  }
  if (code.startsWith("FW_"))
    return n <= 2
      ? "TG_1"
      : n <= 4
        ? "TG_2"
        : n <= 7
          ? "TG_3"
          : n <= 9
            ? "TG_4"
            : n <= 11
              ? "TG_5"
              : n === 12
                ? "TG_7"
                : "TG_6";
  if (code.startsWith("SW_"))
    return n <= 2
      ? "TG_1"
      : n <= 4
        ? "TG_2"
        : n <= 7
          ? "TG_3"
          : n === 8
            ? "TG_4"
            : n === 9
              ? "TG_5"
              : n === 10
                ? "TG_6"
                : "TG_7";
  if (/^C\d+$/.test(code)) {
    const c = Number(code.slice(1));
    return c <= 4 ? "TG_1" : c <= 9 ? "TG_5" : "TG_6";
  }
  if (code.startsWith("CL_")) return n === 1 ? "TG_7" : n === 2 ? "TG_8" : "TG_9";
  if (code.startsWith("INT_")) return n === 1 ? "TG_1" : n === 2 ? "TG_5" : "TG_6";
  if (code.startsWith("RM_")) return n === 1 ? "TG_0" : n === 2 ? "TG_4" : "TG_8";
  return "TG_3";
}
export function defaultLifecycleRevision(): LifecycleRevision {
  const reference:LifecycleRevision = {
    id: "LC-TG-2026-11-07-v4",
    createdAt: "2026-11-04T00:00:00.000Z",
    stages: CANONICAL_STAGE_TEMPLATES.map((s) => ({
      code: s.stageCode,
      name: s.name,
      phase: phaseForStage(s.stageCode),
      gate: gateForStage(s.stageCode),
      department: s.defaultOwner,
      prerequisites: [...s.prerequisites],
      exitTypes: exitTypesForStage(s.stageCode),
      optional: phaseForStage(s.stageCode) === "TG_2",
      tasks: [s.t01, s.t02].map((t) => ({
        id: t.taskNumber,
        title: t.title,
        description: t.description,
        department: t.defaultOwner,
      })),
    })).map(finalizedStageRefinement).map(s => ({ ...s,
      name: HEXA_STAGES.find(stage=>stage.code===s.code)?.name ?? s.name,
      tasks: s.code==='CM_02' ? [...s.tasks, ...Object.keys(DEPARTMENT_MODULES).filter(code=>!s.tasks.some(t=>t.department===code)).map(code=>({id:`FEASIBILITY-${code}`,title:`Review ${code} feasibility inputs`,description:'Assess the received requirements, document assumptions, dependencies, indicative effort and unresolved questions for department review.',department:code}))] : s.tasks,
      raci: {
      R: s.code==='CM_02' ? Object.keys(DEPARTMENT_MODULES) : [...new Set([s.department, ...s.tasks.map(t => t.department)])],
      A: [s.department], C: [], I: [],
    } })),
  };
  const corrected=applyHexaRaci(applyHexaTaskDefaults(applyHexaStageCorrections(reference)),new Set(Object.keys(DEPARTMENT_MODULES)));
  return {...corrected,stages:completeLifecycleDefinitions(corrected)};
}
export function validateLifecycleRevision(revision: LifecycleRevision): string[] {
  const errors: string[] = [];
  const codes = new Set<string>();
  for (const s of revision.stages) {
    if (!s.code.trim() || codes.has(s.code)) errors.push(`Duplicate or blank stage: ${s.code}`);
    codes.add(s.code);
    if (!s.name.trim() || !s.department.trim() || !s.gate.trim())
      errors.push(`${s.code}: name, department and internal gate required`);
    if (!COMPANY_PHASES.some((p) => p[0] === s.phase))
      errors.push(`${s.code}: invalid company phase`);
    const ids = new Set<string>();
    if (s.raci) {
      for (const role of ["R", "A", "C", "I"] as const) {
        const values = s.raci[role];
        if (!Array.isArray(values) || values.some(v => typeof v !== "string" || !/^[A-Z][A-Z0-9]*$/.test(v)) || new Set(values).size !== values.length)
          errors.push(`${s.code}: invalid ${role} departments`);
      }
      if (!Array.isArray(s.raci.R) || !s.raci.R.length || !Array.isArray(s.raci.A) || s.raci.A.length !== 1) errors.push(`${s.code}: configure responsible departments and one accountable department`);
      if (Array.isArray(s.raci.R)) {
        if (!s.raci.R.includes(s.department)) errors.push(`${s.code}: stage owner must be Responsible`);
        for (const t of s.tasks) if (!s.raci.R.includes(t.department)) errors.push(`${s.code}: task ${t.id} owner must be Responsible in RACI`);
      }
    }
    if (s.tasks.length > 50) errors.push(`${s.code}: maximum 50 task defaults per stage`);
    for (const t of s.tasks) {
      if (!t.id.trim() || ids.has(t.id) || !t.title.trim() || !t.department.trim())
        errors.push(`${s.code}: invalid or duplicate task default`);
      ids.add(t.id);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (code: string) => {
    if (visiting.has(code)) {
      errors.push(`Dependency cycle: ${code}`);
      return;
    }
    if (visited.has(code)) return;
    const s = revision.stages.find((s) => s.code === code);
    if (!s) return;
    visiting.add(code);
    for (const p of s.prerequisites) {
      if (!codes.has(p)) errors.push(`${code}: missing prerequisite ${p}`);
      else visit(p);
    }
    visiting.delete(code);
    visited.add(code);
  };
  for (const s of revision.stages) visit(s.code);
  return [...new Set(errors)];
}
export function pinLifecycleRevision(value: LifecycleRevision): string {
  const errors = validateLifecycleRevision(value);
  if (errors.length) throw new Error(errors.join("; "));
  return JSON.stringify(value);
}
export function readLifecycleBaseline(value: string | undefined): LifecycleRevision | undefined {
  if (!value) return undefined;
  try {
    const r = JSON.parse(value) as LifecycleRevision;
    return r.id && Array.isArray(r.stages) && !validateLifecycleRevision(r).length ? r : undefined;
  } catch {
    return undefined;
  }
}
export function projectLifecycleStages(
  revision: LifecycleRevision,
  track: ProjectTrack,
  certification = false,
) {
  const codes = new Set(
    getApplicableStagesForTrack(track, { enableCertification: certification, stageDefinitions:revision.stages }).map(
      (s) => s.stageCode,
    ),
  );
  return revision.stages
    .filter((s) => codes.has(s.code))
    .map((s) => ({
      ...s,
      prerequisites: [
        ...(JSON.stringify(s.prerequisites) ===
        JSON.stringify(CANONICAL_STAGE_TEMPLATES.find((t) => t.stageCode === s.code)?.prerequisites)
          ? resolveStagePrerequisites(s.code, track)
          : s.prerequisites
        ).filter((p) => codes.has(p)),
        ...(s.code === "CL_01" && certification && !s.prerequisites.includes("C15") ? ["C15"] : []),
      ],
    }));
}
export function deriveCompanyStatus(
  phase: CompanyPhase,
  override?: string,
  releaseAccepted = false,
): string {
  if (["ON_HOLD", "UNDER_AMENDMENT", "ARCHIVED_CLOSED"].includes(override || "")) return override!;
  const n = Number(phase.slice(3));
  return n <= 1
    ? "FEASIBILITY_AND_SCOPING"
    : n <= 4
      ? "UNDER_DEVELOPMENT"
      : n <= 6 || !releaseAccepted
        ? "PILOT_AND_VALIDATION"
        : "RELEASED_PRODUCTION";
}
