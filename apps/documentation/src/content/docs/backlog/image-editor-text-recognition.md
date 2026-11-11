---
title: Image editor text recognition
description: Select and copy the text inside a screenshot in the image editor, recognized on macOS by Apple Vision through a Swift helper and cached beside the item, behind the image-text flag.
---

# Image editor text recognition

> **Status: 🟢 Ready to validate (prod review pending) — behind flag image-text (with image-canvas), off by default. macOS only.**

Design: [image editor canvas and inspect](../specs/2026-11-11-image-editor-canvas-and-inspect-design/),
detail 5. Decision: [ADR 0055](../architecture/decisions/0055-text-recognition-is-a-port-served-by-the-os-engine-on-each-platform/).
Issue: [NIW2-705](https://linear.app/niway/issue/NIW2-705). Windows: [NIW2-707](https://linear.app/niway/issue/NIW2-707).
Hiding a recognized block: [NIW2-706](https://linear.app/niway/issue/NIW2-706).

## What it does

With both `image-canvas` and `image-text` on, the image editor's toolbar has a **Select text**
tool:

- When the editor opens an image, main recognizes its text in the background. The options bar
  says "Recognizing text…" until the answer arrives; the canvas and the other tools work
  meanwhile.
- In the tool, dragging over the image selects recognized words in reading order and highlights
  them. A click on empty space clears the selection. ⌘/Ctrl+A selects every word.
- ⌘/Ctrl+C, or **Copy text** in the options bar, puts the selected text on the clipboard: words of
  a line joined by a space, lines by a newline.
- Words under a redaction, saved or not, cannot be selected.
- Where recognition is not available (Windows and Linux until NIW2-707, a missing or broken
  helper, a timeout), the options bar says so and the rest of the editor is unchanged.

With either flag off, the editor is unchanged.

## How it works

1. **Port.** `TextRecognizer` in `@kaipu/domain/schemas` (`text-recognition.ts`), with the
   `RecognizedWord` schema: text, a box in source pixels (top-left origin), a line index and a
   confidence. The same file has the pure helpers the editor and main share: reading order,
   the copied text, and the words outside a set of rectangles.
2. **macOS backend.** `native/text-recognition/main.swift`, built by
   `scripts/build-text-recognition.sh` (universal, macOS 13, `resources/native/kaipu-text-recognition`)
   from `build:native-capture`, so `dev` and `build` build it. Like the capture helper it is
   optional locally and checked and signed by the release workflow. Main runs it with the PNG on
   stdin (no temporary file), `--version` checked once, a 45 s timeout (the first run on a Mac
   compiles Vision's model: 13.5 s measured in M0), an output cap, and Zod validation. Any failure
   is `"unavailable"`.
3. **Cache.** `.kaipu/<id>.text.json`: `{ schemaVersion: 1, assets: { <assetId>: { sha256, words } } }`.
   A request whose PNG hash matches the entry is answered without running the helper. It is a
   vault companion like the canvas document: rename, move between workspaces, delete and the
   library repair carry or remove it.
4. **Redactions.** Every save rewrites the cache from the words the renderer sends, which already
   exclude every word a baked redaction touches, hashed from the assets just written. A save
   without words (recognition still pending, or the classic editor) deletes the file. A
   recognition that finishes after a save, rename or delete of its item writes nothing (a
   generation counter per item), so a hidden word never comes back.

## How to turn it on

- **Released builds:** the PostHog feature flags `image-canvas` and `image-text`.
- **Local development:**

  ```bash
  KAIPU_FLAG_OVERRIDES='{"image-canvas":true,"image-text":true}' bun run dev
  ```

  The UI catalog's `image-text` profile does the same.

## Not built yet

- Windows (`Windows.Media.Ocr`): NIW2-707.
- A recognized line as a one-click redaction target: NIW2-706.
- Text selection in the classic editor (flag `image-canvas` off).
- Re-recognizing after an unsaved edit: the editor recognizes the image as it was loaded.
