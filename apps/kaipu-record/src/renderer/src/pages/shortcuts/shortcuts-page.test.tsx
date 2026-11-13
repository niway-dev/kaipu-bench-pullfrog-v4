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
  it("lists the four shortcuts in one card, in order, with the flag as shipped (Window off)", async () => {
    render(<ShortcutsPage />);
    expect(await screen.findByText("Open capture widget · Screenshot")).toBeInTheDocument();
    expect(screen.getByText("Open capture widget · Recording")).toBeInTheDocument();
    expect(
      screen.getByText("Press again to close, cancel or stop the recording"),
    ).toBeInTheDocument();
    expect(screen.getByText("Bring Kaipu to front")).toBeInTheDocument();
    expect(screen.getByText("Instant capture")).toBeInTheDocument();
    expect(screen.queryByText("Capture window")).not.toBeInTheDocument();
    for (const label of REMOVED) expect(screen.queryByText(label)).not.toBeInTheDocument();

    const inOrder = [
      screen.getByText("Open capture widget · Screenshot"),
      screen.getByText("Open capture widget · Recording"),
      screen.getByText("Instant capture"),
      screen.getByText("Bring Kaipu to front"),
    ];
    for (let i = 0; i < inOrder.length - 1; i++) {
      expect(
        inOrder[i].compareDocumentPosition(inOrder[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(screen.queryByRole("heading", { name: "Recording" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "App" })).not.toBeInTheDocument();
  });

  it("adds Capture window when Window is enabled, and still none of the removed ones", async () => {
    render(<ShortcutsPage enabledModes={CAPTURE_MODES} />);
    expect(await screen.findByText("Capture window")).toBeInTheDocument();
    for (const label of REMOVED) expect(screen.queryByText(label)).not.toBeInTheDocument();
  });
});
