---
title: "Zoom block edge drag lags on long takes"
description: "Dragging a zoom block's edge in the Zooms lane got slow on a 54-minute recording. Edge moves are now coalesced to one live update per frame."
---

# Zoom block edge drag lags on long takes

> **Status: 🟢 Ready to validate (prod review pending).** No Linear ticket: the workspace
> free-issue limit blocked creating one (reported 2026-11-09). Same family as NIW2-662
> (inspector sliders) and NIW2-672 (Sensitivity); this path was left behind by both.

## Problem

The owner found that changing the length of a zoom block in the Zooms lane loses the fluid
feel on a 54-minute take with ~121-128 auto zooms and a webcam.

## Cause (what was measured, and what was not)

Every pointer move on a block edge called `updateLive`, so every move re-rendered the Zooms
lane and the strip that hosts it. The inspector sliders already coalesce to one update per
animation frame; the edge handles did not. A mouse can send several moves per frame.

Measured in the jsdom render-count harness (synthetic one-hour take, 128 zooms, ~1800
activity spans; a proxy, not the real app):

| Case                      | Zoom lane renders        | Time    |
| ------------------------- | ------------------------ | ------- |
| Before, 12 pointer moves  | 12                       | 1364 ms |
| After, 12 pointer moves   | 1                        | 61 ms   |
| Before, 120 pointer moves | worker ran out of memory | n/a     |
| After, 120 pointer moves  | 15                       | 415 ms  |

**Not measured:** the owner's real recording in the real app. A Chrome or Electron profile
is still open; browser layout costs (forced layout from the pointer conversion) are not
visible in jsdom.

## Fix

`use-zoom-editing.ts`: `edgeDrag` keeps the newest move and applies it once per frame;
release applies the last pending move first, and a move that lands on the same range is
dropped. One undo step per drag is unchanged.

Guard: `video-editor-page.render-count.test.tsx` ("a zoom edge drag re-renders the zoom lane
once per frame").
