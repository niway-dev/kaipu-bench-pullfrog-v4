import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HistorySlider } from "./history-slider";

/** requestAnimationFrame under our control, so "one live update per frame" is observable. */
function manualFrames() {
  const queue: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => queue.push(cb));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  return {
    pending: () => queue.length,
    flush: () => {
      for (const cb of queue.splice(0)) cb(0);
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

function setup() {
  const handlers = { onBegin: vi.fn(), onLive: vi.fn(), onEnd: vi.fn(), onCommit: vi.fn() };
  render(
    <HistorySlider
      label="Level"
      value={2}
      min={1}
      max={4}
      step={0.1}
      format={(v) => `${v}×`}
      {...handlers}
    />,
  );
  return { handlers, input: screen.getByRole("slider") };
}

describe("HistorySlider", () => {
  it("a pointer gesture is begin → live → end", () => {
    const { handlers, input } = setup();
    fireEvent.pointerDown(input, { pointerId: 1 });
    fireEvent.change(input, { target: { value: "2.5" } });
    fireEvent.pointerUp(input, { pointerId: 1 });
    expect(handlers.onBegin).toHaveBeenCalledTimes(1);
    expect(handlers.onLive).toHaveBeenCalledWith(2.5);
    expect(handlers.onEnd).toHaveBeenCalledTimes(1);
    expect(handlers.onCommit).not.toHaveBeenCalled();
  });

  it("coalesces moves into one live update per frame, carrying the last value", () => {
    const frames = manualFrames();
    const { handlers, input } = setup();
    fireEvent.pointerDown(input, { pointerId: 1 });
    fireEvent.change(input, { target: { value: "2.2" } });
    fireEvent.change(input, { target: { value: "2.6" } });
    fireEvent.change(input, { target: { value: "3" } });
    expect(handlers.onLive).not.toHaveBeenCalled();
    expect(frames.pending()).toBe(1);
    // The input follows the pointer even though the scene has not heard about it yet.
    expect(input).toHaveValue("3");
    frames.flush();
    expect(handlers.onLive).toHaveBeenCalledTimes(1);
    expect(handlers.onLive).toHaveBeenCalledWith(3);
  });

  it("pointer up flushes the pending value before the gesture ends", () => {
    manualFrames();
    const order: string[] = [];
    const handlers = {
      onBegin: vi.fn(),
      onLive: vi.fn((v: number) => order.push(`live ${v}`)),
      onEnd: vi.fn(() => order.push("end")),
      onCommit: vi.fn(),
    };
    render(<HistorySlider label="Level" value={2} min={1} max={4} step={0.1} {...handlers} />);
    const input = screen.getByRole("slider");
    fireEvent.pointerDown(input, { pointerId: 1 });
    fireEvent.change(input, { target: { value: "2.8" } });
    fireEvent.pointerUp(input, { pointerId: 1 });
    expect(order).toEqual(["live 2.8", "end"]);
  });

  it("unmounting mid-drag flushes the pending value, then ends", () => {
    manualFrames();
    const order: string[] = [];
    const handlers = {
      onBegin: vi.fn(),
      onLive: vi.fn((v: number) => order.push(`live ${v}`)),
      onEnd: vi.fn(() => order.push("end")),
      onCommit: vi.fn(),
    };
    const { unmount } = render(
      <HistorySlider label="Level" value={2} min={1} max={4} step={0.1} {...handlers} />,
    );
    const input = screen.getByRole("slider");
    fireEvent.pointerDown(input, { pointerId: 1 });
    fireEvent.change(input, { target: { value: "3.1" } });
    unmount();
    expect(order).toEqual(["live 3.1", "end"]);
  });

  it("unmounting mid-drag ends the gesture, so the scene's drag is never left open", () => {
    const handlers = { onBegin: vi.fn(), onLive: vi.fn(), onEnd: vi.fn(), onCommit: vi.fn() };
    const { unmount } = render(
      <HistorySlider label="Level" value={2} min={1} max={4} step={0.1} {...handlers} />,
    );
    fireEvent.pointerDown(screen.getByRole("slider"), { pointerId: 1 });
    unmount();
    expect(handlers.onEnd).toHaveBeenCalledTimes(1);
  });

  it("unmounting without a drag does not end anything", () => {
    const { handlers } = setup();
    cleanup();
    expect(handlers.onEnd).not.toHaveBeenCalled();
  });

  it("a change without a pointer (keyboard) is a commit", () => {
    const { handlers, input } = setup();
    fireEvent.change(input, { target: { value: "2.1" } });
    expect(handlers.onCommit).toHaveBeenCalledWith(2.1);
    expect(handlers.onBegin).not.toHaveBeenCalled();
  });

  it("shows the formatted value", () => {
    setup();
    expect(screen.getByText("2×")).toBeInTheDocument();
  });

  it("exposes the formatted value as aria-valuetext", () => {
    const { input } = setup();
    expect(input).toHaveAttribute("aria-valuetext", "2×");
  });

  it("names the control with the label alone and describes it with the note", () => {
    render(
      <HistorySlider
        label="Smoothness"
        value={70}
        min={0}
        max={100}
        step={1}
        note="Higher means the camera eases in longer."
        onBegin={vi.fn()}
        onLive={vi.fn()}
        onEnd={vi.fn()}
        onCommit={vi.fn()}
      />,
    );
    // The accessible name must not absorb the live value — otherwise every arrow-key
    // step re-announces the control instead of just the new value.
    const input = screen.getByRole("slider", { name: "Smoothness" });
    const note = screen.getByText("Higher means the camera eases in longer.");
    expect(input.getAttribute("aria-describedby")).toBe(note.id);
    expect(note.tagName).toBe("P");
  });
});
