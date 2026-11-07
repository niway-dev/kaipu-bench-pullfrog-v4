import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import type { LibraryVideo } from "@renderer/features/library/types";
import { buildLineage } from "@renderer/features/library/lineage";
import type { RunningCopy } from "@renderer/features/prepare/running-copy";
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

function renderList(
  item: LibraryVideo,
  all: LibraryVideo[],
  running: RunningCopy | null = null,
  canExport = false,
) {
  render(
    <MemoryRouter>
      <VersionsList
        item={item}
        lineage={buildLineage(all)}
        running={running}
        probe={probe}
        canExport={canExport}
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
    expect(rows[1]!.textContent).toContain("Exported copy");
    expect(rows[2]!.textContent).toContain("Exported copy");
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

  it("shows each row's name and its kind with facts on one muted line", () => {
    const region = renderList(master, [master, yt]);
    const rows = within(region).getAllByRole("listitem");
    expect(within(rows[0]!).getByText("My master")).toBeTruthy();
    expect(rows[0]!.textContent).toMatch(/Original · .*3:02.* · /);
    expect(within(rows[0]!).getByText("Viewing")).toBeTruthy();
    expect(within(rows[1]!).getByText("YouTube 1440p")).toBeTruthy();
    expect(rows[1]!.textContent).toMatch(/Exported copy · .*3:02/);
  });

  it("suggests where it is going when a local recording has no copies", () => {
    const region = renderList(master, [master], null, true);
    expect(within(region).getByText(/Pick a place/)).toBeTruthy();
  });

  it("does not point to a tab the item lacks", () => {
    const region = renderList(master, [master], null, false);
    expect(within(region).queryByText(/Pick a place/)).toBeNull();
    expect(within(region).getByText("No copies yet.")).toBeTruthy();
  });

  it("walks a copy of a copy up to the root original, and shows the same family from any member", () => {
    const a = video({ id: "a", assetId: "a", title: "Root A", createdAt: 1000 });
    const b = video({
      id: "b",
      assetId: "b",
      title: "Copy B",
      derivedFromAssetId: "a",
      createdAt: 2000,
    });
    const c = video({
      id: "c",
      assetId: "c",
      title: "Copy C",
      derivedFromAssetId: "b",
      createdAt: 3000,
    });
    const all = [a, b, c];
    for (const opened of [c, b, a]) {
      const region = renderList(opened, all);
      const rows = within(region).getAllByRole("listitem");
      expect(rows).toHaveLength(3);
      expect(within(rows[0]!).getByText("Original")).toBeTruthy();
      expect(within(rows[0]!).getByText("Root A")).toBeTruthy();
      expect(rows[1]!.textContent).toContain("Copy B");
      expect(rows[2]!.textContent).toContain("Copy C");
      cleanup();
    }
  });

  it("does not loop on a cyclic lineage", () => {
    const x = video({ id: "x", assetId: "x", title: "X", derivedFromAssetId: "y" });
    const y = video({ id: "y", assetId: "y", title: "Y", derivedFromAssetId: "x" });
    const region = renderList(x, [x, y]);
    expect(within(region).getAllByRole("listitem").length).toBeGreaterThan(0);
  });
});
