import type { CaptureIntent } from "@shared/types/screenshot-capture";

/**
 * Which key was pressed. `capture` is ⌘⇧1 (`captureScreenshot`, the widget in screenshot
 * intent); `record` is ⌘⇧2 (`startRecording`, the widget in recording intent).
 */
export type WidgetShortcutKey = "capture" | "record";

/**
 * What a widget key does on this press:
 *
 * - `stop`: the record key during a take (live or counting down): stop it, the same command
 *   Stop and Esc send, which cancels a countdown and finalizes a live take.
 * - `during-take`: the capture key during a take: whatever it did before the widget keys
 *   existed (capture while recording, or the "finish the recording first" notice). The
 *   caller routes it exactly as `captureScreenshot` always did.
 * - `close`: the widget is open in this key's own intent: close it, as Esc does.
 * - `switch`: the widget is open in the OTHER intent: switch it to this key's intent, as
 *   pressing P or V inside it does. It does not close.
 * - `open`: open the widget in this key's intent, in that intent's last mode.
 *
 * A take wins over an open widget: a widget over a take is the capture-while-recording one,
 * and the key's job there is decided by the take, not by the widget.
 */
export type WidgetShortcutDecision = "stop" | "during-take" | "close" | "switch" | "open";

export function decideWidgetShortcut(state: {
  key: WidgetShortcutKey;
  takeActive: boolean;
  takePending: boolean;
  overlayOpen: boolean;
  /** The intent the open widget shows right now; null when none is open. */
  overlayIntent: CaptureIntent | null;
}): WidgetShortcutDecision {
  if (state.takeActive || state.takePending) {
    return state.key === "record" ? "stop" : "during-take";
  }
  if (!state.overlayOpen) return "open";
  // An open widget with an intent the keys do not own (`instant` opens none) is treated as
  // the other key's: the press switches it to this key's intent.
  return state.overlayIntent === state.key ? "close" : "switch";
}
