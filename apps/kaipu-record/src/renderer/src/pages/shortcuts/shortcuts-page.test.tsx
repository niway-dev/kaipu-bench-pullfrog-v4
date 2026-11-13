import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CAPTURE_MODES } from "@shared/types/screenshot-capture";
import { ShortcutsPage } from "./shortcuts-page";

const REMOVED = [
  "Capture screen",
  "Capture frame",
  "Record an area",
  "Mute / unmute microphone",
  "System audio on / off",
  "Show / hide camera",
  "Stop recording",
];

describe("ShortcutsPage", () => {
  it("lists only the four shortcuts with the flag as shipped (Window off)", async () => {
    render(<ShortcutsPage />);
    expect(await screen.findByText("Open capture")).toBeInTheDocument();
    expect(screen.getByText("Start capturing")).toBeInTheDocument();
    expect(
      screen.getByText("Open the capture selector; press again to stop or close"),
    ).toBeInTheDocument();
    expect(screen.getByText("Bring Kaipu to front")).toBeInTheDocument();
    expect(screen.getByText("Instant capture")).toBeInTheDocument();
    expect(screen.queryByText("Capture window")).not.toBeInTheDocument();
    for (const label of REMOVED) expect(screen.queryByText(label)).not.toBeInTheDocument();
  });

  it("adds Capture window when Window is enabled, and still none of the removed ones", async () => {
    render(<ShortcutsPage enabledModes={CAPTURE_MODES} />);
    expect(await screen.findByText("Capture window")).toBeInTheDocument();
    for (const label of REMOVED) expect(screen.queryByText(label)).not.toBeInTheDocument();
  });
});
