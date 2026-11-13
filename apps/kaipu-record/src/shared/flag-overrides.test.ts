import { describe, expect, it } from "vitest";
import { flagOverridesArg, parseFlagOverrides, readFlagOverridesArg } from "./flag-overrides";

describe("parseFlagOverrides", () => {
  it("flips a known flag", () => {
    const { overrides, rejected } = parseFlagOverrides('{"native-cursor-capture":true}', {
      isPackaged: false,
    });
    expect(overrides).toEqual({ "native-cursor-capture": true });
    expect(rejected).toEqual([]);
  });

  it("ignores the variable entirely in a packaged build", () => {
    const result = parseFlagOverrides('{"native-cursor-capture":true}', { isPackaged: true });
    expect(result).toEqual({ overrides: {}, rejected: [] });
  });

  it("rejects an unknown key and keeps the valid ones", () => {
    const { overrides, rejected } = parseFlagOverrides('{"nope":true,"image-canvas":false}', {
      isPackaged: false,
    });
    expect(overrides).toEqual({ "image-canvas": false });
    expect(rejected).toEqual(["nope (unknown flag)"]);
  });

  it("rejects a non-boolean value", () => {
    const { overrides, rejected } = parseFlagOverrides('{"image-canvas":"yes"}', {
      isPackaged: false,
    });
    expect(overrides).toEqual({});
    expect(rejected).toEqual(["image-canvas (not a boolean)"]);
  });

  it("yields no overrides for invalid JSON or a non-object", () => {
    expect(parseFlagOverrides("{oops", { isPackaged: false }).overrides).toEqual({});
    expect(parseFlagOverrides("{oops", { isPackaged: false }).rejected).toHaveLength(1);
    expect(parseFlagOverrides("[true]", { isPackaged: false }).overrides).toEqual({});
  });

  it("yields nothing when the variable is unset", () => {
    expect(parseFlagOverrides(undefined, { isPackaged: false })).toEqual({
      overrides: {},
      rejected: [],
    });
  });
});

describe("readFlagOverridesArg", () => {
  it("round-trips through the process argument", () => {
    const argv = ["electron", "--foo", flagOverridesArg({ "image-canvas": false })];
    expect(readFlagOverridesArg(argv)).toEqual({ "image-canvas": false });
  });

  it("is empty when the argument is absent", () => {
    expect(readFlagOverridesArg(["electron", "--foo"])).toEqual({});
  });
});
