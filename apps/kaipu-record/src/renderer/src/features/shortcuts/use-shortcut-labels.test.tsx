import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppSettings } from "@shared/types";
import { useShortcutLabels } from "./use-shortcut-labels";

const settingsWith = (startRecording: string): AppSettings =>
  ({
    shortcuts: {
      startRecording,
      bringToFront: "Command+Control+O",
      captureScreenshot: "Command+Shift+1",
      captureWindow: "Command+Control+W",
      captureInstant: "Command+Control+X",
    },
  }) as AppSettings;

describe("useShortcutLabels", () => {
  it("returns the bindings from settings as formatted labels", async () => {
    const { result } = renderHook(() => useShortcutLabels());
    // The test stub's settings carry the macOS defaults (Command+Shift+1/2, Command+Control+X/O).
    await waitFor(() =>
      expect(result.current).toEqual({
        startRecording: "⇧⌘2",
        bringToFront: "⌃⌘O",
        captureScreenshot: "⇧⌘1",
        captureWindow: "⌃⌘W",
        captureInstant: "⌃⌘X",
      }),
    );
  });

  it("updates on a settings-changed broadcast (reflects a rebind without a remount/focus)", async () => {
    window.electronAPI.getSettings = vi.fn(async () =>
      settingsWith("Command+Shift+2"),
    ) as unknown as typeof window.electronAPI.getSettings;
    let subscriber: ((settings: AppSettings) => void) | null = null;
    window.electronAPI.onSettingsChanged = ((callback: (settings: AppSettings) => void) => {
      subscriber = callback;
      return () => {};
    }) as unknown as typeof window.electronAPI.onSettingsChanged;

    const { result } = renderHook(() => useShortcutLabels());
    await waitFor(() => expect(result.current?.startRecording).toBe("⇧⌘2"));

    // The always-alive control-bar window never remounts/focuses; the broadcast
    // is what keeps its shortcut hint current.
    act(() => subscriber?.(settingsWith("Command+Control+G")));
    await waitFor(() => expect(result.current?.startRecording).toBe("⌃⌘G"));
  });

  it("renders Windows-style text labels when the bridge reports win32", async () => {
    const api = window.electronAPI as { platform: string };
    const original = api.platform;
    api.platform = "win32";
    window.electronAPI.getSettings = vi.fn(async () =>
      settingsWith("Control+Alt+2"),
    ) as unknown as typeof window.electronAPI.getSettings;
    try {
      const { result } = renderHook(() => useShortcutLabels());
      await waitFor(() => expect(result.current?.startRecording).toBe("Ctrl+Alt+2"));
    } finally {
      api.platform = original;
    }
  });
});
