import { afterEach, describe, expect, it, vi } from "vitest";
import { buildExceptionProperties, initMainAnalytics } from "./analytics.service";

describe("buildExceptionProperties", () => {
  it("tags every exception with product + surface and the origin", () => {
    const props = buildExceptionProperties("main-process", { foo: "bar" });
    expect(props.product).toBe("kaipu-recorder");
    expect(props.surface).toBe("desktop");
    expect(props.origin).toBe("main-process");
    expect(props.foo).toBe("bar");
  });
});

describe("initMainAnalytics", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("says so when the build has no PostHog key", () => {
    vi.stubEnv("MAIN_VITE_POSTHOG_KEY", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    initMainAnalytics("device-1", true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("no PostHog key"));
  });
});
