import { describe, expect, it } from "vitest";
import { gapMeasures, type WorldRect } from "./image-gap";

const r = (x: number, y: number, w: number, h: number): WorldRect => ({ x, y, w, h });

describe("gapMeasures", () => {
  it("measures the gap to a neighbour on the left that overlaps on the vertical axis", () => {
    const m = gapMeasures(r(300, 0, 100, 100), [r(0, 0, 200, 100)]);
    expect(m).toEqual([{ axis: "x", from: 200, to: 300, at: 50, px: 100 }]);
  });

  it("measures a neighbour on the right the same way", () => {
    const m = gapMeasures(r(0, 20, 100, 100), [r(150, 0, 100, 60)]);
    expect(m).toEqual([{ axis: "x", from: 100, to: 150, at: 40, px: 50 }]);
  });

  it("measures vertically for a neighbour above or below", () => {
    const m = gapMeasures(r(0, 200, 100, 100), [r(20, 0, 100, 150)]);
    expect(m).toEqual([{ axis: "y", from: 150, to: 200, at: 60, px: 50 }]);
  });

  it("draws nothing for a neighbour that does not overlap on the perpendicular axis", () => {
    expect(gapMeasures(r(300, 500, 100, 100), [r(0, 0, 200, 100)])).toEqual([]);
  });

  it("keeps only the nearest neighbour on an axis", () => {
    const m = gapMeasures(r(500, 0, 100, 100), [r(0, 0, 100, 100), r(300, 0, 100, 100)]);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ axis: "x", from: 400, to: 500, px: 100 });
  });

  it("picks the nearest across both sides of the selection", () => {
    const m = gapMeasures(r(200, 0, 100, 100), [r(0, 0, 100, 100), r(340, 0, 100, 100)]);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ axis: "x", from: 300, to: 340, px: 40 });
  });

  it("hides the measure when the images touch", () => {
    expect(gapMeasures(r(200, 0, 100, 100), [r(0, 0, 200, 100)])).toEqual([]);
  });

  it("hides the measure when the images overlap, and a farther image does not take over", () => {
    const m = gapMeasures(r(150, 0, 100, 100), [r(0, 0, 200, 100), r(600, 0, 100, 100)]);
    expect(m).toEqual([]);
  });

  it("can show one measure per axis", () => {
    const m = gapMeasures(r(300, 300, 100, 100), [r(0, 300, 200, 100), r(300, 0, 100, 200)]);
    expect(m.map((g) => [g.axis, g.px]).sort()).toEqual([
      ["x", 100],
      ["y", 100],
    ]);
  });

  it("rounds the label to whole pixels and hides a gap under half a pixel", () => {
    expect(gapMeasures(r(300.4, 0, 100, 100), [r(0, 0, 200, 100)])[0]?.px).toBe(100);
    expect(gapMeasures(r(200.4, 0, 100, 100), [r(0, 0, 200, 100)])).toEqual([]);
  });
});
