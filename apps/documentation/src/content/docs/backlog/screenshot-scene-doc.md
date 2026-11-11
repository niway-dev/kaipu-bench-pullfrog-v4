---
title: "Re-editable screenshots (scene doc) — complexity & cloud analysis"
description: "Should a saved screenshot store a re-editable scene (base image + annotations + beautify) instead of a flat PNG? Technical complexity, how the metadata is stored, what changes for cloud, and the security tension with redaction."
---

# Re-editable screenshots (scene doc)

> **Status: 🟢 Ready to validate, behind the `image-canvas` flag** (NIW2-700, M3 of the image
> editor epic). A save now writes the editable document beside the flat PNG, and the editor
> reopens it. Redaction is destructive, so this doc's "keep the original" and "Reset edits"
> are not built; [ADR 0053](/architecture/decisions/0053-the-image-editor-is-a-canvas-saved-as-a-document-beside-its-flattened-export/)
> records what was. Cloud sync of the document is still open.
>
> The analysis below is from before the build: today's flat-PNG behaviour is the flag-off path.

## The model is the easy part

The editor scene is already plain, serializable data — no work to "design" it:

```ts
interface Scene { beautify: BeautifyState; annotations: Annotation[] }
// annotations: normalized (0–1) coords, hex colour, stroke index, stable `seed`
// beautify:    { bg: "magenta" | …, padding, radius, shadow }
```

`JSON.stringify(scene)` is the whole metadata. Rough.js strokes are deterministic
because each annotation stores its `seed`, so a re-render is pixel-identical. The
only discipline needed is a `schemaVersion` field so old scenes still parse after
the editor grows a tool.

## What has to change

Today we store **only** the flattened `<id>.png`. Non-destructive re-edit needs
**three** artifacts per screenshot:

| Artifact                    | Purpose                                       | Where (local)            |
| --------------------------- | --------------------------------------------- | ------------------------ |
| `<id>.png` (flattened)      | Library thumbnail, Copy, share — the "output" | vault root               |
| base PNG (original capture) | the un-annotated pixels to edit on            | `.kaipu/<id>.base.png`   |
| `<id>.scene.json`           | beautify + editable annotations               | `.kaipu/<id>.scene.json` |

Flow: **Save** → write all three. **Edit** → load base + scene, hydrate the editor
(annotations already editable). **Re-save** → re-flatten → overwrite `<id>.png` +
scene.json. The vault sidecar mechanism already exists (`.kaipu/<id>.json`), so this
is one more sidecar file + one more image.

Editor change is small: `useEditorScene` already takes an initial beautify — extend
it to an initial **scene** (annotations + beautify). The `local` image source would
resolve to the **base** bytes, not the flattened ones.

## Complexity verdict

- **Local: MEDIUM.** Mechanical work (store base + scene, hydrate the editor, point
  the `local` source at the base). No new hard problems — coords are normalized,
  seeds are stored, the sidecar pattern exists.
- **Cloud: also MEDIUM — not the wall it feels like.** The scene is just another
  small blob. Re-edit from cloud = download base + scene, edit, re-upload all three.
  The scene JSON is fully portable (normalized coords + hex + preset ids; nothing
  machine-specific). What genuinely costs more is **(a)** ~2× image storage (base +
  flattened), **(b)** **schema versioning forever** — the editor must keep opening
  old scenes, and **(c)** keeping render output stable as the editor evolves.

The lasting cost is (b)/(c), not the storage or the cloud transport.

## The principle that de-risks it: always keep the flatten

Whatever we do, **keep `<id>.png` flattened** as the always-valid artifact. If a
scene fails to parse (corrupt, newer schema, missing base), the editor falls back to
**editing on the flattened PNG** (today's behaviour). So the scene doc is a _best-
effort enhancement layered on top_ — it can never make a screenshot un-openable.

## ⚠️ Security tension with redaction (read before building)

This directly affects the [redaction tool](./screenshot-redaction). A redaction box
drawn over sensitive data only hides pixels in the **flattened** output. If we also
store the **base** (for non-destructive re-edit), the sensitive pixels still live in
`.kaipu/<id>.base.png` — anyone with the file can see under the box. **Storing a
re-editable base defeats redaction.**

Resolution options, when both features exist:

- A screenshot that contains a **redaction** annotation is saved **flattened only**
  (no base, no scene) — it opts out of non-destructive re-edit. Simple, safe.
- Or redaction is **destructive**: it bakes (erases/pixelates) the pixels in the
  stored base too, so the base no longer holds the secret. More work, keeps re-edit.

Recommend the first (flatten-only when redacted) for v1.

## Recommendation

Medium complexity, low conceptual risk if we keep the flatten fallback. **Worth doing
when re-edit becomes a frequent workflow** — not before. Until then, flattening is the
right shipped behaviour (re-edit still works additively; you just can't move old
marks). If we build it: spec the `schemaVersion`, keep the flatten fallback, and make
redacted shots flatten-only.
