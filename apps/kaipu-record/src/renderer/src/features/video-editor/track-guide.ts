/**
 * What the Timeline guide says about each lane (NIW2-679). Pure data: the modal renders it,
 * the message keys live in `videoEditor` (en + es). Every entry describes only what the
 * editor does today; a lane that grows a capability grows its entry in the same PR.
 */
import type { useTranslations } from "@kaipu/i18n";

/** A `videoEditor` message key: a typo in the content below fails the type check. */
export type VideoEditorKey = Parameters<ReturnType<typeof useTranslations<"videoEditor">>>[0];

/** The lanes the guide covers, in the order its tabs and its Prev/Next walk them. */
export const GUIDE_TABS = ["clips", "annotations", "zooms", "privacy", "audio", "webcam"] as const;
export type GuideTab = (typeof GUIDE_TABS)[number];

/** A guide tab is a lane key (`TrackKey`): the lane label and the tab share one vocabulary. */
export function isGuideTab(key: string): key is GuideTab {
  return (GUIDE_TABS as readonly string[]).includes(key);
}

/** How a legend row draws its sample: each kind reuses the lane's own styles. */
export type SwatchKind =
  | "frames"
  | "trim"
  | "pill"
  | "pillSelected"
  | "zoom"
  | "click"
  | "pause"
  | "blur"
  | "cover"
  | "ghost"
  | "muted"
  | "allMuted"
  | "faces"
  | "hidden"
  | "custom"
  | "selected";

export interface GuideTabContent {
  /** Message key of the tab's lane name (also the lane label). */
  nameKey: VideoEditorKey;
  introKey: VideoEditorKey;
  whyKey: VideoEditorKey;
  legend: readonly { swatch: SwatchKind; textKey: VideoEditorKey }[];
  /** `chipKey` is a message key, or null when the chip is a literal glyph (the shortcut). */
  how: readonly { chipKey: VideoEditorKey | null; chip?: string; textKey: VideoEditorKey }[];
}

export const GUIDE_CONTENT: Record<GuideTab, GuideTabContent> = {
  clips: {
    nameKey: "laneClips",
    introKey: "guideClipsIntro",
    whyKey: "guideClipsWhy",
    legend: [
      { swatch: "frames", textKey: "guideClipsLegend1" },
      { swatch: "trim", textKey: "guideClipsLegend2" },
    ],
    how: [
      { chipKey: "guideKeyTrim", textKey: "guideClipsHow1" },
      { chipKey: "guideKeySplit", textKey: "guideClipsHow2" },
      { chipKey: "guideKeyScroll", textKey: "guideClipsHow3" },
    ],
  },
  annotations: {
    nameKey: "laneAnnotations",
    introKey: "guideAnnotationsIntro",
    whyKey: "guideAnnotationsWhy",
    legend: [
      { swatch: "pill", textKey: "guideAnnotationsLegend1" },
      { swatch: "pillSelected", textKey: "guideAnnotationsLegend2" },
    ],
    how: [
      { chipKey: null, chip: "R · A · T", textKey: "guideAnnotationsHow1" },
      { chipKey: "guideKeyClickBlock", textKey: "guideAnnotationsHow2" },
      { chipKey: null, chip: "⌫", textKey: "guideAnnotationsHow3" },
    ],
  },
  zooms: {
    nameKey: "laneZooms",
    introKey: "guideZoomsIntro",
    whyKey: "guideZoomsWhy",
    legend: [
      { swatch: "zoom", textKey: "guideZoomsLegend1" },
      { swatch: "click", textKey: "guideZoomsLegend2" },
      { swatch: "pause", textKey: "guideZoomsLegend3" },
    ],
    how: [
      { chipKey: "guideKeyDragEdges", textKey: "guideZoomsHow1" },
      { chipKey: "guideKeyCameraBox", textKey: "guideZoomsHow2" },
      { chipKey: "guideKeyReanalyse", textKey: "guideZoomsHow3" },
    ],
  },
  privacy: {
    nameKey: "lanePrivacy",
    introKey: "guidePrivacyIntro",
    whyKey: "guidePrivacyWhy",
    legend: [
      { swatch: "blur", textKey: "guidePrivacyLegend1" },
      { swatch: "cover", textKey: "guidePrivacyLegend2" },
      { swatch: "ghost", textKey: "guidePrivacyLegend3" },
    ],
    how: [
      { chipKey: null, chip: "B · C", textKey: "guidePrivacyHow1" },
      { chipKey: "guideKeyDragEdges", textKey: "guidePrivacyHow2" },
      { chipKey: null, chip: "⌫", textKey: "guidePrivacyHow3" },
    ],
  },
  audio: {
    nameKey: "laneAudio",
    introKey: "guideAudioIntro",
    whyKey: "guideAudioWhy",
    legend: [
      { swatch: "muted", textKey: "guideAudioLegend1" },
      { swatch: "allMuted", textKey: "guideAudioLegend2" },
    ],
    how: [
      { chipKey: "guideKeyAudioTool", textKey: "guideAudioHow1" },
      { chipKey: "guideKeyDragEdges", textKey: "guideAudioHow2" },
      { chipKey: "guideKeySpeaker", textKey: "guideAudioHow3" },
    ],
  },
  webcam: {
    nameKey: "laneWebcam",
    introKey: "guideWebcamIntro",
    whyKey: "guideWebcamWhy",
    legend: [
      { swatch: "faces", textKey: "guideWebcamLegend1" },
      { swatch: "hidden", textKey: "guideWebcamLegend2" },
      { swatch: "custom", textKey: "guideWebcamLegend3" },
      { swatch: "selected", textKey: "guideWebcamLegend4" },
    ],
    how: [
      { chipKey: "guideKeyDragEdges", textKey: "guideWebcamHow1" },
      { chipKey: "guideKeyClickBlock", textKey: "guideWebcamHow2" },
      { chipKey: null, chip: "⌫", textKey: "guideWebcamHow3" },
    ],
  },
};

/** The tab before / after `tab`, or null at the ends. */
export function neighbourTab(tab: GuideTab, step: -1 | 1): GuideTab | null {
  return GUIDE_TABS[GUIDE_TABS.indexOf(tab) + step] ?? null;
}
