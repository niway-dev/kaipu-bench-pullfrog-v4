import { describe, expect, it } from "vitest";
import {
  REDACTION_MIN_BLOCK_PX,
  REDACTION_SOLID_RGB,
  bakeRedactions,
  redactRegion,
  redactionBlockSize,
  type PixelRegion,
} from "./redaction";
import type { Annotation } from "./scene";

function region(
  width: number,
  height: number,
  fn: (x: number, y: number) => number[],
): PixelRegion {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set(fn(x, y), (y * width + x) * 4);
  }
  return { data, width, height };
}

describe("redactionBlockSize", () => {
  it("is at least 24 px and at least a quarter of the region's shorter side", () => {
    expect(REDACTION_MIN_BLOCK_PX).toBe(24);
    expect(redactionBlockSize(40, 400)).toBe(24);
    expect(redactionBlockSize(200, 400)).toBe(50);
    expect(redactionBlockSize(10, 10)).toBe(24);
    expect(redactionBlockSize(401, 900)).toBe(101);
  });
});

describe("redactRegion", () => {
  it("solid fills every pixel exactly, opaque", () => {
    const r = region(7, 5, (x, y) => [x, y, 9, 3]);
    redactRegion(r, "solid");
    for (let i = 0; i < r.data.length; i += 4) {
      expect([r.data[i], r.data[i + 1], r.data[i + 2], r.data[i + 3]]).toEqual([
        ...REDACTION_SOLID_RGB,
        255,
      ]);
    }
  });

  it("turns a region smaller than one block uniform", () => {
    const r = region(10, 10, (x, y) => [x * 20, y * 20, (x + y) * 5, 255]);
    redactRegion(r, "blur");
    for (let i = 4; i < r.data.length; i += 4) {
      expect(r.data.slice(i, i + 4)).toEqual(r.data.slice(0, 4));
    }
  });

  it("changes every pixel of a checkerboard whose block averages differ from it", () => {
    const r = region(96, 96, (x, y) => ((x + y) % 2 === 0 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    const before = new Uint8ClampedArray(r.data);
    redactRegion(r, "blur");
    for (let i = 0; i < r.data.length; i += 4) {
      expect(r.data[i]).not.toBe(before[i]);
    }
  });

  it("depends only on the block averages: permuting pixels inside each block changes nothing", () => {
    const w = 100;
    const h = 60; // block = 24: edge blocks are smaller
    const a = region(w, h, (x, y) => [
      (x * 7 + y * 3) % 256,
      (x * y) % 256,
      (x + 2 * y) % 256,
      255,
    ]);
    const b: PixelRegion = { data: new Uint8ClampedArray(a.data), width: w, height: h };
    const block = redactionBlockSize(w, h);
    // Reverse the pixel order inside every block row-wise and column-wise.
    for (let by = 0; by < h; by += block) {
      for (let bx = 0; bx < w; bx += block) {
        const x1 = Math.min(bx + block, w);
        const y1 = Math.min(by + block, h);
        const px: number[][] = [];
        for (let y = by; y < y1; y++)
          for (let x = bx; x < x1; x++)
            px.push(Array.from(a.data.slice((y * w + x) * 4, (y * w + x) * 4 + 4)));
        px.reverse();
        let k = 0;
        for (let y = by; y < y1; y++)
          for (let x = bx; x < x1; x++) b.data.set(px[k++], (y * w + x) * 4);
      }
    }
    expect(b.data).not.toEqual(a.data);
    redactRegion(a, "blur");
    redactRegion(b, "blur");
    expect(b.data).toEqual(a.data);
  });
});

describe("bakeRedactions", () => {
  it("returns the same bytes object when there is nothing to redact", async () => {
    const bytes = new ArrayBuffer(8);
    const other: Annotation = {
      id: "a1",
      kind: "box",
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      color: "#fff",
      stroke: 2,
      seed: 1,
    };
    const locked: Annotation = { id: "a2", kind: "blur", x: 0, y: 0, w: 1, h: 1, locked: true };
    expect(await bakeRedactions(bytes, [])).toBe(bytes);
    expect(await bakeRedactions(bytes, [other, locked])).toBe(bytes);
  });
});
