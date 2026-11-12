import React, { useEffect, useState } from "react";
import { Check, Pipette, X } from "lucide-react";
import { useTranslations } from "@kaipu/i18n";
import { uiArea } from "@renderer/lib/ui-area";
import { isEditingTarget } from "./inspect-keys";
import styles from "./inspect-mode-pill.module.css";

const LEGEND = [
  ["1", "inspectLegendWidth"],
  ["2", "inspectLegendHeight"],
  ["C", "inspectLegendCopy"],
  ["wheel", "inspectLegendWheel"],
  ["⇧", "inspectLegendOuter"],
  ["click", "inspectLegendPin"],
  ["Esc", "inspectLegendLeave"],
] as const;

/**
 * The mode pill at the foot of the canvas (mock C11): "INSPECT" plus a "? keys" hint that opens
 * the key legend. While a copy shows it is replaced by the "Copied <value>" pill (mock C4).
 * `?` toggles the legend. The legend starts closed and is not remembered.
 */
export function InspectModePill({
  copied,
  readout,
}: {
  copied: boolean;
  readout: string | null;
}): React.JSX.Element {
  const t = useTranslations("screenshots");
  const [legend, setLegend] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditingTarget(e.target) || document.querySelector('[aria-modal="true"]')) return;
      setLegend((open) => !open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (copied) {
    return (
      <div {...uiArea("editorImage.inspectCopied")} className={styles.pill} role="status">
        <Check size={14} className={styles.check} />
        <span className={styles.copiedText}>{t("inspectCopied")}</span>
        {readout && <span className={styles.value}>{readout}</span>}
      </div>
    );
  }
  return (
    <div
      {...uiArea("editorImage.inspectMode")}
      className={styles.pill}
      role="group"
      aria-label={t("inspectModeLabel")}
      data-legend={String(legend)}
    >
      <span className={styles.name}>
        <Pipette size={14} />
        <span className={styles.nameText}>{t("modeInspect")}</span>
      </span>
      {legend ? (
        <>
          {LEGEND.map(([key, label]) => (
            <span key={key} className={styles.hint}>
              <kbd className={styles.kbd}>{key}</kbd>
              {t(label)}
            </span>
          ))}
          <button
            type="button"
            className={styles.close}
            aria-label={t("inspectHideKeys")}
            title={t("inspectHideKeys")}
            onClick={() => setLegend(false)}
          >
            <X size={12} />
          </button>
        </>
      ) : (
        <button
          type="button"
          className={styles.hint}
          aria-label={t("inspectShowKeys")}
          title={t("inspectShowKeys")}
          onClick={() => setLegend(true)}
        >
          <kbd className={styles.kbd}>?</kbd>
          {t("inspectKeysHint")}
        </button>
      )}
    </div>
  );
}
