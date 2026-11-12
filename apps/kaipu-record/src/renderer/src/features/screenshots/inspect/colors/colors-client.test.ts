import { describe, expect, it } from "vitest";
import { createColorsAnalyzer } from "./colors-client";

describe("createColorsAnalyzer (inline, no Worker)", () => {
  it("forwards progress and returns areas and bounds of a located color", async () => {
    // 10x10: a 5x5 white block in the top-left corner, black elsewhere.
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = x < 5 && y < 5 ? 255 : 0;
        data.set([v, v, v, 255], (y * width + x) * 4);
      }
    }
    const progress: number[] = [];
    const analyzer = createColorsAnalyzer({ width, height, data }, (d) => progress.push(d));
    await analyzer.analysis;
    expect(progress[progress.length - 1]).toBe(1);
    const located = await analyzer.locate({ kind: "color", rgb: 0xffffff });
    expect(located.matched).toBe(25);
    expect(located.areas).toBe(1);
    expect(located.bounds).toEqual({ x: 0, y: 0, w: 5, h: 5 });
  });
});
