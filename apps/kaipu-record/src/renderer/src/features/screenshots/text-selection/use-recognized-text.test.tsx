import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RecognizedWord } from "@kaipu/domain/schemas";
import { useRecognizedText } from "./use-recognized-text";

const recognize = vi.fn();
const WORD: RecognizedWord = {
  text: "hi",
  line: 0,
  rect: { x: 0, y: 0, w: 1, h: 1 },
  confidence: 1,
};
const bytesA = new Uint8Array([1]).buffer;
const bytesB = new Uint8Array([2]).buffer;

beforeEach(() => {
  recognize.mockReset();
  window.electronAPI.recognizeScreenshotText = recognize as never;
});

describe("useRecognizedText", () => {
  it("calls nothing while disabled or without an image", () => {
    const getBytes = async () => bytesA;
    const { result, rerender } = renderHook(
      (p: { enabled: boolean; getBytes: (() => Promise<ArrayBuffer>) | null }) =>
        useRecognizedText({ ...p, assetId: "base", getId: () => null }),
      {
        initialProps: { enabled: false, getBytes } as {
          enabled: boolean;
          getBytes: (() => Promise<ArrayBuffer>) | null;
        },
      },
    );
    rerender({ enabled: true, getBytes: null });
    expect(recognize).not.toHaveBeenCalled();
    expect(result.current).toEqual({ status: "pending" });
  });

  it("recognizes once per image and reads the id when the call goes out", async () => {
    recognize.mockResolvedValue({ status: "ready", words: [WORD] });
    const getBytes = async () => bytesA;
    let id: string | null = null;
    const { result, rerender } = renderHook(() =>
      useRecognizedText({ enabled: true, getBytes, assetId: "base", getId: () => id }),
    );
    await waitFor(() => expect(result.current).toEqual({ status: "ready", words: [WORD] }));
    id = "saved"; // the id a first save creates
    rerender();
    expect(recognize).toHaveBeenCalledTimes(1);
    expect(recognize).toHaveBeenCalledWith({ id: null, assetId: "base", png: bytesA });
  });

  it("ignores the result of an image that was replaced meanwhile", async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    recognize.mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)));
    recognize.mockResolvedValueOnce({ status: "unavailable" });
    const first = async () => bytesA;
    const second = async () => bytesB;
    const { result, rerender } = renderHook(
      (p: { getBytes: () => Promise<ArrayBuffer> }) =>
        useRecognizedText({ enabled: true, ...p, assetId: "base", getId: () => null }),
      { initialProps: { getBytes: first } },
    );
    await waitFor(() => expect(recognize).toHaveBeenCalledTimes(1));
    rerender({ getBytes: second });
    await waitFor(() => expect(result.current).toEqual({ status: "unavailable" }));
    await act(async () => resolveFirst({ status: "ready", words: [WORD] }));
    expect(result.current).toEqual({ status: "unavailable" });
  });

  it("reads a rejected call or an unreadable image as unavailable", async () => {
    recognize.mockRejectedValue(new Error("ipc"));
    const getBytes = async () => bytesA;
    const { result } = renderHook(() =>
      useRecognizedText({ enabled: true, getBytes, assetId: "base", getId: () => null }),
    );
    await waitFor(() => expect(result.current).toEqual({ status: "unavailable" }));
  });

  it("reads an image whose bytes cannot be read as unavailable, without recognizing", async () => {
    const getBytes = async (): Promise<ArrayBuffer> => {
      throw new Error("unreadable");
    };
    const { result } = renderHook(() =>
      useRecognizedText({ enabled: true, getBytes, assetId: "base", getId: () => null }),
    );
    await waitFor(() => expect(result.current).toEqual({ status: "unavailable" }));
    expect(recognize).not.toHaveBeenCalled();
  });
});
