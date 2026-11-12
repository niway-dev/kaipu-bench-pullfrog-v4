import React from "react";
import { useTranslations } from "@kaipu/i18n";
import { uiArea } from "@renderer/lib/ui-area";
import styles from "./export-frame-card.module.css";

/**
 * The card the export frame tool opens at the stage's top-left (mock A5): what the frame is
 * for, and the two ways out of it. Both buttons are ordinary export frame edits, so each is
 * one undo step. It replaces the classic crop tool's "Crop / Reset" panel in canvas mode.
 */
export function ExportFrameCard({
  hasFrame,
  onFit,
  onRemove,
}: {
  /** An export frame is set: only then is there something to remove. */
  hasFrame: boolean;
  /** Set the frame to the content box. */
  onFit: () => void;
  /** Clear the frame: the export is the whole content box again. */
  onRemove: () => void;
}): React.JSX.Element {
  const t = useTranslations("screenshots");
  return (
    <div {...uiArea("editorImage.exportFrameCard")} className={styles.card}>
      <div className={styles.title}>{t("exportFrameTitle")}</div>
      <div className={styles.body}>{t("exportFrameBody")}</div>
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={onFit}>
          {t("exportFrameFit")}
        </button>
        <button type="button" className={styles.button} disabled={!hasFrame} onClick={onRemove}>
          {t("exportFrameRemove")}
        </button>
      </div>
    </div>
  );
}
