/**
 * Text recognition over IPC (ADR 0055, NIW2-705). Type-only imports: this file is reachable
 * from the preload bundle, which cannot load workspace packages at runtime.
 *
 * Main caches what it recognizes in `.kaipu/<id>.text.json`, keyed by asset id and by the
 * sha256 of the PNG bytes it recognized, so a changed asset is recognized again.
 */
import type { RecognizedWord } from "@kaipu/domain/schemas";

export type { RecognizedWord };

export interface TextRecognitionRequest {
  /** The saved item, or null for a capture not saved yet (recognized, never cached). */
  id: string | null;
  /** The canvas asset the image is (`base` for the first image). */
  assetId: string;
  /** The image exactly as the editor loaded it, before any unsaved edit. */
  png: ArrayBuffer;
}

export type TextRecognitionResult =
  | { status: "ready"; words: RecognizedWord[] }
  /** No backend on this platform, the helper is missing, failed, timed out or printed junk. */
  | { status: "unavailable" };

/**
 * What a canvas-mode save sends so main can rewrite the cache for the assets it just wrote.
 * The renderer has already removed every word a baked redaction intersects. A save without
 * this payload deletes the cache.
 */
export interface TextCacheSavePayload {
  assets: { assetId: string; words: RecognizedWord[] }[];
}
