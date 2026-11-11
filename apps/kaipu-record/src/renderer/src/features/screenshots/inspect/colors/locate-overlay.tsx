import React, { useEffect, useRef } from "react";
import type { LocatedImage } from "./colors-client";
import styles from "./colors.module.css";

/**
 * The locate highlight: an image-sized canvas over the shot (inside the frame's overlay slot,
 * so zoom, pan and a crop window move and clip it with the image), dim everywhere except the
 * located pixels. Pointer events pass through.
 */
export function LocateOverlay({ image }: { image: LocatedImage | null }): React.JSX.Element | null {
  const ref = useRef<HTMLCanvasElement>(null);
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
  // Release the backing store (59 MiB at 5K) as soon as the highlight goes.
  useEffect(
    () => () => {
      const canvas = ref.current;
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    },
    [],
  );
  if (!image) return null;
  return (
    <canvas
      ref={ref}
      className={styles.overlay}
      width={image.width}
      height={image.height}
      data-testid="inspect-locate"
      data-matched={image.matched}
      aria-hidden
    />
  );
}
