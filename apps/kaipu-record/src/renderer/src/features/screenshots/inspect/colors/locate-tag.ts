import type { AreaBounds, ColorAnalysis, LocateTarget } from "./histogram";

/** The color a located target stands for: a group's swatch, or the exact value. */
export function locatedColor(
  analysis: ColorAnalysis | null,
  located: LocateTarget | null,
): number | null {
  if (!analysis || !located) return null;
  if (located.kind === "color") return located.rgb;
  return analysis.groups[located.id]?.rgb ?? null;
}

/** Where the tag on the image goes, as percentages of the image. */
export interface TagPlacement {
  /** Center of the tag, from the image's left edge. */
  left: number;
  /** The edge of the area the tag hangs from: its bottom, or its top when `above`. */
  top: number;
  above: boolean;
}

/** Below this share of the image's height (from the top) an area still has room under it. */
const ROOM_BELOW = 0.9;
/** Keeps the tag's center this far from the side edges, in percent of the image's width. */
const SIDE_MARGIN = 10;

/**
 * The tag sits under the largest area of the located color, centered on it; an area that
 * reaches the bottom of the image gets the tag above it instead, so it stays on the image.
 * The tag has a fixed size on screen, so only its anchor is in image terms.
 */
export function tagPlacement(bounds: AreaBounds, width: number, height: number): TagPlacement {
  const center = ((bounds.x + bounds.w / 2) / width) * 100;
  const bottom = bounds.y + bounds.h;
  const above = bottom / height > ROOM_BELOW;
  return {
    left: Math.min(100 - SIDE_MARGIN, Math.max(SIDE_MARGIN, center)),
    top: ((above ? bounds.y : bottom) / height) * 100,
    above,
  };
}
