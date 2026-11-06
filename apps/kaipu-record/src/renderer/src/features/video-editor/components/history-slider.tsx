/**
 * A range input wired to the scene-history contract (plans/video-editor-v2/07): a
 * pointer gesture is ONE undo step (onBegin → onLive… → onEnd), a keyboard step is a
 * discrete onCommit. Used by every continuous inspector control.
 *
 * Accessibility: the row is NOT a <label> wrapping the control. A wrapping label would
 * fold the live value ("2.4×") into the slider's accessible name, so every arrow-key
 * step would re-announce "Level 2.4× slider" instead of just the new value — which the
 * range role already reports. Instead the control is named with `aria-label`, the muted
 * helper text is a sibling referenced by `aria-describedby`, and the on-screen value is
 * `aria-hidden`; a custom `format` is exposed as `aria-valuetext`, so the role announces
 * the same text the screen shows (a stored 0.12 reads "10%", not "0.12").
 */
import { useEffect, useId, useRef, useState } from "react";
import styles from "./history-slider.module.css";

export interface HistorySliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Text shown next to the label, e.g. "2.1×". Defaults to the raw value. */
  format?: (value: number) => string;
  /** Muted helper text under the slider. */
  note?: string;
  disabled?: boolean;
  onBegin(): void;
  onLive(value: number): void;
  onEnd(): void;
  onCommit(value: number): void;
}

export function HistorySlider({
  label,
  value,
  min,
  max,
  step,
  format,
  note,
  disabled = false,
  onBegin,
  onLive,
  onEnd,
  onCommit,
}: HistorySliderProps): React.JSX.Element {
  const dragging = useRef(false);
  const noteId = useId();
  // Live updates reach the scene at most once per animation frame: every scene change
  // re-renders the whole editor page, and a pointer can fire several moves per frame. The
  // input is controlled from the scene, so while dragging it shows `draft` — the latest
  // pointer value — and stays responsive even though the scene lags one frame behind.
  const [draft, setDraft] = useState<number | null>(null);
  const pending = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const onLiveRef = useRef(onLive);
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onLiveRef.current = onLive;
    onEndRef.current = onEnd;
  });
  // Sends the newest pending value now and drops the scheduled frame.
  const flush = (): void => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    if (pending.current !== null) {
      const next = pending.current;
      pending.current = null;
      onLiveRef.current(next);
    }
  };
  const finish = (): void => {
    if (!dragging.current) return;
    dragging.current = false;
    flush();
    onEnd();
    setDraft(null);
  };
  // Unmounted mid-drag (the inspector swapped under the pointer): pointerup never reaches
  // this input, so close the gesture here — an open drag makes the scene drop every later
  // commit and undo.
  useEffect(
    () => () => {
      if (!dragging.current) return;
      dragging.current = false;
      flush();
      onEndRef.current();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flush only touches refs
    [],
  );
  const shown = draft ?? value;
  return (
    <div className={styles.row}>
      <span className={styles.head}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value} aria-hidden>
          {format ? format(shown) : String(shown)}
        </span>
      </span>
      <input
        className={styles.input}
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={format ? format(shown) : undefined}
        aria-describedby={note ? noteId : undefined}
        onPointerDown={(event) => {
          // Optional call: jsdom has no setPointerCapture (same guard as the timeline).
          event.currentTarget.setPointerCapture?.(event.pointerId);
          dragging.current = true;
          onBegin();
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
        onChange={(event) => {
          const next = Number(event.currentTarget.value);
          if (!dragging.current) {
            onCommit(next);
            return;
          }
          setDraft(next);
          pending.current = next;
          frame.current ??= requestAnimationFrame(() => {
            frame.current = null;
            flush();
          });
        }}
      />
      {note && (
        <p id={noteId} className={styles.note}>
          {note}
        </p>
      )}
    </div>
  );
}
