/**
 * The colors panel's counting (NIW2-704). Pure and DOM-free: it runs inside the colors worker
 * and in tests, and the view only reads its result, so NIW2-708 can restyle the panel freely.
 *
 * A photograph has millions of distinct colors and comparing every pair is quadratic, so the
 * work is split into linear passes:
 *
 * 1. Count every exact color in a table of 2^24 counters (a fixed 64 MiB, no hashing).
 * 2. Quantize: drop the low bits of each channel, which leaves at most `BIN_COUNT` bins.
 * 3. Group bins, most frequent first. A bin joins the nearest group seed closer than
 *    `GROUP_DISTANCE` in OKLab, otherwise it seeds a new group. Seeds live in a grid whose
 *    cell is that distance, so each bin looks at 27 cells, not at every group.
 * 4. Every group keeps its most frequent exact members, so two near-identical whites end up
 *    in one group and are listed side by side.
 *
 * Fully transparent pixels are not counted. Translucent ones count by their RGB.
 */
import { srgbToOklab, type Rgba } from "../color";

/** Bits kept per channel. 5 leaves 32 levels per channel and 32,768 bins. */
export const QUANT_BITS = 5;
const SHIFT = 8 - QUANT_BITS;
export const BIN_COUNT = 1 << (QUANT_BITS * 3);
/**
 * OKLab distance under which two bins are one group. 0.02 is about a just-noticeable
 * difference; 0.03 still puts #ffffff and #f5f5f5 together, which is the point: the panel
 * shows both inside the group instead of hiding one of them.
 */
export const GROUP_DISTANCE = 0.03;
/** Exact members kept per group. */
export const MAX_MEMBERS = 6;
/** A member under this share of its group (anti-aliasing, noise) is not listed. */
export const NOTABLE_MEMBER_SHARE = 0.01;
/** Groups sent to the panel; the rest are only counted. */
export const MAX_GROUPS = 200;

export interface ColorMember {
  /** 0xRRGGBB. */
  rgb: number;
  count: number;
}

export interface ColorGroup {
  /** Position in `ColorAnalysis.groups`, most frequent first. */
  id: number;
  /** The most frequent exact color in the group: the swatch the panel shows. */
  rgb: number;
  count: number;
  /** Distinct exact colors in the group. */
  distinct: number;
  /** The notable exact members, most frequent first; the first one is `rgb`. */
  members: ColorMember[];
}

export interface ColorAnalysis {
  width: number;
  height: number;
  /** Pixels counted: every pixel whose alpha is above 0. */
  counted: number;
  /** Distinct exact colors in the image. */
  distinct: number;
  /** Groups found; `groups` holds only the first `MAX_GROUPS` of them. */
  totalGroups: number;
  groups: ColorGroup[];
}

/** The analysis plus what `locateMask` needs to find a group's pixels again. */
export interface ColorIndex {
  analysis: ColorAnalysis;
  /** Group id of every bin (-1 for an empty bin). */
  groupOfBin: Int32Array;
}

export type LocateTarget = { kind: "group"; id: number } | { kind: "color"; rgb: number };

export function binOf(r: number, g: number, b: number): number {
  return ((r >> SHIFT) << (2 * QUANT_BITS)) | ((g >> SHIFT) << QUANT_BITS) | (b >> SHIFT);
}

export const packRgb = (r: number, g: number, b: number): number => (r << 16) | (g << 8) | b;

export function unpackRgb(rgb: number): Rgba {
  return { r: (rgb >> 16) & 255, g: (rgb >> 8) & 255, b: rgb & 255, a: 255 };
}

// Grid cell key for OKLab coordinates. L spans 0-1, a and b about -0.4 to 0.4, so the
// offsets keep every index positive at GROUP_DISTANCE.
const cellIndex = (v: number): number => Math.floor(v / GROUP_DISTANCE);
const cellKey = (l: number, a: number, b: number): number =>
  ((l + 64) * 256 + (a + 128)) * 256 + (b + 128);

