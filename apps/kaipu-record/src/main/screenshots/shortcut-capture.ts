import type { CaptureMode } from "@shared/types/screenshot-capture";

/** The global shortcuts that start a screenshot. */
export type CaptureShortcut = "captureScreenshot" | "captureWindow";

export interface ShortcutCapture {
  /** The mode the overlay opens in (sent to the renderer as the hotkey payload). */
  mode: CaptureMode;
}

/**
 * Which mode a capture shortcut opens the overlay in:
 *
 *   • `captureScreenshot` (the generic ⌘⇧1) opens with the stored current mode. If the
 *     platform cannot serve it, it opens with Frame — the same fallback the page and the
 *     tray show — rather than answering "unsupported" for a mode the user cannot pick.
 *   • `captureWindow` opens with Window mode.
 *
 * No shortcut changes the stored mode by itself: the mode becomes current only once a
 * capture in it succeeds (the capture handler's `rememberMode`), so a shortcut that ends in
 * Esc, a recording refusal or "unsupported" leaves the default as it was.
 *
 * `supported` is `null` when it is not known yet (the screenshot IPC not registered); the
 * stored mode is then trusted.
 */
export function resolveShortcutCapture(
  action: CaptureShortcut,
  stored: CaptureMode,
  supported: readonly CaptureMode[] | null,
): ShortcutCapture {
  const serves = (mode: CaptureMode): boolean => supported === null || supported.includes(mode);
  if (action === "captureScreenshot") {
    return { mode: serves(stored) || !serves("frame") ? stored : "frame" };
  }
  return { mode: "window" };
}
