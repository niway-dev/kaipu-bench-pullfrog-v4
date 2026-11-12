import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { MOCK_SHOT_SIZE, redactionPng, stepSizesPng } from "./mock-shots";

/** The RGB of one pixel of an 8-bit RGB PNG with no filtering, as `paintPng` writes it. */
function pixel(png: Buffer, x: number, y: number): number[] {
  const width = png.readUInt32BE(16);
  const idatAt = png.indexOf("IDAT") + 4;
  const raw = inflateSync(png.subarray(idatAt, png.indexOf("IEND") - 4));
  const at = y * (width * 3 + 1) + 1 + x * 3;
  return [raw[at]!, raw[at + 1]!, raw[at + 2]!];
}

describe("mock shots", () => {
  it("stepSizesPng is dark on top and light below", () => {
    const png = stepSizesPng();
    expect(png.readUInt32BE(16)).toBe(MOCK_SHOT_SIZE.width);
    expect(png.readUInt32BE(20)).toBe(MOCK_SHOT_SIZE.height);
    expect(pixel(png, 800, 250)[0]).toBeLessThan(80);
    expect(pixel(png, 800, 750)[0]).toBeGreaterThan(200);
  });

  it("redactionPng draws ink where the redactions go and light paper between the columns", () => {
    const png = redactionPng();
    expect(pixel(png, 170, 310)[0]).toBeLessThan(130);
    expect(pixel(png, 800, 310)[0]).toBeGreaterThan(200);
  });
});
