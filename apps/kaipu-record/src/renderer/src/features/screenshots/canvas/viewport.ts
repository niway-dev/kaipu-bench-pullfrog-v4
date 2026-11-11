/**
 * Pan and zoom math for the image editor's infinite canvas (NIW2-698). Pure: no React,
 * no DOM, so a later restyle of the canvas touches only JSX and CSS.
 *
 * The view is a transform applied to the frame: `translate(panX, panY) scale(zoom)` with
 * the frame's top-left as the transform origin. Pan is in screen px and is VIEW-ONLY — it
 * never reaches the scene, the export or any stored coordinate.
 *
 * Points handed to these functions are in screen px relative to the frame's REST origin:
 * where the frame's top-left sits at zoom 1, pan 0 (its layout position, which a CSS
 * transform does not move).
 */

export interface View {
  zoom: number;
  panX: number;
  panY: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface ZoomLimits {
  min: number;
  max: number;
}

export const IDENTITY_VIEW: View = { zoom: 1, panX: 0, panY: 0 };

/** The canvas zoom range: wider than the classic editor's 0.5–3 so the content box fits. */
export const CANVAS_ZOOM: ZoomLimits = { min: 0.25, max: 3 };

/** The classic +/- buttons step the zoom by this much. */
export const ZOOM_STEP = 0.25;

/** How many px of the content must stay on screen, so the canvas can never be lost. */
export const PAN_KEEP_PX = 64;

/** Wheel sensitivity: `exp(-deltaY * k)` is the zoom factor of one event (the existing 0.0015). */
const WHEEL_ZOOM_K = 0.0015;
/** A line-mode wheel (some mice) reports lines, not pixels. */
const LINE_PX = 16;

export const isIdentityView = (v: View): boolean => v.zoom === 1 && v.panX === 0 && v.panY === 0;

export function clampZoom(zoom: number, limits: ZoomLimits = CANVAS_ZOOM): number {
  return Math.min(limits.max, Math.max(limits.min, zoom));
}

/**
 * Zoom to `nextZoom` (clamped) keeping `anchor` — a point in px relative to the rest
 * origin — under the same screen position: the pointer stays on the content it pointed at.
 */
export function zoomAt(
  view: View,
  anchor: Point,
  nextZoom: number,
  limits: ZoomLimits = CANVAS_ZOOM,
): View {
  const zoom = clampZoom(nextZoom, limits);
  const k = zoom / view.zoom;
  return {
    zoom,
    panX: anchor.x - (anchor.x - view.panX) * k,
    panY: anchor.y - (anchor.y - view.panY) * k,
  };
}

/** Zoom by one wheel event (`deltaY` > 0 zooms out), around `anchor`. */
export function zoomByWheel(
  view: View,
  anchor: Point,
  deltaY: number,
  limits: ZoomLimits = CANVAS_ZOOM,
): View {
  return zoomAt(view, anchor, view.zoom * Math.exp(-deltaY * WHEEL_ZOOM_K), limits);
}

/** Move the view by `dx`, `dy` screen px (a drag: the content follows the pointer). */
export function panBy(view: View, dx: number, dy: number): View {
  return { ...view, panX: view.panX + dx, panY: view.panY + dy };
}

/** A wheel event's delta in px, whatever its `deltaMode` (0 = px, 1 = lines, 2 = pages). */
export function wheelPx(
  e: { deltaX: number; deltaY: number; deltaMode: number },
  pageSize: Size,
): Point {
  if (e.deltaMode === 1) return { x: e.deltaX * LINE_PX, y: e.deltaY * LINE_PX };
  if (e.deltaMode === 2) return { x: e.deltaX * pageSize.w, y: e.deltaY * pageSize.h };
  return { x: e.deltaX, y: e.deltaY };
}

/** Pan by a wheel / two-finger scroll: scrolling down moves the content up. */
export function panByWheel(view: View, deltaX: number, deltaY: number): View {
  return panBy(view, -deltaX, -deltaY);
}

export interface PanBounds {
  /** The visible area, px. */
  viewport: Size;
  /** The frame's rest origin in the viewport, px. */
  origin: Point;
  /** The frame's UNSCALED size, px. */
  content: Size;
}

/**
 * Keep at least `keep` px of the content (or all of it, if smaller) inside the viewport
 * on each axis, so a fling can never push the canvas out of reach. An unmeasured bounds
 * (no size yet, e.g. before first layout) leaves the view as is.
 */
export function clampPan(view: View, b: PanBounds, keep: number = PAN_KEEP_PX): View {
  if (b.viewport.w <= 0 || b.viewport.h <= 0 || b.content.w <= 0 || b.content.h <= 0) return view;
  const axis = (pan: number, origin: number, content: number, viewport: number): number => {
    const scaled = content * view.zoom;
    const k = Math.min(keep, scaled);
    const min = k - scaled - origin; // content's far edge no further left than `k`
    const max = viewport - k - origin; // content's near edge no further right than `viewport - k`
    return Math.min(max, Math.max(min, pan));
  };
  return {
    ...view,
    panX: axis(view.panX, b.origin.x, b.content.w, b.viewport.w),
    panY: axis(view.panY, b.origin.y, b.content.h, b.viewport.h),
  };
}

/** How far the content box sticks out past each side of the shot, in layout px. */
export interface Insets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The pan that keeps the SHOT at the same screen position when the extents change.
 *
 * The frame is centred in the canvas and holds the shot at `extent.left` / `extent.top`
 * from its own top-left, so growing an extent moves the shot two ways: the frame's rest
 * origin moves by -(Δleft + Δright) / 2 (still centred, now wider), and the shot sits
 * `Δleft` further into the frame, which the zoom magnifies. Cancelling both:
 * `Δpan = (Δleft + Δright) / 2 - zoom · Δleft` (same on y with top / bottom). Growing the
 * right extent by 200 px at zoom 1 therefore pans +100 px, undoing the 100 px slide left.
 */
export function compensateExtents(view: View, prev: Insets, next: Insets): View {
  const dl = next.left - prev.left;
  const dr = next.right - prev.right;
  const dt = next.top - prev.top;
  const db = next.bottom - prev.bottom;
  if (dl === 0 && dr === 0 && dt === 0 && db === 0) return view;
  return {
    ...view,
    panX: view.panX + (dl + dr) / 2 - view.zoom * dl,
    panY: view.panY + (dt + db) / 2 - view.zoom * dt,
  };
}

/** The CSS transform for a view, or undefined for the identity (no transform at all). */
export function viewTransform(view: View): string | undefined {
  if (isIdentityView(view)) return undefined;
  if (view.panX === 0 && view.panY === 0) return `scale(${view.zoom})`;
  return `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`;
}

/** The dot grid's spacing at zoom 1, in layout px (Excalidraw-like density). */
export const DOT_SPACING = 24;

/** On-screen spacing bounds: zoomed out the dots thin out, zoomed in they fill in. */
const DOT_MIN = 16;
const DOT_MAX = 48;

/** The dot grid as CSS background values: the tile size and the tile offset, in screen px. */
export interface DotGrid {
  size: number;
  x: number;
  y: number;
}

/**
 * The canvas's dot grid for a view. The dots are pinned to the shot: one sits on the
 * shot's top-left corner (`anchor`, in px from the frame's top-left, unscaled), and they
 * pan and zoom with it. The on-screen spacing stays inside 16–48 px by doubling or halving
 * the spacing in world px, so every dot shown is still a world point and none slides.
 *
 * `origin` is the frame's rest origin in the canvas element. The background tile draws its
 * dot in the tile's centre, so the offset is shifted back by half a tile.
 */
export function dotGrid(view: View, origin: Point, anchor: Point): DotGrid {
  let size = DOT_SPACING * view.zoom;
  while (size < DOT_MIN) size *= 2;
  while (size > DOT_MAX) size /= 2;
  const at = (o: number, pan: number, a: number): number => {
    const p = o + pan + a * view.zoom - size / 2;
    return ((p % size) + size) % size;
  };
  return {
    size,
    x: at(origin.x, view.panX, anchor.x),
    y: at(origin.y, view.panY, anchor.y),
  };
}
