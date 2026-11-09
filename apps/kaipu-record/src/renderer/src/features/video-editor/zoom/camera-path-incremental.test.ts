/**
 * Differential checks for the incremental camera path:
 *   - after any sequence of edits, `rebuildCameraPath` returns the same Float32Arrays,
 *     bit for bit, as a full `buildCameraBuild` of the same inputs;
 *   - both stay within 1e-6 of the simulation that shipped before rest snapping (the
 *     oracle below, copied verbatim from camera-path.ts at bcc883cc, so a change to the
 *     shared simulation cannot move it).
 */
import { describe, expect, it } from "vitest";
import { type CursorTrack, sampleCursor } from "@shared/cursor-track";
import {
  buildCameraBuild,
  buildCameraPath,
  CAMERA,
  type CameraBuild,
  type CameraPath,
  rebuildCameraPath,
  springStep,
} from "./camera-path";
import { ZOOM_DEFAULTS, ZOOM_LIMITS, type ZoomSegment } from "./zoom-model";

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
function segmentAt(segments: ZoomSegment[], t: number, hint: { i: number }): ZoomSegment | null {
  while (hint.i < segments.length && segments[hint.i].end <= t) hint.i++;
  const s = segments[hint.i];
  return s && s.start <= t ? s : null;
}

function oracle(
  segments: ZoomSegment[],
  track: CursorTrack | null,
  sourceDurationSeconds: number,
): CameraPath {
  const fps = CAMERA.fps;
  const n = Math.max(1, Math.ceil(sourceDurationSeconds * fps) + 1);
  const cxOut = new Float32Array(n);
  const cyOut = new Float32Array(n);
  const scaleOut = new Float32Array(n);
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const dt = 1 / fps;
  // Two independent cursors into `sorted`: one for `t`, one for the lookahead `u`.
  const hintNow = { i: 0 };
  const hintAhead = { i: 0 };

  let cx = 0.5;
  let cy = 0.5;
  let vx = 0;
  let vy = 0;
  let s = 1;
  let vs = 0;
  let tx = 0.5;
  let ty = 0.5;
  let smoothing: number = ZOOM_DEFAULTS.smoothing;
  let activeId: string | null = null;

  for (let i = 0; i < n; i++) {
    const t = i * dt;
    const u = t + CAMERA.lookaheadSeconds;
    // The lookahead is ANTICIPATION: it may open a segment early, never close one
    // early. Looking the segment up at `u` alone would also zoom OUT 200 ms before
    // `segment.end`, desynchronising the camera from the timeline block, the camera
    // box and the export fast path. So: a segment still covering `t` wins; otherwise
    // the one the camera can already see coming at `u` opens.
    const open = segmentAt(sorted, t, hintNow);
    const opening = segmentAt(sorted, u, hintAhead);
    const seg = open ?? opening;
    const targetScale = seg ? clamp(seg.scale, 1, ZOOM_LIMITS.maxScale) : 1;

    if (seg) {
      smoothing = seg.smoothing;
      if (seg.mode === "fixed" && seg.anchor) {
        tx = seg.anchor.x;
        ty = seg.anchor.y;
      } else if (seg.mode === "fixed") {
        // A fixed segment whose anchor is null holds the target where it already was
        // (the frame centre on a fresh path). It must NOT fall through to the follow
        // branch and silently track the cursor.
      } else if (track) {
        const p = sampleCursor(track, u * 1000);
        if (p) {
          const px = clamp(p.x, 0, 1);
          const py = clamp(p.y, 0, 1);
          if (seg.id !== activeId) {
            // Entering a segment: aim straight at the action, no deadzone.
            tx = px;
            ty = py;
          } else {
            // The deadzone is measured from the current TARGET, not from the camera
            // centre: the camera is still easing toward the target, so measuring from
            // it would re-trigger on every step and defeat the deadzone.
            const dz = CAMERA.deadzone * (0.5 / Math.max(s, 1));
            if (px > tx + dz) tx = px - dz;
            else if (px < tx - dz) tx = px + dz;
            if (py > ty + dz) ty = py - dz;
            else if (py < ty - dz) ty = py + dz;
          }
        }
      }
      // `follow` with no cursor track (window source, pre-v2 recording) leaves the
      // target alone too — the segment zooms on the frame centre.
    }
    activeId = seg ? seg.id : null;

    if (i > 0) {
      const k = clamp(smoothing, 0, 100) / 100;
      const wc = lerp(CAMERA.centerOmegaSnappy, CAMERA.centerOmegaSmooth, k);
      const ws = lerp(CAMERA.scaleOmegaSnappy, CAMERA.scaleOmegaSmooth, k);
      [cx, vx] = springStep(cx, vx, tx, wc, dt);
      [cy, vy] = springStep(cy, vy, ty, wc, dt);
      [s, vs] = springStep(s, vs, targetScale, ws, dt);
    }

    // Clamp the STATE (not just the output) so springs never wind up past the frame.
    if (s < 1 || s > ZOOM_LIMITS.maxScale) {
      s = clamp(s, 1, ZOOM_LIMITS.maxScale);
      vs = 0;
    }
    const half = 0.5 / s;
    if (cx < half || cx > 1 - half) {
      cx = clamp(cx, half, 1 - half);
      vx = 0;
    }
    if (cy < half || cy > 1 - half) {
      cy = clamp(cy, half, 1 - half);
      vy = 0;
    }

    cxOut[i] = cx;
    cyOut[i] = cy;
    scaleOut[i] = s;
  }
  return { fps, cx: cxOut, cy: cyOut, scale: scaleOut };
}

