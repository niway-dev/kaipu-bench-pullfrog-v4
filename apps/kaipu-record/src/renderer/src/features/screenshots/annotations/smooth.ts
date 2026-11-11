interface Pt {
  x: number;
  y: number;
}

/**
 * An SVG path `d` that smoothly threads a freehand stroke's points (in px).
 * Catmull-Rom → cubic Bézier — the same builder runs in the live layer and the
 * export compositor, so what the user draws is what they get. Round caps/joins
 * (set by the caller) turn a single point into a dot.
 */
export function smoothPath(points: Pt[]): string {
  if (points.length === 0) return "";
  const [first] = points;
  if (points.length === 1) return `M ${first.x} ${first.y} L ${first.x + 0.01} ${first.y}`;
  if (points.length === 2) return `M ${first.x} ${first.y} L ${points[1].x} ${points[1].y}`;

  let d = `M ${first.x} ${first.y}`;
  for (const [cp1, cp2, p2] of smoothSegments(points)) {
    d += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${p2.x} ${p2.y}`;
  }
  return d;
}

/** The cubic segments `smoothPath` draws for 3+ points: [control 1, control 2, end]. */
function smoothSegments(points: Pt[]): [Pt, Pt, Pt][] {
  const out: [Pt, Pt, Pt][] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    out.push([
      { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
      p2,
    ]);
  }
  return out;
}

/**
 * Every point `smoothPath` draws through or steers by: the stored points plus each
 * segment's Bézier control points. A cubic lies inside the hull of its control points,
 * so their bounding box contains the whole stroke (the curve can overshoot the points).
 */
export function pathControlPoints(points: Pt[]): Pt[] {
  if (points.length < 3) return points;
  return [points[0], ...smoothSegments(points).flat()];
}
