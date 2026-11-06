/**
 * Render-count guard (NIW2-662): dragging an inspector slider must not re-render the
 * timeline lanes that do not depend on the value being dragged.
 *
 * Each lane module is mocked with a plain (non-memo) counting wrapper, so a count means
 * "the parent re-rendered this lane" — which is exactly what React.memo on the real lane
 * has to prevent. The recording is SYNTHETIC: a one-hour cursor track and ~100 saved zooms,
 * big enough that a wasted lane render is measurable.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serializeCursorTrack, type CursorClick, type CursorTrack } from "@shared/cursor-track";
import { setHeaderActionsElement } from "@renderer/features/workspaces/header-slot";
import { VideoEditorLoader, type VideoEditorSource } from "./video-editor-page";

const renders = vi.hoisted(() => ({}) as Record<string, number>);
function count(name: string): void {
  renders[name] = (renders[name] ?? 0) + 1;
}

vi.mock("@renderer/features/video-editor/export/use-video-export", () => ({
  useVideoExport: () => ({
    status: "idle",
    fraction: 0,
    error: null,
    start: vi.fn(),
    cancel: vi.fn(),
  }),
}));
vi.mock("@renderer/features/video-editor/use-source-thumbnails", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@renderer/features/video-editor/use-source-thumbnails")
  >()),
  useSourceThumbnails: () => [],
  useCompanionThumbnails: () => ({ thumbnails: [], covered: null }),
}));

vi.mock("@renderer/features/video-editor/components/activity-lane", async (importOriginal) => {
  const mod =
    await importOriginal<
      typeof import("@renderer/features/video-editor/components/activity-lane")
    >();
  const Orig = mod.ActivityLane;
  return {
    ...mod,
    ActivityLane: (props: React.ComponentProps<typeof Orig>) => {
      count("activity");
      return <Orig {...props} />;
    },
  };
});
vi.mock("@renderer/features/video-editor/components/zoom-lane", async (importOriginal) => {
  const mod =
    await importOriginal<typeof import("@renderer/features/video-editor/components/zoom-lane")>();
  const Orig = mod.ZoomLane;
  return {
    ...mod,
    ZoomLane: (props: React.ComponentProps<typeof Orig>) => {
      count("zoom");
      return <Orig {...props} />;
    },
  };
});
vi.mock("@renderer/features/video-editor/components/audio-lane", async (importOriginal) => {
  const mod =
    await importOriginal<typeof import("@renderer/features/video-editor/components/audio-lane")>();
  const Orig = mod.AudioLane;
  return {
    ...mod,
    AudioLane: (props: React.ComponentProps<typeof Orig>) => {
      count("audio");
      return <Orig {...props} />;
    },
  };
});
vi.mock("@renderer/features/video-editor/components/privacy-lane", async (importOriginal) => {
  const mod =
    await importOriginal<
      typeof import("@renderer/features/video-editor/components/privacy-lane")
    >();
  const Orig = mod.PrivacyLane;
  return {
    ...mod,
    PrivacyLane: (props: React.ComponentProps<typeof Orig>) => {
      count("privacy");
      return <Orig {...props} />;
    },
  };
});
vi.mock("@renderer/features/video-editor/components/timeline-strip", async (importOriginal) => {
  const mod =
    await importOriginal<
      typeof import("@renderer/features/video-editor/components/timeline-strip")
    >();
  const Orig = mod.TimelineStrip;
  return {
    ...mod,
    TimelineStrip: (props: React.ComponentProps<typeof Orig>) => {
      count("strip");
      return <Orig {...props} />;
    },
  };
});

const DURATION = 3600;
const SOURCE: VideoEditorSource = {
  id: "rec-big",
  assetId: "asset-big",
  title: "One hour",
  durationSeconds: DURATION,
};

/** SYNTHETIC one-hour track: 20 samples/s; every 2 s the pointer rests 1 s, then glides to the
 *  next spot (so each cycle yields a dwell), with one click per cycle. */
