import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { contentWidth, maxZoom, scaleOf, timeAt, xOf, ZOOM_STEP } from "./components/timeline-view";
import {
  createTimelineViewStore,
  useTimelineMaxZoom,
  useTimelineViewState,
  useTimelineViewStore,
  useTimelineZoom,
} from "./use-timeline-view";

function makeStore(laneWidth = 1000, duration = 100) {
  const store = createTimelineViewStore();
  store.setDuration(duration);
  store.setLaneWidth(laneWidth);
  return store;
}

describe("the timeline view store", () => {
  it("starts at fit: zoom 1, scroll 0 (the editor opens showing the whole recording)", () => {
    const store = makeStore();
    expect(store.getState()).toEqual({ zoom: 1, scroll: 0, laneWidth: 1000 });
    expect(store.getView()).toEqual({ zoom: 1, scroll: 0, laneWidth: 1000, duration: 100 });
  });

  it("zoomStep steps by the square root of two around the centre of the visible window", () => {
    const store = makeStore();
    store.zoomStep(1);
    expect(store.getState().zoom).toBeCloseTo(ZOOM_STEP, 9);
    // The centre of a fit view is 50 s; it must still be the centre after the step.
    const view = store.getView();
    expect(timeAt(view, 500, 0)).toBeCloseTo(50, 6);
    store.zoomStep(-1);
    expect(store.getState().zoom).toBe(1);
    expect(store.getState().scroll).toBe(0);
  });

  it("two + steps double the zoom and keep the centre fixed when scrolled", () => {
    const store = makeStore();
    store.zoomTo(4);
    store.scrollTo(1000, "user");
    const centreBefore = timeAt(store.getView(), 500, 0);
    store.zoomStep(1);
    store.zoomStep(1);
    expect(store.getState().zoom).toBeCloseTo(8, 9);
    expect(timeAt(store.getView(), 500, 0)).toBeCloseTo(centreBefore, 6);
  });

  it("zoomTo sets an absolute zoom and clamps it to the maximum", () => {
    const store = makeStore();
    store.zoomTo(1e9);
    expect(store.getState().zoom).toBeCloseTo(maxZoom(1000, 100), 9);
    store.zoomTo(0.1);
    expect(store.getState().zoom).toBe(1);
  });

  it("zoomAtPointer keeps the time under the pointer on the same pixel", () => {
    const store = makeStore();
    const laneLeft = 120;
    const clientX = laneLeft + 300;
    const t = timeAt(store.getView(), clientX, laneLeft);
    store.zoomAtPointer(4, clientX, laneLeft);
    expect(store.getState().zoom).toBe(4);
    expect(timeAt(store.getView(), clientX, laneLeft)).toBeCloseTo(t, 6);
  });

  it("FIT returns to 1x and scroll 0", () => {
    const store = makeStore();
    store.zoomTo(6);
    store.scrollTo(2000, "user");
    store.fit();
    expect(store.getState()).toEqual({ zoom: 1, scroll: 0, laneWidth: 1000 });
  });

  it("clamps scroll to the content, so a scrollbar overshoot cannot leave the timeline empty", () => {
    const store = makeStore();
    store.zoomTo(4);
    store.scrollTo(99_999, "user");
    expect(store.getState().scroll).toBe(contentWidth(store.getView()) - 1000);
    store.scrollTo(-10, "user");
    expect(store.getState().scroll).toBe(0);
  });

  it("re-clamps scroll and zoom when the duration shrinks (deleting a clip while zoomed)", () => {
    const store = makeStore();
    store.zoomTo(20);
    store.scrollTo(15_000, "user");
    store.setDuration(10); // most of the timeline is gone
    const view = store.getView();
    expect(view.zoom).toBeLessThanOrEqual(maxZoom(1000, 10));
    expect(view.scroll).toBeLessThanOrEqual(Math.max(0, contentWidth(view) - 1000));
    expect(store.getState().zoom).toBe(view.zoom);
    expect(store.getState().scroll).toBe(view.scroll);
  });

  it("keeps the apparent zoom through a cut that still allows it", () => {
    const store = makeStore();
    store.zoomTo(4);
    store.setDuration(60);
    expect(store.getState().zoom).toBe(4);
  });

  it("re-clamps when the lane resizes", () => {
    const store = makeStore();
    store.zoomTo(4);
    store.scrollTo(3000, "user");
    store.setLaneWidth(2000);
    const view = store.getView();
    expect(view.scroll).toBeLessThanOrEqual(contentWidth(view) - 2000);
  });

  it("notifies subscribers once per change and never when nothing changed", () => {
    const store = makeStore();
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.zoomTo(2);
    expect(listener).toHaveBeenCalledTimes(1);
    store.zoomTo(2);
    store.setLaneWidth(1000);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    store.zoomTo(3);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("gives useSyncExternalStore a stable snapshot until something changes", () => {
    const store = makeStore();
    const before = store.getState();
    expect(store.getState()).toBe(before);
    store.zoomTo(2);
    expect(store.getState()).not.toBe(before);
  });
});

describe("following the playhead", () => {
  function zoomed() {
    const store = makeStore();
    store.zoomTo(4); // 40 px/s, the lane shows 25 s
    store.scrollTo(0, "follow"); // zoomTo centred the view; start from the left
    store.resumeFollow(); // a zoom by hand takes over; a play puts it back
    return store;
  }

  it("scrolls when the playing playhead passes 80% of the lane and keeps it visible", () => {
    const store = zoomed();
    expect(store.getState().scroll).toBe(0);
    store.follow(10); // x = 400: left of the mark
    expect(store.getState().scroll).toBe(0);
    store.follow(21); // x = 840: past the mark
    const view = store.getView();
    expect(view.scroll).toBeGreaterThan(0);
    expect(xOf(view, 21)).toBeGreaterThanOrEqual(0);
    expect(xOf(view, 21)).toBeLessThan(1000 * 0.8);
  });

  it("stops following once the user pans, until the next play", () => {
    const store = zoomed();
    store.scrollTo(100, "user"); // the user took over
    store.follow(60);
    expect(store.getState().scroll).toBe(100);
    store.resumeFollow(); // play pressed
    store.follow(60);
    expect(store.getState().scroll).toBeGreaterThan(100);
  });

  it("a scroll the follow itself made is not the user taking over", () => {
    const store = zoomed();
    store.follow(21);
    const after = store.getState().scroll;
    store.scrollTo(after, "follow"); // the strip echoing its own scroll event
    store.follow(45);
    expect(store.getState().scroll).toBeGreaterThan(after);
  });

  it("zooming by hand also takes over", () => {
    const store = zoomed();
    store.zoomStep(1);
    const scroll = store.getState().scroll;
    store.follow(90);
    expect(store.getState().scroll).toBe(scroll);
  });

  it("reveal scrolls to an off-screen time even after the user took over, but not a visible one", () => {
    const store = zoomed();
    store.scrollTo(100, "user");
    store.reveal(10); // visible (x = 300): no move
    expect(store.getState().scroll).toBe(100);
    store.reveal(90); // off screen
    expect(xOf(store.getView(), 90)).toBeGreaterThanOrEqual(0);
    expect(xOf(store.getView(), 90)).toBeLessThanOrEqual(1000);
  });

  it("does nothing at fit", () => {
    const store = makeStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.follow(99);
    store.reveal(99);
    expect(listener).not.toHaveBeenCalled();
    expect(scaleOf(store.getView())).toBe(10);
  });
});

describe("the hooks", () => {
  it("useTimelineViewStore gives one stable store and keeps its duration current", () => {
    const { result, rerender } = renderHook(({ d }) => useTimelineViewStore(d), {
      initialProps: { d: 100 },
    });
    const store = result.current;
    store.setLaneWidth(1000);
    expect(store.getView().duration).toBe(100);
    rerender({ d: 40 });
    expect(result.current).toBe(store);
    expect(store.getView().duration).toBe(40);
  });

  it("useTimelineZoom re-renders on a zoom change but not on a scroll", () => {
    const store = makeStore();
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useTimelineZoom(store);
    });
    expect(result.current).toBe(1);
    const baseline = renders;
    act(() => store.zoomTo(4));
    expect(result.current).toBe(4);
    const afterZoom = renders;
    expect(afterZoom).toBeGreaterThan(baseline);
    act(() => store.scrollTo(500, "user"));
    expect(renders).toBe(afterZoom);
  });

  it("useTimelineMaxZoom follows a cut even when the zoom itself did not move", () => {
    const store = makeStore();
    const { result } = renderHook(() => useTimelineMaxZoom(store));
    expect(result.current).toBeCloseTo(maxZoom(1000, 100), 9);
    act(() => store.setDuration(50)); // zoom 1 stays 1, but 50 s zooms half as deep
    expect(result.current).toBeCloseTo(maxZoom(1000, 50), 9);
  });

  it("useTimelineViewState re-renders on every state change", () => {
    const store = makeStore();
    const { result } = renderHook(() => useTimelineViewState(store));
    act(() => store.zoomTo(4));
    act(() => store.scrollTo(500, "user"));
    expect(result.current).toEqual({ zoom: 4, scroll: 500, laneWidth: 1000 });
  });
});
