import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ColorsPanel } from "./colors-panel";
import type { ColorAnalysis } from "./histogram";
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
      <ColorsPanel
        grouped
        onGroupedChange={() => {}}
        colors={controller({ progress: 0.624 })}
        format="hex"
        reading={false}
      />,
    );
    expect(screen.getByText("Reading colors… 62%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "62");
    expect(container.querySelectorAll('[class*="skeleton"][aria-hidden]')).toHaveLength(4);
  });

  it("shows no percentage while Inspect is still decoding", () => {
    render(
      <ColorsPanel
        grouped
        onGroupedChange={() => {}}
        colors={controller({ status: "idle", progress: null })}
        format="hex"
        reading
      />,
    );
    expect(screen.getByText("Reading colors…")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  });
});

describe("ColorsPanel photo card", () => {
  const photoAnalysis = (counted: number, counts: number[]): ColorAnalysis => ({
    width: 1,
    height: 1,
    counted,
    distinct: 5000,
    totalGroups: counts.length,
    groups: counts.map((count, id) => ({ id, rgb: id, count, distinct: 1, members: [] })),
    exact: [],
  });
  const ready = (analysis: ColorAnalysis) =>
    render(
      <ColorsPanel
        grouped
        onGroupedChange={() => {}}
        colors={controller({ status: "ready", progress: null, analysis })}
        format="hex"
        reading={false}
      />,
    );

  it("says the share the groups shown actually cover when the goal is reached", () => {
    // Three groups of 30 pixels cover 90 of 100: the 80% goal is reached at the third.
    ready(photoAnalysis(100, [30, 30, 30, 5, 5]));
    expect(
      screen.getByText(/Showing the 3 groups that cover 90% of the image/),
    ).toBeInTheDocument();
  });

  it("does not claim 80% when the groups sent end before reaching it", () => {
    // 200 groups of 2 pixels cover 400 of 1000: the list ends first, so 40%, not 80%.
    ready(
      photoAnalysis(
        1000,
        Array.from({ length: 200 }, () => 2),
      ),
    );
    const body = screen.getByText(/Showing the 200 groups/);
    expect(body).toHaveTextContent("cover 40% of the image");
    expect(body).not.toHaveTextContent("80%");
  });

  it("does not round an exact share down: 57 of 100 reads 57%, not 56%", () => {
    // 57 / 100 * 100 is 56.99999999999999 in floating point, so the product must come first.
    ready(
      photoAnalysis(
        100,
        Array.from({ length: 57 }, () => 1),
      ),
    );
    expect(screen.getByText(/Showing the 57 groups/)).toHaveTextContent("cover 57% of the image");
  });
});
