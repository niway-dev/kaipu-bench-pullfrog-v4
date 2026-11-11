import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, getToasts } from "@renderer/ui/toast-store";
import type { ImageSource } from "@renderer/features/screenshots/image-source";
import { ScreenshotEditorPage } from "./screenshot-editor-page";

// The infinite canvas (NIW2-698) is behind the `image-canvas` flag; each test picks a side.
let imageCanvas = false;
vi.mock("@renderer/features/analytics/use-flag", () => ({
  useFlag: (name: string) => (name === "image-canvas" ? imageCanvas : false),
}));

const exportScene = vi.hoisted(() => vi.fn());
vi.mock("@renderer/features/screenshots/export", () => ({
  exportScene,
  clearExportCache: vi.fn(),
}));

const originalRect = Element.prototype.getBoundingClientRect;

const bytes = new Uint8Array([1, 2, 3]).buffer;
// A pasted image runs no auto action: the test drives every save by hand.
const PASTE: ImageSource = { kind: "blob", bytes, width: 4, height: 4, origin: "paste" };
// A fresh capture: it opens with the default frame.
const CAPTURE: ImageSource = { kind: "blob", bytes, width: 4, height: 4, title: "Shot" };

beforeEach(async () => {
  const base = await window.electronAPI.getSettings();
  window.electronAPI.getSettings = vi.fn(async () => ({
    ...base,
    screenshotCopy: "manual" as const,
  }));
  URL.createObjectURL = vi.fn(() => "blob:shot");
  URL.revokeObjectURL = vi.fn();
  exportScene.mockReset();
  exportScene.mockResolvedValue(new ArrayBuffer(1));
  window.electronAPI.saveScreenshot = vi.fn(async (_png: ArrayBuffer, opts: { title: string }) => ({
    id: "s1",
    assetId: "a-s1",
    title: opts.title,
    kind: "screenshot",
  })) as never;
  window.electronAPI.copyImageToClipboard = vi.fn(async () => {});
});
afterEach(() => {
  imageCanvas = false;
  getToasts().forEach((x) => dismissToast(x.id));
  // @ts-expect-error — drop the stubs some tests put on the prototypes
  delete HTMLElement.prototype.clientWidth;
  // @ts-expect-error — see above
  delete HTMLElement.prototype.clientHeight;
  Element.prototype.getBoundingClientRect = originalRect;
  // @ts-expect-error — jsdom has no pointer capture; the tests stub it
  delete Element.prototype.setPointerCapture;
});

function mount(source: ImageSource) {
  const router = createMemoryRouter(
    [
      { path: "/editor/capture", element: <ScreenshotEditorPage /> },
      { path: "/screenshots", element: <div>screenshots</div> },
    ],
    { initialEntries: [{ pathname: "/editor/capture", state: source }] },
  );
  return render(<RouterProvider router={router} />);
}
const loadImage = async () => fireEvent.load(await screen.findByRole("img"));
const canvasEl = (): HTMLElement =>
  document.querySelector('[data-ui-area="editorImage.canvas"] > div')!;
/** The frame: the canvas element's first child (what the view transform is applied to). */
const frameEl = (): HTMLElement => canvasEl().firstElementChild as HTMLElement;
const zoomLabel = (): string => screen.getByTitle("Reset zoom").textContent ?? "";
/** A 200×200 shot at the origin, so the crop overlay has a real box to map pointers to. */
function sizeTheCanvas(): void {
  for (const prop of ["clientWidth", "clientHeight"]) {
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => 200 });
  }
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: 200,
      height: 200,
      right: 200,
      bottom: 200,
      x: 0,
      y: 0,
    }) as DOMRect;
}

const exportCalls = () => exportScene.mock.calls as [string, Record<string, unknown>][];

describe("ScreenshotEditorPage — export (image-canvas)", () => {
  it("flag on: Save and Copy export the content box", async () => {
    imageCanvas = true;
    mount(PASTE);
    await loadImage();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(exportCalls()).toHaveLength(1));
    expect(exportCalls()[0][1]).toMatchObject({ canvas: true });
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(exportCalls()).toHaveLength(2));
    expect(exportCalls()[1][1]).toMatchObject({ canvas: true });
  });

  it("flag on: the PDF export is the content box too", async () => {
    imageCanvas = true;
    window.electronAPI.exportScreenshotFile = vi.fn(async () => null) as never;
    mount(PASTE);
    await loadImage();
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    await waitFor(() => expect(exportCalls()).toHaveLength(1));
    expect(exportCalls()[0][0]).toBe("pdf");
    expect(exportCalls()[0][1]).toMatchObject({ canvas: true });
  });

  it("flag off: exports exactly as before, with no canvas option at all", async () => {
    mount(PASTE);
    await loadImage();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(exportCalls()).toHaveLength(1));
    expect(exportCalls()[0][1]).not.toHaveProperty("canvas");
    expect(Object.keys(exportCalls()[0][1]).sort()).toEqual(["bytes", "displayedW", "scene"]);
  });

  it.each([true, false])(
    "a fresh capture opens with bg none and padding 0 (flag %s)",
    async (on) => {
      imageCanvas = on;
      mount(CAPTURE);
      await loadImage();
      await waitFor(() => expect(exportCalls().length).toBeGreaterThan(0)); // the auto-save
      expect(exportCalls()[0][1].scene).toMatchObject({
        beautify: { bg: "none", padding: 0 },
      });
    },
  );
});

