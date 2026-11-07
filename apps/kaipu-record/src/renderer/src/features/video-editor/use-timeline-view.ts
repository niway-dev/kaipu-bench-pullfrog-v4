/**
 * The timeline's zoom and scroll, kept OUTSIDE React state on purpose (NIW2-667).
 *
 * A scroll event fires every frame while the user pans, and the playhead can ask the view
 * to follow it every frame while playing. Holding those in the page's `useState` would
 * re-render the whole editor at that rate; here the page only creates the store, and each
 * consumer subscribes to the slice it draws: the strip to the whole state, the zoom control
 * to the zoom factor alone (a scroll leaves it untouched).
 *
 * The store holds `{ zoom, scroll, laneWidth }`. The duration is the cut layout's, so it
 * is pushed in (`setDuration`) rather than owned: when a clip is deleted at 4x the state
 * is re-clamped against the new duration in the same call, so no consumer ever sees a
 * scroll past the end. The pure maths is `components/timeline-view.ts`; this file only
 * decides WHEN to apply it, and whether the user has taken the view out of the
 * playhead's hands.
 */
import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import {
  ZOOM_STEP,
  clampView,
  followPlayhead,
  maxZoom,
  revealTime,
  zoomAt,
  type TimelineView,
} from "./components/timeline-view";

export interface TimelineViewState {
  zoom: number;
  scroll: number;
  laneWidth: number;
}

export interface TimelineViewStore {
  /** A stable snapshot: the same object until the zoom, scroll or lane width changes. */
  getState(): TimelineViewState;
  /** The state against the live duration, clamped — what event handlers should read. */
  getView(): TimelineView;
  /** The deepest zoom this lane and duration allow (1 when it cannot zoom at all). */
  getMaxZoom(): number;
  subscribe(listener: () => void): () => void;
  setDuration(duration: number): void;
  setLaneWidth(px: number): void;
  /** FIT: 1x, scroll 0. */
  fit(): void;
  /** `+` / `−`: one {@link ZOOM_STEP} around the centre of the visible window. */
  zoomStep(direction: 1 | -1): void;
  /** The slider: an absolute zoom, around the centre. */
  zoomTo(zoom: number): void;
  /** ⌘/Ctrl + wheel and pinch: around the pointer. */
  zoomAtPointer(factor: number, clientX: number, laneLeft: number): void;
  /**
   * Set the scroll. `"user"` is a pan by hand (the scrollbar, a trackpad swipe) and takes
   * the view out of the playhead's hands until the next play; `"follow"` is the strip
   * reporting a scroll the store itself caused, which must not count as taking over.
   */
  scrollTo(px: number, by: "user" | "follow"): void;
  /** While PLAYING: turn the page when the playhead passes 80% of the lane. */
  follow(t: number): void;
  /** While paused: scroll only if `t` is off screen (a seek by keyboard or button). */
  reveal(t: number): void;
  /** Play was pressed: the playhead leads again. */
  resumeFollow(): void;
}

export function createTimelineViewStore(): TimelineViewStore {
  let state: TimelineViewState = { zoom: 1, scroll: 0, laneWidth: 0 };
  let duration = 0;
  // False once the user pans or zooms by hand: playback then leaves the view alone.
  let following = true;
  const listeners = new Set<() => void>();

  const view = (): TimelineView => clampView({ ...state, duration });

  const notify = (): void => {
    for (const listener of [...listeners]) listener();
  };

  const commit = (next: TimelineView): boolean => {
    if (
      next.zoom === state.zoom &&
      next.scroll === state.scroll &&
      next.laneWidth === state.laneWidth
    ) {
      return false;
    }
    state = { zoom: next.zoom, scroll: next.scroll, laneWidth: next.laneWidth };
    notify();
    return true;
  };

  const limit = (): number => maxZoom(state.laneWidth, duration);

  const centred = (factor: number): void => {
    const current = view();
    commit(zoomAt(current, factor, current.laneWidth / 2, 0));
    following = false;
  };

  return {
    getState: () => state,
    getView: view,
    getMaxZoom: limit,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setDuration(next) {
      const before = limit();
      duration = next;
      // A cut can lower the deepest zoom without touching the state (it was far from it):
      // the zoom control still has to redraw its slider.
      if (!commit(view()) && limit() !== before) notify();
    },
    setLaneWidth(px) {
      commit(clampView({ ...view(), laneWidth: px }));
    },
    fit() {
      commit({ ...view(), zoom: 1, scroll: 0 });
    },
    zoomStep(direction) {
      centred(direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
    },
    zoomTo(zoom) {
      centred(zoom / view().zoom);
    },
    zoomAtPointer(factor, clientX, laneLeft) {
      commit(zoomAt(view(), factor, clientX, laneLeft));
      following = false;
    },
    scrollTo(px, by) {
      if (by === "user") following = false;
      commit(clampView({ ...view(), scroll: px }));
    },
    follow(t) {
      if (!following) return;
      commit(followPlayhead(view(), t));
    },
    reveal(t) {
      commit(revealTime(view(), t));
    },
    resumeFollow() {
      following = true;
    },
  };
}

/** One store per editor page, kept in step with the cut layout's duration. */
export function useTimelineViewStore(duration: number): TimelineViewStore {
  const [store] = useState(createTimelineViewStore);
  useLayoutEffect(() => {
    store.setDuration(duration);
  }, [store, duration]);
  return store;
}

/** The whole state: re-renders on every scroll. For the strip, which draws what is in view. */
export function useTimelineViewState(store: TimelineViewStore): TimelineViewState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

/** The zoom factor only: re-renders on a zoom, never on a scroll. For the transport bar. */
export function useTimelineZoom(store: TimelineViewStore): number {
  const zoom = (): number => store.getState().zoom;
  return useSyncExternalStore(store.subscribe, zoom, zoom);
}

/** The deepest zoom allowed: re-renders when a cut or a resize moves it, not on a scroll. */
export function useTimelineMaxZoom(store: TimelineViewStore): number {
  const limit = (): number => store.getMaxZoom();
  return useSyncExternalStore(store.subscribe, limit, limit);
}
