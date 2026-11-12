import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearImageCache, loadImage } from "./redaction-preview";

/**
 * NIW2-724: the live Blur preview decodes the shot by `fetch`ing its display URL
 * (`loadImage`). A fresh capture, and every image added to the canvas, is shown through a
 * `blob:` object URL, and the renderer's Content-Security-Policy decides whether that fetch
 * may happen: with no `connect-src`, it falls back to `default-src 'self'`, which does not
 * match `blob:`. The fetch is refused, the tile is `null` and the blur draws nothing, while
 * the save still bakes it. jsdom does not enforce CSP, so this pins the policy itself.
 */
function rendererCsp(): Map<string, string[]> {
  // Vitest runs from the app's root; jsdom's `import.meta.url` is not a file URL.
  const html = readFileSync(resolve(process.cwd(), "src/renderer/index.html"), "utf8");
  const content = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html)?.[1];
  if (!content) throw new Error("index.html has no Content-Security-Policy meta tag");
  const directives = new Map<string, string[]>();
  for (const part of content.split(";")) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) directives.set(name, sources);
  }
  return directives;
}

describe("redaction preview and the renderer CSP", () => {
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

  it("decodes a blob: display URL with fetch, so connect-src must allow blob:", async () => {
    await loadImage("blob:app://00000000-0000-0000-0000-000000000000");
    expect(fetchMock).toHaveBeenCalledWith("blob:app://00000000-0000-0000-0000-000000000000");
    const csp = rendererCsp();
    const connect = csp.get("connect-src") ?? csp.get("default-src") ?? [];
    expect(connect).toContain("blob:");
  });
});
