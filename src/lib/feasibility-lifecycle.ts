import { getRecordedProjectTrack } from "./canonical-lifecycle";
import { projectLifecycleStages, type LifecycleRevision } from "./lifecycle-baseline";

/**
 * Resolve the stage set used by feasibility planning from the selected source record.
 * Before an engineering track is selected, keep all configured candidate-track tasks
 * visible; once selected, exclude stages that do not belong to that track.
 */
export function feasibilityLifecycleStages(
  revision: LifecycleRevision,
  sourceFields?: Record<string, unknown> | null,
) {
  const track = getRecordedProjectTrack(sourceFields ?? undefined);
  const certificationRequired = sourceFields?.["certificationRequired"] === "true";
  const stages = track
    ? projectLifecycleStages(revision, track, certificationRequired)
    : revision.stages;
  return { track, certificationRequired, stages };
}
