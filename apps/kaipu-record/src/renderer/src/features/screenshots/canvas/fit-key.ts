import { isEditingTarget } from "../inspect/inspect-keys";

/**
 * Shift+1: fit the content in view (mock A6). Read from the physical key, because Shift
 * changes the character `1` types and the character depends on the keyboard layout. Plain
 * `1` belongs to Inspect's ruler, and the number pad's 1 is not this shortcut. Pure, so the
 * guard is testable alone.
 */
export function isFitContentKey(
  e: {
    code: string;
    shiftKey: boolean;
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    target: EventTarget | null;
  },
  modalOpen: boolean,
): boolean {
  if (e.code !== "Digit1" || !e.shiftKey) return false;
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  return !modalOpen && !isEditingTarget(e.target);
}
