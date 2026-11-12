import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnnotationToolbar } from "./annotation-toolbar";
import { ANNOTATION_COLORS } from "./tools";
import type { AnnotationToolsController } from "./use-annotation-tools";

function makeTools(overrides: Partial<AnnotationToolsController> = {}): AnnotationToolsController {
  return {
    tool: "select",
    setTool: vi.fn(),
    color: ANNOTATION_COLORS[0].value,
    setColor: vi.fn(),
    stroke: 1,
    setStroke: vi.fn(),
    textSize: 1,
    setTextSize: vi.fn(),
    redactionStyle: "blur",
    setRedactionStyle: vi.fn(),
    stepSize: 1,
    setStepSize: vi.fn(),
    ...overrides,
  };
}

describe("AnnotationToolbar", () => {
  it("renders the four tools and switches tool on click", () => {
    const tools = makeTools();
    render(<AnnotationToolbar tools={tools} />);
    for (const name of ["Select", "Pen", "Box", "Arrow", "Text", "Blur"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "Text" }));
    expect(tools.setTool).toHaveBeenCalledWith("text");
  });

  it("renders every tool including crop", () => {
    render(<AnnotationToolbar tools={makeTools()} />);
    expect(screen.getByRole("button", { name: "Crop" })).toBeInTheDocument();
  });

  it("does not render the contextual controls (those live in the options panel)", () => {
    render(<AnnotationToolbar tools={makeTools({ tool: "box" })} />);
    expect(screen.queryByText("Color")).toBeNull();
    expect(screen.queryByText("Stroke")).toBeNull();
  });

  it("shows the Select text tool only when asked, after the others", () => {
    const { rerender } = render(<AnnotationToolbar tools={makeTools()} />);
    expect(screen.queryByRole("button", { name: "Select text" })).toBeNull();
    const tools = makeTools();
    rerender(<AnnotationToolbar tools={tools} textTool />);
    fireEvent.click(screen.getByRole("button", { name: "Select text" }));
    expect(tools.setTool).toHaveBeenCalledWith("selectText");
  });

  it("explains the canvas-mode Redact tool in its tooltip and description, keeping the plain name", () => {
    const tools = makeTools();
    render(<AnnotationToolbar tools={tools} canvasMode />);
    const redact = screen.getByRole("button", { name: "Redact" });
    expect(redact).toHaveAttribute("aria-keyshortcuts", "B");
    expect(redact).toHaveAttribute("aria-description", expect.stringMatching(/sensitive info/));
    fireEvent.mouseEnter(redact);
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("Redact — hide sensitive info");
    expect(tip).toHaveTextContent("B");
    fireEvent.click(redact);
    expect(tools.setTool).toHaveBeenCalledWith("blur");
  });

  it("leaves the plain Blur tool's tooltip alone without canvas mode", () => {
    render(<AnnotationToolbar tools={makeTools()} />);
    const blur = screen.getByRole("button", { name: "Blur" });
    expect(blur).not.toHaveAttribute("aria-description");
    fireEvent.mouseEnter(blur);
    expect(screen.getByRole("tooltip")).toHaveTextContent(/^Blur/);
  });
});
