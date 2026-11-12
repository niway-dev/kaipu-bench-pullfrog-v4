import { afterEach, describe, expect, it, vi } from "vitest";
import { savedAtOf, whyNoDocument } from "./canvas-load";

const original = window.electronAPI.statScreenshotCanvas;
afterEach(() => {
  window.electronAPI.statScreenshotCanvas = original;
});

describe("whyNoDocument", () => {
  it("is absent when no document file exists: a plain screenshot", async () => {
    window.electronAPI.statScreenshotCanvas = vi.fn(async () => null);
    expect(await whyNoDocument("shot-1")).toBe("absent");
  });

  it("is unreadable when a document file exists although the reader gave up on it", async () => {
    window.electronAPI.statScreenshotCanvas = vi.fn(async () => ({ savedAt: 1 }));
    expect(await whyNoDocument("shot-1")).toBe("unreadable");
  });

  it("is unreadable when the question itself fails: the safe side warns the user", async () => {
    window.electronAPI.statScreenshotCanvas = vi.fn(async () => {
      throw new Error("ipc");
    });
    expect(await whyNoDocument("shot-1")).toBe("unreadable");
  });
});

describe("savedAtOf", () => {
  it("returns the time the document was written", async () => {
    window.electronAPI.statScreenshotCanvas = vi.fn(async () => ({ savedAt: 1234 }));
    expect(await savedAtOf("shot-1")).toBe(1234);
  });

  it("is null when it cannot be told", async () => {
    window.electronAPI.statScreenshotCanvas = vi.fn(async () => null);
    expect(await savedAtOf("shot-1")).toBeNull();
  });
});