describe("ScreenshotEditorPage — pan and zoom (image-canvas)", () => {
  it("flag on: a plain wheel pans the view and does not zoom", async () => {
    imageCanvas = true;
    mount(PASTE);
    await loadImage();
    expect(canvasEl().dataset.panned).toBe("false");
    expect(frameEl().style.transform).toBe("");
    fireEvent.wheel(canvasEl(), { deltaX: 10, deltaY: 40 });
    await waitFor(() => expect(canvasEl().dataset.panned).toBe("true"));
    expect(frameEl().style.transform).toBe("translate(-10px, -40px) scale(1)");
    expect(zoomLabel()).toBe("100%");
  });

  it("flag on: ⌘/Ctrl + wheel zooms (a pinch arrives as one)", async () => {
    imageCanvas = true;
    mount(PASTE);
    await loadImage();
    fireEvent.wheel(canvasEl(), { deltaY: -200, ctrlKey: true });
    await waitFor(() => expect(zoomLabel()).not.toBe("100%"));
    expect(parseInt(zoomLabel(), 10)).toBeGreaterThan(100);
    fireEvent.wheel(canvasEl(), { deltaY: 100000, metaKey: true });
    await waitFor(() => expect(zoomLabel()).toBe("25%")); // the canvas floor
  });

  it("flag on: the zoom label resets zoom AND pan", async () => {
    imageCanvas = true;
    mount(PASTE);
    await loadImage();
    fireEvent.wheel(canvasEl(), { deltaX: 30, deltaY: 30 });
    fireEvent.wheel(canvasEl(), { deltaY: -200, ctrlKey: true });
    await waitFor(() => expect(zoomLabel()).not.toBe("100%"));
    fireEvent.click(screen.getByTitle("Reset zoom"));
    expect(zoomLabel()).toBe("100%");
    expect(canvasEl().dataset.panned).toBe("false");
    expect(frameEl().style.transform).toBe("");
  });

  it("flag on: the zoom buttons reach 25% (the classic floor is 50%)", async () => {
    imageCanvas = true;
    mount(PASTE);
    await loadImage();
    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getByTitle("Zoom out"));
    expect(zoomLabel()).toBe("25%");
    expect(screen.getByTitle("Zoom out")).toBeDisabled();
    expect(canvasEl().dataset.zoomedOut).toBe("true");
  });

  it("flag on: Space + drag pans; the press does not reach the annotation tools", async () => {
    imageCanvas = true;
    Element.prototype.setPointerCapture = vi.fn();
    mount(PASTE);
    await loadImage();
    fireEvent.keyDown(window, { key: " ", code: "Space" });
    await waitFor(() => expect(canvasEl().dataset.pan).toBe("ready"));
    fireEvent.pointerDown(canvasEl(), { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    await waitFor(() => expect(canvasEl().dataset.pan).toBe("active"));
    fireEvent.pointerMove(canvasEl(), { clientX: 130, clientY: 90, pointerId: 1 });
    await waitFor(() => expect(canvasEl().dataset.panned).toBe("true"));
    expect(frameEl().style.transform).toBe("translate(30px, -10px) scale(1)");
    fireEvent.pointerUp(canvasEl(), { pointerId: 1 });
    fireEvent.keyUp(window, { key: " ", code: "Space" });
    await waitFor(() => expect(canvasEl().dataset.pan).toBe("idle"));
    // Panning is view-only: the scene is untouched, so nothing is dirty beyond the open.
    expect(canvasEl().dataset.exportFrame).toBe("false");
  });

  it("flag on: Space + drag does not draw with the active tool; the same drag without Space does", async () => {
    imageCanvas = true;
    sizeTheCanvas();
    mount(PASTE);
    await loadImage();
    const draw = (): void => {
      fireEvent.click(screen.getByRole("button", { name: "Box" }));
      const surface = screen.getByTestId("canvas-hit-surface");
      fireEvent.pointerDown(surface, { button: 0, clientX: 20, clientY: 20, pointerId: 5 });
      fireEvent.pointerMove(surface, { clientX: 120, clientY: 100, pointerId: 5 });
      fireEvent.pointerUp(surface, { pointerId: 5 });
    };
    const annotationCount = async (): Promise<number> => {
      fireEvent.click(screen.getByRole("button", { name: "Copy" }));
      await waitFor(() => expect(exportScene).toHaveBeenCalled());
      const scene = exportCalls().at(-1)![1].scene as { annotations: unknown[] };
      exportScene.mockClear();
      return scene.annotations.length;
    };
    fireEvent.keyDown(window, { key: " ", code: "Space" });
    draw();
    fireEvent.keyUp(window, { key: " ", code: "Space" });
    expect(await annotationCount()).toBe(0);
    draw();
    await waitFor(async () => expect(await annotationCount()).toBe(1));
  });

  it("flag on: middle-button drag pans without Space", async () => {
    imageCanvas = true;
    Element.prototype.setPointerCapture = vi.fn();
    mount(PASTE);
    await loadImage();
    fireEvent.pointerDown(canvasEl(), { button: 1, clientX: 50, clientY: 50, pointerId: 2 });
    fireEvent.pointerMove(canvasEl(), { clientX: 60, clientY: 80, pointerId: 2 });
    await waitFor(() => expect(frameEl().style.transform).toBe("translate(10px, 30px) scale(1)"));
    fireEvent.pointerUp(canvasEl(), { pointerId: 2 });
  });

  it("flag on: Space is ignored while typing in a field", async () => {
    imageCanvas = true;
    mount(PASTE);
    await loadImage();
    const title = screen.getByRole("textbox", { name: /title/i });
    fireEvent.keyDown(title, { key: " ", code: "Space" });
    expect(canvasEl().dataset.pan).toBe("idle");
  });

  it("flag on: Space is ignored while a dialog is open", async () => {
    imageCanvas = true;
    mount(PASTE);
    await loadImage();
    const modal = document.createElement("div");
    modal.setAttribute("aria-modal", "true");
    document.body.appendChild(modal);
    try {
      fireEvent.keyDown(window, { key: " ", code: "Space" });
      expect(canvasEl().dataset.pan).toBe("idle");
    } finally {
      modal.remove();
    }
  });

  it("flag off: a plain wheel does nothing new, and the DOM carries no canvas state", async () => {
    mount(PASTE);
    await loadImage();
    fireEvent.wheel(canvasEl(), { deltaX: 10, deltaY: 40 });
    expect(frameEl().style.transform).toBe("");
    expect(zoomLabel()).toBe("100%");
    for (const attr of [
      "canvas",
      "panned",
      "pan",
      "exportFrame",
      "zoomedOut",
      "hasContentOutside",
    ]) {
      expect(canvasEl().dataset).not.toHaveProperty(attr);
    }
  });

  it("flag off: ⌘/Ctrl + wheel still zooms, and the floor is still 50%", async () => {
    mount(PASTE);
    await loadImage();
    fireEvent.wheel(canvasEl(), { deltaY: -200, ctrlKey: true });
    await waitFor(() => expect(parseInt(zoomLabel(), 10)).toBeGreaterThan(100));
    fireEvent.click(screen.getByTitle("Reset zoom"));
    for (let i = 0; i < 4; i += 1) fireEvent.click(screen.getByTitle("Zoom out"));
    expect(zoomLabel()).toBe("50%");
  });

  it("flag off: Space does not switch to the hand", async () => {
    mount(PASTE);
    await loadImage();
    fireEvent.keyDown(window, { key: " ", code: "Space" });
    expect(canvasEl().dataset).not.toHaveProperty("pan");
  });
});

describe("ScreenshotEditorPage — preview matches the export (image-canvas)", () => {
  it("flag on: a box drawn outside the shot grows the frame's padding and the canvas state", async () => {
    imageCanvas = true;
    sizeTheCanvas();
    // The shot is 400 px in the file and shown at 200 px (scale 2).
    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
      configurable: true,
      get: () => 400,
    });
    Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", {
      configurable: true,
      get: () => 400,
    });
    try {
      mount(PASTE);
      await loadImage();
      expect(canvasEl().dataset.hasContentOutside).toBe("false");
      const frame = frameEl();
      expect(frame.style.padding).toBe("0px");
      fireEvent.click(screen.getByRole("button", { name: "Box" }));
      const surface = screen.getByTestId("canvas-hit-surface");
      // From (-60,-40) to (-10,-10): entirely above and left of the shot.
      fireEvent.pointerDown(surface, { button: 0, clientX: -60, clientY: -40, pointerId: 6 });
      fireEvent.pointerMove(surface, { clientX: -10, clientY: -10, pointerId: 6 });
      fireEvent.pointerUp(surface, { pointerId: 6 });
      await waitFor(() => expect(canvasEl().dataset.hasContentOutside).toBe("true"));
      const [top, right, bottom, left] = frameEl()
        .style.padding.split(" ")
        .map((v) => parseFloat(v));
      // The content box reaches at least as far as the box's outer edges, in display px.
      expect(left).toBeGreaterThanOrEqual(60);
      expect(top).toBeGreaterThanOrEqual(40);
      expect(right).toBe(0);
      expect(bottom).toBe(0);
      // No background by default: the union box is filled white under the shot.
      expect(screen.getByTestId("canvas-box-fill")).toBeInTheDocument();
    } finally {
      // @ts-expect-error — drop the stubs
      delete HTMLImageElement.prototype.naturalWidth;
      // @ts-expect-error — see above
      delete HTMLImageElement.prototype.naturalHeight;
    }
  });

  it("flag off: the same drawing leaves the frame exactly as it was", async () => {
    sizeTheCanvas();
    mount(PASTE);
    await loadImage();
    expect(frameEl().style.padding).toBe("0px");
    expect(screen.queryByTestId("canvas-box-fill")).toBeNull();
    expect(screen.queryByTestId("canvas-hit-surface")).toBeNull();
  });
});

