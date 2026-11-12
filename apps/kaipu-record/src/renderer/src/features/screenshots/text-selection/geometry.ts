import type { RecognizedWord } from "@kaipu/domain/schemas";
import type { Annotation } from "../annotations/scene";

/** A size in pixels. */
export interface PixelSize {
  w: number;
  h: number;
}
/** A point in the layer's normalized (0–1) space, the space annotations are stored in. */
export interface NormPoint {
  x: number;
  y: number;
}
export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A recognized word's box in normalized (0–1) coordinates of the base image. Words are
 * stored in the image's own pixels; normalizing them puts them in the same space as the
 * annotations, so the layer draws and hit-tests them under the same pan and zoom.
 */
export function wordBoxNorm(word: RecognizedWord, natural: PixelSize): PixelRect {
  return {
    x: word.rect.x / natural.w,
    y: word.rect.y / natural.h,
    w: word.rect.w / natural.w,
    h: word.rect.h / natural.h,
  };
}

/**
 * Where every redaction sits in base-image pixels, the way the save bakes it (same rounding:
 * out to whole pixels, clamped to the image). Locked redactions count too: they are already
 * part of the stored pixels.
 */
export function redactionRectsInPixels(
  annotations: readonly Annotation[],
  natural: PixelSize,
): PixelRect[] {
  if (natural.w <= 0 || natural.h <= 0) return [];
  const rects: PixelRect[] = [];
  for (const a of annotations) {
    if (a.kind !== "blur") continue;
    const x0 = Math.max(0, Math.floor(a.x * natural.w));
    const y0 = Math.max(0, Math.floor(a.y * natural.h));
    const x1 = Math.min(natural.w, Math.ceil((a.x + a.w) * natural.w));
    const y1 = Math.min(natural.h, Math.ceil((a.y + a.h) * natural.h));
    if (x1 > x0 && y1 > y0) rects.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }
  return rects;
}

/**
 * The word nearest to a point, with its distance in DISPLAY pixels (0 when the point is on
 * the word). The distance is measured on screen, not in image pixels, so the "near a word"
 * tolerance feels the same at any zoom. `ordered` is returned by index.
 */
export function nearestWord(
  ordered: readonly RecognizedWord[],
  p: NormPoint,
  natural: PixelSize,
  display: PixelSize,
): { index: number; distPx: number } | null {
  let best: { index: number; distPx: number } | null = null;
  for (let i = 0; i < ordered.length; i += 1) {
    const box = wordBoxNorm(ordered[i], natural);
    const dx = Math.max(box.x - p.x, 0, p.x - (box.x + box.w)) * display.w;
    const dy = Math.max(box.y - p.y, 0, p.y - (box.y + box.h)) * display.h;
    const distPx = Math.hypot(dx, dy);
    if (best === null || distPx < best.distPx) best = { index: i, distPx };
    if (distPx === 0) break;
  }
  return best;
}

/** Words between two words of `ordered`, both included, in reading order. */
export function wordRange(
  ordered: readonly RecognizedWord[],
  a: RecognizedWord,
  b: RecognizedWord,
): RecognizedWord[] {
  const ia = ordered.indexOf(a);
  const ib = ordered.indexOf(b);
  if (ia < 0 || ib < 0) return [];
  return ordered.slice(Math.min(ia, ib), Math.max(ia, ib) + 1);
}
