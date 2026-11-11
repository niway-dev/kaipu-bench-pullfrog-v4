import { CANVAS_ASSET_ID_PATTERN } from "@shared/types/screenshot-canvas";
import {
  BACKGROUND_IDS,
  PADDING_RANGE,
  RADIUS_RANGE,
  SHADOW_RANGE,
  type BeautifyState,
} from "../beautify/backgrounds";
import type { Annotation, CropRect, Scene } from "./scene";
import { STEP_PX, STROKE_WIDTHS, TEXT_SIZES } from "./tools";

/** A stored preset index (stroke level, text size): an integer inside its table. Anything
 * else would draw a NaN stroke, so the document is refused instead. */
const level = (v: unknown, table: readonly unknown[]): boolean =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) < table.length;

/**
 * The canvas document (ADR 0053), serialized as `.kaipu/<id>.canvas.json`. Main stores it
 * verbatim; this file owns the schema and its validation.
 */
export const CANVAS_DOC_VERSION = 1;
/** Asset id of the base image. */
export const BASE_ASSET_ID = "base";

export interface CanvasImageItem {
  id: string;
  kind: "image";
  assetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  pixelWidth: number;
  pixelHeight: number;
}

export interface CanvasDocV1 {
  schemaVersion: 1;
  /** z-order = array order. Item 0 is the base image; annotation coordinates are normalized to it (the M2 model), so an image item's x/y/w/h are in base-image px and the base sits at 0,0 with w/h = its pixel size. */
  items: (CanvasImageItem | Annotation)[];
  frame: BeautifyState;
  exportFrame?: CropRect;
}

/**
 * Builds the document for a save. Every redaction is written `locked`: this save bakes
 * its pixels into the asset. `crop` is not stored (canvas mode exports by `exportFrame`).
 */
export function buildCanvasDoc(
  scene: Scene,
  base: { pixelWidth: number; pixelHeight: number; assetId?: string },
): CanvasDocV1 {
  const image: CanvasImageItem = {
    id: "image-base",
    kind: "image",
    assetId: base.assetId ?? BASE_ASSET_ID,
    x: 0,
    y: 0,
    w: base.pixelWidth,
    h: base.pixelHeight,
    pixelWidth: base.pixelWidth,
    pixelHeight: base.pixelHeight,
  };
  const annotations = scene.annotations.map(
    (a): Annotation => (a.kind === "blur" ? { ...a, locked: true } : a),
  );
  const doc: CanvasDocV1 = {
    schemaVersion: CANVAS_DOC_VERSION,
    items: [image, ...annotations],
    frame: scene.beautify,
  };
  if (scene.exportFrame) doc.exportFrame = scene.exportFrame;
  return doc;
}

