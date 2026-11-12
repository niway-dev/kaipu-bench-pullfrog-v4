import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RedactionNotice } from "./redaction-notice";

describe("RedactionNotice", () => {
  it("is a non-modal dialog named by its title, in the editor image area", () => {
    render(<RedactionNotice onUndo={vi.fn()} onAcknowledge={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Saving makes redactions permanent" });
    expect(dialog).toHaveAttribute("data-ui-area", "editorImage.redactionNotice");
    expect(dialog).not.toHaveAttribute("aria-modal");
    expect(screen.getByText(/Undo still works until then\./)).toBeTruthy();
    expect(screen.getByText("Shown once, before your first redaction is saved.")).toBeTruthy();
  });

  it("Got it acknowledges and Undo redaction undoes, each once", () => {
    const onUndo = vi.fn();
    const onAcknowledge = vi.fn();
    render(<RedactionNotice onUndo={onUndo} onAcknowledge={onAcknowledge} />);
    fireEvent.click(screen.getByRole("button", { name: "Undo redaction" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onAcknowledge).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });
});
