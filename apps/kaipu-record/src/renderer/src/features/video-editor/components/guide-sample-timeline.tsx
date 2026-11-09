import {
  ArrowUpRight,
  AudioLines,
  Film,
  Lock,
  PenLine,
  Shield,
  Square,
  Type,
  Webcam,
  ZoomIn,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "@kaipu/i18n";
import { GUIDE_TABS, type GuideTab, type VideoEditorKey } from "../track-guide";
import audioStyles from "./audio-lane.module.css";
import overlayStyles from "./overlay-lane.module.css";
import privacyStyles from "./privacy-lane.module.css";
import webcamStyles from "./webcam-lane.module.css";
import zoomStyles from "./zoom-lane.module.css";
import styles from "./timeline-guide.module.css";

/**
 * The guide's timeline: fictional (40 s, every lane in use), drawn with the real lane
 * stylesheets, so the sample cannot drift from the editor and never reads a session. The
 * lane of the open tab is lit and the rest dimmed; every label switches tab.
 */
const DURATION = 40;
const pct = (seconds: number): string => `${(seconds / DURATION) * 100}%`;
const span = (start: number, end: number): { left: string; width: string } => ({
  left: pct(start),
  width: pct(end - start),
});

const LANE_ICON: Record<GuideTab, LucideIcon> = {
  clips: Film,
  annotations: PenLine,
  zooms: ZoomIn,
  privacy: Shield,
  audio: AudioLines,
  webcam: Webcam,
};
const LANE_NAME: Record<GuideTab, VideoEditorKey> = {
  clips: "laneClips",
  annotations: "laneAnnotations",
  zooms: "laneZooms",
  privacy: "lanePrivacy",
  audio: "laneAudio",
  webcam: "laneWebcam",
};

const rulerLabel = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const RULER = [0, 5, 10, 15, 20, 25, 30, 35];
const FRAMES = Array.from({ length: 14 }, (_, i) => i);
const ZOOMS = [
  { start: 3, end: 12, scale: "2.0×", locked: true },
  { start: 14, end: 19, scale: "1.4×", locked: true },
  { start: 22, end: 31, scale: "2.0×", locked: false },
] as const;
const CLICKS = [3.4, 5.2, 6.1, 9.8, 14.6, 16.1, 22.4, 24.9, 25.6, 28.8, 36.5];
const PAUSES = [
  { at: 7, length: 3, height: 7 },
  { at: 18, length: 2, height: 5 },
  { at: 26, length: 3.5, height: 9 },
] as const;
const OBJECTS = [
  { start: 2, end: 9, Icon: Square },
  { start: 15, end: 22, Icon: Type },
  { start: 24, end: 30, Icon: ArrowUpRight },
] as const;

export function GuideSampleTimeline({
  active,
  onSelect,
}: {
  active: GuideTab;
  onSelect(tab: GuideTab): void;
}): React.JSX.Element {
  const t = useTranslations("videoEditor");
  const lane = (tab: GuideTab, node: React.JSX.Element): React.JSX.Element => {
    const Icon = LANE_ICON[tab];
    const lit = tab === active;
    return (
      <div
        key={tab}
        className={`${styles.sampleRow} ${lit ? styles.sampleRowLit : styles.sampleRowDim}`}
        data-lit={lit}
      >
        <button
          type="button"
          className={styles.sampleLabel}
          aria-current={lit ? "true" : undefined}
          onClick={() => onSelect(tab)}
        >
          <Icon size={14} aria-hidden />
          {t(LANE_NAME[tab])}
        </button>
        <div className={styles.sampleLane}>{node}</div>
      </div>
    );
  };

  const nodes: Record<GuideTab, React.JSX.Element> = {
    clips: (
      <div className={styles.frames}>
        {FRAMES.map((i) => (
          <span key={i} className={styles.frame} />
        ))}
        <span className={styles.trimHandle} style={{ left: 0 }} />
        <span className={styles.trimHandle} style={{ right: 0 }} />
      </div>
    ),
    annotations: (
      <div className={overlayStyles.lane}>
        {OBJECTS.map(({ start, end, Icon }) => (
          <span
            key={start}
            className={overlayStyles.pill}
            style={{ ...span(start, end), background: "#f6055cb3" }}
          >
            <Icon size={11} aria-hidden className={overlayStyles.icon} />
          </span>
        ))}
      </div>
    ),
    zooms: (
      <div className={zoomStyles.lane}>
        <div className={zoomStyles.marks}>
          {CLICKS.map((at) => (
            <span key={at} className={zoomStyles.click} style={{ left: pct(at) }} />
          ))}
          {PAUSES.map(({ at, length, height }) => (
            <span
              key={at}
              className={zoomStyles.dwell}
              style={{ left: pct(at), width: pct(length), height }}
            />
          ))}
        </div>
        {ZOOMS.map(({ start, end, scale, locked }) => (
          <span key={start} className={zoomStyles.block} style={span(start, end)}>
            <span className={zoomStyles.level}>{scale}</span>
            {locked && <Lock size={10} className={zoomStyles.lock} />}
          </span>
        ))}
      </div>
    ),
    privacy: (
      <div className={privacyStyles.lane}>
        <span className={`${privacyStyles.block} ${privacyStyles.blur}`} style={span(11, 17)}>
          {t("guideSwatchBlur")}
        </span>
        <span className={`${privacyStyles.block} ${privacyStyles.cover}`} style={span(27, 34)}>
          {t("guideSwatchCover")}
        </span>
      </div>
    ),
    audio: (
      <div className={audioStyles.lane}>
        <span className={audioStyles.block} style={span(0, 8)}>
          {t("guideSwatchMuted")}
        </span>
        <span className={audioStyles.block} style={span(17, 22)}>
          {t("guideSwatchMuted")}
        </span>
      </div>
    ),
    webcam: (
      <div className={webcamStyles.lane}>
        <div className={webcamStyles.filmstrip}>
          <div className={styles.faces} />
        </div>
        <span className={`${webcamStyles.block} ${webcamStyles.hidden}`} style={span(12, 21)}>
          <span className={webcamStyles.label}>{t("webcamHidden")}</span>
        </span>
        <span className={webcamStyles.block} style={span(28, 38)}>
          <span className={webcamStyles.label}>{t("webcamOverride")}</span>
        </span>
      </div>
    ),
  };

  return (
    <div className={styles.sample} data-testid="guide-sample">
      <div className={styles.sampleRuler} aria-hidden>
        {RULER.map((s) => (
          <span key={s} className={styles.sampleTick} style={{ left: pct(s) }}>
            {rulerLabel(s)}
          </span>
        ))}
      </div>
      {GUIDE_TABS.map((tab) => lane(tab, nodes[tab]))}
    </div>
  );
}
