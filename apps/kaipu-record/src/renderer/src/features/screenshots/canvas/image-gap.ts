/**
 * The gap measure drawn beside a selected added image (mock A4): the empty space between it
 * and the nearest image next to it, in source pixels. Pure, so the picking rules are tested
 * apart from the drawing.
 */

/** A rectangle in world units, where 1 unit is 1 source pixel of the base image. */
export interface WorldRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GapMeasure {
  /** `x` = the gap lies between a left and a right edge; `y` = between a top and a bottom edge. */
  axis: "x" | "y";
  /** The two facing edges' positions along `axis`. */
  from: number;
  to: number;
  /** Where the measure line sits across the other axis: the middle of the shared overlap. */
  at: number;
  /** The gap, whole pixels, never below 1. */
  px: number;
}

/** A rectangle's extent along one axis: [start, end]. */
type Span = readonly [number, number];
const xSpan = (r: WorldRect): Span => [r.x, r.x + r.w];
const ySpan = (r: WorldRect): Span => [r.y, r.y + r.h];

/**
 * One measure per axis at most: the nearest neighbour that overlaps the selection on the
 * perpendicular axis (a neighbour above and to the right is not "beside" it). Nothing for
 * an axis whose nearest neighbour touches or overlaps the selection: there is no space to
 * measure, and a farther image behind it must not take its place.
 */
export function gapMeasures(selected: WorldRect, others: readonly WorldRect[]): GapMeasure[] {
  const out: GapMeasure[] = [];
  const x = nearest("x", xSpan, ySpan, selected, others);
  if (x) out.push(x);
  const y = nearest("y", ySpan, xSpan, selected, others);
  if (y) out.push(y);
  return out;
}

function nearest(
  axis: "x" | "y",
  along: (r: WorldRect) => Span,
  across: (r: WorldRect) => Span,
  sel: WorldRect,
  others: readonly WorldRect[],
): GapMeasure | null {
  const [selStart, selEnd] = along(sel);
  let best: { gap: number; from: number; to: number; at: number } | null = null;
  for (const o of others) {
    const lo = Math.max(across(sel)[0], across(o)[0]);
    const hi = Math.min(across(sel)[1], across(o)[1]);
    // Only an image that shares some of the perpendicular span is beside the selection.
    if (!(hi - lo > 0)) continue;
    const [oStart, oEnd] = along(o);
    const after = oStart - selEnd;
    const before = selStart - oEnd;
    const gap = Math.max(after, before, 0);
    if (best && gap >= best.gap) continue;
    // An overlap (gap 0) keeps its place as the nearest: it hides the measure below.
    const isAfter = after >= before;
    best = {
      gap,
      from: isAfter ? selEnd : oEnd,
      to: isAfter ? oStart : selStart,
      at: (lo + hi) / 2,
    };
  }
  if (!best) return null;
  const px = Math.round(best.gap);
  if (px < 1) return null;
  return { axis, from: best.from, to: best.to, at: best.at, px };
}
