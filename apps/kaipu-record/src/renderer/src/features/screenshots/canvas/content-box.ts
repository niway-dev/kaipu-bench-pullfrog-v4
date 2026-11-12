import type { CanvasGeom } from "../annotations/canvas-geometry";
import type { CropRect } from "../annotations/scene";

/**
 * The export frame (world-normalized, relative to the image) that covers exactly the content
 * box: the image plus whatever sticks out past it, without the beautify padding. What "Fit
 * to content" on the export frame card sets.
 */
export function contentBoxFrame(g: CanvasGeom): CropRect {
  const { left, top, right, bottom } = g.extents;
  return {
    // `0 -` rather than a unary minus: a zero extent must give 0, not -0.
    x: 0 - left / g.naturalW,
    y: 0 - top / g.naturalH,
    w: (left + g.naturalW + right) / g.naturalW,
    h: (top + g.naturalH + bottom) / g.naturalH,
  };
}
