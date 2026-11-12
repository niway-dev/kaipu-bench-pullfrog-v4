import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InspectBar } from "./inspect-bar";
import type { InspectController } from "./use-inspect";
import type { ColorsController } from "./colors/use-colors";

function fake(over: Partial<InspectController> = {}): InspectController {
  return {
    enabled: true,
    active: true,
    format: "hex",
    asCaptured: false,
    ruler: null,
    toleranceShown: false,
    outer: false,
    outerLocked: false,
    tolerance: 12,
    copied: false,
    copiedText: null,
    status: "ready",
    capturedUnavailable: false,
    setActive: vi.fn(),
    setFormat: vi.fn(),
    setAsCaptured: vi.fn(),
    setRuler: vi.fn(),
    setTolerance: vi.fn(),
    setOuterLocked: vi.fn(),
    copy: vi.fn(async () => true),
    ...over,
  } as unknown as InspectController;
}

describe("InspectBar", () => {
  it("keeps the accessible names and marks the picked format and ruler", () => {
    render(<InspectBar inspect={fake({ ruler: "x", format: "rgb" })} />);
    expect(screen.getByRole("button", { name: "Horizontal" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Vertical" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(screen.getByRole("button", { name: "RGB" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "HEX" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("button", { name: "Exit Inspect" })).toBeNull();
  });

  it("reflects As captured", () => {
    render(<InspectBar inspect={fake({ asCaptured: true })} />);
    expect(screen.getByRole("button", { name: "As captured" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("colors the tolerance value while it was just changed", () => {
    const { rerender } = render(<InspectBar inspect={fake()} />);
    const value = screen.getByTestId("inspect-tolerance");
    expect(value.getAttribute("data-shown")).toBe("false");
    rerender(<InspectBar inspect={fake({ toleranceShown: true })} />);
    expect(screen.getByTestId("inspect-tolerance").getAttribute("data-shown")).toBe("true");
  });

  it("renders as a toolbar row when inline", () => {
    render(<InspectBar inspect={fake()} inline />);
    expect(screen.getByRole("group", { name: "Inspect options" }).getAttribute("data-inline")).toBe(
      "true",
    );
    expect(screen.getByText("Width")).toBeTruthy();
  });

  it("shows Copy color and Colors as icons in the toolbar row, keeping their names", () => {
    const colors = { open: false, toggle: vi.fn() } as unknown as ColorsController;
    const { rerender } = render(<InspectBar inspect={fake()} colors={colors} inline />);
    expect(screen.getByRole("button", { name: "Copy color" }).textContent).toBe("");
    expect(screen.getByRole("button", { name: "Colors" }).textContent).toBe("");
    // The floating card keeps the words.
    rerender(<InspectBar inspect={fake()} colors={colors} />);
    expect(screen.getByRole("button", { name: "Copy color" }).textContent).toBe("Copy color");
    expect(screen.getByRole("button", { name: "Colors" }).textContent).toBe("Colors");
  });
});
