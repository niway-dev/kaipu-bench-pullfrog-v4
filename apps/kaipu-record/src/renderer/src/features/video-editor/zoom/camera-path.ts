/**
 * Camera model. Damping, deadzone and "what did the camera aim at last" are STATE —
 * a camera with easing cannot be a stateless `cameraAt(t)`. To stay deterministic
 * (preview scrubbing and export must agree frame for frame) the whole camera is
 * SIMULATED ONCE over the source timeline at a fixed step (`CAMERA.fps`) from t = 0,
 * and every consumer samples the resulting path with `cameraAt(path, t)`.
 *
 * Same inputs → same Float32Arrays → identical preview and export. Recompute the
 * path whenever `segments` (or the track/duration) change; ~1 ms per minute of video.
 *
 * Coordinates: (cx, cy) is the normalized CENTER of the visible window; `scale` is the
 * magnification (1 = whole frame). The visible window is 1/scale of the frame on each
 * axis, so it always keeps the frame's aspect ratio.
 */
import { type CursorTrack, sampleCursor } from "@shared/cursor-track";
import { ZOOM_DEFAULTS, ZOOM_LIMITS, type ZoomSegment } from "./zoom-model";

export const CAMERA = {
  /** Simulation + sampling rate of the path. */
  fps: 60,
  /** The camera reacts to where the pointer WILL be (spec: ~200 ms anticipation). */
  lookaheadSeconds: 0.2,
  /** Half-size of the deadzone around the current TARGET, as a fraction of the visible half-window. */
  deadzone: 0.35,
  /** Spring angular frequency (1/s) for the center at smoothing 0 and 100. */
  centerOmegaSnappy: 14,
  centerOmegaSmooth: 3,
  /** Same for the scale. */
  scaleOmegaSnappy: 10,
  scaleOmegaSmooth: 4,
} as const;

export interface CameraPath {
  fps: number;
  cx: Float32Array;
  cy: Float32Array;
  scale: Float32Array;
}

export interface CameraState {
  cx: number;
  cy: number;
  scale: number;
}

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

/**
 * One exact step of a critically damped spring toward `goal` (stable for any dt,
 * never overshoots from rest). Returns [position, velocity].
 */
export function springStep(
  x: number,
  v: number,
  goal: number,
  omega: number,
  dt: number,
): [number, number] {
  const d = x - goal;
  const k = (v + omega * d) * dt;
  const e = Math.exp(-omega * dt);
  return [goal + (d + k) * e, (v - omega * k) * e];
}

/** The segment covering source time `t`, walking forward from `hint` (segments sorted, non-overlapping). */
function segmentAt(segments: ZoomSegment[], t: number, hint: { i: number }): ZoomSegment | null {
  while (hint.i < segments.length && segments[hint.i].end <= t) hint.i++;
  const s = segments[hint.i];
  return s && s.start <= t ? s : null;
}

/** Below this, a camera with no segment ahead is snapped to exact rest (see simulate). */
const REST_EPSILON = 1e-9;

/**
 * A stretch of the path where the camera sits at EXACT rest — centre (0.5, 0.5), scale 1,
 * every velocity 0 — and no segment is open or opening. From index `start` up to (not
 * including) `end` the outputs are the constants (0.5, 0.5, 1) and the state does not
 * move: the spring toward any target is clamped straight back to the centre while the
 * scale is 1. Only the carried target (`tx`, `ty`) and `smoothing` survive into the next
 * segment, so a run is a seam where a simulation can be resumed or spliced exactly.
 */
interface RestRun {
  start: number;
  end: number;
  tx: number;
  ty: number;
  smoothing: number;
}

/**
 * The whole simulation state every CHECKPOINT_STEPS steps, so a rebuild can resume in the
 * middle of a zoom (an edge drag on a 13-minute block re-simulates the moved edge, not the
 * block). Slot j holds the state right after index j * CHECKPOINT_STEPS - 1; slot 0 is
 * unused (a resume from 0 is a fresh start). Per slot, STATE_FIELDS numbers in `data`:
 * cx, cy, vx, vy, s, vs, tx, ty, smoothing — plus the active segment id in `ids`.
 */
interface Checkpoints {
  data: Float64Array;
  ids: (string | null)[];
}

const CHECKPOINT_STEPS = 60;
const STATE_FIELDS = 9;

