import { describe, expect, it, vi } from "vitest";
import { routeCaptureRequest } from "./capture-request";

describe("routeCaptureRequest", () => {
  it("notifies and does not forward while a recording is active", () => {
    const notifyBusy = vi.fn();
    const forwardToRenderer = vi.fn();
    routeCaptureRequest({ isRecordingActive: () => true, notifyBusy, forwardToRenderer });
    expect(notifyBusy).toHaveBeenCalledTimes(1);
    expect(forwardToRenderer).not.toHaveBeenCalled();
  });

  it("forwards to the renderer when no recording is active", () => {
    const notifyBusy = vi.fn();
    const forwardToRenderer = vi.fn();
    routeCaptureRequest({ isRecordingActive: () => false, notifyBusy, forwardToRenderer });
    expect(forwardToRenderer).toHaveBeenCalledTimes(1);
    expect(notifyBusy).not.toHaveBeenCalled();
  });

  describe("capture-while-recording", () => {
    const run = (isRecordingActive: boolean, allowDuringTake: boolean | undefined) => {
      const notifyBusy = vi.fn();
      const forwardToRenderer = vi.fn();
      routeCaptureRequest({
        isRecordingActive: () => isRecordingActive,
        ...(allowDuringTake === undefined ? {} : { allowDuringTake: () => allowDuringTake }),
        notifyBusy,
        forwardToRenderer,
      });
      return { notifyBusy, forwardToRenderer };
    };

    it("forwards during a take when allowed", () => {
      const { notifyBusy, forwardToRenderer } = run(true, true);
      expect(forwardToRenderer).toHaveBeenCalledTimes(1);
      expect(notifyBusy).not.toHaveBeenCalled();
    });

    it("still refuses during a take when not allowed (flag off or not macOS)", () => {
      const { notifyBusy, forwardToRenderer } = run(true, false);
      expect(notifyBusy).toHaveBeenCalledTimes(1);
      expect(forwardToRenderer).not.toHaveBeenCalled();
    });

    it("refuses during a take when no allow probe is given", () => {
      const { notifyBusy, forwardToRenderer } = run(true, undefined);
      expect(notifyBusy).toHaveBeenCalledTimes(1);
      expect(forwardToRenderer).not.toHaveBeenCalled();
    });

    it("forwards when idle whatever the flag says", () => {
      for (const allowed of [true, false]) {
        const { notifyBusy, forwardToRenderer } = run(false, allowed);
        expect(forwardToRenderer).toHaveBeenCalledTimes(1);
        expect(notifyBusy).not.toHaveBeenCalled();
      }
    });
  });
});