/** Deterministic PRNG (mulberry32) so a failure reproduces from its seed. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomTrack(r: () => number, duration: number): CursorTrack {
  const t: number[] = [];
  const x: number[] = [];
  const y: number[] = [];
  for (let ms = 0; ms < duration * 1000; ms += 50 + r() * 400) {
    t.push(ms);
    x.push(r() * 1.2 - 0.1); // a little outside the frame too: the sim clamps it
    y.push(r() * 1.2 - 0.1);
  }
  return {
    version: 1,
    display: { id: "1", width: 1600, height: 1000, scaleFactor: 2 },
    anchor: "exact",
    clicksAvailable: true,
    t,
    x,
    y,
    clicks: [],
  };
}

let nextId = 0;
function randomSegment(r: () => number, start: number, end: number): ZoomSegment {
  const fixed = r() < 0.3;
  return {
    id: `z${nextId++}`,
    start,
    end,
    scale: 1 + r() * 3.5, // sometimes past maxScale: the sim clamps it
    mode: fixed ? "fixed" : "follow",
    anchor: fixed && r() < 0.7 ? { x: r(), y: r() } : null,
    smoothing: Math.round(r() * 100),
    origin: "auto",
    trigger: "click",
  };
}

/** Non-overlapping segments with gaps of every size, including none at all. */
function randomSegments(r: () => number, duration: number): ZoomSegment[] {
  const out: ZoomSegment[] = [];
  let t = r() * 3;
  while (t < duration - 1) {
    const len = r() < 0.1 ? 20 + r() * 60 : 1 + r() * 8;
    const end = Math.min(duration, t + len);
    out.push(randomSegment(r, t, end));
    const gap = r() < 0.2 ? 0 : r() < 0.5 ? r() * 2 : r() * 25;
    t = end + gap;
  }
  return out;
}

/** One edit as the editor makes them: the touched segment is a new object, others kept. */
function randomEdit(r: () => number, segments: ZoomSegment[], duration: number): ZoomSegment[] {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const kind = r();
  if (sorted.length === 0 || kind < 0.1) {
    // Add one in a free gap (or nowhere, if there is none).
    let lo = 0;
    for (const s of [...sorted, null]) {
      const hi = s ? s.start : duration;
      if (hi - lo > 1.2 && r() < 0.5) {
        const a = lo + r() * (hi - lo - 1.1);
        return [...segments, randomSegment(r, a, Math.min(hi, a + 1 + r() * (hi - a - 1)))];
      }
      if (s) lo = s.end;
    }
    return [...segments];
  }
  const i = Math.floor(r() * sorted.length);
  const s = sorted[i];
  const prevEnd = i > 0 ? sorted[i - 1].end : 0;
  const nextStart = i < sorted.length - 1 ? sorted[i + 1].start : duration;
  if (kind < 0.2) return segments.filter((x) => x !== s);
  if (kind < 0.25) return [...segments]; // no change, new array
  if (kind < 0.3) return segments.map((x) => (x === s ? { ...s, origin: "manual" } : x));
  let next: ZoomSegment;
  if (kind < 0.6) {
    // Edge drag, clamped between the neighbours and to a 1 s minimum.
    const end = Math.max(s.start + 1, Math.min(nextStart, s.end + (r() - 0.5) * 10));
    next = { ...s, end, origin: "manual" };
  } else if (kind < 0.8) {
    const start = Math.min(s.end - 1, Math.max(prevEnd, s.start + (r() - 0.5) * 10));
    next = { ...s, start, origin: "manual" };
  } else {
    const fixed = r() < 0.5;
    next = {
      ...s,
      scale: 1 + r() * 3,
      smoothing: Math.round(r() * 100),
      mode: fixed ? "fixed" : "follow",
      anchor: fixed && r() < 0.7 ? { x: r(), y: r() } : null,
    };
  }
  return segments.map((x) => (x === s ? next : x));
}

