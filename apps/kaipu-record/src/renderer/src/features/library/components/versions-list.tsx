import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Film, ImagePlay, Info, Pencil } from "lucide-react";
import { useTranslations } from "@kaipu/i18n";
import type { LibraryVideo } from "@renderer/features/library/types";
import { formatDuration, formatSize, relativeDate } from "@renderer/features/library/format";
import type { buildLineage } from "@renderer/features/library/lineage";
import {
  type ExportPresetId,
  resolveExportTarget,
} from "@renderer/features/video-editor/export/export-presets";
import { exportEtaSeconds } from "@renderer/features/video-editor/export/export-size";
import type { SourceProbe } from "@renderer/features/video-editor/export/probe-source";
import { copyDestinationOf, copyPresetOf } from "@renderer/features/prepare/copy-destination";
import { type DestinationId, destinationOfPreset } from "@renderer/features/prepare/destinations";
import { DESTINATION_COPY } from "@renderer/features/prepare/destination-copy";
import { DestinationLogo } from "@renderer/features/prepare/components/destination-logo";
import type { runningCopyOf } from "@renderer/features/prepare/components/master-copies-panel";
import styles from "./versions-list.module.css";
import { uiArea } from "@renderer/lib/ui-area";

interface VersionsListProps {
  /** The item the page shows. */
  item: LibraryVideo;
  lineage: ReturnType<typeof buildLineage>;
  /** The background export of the original, while it runs. */
  running: ReturnType<typeof runningCopyOf>;
  /** The source as read from the file: a destination copy's picture size follows from it. */
  probe: SourceProbe | null;
  now?: () => number;
}

/**
 * "Versions" tab: the original (never changes), its edited project when there is one, every
 * exported copy, and the copy being made right now. The row of the item on screen carries a
 * "Viewing" pill; every other row opens its own page.
 */
