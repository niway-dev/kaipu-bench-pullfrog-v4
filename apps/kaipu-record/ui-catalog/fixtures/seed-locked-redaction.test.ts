import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseCanvasDoc } from "../../src/renderer/src/features/screenshots/annotations/canvas-doc";
import { FIXTURE_FILES } from "./make-fixtures";
import { ASSETS, seedLockedRedactionShot, LOCKED_SHOT } from "./seed-vault";

/** The 24 bytes of a PNG that carry its size: signature, IHDR length and type, width, height. */
function pngHeader(width: number, height: number): Buffer {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

describe("seedLockedRedactionShot", () => {
  it("seeds a screenshot whose canvas document holds one dated, locked redaction over the middle", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "seed-locked-"));
    const fixtures = path.join(root, "fixtures");
    const vault = path.join(root, "vault");
    const meta = path.join(vault, ".kaipu");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(fixtures, { recursive: true });
    await mkdir(meta, { recursive: true });
    await writeFile(path.join(fixtures, FIXTURE_FILES.screens[3]), pngHeader(800, 600));
    const now = Date.UTC(2026, 10, 11, 12, 0, 0);

    await seedLockedRedactionShot(vault, meta, fixtures, now);

    const sidecar = JSON.parse(await readFile(path.join(meta, `${LOCKED_SHOT.stem}.json`), "utf8"));
    expect(sidecar).toMatchObject({ assetId: ASSETS.lockedShot, title: LOCKED_SHOT.title });
    const flat = await readFile(path.join(vault, `${LOCKED_SHOT.stem}.png`));
    const base = await readFile(path.join(meta, `${LOCKED_SHOT.stem}.assets`, "base.png"));
    expect(base.equals(flat)).toBe(true);

    const parsed = parseCanvasDoc(
      await readFile(path.join(meta, `${LOCKED_SHOT.stem}.canvas.json`), "utf8"),
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.base).toMatchObject({ assetId: "base", pixelWidth: 800, pixelHeight: 600 });
    const blurs = parsed!.scene.annotations.filter((a) => a.kind === "blur");
    expect(blurs).toHaveLength(1);
    const [blur] = blurs;
    if (blur.kind !== "blur") throw new Error("unreachable");
    expect(blur.locked).toBe(true);
    expect(blur.lockedAt).toBe(now - LOCKED_SHOT.savedAgo);
    // The centre of the image, which is where a catalog hover on the canvas lands, is inside it.
    expect(blur.x).toBeLessThan(0.5);
    expect(blur.x + blur.w).toBeGreaterThan(0.5);
    expect(blur.y).toBeLessThan(0.5);
    expect(blur.y + blur.h).toBeGreaterThan(0.5);
  });
});
