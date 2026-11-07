import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PADDING_RANGE,
  RADIUS_RANGE,
  SHADOW_RANGE,
  BACKGROUND_IDS,
} from "../screenshots/beautify/backgrounds";
import {
  DEFAULT_BACKGROUND,
  backgroundFrame,
  hasBackground,
  parseBackground,
  type VideoBackground,
} from "./background";

const MAGENTA: VideoBackground = { bg: "magenta", padding: 48, radius: 16, shadow: 24 };

describe("parseBackground", () => {
  it("returns the default for an absent or non-object value", () => {
    expect(parseBackground(undefined)).toEqual(DEFAULT_BACKGROUND);
    expect(parseBackground(null)).toEqual(DEFAULT_BACKGROUND);
    expect(parseBackground("magenta")).toEqual(DEFAULT_BACKGROUND);
    expect(parseBackground(7)).toEqual(DEFAULT_BACKGROUND);
    expect(parseBackground([MAGENTA])).toEqual(DEFAULT_BACKGROUND);
  });

  it("the default is none with zeros, and a fresh object each call", () => {
    expect(DEFAULT_BACKGROUND).toEqual({ bg: "none", padding: 0, radius: 0, shadow: 0 });
    expect(parseBackground(undefined)).not.toBe(DEFAULT_BACKGROUND);
  });

  it("keeps a valid background as it is", () => {
    expect(parseBackground(MAGENTA)).toEqual(MAGENTA);
  });

  it("accepts every id the screenshot editor offers and falls back to none for any other", () => {
    for (const bg of BACKGROUND_IDS) expect(parseBackground({ bg }).bg).toBe(bg);
    expect(parseBackground({ ...MAGENTA, bg: "wallpaper" }).bg).toBe("none");
    expect(parseBackground({ ...MAGENTA, bg: 3 }).bg).toBe("none");
    expect(parseBackground({ ...MAGENTA, bg: null }).bg).toBe("none");
    expect(parseBackground({ padding: 10 }).bg).toBe("none");
  });

  it("clamps each number to the screenshot editor's range", () => {
    const high = parseBackground({ bg: "ocean", padding: 500, radius: 500, shadow: 500 });
    expect(high).toEqual({
      bg: "ocean",
      padding: PADDING_RANGE.max,
      radius: RADIUS_RANGE.max,
      shadow: SHADOW_RANGE.max,
    });
    const low = parseBackground({ bg: "ocean", padding: -3, radius: -3, shadow: -3 });
    expect(low).toEqual({
      bg: "ocean",
      padding: PADDING_RANGE.min,
      radius: RADIUS_RANGE.min,
      shadow: SHADOW_RANGE.min,
    });
  });

  it("turns non-finite and wrong-typed numbers into 0, never into a range edge", () => {
    for (const bad of [Number.NaN, Infinity, -Infinity, "48", null, undefined, {}, true]) {
      expect(parseBackground({ bg: "ocean", padding: bad, radius: bad, shadow: bad })).toEqual({
        bg: "ocean",
        padding: 0,
        radius: 0,
        shadow: 0,
      });
    }
  });

  it("ignores keys it does not know", () => {
    expect(parseBackground({ ...MAGENTA, wallpaper: "x.png" })).toEqual(MAGENTA);
  });
});

describe("hasBackground", () => {
  it("is true for any preset but none", () => {
    expect(hasBackground(MAGENTA)).toBe(true);
    expect(hasBackground({ bg: "dark", padding: 0, radius: 0, shadow: 0 })).toBe(true);
  });

  it("is false for none, even with stored padding, radius and shadow", () => {
    expect(hasBackground(DEFAULT_BACKGROUND)).toBe(false);
    expect(hasBackground({ bg: "none", padding: 48, radius: 16, shadow: 24 })).toBe(false);
  });
});

