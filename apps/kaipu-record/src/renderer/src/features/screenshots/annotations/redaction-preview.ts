import { useEffect, useState } from "react";
import { redactRegion } from "./redaction";
import type { RedactionStyle } from "./scene";

/** A rect in natural image px, already clipped to the image. */
export interface NaturalRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Normalized rect → natural px, clipped to the image with the same rounding as
 * `bakeRedactions`, so the preview tile covers exactly what the export will redact.
 * null when nothing of it falls inside the image.
 */
export function naturalRect(
  r: { x: number; y: number; w: number; h: number },
  naturalW: number,
  naturalH: number,
): NaturalRect | null {
  const x0 = Math.max(0, Math.floor(r.x * naturalW));
  const y0 = Math.max(0, Math.floor(r.y * naturalH));
  const x1 = Math.min(naturalW, Math.ceil((r.x + r.w) * naturalW));
  const y1 = Math.min(naturalH, Math.ceil((r.y + r.h) * naturalH));
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

/**
 * Decoded images, loaded once per display URL: the base shot plus each image added to the
 * canvas (NIW2-703), so a blur over an added image redacts THAT image's pixels. Small and
 * least-recently-used: an entry is dropped once more than `MAX_IMAGES` others were used
 * since, so a long session does not keep every decoded bitmap alive. Evicted bitmaps are
 * not closed: a tile render may still hold one, and the GC frees it.
 *
 * Decoded from the fetched BYTES, not through an `<img>`: a vault shot's URL is
 * `kaipu-media://`, another origin than the page, so an `<img>` loaded without CORS taints
 * the canvas and `getImageData` throws — the preview then silently drew nothing (seen in
 * the real app, NIW2-700). A bitmap made from a blob is never tainted. The decode options
 * are the ones `bakeRedactions` uses, so the preview shows the pixels the save writes.
 */
const images = new Map<string, Promise<ImageBitmap | null>>();
export const MAX_IMAGES = 6;

export function loadImage(src: string): Promise<ImageBitmap | null> {
  const hit = images.get(src);
  if (hit) {
    // Re-insert so the Map's order is recency order.
    images.delete(src);
    images.set(src, hit);
    return hit;
  }
  const image = fetch(src)
    .then((response) => {
      if (!response.ok) throw new Error(`redaction preview: ${response.status}`);
      return response.blob();
    })
    .then((blob) =>
      createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" }),
    )
    .catch(() => {
      // Not cached: the next preview of this image tries again.
      if (images.get(src) === image) images.delete(src);
      return null;
    });
  images.set(src, image);
  while (images.size > MAX_IMAGES) images.delete(images.keys().next().value as string);
  return image;
}

/** Test seam: forget every decoded image. */
export function clearImageCache(): void {
  images.clear();
}

/** Tiles by (src, rect, style); small and bounded, a drag evicts as it goes. */
const tiles = new Map<string, string | null>();
const MAX_TILES = 32;

function renderTile(img: ImageBitmap, rect: NaturalRect, style: RedactionStyle): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = rect.w;
  canvas.height = rect.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  const data = ctx.getImageData(0, 0, rect.w, rect.h);
  redactRegion(data, style);
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * The real redaction of a region, as a PNG data URL for the canvas-mode preview (the
 * same `redactRegion` the save bakes). `null` while loading, when the rect is outside
 * the image, or when the image fails to decode (draw nothing).
 */
export function useRedactionTile(
  src: string,
  rect: { x: number; y: number; w: number; h: number },
  style: RedactionStyle,
  enabled: boolean,
): { url: string; rect: NaturalRect; naturalW: number; naturalH: number } | null {
  const [state, setState] = useState<{
    url: string;
    rect: NaturalRect;
    naturalW: number;
    naturalH: number;
  } | null>(null);
  const { x, y, w, h } = rect;
  useEffect(() => {
    if (!enabled) {
      setState(null);
      return;
    }
    let live = true;
    void loadImage(src).then((img) => {
      if (!live) return;
      if (!img) return setState(null);
      const nr = naturalRect({ x, y, w, h }, img.width, img.height);
      if (!nr) return setState(null);
      const key = `${src}|${nr.x},${nr.y},${nr.w},${nr.h}|${style}`;
      let url = tiles.get(key);
      if (url === undefined) {
        try {
          url = renderTile(img, nr, style);
        } catch {
          url = null;
        }
        if (tiles.size >= MAX_TILES) tiles.delete(tiles.keys().next().value as string);
        tiles.set(key, url);
      }
      setState(url ? { url, rect: nr, naturalW: img.width, naturalH: img.height } : null);
    });
    return () => {
      live = false;
    };
  }, [src, x, y, w, h, style, enabled]);
  return enabled ? state : null;
}
