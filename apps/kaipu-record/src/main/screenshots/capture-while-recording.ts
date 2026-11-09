import { activeFlagOverrides } from "../flag-overrides";

/**
 * Whether a screenshot may be taken during a take (the `capture-while-recording` flag,
 * NIW2-688). macOS only: it relies on `setContentProtection` hiding the overlay from the
 * recording, which Windows does not give us yet.
 *
 * Main has no PostHog client, so the renderer reports the resolved flag (`screenshot:capture-while-
 * recording-flag`); a local `KAIPU_FLAG_OVERRIDES` pin wins over it (unpackaged builds only).
 */
let reported = false;

export function setReportedCaptureWhileRecording(value: boolean): void {
  reported = value;
}

export function resolveCaptureWhileRecording(input: {
  platform: NodeJS.Platform;
  override: boolean | undefined;
  reported: boolean;
}): boolean {
  return input.platform === "darwin" && (input.override ?? input.reported);
}

export function captureWhileRecordingEnabled(
  platform: NodeJS.Platform = process.platform,
): boolean {
  return resolveCaptureWhileRecording({
    platform,
    override: activeFlagOverrides()["capture-while-recording"],
    reported,
  });
}
