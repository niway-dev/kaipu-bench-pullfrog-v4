import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslations } from "@kaipu/i18n";
import { uiArea } from "@renderer/lib/ui-area";
import {
  GUIDE_CONTENT,
  GUIDE_TABS,
  neighbourTab,
  type GuideTab,
  type GuideTabContent,
} from "../track-guide";
import { GuideSampleTimeline } from "./guide-sample-timeline";
import { GuideSwatch } from "./guide-swatch";
import styles from "./timeline-guide.module.css";

export interface TimelineGuideModalProps {
  /** The tab on show. The page owns it so a lane label can open the guide on its own lane. */
  tab: GuideTab;
  onTabChange(tab: GuideTab): void;
  /** Escape, the backdrop, the close button. The page hands focus back to what opened it. */
  onClose(): void;
}

/**
 * The Timeline guide (NIW2-679): one tab per lane, each with a sample timeline that lights
 * that lane, what its shapes mean, why the lane helps and how to edit it. Opens from a lane
 * label, the Tracks `?` button and the header Guide button. Escape closes; focus returns to
 * the opener (the page restores it, as the dialog cannot know which control opened it).
 * Portaled to <body> like the Tracks popover.
 */
export function TimelineGuideModal({
  tab,
  onTabChange,
  onClose,
}: TimelineGuideModalProps): React.JSX.Element {
  const t = useTranslations("videoEditor");
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const content: GuideTabContent = GUIDE_CONTENT[tab];
  const prev = neighbourTab(tab, -1);
  const next = neighbourTab(tab, 1);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div
        {...uiArea("editorVideo.trackGuide")}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="timeline-guide-title"
        tabIndex={-1}
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <header className={styles.header}>
          <h2 id="timeline-guide-title" className={styles.title}>
            {t("guideTitle")}
          </h2>
          <span className={styles.subtitle}>{t("guideSubtitle")}</span>
          <div className={styles.tabs} role="tablist" aria-label={t("guideTabs")}>
            {GUIDE_TABS.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={key === tab}
                className={`${styles.tab} ${key === tab ? styles.tabActive : ""}`}
                onClick={() => onTabChange(key)}
              >
                {t(GUIDE_CONTENT[key].nameKey)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.close}
            aria-label={t("guideClose")}
            onClick={onClose}
          >
            <X size={16} aria-hidden />
          </button>
        </header>

        <GuideSampleTimeline active={tab} onSelect={onTabChange} />
        <p className={styles.sampleNote}>{t("guideSample", { track: t(content.nameKey) })}</p>

        <div className={styles.body} role="tabpanel">
          <section className={styles.column}>
            <h3 className={styles.laneName}>{t(content.nameKey)}</h3>
            <p className={styles.intro}>{t(content.introKey)}</p>
            <h4 className={styles.sectionTitle}>{t("guideWhatYouSee")}</h4>
            <ol className={styles.legend}>
              {content.legend.map((row, index) => (
                <li key={row.textKey} className={styles.legendRow}>
                  <span className={styles.legendIndex}>{index + 1}</span>
                  <GuideSwatch kind={row.swatch} />
                  <span>{t(row.textKey)}</span>
                </li>
              ))}
            </ol>
          </section>
          <section className={styles.column}>
            <h4 className={styles.sectionTitle}>{t("guideWhyItHelps")}</h4>
            <p className={styles.why}>{t(content.whyKey)}</p>
            <h4 className={styles.sectionTitle}>{t("guideHowToEdit")}</h4>
            <ul className={styles.how}>
              {content.how.map((row) => (
                <li key={row.textKey} className={styles.howRow}>
                  <kbd className={styles.chip}>{row.chipKey ? t(row.chipKey) : row.chip}</kbd>
                  <span>{t(row.textKey)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <footer className={styles.footer}>
          <div className={styles.walk}>
            <button
              type="button"
              className={styles.walkButton}
              disabled={!prev}
              onClick={() => prev && onTabChange(prev)}
            >
              <ChevronLeft size={14} aria-hidden />
              {prev ? t(GUIDE_CONTENT[prev].nameKey) : t("guideFirstTrack")}
            </button>
            <button
              type="button"
              className={styles.walkButton}
              disabled={!next}
              onClick={() => next && onTabChange(next)}
            >
              {next ? t(GUIDE_CONTENT[next].nameKey) : t("guideLastTrack")}
              <ChevronRight size={14} aria-hidden />
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
