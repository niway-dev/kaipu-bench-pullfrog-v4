import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExportBox } from "./export-box";

const hiddenAncestor = (el: HTMLElement): Element | null => el.closest('[aria-hidden="true"]');

describe("ExportBox — accessibility", () => {
  it("labeled: the export size stays in the accessibility tree", () => {
    render(<ExportBox size={{ w: 400, h: 300 }} labeled filled />);
    const size = screen.getByText("400 × 300 px");
    expect(hiddenAncestor(size)).toBeNull();
    expect(hiddenAncestor(screen.getByText("Export"))).toBeNull();
  });

  it("labeled: the decorative frame and fill are hidden from screen readers", () => {
    render(<ExportBox size={{ w: 400, h: 300 }} labeled filled />);
    expect(screen.getByTestId("export-box-fill")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("export-box").querySelector(`[aria-hidden="true"]`)).not.toBeNull();
  });

  it("not labeled: there is no size text for screen readers to read", () => {
    render(<ExportBox size={{ w: 400, h: 300 }} labeled={false} />);
    expect(screen.queryByText("400 × 300 px")).toBeNull();
  });
});
