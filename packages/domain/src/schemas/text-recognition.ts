import { z } from "zod";

/**
 * Text recognition (ADR 0055): words recognized in an image, with boxes in the image's own
 * pixels, top-left origin. Every backend (Apple Vision on macOS, Windows.Media.Ocr later)
 * returns this shape; anything that fails the schema is treated as "unavailable".
 */

const finite = z.number().finite();

export const recognizedWordSchema = z.object({
  text: z.string().min(1).max(512),
  /** Source pixels, top-left origin. */
  rect: z.object({
    x: finite,
    y: finite,
    w: finite.nonnegative(),
    h: finite.nonnegative(),
  }),
  /** Reading order of the line the word belongs to: 0 is the first line. */
  line: z.number().int().nonnegative(),
  /** 0–1. */
  confidence: finite.min(0).max(1),
});
export type RecognizedWord = z.infer<typeof recognizedWordSchema>;

/** Largest number of words a recognition may return; more is treated as a broken backend. */
export const MAX_RECOGNIZED_WORDS = 20_000;

export const recognizedWordsSchema = z.array(recognizedWordSchema).max(MAX_RECOGNIZED_WORDS);

/**
 * The port. `png` is the encoded image; the result is in its pixels. A backend that is
 * missing, fails, times out or prints something off-schema returns "unavailable", never throws.
 */
export interface TextRecognizer {
  recognize(png: Uint8Array): Promise<RecognizedWord[] | "unavailable">;
}

type Rect = RecognizedWord["rect"];

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** The words that touch none of `rects` (a redaction removes every word it intersects). */
export function wordsOutsideRects(words: RecognizedWord[], rects: Rect[]): RecognizedWord[] {
  if (rects.length === 0) return words;
  return words.filter((word) => !rects.some((rect) => intersects(word.rect, rect)));
}

/** Words in reading order: by line, then left to right. Returns a new array. */
export function wordsInReadingOrder(words: RecognizedWord[]): RecognizedWord[] {
  return [...words].sort((a, b) => a.line - b.line || a.rect.x - b.rect.x);
}

/**
 * The text of words already in reading order: words of a line joined by a space, lines by a
 * newline.
 */
export function textOfWords(ordered: RecognizedWord[]): string {
  let out = "";
  for (let i = 0; i < ordered.length; i++) {
    if (i > 0) out += ordered[i].line === ordered[i - 1].line ? " " : "\n";
    out += ordered[i].text;
  }
  return out;
}
