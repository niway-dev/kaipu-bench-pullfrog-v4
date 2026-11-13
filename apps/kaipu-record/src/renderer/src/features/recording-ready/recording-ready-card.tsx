import { useEffect, useRef, useState } from "react";
import type { RecordingReadyPayload, RecordingReadyTimer } from "@shared/types/recording-ready";
import type { RecordingReadyCardBridge } from "@shared/types/electron-api";
import { PostRecordingCard } from "@renderer/features/status-cards/post-recording-card";
import styles from "./recording-ready-card.module.css";
import { uiArea } from "@renderer/lib/ui-area";

interface RecordingReadyCardProps {
  /** Injected by tests; the window's bridge otherwise. */
  api?: RecordingReadyCardBridge;
}

/**
 * The bar's state: each running timer from main is a new `run` (the animation restarts from
 * full over `durationMs`); a held timer freezes the current run where it is.
 */
interface BarState {
  run: number;
  durationMs: number;
  running: boolean;
}

/**
 * Root of the "Your video is ready" window (`?window=recording-ready`), floating on the
 * desktop after a take. The same `PostRecordingCard` the recording page falls back to; it
 * only renders main's payload and reports presses. Main closes the window and takes the
 * main window where the press goes. The card's height is reported so the window fits it.
 * Main hides it on a timer that the pointer holds; the bar at the bottom mirrors that timer
 * (`recording-ready:timer`), like the capture toast's.
 */
export function RecordingReadyCard({
  api = window.electronAPI.recordingReadyCard,
}: RecordingReadyCardProps): React.JSX.Element | null {
  const [payload, setPayload] = useState<RecordingReadyPayload | null>(null);
  const [bar, setBar] = useState<BarState>({ run: 0, durationMs: 0, running: false });
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribeShow = api.onShow(setPayload);
    const unsubscribeTimer = api.onTimer(({ remainingMs }: RecordingReadyTimer) =>
      setBar((previous) =>
        remainingMs === null
          ? { ...previous, running: false }
          : { run: previous.run + 1, durationMs: remainingMs, running: true },
      ),
    );
    // After subscribing: main sends the current payload in answer.
    api.ready();
    return () => {
      unsubscribeShow();
      unsubscribeTimer();
    };
  }, [api]);

  // Escape closes it, once the user has clicked into the card (it never takes focus itself).
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") api.action({ kind: "dismiss" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [api]);

  const visible = payload !== null;
  useEffect(() => {
    const element = frame.current;
    if (!visible || !element) return;
    const report = (): void => {
      const height = element.getBoundingClientRect().height;
      if (height > 0) api.resize(height);
    };
    report();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [api, visible]);

  if (!payload) return null;

  return (
    <div {...uiArea("recordingReady.root")} ref={frame} className={styles.frame}>
      <PostRecordingCard
        ui={uiArea("recordingReady.card")}
        // A new payload is a new recording: start the card over (its pop-in included).
        key={payload.assetId}
        durationSeconds={payload.durationSeconds}
        dimensions={payload.dimensions}
        sizeBytes={payload.sizeBytes}
        onPick={(destination) => api.action({ kind: "pick", destination })}
        onEditFirst={payload.canEdit ? () => api.action({ kind: "edit" }) : undefined}
        onDismiss={() => api.action({ kind: "dismiss" })}
        onOpen={() => api.action({ kind: "open" })}
        onMouseEnter={() => api.hover(true)}
        onMouseLeave={() => api.hover(false)}
        countdown={
          <div className={styles.bar} aria-hidden>
            <i
              key={bar.run}
              data-run={bar.run > 0 ? "true" : "false"}
              data-running={bar.running ? "true" : "false"}
              style={{ animationDuration: `${bar.durationMs}ms` }}
            />
          </div>
        }
      />
    </div>
  );
}
