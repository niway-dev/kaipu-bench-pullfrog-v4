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
2. A rebuild finds the segments that changed (by object identity; edits replace only the
   segment they touch), copies the old path up to the last rest run before them, resumes
   there, and stops at the first rest run after them whose carried target matches the old
   path at the same index, copying the old tail.
3. A critically damped spring never reaches exact rest in float64 (the velocity decays
   through denormals for minutes), so in a gap the state is **snapped** to rest once every
   term is below 1e-9. That is below the Float32 resolution the path is stored in; the path
   stays within 1e-6 of the old simulation.

Unchanged: preview and export still share one path; a new track or duration rebuilds from
scratch; same segment objects return the same path object (no re-render).

## Checks

- `camera-path-incremental.test.ts`: after random edit sequences (single and multi-segment
  edits, with and without a cursor track), the incremental path equals a full rebuild **bit
  for bit**, and both stay within 1e-6 of a verbatim copy of the pre-change simulation.
- Seeded bugs, each caught: splicing before the last changed segment ends; ignoring the
  200 ms lookahead when choosing the resume point.
- Editor suites: 1834 tests pass.

Node microbenchmark (a proxy), 54-minute take, 128 zooms, 120 edge-drag steps:

| Dragged zoom | Full rebuild median | Incremental median |
| ------------ | ------------------- | ------------------ |
| #10 (early)  | 10.8 ms             | 0.17 ms            |
| #64 (middle) | 10.2 ms             | 0.25 ms            |
| #120 (late)  | 7.6 ms              | 0.14 ms            |

## Open

- Re-measure the same drag in the real app on the Mac mini (before/after table above).
- The whole editor page still re-renders once per drag frame (~1.1 ms); the zone split
  from NIW2-662 is the next step if frames still miss vsync.
- The "Saving…" chip appears from the first move of a drag although nothing is written
  until 800 ms after release. That reads as "saves on every change".
