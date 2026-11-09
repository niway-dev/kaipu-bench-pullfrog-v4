import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { CursorTrack } from "@shared/cursor-track";
import { withInitialZooms } from "../initial-zooms";
import { initialScene } from "../scene";
import { toLayout } from "../timeline";
import { useVideoScene } from "../use-video-scene";
import { useZoomEditing } from "./use-zoom-editing";

const TRACK: CursorTrack = {
  version: 1,
  display: { id: "1", width: 1600, height: 1000, scaleFactor: 2 },
  anchor: "exact",
  clicksAvailable: true,
  t: [0, 20_000],
  x: [0.5, 0.5],
  y: [0.5, 0.5],
  clicks: [{ t: 10_000, x: 0.5, y: 0.5, button: 0 }],
};

function setup(track: CursorTrack | null = TRACK, initial = initialScene(20)) {
  return renderHook(() => {
    const controller = useVideoScene(initial);
    const layout = toLayout(controller.scene.items);
    const zooms = useZoomEditing({
      controller,
      layout,
      timelineDuration: 20,
      sourceDuration: 20,
      cursorTrack: track,
    });
    return { controller, zooms };
  });
}

describe("useZoomEditing", () => {
  it("adds a manual zoom at the playhead as one undo step", () => {
    const { result } = setup();
    let added: ReturnType<typeof result.current.zooms.addAtPlayhead> | undefined;
    act(() => {
      added = result.current.zooms.addAtPlayhead(4);
    });
    expect(added).toMatchObject({ ok: true });
    expect(result.current.controller.scene.zoomSegments[0]).toMatchObject({ start: 4, end: 7 });
    act(() => result.current.controller.undo());
    expect(result.current.controller.scene.zoomSegments).toEqual([]);
  });

  it("a sensitivity preview leaves the scene alone and the release is one undo step", () => {
    const { result } = setup();
    const before = result.current.controller.scene;
    let preview: ReturnType<typeof result.current.zooms.sensitivityPreview> | undefined;
    act(() => {
      preview = result.current.zooms.sensitivityPreview(70);
    });
    expect(preview?.count).toBe(1);
    expect(result.current.controller.scene).toBe(before);
    expect(result.current.controller.canUndo).toBe(false);
    act(() => result.current.zooms.sensitivityCommit(70));
    expect(result.current.controller.scene.zoomSensitivity).toBe(70);
    expect(result.current.controller.scene.zoomSegments).toHaveLength(1);
    act(() => result.current.controller.undo());
    expect(result.current.controller.scene.zoomSensitivity).toBe(55);
    expect(result.current.controller.canUndo).toBe(false);
  });

  it("edge drag ignores moves over slides (null) and clamps", () => {
    const { result } = setup();
    act(() => {
      result.current.zooms.addAtPlayhead(4);
    });
    const id = result.current.controller.scene.zoomSegments[0].id;
    act(() => result.current.zooms.edgeDrag(id, "end", 7, "start"));
    act(() => result.current.zooms.edgeDrag(id, "end", null, "move"));
    act(() => result.current.zooms.edgeDrag(id, "end", 4.2, "move"));
    act(() => result.current.zooms.edgeDrag(id, "end", null, "end"));
    expect(result.current.controller.scene.zoomSegments[0]).toMatchObject({ start: 4, end: 5 });
  });

  it("a release that lands back on the range the drag started from still applies, even when the render behind the last frame has not happened yet", () => {
    const queued: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => queued.push(cb));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    try {
      const { result } = setup();
      act(() => {
        result.current.zooms.addAtPlayhead(4);
      });
      const { id, end: startEnd } = result.current.controller.scene.zoomSegments[0];
      // Everything inside ONE act: no render runs between the frame's live update and the release.
      act(() => {
        result.current.zooms.edgeDrag(id, "end", null, "start");
        result.current.zooms.edgeDrag(id, "end", startEnd + 3, "move");
        queued.splice(0).forEach((cb) => cb(0)); // frame: applies the longer range
        result.current.zooms.edgeDrag(id, "end", startEnd, "move"); // back where it started
        result.current.zooms.edgeDrag(id, "end", null, "end");
      });
      expect(result.current.controller.scene.zoomSegments[0].end).toBe(startEnd);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("re-analysing an unchanged scene adds no history entry", () => {
    // Seeded exactly like the loader does (PR 5), so detection at the stored sensitivity
    // reproduces what is already there and applySensitivity returns the same reference.
    const { result } = setup(TRACK, withInitialZooms(initialScene(20), false, TRACK, 20));
    expect(result.current.controller.scene.zoomSegments).toHaveLength(1);
    const before = result.current.controller.scene;
    act(() => result.current.zooms.reanalyse());
    expect(result.current.controller.scene).toBe(before);
    expect(result.current.controller.canUndo).toBe(false);
    expect(result.current.controller.dirty).toBe(false);
  });

  it("cannot detect without a cursor track", () => {
    const { result } = setup(null);
    expect(result.current.zooms.canDetect).toBe(false);
    act(() => result.current.zooms.sensitivityCommit(90));
    expect(result.current.controller.scene.zoomSensitivity).toBe(55);
  });
});
