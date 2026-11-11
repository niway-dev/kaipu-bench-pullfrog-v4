import { describe, expect, it } from "vitest";
import { resolveCaptureWhileRecording } from "./capture-while-recording";

describe("resolveCaptureWhileRecording", () => {
  it("is off by default", () => {
    expect(
      resolveCaptureWhileRecording({ platform: "darwin", override: undefined, reported: false }),
    ).toBe(false);
  });
  it("follows the reported flag on macOS", () => {
    expect(
      resolveCaptureWhileRecording({ platform: "darwin", override: undefined, reported: true }),
    ).toBe(true);
  });
  it("lets a local override win over the reported flag", () => {
    expect(
      resolveCaptureWhileRecording({ platform: "darwin", override: false, reported: true }),
    ).toBe(false);
    expect(
      resolveCaptureWhileRecording({ platform: "darwin", override: true, reported: false }),
    ).toBe(true);
  });
  it("is never on outside macOS", () => {
    for (const platform of ["win32", "linux"] as const) {
      expect(resolveCaptureWhileRecording({ platform, override: true, reported: true })).toBe(
        false,
      );
    }
  });
});
