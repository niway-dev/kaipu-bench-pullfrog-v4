import { describe, expect, it } from "vitest";
import { canvasExportGeometry, cropWindow, exportPixelSize, frameWindow } from "./compositor";
import type { Annotation, Scene } from "./scene";

const scene = (
  annotations: Annotation[],
  padding = 0,
  exportFrame?: Scene["exportFrame"],
): Scene => ({
  beautify: { bg: "none", padding, radius: 0, shadow: 0 },
  annotations,
  ...(exportFrame ? { exportFrame } : {}),
});
const box = (x: number, y: number, w: number, h: number): Annotation => ({
  id: "b",
  kind: "box",
  x,
  y,
  w,
  h,
  color: "#f00",
  stroke: 0,
  seed: 1,
});
const image = (x: number): Annotation => ({
  id: "i",
  kind: "image",
  assetId: "img-1",
  x,
  y: 0,
  w: 0.5,
  h: 0.5,
  pixelWidth: 100,
  pixelHeight: 50,
});

describe("exportPixelSize", () => {
  it("is the image size when nothing leaves it and there is no padding", () => {
    expect(exportPixelSize(scene([]), 1000, 600, 500)).toEqual({ w: 1000, h: 600 });
  });

  it("adds the padding, scaled from display px to source px", () => {
    // Displayed 500 px for 1000 source px: scale 2, so 20 display px of padding = 40 px a side.
    expect(exportPixelSize(scene([], 20), 1000, 600, 500)).toEqual({ w: 1080, h: 680 });
  });

  it("grows with an image added to the right", () => {
    // The added image spans x 1.2 .. 1.7 of the base width: 700 px past the base's right edge.
    expect(exportPixelSize(scene([image(1.2)]), 1000, 600, 1000)).toEqual({ w: 1700, h: 600 });
  });

  it("is the same rectangle the export computes: it is frameWindow over the shared geometry", () => {
    const s = scene([box(-0.2, 0.1, 1.5, 0.3)], 12);
    const g = canvasExportGeometry(s, 800, 400, 400);
    const win = frameWindow(s, { href: "", naturalW: 800, naturalH: 400, ...g });
    expect(exportPixelSize(s, 800, 400, 400)).toEqual({ w: win.outW, h: win.outH });
  });

  it("follows the export frame when one is set", () => {
    const s = scene([], 0, { x: 0.1, y: 0.1, w: 0.5, h: 0.25 });
    expect(exportPixelSize(s, 1000, 600, 500)).toEqual({ w: 500, h: 150 });
  });

  it("falls back to scale 1 while the displayed width is unknown", () => {
    expect(canvasExportGeometry(scene([], 10), 1000, 600, 0).scale).toBe(1);
  });
});

describe("cropWindow", () => {
  it("rounds the origin and the far edge like the export", () => {
    expect(cropWindow({ x: 0.1, y: 0.2, w: 0.5, h: 0.5 }, 1001, 999)).toEqual({
      vbX: 100,
      vbY: 200,
      outW: 501,
      outH: 499,
    });
  });
});
