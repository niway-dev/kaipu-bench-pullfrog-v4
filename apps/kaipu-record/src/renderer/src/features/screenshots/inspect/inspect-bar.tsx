import React from "react";
import { Check, Copy, Minus, MoveHorizontal, MoveVertical, Palette, Plus } from "lucide-react";
import { useTranslations } from "@kaipu/i18n";
import { uiArea } from "@renderer/lib/ui-area";
import { COLOR_FORMATS, capturedFormat, type ColorFormat } from "./color";
import type { ColorsController } from "./colors/use-colors";
import { MAX_TOLERANCE, MIN_TOLERANCE } from "./pixel-run";
import type { InspectController } from "./use-inspect";
import styles from "./inspect-bar.module.css";

const FORMAT_LABEL: Record<ColorFormat, string> = {
  hex: "HEX",
  rgb: "RGB",
  hsl: "HSL",
  oklch: "OKLCH",
};

/**
 * The Inspect controls: width/height rulers, color format, "As captured", tolerance, Outer,
 * Copy and Colors (mock B1, C2). Every key Inspect answers to has a control here.
 *
 * `inline` is the toolbar row that replaces the tool group (mock 586-593); without it the bar
 * is the floating card compact layouts keep. Exiting is the mode switch's Annotate segment or
 * Esc, so there is no exit button. The status lines sit at the end of the row.
 */
export function InspectBar({
  inspect,
  colors,
  inline = false,
}: {
  inspect: InspectController;
  /** The colors panel's toggle (NIW2-704). */
  colors?: ColorsController;
  inline?: boolean;
}): React.JSX.Element {
  const t = useTranslations("screenshots");
  const shownFormat = inspect.asCaptured ? capturedFormat(inspect.format) : inspect.format;
  const toleranceShown = inspect.toleranceShown;
  const ruler = (axis: "x" | "y"): void => inspect.setRuler(inspect.ruler === axis ? null : axis);
  return (
    <div
      {...uiArea("editorImage.inspectBar")}
      className={`${styles.bar} ${inline ? styles.barInline : ""}`}
      role="group"
      aria-label={t("inspectBarLabel")}
      data-format={shownFormat}
      data-as-captured={String(inspect.asCaptured)}
      data-inline={String(inline)}
    >
      <div
        {...uiArea("editorImage.inspectRuler")}
        className={styles.barRow}
        role="group"
        aria-label={t("inspectRulerLabel")}
        data-ruler={inspect.ruler ?? "off"}
      >
        <button
          type="button"
          className={`${styles.barBtn} ${inspect.ruler === "x" ? styles.barBtnOn : ""}`}
          aria-pressed={inspect.ruler === "x"}
          aria-label={t("inspectRulerX")}
          title={t("inspectRulerXTitle")}
          onClick={() => ruler("x")}
        >
          <MoveHorizontal size={inline ? 16 : 14} />
          {t("inspectBarWidth")}
          <kbd className={styles.kbd}>1</kbd>
        </button>
        <button
          type="button"
          className={`${styles.barBtn} ${inspect.ruler === "y" ? styles.barBtnOn : ""}`}
          aria-pressed={inspect.ruler === "y"}
          aria-label={t("inspectRulerY")}
          title={t("inspectRulerYTitle")}
          onClick={() => ruler("y")}
        >
          <MoveVertical size={inline ? 16 : 14} />
          {t("inspectBarHeight")}
          <kbd className={styles.kbd}>2</kbd>
        </button>
        <button
          type="button"
          className={`${styles.barBtn} ${inspect.outer ? styles.barBtnOn : ""}`}
          aria-pressed={inspect.outer}
          title={t("inspectOuterTitle")}
          disabled={!inspect.ruler}
          onClick={() => inspect.setOuterLocked(!inspect.outerLocked)}
        >
          {t("inspectOuter")}
        </button>
      </div>
      <span className={styles.divider} aria-hidden />
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
        className={`${styles.switchBtn} ${inspect.asCaptured ? styles.switchBtnOn : ""}`}
        aria-pressed={inspect.asCaptured}
        title={t("inspectAsCapturedTitle")}
        onClick={() => inspect.setAsCaptured(!inspect.asCaptured)}
      >
        <span className={styles.switchTrack} aria-hidden>
          <span className={styles.switchThumb} />
        </span>
        {t("inspectAsCaptured")}
      </button>
      <span className={styles.divider} aria-hidden />
      <div
        className={styles.rulerTolerance}
        role="group"
        aria-label={t("inspectTolerance")}
        title={t("inspectToleranceTitle")}
      >
        <span className={styles.toleranceLabel} aria-hidden>
          {t("inspectTolerance")}
        </span>
        <button
          type="button"
          className={styles.segment}
          aria-label={t("inspectToleranceDown")}
          disabled={!inspect.ruler || inspect.tolerance <= MIN_TOLERANCE}
          onClick={() => inspect.setTolerance(inspect.tolerance - 1)}
        >
          <Minus size={12} />
        </button>
        <span
          className={`${styles.toleranceValue} ${toleranceShown ? styles.toleranceValueShown : ""}`}
          data-testid="inspect-tolerance"
          data-shown={String(toleranceShown)}
        >
          {inspect.tolerance}
        </span>
        <button
          type="button"
          className={styles.segment}
          aria-label={t("inspectToleranceUp")}
          disabled={!inspect.ruler || inspect.tolerance >= MAX_TOLERANCE}
          onClick={() => inspect.setTolerance(inspect.tolerance + 1)}
        >
          <Plus size={12} />
        </button>
      </div>
      <span className={styles.divider} aria-hidden />
      <div className={styles.barRow}>
        <button
          type="button"
          className={styles.barBtn}
          title={t("inspectCopyTitle")}
          aria-label={inspect.copied ? t("inspectCopied") : t("inspectCopy")}
          onClick={() => void inspect.copy()}
        >
          {inspect.copied ? <Check size={14} /> : <Copy size={14} />}
          {/* The toolbar row has no room for the words (the mock's row has no copy button). */}
          {!inline && t("inspectCopy")}
        </button>
        {colors && (
          <button
            type="button"
            className={`${styles.barBtn} ${colors.open ? styles.barBtnOn : ""}`}
            aria-pressed={colors.open}
            title={t("inspectColorsTitle")}
            aria-label={t("inspectColors")}
            onClick={colors.toggle}
          >
            <Palette size={14} />
            {!inline && t("inspectColors")}
          </button>
        )}
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
