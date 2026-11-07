/**
 * Inspector with nothing selected (UI spec § 7.4): the single Sensitivity slider that
 * re-runs detection, a live summary and Re-analyse. Without a cursor track it explains
 * why there is nothing to detect instead of showing dead controls.
 */
import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "@kaipu/i18n";
import type { ZoomEditing } from "../../zoom/use-zoom-editing";
import { HistorySlider } from "../history-slider";
import styles from "./inspector.module.css";

/** Minimum gap between two summary previews while the Sensitivity pointer is down. */
const PREVIEW_INTERVAL_MS = 100;

function noop(): void {}

export function DetectionPanel({
  zooms,
  sensitivity,
  clicksAvailable,
}: {
  zooms: ZoomEditing;
  sensitivity: number;
  /** False when the track has no clicks (macOS without Accessibility, or PR 2 only). */
  clicksAvailable: boolean;
}): React.JSX.Element {
  const t = useTranslations("videoEditor");
  // A pointer drag on Sensitivity only previews the summary (throttled); the scene — and
  // with it the zoom lane, camera path and inspector — is rebuilt once on release.
  const [preview, setPreview] = useState<{ count: number; coverage: number } | null>(null);
  const lastValue = useRef<number | null>(null);
  const lastPreviewAt = useRef(Number.NEGATIVE_INFINITY);
  const trailing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTrailing = (): void => {
    if (trailing.current === null) return;
    clearTimeout(trailing.current);
    trailing.current = null;
  };
  const previewNow = (value: number): void => {
    lastPreviewAt.current = performance.now();
    setPreview(zooms.sensitivityPreview(value));
  };
  // Leading edge previews at once; a move inside the interval schedules one trailing
  // preview for the rest of it, so holding the pointer still never leaves the summary on
  // an older value.
  const onLive = (value: number): void => {
    lastValue.current = value;
    const wait = PREVIEW_INTERVAL_MS - (performance.now() - lastPreviewAt.current);
    if (wait <= 0) {
      clearTrailing();
      previewNow(value);
      return;
    }
    trailing.current ??= setTimeout(() => {
      trailing.current = null;
      if (lastValue.current !== null) previewNow(lastValue.current);
    }, wait);
  };
  const onEnd = (): void => {
    clearTrailing();
    const value = lastValue.current;
    lastValue.current = null;
    lastPreviewAt.current = Number.NEGATIVE_INFINITY;
    setPreview(null);
    if (value !== null) zooms.sensitivityCommit(value);
  };
  useEffect(() => clearTrailing, []);
  const shown = preview ?? { count: zooms.visibleZooms.length, coverage: zooms.coverage };
  return (
    <section className={styles.panel} aria-label={t("detectionTitle")}>
      <h2 className={styles.title}>{t("detectionTitle")}</h2>
      {zooms.canDetect ? (
        <>
          <p className={styles.text}>{t("detectionBody")}</p>
          <HistorySlider
            label={t("sensitivityLabel")}
            value={sensitivity}
            min={0}
            max={100}
            step={1}
            note={t("sensitivityNote")}
            onBegin={noop}
            onLive={onLive}
            onEnd={onEnd}
            onCommit={zooms.sensitivityCommit}
          />
          <p className={styles.summary}>
            {t("detectionSummary", {
              count: shown.count,
              percent: Math.round(shown.coverage * 100),
            })}
          </p>
          <button type="button" className={styles.secondaryButton} onClick={zooms.reanalyse}>
            <RefreshCw size={14} />
            {t("reanalyse")}
          </button>
          {!clicksAvailable && <p className={styles.hint}>{t("clicksUnavailableHint")}</p>}
        </>
      ) : (
        <p className={styles.text}>{t("detectionNoTrack")}</p>
      )}
      <p className={styles.note}>{t("exportSafetyNote")}</p>
    </section>
  );
}
