import { describe, expect, it } from "vitest";

import {
  recognizedWordsSchema,
  textOfWords,
  wordsInReadingOrder,
  wordsOutsideRects,
  type RecognizedWord,
} from "./text-recognition";

const word = (text: string, line: number, x: number, w = 10): RecognizedWord => ({
  text,
  line,
  rect: { x, y: line * 20, w, h: 10 },
  confidence: 0.9,
});

describe("wordsOutsideRects", () => {
  it("removes a word that overlaps a rect and keeps the others", () => {
    const hit = word("secret", 0, 0);
    const miss = word("public", 0, 100);
    expect(wordsOutsideRects([hit, miss], [{ x: 5, y: 0, w: 10, h: 10 }])).toEqual([miss]);
  });

  it("keeps a word that only touches the edge of a rect", () => {
    const touching = word("edge", 0, 0);
    expect(wordsOutsideRects([touching], [{ x: 10, y: 0, w: 10, h: 10 }])).toEqual([touching]);
  });

  it("treats a zero-size rect as a point: inside a word removes it, on its edge does not", () => {
    const w = word("point", 0, 0);
    expect(wordsOutsideRects([w], [{ x: 5, y: 5, w: 0, h: 0 }])).toEqual([]);
    expect(wordsOutsideRects([w], [{ x: 0, y: 5, w: 0, h: 0 }])).toEqual([w]);
  });

  it("returns the same array when there are no rects", () => {
    const words = [word("a", 0, 0)];
    expect(wordsOutsideRects(words, [])).toBe(words);
  });
});

describe("wordsInReadingOrder", () => {
  it("sorts by line, then by x", () => {
    const a = word("a", 1, 50);
    const b = word("b", 0, 80);
    const c = word("c", 0, 10);
    const d = word("d", 1, 5);
    expect(wordsInReadingOrder([a, b, c, d])).toEqual([c, b, d, a]);
  });

  it("does not mutate its input", () => {
    const input = [word("b", 1, 0), word("a", 0, 0)];
    const copy = [...input];
    const output = wordsInReadingOrder(input);
    expect(input).toEqual(copy);
    expect(output).not.toBe(input);
  });
});

describe("textOfWords", () => {
  it("joins a line with spaces and lines with a newline", () => {
    expect(textOfWords([word("one", 0, 0), word("two", 0, 20), word("three", 1, 0)])).toBe(
      "one two\nthree",
    );
  });

  it("is empty for no words", () => {
    expect(textOfWords([])).toBe("");
  });
});

describe("recognizedWordsSchema", () => {
  it("accepts a valid word", () => {
    expect(recognizedWordsSchema.safeParse([word("ok", 0, 0)]).success).toBe(true);
  });

  it("rejects a negative width", () => {
    const bad = { ...word("x", 0, 0), rect: { x: 0, y: 0, w: -1, h: 1 } };
    expect(recognizedWordsSchema.safeParse([bad]).success).toBe(false);
  });

  it("rejects a confidence above 1", () => {
    expect(recognizedWordsSchema.safeParse([{ ...word("x", 0, 0), confidence: 1.1 }]).success).toBe(
      false,
    );
  });

  it("rejects empty text", () => {
    expect(recognizedWordsSchema.safeParse([{ ...word("x", 0, 0), text: "" }]).success).toBe(false);
  });
});
