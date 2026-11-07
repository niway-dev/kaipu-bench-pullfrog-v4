import { describe, expect, it } from "vitest";
import { PADDING_RANGE, RADIUS_RANGE, SHADOW_RANGE } from "../screenshots/beautify/backgrounds";
import { BACKGROUND_STARTER_LOOK } from "./background";
import { chooseBackground, updateBackground } from "./background-edits";
import { initialScene } from "./scene";

describe("updateBackground", () => {
  const scene = initialScene(10);

  it("applies a preset and leaves the numbers alone", () => {
    const next = updateBackground(scene, { bg: "magenta" });
    expect(next.background).toEqual({ bg: "magenta", padding: 0, radius: 0, shadow: 0 });
  });

  it("applies a number and leaves the rest alone", () => {
    const withBg = updateBackground(scene, { bg: "ocean" });
    expect(updateBackground(withBg, { padding: 48 }).background).toEqual({
      bg: "ocean",
      padding: 48,
      radius: 0,
      shadow: 0,
    });
  });

  it("clamps to the screenshot editor's ranges", () => {
    expect(updateBackground(scene, { padding: 999 }).background!.padding).toBe(PADDING_RANGE.max);
    expect(updateBackground(scene, { radius: 999 }).background!.radius).toBe(RADIUS_RANGE.max);
    expect(updateBackground(scene, { shadow: -1 }).background!.shadow).toBe(SHADOW_RANGE.min);
  });

  it("returns the same scene when nothing changes, so there is no undo step", () => {
    expect(updateBackground(scene, { bg: "none" })).toBe(scene);
    expect(updateBackground(scene, {})).toBe(scene);
    const set = updateBackground(scene, { bg: "magenta", padding: 48 });
    expect(updateBackground(set, { bg: "magenta" })).toBe(set);
    expect(updateBackground(set, { padding: 48 })).toBe(set);
  });

  it("treats a scene saved before backgrounds as the default", () => {
    const { background: _background, ...legacy } = scene;
    expect(updateBackground(legacy, { bg: "none" })).toBe(legacy);
    expect(updateBackground(legacy, { bg: "dark" }).background!.bg).toBe("dark");
  });

  it("keeps the numbers when the preset goes back to none, and brings them back with a preset", () => {
    const set = updateBackground(scene, { bg: "magenta", padding: 48, radius: 16, shadow: 24 });
    const none = updateBackground(set, { bg: "none" });
    expect(none.background).toEqual({ bg: "none", padding: 48, radius: 16, shadow: 24 });
    expect(updateBackground(none, { bg: "ocean" }).background).toEqual({
      bg: "ocean",
      padding: 48,
      radius: 16,
      shadow: 24,
    });
  });

  it("does not touch the rest of the scene", () => {
    const next = updateBackground(scene, { bg: "magenta" });
    expect({ ...next, background: undefined }).toEqual({ ...scene, background: undefined });
  });
});

describe("chooseBackground (NIW2-676: a pick on a fresh scene starts from the starter look)", () => {
  const fresh = initialScene(10);

  it("gives a fresh scene the starter look with the preset, in one scene", () => {
    expect(chooseBackground(fresh, "sunset").background).toEqual({
      bg: "sunset",
      ...BACKGROUND_STARTER_LOOK,
    });
  });

  it("changes only the preset when any of the three numbers is already non-zero", () => {
    for (const numbers of [{ padding: 5 }, { radius: 5 }, { shadow: 5 }]) {
      const set = updateBackground(updateBackground(fresh, { bg: "ocean" }), numbers);
      const next = chooseBackground(set, "sunset").background!;
      expect(next).toEqual({ ...set.background, bg: "sunset" });
    }
  });

  it("keeps the stored numbers on none, and a later pick keeps them rather than the starter look", () => {
    const own = updateBackground(fresh, { bg: "ocean", padding: 20, radius: 3, shadow: 9 });
    const none = chooseBackground(own, "none");
    expect(none.background).toEqual({ bg: "none", padding: 20, radius: 3, shadow: 9 });
    expect(chooseBackground(none, "purple").background).toEqual({
      bg: "purple",
      padding: 20,
      radius: 3,
      shadow: 9,
    });
  });

  it("choosing none on a fresh scene is no change (no starter look for an invisible pick)", () => {
    expect(chooseBackground(fresh, "none")).toBe(fresh);
  });

  it("applies the starter look again after the user zeroed all three", () => {
    const zeroed = updateBackground(fresh, { bg: "ocean", padding: 0, radius: 0, shadow: 0 });
    expect(chooseBackground(zeroed, "sunset").background).toEqual({
      bg: "sunset",
      ...BACKGROUND_STARTER_LOOK,
    });
  });

  it("returns the same scene when the pick changes nothing", () => {
    const set = chooseBackground(fresh, "sunset");
    expect(chooseBackground(set, "sunset")).toBe(set);
  });
});
