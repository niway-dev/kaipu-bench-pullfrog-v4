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
    expect(img.style.width).toBe("75%");
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