describe("ScreenshotEditorPage — Crop is the export frame (image-canvas)", () => {
  async function drawCrop(): Promise<void> {
    fireEvent.click(screen.getByRole("button", { name: "Crop" }));
    const overlay = await waitFor(() => {
      const el = document.querySelector('[class*="overlay"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    fireEvent.pointerDown(overlay, { clientX: 20, clientY: 20, pointerId: 3 });
    fireEvent.pointerMove(overlay, { clientX: 120, clientY: 100, pointerId: 3 });
    fireEvent.pointerUp(overlay, { pointerId: 3 });
  }

  it("flag on: the crop tool sets the export frame, not the crop", async () => {
    imageCanvas = true;
    sizeTheCanvas();
    mount(PASTE);
    await loadImage();
    await drawCrop();
    await waitFor(() => expect(canvasEl().dataset.exportFrame).toBe("true"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(exportCalls()).toHaveLength(1));
    const scene = exportCalls()[0][1].scene as {
      crop?: unknown;
      exportFrame?: Record<string, number>;
    };
    expect(scene.crop).toBeUndefined();
    // 200×200 shot, no padding, no extents: the world frame is the drawn rect over 200 px.
    expect(scene.exportFrame!.x).toBeCloseTo(0.1);
    expect(scene.exportFrame!.y).toBeCloseTo(0.1);
    expect(scene.exportFrame!.w).toBeCloseTo(0.5);
    expect(scene.exportFrame!.h).toBeCloseTo(0.4);
  });

  it("flag on: Reset clears the export frame", async () => {
    imageCanvas = true;
    sizeTheCanvas();
    mount(PASTE);
    await loadImage();
    await drawCrop();
    await waitFor(() => expect(canvasEl().dataset.exportFrame).toBe("true"));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(canvasEl().dataset.exportFrame).toBe("false"));
  });

  it("flag on: Esc clears the export frame", async () => {
    imageCanvas = true;
    sizeTheCanvas();
    mount(PASTE);
    await loadImage();
    await drawCrop();
    await waitFor(() => expect(canvasEl().dataset.exportFrame).toBe("true"));
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(canvasEl().dataset.exportFrame).toBe("false"));
  });

  it("flag on: the export frame is one undo entry", async () => {
    imageCanvas = true;
    sizeTheCanvas();
    mount(PASTE);
    await loadImage();
    await drawCrop();
    await waitFor(() => expect(canvasEl().dataset.exportFrame).toBe("true"));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(canvasEl().dataset.exportFrame).toBe("false"));
  });

  it("flag off: the crop tool still sets the crop and never an export frame", async () => {
    sizeTheCanvas();
    mount(PASTE);
    await loadImage();
    await drawCrop();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(exportCalls()).toHaveLength(1));
    const scene = exportCalls()[0][1].scene as { crop?: unknown; exportFrame?: unknown };
    expect(scene.crop).toBeDefined();
    expect(scene.exportFrame).toBeUndefined();
  });
});
