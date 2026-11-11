---
title: Image editor canvas
description: The image editor's content-box canvas with pan, zoom, drawing outside the image and an export frame, behind the image-canvas flag.
---

# Image editor canvas

> **Status: 🟢 Ready to validate (prod review pending) — behind flag image-canvas, off by default.**

Design: [image editor canvas and inspect](../specs/2026-11-11-image-editor-canvas-and-inspect-design/).
Issue: [NIW2-698](https://linear.app/niway/issue/NIW2-698).

## What it does

With the flag on, the image editor works on an unbounded canvas instead of a fixed box around the
screenshot:

- **Content-box export.** The exported image is the shot plus whatever annotations reach past its
  edge, so nothing drawn outside the image is cut off.
- **Pan and zoom.** Space and drag, or the middle button, pan the canvas. The zoom buttons work
  below 100% as well as above it.
- **Drawing outside the image.** Annotations can be placed past the image edge.
- **Crop is the export frame.** With the flag on, the Crop tool sets the rectangle the export
  writes, not a crop of the shot. Reset returns to the full canvas.

With the flag off, the editor is unchanged.

## How to turn it on

- **Released builds:** the PostHog feature flag `image-canvas`.
- **Local development:** pin the flag with `KAIPU_FLAG_OVERRIDES`, a JSON object, for example:

  ```bash
  KAIPU_FLAG_OVERRIDES='{"image-canvas":true}' bun run dev
  ```

  The override is read only in unpackaged builds. The UI catalog's `image-canvas` profile does the
  same for the screenshots of the canvas states.

## Not in it yet

- Editable saves: NIW2-700.
- A second image arriving on the canvas: M6.
- The final UI for the canvas: NIW2-708.