function firstDifference(a: CameraPath, b: CameraPath): string | null {
  if (a.scale.length !== b.scale.length) return `length ${a.scale.length} vs ${b.scale.length}`;
  for (let i = 0; i < a.scale.length; i++) {
    // Object.is: bit-level intent (and -0 vs 0 would show up).
    if (
      !Object.is(a.cx[i], b.cx[i]) ||
      !Object.is(a.cy[i], b.cy[i]) ||
      !Object.is(a.scale[i], b.scale[i])
    ) {
      return `index ${i}: (${a.cx[i]}, ${a.cy[i]}, ${a.scale[i]}) vs (${b.cx[i]}, ${b.cy[i]}, ${b.scale[i]})`;
    }
  }
  return null;
}

function maxDeviation(a: CameraPath, b: CameraPath): number {
  let max = 0;
  for (let i = 0; i < a.scale.length; i++) {
    max = Math.max(
      max,
      Math.abs(a.cx[i] - b.cx[i]),
      Math.abs(a.cy[i] - b.cy[i]),
      Math.abs(a.scale[i] - b.scale[i]),
    );
  }
  return max;
}

/**
 * The incremental build must equal the full one in everything a LATER rebuild reads, not
 * only in the path: a wrong checkpoint or rest run is invisible until it is resumed from.
 */
function buildDifference(a: CameraBuild, b: CameraBuild): string | null {
  const path = firstDifference(a.path, b.path);
  if (path) return `path ${path}`;
  const da = a.checkpoints.data;
  const db = b.checkpoints.data;
  if (da.length !== db.length) return "checkpoint count";
  // Slot 0 is never written nor read.
  for (let i = 9; i < da.length; i++) {
    if (!Object.is(da[i], db[i])) return `checkpoint value ${i}: ${da[i]} vs ${db[i]}`;
  }
  for (let j = 1; j < a.checkpoints.ids.length; j++) {
    if (a.checkpoints.ids[j] !== b.checkpoints.ids[j]) return `checkpoint id ${j}`;
  }
  if (JSON.stringify(a.rests) !== JSON.stringify(b.rests)) return "rest runs";
  return null;
}

describe("buildCameraPath", () => {
  it("stays within 1e-6 of the simulation before rest snapping", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const r = rng(seed);
      const duration = 20 + r() * 100;
      const track = r() < 0.8 ? randomTrack(r, duration) : null;
      const segments = randomSegments(r, duration);
      const path = buildCameraPath(segments, track, duration);
      const old = oracle(segments, track, duration);
      expect(path.scale.length, `seed ${seed}`).toBe(old.scale.length);
      expect(maxDeviation(path, old), `seed ${seed}`).toBeLessThan(1e-6);
    }
  });
});

