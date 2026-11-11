import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_IMAGES, clearImageCache, loadImage, naturalRect } from "./redaction-preview";

describe("naturalRect", () => {
  it("maps a normalized rect to natural px with the bake's rounding", () => {
    expect(naturalRect({ x: 0.1, y: 0.25, w: 0.25, h: 0.125 }, 200, 100)).toEqual({
      x: 20,
      y: 25,
      w: 50,
      h: 13,
    });
  });

  it("clips a rect that sticks out of the image", () => {
    expect(naturalRect({ x: -0.5, y: 0.5, w: 1, h: 1 }, 100, 100)).toEqual({
      x: 0,
      y: 50,
      w: 50,
      h: 50,
    });
  });

  it("is null when the rect is entirely outside the image", () => {
    expect(naturalRect({ x: 1.2, y: 0, w: 0.3, h: 0.3 }, 100, 100)).toBeNull();
  });
});

describe("loadImage cache", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    clearImageCache();
    fetchMock.mockReset();
    fetchMock.mockImplementation(() =>
      Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob()) }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(() => Promise.resolve({ width: 1, height: 1 })),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("decodes each source once and keeps several at the same time", async () => {
    await loadImage("a");
    await loadImage("b");
    await loadImage("a");
    await loadImage("b");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("drops the least recently used source past the cap", async () => {
    for (let i = 0; i < MAX_IMAGES; i += 1) await loadImage(`s${i}`);
    await loadImage("s0"); // s0 is now the most recent; s1 the oldest
    await loadImage("extra"); // evicts s1
    fetchMock.mockClear();
    await loadImage("s0");
    expect(fetchMock).not.toHaveBeenCalled();
    await loadImage("s1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resolves null for a failed fetch instead of throwing", async () => {
    fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: false }));
    await expect(loadImage("bad")).resolves.toBeNull();
  });
});
