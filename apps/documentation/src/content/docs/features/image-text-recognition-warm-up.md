---
title: "Image text recognition warm-up"
description: "Why the first text recognition on macOS can take 13-20 seconds, how a background warm-up pays that cost after launch, and what the editor gate and the dev override do to it."
---

# Image text recognition warm-up

How the image editor's text recognition stays fast on macOS. The port and its backends are
decided in [ADR 0055](../architecture/decisions/0055-text-recognition-is-a-port-served-by-the-os-engine-on-each-platform).

## The cold first run

Apple Vision compiles its model the first time it runs after the helper binary is new or the
OS has dropped the compiled model. That first run takes 13-20 s. A warm run takes 0.5-0.9 s.

## The background warm-up

Eight seconds after launch, on macOS, with the `image-text` flag on and the helper binary
present, main runs one recognition of a small bundled image (`warm-up-image.ts`) through the
helper. That pays the compile in the background so the editor's first request is warm. It runs
once per launch, and a failure is never shown to the user.

There is **no stamp** that skips it for a binary already warmed. macOS can drop Vision's
compiled model (an OS update, possibly a reboot) while the helper binary is unchanged, so a
stamp would skip the warm-up exactly when it is needed. A warm run costs 0.5-0.9 s in the
background, so repeating it every launch is cheap.

## The editor gate

The editor's recognizer is wrapped by a gate (`withWarmUpGate`):

- An editor request that arrives while a warm-up is running waits for it, instead of starting
  a second cold helper process for the same model.
- An editor request that arrives before the warm-up has started cancels it, because that request
  already starts the helper cold on its own.

## The dev override

When `KAIPU_TEXT_RECOGNITION` is active (unpackaged builds only: `unavailable` or
`delay:<ms>`), the warm-up does not run. A `delay:<ms>` override, which the UI catalog sets to
60 s to hold the "reading" state, would make the warm-up sleep, and every editor request would
queue behind it in the gate.
