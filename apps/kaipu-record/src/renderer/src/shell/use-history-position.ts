import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Where the current page sits in the window's in-app history: whether a Back and a
 * Forward exist for the title bar's arrows.
 *
 * React Router's hash history numbers every entry it creates (`history.state.idx`, from 0
 * on the first page), so "a page before this one" is `idx > 0`. The browser never says how
 * many entries lie ahead, so the furthest index this window reached is remembered here:
 * a PUSH lands on a new furthest entry and drops whatever was ahead, a POP (the arrows,
 * the mouse's side buttons) moves within what exists, a REPLACE keeps the position.
 *
 * An entry the router did not create (a raw hash change) has no index and counts as the
 * start: the arrows go dim instead of guessing.
 */
export function useHistoryPosition(): { canGoBack: boolean; canGoForward: boolean } {
  // Re-render on every navigation; the index itself lives in the browser's history state.
  useLocation();
  const action = useNavigationType();
  const index = currentIndex();
  if (index === null) return { canGoBack: false, canGoForward: false };
  if (action === "PUSH" || furthestIndex === null || index > furthestIndex) {
    furthestIndex = index;
  }
  return { canGoBack: index > 0, canGoForward: index < furthestIndex };
}

let furthestIndex: number | null = null;

function currentIndex(): number | null {
  const state: unknown = window.history.state;
  if (state && typeof state === "object" && "idx" in state) {
    const idx = (state as { idx: unknown }).idx;
    return typeof idx === "number" ? idx : null;
  }
  return null;
}

/** Tests: forget the furthest entry between routers. */
export function resetHistoryPositionForTests(): void {
  furthestIndex = null;
}
