import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "@kaipu/i18n";
import type { SourceProbe } from "@renderer/features/video-editor/export/probe-source";
import { DESTINATION_GROUPS } from "../destinations";
import type { DestinationId } from "../destinations";
import { DESTINATION_COPY, GROUP_COPY } from "../destination-copy";
import { useDestinationEstimate } from "../use-destination-estimate";
import { DestinationLogo } from "./destination-logo";
import styles from "./destinations-list.module.css";
import { uiArea } from "@renderer/lib/ui-area";

interface DestinationsListProps {
  /** The recording's file size: the archive row's number, and the base for the others. */
  sizeBytes: number;
  /** The recording as read from the file; rows show "…" until it is. */
  probe: SourceProbe | null;
  onPick(destination: DestinationId): void;
  /** "Open Export": the full export screen, for a destination this list does not name. */
  onOpenExport(): void;
  /** An extra line under the list (the "heavy to send" hint). */
  note?: ReactNode;
}

/**
 * "Where is it going?" as a tab: the same question as `DestinationsPanel`, but a vertical
 * list grouped by who compresses the video last. Each row is one destination with the size
 * of the copy it would make; amber where the platform compresses again, teal where the file
 * plays as it is.
 */
export function DestinationsList({
  sizeBytes,
  probe,
  onPick,
  onOpenExport,
  note,
}: DestinationsListProps): React.JSX.Element {
  const t = useTranslations("library");
  const tPrepare = useTranslations("prepare");
  const estimate = useDestinationEstimate(sizeBytes, probe);

  return (
    <section
      {...uiArea("libraryDetail.destinations")}
      className={styles.root}
      aria-labelledby="destinations-list-heading"
    >
      <div className={styles.head}>
        <h2 id="destinations-list-heading" className={styles.title}>
          {t("destinationsTitle")}
        </h2>
        <p className={styles.body}>{t("destinationsBody")}</p>
      </div>
      {DESTINATION_GROUPS.map((group) => (
        <div key={group.id} className={styles.group}>
          <h3 className={styles.groupLabel}>{tPrepare(GROUP_COPY[group.id].label)}</h3>
          <ul className={styles.rows}>
            {group.destinations.map((destination) => {
              const name = tPrepare(DESTINATION_COPY[destination].name);
              return (
                <li key={destination}>
                  <button
                    type="button"
                    className={styles.row}
                    aria-label={t("destinationAria", { destination: name })}
                    onClick={() => onPick(destination)}
                  >
                    <DestinationLogo destination={destination} size={30} />
                    <span className={styles.text}>
                      <span className={styles.name}>{name}</span>
                      <span className={styles.line}>
                        {tPrepare(DESTINATION_COPY[destination].line)}
                      </span>
                    </span>
                    <span
                      className={styles.size}
                      data-tone={group.id === "send-more" ? "upload" : "light"}
                    >
                      {estimate(destination) ?? "…"}
                    </span>
                    <ChevronRight
                      size={14}
                      strokeWidth={1.8}
                      className={styles.chevron}
                      aria-hidden
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {note}
      <button type="button" className={styles.openExport} onClick={onOpenExport}>
        {tPrepare("openExport")}
      </button>
    </section>
  );
}
