import React, { useEffect, useRef } from "react";
import { useTranslations } from "@kaipu/i18n";
import { uiArea } from "@renderer/lib/ui-area";
import { LOUPE_RADIUS, type InspectController } from "./use-inspect";
import styles from "./inspect.module.css";

const HUD_OFFSET = 16;
const HUD_WIDTH = 184;
// The HUD is a loupe, a chip and a coordinates line: about this tall (the chip may wrap).
const HUD_HEIGHT = 230;
const LOUPE_SIDE = LOUPE_RADIUS * 2 + 1;

/** Draw the loupe pixels unsmoothed; CSS scales the small canvas up with pixelated rendering. */
function Loupe({ pixels }: { pixels: Uint8ClampedArray | null }): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !pixels) return;
    ctx.imageSmoothingEnabled = false;
    const image = ctx.createImageData(LOUPE_SIDE, LOUPE_SIDE);
    image.data.set(pixels);
    ctx.putImageData(image, 0, 0);
  }, [pixels]);
  return (
    <div className={styles.loupeFrame}>
      <canvas
        ref={ref}
        className={styles.loupe}
        width={LOUPE_SIDE}
        height={LOUPE_SIDE}
        data-testid="inspect-loupe"
        data-smoothing="off"
      />
      <span className={styles.loupeCentre} />
    </div>
  );
}

/**
 * Covers the canvas while Inspect is on and draws the HUD next to the cursor. It handles only
 * pointer move and leave: wheel and pointerdown bubble to the canvas, so pan and zoom keep
 * working, and it sits above the annotation layer, so nothing is drawn or moved meanwhile.
 */
export function InspectLayer({ inspect }: { inspect: InspectController }): React.JSX.Element {
  const t = useTranslations("screenshots");
  const ref = useRef<HTMLDivElement>(null);
  const { hover, readout } = inspect;

  let left = 0;
  let top = 0;
  if (hover) {
    const rect = ref.current?.getBoundingClientRect();
    const width = rect?.width ?? Infinity;
    const height = rect?.height ?? Infinity;
    const x = hover.clientX - (rect?.left ?? 0);
    const y = hover.clientY - (rect?.top ?? 0);
    left = x + HUD_OFFSET + HUD_WIDTH > width ? x - HUD_OFFSET - HUD_WIDTH : x + HUD_OFFSET;
    top = y + HUD_OFFSET + HUD_HEIGHT > height ? y - HUD_OFFSET - HUD_HEIGHT : y + HUD_OFFSET;
    left = Math.max(0, left);
    top = Math.max(0, top);
  }

  return (
    <div
      ref={ref}
      className={styles.layer}
      data-testid="inspect-layer"
      onPointerMove={inspect.onPointerMove}
      onPointerLeave={inspect.onPointerLeave}
    >
      {hover && (
        <div {...uiArea("editorImage.inspectHud")} className={styles.hud} style={{ left, top }}>
          <Loupe pixels={inspect.loupe} />
          <div className={styles.chip}>
            <span
              className={styles.chipSwatch}
              style={{
                background: `rgba(${hover.color.r}, ${hover.color.g}, ${hover.color.b}, ${hover.color.a / 255})`,
              }}
            />
            <span className={styles.chipText}>{readout ?? "…"}</span>
          </div>
          <span className={styles.coords}>
            {hover.x}, {hover.y}
          </span>
          {hover.outOfGamut && <span className={styles.gamut}>{t("inspectOutOfSrgb")}</span>}
        </div>
      )}
    </div>
  );
}