function buildTrack(): CursorTrack {
  const cycles = DURATION / 2;
  const spot = (k: number): { x: number; y: number } => ({
    x: 0.1 + 0.8 * ((k * 0.618033) % 1),
    y: 0.1 + 0.8 * ((k * 0.414213) % 1),
  });
  const t: number[] = [];
  const x: number[] = [];
  const y: number[] = [];
  const clicks: CursorClick[] = [];
  for (let k = 0; k < cycles; k++) {
    const a = spot(k);
    const b = spot(k + 1);
    for (let s = 0; s < 40; s++) {
      t.push(k * 2000 + s * 50);
      const f = s < 20 ? 0 : (s - 19) / 20;
      x.push(a.x + (b.x - a.x) * f);
      y.push(a.y + (b.y - a.y) * f);
    }
    clicks.push({ t: k * 2000 + 500, x: a.x, y: a.y, button: 0 });
  }
  return {
    version: 1,
    display: { id: "1", width: 1920, height: 1080, scaleFactor: 1 },
    anchor: "exact",
    clicksAvailable: true,
    t,
    x,
    y,
    clicks,
  };
}

/** SYNTHETIC saved session: 100 non-overlapping manual zooms, 5 s long every 30 s. */
function buildSession(): string {
  return JSON.stringify({
    version: 1,
    scene: {
      items: [{ id: "clip-a", kind: "clip", sourceStart: 0, sourceEnd: DURATION }],
      overlays: [],
      zoomSegments: Array.from({ length: 100 }, (_, i) => ({
        id: `zoom-${i + 1}`,
        start: 10 + i * 30,
        end: 15 + i * 30,
        scale: 2,
        mode: "fixed",
        anchor: { x: 0.5, y: 0.5 },
        smoothing: 50,
        origin: "manual",
        trigger: null,
      })),
      redactions: [],
      zoomSensitivity: 50,
      audioMuted: false,
      mutedRanges: [],
    },
  });
}

let headerActions: HTMLElement;
const originalLoadSession = window.electronAPI.loadVideoEditSession;
const originalLoadTrack = window.electronAPI.loadCursorTrack;
beforeEach(() => {
  window.electronAPI.acquireEditorSession = async () => SOURCE.id;
  const track = serializeCursorTrack(buildTrack());
  const session = buildSession();
  window.electronAPI.loadCursorTrack = async () => track;
  window.electronAPI.loadVideoEditSession = vi.fn(async () => ({
    sessionJson: session,
    assets: [],
  }));
  headerActions = document.createElement("div");
  document.body.appendChild(headerActions);
  setHeaderActionsElement(headerActions);
});
afterEach(() => {
  cleanup();
  setHeaderActionsElement(null);
  headerActions.remove();
  window.electronAPI.loadVideoEditSession = originalLoadSession;
  window.electronAPI.loadCursorTrack = originalLoadTrack;
});

describe("VideoEditorPage — render counts during a slider drag", () => {
  it("a Level drag re-renders only what depends on the zoom", async () => {
    const router = createMemoryRouter(
      [{ path: "/", element: <VideoEditorLoader source={SOURCE} /> }],
      { initialEntries: ["/"] },
    );
    render(<RouterProvider router={router} />);
    await waitFor(() => expect(document.querySelector("footer")).not.toBeNull(), {
      timeout: 20_000,
    });
    const footer = document.querySelector("footer")!;
    await waitFor(() => {
      expect(footer.querySelectorAll('[data-testid="activity-lane"] span').length).toBeGreaterThan(
        1000,
      );
    });
    expect(footer.querySelectorAll("[data-zoom-id]").length).toBeGreaterThanOrEqual(90);

    fireEvent.click(footer.querySelector<HTMLButtonElement>('button[aria-label="Zoom 1"]')!);
    await screen.findByRole("heading", { name: "Zoom 1" });
    const slider = screen.getByRole("slider", { name: "Level" });

    for (const key of Object.keys(renders)) renders[key] = 0;
    const moves = 60;
    const start = performance.now();
    fireEvent.pointerDown(slider);
    for (let i = 0; i < moves; i++) {
      const value = (1 + (3 * (i + 1)) / moves).toFixed(2);
      fireEvent.change(slider, { target: { value } });
    }
    fireEvent.pointerUp(slider);
    const ms = performance.now() - start;
    console.info(
      `[render-count] activity=${renders["activity"] ?? 0} zoom=${renders["zoom"] ?? 0} ` +
        `audio=${renders["audio"] ?? 0} privacy=${renders["privacy"] ?? 0} ` +
        `strip=${renders["strip"] ?? 0} moves=${moves} ms=${ms.toFixed(0)}`,
    );
  }, 120_000);
});
