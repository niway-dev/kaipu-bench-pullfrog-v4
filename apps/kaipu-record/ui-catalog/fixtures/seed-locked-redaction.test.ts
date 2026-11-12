import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { REDACTION_SOLID_RGB } from "../../src/renderer/src/features/screenshots/annotations/redaction";
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

/** The RGB of one pixel of an 8-bit RGB, filter-0 PNG as `paintPng` writes it. */
function pixelAt(png: Buffer, x: number, y: number): number[] {
  const width = png.readUInt32BE(16);
  let offset = 8;
  const idat: Buffer[] = [];
  while (offset < png.length) {
    const len = png.readUInt32BE(offset);
    if (png.toString("ascii", offset + 4, offset + 8) === "IDAT")
      idat.push(png.subarray(offset + 8, offset + 8 + len));
    offset += len + 12;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const at = y * (width * 3 + 1) + 1 + x * 3;
  return [raw[at]!, raw[at + 1]!, raw[at + 2]!];
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
    expect(blur.style).toBe("solid");
    // The PNG carries the baked redaction: the region's centre is the solid fill, and a pixel
    // outside it is not.
    expect(pixelAt(flat, 400, 300)).toEqual([...REDACTION_SOLID_RGB]);
    expect(pixelAt(flat, 5, 590)).not.toEqual([...REDACTION_SOLID_RGB]);
    expect(blur.lockedAt).toBe(now - LOCKED_SHOT.savedAgo);
    // The centre of the image, which is where a catalog hover on the canvas lands, is inside it.
    expect(blur.x).toBeLessThan(0.5);
    expect(blur.x + blur.w).toBeGreaterThan(0.5);
    expect(blur.y).toBeLessThan(0.5);
    expect(blur.y + blur.h).toBeGreaterThan(0.5);
  });
});
