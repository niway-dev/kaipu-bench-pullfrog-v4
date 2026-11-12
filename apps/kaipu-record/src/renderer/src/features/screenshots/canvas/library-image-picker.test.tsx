import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalRecording } from "@shared/types/library-storage";
import { LibraryImagePicker } from "./library-image-picker";

const bytes = new Uint8Array([1, 2, 3]).buffer;
const shot = (patch: Partial<LocalRecording>): LocalRecording =>
  ({
    id: "lib-1",
    assetId: "asset-lib-1",
    kind: "screenshot",
    title: "Dashboard draft",
    filePath: "/vault/lib-1.png",
    createdAt: 1,
    sizeBytes: 1,
    durationSeconds: 0,
    thumbnailUrl: null,
    derivedFromAssetId: null,
    ...patch,
  }) as LocalRecording;

const ITEMS = [
  shot({ id: "a", assetId: "aa", title: "Alpha", createdAt: 1 }),
  shot({ id: "b", assetId: "bb", title: "Beta report", createdAt: 3 }),
  shot({ id: "c", assetId: "cc", title: "Gamma", createdAt: 2 }),
];

const onPick = vi.fn();
const onClose = vi.fn();
const readScreenshotBytes = vi.fn();

function mount() {
  render(
    <LibraryImagePicker excludeId={null} excludeAssetId={null} onPick={onPick} onClose={onClose} />,
  );
}

beforeEach(() => {
  onPick.mockReset();
  onClose.mockReset();
  readScreenshotBytes.mockReset();
  readScreenshotBytes.mockResolvedValue(bytes);
  window.electronAPI.listLocalRecordings = vi.fn(async () => ITEMS);
  window.electronAPI.readScreenshotBytes = readScreenshotBytes as never;
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 320, height: 200, close: vi.fn() })),
  );
});

const selectedTitle = () =>
  screen
    .getAllByRole("button")
    .find((el) => el.getAttribute("aria-current") === "true")
    ?.getAttribute("aria-label");

describe("LibraryImagePicker", () => {
  it("selects the newest card by default", async () => {
    mount();
    await screen.findByRole("button", { name: "Beta report" });
    expect(selectedTitle()).toBe("Beta report");
  });

  it("hovering a card selects it", async () => {
    mount();
    fireEvent.mouseEnter(await screen.findByRole("button", { name: "Alpha" }));
    expect(selectedTitle()).toBe("Alpha");
  });

  it("focuses the search field when it opens", async () => {
    mount();
    await waitFor(() => expect(screen.getByLabelText("Search captures")).toHaveFocus());
  });

  it("search filters by title and moves the selection to the first match", async () => {
    mount();
    await screen.findByRole("button", { name: "Alpha" });
    fireEvent.change(screen.getByLabelText("Search captures"), { target: { value: "  GAM " } });
    expect(screen.queryByRole("button", { name: "Alpha" })).toBeNull();
    expect(selectedTitle()).toBe("Gamma");
  });

  it("says so when nothing matches", async () => {
    mount();
    await screen.findByRole("button", { name: "Alpha" });
    fireEvent.change(screen.getByLabelText("Search captures"), { target: { value: "zzz" } });
    expect(screen.getByText(/No captures match/)).toHaveTextContent("zzz");
  });

  it("arrow keys move the selection", async () => {
    mount();
    await screen.findByRole("button", { name: "Alpha" });
    const search = screen.getByLabelText("Search captures");
    fireEvent.keyDown(search, { key: "ArrowRight" });
    expect(selectedTitle()).toBe("Gamma");
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(selectedTitle()).toBe("Alpha");
  });

  it("Place on canvas places the selected card with its bytes and size", async () => {
    mount();
    fireEvent.mouseEnter(await screen.findByRole("button", { name: "Gamma" }));
    fireEvent.click(screen.getByRole("button", { name: "Place on canvas" }));
    await waitFor(() => expect(onPick).toHaveBeenCalledWith(bytes, 320, 200));
    expect(readScreenshotBytes).toHaveBeenCalledWith("c");
    expect(onClose).toHaveBeenCalled();
  });

  it("Enter in the search field places the selected card", async () => {
    mount();
    await screen.findByRole("button", { name: "Alpha" });
    fireEvent.keyDown(screen.getByLabelText("Search captures"), { key: "Enter" });
    await waitFor(() => expect(onPick).toHaveBeenCalledWith(bytes, 320, 200));
    expect(readScreenshotBytes).toHaveBeenCalledWith("b");
  });

  it("the close button calls onClose", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });
});
