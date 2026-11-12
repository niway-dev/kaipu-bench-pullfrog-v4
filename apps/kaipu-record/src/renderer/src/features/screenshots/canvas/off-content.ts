/**
 * The off-content notice (mock A6): when the content box has mostly left the visible stage,
 * say which way it went. Pure geometry over the stage and the content box in stage px, so the
 * threshold and the direction are tested apart from the DOM measuring.
 */

export interface StageSize {
  w: number;
  h: number;
}

/** A rectangle in stage px (the visible canvas element's own coordinates). */
export interface StageRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const DIRECTIONS = [
  "up",
  "upRight",
  "right",
  "downRight",
  "down",
  "downLeft",
  "left",
  "upLeft",
] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** The notice shows below this share of the content box's area being visible. */
export const OFF_CONTENT_THRESHOLD = 0.5;

/** The share (0-1) of `rect`'s area inside the stage. A box with no area counts as visible. */
export function visibleFraction(stage: StageSize, rect: StageRect): number {
  const area = rect.w * rect.h;
  if (!(area > 0)) return 1;
  const w = Math.min(stage.w, rect.x + rect.w) - Math.max(0, rect.x);
  const h = Math.min(stage.h, rect.y + rect.h) - Math.max(0, rect.y);
  if (!(w > 0) || !(h > 0)) return 0;
  return (w * h) / area;
}

/** An offset within 22.5 degrees of an axis counts as straight along it, not diagonal. */
const TAN_22_5 = Math.tan(Math.PI / 8);

/**
 * Which of eight directions the content's centre lies from the stage's centre. Null when the
 * stage's centre is inside the box: the user is looking at the content, zoomed in, and
 * "the content is up" would be wrong whichever way it was said.
 */
export function contentDirection(stage: StageSize, rect: StageRect): Direction | null {
  const cx = stage.w / 2;
  const cy = stage.h / 2;
  if (cx >= rect.x && cx <= rect.x + rect.w && cy >= rect.y && cy <= rect.y + rect.h) return null;
  const dx = rect.x + rect.w / 2 - cx;
  const dy = rect.y + rect.h / 2 - cy;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < ay * TAN_22_5) return dy < 0 ? "up" : "down";
  if (ay < ax * TAN_22_5) return dx < 0 ? "left" : "right";
  if (dy < 0) return dx < 0 ? "upLeft" : "upRight";
  return dx < 0 ? "downLeft" : "downRight";
}

/** The direction to show in the notice, or null while there is nothing to say. */
export function offContentDirection(stage: StageSize, rect: StageRect): Direction | null {
  if (visibleFraction(stage, rect) >= OFF_CONTENT_THRESHOLD) return null;
  return contentDirection(stage, rect);
}

/** Degrees clockwise from "up": how far to turn an up-pointing arrow to face `direction`. */
export function directionAngle(direction: Direction): number {
  return DIRECTIONS.indexOf(direction) * 45;
}
