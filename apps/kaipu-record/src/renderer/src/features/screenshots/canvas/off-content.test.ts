import { describe, expect, it } from "vitest";
import { contentDirection, offContentDirection, visibleFraction } from "./off-content";

const stage = { w: 1000, h: 600 };
const rect = (x: number, y: number, w = 400, h = 200) => ({ x, y, w, h });

describe("visibleFraction", () => {
  it("is 1 for a box fully inside the stage", () => {
    expect(visibleFraction(stage, rect(100, 100))).toBe(1);
  });

  it("is 0 for a box fully outside", () => {
    expect(visibleFraction(stage, rect(1200, 100))).toBe(0);
  });

  it("is the share of the box's area that is inside", () => {
    // 100 of 400 px of width are inside the stage's left edge.
    expect(visibleFraction(stage, rect(-300, 100))).toBeCloseTo(0.25);
    // A corner: half of the width and half of the height are inside.
    expect(visibleFraction(stage, rect(800, 500, 400, 200))).toBeCloseTo((200 / 400) * (100 / 200));
  });

  it("treats a box with no area as visible, so no notice shows for nothing", () => {
    expect(visibleFraction(stage, rect(5000, 5000, 0, 0))).toBe(1);
  });
});

describe("contentDirection", () => {
  // The stage centre is (500, 300).
  it.each([
    ["up", rect(300, -800)],
    ["down", rect(300, 900)],
    ["left", rect(-900, 200)],
    ["right", rect(1500, 200)],
    ["upLeft", rect(-900, -800)],
    ["upRight", rect(1500, -800)],
    ["downLeft", rect(-900, 900)],
    ["downRight", rect(1500, 900)],
  ] as const)("%s", (direction, r) => {
    expect(contentDirection(stage, r)).toBe(direction);
  });

  it("calls a mostly-vertical offset up or down, not diagonal", () => {
    // The centre is 1400 above and 100 to the right of the stage centre: about 4.1 degrees off vertical.
    expect(contentDirection(stage, rect(400, -1200, 400, 200))).toBe("up");
  });

  it("is null when the stage centre is inside the box (you are looking at it)", () => {
    expect(contentDirection(stage, rect(-5000, -5000, 10000, 10000))).toBeNull();
  });
});

describe("offContentDirection", () => {
  it("is null while at least half of the box is visible", () => {
    expect(offContentDirection(stage, rect(-150, 100))).toBeNull(); // 62.5% visible
    expect(offContentDirection(stage, rect(-200, 100))).toBeNull(); // exactly half
  });

  it("names the direction once less than half is visible", () => {
    expect(offContentDirection(stage, rect(-250, 100))).toBe("left");
    expect(offContentDirection(stage, rect(-900, -800))).toBe("upLeft");
  });

  it("stays quiet when zoomed in on the content, even though most of it is out of view", () => {
    expect(offContentDirection(stage, rect(-3000, -2000, 8000, 5000))).toBeNull();
  });
});
