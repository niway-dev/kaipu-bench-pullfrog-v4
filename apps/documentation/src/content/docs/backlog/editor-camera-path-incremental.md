---
title: "Incremental camera path rebuild"
description: "Editing a zoom on a long take re-simulated the whole camera every frame. The rebuild now re-simulates only around the changed zooms and copies the rest."
---

# Incremental camera path rebuild

> **Status: 🟡 In progress.** No Linear ticket: the workspace free-issue limit blocked
> creating one (2026-11-09). Follows [Zoom block edge drag lags](./zoom-block-drag-lag/),
> which coalesced edge moves to one update per frame but left the per-frame cost itself.

## Problem

After #563, dragging a zoom block's edge on the owner's 54-minute take (~128 zooms, webcam)
still did not feel fluid. The owner suspected the autosave, since every change shows
"Saving…".

## What was measured

Real Electron app on the Mac mini (M4, Electron 39.8.10, commit bcc883cc), synthetic 54:00
take at 2560x1600, 128 zooms, ~1800 activity marks, webcam track; 300 px edge drag over 2 s,
median of 3 runs. Traces and scripts: `.evidence/editor-perf-real/` (not committed).

| Case (main, before) | Frames in 2 s | Frames missing a vsync | Main busy per frame p50 / p95 |
| ------------------- | ------------- | ---------------------- | ----------------------------- |
| 100% zoom, paused   | 262           | 25                     | 6.8 / 13.8 ms                 |
| 100% zoom, playing  | 255           | 25                     | 6.8 / 13.9 ms                 |
| 2000% zoom, paused  | 284           | 2                      | 6.6 / 7.0 ms                  |

- `buildCameraPath` was the top function in every profiled run: ~3.6 ms per frame, about
  54% of the JavaScript of the drag. It re-simulated the camera over the whole take
  (194,000 steps at 60 fps) on every frame, although one zoom changed.
- The autosave is **not** the cause. Its main-process handler takes ~22 ms, it runs 800 ms
  after release (never during a drag), and no long task or dropped frame follows it.
- A headless-Chrome run of the real renderer with fake data agreed (`buildCameraPath` first,
  React render of the page ~1.1 ms per frame, autosave invisible).

## Change

`rebuildCameraPath(prev, segments, track, duration)` in `zoom/camera-path.ts`, called by
`useCameraPath` once per frame:

1. The simulation records **rest runs**: stretches with no zoom open or opening where the
   camera sits at exact rest (centre 0.5/0.5, scale 1, every velocity 0). Inside one the
   state does not move, so a run is a seam where a simulation can resume or be spliced.
2. The simulation also stores its **whole state every second** (checkpoints), so a rebuild
   can resume in the middle of a zoom.
3. A rebuild finds the segments that changed (by object identity, then by the fields the
   simulation reads; edits replace only the segment they touch). The first index that can
   differ is the earlier of the two ends when only a segment's end moved, otherwise the
   earlier of the two starts, minus the 200 ms lookahead. The old path is copied up to the
   last checkpoint before it, the simulation resumes there, and it stops at the first rest
   run after the last change whose carried target matches the old path at the same index,
   copying the old tail.
4. A critically damped spring never reaches exact rest in float64 (the velocity decays
   through denormals for minutes), so in a gap the state is **snapped** to rest once every
   term is below 1e-9. That is below the Float32 resolution the path is stored in; the path
   stays within 1e-6 of the old simulation.

Unchanged: preview and export still share one path; a new track or duration rebuilds from
scratch; same segment objects return the same path object (no re-render).

## Checks

- `camera-path-incremental.test.ts`: after random edit sequences (single and multi-segment
  edits, long and short blocks, with and without a cursor track), the incremental build
  equals a full rebuild **bit for bit** in the path, the checkpoints and the rest runs, and
  both stay within 1e-6 of a verbatim copy of the pre-change simulation.
- Seeded bugs, each caught: splicing before the last changed segment ends; ignoring the
  lookahead when choosing the resume point; taking the later end for an end-only edit;
  copying one checkpoint too many at the splice.
- Editor suites: 1835 tests pass.

## Measurements of the change

**First version (rest runs only), real app on the Mac mini**, same scenario, interleaved
before/after, 3 runs each: at 2000% timeline zoom renderer main busy per frame fell from
6.5 to 2.2 ms (camera work ~870 → ~150 ms per drag). At 100% it barely moved (~930 → ~840
ms): 300 px there is ~13 minutes of source, the dragged block grew to minutes, and that
version re-simulated the whole block every frame. Frame pacing was unchanged at 100%
(p95 13.9 ms, ~25 frames missing a vsync of 144 Hz). That is why checkpoints were added.

**Second version (checkpoints), Node microbenchmark (a proxy)**, the owner's real zoom
layout (121 zooms over 53 minutes; median gap 10.7 s, 28 gaps under 4 s) with a synthetic
cursor track, edge drags on 7 zooms across the take, 60 steps each:

| Case                          | Per-frame cost median / p95 |
| ----------------------------- | --------------------------- |
| Full rebuild (before)         | 7.5 ms                      |
| Incremental, 0.33 s per frame | 0.33 / 0.62 ms              |
| Incremental, 6.5 s per frame  | 0.01 / 0.29 ms              |

**Worst case left:** a cluster of zooms with gaps too short for the camera to return to
rest. The tail can only be spliced at a rest run, so the rebuild re-simulates through the
whole cluster after the dragged block. On the Mac mini scenario (63 zooms packed 3.5 s
apart after the target) the incremental rebuild still costs ~5.7 ms per frame against ~10.5
ms for a full one. Splicing on an approximately equal state would remove it, at the cost of
the bit-for-bit guarantee; not done.

## Open

- Re-measure the second version in the real app on the Mac mini with a realistic zoom
  layout.
- The whole editor page still re-renders once per drag frame (~1.1 ms); the zone split
  from NIW2-662 is the next step if frames still miss vsync.
- The "Saving…" chip appears from the first move of a drag although nothing is written
  until 800 ms after release. That reads as "saves on every change".
