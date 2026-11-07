import type { BackgroundId } from "../screenshots/beautify/backgrounds";
import { BACKGROUND_STARTER_LOOK, parseBackground, type VideoBackground } from "./background";
import { backgroundOf, type VideoScene } from "./scene";

export type BackgroundPatch = Partial<VideoBackground>;

/**
 * The scene with `patch` applied to its background, clamped to the screenshot editor's ranges.
 * Returns the SAME scene when nothing changes, so `commit` records no undo step and the editor
 * does not turn dirty for a click on the preset that is already chosen. The padding, radius and
 * shadow are kept when the preset goes back to `none`: choosing a preset again restores them.
 */
export function updateBackground(scene: VideoScene, patch: BackgroundPatch): VideoScene {
  const current = backgroundOf(scene);
  const next = parseBackground({ ...current, ...patch });
  if (
    next.bg === current.bg &&
    next.padding === current.padding &&
    next.radius === current.radius &&
    next.shadow === current.shadow
  ) {
    return scene;
  }
  return { ...scene, background: next };
}

/**
 * The scene after a preset click. On a scene whose padding, corners and shadow are ALL 0 a real
 * preset comes with `BACKGROUND_STARTER_LOOK`, so the pick is visible at once; it is one scene,
 * hence one undo step. If any of the three is already non-zero only the preset changes, and
 * `none` never touches the numbers (they are kept, undrawn, so a later pick keeps the user's own
 * rather than the starter look). Returns the SAME scene when nothing changes.
 */
export function chooseBackground(scene: VideoScene, bg: BackgroundId): VideoScene {
  const { padding, radius, shadow } = backgroundOf(scene);
  const fresh = padding === 0 && radius === 0 && shadow === 0;
  return updateBackground(
    scene,
    bg !== "none" && fresh ? { bg, ...BACKGROUND_STARTER_LOOK } : { bg },
  );
}
