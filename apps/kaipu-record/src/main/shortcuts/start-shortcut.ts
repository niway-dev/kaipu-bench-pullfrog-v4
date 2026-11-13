/**
 * What the `startRecording` shortcut (⌃⌘X, "Start capturing") does on this press. It is one
 * key for the whole capture flow, so a second press undoes the first:
 *
 * - a take is running or counting down: stop it (the same command Stop and Esc send, which
 *   cancels a countdown and finalizes a live take);
 * - the capture selector is open: close it, as Esc does;
 * - otherwise: open the selector.
 *
 * A take wins over an open selector: a selector over a take is the capture-while-recording
 * one, and the key's job there is still to end the take.
 */
export type StartShortcutDecision = "stop" | "close" | "open";

export function decideStartShortcut(state: {
  takeActive: boolean;
  takePending: boolean;
  overlayOpen: boolean;
}): StartShortcutDecision {
  if (state.takeActive || state.takePending) return "stop";
  if (state.overlayOpen) return "close";
  return "open";
}