describe("rebuildCameraPath", () => {
  it("equals a full rebuild after every edit of a random edit sequence", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const r = rng(seed * 7919);
      const duration = 30 + r() * 150;
      const track = r() < 0.8 ? randomTrack(r, duration) : null;
      let segments = randomSegments(r, duration);
      let build: CameraBuild = buildCameraBuild(segments, track, duration);
      for (let step = 0; step < 25; step++) {
        // Some steps change several segments at once, far apart (undo of a batch, a
        // re-detection): the gap between two changes must not be taken for the tail.
        const edits = r() < 0.3 ? 2 + Math.floor(r() * 3) : 1;
        for (let e = 0; e < edits; e++) segments = randomEdit(r, segments, duration);
        build = rebuildCameraPath(build, segments, track, duration);
        const full = buildCameraBuild(segments, track, duration);
        expect(buildDifference(build, full), `seed ${seed}, edit ${step}`).toBeNull();
        expect(maxDeviation(full.path, oracle(segments, track, duration))).toBeLessThan(1e-6);
      }
    }
  });

  it("follows a live edge drag frame by frame without drifting", () => {
    const r = rng(42);
    const duration = 600;
    const track = randomTrack(r, duration);
    const segments = randomSegments(r, duration);
    const target = segments[Math.floor(segments.length / 2)];
    const limit = segments.find((s) => s.start > target.end)?.start ?? duration;
    let build = buildCameraBuild(segments, track, duration);
    let current = segments;
    for (let k = 1; k <= 30; k++) {
      const end = Math.min(limit, target.end + k * 0.37);
      current = current.map((s) => (s.id === target.id ? { ...target, end } : s));
      build = rebuildCameraPath(build, current, track, duration);
    }
    expect(firstDifference(build.path, buildCameraPath(current, track, duration))).toBeNull();
  });

  it("keeps the same path object when no segment object changed", () => {
    const segments = [randomSegment(rng(3), 2, 5)];
    const build = buildCameraBuild(segments, null, 10);
    expect(rebuildCameraPath(build, [...segments], null, 10).path).toBe(build.path);
  });

  it("rebuilds from scratch when the track or the duration changes", () => {
    const r = rng(5);
    const segments = randomSegments(r, 60);
    const a = randomTrack(r, 60);
    const b = randomTrack(r, 60);
    const build = buildCameraBuild(segments, a, 60);
    expect(
      firstDifference(
        rebuildCameraPath(build, segments, b, 60).path,
        buildCameraPath(segments, b, 60),
      ),
    ).toBeNull();
    expect(
      firstDifference(
        rebuildCameraPath(build, segments, a, 61).path,
        buildCameraPath(segments, a, 61),
      ),
    ).toBeNull();
  });

  it("re-simulates only the moved stretch when the end of a long block is dragged", () => {
    // 100% timeline zoom on a 54-minute take: 300 px is ~13 minutes, so a dragged block
    // grows to minutes. The rebuild must not re-simulate the whole block each frame.
    const r = rng(77);
    const duration = 54 * 60;
    const track = randomTrack(r, duration);
    const long = { ...randomSegment(r, 1500, 1512), mode: "follow" as const };
    let segments = [randomSegment(r, 100, 110), long, randomSegment(r, 2700, 2710)];
    let build = buildCameraBuild(segments, track, duration);
    for (let end = 1512; end <= 2290; end += 6.5) {
      segments = segments.map((s) => (s.id === long.id ? { ...long, end } : s));
      build = rebuildCameraPath(build, segments, track, duration);
    }
    expect(firstDifference(build.path, buildCameraPath(segments, track, duration))).toBeNull();
    const step = segments.map((s) => (s.id === long.id ? { ...long, end: 2296.5 } : s));
    const t0 = performance.now();
    rebuildCameraPath(build, step, track, duration);
    const incremental = performance.now() - t0;
    const t1 = performance.now();
    buildCameraBuild(step, track, duration);
    const full = performance.now() - t1;
    expect(incremental).toBeLessThan(full / 3);
  });

  it("re-simulates only around the edit on a long take", () => {
    // A 54-minute take with ~128 zooms (the owner's case). The edit is one zoom in the
    // middle, so the copied prefix and tail must cover most of the path.
    const r = rng(54);
    const duration = 54 * 60;
    const track = randomTrack(r, duration);
    const segments: ZoomSegment[] = [];
    for (let k = 0; k < 128; k++) {
      const start = 5 + k * 25 + r() * 5;
      segments.push(randomSegment(r, start, start + 3 + r() * 8));
    }
    const build = buildCameraBuild(segments, track, duration);
    const target = segments[64];
    const edited = segments.map((s) => (s === target ? { ...s, end: s.end + 2 } : s));
    const t0 = performance.now();
    const next = rebuildCameraPath(build, edited, track, duration);
    const incremental = performance.now() - t0;
    const t1 = performance.now();
    buildCameraBuild(edited, track, duration);
    const full = performance.now() - t1;
    expect(firstDifference(next.path, buildCameraPath(edited, track, duration))).toBeNull();
    // Generous: the point is "a fraction", not a benchmark (CI machines are noisy).
    expect(incremental).toBeLessThan(full / 3);
  });
});

// Keep the imports honest: the oracle uses the module's own constants and spring.
void CAMERA;
void springStep;
void ZOOM_DEFAULTS;
void ZOOM_LIMITS;
void sampleCursor;
