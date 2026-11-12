import { useLayoutEffect, useState, type RefObject } from "react";
import { offContentDirection, type Direction } from "./off-content";

/**
 * Which way the content box went when most of it is off the visible stage (mock A6), or null
 * while there is nothing to say. Measured from the DOM, the way the user sees it: the canvas
 * element is the stage, and its first child (the frame, which carries the pan and zoom) is the
 * content box. Re-measured after every render in which `deps` changed (the view, the content's
 * size) and whenever the stage itself is resized.
 */
export function useOffContent(
  canvasRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  deps: readonly unknown[],
): Direction | null {
  const [direction, setDirection] = useState<Direction | null>(null);
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!enabled || !canvas) {
      setDirection(null);
      return;
    }
    const measure = (): void => {
      const frame = canvas.firstElementChild;
      if (!(frame instanceof HTMLElement)) {
        setDirection(null);
        return;
      }
      const c = canvas.getBoundingClientRect();
      const f = frame.getBoundingClientRect();
      setDirection(
        offContentDirection(
          { w: c.width, h: c.height },
          { x: f.left - c.left, y: f.top - c.top, w: f.width, h: f.height },
        ),
      );
    };
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(canvas);
    return () => obs.disconnect();
    // `deps` is the caller's list of what moves the content or the stage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, enabled, ...deps]);
  return direction;
}
