---
title: "Editor drags freeze in dev mode on long takes"
description: "React 19.2's development-only prop logger walked the camera path's typed arrays on every render. React 19.3 skips typed arrays; the desktop app moves to it."
---

# Editor drags freeze in dev mode on long takes

> **Status: 🟢 Ready to validate (prod review pending).** No Linear ticket: the workspace
> free-issue limit still blocks creating one. Follows
> [zoom-block-drag-lag](./zoom-block-drag-lag/) and the incremental camera path (PR #565).

## Problem

After PR #563 and PR #565 the owner still found zoom-block edge drags "lentísimo" on the
54-minute take with a webcam. They test in `bun run dev`. The earlier measurements ran a
**production** build on the Mac mini with a **synthetic** take, so they never saw it.

## Cause

React 19.2's development build logs every committed component to the Performance panel's
Components track. For a component whose props changed, `logComponentRender` diffs the old
and new props with `addObjectDiffToProperties`, which expands nested values into a list of
rows. A typed array is expanded index by index.

The camera path (`CameraPath`: `cx`, `cy`, `scale` as `Float32Array`, 60 entries per
second) is a prop of `CursorLayer`, `CameraBox` and `WebcamLayer`, and changes on every
drag frame. On the 54-minute take that is ~195k entries per array, written twice (removed
and added) per array: **1,169,653 rows per component per commit**, three components per
commit. Each commit took ~600 ms.

Production builds have no such logging. React 19.3 skips typed arrays
(`ArrayBuffer.isView`) and caps any object or array at a fixed width.

## Change

`apps/kaipu-record` pins `react` and `react-dom` to `19.3.1` (from `19.2.4`). No code
change. The other workspaces keep their own pins.

## Measurements

The real 54-minute take on the owner's M5 (1440 × 900 window). The drag is scripted over
CDP: 150 moves, 300 px, on the end edge of the zoom at 24:26. Frame times come from an
in-page `requestAnimationFrame` recorder; long tasks come from a `PerformanceObserver`.

| Build                    | Timeline zoom | Long tasks | Time blocked | Worst frame |
| ------------------------ | ------------- | ---------- | ------------ | ----------- |
| dev, React 19.2.4        | 100%          | 11         | 6.8 s        | 642 ms      |
| dev, React 19.2.4        | 2000%         | 40         | 23.5 s       | 673 ms      |
| production, React 19.2.4 | 100%          | 0          | 0            | 7.6 ms      |
| production, React 19.2.4 | 2000%         | 0          | 0            | 7.6 ms      |
| dev, React 19.3.1        | 100%          | 0          | 0            | 19.4 ms     |
| dev, React 19.3.1        | 2000%         | 0          | 0            | 12.4 ms     |

The React 19.2.4 rows ran on the PR #565 branch; the 19.3.1 rows ran on `main` plus this
change, without PR #565's incremental camera path. So the dev rows also differ in that
change. It is not where the time went: see the profile below.

A JavaScript CPU profile of the 19.2.4 dev drag attributed 6.4 s of 6.6 s of scripting to
`logComponentRender` → `addObjectDiffToProperties`. Wrapping `performance.measure` showed
the rows came from the `path` prop of the three components above.

## Checks

- `check-types` and the desktop suite: 5893 tests pass on 19.3.1.
- The editor renders the 54-minute take normally in dev on 19.3.1 (screenshot in the PR).
- Not run: E2E, `/verify`, and a packaged build.

## Lessons

- Measure the build the owner tests in. A production-only measurement can miss a
  dev-only cost that dominates what the owner feels.
- A large typed array passed as a prop is cheap in production and was ruinous in React
  19.2 dev. Keep React at 19.3 or later, or keep such arrays out of props.
