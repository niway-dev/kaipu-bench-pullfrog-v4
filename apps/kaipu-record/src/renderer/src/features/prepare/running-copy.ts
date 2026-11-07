import type { ExportRunnerSnapshot } from "@renderer/features/video-editor/export/export-runner";
import type { ExportPresetId } from "@renderer/features/video-editor/export/export-presets";
import type { DestinationId } from "./destinations";

/** The background export of this master, while it runs (`useExportRunner`). */
export interface RunningCopy {
  presetId: ExportPresetId;
  /** Where it is going, when the job says (chat's and email's copies share a preset). */
  destination?: DestinationId;
  /** A copy for a destination (Prepare, Share), not an editor export. */
  wholeRecording: boolean;
  fraction: number;
  /** When the current encode attempt started, for "about 2 min" left. */
  attemptStartedAt: number | null;
}

/** The runner's export when it is making a copy of `assetId`; null otherwise. */
export function runningCopyOf(
  snapshot: Pick<ExportRunnerSnapshot, "status" | "job" | "fraction" | "attemptStartedAt">,
  assetId: string,
): RunningCopy | null {
  const { job } = snapshot;
  if (snapshot.status !== "exporting" || job === null || job.sourceAssetId !== assetId) {
    return null;
  }
  return {
    presetId: job.presetId,
    ...(job.destination ? { destination: job.destination } : {}),
    wholeRecording: job.wholeRecording === true,
    fraction: snapshot.fraction,
    attemptStartedAt: snapshot.attemptStartedAt,
  };
}
