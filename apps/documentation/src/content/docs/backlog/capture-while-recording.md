---
title: Screenshots while recording (macOS)
description: Take a screenshot during a take, behind the capture-while-recording flag. The overlay is excluded from the video and the shot never opens the editor.
---

# Screenshots while recording (macOS)

> **Status: 🟢 Ready to validate (prod review pending).** Behind the `capture-while-recording` flag,
> default off, macOS only. Ticket: NIW2-688.

## Behaviour

With the flag on, a capture shortcut during a take (active or in its countdown) opens the capture
overlay instead of refusing with a notification.

- Full screen and area selection both work. The RECORD selector is still refused during a take.
- The overlay windows use `setContentProtection(true)`, so the selection is not in the video.
- Esc on the overlay cancels only the selection. The countdown's global Esc is released while the
  overlay is open and taken back after (`suspendEscapeForCapture` in the recording hub).
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

- Not verified in the real app: that macOS honours content protection on the overlay so the
  selection is absent from a real recording.
- Out of scope: linking the screenshot to the video, shortcut simplification, widget mic and audio
  buttons, Windows.
