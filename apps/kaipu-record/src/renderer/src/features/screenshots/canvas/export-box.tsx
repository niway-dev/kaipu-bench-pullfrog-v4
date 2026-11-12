import React from "react";
import { useTranslations } from "@kaipu/i18n";
import { uiArea } from "@renderer/lib/ui-area";
import styles from "./export-box.module.css";

/**
 * The export box (mock A1): the rectangle Copy and Save produce, drawn around the content in
 * the canvas's own space, so it pans and zooms with it. Rendered inside the beautify frame,
 * whose edge IS that rectangle (content box plus padding), so it needs no geometry of its own.
 *
 * Its outline and label stay one screen pixel / one font size at any zoom: they read the
 * canvas element's `--canvas-zoom`, the page writes it with the view.
 *
 * `size` is the exact pixel size Copy produces (`exportPixelSize`), null until the image has
 * been measured. `labeled` false keeps the box and drops the label (Inspect, Redact and Select
 * text are reading the image and the label would sit on top of what they show).
 *
 * The box has no fill of its own: with no background the frame already paints the white the
 * export has under the content (`canvas-box-fill`), and a stage-coloured fill would show the
 * user a colour Copy does not produce.
 */
export function ExportBox({
  size,
  labeled,
}: {
  size: { w: number; h: number } | null;
  labeled: boolean;
}): React.JSX.Element {
  const t = useTranslations("screenshots");
  const showLabel = labeled && size !== null;
  return (
    <div
      {...uiArea("editorImage.exportBox")}
      className={styles.box}
      data-testid="export-box"
      data-label={showLabel ? "labeled" : "quiet"}
      aria-hidden
    >
      <div className={styles.dash} />
      {showLabel && (
        <div className={styles.label} data-testid="export-box-label">
          <span className={styles.tag}>{t("exportBoxLabel")}</span>
          <span className={styles.size}>
            {size.w} × {size.h} px
          </span>
        </div>
      )}
    </div>
  );
}
