import { describe, expect, it } from "vitest";
import type { ExportJobInfo } from "@renderer/features/video-editor/export/export-runner";
import { runningCopyOf } from "./running-copy";

describe("runningCopyOf", () => {
  const job: ExportJobInfo = {
    presetId: "light",
    sourceTitle: "Take",
    sourceAssetId: "master",
    sourceSizeBytes: 119_000_000,
    estimateBytes: 9_000_000,
    width: 1280,
    height: 720,
    wholeRecording: true,
  };

  it("is the runner's export while it makes a copy of this recording", () => {
    expect(
      runningCopyOf({ status: "exporting", job, fraction: 0.5, attemptStartedAt: 10 }, "master"),
    ).toEqual({ presetId: "light", wholeRecording: true, fraction: 0.5, attemptStartedAt: 10 });
  });

  it("is null for another recording's export, or once it is not encoding", () => {
    const base = { job, fraction: 0.5, attemptStartedAt: 10 };
    expect(runningCopyOf({ ...base, status: "exporting" }, "other")).toBeNull();
    expect(runningCopyOf({ ...base, status: "error" }, "master")).toBeNull();
    expect(runningCopyOf({ ...base, status: "idle", job: null }, "master")).toBeNull();
  });

  it("an editor export (or a job without the flag) is not a destination copy", () => {
    const { wholeRecording: _omit, ...older } = job;
    expect(
      runningCopyOf(
        { status: "exporting", job: older, fraction: 0, attemptStartedAt: null },
        "master",
      )?.wholeRecording,
    ).toBe(false);
  });
});
