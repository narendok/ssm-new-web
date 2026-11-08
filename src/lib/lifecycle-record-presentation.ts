import { CANONICAL_STAGE_TEMPLATES } from "./canonical-lifecycle";
import { COMPANY_PHASES, phaseForStage, readLifecycleBaseline, defaultLifecycleRevision } from "./lifecycle-baseline";
import { hardwareStageForRecordType } from "./record-form-catalogue";

export function recordStageLabel(fields: Record<string, string>, recordType?: string, projectFields?: Record<string,string>): string {
  const raw = fields["recordStage"] || fields["hwStage"] || fields["qualityStage"] || fields["lifecycleStage"] || "";
  const automaticStage = recordType ? hardwareStageForRecordType(recordType)?.code : undefined;
  const revision = readLifecycleBaseline(fields['lifecycleBaseline'] || projectFields?.['lifecycleBaseline']) ?? defaultLifecycleRevision();
  const candidates = recordType ? revision.stages.filter(stage=>stage.exitTypes.some(type=>type.toLowerCase()===recordType.toLowerCase())) : [];
  const configured = candidates.length
    ? candidates.find(stage=>stage.code===raw) ?? candidates.find(stage=>stage.code===automaticStage) ?? (candidates.length===1 ? candidates[0] : undefined)
    : revision.stages.find(stage=>stage.code===automaticStage) ?? revision.stages.find(stage=>stage.code===raw);
  const effective = configured?.code ?? raw;
  const canonical = CANONICAL_STAGE_TEMPLATES.find((stage) => stage.stageCode === effective);
  if (configured || canonical) {
    const phase = configured?.phase ?? phaseForStage(canonical!.stageCode);
    const phaseName = COMPANY_PHASES.find(([code]) => code === phase)?.[1] ?? phase;
    return `${phase} · ${phaseName} · ${effective} ${configured?.name ?? canonical!.name}`;
  }
  if (/^Stage\s+\d+/i.test(effective)) return `Legacy stage label · ${effective}`;
  return effective || "Operational · stage not recorded";
}

export function projectLifecycleContext(fields: Record<string, string>): { phase?: string; stage?: string } {
  const current = fields["currentStage"] || fields["lifecycleStage"] || fields["stage"] || "";
  const configured = readLifecycleBaseline(fields['lifecycleBaseline'])?.stages.find(stage=>stage.code===current);
  const canonical = CANONICAL_STAGE_TEMPLATES.find((stage) => stage.stageCode === current);
  const savedPhase = fields["companyPhase"] || "";
  const phaseCode = configured?.phase ?? (/^TG_[0-9]$/.test(savedPhase)
    ? savedPhase
    : canonical
      ? phaseForStage(canonical.stageCode)
      : "");
  const phaseName = COMPANY_PHASES.find(([code]) => code === phaseCode)?.[1];
  const stage = configured || canonical
    ? `${current} · ${configured?.name ?? canonical!.name}`
    : /^Stage\s+\d+/i.test(current)
      ? `Legacy stage label · ${current}`
      : current || undefined;
  return {
    ...(phaseCode ? { phase: `${phaseCode} · ${phaseName ?? phaseCode}` } : {}),
    ...(stage ? { stage } : {}),
  };
}
