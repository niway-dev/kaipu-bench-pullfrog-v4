import { describe, expect, it } from "vitest";
import type { RecognizedWord } from "@kaipu/domain/schemas";
import { distinctLineCount, lineBoxesNorm } from "./lines";

const word = (line: number, x: number, y: number, w = 10, h = 10): RecognizedWord => ({
  text: "w",
  line,
  rect: { x, y, w, h },
  confidence: 1,
});

describe("distinctLineCount", () => {
  it("counts lines, not words", () => {
    expect(distinctLineCount([word(0, 0, 0), word(0, 20, 0), word(1, 0, 20)])).toBe(2);
  });
  it("is 0 for no words", () => {
    expect(distinctLineCount([])).toBe(0);
  });
});

describe("lineBoxesNorm", () => {
  it("unions the words of a line and normalizes by the image size", () => {
    const boxes = lineBoxesNorm([word(1, 50, 40, 10, 10), word(1, 20, 38, 10, 14)], {
      w: 100,
      h: 200,
    });
    expect(boxes).toHaveLength(1);
    expect(boxes[0].line).toBe(1);
    expect(boxes[0].box.x).toBeCloseTo(0.2);
    expect(boxes[0].box.y).toBeCloseTo(0.19);
    expect(boxes[0].box.w).toBeCloseTo(0.4);
    expect(boxes[0].box.h).toBeCloseTo(0.07);
  });
  it("returns lines in order", () => {
    const boxes = lineBoxesNorm([word(2, 0, 40), word(0, 0, 0)], { w: 100, h: 100 });
    expect(boxes.map((b) => b.line)).toEqual([0, 2]);
  });
});
