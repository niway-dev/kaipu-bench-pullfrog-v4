import { catalog, type Step } from "../../types";
import { nc } from "../not-capturable";

/**
 * The overlay's own start. Its countdown runs on the widget (ADR 0056), so the shade shows no
 * countdown here, only the border once the take starts.
 */
const fromOverlay = (mode: string): Step[] => [
  { call: "requestRecordSelector", args: [mode], on: "main" },
  { waitFor: { window: "capture-overlay" } },
  { waitMs: 500 },
  { press: "Enter", on: "capture-overlay" },
];

/**
 * The full-display shade (`?window=recording-shade`): the countdown before a take and the
 * border around what is being recorded. Prewarmed hidden; only a real take shows it.
 */
export const recordingShade = catalog(
  "recordingShade",
  {
    "border-display": {
      profile: "recording",
      how: "Start a take of the first display: the shade draws its border.",
      steps: [
        { action: "selectFirstScreen" },
        { action: "startTake" },
        { waitFor: { area: "recordingShade.displayBorder" } },
      ],
      demonstrates: ["recordingShade.displayBorder:fullDisplay"],
      after: [{ action: "stopTake" }],
    },
    "border-area": {
      profile: "recording",
      how: "Open the overlay to record in Frame mode and press Enter: the shade borders that area.",
      steps: [
        ...fromOverlay("frame"),
        { waitFor: { area: "recordingShade.areaBorder" }, timeoutMs: 15_000 },
      ],
      demonstrates: ["recordingShade.areaBorder:area"],
      after: [{ action: "stopTake" }],
    },

    "countdown-display": {
      profile: "recording",
      how: "Ask for a take of the first display without the overlay (as the instant shortcut and the tray do): the shade counts down over the whole display.",
      steps: [
        { action: "selectFirstScreen" },
        { action: "requestTake" },
        { waitFor: { area: "recordingShade.countdown" }, timeoutMs: 10_000 },
      ],
      demonstrates: ["recordingShade.countdown:fullDisplay"],
      gates: [{ setting: "recordingCountdownSeconds", side: "3" }],
      after: [{ action: "stopTake" }],
    },
  },
  {
    notCapturable: {
      "recordingShade.countdown:area": nc(
        "needsSetup",
        "the shade counts down over a region only for a stored area or the instant shortcut, and both need a real display id that no catalog step can write; the overlay's own countdown now runs on the widget (ADR 0056)",
      ),
    },
    oneSided: {
      "recordingShade.countdown": "with `recordingCountdownSeconds` 0 there is no countdown",
    },
  },
);
