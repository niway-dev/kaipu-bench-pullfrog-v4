import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ColorsPanel } from "./colors-panel";
import type { ColorsController } from "./use-colors";

function controller(patch: Partial<ColorsController>): ColorsController {
  return {
    open: true,
    setOpen: vi.fn(),
    toggle: vi.fn(),
    status: "counting",
    progress: 0,
    analysis: null,
    located: null,
    locate: vi.fn(),
    overlay: null,
    ...patch,
  };
}

describe("ColorsPanel while counting", () => {
  it("shows the percentage, a progress bar at that value and four placeholder rows", () => {
    const { container } = render(
      <ColorsPanel colors={controller({ progress: 0.624 })} format="hex" reading={false} />,
    );
    expect(screen.getByText("Reading colors… 62%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "62");
    expect(container.querySelectorAll('[class*="skeleton"][aria-hidden]')).toHaveLength(4);
  });

  it("shows no percentage while Inspect is still decoding", () => {
    render(
      <ColorsPanel colors={controller({ status: "idle", progress: null })} format="hex" reading />,
    );
    expect(screen.getByText("Reading colors…")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  });
});
