import { describe, expect, it } from "vitest";
import { locatedColor, tagPlacement } from "./locate-tag";
import type { ColorAnalysis } from "./histogram";

const analysis = {
  width: 100,
  height: 100,
  counted: 10000,
  distinct: 2,
  totalGroups: 2,
  groups: [
    { id: 0, rgb: 0xffffff, count: 9000, distinct: 1, members: [{ rgb: 0xffffff, count: 9000 }] },
    { id: 1, rgb: 0x111827, count: 1000, distinct: 1, members: [{ rgb: 0x111827, count: 1000 }] },
  ],
} satisfies ColorAnalysis;

describe("locatedColor", () => {
  it("is the swatch of a located group and the value of a located color", () => {
    expect(locatedColor(analysis, { kind: "group", id: 1 })).toBe(0x111827);
    expect(locatedColor(analysis, { kind: "color", rgb: 0xfdfdfd })).toBe(0xfdfdfd);
  });

  it("is null with nothing located, no analysis, or a group that does not exist", () => {
    expect(locatedColor(analysis, null)).toBeNull();
    expect(locatedColor(null, { kind: "group", id: 0 })).toBeNull();
    expect(locatedColor(analysis, { kind: "group", id: 7 })).toBeNull();
  });
});

describe("tagPlacement", () => {
  it("centers the tag under the area, as a percentage of the image", () => {
    expect(tagPlacement({ x: 10, y: 20, w: 40, h: 20 }, 100, 200)).toEqual({
      left: 30,
      top: 20,
      above: false,
    });
  });

  it("puts the tag above an area that touches the bottom edge, so it stays on the image", () => {
    const placed = tagPlacement({ x: 10, y: 90, w: 40, h: 10 }, 100, 100);
    expect(placed.above).toBe(true);
    expect(placed.top).toBe(90);
  });

  it("keeps the center away from the sides so the label is not cut in half", () => {
    expect(tagPlacement({ x: 0, y: 0, w: 2, h: 2 }, 100, 100).left).toBe(10);
    expect(tagPlacement({ x: 98, y: 0, w: 2, h: 2 }, 100, 100).left).toBe(90);
  });
});
