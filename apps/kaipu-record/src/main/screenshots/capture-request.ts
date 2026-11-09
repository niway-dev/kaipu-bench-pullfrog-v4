/**
 * What a capture shortcut (⌘⌃X, the panel's "Capture Screen") does when asked to capture.
 *
 * During a recording the main window is hidden, so the renderer's own guard
 * ("finish the recording first") would toast into an invisible window. Main
 * knows the recording is active, so it refuses here and tells the user with a
 * system notification instead. Outside a recording it forwards the request to
 * the renderer, which keeps its own guard for the countdown phase (the hub is
 * not active yet, but the window is still visible).
 *
 * Behind the `capture-while-recording` flag on macOS (`allowDuringTake`), a take no longer
 * refuses: the request is forwarded and the capture flow saves the shot quietly.
 */
export interface CaptureRequestDeps {
  isRecordingActive: () => boolean;
  /** The flag is on and the platform supports it: a take does not refuse a capture. */
  allowDuringTake?: () => boolean;
  notifyBusy: () => void;
  forwardToRenderer: () => void;
}

export function routeCaptureRequest(deps: CaptureRequestDeps): void {
  if (deps.isRecordingActive() && !deps.allowDuringTake?.()) {
    deps.notifyBusy();
    return;
  }
  deps.forwardToRenderer();
}
