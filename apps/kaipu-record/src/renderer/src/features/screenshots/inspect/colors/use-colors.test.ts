import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PixelBuffer } from "../pixel-buffer";
import type { ColorsAnalyzer, LocatedImage } from "./colors-client";
import type { ColorAnalysis, LocateTarget } from "./histogram";

vi.mock("@renderer/features/analytics", () => ({ reportError: vi.fn() }));

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}
const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

// A scripted analyzer: each test settles its analysis and locate calls by hand.
interface FakeAnalyzer extends ColorsAnalyzer {
  analysisCall: Deferred<ColorAnalysis>;
  locateCalls: Deferred<LocatedImage>[];
  disposed: boolean;
}
const created: FakeAnalyzer[] = [];

vi.mock("./colors-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./colors-client")>();
  return {
    ...actual,
    createColorsAnalyzer: (buffer: PixelBuffer): ColorsAnalyzer => {
      const analysisCall = deferred<ColorAnalysis>();
      analysisCall.promise.catch(() => {});
      const fake: FakeAnalyzer = {
        buffer,
        analysis: analysisCall.promise,
        analysisCall,
        locateCalls: [],
        disposed: false,
        locate(_target: LocateTarget) {
          const call = deferred<LocatedImage>();
          fake.locateCalls.push(call);
          return call.promise;
        },
        dispose() {
          fake.disposed = true;
        },
      };
      created.push(fake);
      return fake;
    },
  };
});

const { useColors } = await import("./use-colors");

const buffer = (): PixelBuffer => ({ width: 1, height: 1, data: new Uint8ClampedArray(4) });
const first = buffer();
const analysis: ColorAnalysis = {
  width: 1,
  height: 1,
  counted: 1,
  distinct: 1,
  totalGroups: 1,
  groups: [{ id: 0, rgb: 0xffffff, count: 1, distinct: 1, members: [] }],
};
const bitmapImage = (matched: number) => {
  const close = vi.fn();
  const image = {
    matched,
    width: 1,
    height: 1,
    bitmap: { close } as unknown as ImageBitmap,
  } as LocatedImage;
  return { image, close };
};

beforeEach(() => {
  created.length = 0;
});

describe("useColors", () => {
  it("drops a locate that finishes after the image changed, and closes its bitmap", async () => {
    const { result, rerender } = renderHook(({ buf }) => useColors({ active: true, buffer: buf }), {
      initialProps: { buf: buffer() },
    });
    act(() => result.current.setOpen(true));
    await act(async () => created[0].analysisCall.resolve(analysis));
    act(() => result.current.locate({ kind: "group", id: 0 }));

    rerender({ buf: buffer() });
    expect(created[0].disposed).toBe(true);
    const late = bitmapImage(1);
    await act(async () => created[0].locateCalls[0].resolve(late.image));

    expect(late.close).toHaveBeenCalled();
    expect(result.current.overlay).toBeNull();
    expect(result.current.located).toBeNull();
  });

  it("clears the previous mask as soon as another color is chosen", async () => {
    const { result } = renderHook(() => useColors({ active: true, buffer: first }));
    act(() => result.current.setOpen(true));
    await act(async () => created[0].analysisCall.resolve(analysis));
    act(() => result.current.locate({ kind: "group", id: 0 }));
    const a = bitmapImage(5);
    await act(async () => created[0].locateCalls[0].resolve(a.image));
    expect(result.current.overlay?.matched).toBe(5);

    act(() => result.current.locate({ kind: "color", rgb: 0xffffff }));
    expect(result.current.overlay).toBeNull();
    expect(a.close).toHaveBeenCalled();
  });

  it("counts again when the panel reopens after a failure", async () => {
    const { result } = renderHook(() => useColors({ active: true, buffer: first }));
    act(() => result.current.setOpen(true));
    await act(async () => created[0].analysisCall.reject(new Error("worker failed")));
    expect(result.current.status).toBe("error");

    act(() => result.current.setOpen(false));
    act(() => result.current.setOpen(true));
    expect(created).toHaveLength(2);
    await act(async () => created[1].analysisCall.resolve(analysis));
    await waitFor(() => expect(result.current.status).toBe("ready"));
  });

  it("keeps the same controller while nothing changes", () => {
    const { result, rerender } = renderHook(() => useColors({ active: true, buffer: first }));
    const before = result.current;
    rerender();
    expect(result.current).toBe(before);
  });
});