/** A built path plus what an incremental rebuild needs to reuse it. */
export interface CameraBuild {
  path: CameraPath;
  segments: ZoomSegment[];
  track: CursorTrack | null;
  sourceDurationSeconds: number;
  rests: RestRun[];
  checkpoints: Checkpoints;
}

interface Splice {
  prev: CameraBuild;
  /** Splicing is only allowed from this index on: no changed segment reaches it. */
  fromIndex: number;
}

/**
 * The simulation itself. Runs from `i0` — 0, or a checkpoint boundary resumed from the
 * state stored in `checkpoints` slot `i0 / CHECKPOINT_STEPS` — to the end, or until it
 * settles into a rest run that `splice.prev` also had with the same carried state: from
 * there on the old path is the new path, so it is copied instead of simulated. `run` is
 * the rest run already open at `i0 - 1`, if any.
 */
function simulate(
  sorted: ZoomSegment[],
  track: CursorTrack | null,
  out: CameraPath,
  rests: RestRun[],
  checkpoints: Checkpoints,
  i0: number,
  openRun: RestRun | null,
  splice: Splice | null,
): void {
  const n = out.scale.length;
  const dt = 1 / out.fps;
  const cxOut = out.cx;
  const cyOut = out.cy;
  const scaleOut = out.scale;
  // Two independent cursors into `sorted`: one for `t`, one for the lookahead `u`.
  // segmentAt only ever walks forward past segments that have ended, so starting both at
  // 0 lands them where an uninterrupted run from t = 0 would have them.
  const hintNow = { i: 0 };
  const hintAhead = { i: 0 };

  const cp = checkpoints.data;
  const slot0 = (i0 / CHECKPOINT_STEPS) * STATE_FIELDS;
  const resumed = i0 > 0;
  let cx = resumed ? cp[slot0] : 0.5;
  let cy = resumed ? cp[slot0 + 1] : 0.5;
  let vx = resumed ? cp[slot0 + 2] : 0;
  let vy = resumed ? cp[slot0 + 3] : 0;
  let s = resumed ? cp[slot0 + 4] : 1;
  let vs = resumed ? cp[slot0 + 5] : 0;
  let tx = resumed ? cp[slot0 + 6] : 0.5;
  let ty = resumed ? cp[slot0 + 7] : 0.5;
  let smoothing: number = resumed ? cp[slot0 + 8] : ZOOM_DEFAULTS.smoothing;
  let activeId: string | null = resumed ? checkpoints.ids[i0 / CHECKPOINT_STEPS] : null;
  let run: RestRun | null = openRun;

  for (let i = i0; i < n; i++) {
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
    // Settle to EXACT rest once nothing is left to see. A critically damped spring only
    // approaches its goal: in float64 the scale reaches 1 but its velocity keeps halving
    // through denormals for minutes, so the state would never be exactly at rest and no
    // rest run (the seam incremental rebuilds splice at) would ever start. Every term is
    // below 1e-9 here — under the Float32 resolution the path is stored in.
    if (
      seg === null &&
      Math.abs(s - 1) < REST_EPSILON &&
      Math.abs(vs) < REST_EPSILON &&
      Math.abs(cx - 0.5) < REST_EPSILON &&
      Math.abs(cy - 0.5) < REST_EPSILON &&
      Math.abs(vx) < REST_EPSILON &&
      Math.abs(vy) < REST_EPSILON
    ) {
      s = 1;
      vs = 0;
      cx = 0.5;
      cy = 0.5;
      vx = 0;
      vy = 0;
    }

    cxOut[i] = cx;
    cyOut[i] = cy;
    scaleOut[i] = s;

    if ((i + 1) % CHECKPOINT_STEPS === 0) {
      const j = (i + 1) / CHECKPOINT_STEPS;
      const o = j * STATE_FIELDS;
      cp[o] = cx;
      cp[o + 1] = cy;
      cp[o + 2] = vx;
      cp[o + 3] = vy;
      cp[o + 4] = s;
      cp[o + 5] = vs;
      cp[o + 6] = tx;
      cp[o + 7] = ty;
      cp[o + 8] = smoothing;
      checkpoints.ids[j] = activeId;
    }

    const atRest =
      seg === null && s === 1 && vs === 0 && cx === 0.5 && cy === 0.5 && vx === 0 && vy === 0;
    if (!atRest) {
      if (run) run.end = i;
      run = null;
      continue;
    }
    if (!run) {
      run = { start: i, end: n, tx, ty, smoothing };
      rests.push(run);
    }
    if (splice && i >= splice.fromIndex) {
      const old = runAt(splice.prev.rests, i);
      if (old && old.tx === tx && old.ty === ty && old.smoothing === smoothing) {
        // Same exact state at the same index, and every segment from here on is the
        // same: the rest of the old path IS the rest of this one.
        run.end = old.end;
        const from = i + 1;
        cxOut.set(splice.prev.path.cx.subarray(from), from);
        cyOut.set(splice.prev.path.cy.subarray(from), from);
        scaleOut.set(splice.prev.path.scale.subarray(from), from);
        for (const r of splice.prev.rests) if (r.start > old.start) rests.push({ ...r });
        // Slots after index i hold the same states too.
        const firstSlot = Math.floor(from / CHECKPOINT_STEPS) + 1;
        const prevCp = splice.prev.checkpoints;
        cp.set(prevCp.data.subarray(firstSlot * STATE_FIELDS), firstSlot * STATE_FIELDS);
        for (let j = firstSlot; j < prevCp.ids.length; j++) checkpoints.ids[j] = prevCp.ids[j];
        return;
      }
    }
  }
}

