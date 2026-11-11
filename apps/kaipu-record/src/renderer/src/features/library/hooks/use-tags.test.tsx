import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useTags } from "./use-tags";
import { reportError } from "@renderer/features/analytics";

vi.mock("@renderer/features/analytics", () => ({ reportError: vi.fn() }));

const tag = { id: "t1", name: "Demo", slug: "demo", color: "rose" as const, count: 2 };

describe("useTags", () => {
  let listTags: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.mocked(reportError).mockClear();
    listTags = vi.fn(async () => [tag]);
    window.electronAPI.listTags = listTags as typeof window.electronAPI.listTags;
    window.electronAPI.onLibraryChanged = () => () => {};
  });

  it("does not re-list after create, rename or recolor: main's library:changed broadcast does", async () => {
    window.electronAPI.createTag = vi.fn(async () => ({ ...tag, id: "t2", count: 0 }));
    window.electronAPI.renameTag = vi.fn(async () => {});
    window.electronAPI.recolorTag = vi.fn(async () => {});
    const { result } = renderHook(() => useTags());
    await waitFor(() => expect(result.current.tags).toHaveLength(1));
    expect(listTags).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.create("New");
      await result.current.rename("t1", "Renamed");
      await result.current.recolor("t1", "sky");
    });

    expect(window.electronAPI.renameTag).toHaveBeenCalledWith("t1", "Renamed");
    expect(window.electronAPI.recolorTag).toHaveBeenCalledWith("t1", "sky");
    expect(listTags).toHaveBeenCalledTimes(1);
  });

  it("re-lists when a write fails, so the list does not keep a name that was never saved", async () => {
    window.electronAPI.renameTag = vi.fn(async () => {
      throw new Error("registry unreadable");
    });
    const { result } = renderHook(() => useTags());
    await waitFor(() => expect(result.current.tags).toHaveLength(1));

    await act(async () => {
      await result.current.rename("t1", "Nope");
    });

    expect(reportError).toHaveBeenCalledTimes(1);
    expect(listTags).toHaveBeenCalledTimes(2);
  });

  it("create answers null and reports the create error when the fallback lookup fails too", async () => {
    const createError = new Error("registry unreadable");
    window.electronAPI.createTag = vi.fn(async () => {
      throw createError;
    });
    const { result } = renderHook(() => useTags());
    await waitFor(() => expect(result.current.tags).toHaveLength(1));
    listTags.mockRejectedValueOnce(new Error("vault gone"));

    let created: unknown = "unset";
    await act(async () => {
      created = await result.current.create("New");
    });

    expect(created).toBeNull();
    expect(reportError).toHaveBeenCalledWith(expect.any(String), createError, {
      context: { phase: "create-tag" },
    });
  });

  it("re-lists when the library changes", async () => {
    let notify: (() => void) | null = null;
    window.electronAPI.onLibraryChanged = (cb: () => void) => {
      notify = cb;
      return () => {};
    };
    const { result } = renderHook(() => useTags());
    await waitFor(() => expect(result.current.tags).toHaveLength(1));
    await act(async () => notify?.());
    expect(listTags).toHaveBeenCalledTimes(2);
  });
});
