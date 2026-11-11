import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useMissingRecordingRecovery,
  type MissingRecoveryParams,
} from "./use-missing-recording-recovery";

const navigateMock = vi.fn();
vi.mock("react-router-dom", () => ({ useNavigate: () => navigateMock }));

const captureEventMock = vi.fn();
vi.mock("@renderer/features/analytics", () => ({
  captureEvent: (...args: unknown[]) => captureEventMock(...args),
}));

type Props = Omit<MissingRecoveryParams, "refresh">;

function setup(initial: Props) {
  const refresh = vi.fn().mockResolvedValue(undefined);
  const { result, rerender } = renderHook(
    (props: Props) => useMissingRecordingRecovery({ ...props, refresh }),
    { initialProps: initial },
  );
  return { result, rerender: (p: Props) => rerender(p), refresh };
}

const loaded = (over: Partial<Props> = {}): Props => ({
  id: "r1",
  found: false,
  isLoading: false,
  listSize: 2,
  fromRecording: true,
  ...over,
});

describe("useMissingRecordingRecovery", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("does nothing while the list is still loading", () => {
    const { result, refresh } = setup(loaded({ isLoading: true }));
    expect(result.current.recovering).toBe(false);
    act(() => vi.advanceTimersByTime(1000));
    expect(refresh).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("ignores a vault error: no re-list, no redirect, no loader", () => {
    const { result, refresh } = setup(loaded({ hasError: true }));
    expect(result.current.recovering).toBe(false);
    act(() => vi.advanceTimersByTime(2000));
    expect(refresh).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
    expect(captureEventMock).not.toHaveBeenCalled();
  });

  it("does nothing when the recording is present", () => {
    const { result, refresh } = setup(loaded({ found: true }));
    expect(result.current.recovering).toBe(false);
    act(() => vi.advanceTimersByTime(1000));
    expect(refresh).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
    expect(captureEventMock).not.toHaveBeenCalled();
  });

  it("re-lists once when the recording is missing, keeping the loader up", () => {
    const { result, refresh } = setup(loaded());
    expect(result.current.recovering).toBe(true); // loader, not "File not found"
    act(() => vi.advanceTimersByTime(500));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("redirects once when the retry resolves with the same list (no loading flip)", async () => {
    // The real hook never flips isLoading again: a re-list that returns the same
    // list changes no prop, so the redirect must follow the retry's completion.
    const { result, refresh } = setup(loaded());
    expect(result.current.recovering).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith("/library", { replace: true });
    expect(captureEventMock).toHaveBeenCalledTimes(1);
    expect(result.current.recovering).toBe(false);
  });

  it("stops recovering when the retry surfaces the recording", async () => {
    const { result, rerender, refresh } = setup(loaded());
    act(() => vi.advanceTimersByTime(500));
    expect(refresh).toHaveBeenCalledTimes(1);
    // The re-list lands with the item (the list state updates), then refresh resolves.
    act(() => rerender(loaded({ found: true, listSize: 3 })));
    await act(async () => {});
    expect(result.current.recovering).toBe(false);
    expect(navigateMock).not.toHaveBeenCalled();
    expect(captureEventMock).not.toHaveBeenCalled();
  });

  it("re-arms the retry when a found item disappears again", async () => {
    const { rerender, refresh } = setup(loaded());
    act(() => vi.advanceTimersByTime(500));
    act(() => rerender(loaded({ found: true })));
    await act(async () => {});
    act(() => rerender(loaded()));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(navigateMock).toHaveBeenCalledTimes(1);
  });

  it("re-arms recovery after the id changes", async () => {
    const { rerender, refresh } = setup(loaded());
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(navigateMock).toHaveBeenCalledTimes(1);
    navigateMock.mockClear();
    captureEventMock.mockClear();
    // Navigating to a different, also-missing recording recovers from scratch.
    act(() => rerender(loaded({ id: "r2" })));
    expect(navigateMock).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(navigateMock).toHaveBeenCalledWith("/library", { replace: true });
    expect(captureEventMock).toHaveBeenCalledWith(
      "library-detail-missing",
      expect.objectContaining({ id: "r2" }),
    );
  });

  it("does not redirect for an id the page left while its retry was in flight", async () => {
    let resolveRefresh: () => void = () => {};
    const refresh = vi.fn(() => new Promise<void>((r) => (resolveRefresh = r)));
    const { rerender } = renderHook(
      (props: Props) => useMissingRecordingRecovery({ ...props, refresh }),
      { initialProps: loaded() },
    );
    act(() => vi.advanceTimersByTime(500));
    act(() => rerender(loaded({ id: "r2", found: true })));
    await act(async () => resolveRefresh());
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
