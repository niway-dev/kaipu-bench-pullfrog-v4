import { useLayoutEffect, useState, type RefObject } from "react";
import { flushSync } from "react-dom";

/**
 * Below this page width the editor's toolbar folds (mock B3). The editor window floor is 1180,
 * which leaves about 1076 px of page content, and that window must keep the full row (NIW2-351),
 * so the threshold sits under it. Compact is for windows narrower than the floor, down to the
 * image editor's 720×560 minimum.
 */
export const COMPACT_BELOW_PX = 1000;

/**
 * Below this page width the Inspect controls do not fit in the toolbar row beside Copy, Save and
 * PDF, so they use the floating card that compact uses. The default 1440 px window (about
 * 1336 px of page content) keeps the row.
 */
export const INSPECT_INLINE_MIN_PX = 1300;

/**
 * True while the element is narrower than `below` (default `COMPACT_BELOW_PX`), from a ResizeObserver on the page
 * element: it follows what the editor was actually given, not the window. The observer reports
 * the size once as soon as it observes, so the first paint already has the right layout (the
 * update is flushed inside the callback, before the browser paints). Until it reports, and in an
 * environment that never reports (jsdom), the answer is "not compact".
 *
 * `revision` re-observes when the element appears after the first render (the editor draws
 * nothing until its image resolves, so the ref is empty on the first pass).
 */
export function useCompactEditor(
  ref: RefObject<HTMLElement | null>,
  revision: unknown,
  below: number = COMPACT_BELOW_PX,
): boolean {
  const [compact, setCompact] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      const width = entry.contentRect.width;
      flushSync(() => setCompact(width > 0 && width < below));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, revision, below]);
  return compact;
}
