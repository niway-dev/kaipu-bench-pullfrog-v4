import { describe, expect, it } from "vitest";
import { backgroundCss } from "../../screenshots/beautify/backgrounds";
import { backgroundFrame, DEFAULT_BACKGROUND, type VideoBackground } from "../background";
import { previewBackgroundStyle } from "./preview-background";

const MAGENTA: VideoBackground = { bg: "magenta", padding: 48, radius: 16, shadow: 24 };

/** `12.5px` → 12.5 */
const px = (value: unknown): number => parseFloat(String(value));

describe("previewBackgroundStyle", () => {
  it("is neutral with none, whatever the stored numbers are", () => {
    for (const background of [DEFAULT_BACKGROUND, { ...MAGENTA, bg: "none" as const }]) {
      expect(previewBackgroundStyle(background, 960, 540)).toEqual({ frame: {}, picture: {} });
    }
  });

  it("is neutral until the stage has a size", () => {
    expect(previewBackgroundStyle(MAGENTA, 0, 0)).toEqual({ frame: {}, picture: {} });
  });

  it("paints the frame with the preset's own CSS", () => {
    const { frame } = previewBackgroundStyle(MAGENTA, 960, 540);
    expect((frame as Record<string, string>)["--frame-bg"]).toBe(backgroundCss("magenta"));
    expect(backgroundCss("magenta")).toBe("linear-gradient(135deg, #ff2d6e, #a3044a)");
  });

  it.each([
    [960, 540],
    [640, 360],
    [1440, 810],
    [540, 960],
    [600, 600],
  ])("uses exactly backgroundFrame's numbers at a %i×%i stage", (w, h) => {
    const { picture } = previewBackgroundStyle(MAGENTA, w, h);
    const frame = backgroundFrame(MAGENTA, w, h);
    expect(px(picture.left)).toBeCloseTo(frame.picture.x, 9);
    expect(px(picture.top)).toBeCloseTo(frame.picture.y, 9);
    expect(px(picture.width)).toBeCloseTo(frame.picture.width, 9);
    expect(px(picture.height)).toBeCloseTo(frame.picture.height, 9);
    expect(px(picture.borderRadius)).toBeCloseTo(frame.radius, 9);
    expect(picture.boxShadow).toBe(
      `0 ${frame.shadow!.offsetY}px ${frame.shadow!.blur}px rgba(0, 0, 0, ${frame.shadow!.alpha})`,
    );
  });

  it("scales the padding, radius and shadow with the stage like the export scales them with the output", () => {
    // The same background on a stage half the size is the same picture at half the numbers.
    const big = previewBackgroundStyle(MAGENTA, 1920, 1080).picture;
    const half = previewBackgroundStyle(MAGENTA, 960, 540).picture;
    expect(px(half.top) * 2).toBeCloseTo(px(big.top), 9);
    expect(px(half.width) * 2).toBeCloseTo(px(big.width), 9);
    expect(px(half.borderRadius) * 2).toBeCloseTo(px(big.borderRadius), 9);
  });

  it("omits the shadow at 0", () => {
    expect(previewBackgroundStyle({ ...MAGENTA, shadow: 0 }, 960, 540).picture.boxShadow).toBe(
      undefined,
    );
  });

  it("is the export's rect: the picture is the same share of the stage as of a 1920×1080 output", () => {
    const stage = previewBackgroundStyle(MAGENTA, 800, 450).picture;
    const output = backgroundFrame(MAGENTA, 1920, 1080).picture;
    expect(px(stage.width) / 800).toBeCloseTo(output.width / 1920, 9);
    expect(px(stage.left) / 800).toBeCloseTo(output.x / 1920, 9);
    expect(px(stage.top) / 450).toBeCloseTo(output.y / 1080, 9);
  });
});
