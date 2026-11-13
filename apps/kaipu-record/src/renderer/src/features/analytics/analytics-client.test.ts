import { afterEach, describe, expect, it } from "vitest";
import { buildPosthogConfig, isFlagEnabled } from "./analytics-client";

describe("buildPosthogConfig", () => {
  it("locks privacy down for a screen recorder", () => {
    const config = buildPosthogConfig("https://us.i.posthog.com");
    expect(config.autocapture).toBe(false);
    expect(config.capture_pageview).toBe(false);
    expect(config.disable_session_recording).toBe(true);
    expect(config.capture_exceptions).toBe(true);
    expect(config.api_host).toBe("https://us.i.posthog.com");
  });

  it("falls back to the US host when none is provided", () => {
    expect(buildPosthogConfig(undefined).api_host).toBe("https://us.i.posthog.com");
  });

  it("treats an empty host (an unset CI variable) as no host", () => {
    expect(buildPosthogConfig("").api_host).toBe("https://us.i.posthog.com");
  });
});

describe("isFlagEnabled overrides", () => {
  const original = window.electronAPI.flagOverrides;
  const setOverrides = (value: unknown): void => {
    (window.electronAPI as { flagOverrides: unknown }).flagOverrides = value;
  };
  afterEach(() => setOverrides(original));

  it("returns the override even though analytics never started", () => {
    setOverrides({ "native-cursor-capture": true, "image-canvas": true });
    expect(isFlagEnabled("native-cursor-capture", false)).toBe(true);
    expect(isFlagEnabled("image-canvas", false)).toBe(true);
  });

  it("falls back to the default for a flag with no override", () => {
    setOverrides({ "native-cursor-capture": true });
    expect(isFlagEnabled("image-canvas", true)).toBe(true);
  });
});
