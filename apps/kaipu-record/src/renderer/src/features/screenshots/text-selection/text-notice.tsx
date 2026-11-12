import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { useTranslations } from "@kaipu/i18n";
import { uiArea } from "@renderer/lib/ui-area";
import type { RecognizedText } from "./use-recognized-text";
import styles from "./text-notice.module.css";

/** A result that arrives sooner than this never shows "Reading the text…" (a cached one). */
export const READING_NOTICE_DELAY_MS = 300;
/** How long "Text can't be selected on this computer" stays before it fades. */
export const UNAVAILABLE_NOTICE_MS = 6000;
const FADE_MS = 400;

export type TextNoticeState = "reading" | "unavailable";

/**
 * Which notice the stage shows: "reading" once recognition has been pending for
 * `READING_NOTICE_DELAY_MS`, "unavailable" for `UNAVAILABLE_NOTICE_MS` after a run settles
 * unavailable (then it fades), nothing otherwise. Never an error dialog: the editor works
 * the same without text.
 */
export function useTextNoticeState(opts: {
  enabled: boolean;
  loaded: boolean;
  status: RecognizedText["status"];
}): { state: TextNoticeState | null; leaving: boolean } {
  const { enabled, loaded, status } = opts;
  const pending = enabled && loaded && status === "pending";
  const unavailable = enabled && loaded && status === "unavailable";
  const [reading, setReading] = useState(false);
  const [unavailableShown, setUnavailableShown] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!pending) {
      setReading(false);
      return;
    }
    const timer = setTimeout(() => setReading(true), READING_NOTICE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  useEffect(() => {
    setLeaving(false);
    if (!unavailable) {
      setUnavailableShown(false);
      return;
    }
    setUnavailableShown(true);
    const fade = setTimeout(() => setLeaving(true), UNAVAILABLE_NOTICE_MS - FADE_MS);
    const done = setTimeout(() => setUnavailableShown(false), UNAVAILABLE_NOTICE_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [unavailable]);

  if (pending && reading) return { state: "reading", leaving: false };
  if (unavailable && unavailableShown) return { state: "unavailable", leaving };
  return { state: null, leaving: false };
}

/**
 * The quiet notice at the stage's bottom-left, right of the zoom control (mocks G1 and G4).
 * It is a status line, not a dialog; it takes no pointer input.
 */
export function TextNotice({
  enabled,
  loaded,
  status,
  wide,
}: {
  enabled: boolean;
  loaded: boolean;
  status: RecognizedText["status"];
  /** The zoom control is wider in canvas mode (it has the Fit button). */
  wide: boolean;
}): React.JSX.Element | null {
  const t = useTranslations("screenshots");
  const { state, leaving } = useTextNoticeState({ enabled, loaded, status });
  if (!state) return null;
  return (
    <div
      {...uiArea("editorImage.textNotice")}
      className={styles.notice}
      data-state={state}
      data-wide={wide || undefined}
      data-leaving={leaving || undefined}
      role="status"
    >
      {state === "reading" ? (
        <span className={styles.dot} aria-hidden />
      ) : (
        <Info size={14} className={styles.info} aria-hidden />
      )}
      <span>{state === "reading" ? t("textReading") : t("textUnavailableNotice")}</span>
    </div>
  );
}

/**
 * The faint accent band that sweeps the image while recognition is pending (mock G1). Text
 * positions are unknown until recognition ends, so it sweeps the whole image, not the lines.
 * Shown together with the "reading" notice; hidden under `prefers-reduced-motion`.
 */
export function TextShimmer({
  enabled,
  loaded,
  status,
}: {
  enabled: boolean;
  loaded: boolean;
  status: RecognizedText["status"];
}): React.JSX.Element | null {
  const { state } = useTextNoticeState({ enabled, loaded, status });
  if (state !== "reading") return null;
  return <div className={styles.shimmer} data-testid="text-shimmer" aria-hidden />;
}
