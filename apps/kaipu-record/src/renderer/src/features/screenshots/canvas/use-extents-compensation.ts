import { useLayoutEffect, useRef } from "react";
import { ZERO_EXTENTS } from "../annotations/canvas-geometry";
import type { Insets } from "./viewport";

/**
 * Keeps the shot where the user left it on screen when the content box grows or shrinks
 * (the frame is re-centred, which would slide the shot). Each change calls
 * `compensate(prev, next)`.
 *
 * The FIRST measurement is a baseline, never a change: a reopened document (ADR 0053) can
 * already hold content outside the image, and compensating from "no extents" to those would
 * pan the content box off-centre. Seeding from the first measure shows the content box in
 * the initial view, like a fresh open. `measured` is false until the shot has a size.
 */
export function useExtentsCompensation(
  extents: Insets,
  measured: boolean,
  compensate: (prev: Insets, next: Insets) => void,
): void {
  const prevExtents = useRef<Insets>(ZERO_EXTENTS);
  const seeded = useRef(false);
  useLayoutEffect(() => {
    const prev = prevExtents.current;
    prevExtents.current = extents;
    if (!seeded.current) {
      if (measured) seeded.current = true;
      return;
    }
    if (
      prev.left !== extents.left ||
      prev.top !== extents.top ||
      prev.right !== extents.right ||
      prev.bottom !== extents.bottom
    ) {
      compensate(prev, extents);
    }
  }, [extents, measured, compensate]);
}