/** The rest run covering index `i`, by binary search over runs sorted by `start`. */
function runAt(rests: RestRun[], i: number): RestRun | null {
  let lo = 0;
  let hi = rests.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = rests[mid];
    if (i < r.start) hi = mid - 1;
    else if (i >= r.end) lo = mid + 1;
    else return r;
  }
  return null;
}

function emptyPath(sourceDurationSeconds: number): CameraPath {
  const fps = CAMERA.fps;
  const n = Math.max(1, Math.ceil(sourceDurationSeconds * fps) + 1);
  return { fps, cx: new Float32Array(n), cy: new Float32Array(n), scale: new Float32Array(n) };
}

function emptyCheckpoints(n: number): Checkpoints {
  const slots = Math.floor(n / CHECKPOINT_STEPS) + 1;
  return { data: new Float64Array(slots * STATE_FIELDS), ids: new Array(slots).fill(null) };
}

const sameAnchor = (a: ZoomSegment["anchor"], b: ZoomSegment["anchor"]): boolean =>
  a === b || (a !== null && b !== null && a.x === b.x && a.y === b.y);

const byStart = (segments: ZoomSegment[]): ZoomSegment[] =>
  [...segments].sort((a, b) => a.start - b.start);

/** Full simulation from t = 0, keeping the rest runs so a later edit can reuse it. */
export function buildCameraBuild(
  segments: ZoomSegment[],
  track: CursorTrack | null,
  sourceDurationSeconds: number,
): CameraBuild {
  const path = emptyPath(sourceDurationSeconds);
  const rests: RestRun[] = [];
  const checkpoints = emptyCheckpoints(path.scale.length);
  simulate(byStart(segments), track, path, rests, checkpoints, 0, null, null);
  return { path, segments, track, sourceDurationSeconds, rests, checkpoints };
}

export function buildCameraPath(
  segments: ZoomSegment[],
  track: CursorTrack | null,
  sourceDurationSeconds: number,
): CameraPath {
  return buildCameraBuild(segments, track, sourceDurationSeconds).path;
}

/**
 * Same result as `buildCameraBuild(segments, …)`, bit for bit, but reuses `prev` around
 * the segments that changed. An edge drag on one zoom of an hour-long take re-simulates
 * the stretch the edge moved over instead of all 194,000 steps:
 *
 *   - everything before the first index that can differ is copied, and the simulation
 *     resumes from the last checkpoint before it. For a segment whose END alone moved
 *     that index is the earlier of its two ends (minus the lookahead); otherwise it is
 *     the earlier of its two starts;
 *   - after the last changed segment, the simulation stops at the first rest run whose
 *     carried state matches the old path's at the same index, and copies the old tail.
 *
 * "Changed" starts from reference identity: an edit replaces the segment object it
 * touches and keeps the others (zoom-edits.ts). A replaced object whose simulated fields
 * are all equal (an `origin` flip) changes nothing. A new track or duration rebuilds from
 * scratch.
 */
