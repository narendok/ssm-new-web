import { CANONICAL_STAGE_TEMPLATES } from "./canonical-lifecycle";
import { phaseForStage } from "./lifecycle-baseline";

type DemoProjectLifecycle = {
  stageCode: string;
  track: "hardware_only" | "hardware_firmware" | "hardware_firmware_software";
};

/** Explicit reconciliation for the six known browser-local fictional projects. */
export const DEMO_PROJECT_LIFECYCLE: Readonly<Record<string, DemoProjectLifecycle>> = {
  "HLPL-SLCT-01": { stageCode: "C13", track: "hardware_firmware_software" },
  "HLPL-BCU-02": { stageCode: "HW_02", track: "hardware_firmware" },
  "HLPL-AI4T-01": { stageCode: "HW_31", track: "hardware_firmware_software" },
  "HLPL-XLINK-03": { stageCode: "HW_06", track: "hardware_firmware_software" },
  "HLPL-EFAN-01": { stageCode: "HW_02", track: "hardware_only" },
  "HLPL-PST-01": { stageCode: "HW_34", track: "hardware_firmware_software" },
};

/**
 * Replace only legacy stage labels on the named demo projects. New user records,
 * already canonical stages, and projects outside this fixture are left untouched.
 */
export function reconcileDemoProjectLifecycle<
  T extends {
    type: string;
    reference: string;
    fields: Record<string, string>;
    stage?: string;
  },
>(records: T[]): T[] {
  return records.map((record) => {
    if (record.type !== "Project") return record;
    const lifecycle = DEMO_PROJECT_LIFECYCLE[record.reference];
    if (!lifecycle) return record;
    const current =
      record.fields["currentStage"] || record.fields["lifecycleStage"] || record.stage || "";
    if (CANONICAL_STAGE_TEMPLATES.some((stage) => stage.stageCode === current)) return record;
    if (!/^Stage\s+\d+/i.test(current)) return record;

    return {
      ...record,
      ...(record.stage !== undefined ? { stage: lifecycle.stageCode } : {}),
      fields: {
        ...record.fields,
        currentStage: lifecycle.stageCode,
        lifecycleStage: lifecycle.stageCode,
        companyPhase: phaseForStage(lifecycle.stageCode),
        projectTrack: lifecycle.track,
      } as T["fields"],
    } as T;
  });
}
