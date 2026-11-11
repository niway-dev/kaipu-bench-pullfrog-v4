import { describe, expect, it } from "vitest";
import {
  CANVAS_ZOOM,
  IDENTITY_VIEW,
  clampPan,
  clampZoom,
  isIdentityView,
  panBy,
  panByWheel,
  viewTransform,
  wheelPx,
  zoomAt,
  zoomByWheel,
  type View,
} from "./viewport";

/** Where a content-local point lands on screen (relative to the rest origin). */
const screenOf = (v: View, local: { x: number; y: number }) => ({
  x: v.panX + local.x * v.zoom,
  y: v.panY + local.y * v.zoom,
});
/** The content-local point under a screen position. */
const localAt = (v: View, p: { x: number; y: number }) => ({
  x: (p.x - v.panX) / v.zoom,
  y: (p.y - v.panY) / v.zoom,
});

describe("zoomAt", () => {
  it("keeps the point under the pointer fixed", () => {
    const view: View = { zoom: 1.5, panX: 40, panY: -25 };
    const pointer = { x: 300, y: 180 };
    const before = localAt(view, pointer);
    const next = zoomAt(view, pointer, 2.4);
    expect(next.zoom).toBe(2.4);
    const after = localAt(next, pointer);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
    expect(screenOf(next, before).x).toBeCloseTo(pointer.x, 9);
  });

  it("zooming at the rest origin only changes the scale", () => {
    expect(zoomAt(IDENTITY_VIEW, { x: 0, y: 0 }, 2)).toEqual({ zoom: 2, panX: 0, panY: 0 });
  });

  it("clamps to the limits and keeps the anchor fixed at the clamp too", () => {
    const pointer = { x: 120, y: 80 };
    const out = zoomAt(IDENTITY_VIEW, pointer, 0.01);
    expect(out.zoom).toBe(CANVAS_ZOOM.min);
    const local = localAt(IDENTITY_VIEW, pointer);
    expect(screenOf(out, local).x).toBeCloseTo(pointer.x, 9);
    expect(zoomAt(IDENTITY_VIEW, pointer, 99).zoom).toBe(CANVAS_ZOOM.max);
  });

  it("at the limit a further zoom is a no-op (no drift)", () => {
    const atMax = zoomAt(IDENTITY_VIEW, { x: 50, y: 50 }, 3);
    expect(zoomAt(atMax, { x: 200, y: 10 }, 5)).toEqual(atMax);
  });
});

describe("zoomByWheel", () => {
  it("scrolling up (negative deltaY) zooms in, down zooms out, around the pointer", () => {
    const pointer = { x: 90, y: 60 };
    const inView = zoomByWheel(IDENTITY_VIEW, pointer, -100);
    const outView = zoomByWheel(IDENTITY_VIEW, pointer, 100);
    expect(inView.zoom).toBeGreaterThan(1);
    expect(outView.zoom).toBeLessThan(1);
    expect(localAt(inView, pointer).x).toBeCloseTo(pointer.x, 9);
  });
});

describe("clampZoom", () => {
  it("defaults to the canvas range 0.25–3", () => {
    expect(clampZoom(0.1)).toBe(0.25);
    expect(clampZoom(5)).toBe(3);
    expect(clampZoom(1.2)).toBe(1.2);
  });
});

describe("pan", () => {
  it("panBy moves the view by the drag delta", () => {
    expect(panBy({ zoom: 2, panX: 10, panY: 20 }, 5, -8)).toEqual({ zoom: 2, panX: 15, panY: 12 });
  });

  it("a wheel / two-finger scroll moves the content opposite to the delta", () => {
    expect(panByWheel(IDENTITY_VIEW, 12, 40)).toEqual({ zoom: 1, panX: -12, panY: -40 });
  });

  it("wheelPx converts line and page deltas to px", () => {
    expect(wheelPx({ deltaX: 0, deltaY: 3, deltaMode: 1 }, { w: 800, h: 600 })).toEqual({
      x: 0,
      y: 48,
    });
    expect(wheelPx({ deltaX: 1, deltaY: 1, deltaMode: 2 }, { w: 800, h: 600 })).toEqual({
      x: 800,
      y: 600,
    });
    expect(wheelPx({ deltaX: 7, deltaY: 9, deltaMode: 0 }, { w: 800, h: 600 })).toEqual({
      x: 7,
      y: 9,
    });
  });
});

describe("clampPan", () => {
  const bounds = {
    viewport: { w: 1000, h: 800 },
    origin: { x: 100, y: 50 },
    content: { w: 600, h: 400 },
  };

  it("leaves a pan that keeps the content on screen alone", () => {
    const v: View = { zoom: 1, panX: 200, panY: 100 };
    expect(clampPan(v, bounds)).toEqual(v);
  });

  it("stops a fling to the right at `keep` px of content visible", () => {
    const out = clampPan({ zoom: 1, panX: 5000, panY: 0 }, bounds, 64);
    // content's near edge (origin + pan) at viewport.w - keep
    expect(bounds.origin.x + out.panX).toBe(1000 - 64);
  });

  it("stops a fling to the left at `keep` px of content visible", () => {
    const out = clampPan({ zoom: 1, panX: -5000, panY: 0 }, bounds, 64);
    // content's far edge (origin + pan + width) at `keep`
    expect(bounds.origin.x + out.panX + 600).toBe(64);
  });

  it("uses the scaled content size", () => {
    const out = clampPan({ zoom: 2, panX: -5000, panY: -5000 }, bounds, 64);
    expect(bounds.origin.x + out.panX + 600 * 2).toBe(64);
    expect(bounds.origin.y + out.panY + 400 * 2).toBe(64);
  });

  it("zoomed out far enough to be smaller than `keep`, all of it stays visible", () => {
    const out = clampPan({ zoom: 0.1, panX: 99999, panY: 0 }, bounds, 64);
    const scaled = 600 * 0.1; // 60 < keep
    expect(bounds.origin.x + out.panX).toBe(1000 - scaled);
  });

  it("leaves the view alone while nothing is measured", () => {
    const v: View = { zoom: 1, panX: 9999, panY: 9999 };
    expect(clampPan(v, { ...bounds, content: { w: 0, h: 0 } })).toBe(v);
    expect(clampPan(v, { ...bounds, viewport: { w: 0, h: 0 } })).toBe(v);
  });
});

describe("viewTransform", () => {
  it("is undefined for the identity, scale-only without pan, else translate + scale", () => {
    expect(isIdentityView(IDENTITY_VIEW)).toBe(true);
    expect(viewTransform(IDENTITY_VIEW)).toBeUndefined();
    expect(viewTransform({ zoom: 2, panX: 0, panY: 0 })).toBe("scale(2)");
    expect(viewTransform({ zoom: 0.5, panX: 10, panY: -4 })).toBe(
      "translate(10px, -4px) scale(0.5)",
    );
  });
});
