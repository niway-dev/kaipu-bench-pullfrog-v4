import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { RecordingReadyPayload, RecordingReadyTimer } from "@shared/types/recording-ready";
import type { RecordingReadyCardBridge } from "@shared/types/electron-api";
import { RecordingReadyCard } from "./recording-ready-card";

const FRESH: RecordingReadyPayload = {
  assetId: "asset-1",
  durationSeconds: 78,
  dimensions: { width: 2560, height: 1440 },
  sizeBytes: 4_000_000,
  canEdit: true,
};

const CARD = { name: "Your video is ready" };

function renderCard(payload: RecordingReadyPayload | null) {
  let listener: ((payload: RecordingReadyPayload) => void) | null = null;
  let timerListener: ((timer: RecordingReadyTimer) => void) | null = null;
  const api = {
    onShow: vi.fn((callback: (payload: RecordingReadyPayload) => void) => {
      listener = callback;
      return () => (listener = null);
    }),
    ready: vi.fn(),
    action: vi.fn(),
    resize: vi.fn(),
    hover: vi.fn(),
    onTimer: vi.fn((callback: (timer: RecordingReadyTimer) => void) => {
      timerListener = callback;
      return () => (timerListener = null);
    }),
  } satisfies RecordingReadyCardBridge;
  const show = (next: RecordingReadyPayload): void => act(() => listener?.(next));
  const timer = (next: RecordingReadyTimer): void => act(() => timerListener?.(next));
  const utils = render(<RecordingReadyCard api={api} />);
  if (payload) show(payload);
  return { api, show, timer, ...utils };
}

describe("RecordingReadyCard", () => {
  afterEach(cleanup);

  it("subscribes before telling main it is ready, and renders nothing until a payload lands", () => {
    const { api, container } = renderCard(null);
    expect(api.onShow.mock.invocationCallOrder[0]).toBeLessThan(
      api.ready.mock.invocationCallOrder[0]!,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the same card as the app: title, master tag, numbers, question, chips, footer", () => {
    renderCard(FRESH);
    const card = screen.getByRole("region", CARD);
    expect(within(card).getByText("Master · full quality")).toBeVisible();
    expect(within(card).getByText("1:18 · 2560 × 1440 · 4.0 MB")).toBeVisible();
    expect(within(card).getByText(/Where do you want to send it\?/)).toBeVisible();
    for (const name of ["YouTube", "TikTok", "GitHub"]) {
      expect(
        within(card).getByRole("button", { name: `Prepare a copy for ${name}` }),
      ).toBeVisible();
    }
    expect(within(card).getByRole("button", { name: "More places" })).toBeVisible();
    expect(within(card).getByRole("button", { name: "Edit first" })).toBeVisible();
    expect(within(card).getByRole("button", { name: "Open" })).toBeVisible();
    expect(within(card).getByText(/Saved at full quality/)).toBeVisible();
  });

  it("reports every press to main as a typed action", () => {
    const { api } = renderCard(FRESH);
    fireEvent.click(screen.getByRole("button", { name: "Prepare a copy for TikTok" }));
    fireEvent.click(screen.getByRole("button", { name: "More places" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit first" }));
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(api.action.mock.calls.map(([action]) => action)).toEqual([
      { kind: "pick", destination: "vertical" },
      { kind: "pick", destination: null },
      { kind: "edit" },
      { kind: "open" },
      { kind: "dismiss" },
    ]);
  });

  it("Escape closes it", () => {
    const { api } = renderCard(FRESH);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(api.action).toHaveBeenCalledWith({ kind: "dismiss" });
  });

  it("has no Edit first for a recording the editor cannot open, nor dimensions it could not read", () => {
    renderCard({ ...FRESH, canEdit: false, dimensions: null });
    expect(screen.queryByRole("button", { name: "Edit first" })).toBeNull();
    expect(screen.getByText("1:18 · 4.0 MB")).toBeVisible();
  });

  it("a new payload replaces the card", () => {
    const { show } = renderCard(FRESH);
    show({ ...FRESH, assetId: "asset-2", durationSeconds: 5, sizeBytes: 1_000_000 });
    expect(screen.getAllByRole("region", CARD)).toHaveLength(1);
    expect(screen.getByText("0:05 · 2560 × 1440 · 1.0 MB")).toBeVisible();
  });

  it("tells main when the pointer enters and leaves, so main holds the auto-hide", () => {
    const { api } = renderCard(FRESH);
    const card = screen.getByRole("region", CARD);
    fireEvent.mouseEnter(card);
    expect(api.hover).toHaveBeenLastCalledWith(true);
    fireEvent.mouseLeave(card);
    expect(api.hover).toHaveBeenLastCalledWith(false);
  });

  it("drains its bar over main's time, restarting on each run and freezing when held", () => {
    const { container, timer } = renderCard(FRESH);
    const fill = (): HTMLElement => container.querySelector("[data-run]") as HTMLElement;
    expect(fill().dataset["run"]).toBe("false");
    timer({ remainingMs: 10_000 });
    const first = fill();
    expect(first.dataset["run"]).toBe("true");
    expect(first.dataset["running"]).toBe("true");
    expect(first.style.animationDuration).toBe("10000ms");
    timer({ remainingMs: null });
    expect(fill()).toBe(first);
    expect(fill().dataset["running"]).toBe("false");
    timer({ remainingMs: 10_000 });
    // A new run is a new element, so the animation starts over from full.
    expect(fill()).not.toBe(first);
    expect(fill().dataset["running"]).toBe("true");
  });
});
