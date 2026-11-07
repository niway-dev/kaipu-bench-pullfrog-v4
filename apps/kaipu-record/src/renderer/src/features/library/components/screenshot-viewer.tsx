import { ImageOff, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "@kaipu/i18n";
import styles from "./screenshot-viewer.module.css";
import { uiArea } from "@renderer/lib/ui-area";

/** Zoom steps; 1 is "Fit" (the whole image inside the frame). */
export const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3, 4] as const;
const FIT_INDEX = ZOOM_STEPS.indexOf(1);

interface ScreenshotViewerProps {
  src?: string | null;
  /** Called once the image has loaded, with its natural pixel size. */
  onNaturalSize?(width: number, height: number): void;
}

/** Saved-screenshot viewer for the library detail page — the image-kind counterpart
 *  of RecordingPlayer. Shows the stored PNG (served via kaipu-media://screenshot/id),
 *  with zoom controls under it: `−`, Fit and `+`. */
export function ScreenshotViewer({ src, onNaturalSize }: ScreenshotViewerProps): React.JSX.Element {
  const t = useTranslations("prepare");
  const [failed, setFailed] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(FIT_INDEX);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const zoom = ZOOM_STEPS[zoomIndex]!;
  const shown = Boolean(src) && !failed;

  return (
    <div {...uiArea("libraryDetail.preview")} className={styles.root}>
      <div className={styles.viewer} data-zoomed={zoom > 1 ? "true" : "false"}>
        {shown ? (
          <img
            src={src!}
            alt=""
            className={styles.image}
            style={
              zoom === 1
                ? undefined
                : { width: `${zoom * 100}%`, maxWidth: "none", maxHeight: "none" }
            }
            onLoad={(e) => {
              const { naturalWidth, naturalHeight } = e.currentTarget;
              setNatural({ width: naturalWidth, height: naturalHeight });
              onNaturalSize?.(naturalWidth, naturalHeight);
            }}
            onError={() => setFailed(true)}
          />
        ) : (
          <div className={styles.unavailable}>
            <ImageOff size={28} strokeWidth={1.5} />
            Image unavailable
          </div>
        )}
      </div>
      {shown && (
        <div className={styles.controls}>
          <span className={styles.natural}>
            {natural ? `${natural.width} × ${natural.height} px` : ""}
          </span>
          <button
            type="button"
            className={styles.zoomButton}
            aria-label={t("shotZoomOut")}
            disabled={zoomIndex === 0}
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
          >
            <Minus size={13} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            className={styles.fit}
            aria-label={t("shotZoomFit")}
            onClick={() => setZoomIndex(FIT_INDEX)}
          >
            {t("shotZoomFit")}
          </button>
          <button
            type="button"
            className={styles.zoomButton}
            aria-label={t("shotZoomIn")}
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
          >
            <Plus size={13} strokeWidth={2} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