export function analyzeColors(data: Uint8ClampedArray, width: number, height: number): ColorIndex {
  // 1. Exact counts.
  const exact = new Uint32Array(1 << 24);
  let counted = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    exact[(data[i] << 16) | (data[i + 1] << 8) | data[i + 2]]++;
    counted++;
  }

  // 2. Bins: count and the sum of each channel, for the bin's mean color.
  const binCount = new Float64Array(BIN_COUNT);
  const sumR = new Float64Array(BIN_COUNT);
  const sumG = new Float64Array(BIN_COUNT);
  const sumB = new Float64Array(BIN_COUNT);
  let distinct = 0;
  for (let key = 0; key < exact.length; key++) {
    const c = exact[key];
    if (c === 0) continue;
    distinct++;
    const r = key >> 16;
    const g = (key >> 8) & 255;
    const b = key & 255;
    const bin = binOf(r, g, b);
    binCount[bin] += c;
    sumR[bin] += r * c;
    sumG[bin] += g * c;
    sumB[bin] += b * c;
  }

  const bins: number[] = [];
  for (let bin = 0; bin < BIN_COUNT; bin++) if (binCount[bin] > 0) bins.push(bin);
  bins.sort((x, y) => binCount[y] - binCount[x] || x - y);

  // 3. Group bins around seeds, most frequent first.
  const seedL: number[] = [];
  const seedA: number[] = [];
  const seedB: number[] = [];
  const rawCount: number[] = [];
  const cells = new Map<number, number[]>();
  const rawGroupOfBin = new Int32Array(BIN_COUNT).fill(-1);
  const limit = GROUP_DISTANCE * GROUP_DISTANCE;
  for (const bin of bins) {
    const n = binCount[bin];
    const lab = srgbToOklab([
      Math.round(sumR[bin] / n),
      Math.round(sumG[bin] / n),
      Math.round(sumB[bin] / n),
    ]);
    const cl = cellIndex(lab.l);
    const ca = cellIndex(lab.a);
    const cb = cellIndex(lab.b);
    let best = -1;
    let bestD = limit;
    for (let dl = -1; dl <= 1; dl++) {
      for (let da = -1; da <= 1; da++) {
        for (let db = -1; db <= 1; db++) {
          const seeds = cells.get(cellKey(cl + dl, ca + da, cb + db));
          if (!seeds) continue;
          for (const g of seeds) {
            const d = (seedL[g] - lab.l) ** 2 + (seedA[g] - lab.a) ** 2 + (seedB[g] - lab.b) ** 2;
            if (d < bestD || (d === bestD && best !== -1 && g < best)) {
              best = g;
              bestD = d;
            }
          }
        }
      }
    }
    if (best === -1) {
      best = seedL.length;
      seedL.push(lab.l);
      seedA.push(lab.a);
      seedB.push(lab.b);
      rawCount.push(0);
      const key = cellKey(cl, ca, cb);
      const list = cells.get(key);
      if (list) list.push(best);
      else cells.set(key, [best]);
    }
    rawGroupOfBin[bin] = best;
    rawCount[best] += n;
  }

  // Number groups by size, most frequent first (ties: the earlier seed).
  const order = rawCount.map((_, i) => i).sort((x, y) => rawCount[y] - rawCount[x] || x - y);
  const rank = new Int32Array(order.length);
  order.forEach((raw, id) => (rank[raw] = id));
  const groupOfBin = new Int32Array(BIN_COUNT).fill(-1);
  for (let bin = 0; bin < BIN_COUNT; bin++) {
    if (rawGroupOfBin[bin] !== -1) groupOfBin[bin] = rank[rawGroupOfBin[bin]];
  }

  // 4. Exact members of the groups that are sent: the top MAX_MEMBERS by count.
  const sent = Math.min(order.length, MAX_GROUPS);
  const groupDistinct = new Uint32Array(order.length);
  const topRgb = new Int32Array(sent * MAX_MEMBERS);
  const topCount = new Uint32Array(sent * MAX_MEMBERS);
  const topLen = new Uint8Array(sent);
  for (let key = 0; key < exact.length; key++) {
    const c = exact[key];
    if (c === 0) continue;
    const g = groupOfBin[binOf(key >> 16, (key >> 8) & 255, key & 255)];
    groupDistinct[g]++;
    if (g >= sent) continue;
    const base = g * MAX_MEMBERS;
    const len = topLen[g];
    // Insert keeping counts descending; an equal count stays after (ascending color order).
    let at = len;
    while (at > 0 && topCount[base + at - 1] < c) at--;
    if (at >= MAX_MEMBERS) continue;
    const end = Math.min(len, MAX_MEMBERS - 1);
    for (let j = end; j > at; j--) {
      topCount[base + j] = topCount[base + j - 1];
      topRgb[base + j] = topRgb[base + j - 1];
    }
    topCount[base + at] = c;
    topRgb[base + at] = key;
    if (len < MAX_MEMBERS) topLen[g] = len + 1;
  }

  const groups: ColorGroup[] = [];
  for (let id = 0; id < sent; id++) {
    const count = rawCount[order[id]];
    const base = id * MAX_MEMBERS;
    const members: ColorMember[] = [];
    for (let j = 0; j < topLen[id]; j++) {
      const memberCount = topCount[base + j];
      if (j > 0 && memberCount < count * NOTABLE_MEMBER_SHARE) break;
      members.push({ rgb: topRgb[base + j], count: memberCount });
    }
    groups.push({ id, rgb: members[0].rgb, count, distinct: groupDistinct[id], members });
  }

  return {
    analysis: { width, height, counted, distinct, totalGroups: order.length, groups },
    groupOfBin,
  };
}

/** Alpha of the dimmed (non-matching) pixels in the locate overlay: black at about 70%. */
export const DIM_ALPHA = 180;

/**
 * The locate overlay at the image's size: transparent where a pixel matches `target`, dim
 * black everywhere else. `matched` is how many pixels match.
 */
export function locateMask(
  data: Uint8ClampedArray,
  groupOfBin: Int32Array,
  target: LocateTarget,
): { mask: Uint8ClampedArray<ArrayBuffer>; matched: number } {
  const mask = new Uint8ClampedArray(data.length);
  let matched = 0;
  const wanted = target.kind === "group" ? target.id : target.rgb;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const hit =
      data[i + 3] !== 0 &&
      (target.kind === "group"
        ? groupOfBin[binOf(r, g, b)] === wanted
        : ((r << 16) | (g << 8) | b) === wanted);
    if (hit) matched++;
    else mask[i + 3] = DIM_ALPHA;
  }
  return { mask, matched };
}

/** A share as the panel prints it: one decimal, "<0.1%" for a trace, "100%" for all of it. */
export function formatShare(count: number, total: number): string {
  if (total <= 0 || count <= 0) return "0%";
  if (count >= total) return "100%";
  const pct = (count / total) * 100;
  if (pct < 0.1) return "<0.1%";
  if (pct > 99.9) return ">99.9%";
  return `${pct.toFixed(1)}%`;
}
