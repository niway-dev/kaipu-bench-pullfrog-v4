import { Lock } from "lucide-react";
import { useTranslations } from "@kaipu/i18n";
import type { SwatchKind } from "../track-guide";
import audioStyles from "./audio-lane.module.css";
import overlayStyles from "./overlay-lane.module.css";
import privacyStyles from "./privacy-lane.module.css";
import webcamStyles from "./webcam-lane.module.css";
import zoomStyles from "./zoom-lane.module.css";
import styles from "./timeline-guide.module.css";

/**
 * A legend row's sample: the lane's own classes at a fixed 46 × 20 px, so the legend shows
 * the very shapes the timeline draws (a change to a lane's look reaches the guide).
 */
export function GuideSwatch({ kind }: { kind: SwatchKind }): React.JSX.Element {
  const t = useTranslations("videoEditor");
  const box = (children: React.ReactNode, extra = ""): React.JSX.Element => (
    <span className={`${styles.swatch} ${extra}`} aria-hidden>
      {children}
    </span>
  );
  const fill = { left: 0, width: "100%" } as const;

  switch (kind) {
    case "frames":
      return box(<span className={styles.swatchFrames} />);
    case "trim":
      return box(<span className={styles.trimHandle} style={{ left: "50%" }} />);
    case "pill":
      return box(
        <span className={overlayStyles.pill} style={{ ...fill, background: "#f6055cb3" }} />,
      );
    case "pillSelected":
      return box(
        <span
          className={`${overlayStyles.pill} ${overlayStyles.pillSelected}`}
          style={{ ...fill, background: "#f6055cb3" }}
        />,
      );
    case "zoom":
      return box(
        <span className={zoomStyles.block} style={fill}>
          <span className={zoomStyles.level}>2.0×</span>
          <Lock size={9} className={zoomStyles.lock} />
        </span>,
      );
    case "click":
      return box(<span className={zoomStyles.click} style={{ left: "50%" }} />);
    case "pause":
      return box(<span className={zoomStyles.dwell} style={{ ...fill, height: 5 }} />);
    case "blur":
      return box(
        <span className={`${privacyStyles.block} ${privacyStyles.blur}`} style={fill}>
          {t("guideSwatchBlur")}
        </span>,
      );
    case "cover":
      return box(
        <span className={`${privacyStyles.block} ${privacyStyles.cover}`} style={fill}>
          {t("guideSwatchCover")}
        </span>,
      );
    case "ghost":
      return box(
        <span className={privacyStyles.ghost} style={fill}>
          {t("guideSwatchNew")}
        </span>,
      );
    case "muted":
      return box(<span className={audioStyles.block} style={fill} />);
    case "allMuted":
      return box(<span className={audioStyles.allMuted} />);
    case "faces":
      return box(<span className={styles.faces} />);
    case "hidden":
      return box(
        <span className={`${webcamStyles.block} ${webcamStyles.hidden}`} style={fill}>
          <span className={webcamStyles.label}>{t("webcamHidden")}</span>
        </span>,
      );
    case "custom":
      return box(
        <span className={webcamStyles.block} style={fill}>
          <span className={webcamStyles.label}>{t("webcamOverride")}</span>
        </span>,
      );
    case "selected":
      return box(
        <span className={`${webcamStyles.block} ${webcamStyles.selected}`} style={fill}>
          <span className={styles.selectedHandle} style={{ left: 0 }} />
          <span className={styles.selectedHandle} style={{ right: 0 }} />
        </span>,
      );
  }
}
