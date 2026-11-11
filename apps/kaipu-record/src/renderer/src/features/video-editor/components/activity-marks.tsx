/**
 * Cursor activity marks — the EVIDENCE for the zooms (UI spec § 6.2), drawn inside the Zooms lane
 * (ADR 0050 decision 4): a tall accent tick per click, a short muted bar per pointer pause
 * (height = how long it lasted). Read-only, behind the blocks, never takes a pointer event.
 * Marks are in SOURCE seconds and mapped through source-time.ts, so a cut hides the evidence of
 * deleted footage exactly like it hides the footage.
 *
 * Its own module so the render-split guard can count its renders (the page's render-count test
 * mocks lane modules), and so the layer stays a memoised component of its own: it was the
 * memoised `ActivityLane` row before the marks moved into the Zooms lane (NIW2-662, NIW2-665).
 * Its classes stay in zoom-lane.module.css, next to the lane that positions it.
 */
import { memo } from "react";
import { sourceRangeToTimelineBlocks } from "../source-time";
import { type LayoutEntry, sourceToTimeline } from "../timeline";
import type { ActivityMark } from "../zoom/detect-zoom-segments";
import { timeToFraction } from "./timeline-geometry";
import styles from "./zoom-lane.module.css";

// Pointer-pause bars grow with how long the pause lasted.
const DWELL_MIN_PX = 3;
const DWELL_MAX_PX = 8;

/** Memoised (NIW2-662): a selection or an edge drag re-renders ZoomLane with the same marks,
 *  layout and duration, so this layer (thousands of spans on a long recording) skips it. */
export const ActivityMarks = memo(function ActivityMarks({
  marks,
  layout,
  duration,
}: {
  marks: ActivityMark[];
  layout: LayoutEntry[];
  duration: number;
}): React.JSX.Element {
  return (
    <div className={styles.marks} data-activity-marks aria-hidden="true">
      {marks.flatMap((mark, i) => {
        if (mark.kind === "click") {
          const at = sourceToTimeline(layout, mark.t);
          if (at === null) return [];
          return [
            <span
              key={`c${i}`}
              className={styles.click}
              data-activity-mark="click"
              style={{ left: `${timeToFraction(at, duration) * 100}%` }}
            />,
          ];
        }
        const height = DWELL_MIN_PX + (DWELL_MAX_PX - DWELL_MIN_PX) * mark.strength;
        return sourceRangeToTimelineBlocks(layout, mark.start, mark.end).map((block, j) => (
          <span
            key={`d${i}-${j}`}
            className={styles.dwell}
            data-activity-mark="dwell"
            style={{
              left: `${timeToFraction(block.timelineStart, duration) * 100}%`,
              width: `${timeToFraction(block.timelineEnd - block.timelineStart, duration) * 100}%`,
              height: `${height}px`,
            }}
          />
        ));
      })}
    </div>
  );
});
