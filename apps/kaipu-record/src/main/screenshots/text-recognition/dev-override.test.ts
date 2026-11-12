import { describe, expect, it, vi } from "vitest";
import type { RecognizedWord, TextRecognizer } from "@kaipu/domain/schemas";
import { parseTextRecognitionOverride, withTextRecognitionOverride } from "./dev-override";

const dev = { isPackaged: false };

describe("parseTextRecognitionOverride", () => {
  it("is no override when unset or empty", () => {
    expect(parseTextRecognitionOverride(undefined, dev)).toEqual({ override: null, rejected: null });
    expect(parseTextRecognitionOverride("", dev)).toEqual({ override: null, rejected: null });
  });
  it("reads unavailable and delay:<ms>", () => {
    expect(parseTextRecognitionOverride("unavailable", dev).override).toEqual({
      kind: "unavailable",
    });
    expect(parseTextRecognitionOverride("delay:60000", dev).override).toEqual({
      kind: "delay",
      ms: 60000,
    });
  });
  it("rejects bad values: no override, the raw value reported", () => {
    for (const bad of ["delay:", "delay:-5", "delay:abc", "slow", "delay:99999999"]) {
      expect(parseTextRecognitionOverride(bad, dev)).toEqual({ override: null, rejected: bad });
    }
  });
  it("is ignored entirely in a packaged app", () => {
    expect(parseTextRecognitionOverride("unavailable", { isPackaged: true })).toEqual({
      override: null,
      rejected: null,
    });
  });
});

describe("withTextRecognitionOverride", () => {
  const words: RecognizedWord[] = [
    { text: "a", rect: { x: 0, y: 0, w: 1, h: 1 }, line: 0, confidence: 1 },
  ];
  const inner = (): TextRecognizer => ({ recognize: vi.fn(async () => words) });

  it("passes the recognizer through with no override", () => {
    const r = inner();
    expect(withTextRecognitionOverride(r, null)).toBe(r);
  });
  it("answers unavailable without calling the recognizer", async () => {
    const r = inner();
    const wrapped = withTextRecognitionOverride(r, { kind: "unavailable" });
    expect(await wrapped.recognize(Buffer.from([]) as never)).toBe("unavailable");
    expect(r.recognize).not.toHaveBeenCalled();
  });
  it("waits, then delegates", async () => {
    vi.useFakeTimers();
    try {
      const r = inner();
      const wrapped = withTextRecognitionOverride(r, { kind: "delay", ms: 500 });
      const pending = wrapped.recognize(Buffer.from([]) as never);
      await vi.advanceTimersByTimeAsync(499);
      expect(r.recognize).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(await pending).toBe(words);
    } finally {
      vi.useRealTimers();
    }
  });
});
