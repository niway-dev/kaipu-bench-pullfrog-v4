import { deflateSync } from "node:zlib";

/**
 * Two screenshots drawn in code for the image-editor mock states (NIW2-713). The gray window
 * fixtures are all dark and the text fixture is a small light image, so neither can show a badge
 * over a dark and a light part of one image, or a redaction over text on a canvas-sized image.
 * Both are 1600x1000 (16:10 like the window fixtures), so the editor scales them down to fit and
 * a drag fraction lands on the same part of the image whatever the window size.
 */

type Rgb = readonly [number, number, number];
/** x, y, width, height, colour: painted in order. */
type Rect = readonly [number, number, number, number, Rgb];

export const MOCK_SHOT_SIZE = { width: 1600, height: 1000 } as const;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

/** An 8-bit RGB PNG: a background and rectangles painted over it. Deterministic. */
export function paintPng(
  width: number,
  height: number,
  background: Rgb,
  rects: readonly Rect[],
): Buffer {
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    raw[row] = 0; // filter: none
    for (let x = 0; x < width; x++) raw.set(background, row + 1 + x * 3);
  }
  for (const [rx, ry, rw, rh, color] of rects) {
    for (let y = ry; y < Math.min(height, ry + rh); y++) {
      for (let x = rx; x < Math.min(width, rx + rw); x++) raw.set(color, y * stride + 1 + x * 3);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const DARK: Rgb = [43, 45, 51];
const LIGHT: Rgb = [244, 244, 247];

/** The top half is dark and the bottom half light: badges of every size over both. */
export function stepSizesPng(): Buffer {
  const { width, height } = MOCK_SHOT_SIZE;
  return paintPng(width, height, LIGHT, [[0, 0, width, height / 2, DARK]]);
}

/** Word widths (px) of each text-like row of the two columns of `redactionPng`. */
const COLUMN_ROWS: readonly (readonly number[])[] = [
  [90, 140, 70, 120, 60],
  [150, 80, 110, 100],
  [70, 120, 130, 90, 50],
  [110, 90, 60, 140],
  [130, 100, 80, 70, 60],
];

/** A light "settings" page with two columns of text-like rows: the image a redaction hides. */
export function redactionPng(): Buffer {
  const { width, height } = MOCK_SHOT_SIZE;
  const ink: Rgb = [96, 98, 108];
  const rects: Rect[] = [
    [0, 0, width, 90, [232, 233, 238]],
    [60, 30, 320, 30, [60, 60, 68]],
  ];
  for (const left of [160, 880]) {
    COLUMN_ROWS.forEach((words, row) => {
      let x = left;
      for (const w of words) {
        rects.push([x, 300 + row * 64, w, 26, ink]);
        x += w + 16;
      }
    });
  }
  return paintPng(width, height, LIGHT, rects);
}
