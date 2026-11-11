import { describe, expect, it } from "vitest";
import { wordsOutsideRects, type RecognizedWord } from "@kaipu/domain/schemas";
import type { Annotation } from "../annotations/scene";
import {
  blockRedactionRect,
  nearestBlock,
  redactionRectsInPixels,
  textBlocks,
  type PixelRect,
} from "./geometry";

const word = (
  text: string,
  line: number,
  x: number,
  y: number,
  w = 60,
  h = 20,
): RecognizedWord => ({
  text,
  line,
  rect: { x, y, w, h },
  confidence: 1,
});
const NATURAL = { w: 1000, h: 500 };
// Two lines 30 px apart; the gap between them (10 px) is wider than a full margin (5 px).
const A1 = word("Hello", 0, 100, 100);
const A2 = word("world", 0, 180, 100);
const B1 = word("second", 1, 100, 130, 80);
const B2 = word("line", 1, 200, 130);
const WORDS = [A1, A2, B1, B2];

/** The rect as the editor stores it (normalized), then back to pixels the way a save bakes it. */
const asSaved = (rect: PixelRect): PixelRect[] => {
  const blur: Annotation = {
    id: "r",
    kind: "blur",
    x: rect.x / NATURAL.w,
    y: rect.y / NATURAL.h,
    w: rect.w / NATURAL.w,
    h: rect.h / NATURAL.h,
  };
  return redactionRectsInPixels([blur], NATURAL);
};

describe("textBlocks", () => {
  it("groups words by line, in reading order, with the box that contains them", () => {
    const blocks = textBlocks([B2, A1, B1, A2]);
    expect(blocks.map((b) => b.line)).toEqual([0, 1]);
    expect(blocks[0].words).toEqual([A1, A2]);
    expect(blocks[0].rect).toEqual({ x: 100, y: 100, w: 140, h: 20 });
    expect(blocks[1].rect).toEqual({ x: 100, y: 130, w: 160, h: 20 });
  });

  it("no words, no blocks", () => {
    expect(textBlocks([])).toEqual([]);
  });
});

describe("nearestBlock", () => {
  // The image is shown at 500×250: half its pixels.
  const DISPLAY = { w: 500, h: 250 };
  it("is 0 inside a block's box, even between its words", () => {
    const blocks = textBlocks(WORDS);
    // (170, 110) px is the gap between "Hello" and "world".
    const hit = nearestBlock(blocks, { x: 170 / 1000, y: 110 / 500 }, NATURAL, DISPLAY);
    expect(hit).toEqual({ index: 0, distPx: 0 });
  });

  it("measures the distance on screen", () => {
    const blocks = textBlocks(WORDS);
    // 20 image px left of the first block = 10 display px.
    const hit = nearestBlock(blocks, { x: 80 / 1000, y: 110 / 500 }, NATURAL, DISPLAY);
    expect(hit?.index).toBe(0);
    expect(hit?.distPx).toBeCloseTo(10);
  });

  it("no blocks, or an image with no size: nothing", () => {
    expect(nearestBlock([], { x: 0, y: 0 }, NATURAL, DISPLAY)).toBeNull();
    expect(nearestBlock(textBlocks(WORDS), { x: 0, y: 0 }, { w: 0, h: 0 }, DISPLAY)).toBeNull();
  });
});

describe("blockRedactionRect", () => {
  it("grows the block by a quarter of its height", () => {
    const [first] = textBlocks(WORDS);
    expect(blockRedactionRect(first, WORDS, NATURAL)).toEqual({ x: 95, y: 95, w: 150, h: 30 });
  });

  it("after a save, the cache loses exactly the clicked block's words", () => {
    const blocks = textBlocks(WORDS);
    for (const block of blocks) {
      const kept = wordsOutsideRects(WORDS, asSaved(blockRedactionRect(block, WORDS, NATURAL)));
      expect(kept).toEqual(WORDS.filter((w) => !block.words.includes(w)));
    }
  });

  it("shrinks the margin rather than touch a word of another line", () => {
    // 4 px between the lines: a 5 px margin would reach line 1, half of it (2 px) does not.
    const near = word("near", 1, 100, 124);
    const words = [A1, A2, near];
    const [first] = textBlocks(words);
    const rect = blockRedactionRect(first, words, NATURAL);
    expect(rect).toEqual({ x: 98, y: 98, w: 144, h: 24 });
    expect(wordsOutsideRects(words, asSaved(rect))).toEqual([near]);
  });

  it("drops the margin when even half of it would touch", () => {
    const touching = word("touching", 1, 100, 121);
    const words = [A1, A2, touching];
    const [first] = textBlocks(words);
    expect(blockRedactionRect(first, words, NATURAL)).toEqual(first.rect);
  });

  it("stays inside the image", () => {
    const corner = word("corner", 0, 0, 0, 50, 20);
    const [block] = textBlocks([corner]);
    expect(blockRedactionRect(block, [corner], NATURAL)).toEqual({ x: 0, y: 0, w: 55, h: 25 });
  });
});
