import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScreenshotViewer } from "./screenshot-viewer";

afterEach(cleanup);

function loadImage(img: HTMLElement, width = 1440, height = 900) {
  Object.defineProperty(img, "naturalWidth", { value: width, configurable: true });
  Object.defineProperty(img, "naturalHeight", { value: height, configurable: true });
  fireEvent.load(img);
}

describe("ScreenshotViewer", () => {
  it("works with just src, as before", () => {
    const { container } = render(<ScreenshotViewer src="kaipu-media://screenshot/a" />);
    expect(container.querySelector("img")).not.toBeNull();
  });

  it("reports and shows the natural size on load", () => {
    const onNaturalSize = vi.fn();
    const { container } = render(
      <ScreenshotViewer src="kaipu-media://screenshot/a" onNaturalSize={onNaturalSize} />,
    );
    loadImage(container.querySelector("img")!);
    expect(onNaturalSize).toHaveBeenCalledWith(1440, 900);
    expect(screen.getByText("1440 × 900 px")).toBeTruthy();
  });

  it("zooms in and out, and Fit resets", () => {
    const { container } = render(<ScreenshotViewer src="kaipu-media://screenshot/a" />);
    const img = container.querySelector("img")!;
    expect(img.style.width).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(img.style.width).toBe("150%");
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(img.style.width).toBe("200%");
    fireEvent.click(screen.getByRole("button", { name: "Fit" }));
    expect(img.style.width).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(img.style.maxWidth).toBe("75%");
  });

  it("zoomed out, the image scales inside the Fit box; zoomed in, it grows past it", () => {
    const { container } = render(<ScreenshotViewer src="kaipu-media://screenshot/a" />);
    const img = container.querySelector("img")!;
    const zoomOut = screen.getByRole("button", { name: "Zoom out" });
    fireEvent.click(zoomOut);
    expect([img.style.maxWidth, img.style.maxHeight, img.style.width]).toEqual(["75%", "75%", ""]);
    fireEvent.click(zoomOut);
    expect([img.style.maxWidth, img.style.maxHeight, img.style.width]).toEqual(["50%", "50%", ""]);
    fireEvent.click(screen.getByRole("button", { name: "Fit" }));
    expect([img.style.maxWidth, img.style.maxHeight, img.style.width]).toEqual(["", "", ""]);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect([img.style.width, img.style.maxWidth, img.style.maxHeight]).toEqual([
      "150%",
      "none",
      "none",
    ]);
  });

  it("zoomed out, a screenshot smaller than the frame shrinks from its Fit size", () => {
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ width: 800, height: 500 } as DOMRect);
    try {
      const { container } = render(<ScreenshotViewer src="kaipu-media://screenshot/a" />);
      const img = container.querySelector("img")!;
      loadImage(img, 300, 200);
      const zoomOut = screen.getByRole("button", { name: "Zoom out" });
      fireEvent.click(zoomOut);
      expect(img.style.width).toBe("225px");
      fireEvent.click(zoomOut);
      expect(img.style.width).toBe("150px");
    } finally {
      rect.mockRestore();
    }
  });

  it("zoomed out, a tall screenshot stays inside its Fit box", () => {
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ width: 800, height: 500 } as DOMRect);
    try {
      const { container } = render(<ScreenshotViewer src="kaipu-media://screenshot/a" />);
      const img = container.querySelector("img")!;
      // 1000 × 3000 in an 800 × 500 frame: Fit is height-bound, about 167 × 500.
      loadImage(img, 1000, 3000);
      const zoomOut = screen.getByRole("button", { name: "Zoom out" });
      fireEvent.click(zoomOut);
      fireEvent.click(zoomOut);
      const width = Number.parseFloat(img.style.width);
      expect(width).toBeCloseTo(83.33, 1);
      // Its height at that width is 250 px: half the frame, never past it.
      expect((width * 3000) / 1000).toBeLessThanOrEqual(500);
    } finally {
      rect.mockRestore();
    }
  });

  it("stops at the ends of the zoom range", () => {
    render(<ScreenshotViewer src="kaipu-media://screenshot/a" />);
    const zoomIn = screen.getByRole("button", { name: "Zoom in" }) as HTMLButtonElement;
    for (let i = 0; i < 6; i++) fireEvent.click(zoomIn);
    expect(zoomIn.disabled).toBe(true);
  });

  it("shows no controls when the image is unavailable", () => {
    render(<ScreenshotViewer src={null} />);
    expect(screen.getByText("Image unavailable")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Fit" })).toBeNull();
  });
});
