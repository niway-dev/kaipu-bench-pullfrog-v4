import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolButton, ariaKeyShortcut } from "./tip";

describe("ariaKeyShortcut", () => {
  it("maps the display label Esc to the UI Events key name Escape", () => {
    expect(ariaKeyShortcut("Esc")).toBe("Escape");
  });

  it("passes a plain letter through unchanged", () => {
    expect(ariaKeyShortcut("M")).toBe("M");
  });
});

describe("ToolButton", () => {
  it("sets aria-keyshortcuts to the key name but keeps the chip text as the display label", () => {
    render(
      <ToolButton label="Annotate" keyHint="Esc">
        x
      </ToolButton>,
    );
    const btn = screen.getByRole("button", { name: "Annotate" });
    expect(btn).toHaveAttribute("aria-keyshortcuts", "Escape");
    // The tooltip shows on hover; its chip keeps the short label.
    fireEvent.mouseEnter(btn);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Esc");
  });

  it("passes a plain letter hint through to aria-keyshortcuts", () => {
    render(
      <ToolButton label="Add image" keyHint="M">
        x
      </ToolButton>,
    );
    expect(screen.getByRole("button", { name: "Add image" })).toHaveAttribute(
      "aria-keyshortcuts",
      "M",
    );
  });
});
