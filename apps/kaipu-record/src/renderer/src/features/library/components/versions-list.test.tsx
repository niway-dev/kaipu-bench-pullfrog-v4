import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import type { LibraryVideo } from "@renderer/features/library/types";
import { buildLineage } from "@renderer/features/library/lineage";
import type { RunningCopy } from "@renderer/features/prepare/components/master-copies-panel";
import { VersionsList } from "./versions-list";

const video = (overrides: Partial<LibraryVideo>): LibraryVideo => ({
  id: "x",
  assetId: "x",
  kind: "recording",
  title: "Take",
  createdAt: Date.now() - 3_600_000,
  durationSeconds: 182,
  fileSizeBytes: 22_000_000,
  cloudSizeBytes: null,
  availability: "local",
  comparison: "same",
  editing: "exported-only",
  transfer: { state: "idle" },
  derivedFromAssetId: null,
  editSavedAt: null,
  editExportedSavedAt: null,
  ...overrides,
});

const master = video({ id: "master", assetId: "master", title: "My master" });
const yt = video({
  id: "yt",
  assetId: "yt",
  title: "yt file",
  derivedFromAssetId: "master",
  export: { preset: "youtube-1440", fingerprint: "whole" },
});
const gh = video({
  id: "gh",
  assetId: "gh",
  title: "gh file",
  derivedFromAssetId: "master",
  export: { preset: "light", fingerprint: "whole" },
});

const probe = {
  width: 1920,
  height: 1080,
  durationSec: 182,
  fps: 30,
  hasAudio: true,
  sampleRate: 48000,
};

function renderList(item: LibraryVideo, all: LibraryVideo[], running: RunningCopy | null = null) {
  render(
    <MemoryRouter>
      <VersionsList
        item={item}
        lineage={buildLineage(all)}
        running={running}
        probe={probe}
        now={() => 100_000}
      />
    </MemoryRouter>,
  );
  return screen.getByRole("region", { name: "Versions" });
}

afterEach(cleanup);

describe("VersionsList", () => {
  it("lists the master and its copies, with Viewing on the master", () => {
    const region = renderList(master, [master, yt, gh]);
    const rows = within(region).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText("Viewing")).toBeTruthy();
    expect(within(rows[0]!).getByText("Original")).toBeTruthy();
    expect(within(rows[0]!).getByRole("img", { name: "Never changes" })).toBeTruthy();
    expect(within(rows[1]!).getByText("YouTube 1440p")).toBeTruthy();
    expect(within(rows[1]!).getByRole("link").getAttribute("href")).toBe("/library/yt");
    expect(within(region).getAllByText("Exported copy")).toHaveLength(2);
    expect(within(region).getByText("3")).toBeTruthy();
  });

  it("shows the edited project row when the original has an edit session", () => {
    const edited = { ...master, editSavedAt: Date.now() - 60_000 };
    const region = renderList(edited, [edited, yt]);
    expect(within(region).getByText("Edited project")).toBeTruthy();
  });

  it("on a copy, shows the source as a link and Viewing on the copy", () => {
    const region = renderList(yt, [master, yt, gh]);
    const source = within(region).getByRole("link", { name: /My master/ });
    expect(source.getAttribute("href")).toBe("/library/master");
    const viewing = within(region).getByText("Viewing").closest("li")!;
    expect(within(viewing).getByText("YouTube 1440p")).toBeTruthy();
    expect(within(region).queryByRole("link", { name: /YouTube/ })).toBeNull();
  });

  it("shows the running copy with its progress", () => {
    const region = renderList(master, [master], {
      presetId: "light",
      wholeRecording: true,
      fraction: 0.4,
      attemptStartedAt: null,
    });
    expect(within(region).getByText("GitHub · Jira · Linear")).toBeTruthy();
    expect(within(region).getByText("Exporting · 40%")).toBeTruthy();
    expect(within(region).queryByText(/Pick a place/)).toBeNull();
  });

  it("says the source was deleted when a copy lost it", () => {
    const region = renderList(yt, [yt]);
    expect(within(region).getByText("Source recording was deleted")).toBeTruthy();
    expect(within(region).getByText("Viewing")).toBeTruthy();
  });

  it("suggests where it is going when there are no copies", () => {
    const region = renderList(master, [master]);
    expect(within(region).getByText(/Pick a place/)).toBeTruthy();
  });
});
