import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CropOverlay } from "./crop-overlay";
import type { CropRect } from "../annotations/scene";
import type { EditorScene } from "../annotations/use-editor-scene";

function makeScene(crop?: CropRect): EditorScene {
  return { crop, setCrop: vi.fn() } as unknown as EditorScene;
}

function sizeTheOverlay(): void {
  for (const prop of ["clientWidth", "clientHeight"]) {
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => 100 });
  }
}

// A window of (w, h) fractions of the frame is (w * 400) x (h * 200) export px.
const pixelSize = (c: CropRect): { w: number; h: number } => ({
  w: Math.round(c.w * 400),
  h: Math.round(c.h * 200),
});

function mount(scene: EditorScene, zoom = 1) {
  sizeTheOverlay();
  const utils = render(<CropOverlay scene={scene} chrome={{ zoom, pixelSize }} />);
  const overlay = utils.container.firstChild as HTMLElement;
  overlay.setPointerCapture = vi.fn();
  overlay.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 }) as DOMRect;
  return { ...utils, overlay };
}

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
  Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
});

const FRAME: CropRect = { x: 0.1, y: 0.1, w: 0.5, h: 0.5 };

describe("CropOverlay canvas chrome (mock A5)", () => {
  it("labels the frame with its export size and name", () => {
    mount(makeScene(FRAME));
    expect(screen.getByTestId("export-frame-label")).toHaveTextContent(
      "200 × 100 px · EXPORT FRAME",
    );
  });

  it("draws 8 handles, 9 screen px square at any zoom", () => {
    const scene = makeScene(FRAME);
    const { rerender } = mount(scene, 1);
    const handles = screen.getAllByTestId("export-frame-handle");
    expect(handles).toHaveLength(8);
    expect(handles[0]).toHaveAttribute("width", "9");
    rerender(<CropOverlay scene={scene} chrome={{ zoom: 3, pixelSize }} />);
    const zoomed = screen.getAllByTestId("export-frame-handle")[0];
    expect(Number(zoomed.getAttribute("width"))).toBeCloseTo(3);
  });

  it("the label follows the drag live", () => {
    const scene = makeScene();
    const { overlay } = mount(scene);
    fireEvent.pointerDown(overlay, { clientX: 20, clientY: 20 });
    fireEvent.pointerMove(overlay, { clientX: 60, clientY: 50 });
    // 0.4 x 400 by 0.3 x 200
    expect(screen.getByTestId("export-frame-label")).toHaveTextContent("160 × 60 px");
    expect(scene.setCrop).not.toHaveBeenCalled();
  });

  it("has no label when the export has no size to report", () => {
    sizeTheOverlay();
    render(<CropOverlay scene={makeScene()} chrome={{ zoom: 1, pixelSize: () => null }} />);
    expect(screen.queryByTestId("export-frame-label")).toBeNull();
  });

  it("draws none of it without chrome (classic mode)", () => {
    sizeTheOverlay();
    render(<CropOverlay scene={makeScene()} />);
    expect(screen.queryByTestId("export-frame-label")).toBeNull();
    expect(screen.queryAllByTestId("export-frame-handle")).toHaveLength(0);
  });
});
