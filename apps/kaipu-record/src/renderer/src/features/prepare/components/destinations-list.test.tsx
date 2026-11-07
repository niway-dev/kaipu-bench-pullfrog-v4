import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DestinationsList } from "./destinations-list";

const probe = {
  width: 1920,
  height: 1080,
  durationSec: 182,
  fps: 30,
  hasAudio: true,
  sampleRate: 48000,
};

function renderList(props: Partial<React.ComponentProps<typeof DestinationsList>> = {}) {
  const onPick = vi.fn();
  const onOpenExport = vi.fn();
  render(
    <DestinationsList
      sizeBytes={100_000_000}
      probe={probe}
      onPick={onPick}
      onOpenExport={onOpenExport}
      {...props}
    />,
  );
  return { onPick, onOpenExport };
}

afterEach(cleanup);

describe("DestinationsList", () => {
  it("lists the groups and destinations in order with their copy", () => {
    renderList();
    const labels = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(labels).toEqual([
      "They re-compress it · send more",
      "They play it as-is · keep it light",
      "Keep",
    ]);
    const rows = screen.getAllByRole("button", { name: /^Export a copy for/ });
    expect(rows.map((r) => r.getAttribute("aria-label"))).toEqual([
      "Export a copy for YouTube",
      "Export a copy for Reels · TikTok · Shorts",
      "Export a copy for LinkedIn · Feeds",
      "Export a copy for GitHub · Jira · Linear",
      "Export a copy for Slack · Discord · Email",
      "Export a copy for Email · anywhere",
      "Export a copy for Archive copy",
    ]);
    expect(within(rows[0]!).getByText("16:9 · 1440p or 4K")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Where is it going?");
  });

  it("calls onPick with the destination id", () => {
    const { onPick } = renderList();
    fireEvent.click(screen.getByRole("button", { name: "Export a copy for YouTube" }));
    expect(onPick).toHaveBeenCalledWith("youtube");
  });

  it("shows an ellipsis until the source is probed, except for the archive", () => {
    renderList({ probe: null });
    const youtube = screen.getByRole("button", { name: "Export a copy for YouTube" });
    expect(within(youtube).getByText("…")).toBeTruthy();
    const archive = screen.getByRole("button", { name: "Export a copy for Archive copy" });
    expect(within(archive).getByText("100 MB")).toBeTruthy();
  });

  it("shows an estimate once the source is known", () => {
    renderList();
    const youtube = screen.getByRole("button", { name: "Export a copy for YouTube" });
    expect(within(youtube).queryByText("…")).toBeNull();
  });

  it("opens Export", () => {
    const { onOpenExport } = renderList({ note: <p>heavy</p> });
    expect(screen.getByText("heavy")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open Export" }));
    expect(onOpenExport).toHaveBeenCalledTimes(1);
  });
});
