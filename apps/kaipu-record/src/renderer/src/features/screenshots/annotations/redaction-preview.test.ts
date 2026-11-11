import { describe, expect, it } from "vitest";
import { naturalRect } from "./redaction-preview";

describe("naturalRect", () => {
  it("maps a normalized rect to natural px with the bake's rounding", () => {
    expect(naturalRect({ x: 0.1, y: 0.25, w: 0.25, h: 0.125 }, 200, 100)).toEqual({
      x: 20,
      y: 25,
      w: 50,
      h: 13,
    });
  });

  it("clips a rect that sticks out of the image", () => {
    expect(naturalRect({ x: -0.5, y: 0.5, w: 1, h: 1 }, 100, 100)).toEqual({
      x: 0,
      y: 50,
      w: 50,
      h: 50,
    });
  });

  it("is null when the rect is entirely outside the image", () => {
    expect(naturalRect({ x: 1.2, y: 0, w: 0.3, h: 0.3 }, 100, 100)).toBeNull();
  });
});
