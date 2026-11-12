import { describe, expect, it } from "vitest";
import { worldToFrame, type CanvasGeom } from "../annotations/canvas-geometry";
import { contentBoxFrame } from "./content-box";

const geom = (extents = { left: 0, top: 0, right: 0, bottom: 0 }, pad = 0): CanvasGeom => ({
  naturalW: 200,
  naturalH: 100,
  pad,
  extents,
});

describe("contentBoxFrame", () => {
  it("is the whole image when nothing sticks out", () => {
    expect(contentBoxFrame(geom())).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it("covers the image plus what sticks out, in world units relative to the image", () => {
    const f = contentBoxFrame(geom({ left: 20, top: 10, right: 100, bottom: 0 }));
    expect(f.x).toBeCloseTo(-0.1);
    expect(f.y).toBeCloseTo(-0.1);
    expect(f.w).toBeCloseTo(1.6);
    expect(f.h).toBeCloseTo(1.1);
  });

  it("leaves the beautify padding out: it frames the content, not the background", () => {
    const g = geom({ left: 20, top: 0, right: 0, bottom: 0 }, 30);
    const inFrame = worldToFrame(contentBoxFrame(g), g);
    // The frame is 280 x 160 (box 220 x 100 plus 30 a side): the box starts 30 px in.
    expect(inFrame.x).toBeCloseTo(30 / 280);
    expect(inFrame.w).toBeCloseTo(220 / 280);
    expect(inFrame.y).toBeCloseTo(30 / 160);
    expect(inFrame.h).toBeCloseTo(100 / 160);
  });
});
