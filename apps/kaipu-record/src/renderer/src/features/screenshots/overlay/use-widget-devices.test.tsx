import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWidgetDevices } from "./use-widget-devices";

const noSettings = {
  getRecordingSettings: vi.fn(() => new Promise(() => {})),
  getSettings: vi.fn(() => new Promise(() => {})),
  updateRecordingSettings: vi.fn(),
  onRecordingSettingsChanged: vi.fn(() => () => {}),
} as unknown as Parameters<typeof useWidgetDevices>[0];

describe("useWidgetDevices", () => {
  const enumerateDevices = vi.fn(async () => []);
  const getUserMedia = vi.fn();
  beforeEach(() => {
    enumerateDevices.mockClear();
    getUserMedia.mockClear();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices,
        getUserMedia,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
  });
  afterEach(() => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
  });

  it("reads no device while the overlay is a screenshot one", () => {
    const { unmount } = renderHook(() => useWidgetDevices(noSettings, false));
    unmount();
    expect(enumerateDevices).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("enumerates devices once the overlay records", () => {
    const { unmount } = renderHook(() => useWidgetDevices(noSettings, true));
    unmount();
    expect(enumerateDevices).toHaveBeenCalled();
  });
});
