---
title: Image editor Inspect mode
description: Inspect mode in the image editor — a loupe and the live color under the cursor, copied in hex, rgb, hsl or oklch — behind the image-inspect flag.
---

# Image editor Inspect mode

> **Status: 🟢 Ready to validate (prod review pending) — behind flag image-inspect, off by default.**

Design: [image editor canvas and inspect](../specs/2026-11-11-image-editor-canvas-and-inspect-design/), section 3.
Decision: [ADR 0054](../architecture/decisions/0054-inspection-tools-read-the-pixels-of-a-captured-image-inside-the-editor/).
Issue: [NIW2-699](https://linear.app/niway/issue/NIW2-699) (milestone M1 of NIW2-696).

## What it does

Inspect is one mode of the image editor. Press `I` or the pipette button in the toolbar to enter
it, `Esc` to leave. While it is on, over the image:

- **Loupe.** 15 × 15 image pixels around the cursor, drawn unsmoothed, with the centre pixel
  outlined.
- **Live color.** The color of the pixel under the cursor and its position in image pixels. The
  value is the pixel converted once to sRGB, so it matches what a designer typed in CSS or Figma.
- **Formats.** hex (default), rgb, hsl, oklch. A translucent pixel shows its alpha.
- **Copy.** `C` or the Copy color button copies the value as shown.
- **As captured.** Shows the raw value in the profile the image was captured in (only hex and
  rgb: those numbers are not sRGB, so hsl and oklch would be wrong).
- **Out of sRGB.** A pixel whose color lies outside sRGB is marked; the hex shown is the clipped
  value.

The keys do nothing while a text field or a dialog has focus, and `Cmd+C` keeps its meaning.
Inspect works with the `image-canvas` flag on and off, and the readout does not change with zoom.
Inspect never edits the image and nothing it shows is saved.

## How it reads pixels

The image is decoded once, the first time Inspect is entered, into an sRGB buffer (about 81 MiB
for a 6K image) that is kept while the editor is open. The out-of-sRGB mark and the "as captured"
value come from decoding a 32 × 32 tile around the pointer again, once the pointer rests for
120 ms. Code: `apps/kaipu-record/src/renderer/src/features/screenshots/inspect/` — the logic
(`color.ts`, `pixel-buffer.ts`, `inspect-keys.ts`, `use-inspect.ts`) is separate from the view so
NIW2-708 can restyle it.

## How to turn it on

- **Released builds:** the PostHog feature flag `image-inspect`.
- **Local development:**

  ```bash
  KAIPU_FLAG_OVERRIDES='{"image-inspect":true}' bun run dev
  ```

  The UI catalog's `image-inspect` profile does the same. The real-app check is
  `apps/kaipu-record/verify/image-inspect.verify.ts`.

## Not in it yet

- The ruler (`1` / `2`, pinned measurements): M4, NIW2-702.
- The colors panel: M7, NIW2-704.
- The final look of the HUD and bar: NIW2-708.
