import { useLayoutEffect, type RefObject } from "react";
import { dotGrid, type Point, type View } from "./viewport";

/**
 * Pins the canvas's dot grid (NIW2-698) to the shot: writes `--dot-size`, `--dot-x` and
 * `--dot-y` on the canvas element, which its CSS background reads. It writes CSS variables
 * instead of React state so a pan does not re-render the page twice.
 *
 * Re-measures when the view or the anchor changes, and when the canvas resizes (the frame
 * re-centres, which moves its rest origin). The frame is the canvas's first child, as in
 * `useCanvasViewport`.
 */
export function useDotGrid(
  canvasRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  view: View,
  anchor: Point,
): void {
  const { x: ax, y: ay } = anchor;
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!enabled || !canvas) return;
    const paint = (): void => {
      const frame = canvas.firstElementChild;
      if (!(frame instanceof HTMLElement)) return;
      const origin = {
        x: frame.offsetLeft - canvas.offsetLeft,
        y: frame.offsetTop - canvas.offsetTop,
      };
      const g = dotGrid(view, origin, { x: ax, y: ay });
      canvas.style.setProperty("--dot-size", `${g.size}px`);
      canvas.style.setProperty("--dot-x", `${g.x}px`);
      canvas.style.setProperty("--dot-y", `${g.y}px`);
    };
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    const frame = canvas.firstElementChild;
    if (frame) observer.observe(frame);
    return () => observer.disconnect();
  }, [canvasRef, enabled, view, ax, ay]);
}
