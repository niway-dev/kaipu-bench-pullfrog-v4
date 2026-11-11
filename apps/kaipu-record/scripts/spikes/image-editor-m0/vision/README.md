# Vision text recognition latency spike (NIW2-697, M0)

Measures `VNRecognizeTextRequest` from a Swift CLI helper, the way the app will use it:
the helper takes a PNG path and prints versioned JSON (`version: 1`) with word boxes in
top-left source pixels. `bench.swift` spawns it like Electron main would (new process,
stdout pipe, 60 s kill timeout (the app would use a shorter one)) and measures wall clock.

Targets (ADR 0055): under 1.5 s on a 1920x1080 image and on a Retina screenshot, measured warm.
The cold case (the model compiling on the Neural Engine) took 13.5 s on the Mac mini and is
treated separately in the ADR.

- `make-text-fixtures.swift`: 1920x1080 (1x) and 3024x1964 (2x) UI-like screenshots plus ground-truth words.
- `text-recognition-spike.swift`: the helper (`--level accurate|fast`, `--no-language-correction`).
- `bench.swift`: per fixture and level, one first run of that fixture and level, then N fresh
  processes. Only the very first run of the bench can be cold; later fixtures and levels run after
  the model was loaded. The OS may cache the Vision model between processes, so the first run is
  reported separately.
- Recall = ground-truth words recognized with exactly the same text.

```bash
./run.sh [outDir] [runsAfterFirst]   # local; default /tmp/niw2-697/vision-<host>
./run-on-macmini.sh                  # runs on the Mac mini, results to /tmp/niw2-697/vision-results/
```
