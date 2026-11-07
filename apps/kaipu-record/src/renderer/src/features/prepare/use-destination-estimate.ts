import { useTranslations } from "@kaipu/i18n";
import type { SourceProbe } from "@renderer/features/video-editor/export/probe-source";
import { formatMB } from "@renderer/features/video-editor/export/export-size";
import { planCopy, presetForDestination } from "./destinations";
import type { DestinationId } from "./destinations";

/**
 * The size of the copy each destination would make, as the words the list shows: the
 * archive is the recording's own size; the others need the probed source, and read null
 * (the caller shows "…") until it is known.
 */
export function useDestinationEstimate(
  sizeBytes: number,
  probe: SourceProbe | null,
): (destination: DestinationId) => string | null {
  const tEditor = useTranslations("videoEditor");
  return (destination) => {
    if (destination === "archive") return formatMB(sizeBytes);
    if (!probe) return null;
    const plan = planCopy({
      destination,
      presetId: presetForDestination(destination, probe),
      source: probe,
      durationSec: probe.durationSec,
      sourceSizeBytes: sizeBytes,
    });
    if (plan.estimateBytes === null) return tEditor("sizeFull");
    const size = formatMB(plan.estimateBytes);
    return plan.sizeKind === "up-to"
      ? tEditor("sizeUpTo", { size })
      : tEditor("sizeAbout", { size });
  };
}
