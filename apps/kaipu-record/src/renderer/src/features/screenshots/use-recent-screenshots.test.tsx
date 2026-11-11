import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { LocalRecording } from "@shared/types/library-storage";
import { useRecentScreenshots } from "./use-recent-screenshots";

function shot(id: string, kind: LocalRecording["kind"] = "screenshot"): LocalRecording {
  return { id, assetId: `asset-${id}`, kind, title: id } as LocalRecording;
}

describe("useRecentScreenshots", () => {
  let notify: (() => void) | null;
  beforeEach(() => {
    notify = null;
    window.electronAPI.onLibraryChanged = (cb: () => void) => {
      notify = cb;
      return () => {
        notify = null;
      };
    };
  });

  it("lists only screenshots, capped at the limit", async () => {
    window.electronAPI.listLocalRecordings = vi.fn(async () => [
      shot("a"),
      shot("v", "recording"),
      shot("b"),
      shot("c"),
    ]);
    const { result } = renderHook(() => useRecentScreenshots(2));
    await waitFor(() => expect(result.current.shots.map((s) => s.id)).toEqual(["a", "b"]));
  });

  it("re-lists on library:changed, not on window focus", async () => {
    window.electronAPI.listLocalRecordings = vi.fn(async () => [shot("a")]);
    const { result } = renderHook(() => useRecentScreenshots());
    await waitFor(() => expect(result.current.shots).toHaveLength(1));

    window.electronAPI.listLocalRecordings = vi.fn(async () => [shot("new"), shot("a")]);
    window.dispatchEvent(new Event("focus"));
    expect(window.electronAPI.listLocalRecordings).not.toHaveBeenCalled();

    await act(async () => notify?.());
    await waitFor(() => expect(result.current.shots.map((s) => s.id)).toEqual(["new", "a"]));
  });

  it("keeps the previous shots when a re-list fails, without an unhandled rejection", async () => {
    window.electronAPI.listLocalRecordings = vi.fn(async () => [shot("a")]);
    const { result } = renderHook(() => useRecentScreenshots());
    await waitFor(() => expect(result.current.shots).toHaveLength(1));

    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      const failing = vi.fn(async () => {
        throw new Error("vault unreadable");
      });
      window.electronAPI.listLocalRecordings = failing;
      await act(async () => notify?.());
      await waitFor(() => expect(failing).toHaveBeenCalledTimes(1));
      await new Promise((r) => setTimeout(r, 0));
      expect(unhandled).not.toHaveBeenCalled();
      expect(result.current.shots.map((s) => s.id)).toEqual(["a"]);
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });

  it("stops listening once unmounted", async () => {
    window.electronAPI.listLocalRecordings = vi.fn(async () => []);
    const { unmount } = renderHook(() => useRecentScreenshots());
    await waitFor(() => expect(notify).not.toBeNull());
    unmount();
    expect(notify).toBeNull();
  });
});
