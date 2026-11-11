import React, { useCallback, useEffect, useRef } from "react";
import type { LocatedImage } from "./colors-client";
import styles from "./colors.module.css";

/**
 * The locate highlight: an image-sized canvas over the shot (inside the frame's overlay slot,
 * so zoom, pan and a crop window move and clip it with the image), dim everywhere except the
 * located pixels. Pointer events pass through.
 */
export function LocateOverlay({ image }: { image: LocatedImage | null }): React.JSX.Element | null {
  const ref = useRef<HTMLCanvasElement | null>(null);
  // Release the backing store (59 MiB at 5K) as soon as the canvas leaves the page, which is
  // when the highlight is cleared: a callback ref still holds the node at that moment.
  const attach = useCallback((canvas: HTMLCanvasElement | null): void => {
    const previous = ref.current;
    if (!canvas && previous) {
      previous.width = 0;
      previous.height = 0;
    }
    ref.current = canvas;
  }, []);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (image.bitmap) ctx.drawImage(image.bitmap, 0, 0);
    else {
      const data = ctx.createImageData(image.width, image.height);
      data.data.set(image.pixels);
      ctx.putImageData(data, 0, 0);
    }
  }, [image]);
  if (!image) return null;
  return (
    <canvas
      ref={attach}
      className={styles.overlay}
      width={image.width}
      height={image.height}
      data-testid="inspect-locate"
      data-matched={image.matched}
      aria-hidden
    />
  );
}
