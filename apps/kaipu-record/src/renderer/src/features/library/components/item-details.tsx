import type { RecordingCapture } from "@shared/recording-capture";
import { useLocale, useTranslations } from "@kaipu/i18n";
import type { SourceProbe } from "@renderer/features/video-editor/export/probe-source";
import { useOptionalWorkspaces } from "@renderer/features/workspaces/workspaces-context";
import type { LibraryVideo } from "@renderer/features/library/types";
import { absoluteDate, formatSize } from "@renderer/features/library/format";
import { uiArea } from "@renderer/lib/ui-area";
import styles from "./item-details.module.css";

/**
 * The "Details" tab of the item page (NIW2-669): a definition list of the file's facts.
 * A row that does not apply to the item's kind is left out, never shown as "—".
 */
export function ItemDetails({
  video,
  probe,
  dimensions,
  capture,
  path,
}: {
  video: LibraryVideo;
  probe: SourceProbe | null;
  /** The picture size when the page knows it from somewhere other than `probe` (a screenshot). */
  dimensions: { width: number; height: number } | null;
  /** How the recording was captured; the Source row names it in a sentence. */
  capture: RecordingCapture | null | undefined;
  /** Absolute path of the local file; null for a cloud-only item or while it loads. */
  path: string | null;
}): React.JSX.Element {
  const t = useTranslations("library");
  const locale = useLocale();
  const workspaces = useOptionalWorkspaces();
  const workspaceName = video.id !== null ? (workspaces?.active?.name ?? null) : null;

  const isVideo = video.kind === "recording";
  const size = probe
    ? { width: probe.width, height: probe.height }
    : video.gif
      ? { width: video.gif.width, height: video.gif.height }
      : dimensions;
  const recordingSourceLabel = (c: RecordingCapture | null | undefined): string | null => {
    if (!c) return null;
    if (c.mode === "window") return t("detailsSourceWindow");
    if (c.mode === "area") return t("detailsSourceArea");
    if (c.mode === "import") return t("detailsSourceImported");
    return t("detailsSourceRecording");
  };
  const source =
    video.kind === "screenshot"
      ? t("detailsSourceScreenshot")
      : video.kind === "gif"
        ? t("kindGif")
        : (recordingSourceLabel(capture) ?? t("detailsSourceRecording"));

  const rows: Array<[label: string, value: string, key: string]> = [];
  rows.push([t("detailsSource"), source, "source"]);
  if (size) {
    rows.push([
      t("detailsResolution"),
      t("metaDimensions", { width: size.width, height: size.height }),
      "resolution",
    ]);
  }
  if (isVideo && probe) {
    rows.push([
      t("detailsFrameRate"),
      t("detailsFps", { fps: Math.round(probe.fps) }),
      "frameRate",
    ]);
    rows.push([
      t("detailsAudio"),
      probe.hasAudio ? t("detailsAudioYes") : t("detailsAudioNo"),
      "audio",
    ]);
  }
  if (video.gif) {
    rows.push([
      t("detailsFrameRate"),
      t("detailsFps", { fps: Math.round(video.gif.fps) }),
      "frameRate",
    ]);
  }
  rows.push([t("detailsSize"), formatSize(video.fileSizeBytes), "size"]);
  rows.push([t("detailsCreated"), absoluteDate(video.createdAt, locale), "created"]);
  if (path) rows.push([t("detailsLocation"), path, "location"]);
  if (workspaceName) rows.push([t("detailsWorkspace"), workspaceName, "workspace"]);

  return (
    <dl {...uiArea("libraryDetail.itemDetails")} className={styles.list}>
      {rows.map(([label, value, key]) => (
        <div key={key} className={styles.row}>
          <dt className={styles.term}>{label}</dt>
          <dd className={styles.value} data-wrap={key === "location" || undefined}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
