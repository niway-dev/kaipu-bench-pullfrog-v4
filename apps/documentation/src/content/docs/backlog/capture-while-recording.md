---
title: Screenshots while recording (macOS)
description: Take a screenshot during a take, behind the capture-while-recording flag. The recording target is captured without a selector and the shot never opens the editor.
---

# Screenshots while recording (macOS)

> **Status: 🟢 Ready to validate (prod review pending).** Behind the `capture-while-recording` flag,
> default off, macOS only. Ticket: NIW2-688.

## Behaviour

With the flag on, a capture shortcut during a take (active or in its countdown) captures the
recording destination directly, without opening the selection overlay.

- Area takes capture the whole recorded rectangle; screen takes capture their display.
- Window takes capture the recorded window by its OS id. An unavailable target cancels the shot
  rather than opening a selector or capturing another display.
- The active take's source and area are retained even if recording settings change mid-take.
- The RECORD selector is still refused during a take. Idle screenshots keep their usual selector
  and remembered mode; a direct take capture does not overwrite that preference.
- The shot is saved to the Library and never opens the preview card or the editor, whatever the
  after-capture setting says. The copy setting still applies.
- `screencapture -x` plays no shutter sound and draws no flash. The capture toast, which is content
  protected, shows a "Screenshot taken" notice (`presentation: "taken"`).
- A shot that could not be saved stays in the toast, whose Save retries; the editor never opens.

Flag off, or not macOS: identical to before.

## How the flag reaches main

Main has no PostHog client, so the renderer reports the resolved flag over
`screenshot:capture-while-recording-flag`. A `KAIPU_FLAG_OVERRIDES` pin (unpackaged builds) wins.
`src/main/screenshots/capture-while-recording.ts` combines both with the platform check.

## Not verified / out of scope

- Owner-reported validation: the selection grid appeared in the recorded video despite overlay
  content protection. The saved-shot thumbnail was correctly absent from the recording.
- The replacement direct-capture flow has regression coverage for display/area coordinates and
  skipping the overlay; it still needs real-recording validation on macOS.
- Out of scope: linking the screenshot to the video, shortcut simplification, widget mic and audio
  buttons, Windows.
