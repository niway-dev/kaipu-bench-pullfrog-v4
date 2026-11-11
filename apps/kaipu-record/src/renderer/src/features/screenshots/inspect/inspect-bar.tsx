import React from "react";
import { Check, Copy, X } from "lucide-react";
import { useTranslations } from "@kaipu/i18n";
import { uiArea } from "@renderer/lib/ui-area";
import { COLOR_FORMATS, capturedFormat, type ColorFormat } from "./color";
import type { InspectController } from "./use-inspect";
import styles from "./inspect.module.css";

const FORMAT_LABEL: Record<ColorFormat, string> = {
  hex: "HEX",
  rgb: "RGB",
  hsl: "HSL",
  oklch: "OKLCH",
};

/**
 * The Inspect bar: format switch, "As captured", Copy and exit. Every key Inspect answers to
 * has a control here. It takes the place of the per-tool options while Inspect is on.
 */
export function InspectBar({ inspect }: { inspect: InspectController }): React.JSX.Element {
  const t = useTranslations("screenshots");
  const shownFormat = inspect.asCaptured ? capturedFormat(inspect.format) : inspect.format;
  return (
    <div
      {...uiArea("editorImage.inspectBar")}
      className={styles.bar}
      role="group"
      aria-label={t("inspectBarLabel")}
      data-format={shownFormat}
      data-as-captured={String(inspect.asCaptured)}
    >
      <div className={styles.barRow}>
        <div className={styles.segments} role="group" aria-label={t("inspectFormat")}>
          {COLOR_FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              className={`${styles.segment} ${shownFormat === format ? styles.segmentOn : ""}`}
              aria-pressed={shownFormat === format}
              disabled={inspect.asCaptured && format !== capturedFormat(format)}
              onClick={() => inspect.setFormat(format)}
            >
              {FORMAT_LABEL[format]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`${styles.barBtn} ${inspect.asCaptured ? styles.barBtnOn : ""}`}
          aria-pressed={inspect.asCaptured}
          title={t("inspectAsCapturedTitle")}
          onClick={() => inspect.setAsCaptured(!inspect.asCaptured)}
        >
          {t("inspectAsCaptured")}
        </button>
      </div>
      <div className={styles.barRow}>
        <button
          type="button"
          className={styles.barBtn}
          title={t("inspectCopyTitle")}
          aria-label={inspect.copied ? t("inspectCopied") : t("inspectCopy")}
          onClick={() => void inspect.copy()}
        >
          {inspect.copied ? <Check size={14} /> : <Copy size={14} />}
          {inspect.copied ? t("inspectCopied") : t("inspectCopy")}
        </button>
        <button
          type="button"
          className={styles.barBtn}
          title={t("inspectExitTitle")}
          aria-label={t("inspectExit")}
          onClick={() => inspect.setActive(false)}
        >
          <X size={14} />
          {t("inspectExit")}
        </button>
      </div>
      {inspect.status === "decoding" && (
        <span className={styles.status}>{t("inspectReading")}</span>
      )}
      {inspect.status === "ready" && inspect.asCaptured && inspect.capturedUnavailable && (
        <span className={styles.status}>{t("inspectCapturedUnavailable")}</span>
      )}
      {inspect.status === "error" && (
        <span className={styles.status}>{t("inspectUnavailable")}</span>
      )}
    </div>
  );
}
