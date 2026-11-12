---
title: "Image text recognition warm-up"
description: "Why the first text recognition on macOS may be slow, how a background warm-up pays that cost after launch, and what the editor gate and the dev override do to it."
---

# Image text recognition warm-up

How the image editor's text recognition stays fast on macOS. The port and its backends are
decided in [ADR 0055](/architecture/decisions/0055-text-recognition-is-a-port-served-by-the-os-engine-on-each-platform/).

## The cold first run

Apple Vision is expected to compile its model the first time it runs after the helper binary is
new or the OS has dropped the compiled model. The M0 spike measured 13.5 s for that first run,
and owner QA saw about 20 s on a first read. A warm run takes 0.5-0.9 s.

This cause is **not confirmed**. On a Mac mini a freshly built helper read a 2000x1441
screenshot in 0.34 s, then 0.16 s and 0.15 s, so the cold start did not reproduce. The warm-up
removes one possible cause of a slow first read; if the delay survives it, look at the renderer
reading the image bytes and at `recognizeScreenshotText` waiting on the item lock behind a save.

## The background warm-up

On macOS, with the helper binary present, main runs one recognition of a small bundled image
(`warm-up-image.ts`) through the helper. It starts at whichever comes later: a fixed 8 s timer after launch (no check that the
app is actually idle), or the renderer's first report that `image-text` is on, which can arrive
late if PostHog resolves late. That pays the compile in the background so the editor's first
request is warm. It runs once per launch, and a failure is never shown to the user.

There is **no stamp** that skips it for a binary already warmed. macOS can drop Vision's
compiled model (an OS update, possibly a reboot) while the helper binary is unchanged, so a
stamp would skip the warm-up exactly when it is needed. A warm run costs 0.5-0.9 s in the
background, so repeating it every launch is cheap.

## The editor gate

The editor's recognizer is wrapped by a gate (`withWarmUpGate`):

- An editor request that arrives while a warm-up is running waits for it, instead of starting
  a second cold helper process for the same model. The wait is not capped: if the helper hangs
  instead of compiling slowly, the request waits for the warm-up's timeouts (about 47 s: a 2 s
  version check plus a 45 s run) and then runs with its own 45 s timeout.
- An editor request that arrives before the warm-up has started cancels it, because that request
  already starts the helper cold on its own.

## The dev override

When `KAIPU_TEXT_RECOGNITION` is active (unpackaged builds only: `unavailable` or
`delay:<ms>`), the warm-up does not run. A `delay:<ms>` override, which the UI catalog sets to
60 s to hold the "reading" state, would make the warm-up sleep, and every editor request would
queue behind it in the gate.
