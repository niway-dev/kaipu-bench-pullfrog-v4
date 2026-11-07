/**
 * The preview's CSS for the video background (ADR 0051): the same `backgroundFrame` the
 * composer draws with, applied at the stage's displayed size in display px. Pure — the stage
 * measures itself and calls this — so the preview and the export are two renderings of one
 * set of numbers, and a test can hold them to it.
 */
import type { CSSProperties } from "react";
import { backgroundCss } from "../../screenshots/beautify/backgrounds";
import { backgroundFrame, hasBackground, type VideoBackground } from "../background";

export interface PreviewBackgroundStyle {
  /** The frame: the preset's paint behind the picture. Empty with `none`. */
  frame: CSSProperties;
  /** The picture: inset, rounded and shadowed. Empty with `none`, where it fills the frame. */
  picture: CSSProperties;
}

const NEUTRAL: PreviewBackgroundStyle = { frame: {}, picture: {} };

/** `background` around a picture drawn into a stage of `width × height` display px. */
export function previewBackgroundStyle(
  background: VideoBackground,
  width: number,
  height: number,
): PreviewBackgroundStyle {
  if (!hasBackground(background) || !(width > 0) || !(height > 0)) return NEUTRAL;
  const { picture, radius, shadow } = backgroundFrame(background, width, height);
  return {
    // A custom property, read by `.frame { background: var(--frame-bg) }`: the preset's CSS
    // value is a whole `background` (gradient or token var), and this keeps it verbatim.
    frame: { "--frame-bg": backgroundCss(background.bg) } as CSSProperties,
    picture: {
      left: `${picture.x}px`,
      top: `${picture.y}px`,
      width: `${picture.width}px`,
      height: `${picture.height}px`,
      borderRadius: `${radius}px`,
      boxShadow: shadow
        ? `0 ${shadow.offsetY}px ${shadow.blur}px rgba(0, 0, 0, ${shadow.alpha})`
        : undefined,
    },
  };
}
