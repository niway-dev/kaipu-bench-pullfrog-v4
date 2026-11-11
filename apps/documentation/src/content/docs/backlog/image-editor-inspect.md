---
title: Image editor Inspect mode
description: Inspect mode in the image editor — a loupe and the live color under the cursor, copied in hex, rgb, hsl or oklch, and a colors panel that locates each color — behind the image-inspect flag.
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

## Colors panel

The **Colors** button in the Inspect bar opens a panel with every color in the image, largest
share first ([NIW2-704](https://linear.app/niway/issue/NIW2-704), milestone M7).

- **Groups.** Near-identical colors form one group, shown with its most frequent exact value
  and its share of the image. When a group has more than one notable exact value, they are
  listed under it, so two whites that should have been one sit side by side.
- **Locate.** Clicking a group, or one exact value, dims the image everywhere except those
  pixels and says how many there are. Clicking it again, Clear highlight, closing the panel
  or leaving Inspect removes the highlight. The highlight follows zoom and pan.
- **Format.** Values are sRGB, in the Inspect bar's format.

How it counts: the buffer Inspect already decoded is copied once into a worker (a few
milliseconds on the main thread), so the editor never waits on the count. The worker counts
exact colors, drops the low 3 bits of each channel (32,768 bins), and groups bins closer than
0.03 in OKLab around the most frequent ones, looking only at neighbouring cells of a grid, so
the work is linear: a 5K image of pure noise takes about half a second, all of it off the main
thread. Fully transparent pixels are not counted. The worker and its copy of the pixels live
while the panel can be used and are released when Inspect exits, the image changes or the
editor closes. Code: `inspect/colors/` — the counting (`histogram.ts`) is pure and tested; the
worker, the hook and the view are separate, so NIW2-708 can restyle the panel. The real-app
check is `apps/kaipu-record/verify/image-colors.verify.ts`.

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
- The final look of the HUD, bar and colors panel: NIW2-708.
