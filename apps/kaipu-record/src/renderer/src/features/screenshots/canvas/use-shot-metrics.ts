import { useEffect, useState, type RefObject } from "react";

/** The shot's size as the editor shows it and as the file holds it. */
export interface ShotMetrics {
  /** Layout px of the shot (CSS transforms excluded, the same width export scales by). */
  w: number;
  h: number;
  /** The file's own pixels. 0 until the image has decoded. */
  naturalW: number;
  naturalH: number;
}

/**
 * Follow the shot's layout size and natural size (canvas mode needs both to turn the
 * annotations' bounds into display-px extents). Null until measured, or while disabled.
 * Layout size ignores zoom and pan, and the frame never squeezes the shot to make room
 * for extents (see `BeautifiedFrame`), so this does not feed back into itself.
 */
export function useShotMetrics(
  imgRef: RefObject<HTMLImageElement | null>,
  enabled: boolean,
  ready: boolean,
): ShotMetrics | null {
  const [metrics, setMetrics] = useState<ShotMetrics | null>(null);
  useEffect(() => {
    const el = imgRef.current;
    if (!enabled || !ready || !el) return;
    const measure = (): void => {
      const next: ShotMetrics = {
        w: el.clientWidth,
        h: el.clientHeight,
        naturalW: el.naturalWidth,
        naturalH: el.naturalHeight,
      };
      setMetrics((prev) =>
        prev &&
        prev.w === next.w &&
        prev.h === next.h &&
        prev.naturalW === next.naturalW &&
        prev.naturalH === next.naturalH
          ? prev
          : next,
      );
    };
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    measure();
    return () => obs.disconnect();
  }, [imgRef, enabled, ready]);
  return enabled ? metrics : null;
}