export function rebuildCameraPath(
  prev: CameraBuild | null,
  segments: ZoomSegment[],
  track: CursorTrack | null,
  sourceDurationSeconds: number,
): CameraBuild {
  if (!prev || prev.track !== track || prev.sourceDurationSeconds !== sourceDurationSeconds) {
    return buildCameraBuild(segments, track, sourceDurationSeconds);
  }
  const before = new Map(prev.segments.map((s) => [s.id, s]));
  let dirtyStart = Infinity;
  let dirtyEnd = -Infinity;
  const mark = (from: number, to: number): void => {
    dirtyStart = Math.min(dirtyStart, from);
    dirtyEnd = Math.max(dirtyEnd, to);
  };
  const seen = new Set<string>();
  for (const s of segments) {
    seen.add(s.id);
    const old = before.get(s.id);
    if (old === s) continue;
    if (!old) {
      mark(s.start, s.end);
      continue;
    }
    const sameButEnd =
      old.start === s.start &&
      old.scale === s.scale &&
      old.mode === s.mode &&
      old.smoothing === s.smoothing &&
      sameAnchor(old.anchor, s.anchor);
    if (sameButEnd && old.end === s.end) continue;
    const to = Math.max(old.end, s.end);
    mark(sameButEnd ? Math.min(old.end, s.end) : Math.min(old.start, s.start), to);
  }
  for (const old of prev.segments) if (!seen.has(old.id)) mark(old.start, old.end);
  if (dirtyStart === Infinity) {
    // Nothing the simulation reads changed (a new array, or an `origin` flip).
    return { ...prev, segments };
  }

  const path = emptyPath(sourceDurationSeconds);
  const n = path.scale.length;
  const checkpoints = emptyCheckpoints(n);
  const fps = path.fps;
  // The last index whose lookahead still falls before every change, with a step of
  // margin for float rounding: nothing up to it can differ.
  const keep = Math.floor((dirtyStart - CAMERA.lookaheadSeconds) * fps) - 1;
  const slot = Math.max(0, Math.floor((keep + 1) / CHECKPOINT_STEPS));
  const i0 = slot * CHECKPOINT_STEPS;
  const rests: RestRun[] = [];
  let openRun: RestRun | null = null;
  if (i0 > 0) {
    path.cx.set(prev.path.cx.subarray(0, i0));
    path.cy.set(prev.path.cy.subarray(0, i0));
    path.scale.set(prev.path.scale.subarray(0, i0));
    checkpoints.data.set(prev.checkpoints.data.subarray(0, (slot + 1) * STATE_FIELDS));
    for (let j = 0; j <= slot; j++) checkpoints.ids[j] = prev.checkpoints.ids[j];
    for (const r of prev.rests) {
      if (r.start >= i0) break;
      const copy = { ...r };
      rests.push(copy);
      // A run still open at i0 - 1 continues in the resumed simulation.
      if (r.end >= i0) {
        copy.end = n;
        openRun = copy;
      }
    }
  }
  // From this index on no changed segment is open at `t` or opening at `u` (both past its
  // end), again with a step of margin.
  const fromIndex = Math.ceil(dirtyEnd * fps) + 1;
  simulate(byStart(segments), track, path, rests, checkpoints, i0, openRun, { prev, fromIndex });
  return { path, segments, track, sourceDurationSeconds, rests, checkpoints };
}

/** Camera at source time `t` (seconds), linearly interpolated between path steps. */
export function cameraAt(path: CameraPath, t: number): CameraState {
  const n = path.scale.length;
  const f = clamp(t * path.fps, 0, n - 1);
  const i = Math.floor(f);
  const j = Math.min(n - 1, i + 1);
  const k = f - i;
  return {
    cx: lerp(path.cx[i], path.cx[j], k),
    cy: lerp(path.cy[i], path.cy[j], k),
    scale: lerp(path.scale[i], path.scale[j], k),
  };
}

/** Normalized visible window for a camera state. */
export function cropRect(cam: CameraState): CropRect {
  const w = 1 / cam.scale;
  return { x: cam.cx - w / 2, y: cam.cy - w / 2, w, h: w };
}

/** True when the camera is (visually) not zoomed — lets preview/export take the fast path. */
export function isIdentity(cam: CameraState): boolean {
  return cam.scale < 1.001;
}

/** A fixed anchor clamped so a window of `scale` stays inside the frame. */
export function clampAnchor(
  anchor: { x: number; y: number },
  scale: number,
): { x: number; y: number } {
  const half = 0.5 / Math.max(1, scale);
  return { x: clamp(anchor.x, half, 1 - half), y: clamp(anchor.y, half, 1 - half) };
}