describe("backgroundFrame", () => {
  it("is the whole output, with no radius and no shadow, while the background is none", () => {
    const frame = backgroundFrame({ bg: "none", padding: 48, radius: 16, shadow: 24 }, 1920, 1080);
    expect(frame.box).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    expect(frame.picture).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    expect(frame.radius).toBe(0);
    expect(frame.shadow).toBeNull();
  });

  it("insets a 1920×1080 picture by 48 px, scale 1, keeping its aspect", () => {
    const { box, picture, radius, shadow } = backgroundFrame(MAGENTA, 1920, 1080);
    expect(box).toEqual({ x: 48, y: 48, width: 1824, height: 984 });
    // The shorter axis (height) takes the 48 px margin; the picture keeps 16:9, so the side
    // margins are wider than the top and bottom ones.
    expect(picture.height).toBeCloseTo(984, 6);
    expect(picture.width).toBeCloseTo((984 * 16) / 9, 6);
    expect(picture.x).toBeCloseTo((1920 - picture.width) / 2, 6);
    expect(picture.y).toBeCloseTo(48, 6);
    expect(picture.width / picture.height).toBeCloseTo(1920 / 1080, 9);
    expect(radius).toBe(16);
    expect(shadow).toEqual({ offsetY: 10.8, blur: 29.6, alpha: 0.24 });
  });

  it("scales padding, radius and shadow by height / 1080 at 2560×1440", () => {
    const { box, picture, radius, shadow } = backgroundFrame(MAGENTA, 2560, 1440);
    const k = 1440 / 1080;
    expect(box.x).toBeCloseTo(48 * k, 6);
    expect(box.y).toBeCloseTo(48 * k, 6);
    expect(radius).toBeCloseTo(16 * k, 6);
    expect(shadow?.offsetY).toBeCloseTo(10.8 * k, 6);
    expect(shadow?.blur).toBeCloseTo(29.6 * k, 6);
    // The shadow's darkness does not scale with size.
    expect(shadow?.alpha).toBe(0.24);
    // The same proportions as 1920×1080: the picture is the same share of the output.
    const small = backgroundFrame(MAGENTA, 1920, 1080).picture;
    expect(picture.width / 2560).toBeCloseTo(small.width / 1920, 9);
    expect(picture.height / 1440).toBeCloseTo(small.height / 1080, 9);
  });

  it("insets a portrait 1080×1920 canvas by the 1080-reference padding scaled to its height", () => {
    const { box, picture } = backgroundFrame(MAGENTA, 1080, 1920);
    const pad = 48 * (1920 / 1080);
    expect(box.x).toBeCloseTo(pad, 6);
    expect(box.y).toBeCloseTo(pad, 6);
    expect(box.width).toBeCloseTo(1080 - 2 * pad, 6);
    // Portrait: the width is the tight axis, so the picture fills the box's width.
    expect(picture.width).toBeCloseTo(1080 - 2 * pad, 6);
    expect(picture.x).toBeCloseTo(pad, 6);
    expect(picture.width / picture.height).toBeCloseTo(1080 / 1920, 9);
    expect(picture.y).toBeCloseTo((1920 - picture.height) / 2, 6);
  });

  it("insets a square 1080×1080 canvas evenly", () => {
    const { box, picture } = backgroundFrame(MAGENTA, 1080, 1080);
    expect(box).toEqual({ x: 48, y: 48, width: 984, height: 984 });
    expect(picture).toEqual({ x: 48, y: 48, width: 984, height: 984 });
  });

  it("with padding 0 the picture is the whole output but the radius and shadow still apply", () => {
    const frame = backgroundFrame({ bg: "ocean", padding: 0, radius: 16, shadow: 50 }, 1920, 1080);
    expect(frame.picture).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    expect(frame.radius).toBe(16);
    expect(frame.shadow).not.toBeNull();
  });

  it("has no shadow at 0 and keeps the picture inside the output at the largest padding", () => {
    expect(backgroundFrame({ ...MAGENTA, shadow: 0 }, 1920, 1080).shadow).toBeNull();
    const max = backgroundFrame({ ...MAGENTA, padding: PADDING_RANGE.max }, 1920, 1080);
    expect(max.picture.x).toBeGreaterThan(0);
    expect(max.picture.y).toBeCloseTo(PADDING_RANGE.max, 6);
    expect(max.picture.x + max.picture.width).toBeLessThan(1920);
    expect(max.picture.y + max.picture.height).toBeLessThan(1080);
  });

  it("clamps out-of-range numbers it is handed directly", () => {
    const frame = backgroundFrame(
      { bg: "ocean", padding: 9999, radius: 9999, shadow: 9999 },
      1920,
      1080,
    );
    expect(frame.box.x).toBe(PADDING_RANGE.max);
    expect(frame.radius).toBe(RADIUS_RANGE.max);
  });
});

describe("background.ts stays worker-safe", () => {
  // The export worker bundles this module and the screenshot editor's table it reads
  // (spec decision 12). Neither may import React or touch the DOM at module scope, or the
  // preload-style failure of ADR 0038's bundle rule returns: a worker that cannot load.
  const files = [
    resolve(__dirname, "background.ts"),
    resolve(__dirname, "../screenshots/beautify/backgrounds.ts"),
  ];
  it.each(files)("%s has no React, DOM or non-relative import", (file) => {
    const source = readFileSync(file, "utf8");
    const imports = [...source.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+["']([^"']+)["']/gm)];
    for (const [, specifier] of imports) {
      expect(specifier, `${file} imports ${specifier}`).toMatch(/^\.{1,2}\//);
      expect(specifier).not.toMatch(/react|beautified-frame|beautify-panel|\.css/);
    }
    expect(source).not.toMatch(/\bdocument\./);
    expect(source).not.toMatch(/\bwindow\./);
  });
});
