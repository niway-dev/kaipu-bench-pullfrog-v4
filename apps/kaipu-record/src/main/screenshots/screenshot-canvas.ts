import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  CANVAS_ASSET_ID_PATTERN,
  type CanvasReadResult,
  type CanvasSavePayload,
} from "@shared/types/screenshot-canvas";
import { atomicWriteFile } from "../library/atomic-write";
import type { LibraryVault } from "../library/library-vault";

/** Largest canvas document main stores or returns (5 MB of JSON text). */
export const CANVAS_DOC_MAX_BYTES = 5 * 1024 * 1024;

function isValidPayload(canvas: CanvasSavePayload): boolean {
  if (typeof canvas?.docJson !== "string") return false;
  if (Buffer.byteLength(canvas.docJson, "utf-8") > CANVAS_DOC_MAX_BYTES) return false;
  if (!Array.isArray(canvas.assets)) return false;
  const seen = new Set<string>();
  for (const asset of canvas.assets) {
    if (typeof asset?.assetId !== "string" || !CANVAS_ASSET_ID_PATTERN.test(asset.assetId)) {
      return false;
    }
    if (seen.has(asset.assetId)) return false;
    seen.add(asset.assetId);
  }
  return true;
}

/** Best-effort removal of `<id>.canvas.json` and `<id>.assets/`, so a reopen uses the flat PNG. */
export async function clearCanvas(vault: LibraryVault, id: string): Promise<void> {
  const paths = vault.companionPaths(id);
  await Promise.allSettled([
    rm(paths.canvasDoc, { force: true }),
    rm(paths.assetsDir, { recursive: true, force: true }),
  ]);
}

/**
 * Stores the canvas document beside a saved screenshot. Called after the PNG write: the PNG is
 * the save, so a failure here never throws. Assets go first, superseded assets are deleted
 * (they may hold unredacted pixels), and the document is written last: a reader that finds it
 * finds every asset it names. On any failure the document is removed, so a reopen falls back
 * to the flat PNG, which is current.
 */
export async function writeCanvas(
  vault: LibraryVault,
  id: string,
  canvas: CanvasSavePayload,
): Promise<void> {
  try {
    if (!isValidPayload(canvas)) {
      console.warn(`screenshot canvas: invalid payload for ${id}; keeping the flat PNG only`);
      await clearCanvas(vault, id);
      return;
    }
    const paths = vault.companionPaths(id);
    await mkdir(paths.assetsDir, { recursive: true });
    const keep = new Set<string>();
    for (const { assetId, png } of canvas.assets) {
      const file = `${assetId}.png`;
      await atomicWriteFile(join(paths.assetsDir, file), Buffer.from(png));
      keep.add(file);
    }
    for (const name of await readdir(paths.assetsDir)) {
      if (!keep.has(name)) await rm(join(paths.assetsDir, name), { recursive: true, force: true });
    }
    await atomicWriteFile(paths.canvasDoc, canvas.docJson);
  } catch (error) {
    console.warn(`screenshot canvas: could not store the document for ${id}`, error);
    await rm(vault.companionPaths(id).canvasDoc, { force: true }).catch(() => {});
  }
}

/** The image asset ids a document names, or null when it is not a document or an id is invalid. */
function imageAssetIds(docJson: string): string[] | null {
  let doc: unknown;
  try {
    doc = JSON.parse(docJson);
  } catch {
    return null;
  }
  const items = (doc as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return null;
  const ids = new Set<string>();
  for (const item of items) {
    if ((item as { kind?: unknown } | null)?.kind !== "image") continue;
    const assetId = (item as { assetId?: unknown }).assetId;
    if (typeof assetId !== "string" || !CANVAS_ASSET_ID_PATTERN.test(assetId)) return null;
    ids.add(assetId);
  }
  return [...ids];
}

const toArrayBuffer = (buf: Buffer): ArrayBuffer =>
  buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;

/** The stored document and its assets, or null for anything missing, oversized or corrupt. */
export async function readCanvas(
  vault: LibraryVault,
  id: string,
): Promise<CanvasReadResult | null> {
  try {
    const paths = vault.companionPaths(id);
    const info = await stat(paths.canvasDoc);
    if (!info.isFile() || info.size > CANVAS_DOC_MAX_BYTES) return null;
    const docJson = await readFile(paths.canvasDoc, "utf-8");
    const ids = imageAssetIds(docJson);
    if (ids === null) return null;
    const assets: Record<string, ArrayBuffer> = {};
    for (const assetId of ids) {
      assets[assetId] = toArrayBuffer(await readFile(join(paths.assetsDir, `${assetId}.png`)));
    }
    return { docJson, assets };
  } catch {
    return null;
  }
}
