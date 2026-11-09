---
title: "Timeline zoom up to 2000%"
description: "The transport bar's timeline zoom topped out at 800%, too coarse to place a block on a 54-minute take. The ceiling is now 2000%."
---

# Timeline zoom up to 2000%

> **Status: 🟢 Ready to validate (prod review pending).** No Linear ticket: the workspace
> free-issue limit blocked creating one (reported 2026-11-09). Revisits decision 5 of the
> [transport design](/specs/2026-11-06-editor-transport-tracks-backgrounds-design/).

## Problem

On the owner's 54-minute take even 800% did not show enough detail to place a zoom block
precisely.

## Change

- `MAX_ZOOM` 8 → 20 and `ZOOM_STEPS` `[1, 2, 4, 8]` → `[1, 2, 4, 8, 16, 20]` in
  `timeline-view.ts`. The slider stays logarithmic over `[1, MAX_ZOOM]`.
- The ruler already windows its labels and ticks to the visible range; at 20x of a 10-minute take
  it picks a 5 s step (labels about 167 px apart), covered by a test.
- The level readout reads "2,000%" in English and "2000 %" in Spanish, so its fixed width went from
  5ch to 6ch, and the transport bar's container-query thresholds moved up 14 px.

## Open

- The bar's layout budget was **not re-measured in the real app**: run
  `bun run verify -- timeline-zoom` on the Mac mini and confirm no overlap at the 1180 px floor.
- Lanes at 20x are not windowed except the ruler and filmstrips: Activity marks and zoom blocks are
  positioned by percentage inside a 20x-wide lane. Not profiled on the 54-minute take.
