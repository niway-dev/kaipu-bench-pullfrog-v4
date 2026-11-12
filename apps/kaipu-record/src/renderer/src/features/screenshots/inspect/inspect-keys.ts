/** Which Inspect action a key press means, if any. Pure, so the guard is testable alone. */
export type InspectKeyAction = "toggle" | "exit" | "copy" | "rulerX" | "rulerY";

/** True when the event came from somewhere the user is typing. */
export function isEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
    return true;
  }
  if (target.isContentEditable) return true;
  const attr = target.getAttribute("contenteditable");
  return attr !== null && attr !== "false";
}

export function inspectKeyAction(
  e: {
    key: string;
    /** The physical key: with Shift held (the outer-size modifier) `1` arrives as `!`. */
    code?: string;
    /** With Shift (Inspect's outer-size modifier) and `fitKeyTaken`, Digit1 is Fit, not the ruler. */
    shiftKey?: boolean;
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    target: EventTarget | null;
  },
  active: boolean,
  modalOpen: boolean,
  /** Canvas mode is on, so Shift+Digit1 is "fit the content" (canvas/fit-key.ts). */
  fitKeyTaken = false,
): InspectKeyAction | null {
  // Cmd/Ctrl+C and friends keep their own meaning.
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  if (modalOpen || isEditingTarget(e.target)) return null;
  if (e.key === "i" || e.key === "I") return "toggle";
  if (e.key === "Escape") return active ? "exit" : null;
  if (e.key === "c" || e.key === "C") return active ? "copy" : null;
  if (e.key === "1" || e.code === "Digit1" || e.code === "Numpad1") {
    // In canvas mode Shift+Digit1 belongs to Fit (see canvas/fit-key.ts): both must not fire.
    if (fitKeyTaken && e.shiftKey && e.code === "Digit1") return null;
    return active ? "rulerX" : null;
  }
  if (e.key === "2" || e.code === "Digit2" || e.code === "Numpad2") return active ? "rulerY" : null;
  return null;
}
