/**
 * The image editor's canvas document on disk (ADR 0053, NIW2-700). No workspace-package
 * imports: this file is reachable from the preload bundle.
 *
 * A saved screenshot is three things under the vault:
 * - `<id>.png` — the flattened export, always valid on its own;
 * - `.kaipu/<id>.canvas.json` — the document, serialized by the renderer;
 * - `.kaipu/<id>.assets/<assetId>.png` — each image as added, with saved redactions baked in.
 *
 * Main stores and returns the document verbatim. It reads only the asset ids out of it, to
 * know which files to load; the schema is the renderer's to validate.
 */

/** An asset id: a file name stem under `.kaipu/<id>.assets/`. Main refuses anything else. */
export const CANVAS_ASSET_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** What a canvas-mode save sends beside the flattened PNG. */
export interface CanvasSavePayload {
  /** The document as JSON text. */
  docJson: string;
  /** Every image asset the document references, redactions already baked in. */
  assets: { assetId: string; png: ArrayBuffer }[];
}

/** A document and its assets, as read back from the vault. */
export interface CanvasReadResult {
  docJson: string;
  /** Keyed by asset id: every image item's asset the document names. */
  assets: Record<string, ArrayBuffer>;
}