export function VersionsList({
  item,
  lineage,
  running,
  probe,
  now = Date.now,
}: VersionsListProps): React.JSX.Element {
  const t = useTranslations("library");
  const tPrepare = useTranslations("prepare");
  const tEditor = useTranslations("videoEditor");

  const isCopy = item.derivedFromAssetId !== null;
  const master = isCopy ? (lineage.byAssetId.get(item.derivedFromAssetId!) ?? null) : item;
  const sourceDeleted = isCopy && master === null;
  const copies = [
    ...(master ? (lineage.exportsOf.get(master.assetId) ?? []) : []),
    // A copy that has copies of its own lists them after its siblings.
    ...(isCopy ? (lineage.exportsOf.get(item.assetId) ?? []) : []),
  ];
  // A copy whose source is gone is not in its source's list: it still has to appear.
  if (sourceDeleted && !copies.some((c) => c.assetId === item.assetId)) copies.unshift(item);

  const hasEdit = master !== null && master.kind === "recording" && master.editSavedAt !== null;
  const count = (master || sourceDeleted ? 1 : 0) + (hasEdit ? 1 : 0) + copies.length;

  const destinationName = (presetId: ExportPresetId, destination?: DestinationId | null) => {
    const d = destination ?? destinationOfPreset(presetId);
    const name = tPrepare(DESTINATION_COPY[d].name);
    if (presetId === "youtube-1440") return `${name} ${t("copyRes1440")}`;
    if (presetId === "youtube-4k") return `${name} ${t("copyRes4k")}`;
    return name;
  };

  const progressText = (job: NonNullable<typeof running>): string => {
    const percent = Math.round(Math.min(1, Math.max(0, job.fraction)) * 100);
    const eta =
      job.attemptStartedAt !== null
        ? exportEtaSeconds(job.fraction, now() - job.attemptStartedAt)
        : null;
    if (eta === null) return t("copyExportingNoEta", { percent });
    const etaText =
      eta < 60
        ? tEditor("etaSeconds", { seconds: eta })
        : tEditor("etaMinutes", { minutes: Math.round(eta / 60) });
    return t("copyExporting", { percent, eta: etaText });
  };

  const factsOf = (copy: LibraryVideo, preset: ExportPresetId | null): string => {
    const parts: string[] = [];
    const dims = copy.gif
      ? { width: copy.gif.width, height: copy.gif.height }
      : preset && probe
        ? resolveExportTarget(preset, probe, probe.durationSec)
        : null;
    if (dims) parts.push(t("metaDimensions", { width: dims.width, height: dims.height }));
    parts.push(formatSize(copy.fileSizeBytes));
    if (copy.kind !== "screenshot" && copy.durationSeconds > 0) {
      parts.push(formatDuration(copy.durationSeconds));
    }
    parts.push(relativeDate(copy.createdAt));
    return parts.join(" · ");
  };

  const viewing = (assetId: string): boolean => assetId === item.assetId;
  const empty = copies.length === 0 && running === null;

  return (
    <section
      {...uiArea("libraryDetail.versions")}
      className={styles.root}
      aria-labelledby="versions-heading"
    >
      <div className={styles.head}>
        <h2 id="versions-heading" className={styles.title}>
          {tPrepare("versionsHeading")}
        </h2>
        <span className={styles.count}>{count}</span>
      </div>
      <ul className={styles.rows}>
        {master && (
          <Row
            assetId={master.assetId}
            current={viewing(master.assetId)}
            viewingLabel={tPrepare("versionsViewing")}
            icon={<Thumb video={master} />}
            name={master.title}
            kind={
              <span className={styles.kindWithInfo}>
                {tPrepare("versionsOriginal")}
                <span
                  className={styles.info}
                  title={tPrepare("versionsNeverChanges")}
                  aria-label={tPrepare("versionsNeverChanges")}
                  role="img"
                >
                  <Info size={11} strokeWidth={2} aria-hidden />
                </span>
              </span>
            }
            facts={factsOf(master, null)}
          />
        )}
        {sourceDeleted && (
          <li className={styles.row} data-state="missing">
            <span className={styles.genericIcon} aria-hidden>
              <Film size={14} strokeWidth={1.9} />
            </span>
            <span className={styles.text}>
              <span className={styles.name}>{t("sourceDeleted")}</span>
            </span>
          </li>
        )}
        {hasEdit && master && (
          <li className={styles.row} data-state="edited">
            <span className={styles.genericIcon} aria-hidden>
              <Pencil size={13} strokeWidth={1.9} />
            </span>
            <span className={styles.text}>
              <span className={styles.name}>{tPrepare("versionsEditedProject")}</span>
              <span className={styles.facts}>{relativeDate(master.editSavedAt!)}</span>
            </span>
          </li>
        )}
        {running && (
          <li className={styles.row} data-state="running">
            <CopyIcon
              destination={
                running.wholeRecording
                  ? (running.destination ?? destinationOfPreset(running.presetId))
                  : null
              }
            />
            <span className={styles.text}>
              <span className={styles.name}>
                {running.wholeRecording
                  ? destinationName(running.presetId, running.destination)
                  : t("edited")}
              </span>
              <span className={styles.facts}>{progressText(running)}</span>
            </span>
            <span className={styles.bar} aria-hidden>
              <span
                className={styles.barFill}
                style={{
                  width: `${Math.round(Math.min(1, Math.max(0, running.fraction)) * 100)}%`,
                }}
              />
            </span>
          </li>
        )}
        {copies.map((copy) => {
          const preset = copyPresetOf(copy);
          const destination = copyDestinationOf(copy);
          const name = preset ? destinationName(preset, destination) : copy.title;
          return (
            <Row
              key={copy.assetId}
              assetId={copy.assetId}
              current={viewing(copy.assetId)}
              viewingLabel={tPrepare("versionsViewing")}
              icon={
                copy.thumbnailUrl ? (
                  <Thumb video={copy} />
                ) : (
                  <CopyIcon destination={destination} gif={copy.kind === "gif"} />
                )
              }
              name={name}
              kind={tPrepare("versionsExportedCopy")}
              facts={factsOf(copy, preset)}
            />
          );
        })}
      </ul>
      {empty && <p className={styles.empty}>{tPrepare("versionsEmpty")}</p>}
    </section>
  );
}

function Row({
  assetId,
  current,
  viewingLabel,
  icon,
  name,
  kind,
  facts,
}: {
  assetId: string;
  current: boolean;
  viewingLabel: string;
  icon: ReactNode;
  name: string;
  kind: ReactNode;
  facts: string;
}): React.JSX.Element {
  const body = (
    <>
      {icon}
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        <span className={styles.facts}>{kind}</span>
      </span>
      <span className={styles.meta}>{facts}</span>
    </>
  );
  if (current) {
    return (
      <li className={styles.row} data-state="viewing" aria-current="true">
        <div className={styles.inner}>{body}</div>
        <span className={styles.pill}>{viewingLabel}</span>
      </li>
    );
  }
  return (
    <li className={styles.row} data-state="ready">
      <Link to={`/library/${assetId}`} className={styles.link}>
        {body}
      </Link>
    </li>
  );
}

function Thumb({ video }: { video: LibraryVideo }): React.JSX.Element {
  if (video.thumbnailUrl) {
    return <img src={video.thumbnailUrl} alt="" className={styles.thumb} />;
  }
  return <CopyIcon destination={null} gif={video.kind === "gif"} />;
}

function CopyIcon({
  destination,
  gif = false,
}: {
  destination: DestinationId | null;
  gif?: boolean;
}): React.JSX.Element {
  if (destination) return <DestinationLogo destination={destination} size={30} />;
  const Icon = gif ? ImagePlay : Film;
  return (
    <span className={styles.genericIcon} aria-hidden>
      <Icon size={14} strokeWidth={1.9} />
    </span>
  );
}
