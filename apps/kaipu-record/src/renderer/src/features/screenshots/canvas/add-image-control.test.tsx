import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddImageControl } from "./add-image-control";

vi.mock("@renderer/features/analytics/use-flag", () => ({ useFlag: () => true }));

function mount(open = true) {
  return render(
    <AddImageControl
      onAdd={vi.fn()}
      excludeId={null}
      excludeAssetId={null}
      open={open}
      onOpenChange={vi.fn()}
    />,
  );
}

describe("AddImageControl menu", () => {
  it("focuses the first item on open and the arrows move between items, wrapping", () => {
    mount();
    const [capture, library] = screen.getAllByRole("menuitem");
    expect(capture).toHaveFocus();
    fireEvent.keyDown(capture!, { key: "ArrowDown" });
    expect(library).toHaveFocus();
    fireEvent.keyDown(library!, { key: "ArrowDown" });
    expect(capture).toHaveFocus();
    fireEvent.keyDown(capture!, { key: "ArrowUp" });
    expect(library).toHaveFocus();
    fireEvent.keyDown(library!, { key: "Home" });
    expect(capture).toHaveFocus();
    fireEvent.keyDown(capture!, { key: "End" });
    expect(library).toHaveFocus();
  });

  it("renders the paste hint with a key chip", () => {
    const { container } = mount();
    expect(screen.getByRole("menu")).toHaveTextContent(/paste an image with/i);
    expect(container.querySelector("kbd")).not.toBeNull();
  });

  it("the toolbar button reads as the active tool while the menu is open, not before", () => {
    const { unmount } = mount(false);
    expect(screen.getByRole("button", { name: "Add image" })).not.toHaveAttribute("data-active");
    unmount();
    mount(true);
    expect(screen.getByRole("button", { name: "Add image" })).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("stays active while the Library picker is open", () => {
    window.electronAPI.listLocalRecordings = vi.fn(async () => []);
    const { rerender } = mount(true);
    fireEvent.click(screen.getByRole("menuitem", { name: /library/i }));
    // The page closes the menu when From Library is chosen: only the picker keeps it active.
    rerender(
      <AddImageControl
        onAdd={vi.fn()}
        excludeId={null}
        excludeAssetId={null}
        open={false}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add image" })).toHaveAttribute(
      "data-active",
      "true",
    );
  });
});
