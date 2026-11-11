# NIW2-697 M0 spike: color readout, capture round-trip, pixel-buffer memory

Measurement spike for the image editor. No product code. The editor decodes each captured
PNG once into a `Uint8ClampedArray` (canvas with an explicit `colorSpace`) and converts to
sRGB once for the color readout. This spike measures what that costs and how exact it is.

Reproduce (from the M5; Electron only ever runs on the Mac mini):

```bash
apps/kaipu-record/scripts/spikes/image-editor-m0/color-memory/run-on-macmini.sh [out-dir]
# default out-dir: /tmp/niw2-697/results   (results-<host>.json, capture.png, job.log)
node summarize.cjs /tmp/niw2-697/results/results-<host>.json   # run automatically at the end
```

It copies the spike to the mini (`/tmp/niw2-697-spike`), generates the fixtures there with
Swift + `sips` (nothing large is committed), and runs Electron under a launchd job whose
child process tree starts at mise's node, because `screencapture` needs Screen Recording
permission and TCC attributes it to the responsible process.

## What is measured

1. **Fixtures** (`make-fixtures.swift`): `srgb-swatches.png` (sRGB), `p3-swatches.png`
   (Display P3, in and out of the sRGB gamut), `monitor-profile-swatches.png` (the sRGB
   swatches converted by ColorSync into `fixtures/g27fc-display.icc` and tagged with it,
   modelling a capture on that monitor), `6k.png` (6144x3456, gradient + noise).
2. **Color** (`electron-spike.cjs`, `renderer.js`): per fixture and decode mode, the max
   absolute error per channel of the sampled swatch centres.
   - `srgb`: `createImageBitmap(blob)` -> sRGB canvas -> `getImageData` sRGB.
   - `p3`: same bitmap -> Display P3 canvas -> `getImageData` P3 -> one JS P3->sRGB conversion.
   - `none`: `colorSpaceConversion: "none"` -> raw bytes, compared with the bytes
     CoreGraphics reads from the PNG (`fixtures-tool raw`) and with the expected sRGB.
     Expected values: the sRGB hex, or for P3 the CSS Color 4 matrices in `colormath.cjs`
     (independent of Chromium and ColorSync). Out-of-gamut swatches are reported separately
     against the clipped reference.
3. **Capture round-trip**: a frameless window paints the swatches as CSS `#hex` and
   `color(display-p3 ...)`; the main process runs `screencapture -x -R` over the content
   bounds (what `screenshot-capture.ts` does), records the embedded profile and pixel size,
   and decodes the PNG in the three modes against the CSS values.
4. **Memory**: one 6144x3456 decode in a fresh window, 3 repetitions per canvas variant
   (default GPU canvas, and `willReadFrequently` CPU canvas): blob loaded, ImageBitmap,
   drawn, `getImageData`, copied into a standalone array with everything else released,
   all dropped, and 5 s later, with `--expose-gc`. `gc()` runs only after the release and drop
   stages; the other snapshots include uncollected garbage. Reported
   as median MiB deltas against that repetition's baseline, with decode times.

## What to look at

- `fixtures.*.modes.*.inGamut.maxErr` and `.worst`; `capture.modes.*`; `capture.embeddedProfile`.
- `memory.*.medianDeltaMiB`: `rendererPrivate` is the renderer's own heap (the
  `Uint8ClampedArray` shows here, the theoretical size is `theoreticalMiB`); the `*Footprint`
  columns (macOS `footprint -p`) include shared and GPU-process memory, which is where the
  default canvas leaves a residue after release.
- Caveats: GPU-process baseline footprint is noisy (the GPU process is still settling when the
  baseline is taken), so treat GPU deltas as indicative. One machine, one 1x display.
