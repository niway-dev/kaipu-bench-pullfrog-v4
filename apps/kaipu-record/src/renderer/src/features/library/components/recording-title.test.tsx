import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecordingTitle } from "./recording-title";

afterEach(cleanup);

describe("RecordingTitle", () => {
  // The heading's name is the recording's title; the rename action is only a description.
  it("keeps the title as the heading's name and announces the rename as its description", () => {
    render(<RecordingTitle title="Demo" onRename={vi.fn()} />);
    const heading = screen.getByRole("heading", { name: "Demo" });
    const button = heading.querySelector("button");
    expect(button).toHaveAccessibleName("Demo");
    expect(button).toHaveAccessibleDescription("Rename");
  });

  it("opens the rename input, focused, with the current title when the title is clicked", () => {
    render(<RecordingTitle title="Demo" onRename={vi.fn()} />);
    fireEvent.click(screen.getByRole("heading", { name: "Demo" }).querySelector("button")!);
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("Demo");
    expect(input).toHaveFocus();
  });

  it("renames on Enter", () => {
    const onRename = vi.fn();
    render(<RecordingTitle title="Demo" onRename={onRename} />);
    fireEvent.click(screen.getByRole("heading", { name: "Demo" }).querySelector("button")!);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Walkthrough" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRename).toHaveBeenCalledWith("Walkthrough");
  });

  it("leaves the title alone on Escape", () => {
    const onRename = vi.fn();
    render(<RecordingTitle title="Demo" onRename={onRename} />);
    fireEvent.click(screen.getByRole("heading", { name: "Demo" }).querySelector("button")!);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Walkthrough" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Demo" })).toBeInTheDocument();
  });
});
