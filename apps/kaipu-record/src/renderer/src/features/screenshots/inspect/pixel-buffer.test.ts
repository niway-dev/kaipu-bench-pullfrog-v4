import { describe, expect, it } from "vitest";
import { p3ToSrgb } from "./color";
import {
  clientToImagePixel,
  isPointVisible,
  loupePixels,
  readProbe,
  sampleAt,
  type PixelBuffer,
  type ProbeTile,
} from "./pixel-buffer";

/** 3x2 image: pixel (x, y) has r = 10x, g = 10y, b = 5, a = 255. */
function buffer(): PixelBuffer {
  const width = 3;
  const height = 2;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set([10 * x, 10 * y, 5, 255], (y * width + x) * 4);
  }
  return { width, height, data };
}

describe("sampleAt", () => {
  it("reads inside the image and returns null outside it", () => {
    const buf = buffer();
    expect(sampleAt(buf, 2, 1)).toEqual({ r: 20, g: 10, b: 5, a: 255 });
    expect(sampleAt(buf, -1, 0)).toBeNull();
    expect(sampleAt(buf, 0, -1)).toBeNull();
    expect(sampleAt(buf, 3, 0)).toBeNull();
    expect(sampleAt(buf, 0, 2)).toBeNull();
  });
});

describe("loupePixels", () => {
  it("is (2r+1)^2 RGBA pixels with the centre in the middle", () => {
    const out = loupePixels(buffer(), 1, 1, 2);
    expect(out).toHaveLength(5 * 5 * 4);
    const centre = (2 * 5 + 2) * 4;
    expect(Array.from(out.slice(centre, centre + 4))).toEqual([10, 10, 5, 255]);
  });

  it("leaves pixels outside the image fully transparent", () => {
    const out = loupePixels(buffer(), 0, 0, 1); // 3x3 around the top-left corner
    const px = (col: number, row: number) =>
      Array.from(out.slice((row * 3 + col) * 4, (row * 3 + col) * 4 + 4));
    expect(px(0, 0)).toEqual([0, 0, 0, 0]); // (-1,-1)
    expect(px(1, 0)).toEqual([0, 0, 0, 0]); // (0,-1)
    expect(px(0, 1)).toEqual([0, 0, 0, 0]); // (-1,0)
    expect(px(1, 1)).toEqual([0, 0, 5, 255]); // centre (0,0)
    expect(px(2, 1)).toEqual([10, 0, 5, 255]); // (1,0)
  });
});

describe("clientToImagePixel", () => {
  const img = { width: 100, height: 50 };

  it("maps the displayed rect to image pixels with floor", () => {
    const rect = { left: 10, top: 20, width: 100, height: 50 };
    expect(clientToImagePixel(10, 20, rect, img)).toEqual({ x: 0, y: 0 });
    expect(clientToImagePixel(59.9, 44.9, rect, img)).toEqual({ x: 49, y: 24 });
    expect(clientToImagePixel(109.9, 69.9, rect, img)).toEqual({ x: 99, y: 49 });
  });

  it("returns the same image pixel for the same point of the picture at any zoom", () => {
    const at1 = { left: 0, top: 0, width: 100, height: 50 };
    const at2 = { left: 30, top: -10, width: 200, height: 100 }; // zoomed 2x and panned
    const atHalf = { left: 5, top: 5, width: 50, height: 25 };
    // The centre of the picture, in each rect's own coordinates.
    const centre = (r: typeof at1) =>
      clientToImagePixel(r.left + r.width / 2, r.top + r.height / 2, r, img);
    expect(centre(at1)).toEqual({ x: 50, y: 25 });
    expect(centre(at2)).toEqual({ x: 50, y: 25 });
    expect(centre(atHalf)).toEqual({ x: 50, y: 25 });
  });

  it("is null outside the rect, including its far edge", () => {
    const rect = { left: 0, top: 0, width: 100, height: 50 };
    expect(clientToImagePixel(-1, 10, rect, img)).toBeNull();
    expect(clientToImagePixel(10, -1, rect, img)).toBeNull();
    expect(clientToImagePixel(100, 10, rect, img)).toBeNull();
    expect(clientToImagePixel(10, 50, rect, img)).toBeNull();
    expect(clientToImagePixel(10, 10, { ...rect, width: 0 }, img)).toBeNull();
  });
});

describe("readProbe", () => {
  // A 2x2 tile whose top-left is image pixel (5, 7); its second pixel is P3 pure red.
  const tile: ProbeTile = {
    sx: 5,
    sy: 7,
    sw: 2,
    sh: 2,
    raw: new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 255]),
    p3: new Uint8ClampedArray([
      255, 255, 255, 255, 255, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255,
    ]),
  };

  it("returns the raw bytes and the gamut verdict of a pixel inside the tile", () => {
    expect(p3ToSrgb([255, 0, 0]).outOfGamut).toBe(true);
    expect(readProbe(tile, 5, 7)).toEqual({ raw: { r: 1, g: 2, b: 3, a: 255 }, outOfGamut: false });
    expect(readProbe(tile, 6, 7)).toEqual({ raw: { r: 4, g: 5, b: 6, a: 255 }, outOfGamut: true });
    expect(readProbe(tile, 5, 8)?.raw).toEqual({ r: 7, g: 8, b: 9, a: 255 });
  });

  it("is null outside the tile", () => {
    expect(readProbe(tile, 4, 7)).toBeNull();
    expect(readProbe(tile, 7, 7)).toBeNull();
    expect(readProbe(tile, 5, 9)).toBeNull();
    expect(readProbe(tile, 5, 6)).toBeNull();
  });
});

describe("isPointVisible", () => {
  const rect = (left: number, top: number, w: number, h: number): DOMRect =>
    ({ left, top, right: left + w, bottom: top + h, width: w, height: h }) as DOMRect;

  it("is false outside a clipping ancestor (a classic crop window) and true inside it", () => {
    const clip = document.createElement("div");
    clip.style.overflow = "hidden";
    clip.getBoundingClientRect = () => rect(100, 100, 50, 50);
    const img = document.createElement("img");
    clip.appendChild(img);
    document.body.appendChild(clip);
    expect(isPointVisible(img, 120, 120)).toBe(true);
    expect(isPointVisible(img, 160, 120)).toBe(false);
    clip.remove();
  });

  it("ignores ancestors that do not clip", () => {
    const wrap = document.createElement("div");
    wrap.getBoundingClientRect = () => rect(0, 0, 10, 10);
    const img = document.createElement("img");
    wrap.appendChild(img);
    document.body.appendChild(wrap);
    expect(isPointVisible(img, 500, 500)).toBe(true);
    wrap.remove();
  });
});