export interface ParsedCanvasDoc {
  /**
   * The base image (item 0). M3 supports one image; a document with more image items
   * is accepted and the extras are ignored here (M6 adds them).
   */
  base: CanvasImageItem;
  /** `crop` is always undefined: canvas mode exports by `exportFrame`. */
  scene: Scene;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === "string";
const nums = (o: Obj, keys: string[]): boolean => keys.every((k) => num(o[k]));

function parseImage(o: Obj): CanvasImageItem | null {
  if (!str(o.id) || !str(o.assetId) || !CANVAS_ASSET_ID_PATTERN.test(o.assetId)) return null;
  if (!nums(o, ["x", "y", "w", "h", "pixelWidth", "pixelHeight"])) return null;
  if ((o.w as number) <= 0 || (o.h as number) <= 0) return null;
  if ((o.pixelWidth as number) <= 0 || (o.pixelHeight as number) <= 0) return null;
  return {
    id: o.id,
    kind: "image",
    assetId: o.assetId,
    x: o.x as number,
    y: o.y as number,
    w: o.w as number,
    h: o.h as number,
    pixelWidth: o.pixelWidth as number,
    pixelHeight: o.pixelHeight as number,
  };
}

function parseAnnotation(o: Obj): Annotation | null {
  if (!str(o.id)) return null;
  switch (o.kind) {
    case "box":
      return nums(o, ["x", "y", "w", "h", "stroke", "seed"]) &&
        level(o.stroke, STROKE_WIDTHS) &&
        str(o.color)
        ? (o as unknown as Annotation)
        : null;
    case "arrow":
      return nums(o, ["x1", "y1", "x2", "y2", "stroke", "seed"]) &&
        level(o.stroke, STROKE_WIDTHS) &&
        str(o.color)
        ? (o as unknown as Annotation)
        : null;
    case "text":
      if (!nums(o, ["x", "y", "size"]) || !str(o.text) || !str(o.color)) return null;
      if (!level(o.size, TEXT_SIZES)) return null;
      if (o.width !== undefined && !num(o.width)) return null;
      if (o.fontPx !== undefined && !num(o.fontPx)) return null;
      return o as unknown as Annotation;
    case "path":
      if (!nums(o, ["stroke"]) || !level(o.stroke, STROKE_WIDTHS)) return null;
      if (!str(o.color) || !Array.isArray(o.points)) return null;
      return o.points.every((p) => isObj(p) && nums(p, ["x", "y"]))
        ? (o as unknown as Annotation)
        : null;
    case "step":
      return nums(o, ["x", "y", "size"]) && level(o.size, STEP_PX) && str(o.color)
        ? (o as unknown as Annotation)
        : null;
    case "blur":
      if (!nums(o, ["x", "y", "w", "h"])) return null;
      if (o.style !== undefined && o.style !== "blur" && o.style !== "solid") return null;
      if (o.locked !== undefined && typeof o.locked !== "boolean") return null;
      return o as unknown as Annotation;
    default:
      return null;
  }
}

function parseFrame(v: unknown): BeautifyState | null {
  if (!isObj(v) || !str(v.bg) || !(BACKGROUND_IDS as readonly string[]).includes(v.bg)) return null;
  if (!nums(v, ["padding", "radius", "shadow"])) return null;
  // Inside the panel's ranges: a negative padding would give the export a negative size.
  const within = (n: unknown, r: { min: number; max: number }): boolean =>
    (n as number) >= r.min && (n as number) <= r.max;
  if (!within(v.padding, PADDING_RANGE) || !within(v.radius, RADIUS_RANGE)) return null;
  if (!within(v.shadow, SHADOW_RANGE)) return null;
  return v as unknown as BeautifyState;
}

/** Parses a stored document. Null means "fall back to the flattened PNG": never guess. */
export function parseCanvasDoc(json: string): ParsedCanvasDoc | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isObj(raw) || raw.schemaVersion !== CANVAS_DOC_VERSION || !Array.isArray(raw.items))
    return null;
  const frame = parseFrame(raw.frame);
  if (!frame) return null;
  let exportFrame: CropRect | undefined;
  if (raw.exportFrame !== undefined) {
    if (!isObj(raw.exportFrame) || !nums(raw.exportFrame, ["x", "y", "w", "h"])) return null;
    exportFrame = raw.exportFrame as unknown as CropRect;
  }
  let base: CanvasImageItem | null = null;
  const annotations: Annotation[] = [];
  for (let i = 0; i < raw.items.length; i++) {
    const item: unknown = raw.items[i];
    if (!isObj(item)) return null;
    if (item.kind === "image") {
      const image = parseImage(item);
      if (!image) return null;
      if (i === 0) base = image;
      continue;
    }
    if (i === 0) return null; // item 0 must be the base image
    const annotation = parseAnnotation(item);
    if (!annotation) return null;
    annotations.push(annotation);
  }
  if (!base) return null;
  const scene: Scene = { beautify: frame, annotations };
  if (exportFrame) scene.exportFrame = exportFrame;
  return { base, scene };
}
