import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, getToasts } from "@renderer/ui/toast-store";
import type { ImageSource } from "@renderer/features/screenshots/image-source";
import { ScreenshotEditorPage } from "./screenshot-editor-page";

// Inspect mode (NIW2-699) is behind `image-inspect`; image-canvas is the other latch it must
// work with. Each test picks its sides.
const flags = { "image-inspect": false, "image-canvas": false };
vi.mock("@renderer/features/analytics/use-flag", () => ({
  useFlag: (name: keyof typeof flags) => flags[name] ?? false,
}));

vi.mock("@renderer/features/screenshots/export", () => ({
  exportScene: vi.fn(async () => new ArrayBuffer(1)),
  clearExportCache: vi.fn(),
}));

// The decoders need a real canvas and ImageBitmap: the page test replaces them.
const decodeSrgbBuffer = vi.hoisted(() => vi.fn());
const probeCaptured = vi.hoisted(() => vi.fn());
vi.mock("@renderer/features/screenshots/inspect/pixel-buffer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@renderer/features/screenshots/inspect/pixel-buffer")>()),
  decodeSrgbBuffer,
  probeCaptured,
}));

const originalRect = Element.prototype.getBoundingClientRect;
const bytes = new Uint8Array([1, 2, 3]).buffer;
const PASTE: ImageSource = { kind: "blob", bytes, width: 4, height: 4, origin: "paste" };

/** 4x4 image whose pixel (x, y) is (50x, 50y, 100). */
function fourByFour() {
  const data = new Uint8ClampedArray(4 * 4 * 4);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) data.set([50 * x, 50 * y, 100, 255], (y * 4 + x) * 4);
  }
  return { width: 4, height: 4, data };
}
// The pointer used below sits over image pixel (3, 1): (150, 50, 100).
const POINTER = { clientX: 150, clientY: 50 };
const PIXEL_HEX = "#963264";

const writeText = vi.fn(async (_text: string) => {});

// jsdom has no canvas: a fake 2D context that records what the loupe draws.
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const drawn: Uint8ClampedArray[] = [];
const fakeContext = {
  imageSmoothingEnabled: true,
  createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  putImageData: vi.fn((image: { data: Uint8ClampedArray }) => {
    drawn.push(new Uint8ClampedArray(image.data));
  }),
};

beforeEach(async () => {
  const base = await window.electronAPI.getSettings();
  window.electronAPI.getSettings = vi.fn(async () => ({
    ...base,
    screenshotCopy: "manual" as const,
  }));
  URL.createObjectURL = vi.fn(() => "blob:shot");
  URL.revokeObjectURL = vi.fn();
  window.electronAPI.saveScreenshot = vi.fn(async (_png: ArrayBuffer, opts: { title: string }) => ({
    id: "s1",
    assetId: "a-s1",
    title: opts.title,
    kind: "screenshot",
  })) as never;
  decodeSrgbBuffer.mockReset();
  decodeSrgbBuffer.mockImplementation(async () => fourByFour());
  probeCaptured.mockReset();
  probeCaptured.mockImplementation(async () => {
    const raw = new Uint8ClampedArray(4 * 4 * 4);
    const p3 = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < 16; i++) {
      raw.set([1, 2, 3, 255], i * 4);
      p3.set([255, 0, 0, 255], i * 4); // P3 pure red: outside sRGB
    }
    return { sx: 0, sy: 0, sw: 4, sh: 4, raw, p3 };
  });
  writeText.mockClear();
  drawn.length = 0;
  fakeContext.putImageData.mockClear();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => fakeContext) as never;
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  // A 200x200 picture at the origin, so the pointer maps to a known pixel.
  Element.prototype.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0 }) as DOMRect;
  Element.prototype.setPointerCapture = vi.fn();
});
afterEach(() => {
  flags["image-inspect"] = false;
  flags["image-canvas"] = false;
  getToasts().forEach((x) => dismissToast(x.id));
  Element.prototype.getBoundingClientRect = originalRect;
  HTMLCanvasElement.prototype.getContext = originalGetContext;
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
const inspectButton = () => screen.queryByRole("button", { name: "Inspect (I)" });
const press = (key: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(window, { key, ...init });
const layer = () => screen.getByTestId("inspect-layer");

async function enterAndHover(): Promise<void> {
  mount(PASTE);
  await loadImage();
  fireEvent.click(inspectButton()!);
  await screen.findByTestId("inspect-layer");
  fireEvent.pointerMove(layer(), POINTER);
  await screen.findByText(PIXEL_HEX);
}

describe("ScreenshotEditorPage — Inspect (flag off)", () => {
  it("has no Inspect button, ignores the keys and never decodes", async () => {
    mount(PASTE);
    await loadImage();
    expect(inspectButton()).toBeNull();
    press("i");
    press("c");
    press("Escape");
    expect(canvasEl()).not.toHaveAttribute("data-inspect");
    expect(screen.queryByTestId("inspect-layer")).toBeNull();
    expect(decodeSrgbBuffer).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
  });
});

describe.each([
  ["image-canvas off", false],
  ["image-canvas on", true],
])("ScreenshotEditorPage — Inspect (flag on, %s)", (_label, canvas) => {
  beforeEach(() => {
    flags["image-inspect"] = true;
    flags["image-canvas"] = canvas;
  });

  it("the button enters, Esc leaves, and the keys do the same", async () => {
    mount(PASTE);
    await loadImage();
    expect(canvasEl()).toHaveAttribute("data-inspect", "false");
    expect(inspectButton()).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(inspectButton()!);
    expect(canvasEl()).toHaveAttribute("data-inspect", "true");
    expect(inspectButton()).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("group", { name: "Inspect options" })).toBeInTheDocument();

    press("Escape");
    expect(canvasEl()).toHaveAttribute("data-inspect", "false");
    expect(screen.queryByRole("group", { name: "Inspect options" })).toBeNull();

    press("i");
    expect(canvasEl()).toHaveAttribute("data-inspect", "true");
    press("i");
    expect(canvasEl()).toHaveAttribute("data-inspect", "false");
  });

  it("reads the pixels once, the first time Inspect is entered", async () => {
    mount(PASTE);
    await loadImage();
    expect(decodeSrgbBuffer).not.toHaveBeenCalled();
    press("i");
    press("Escape");
    press("i");
    await waitFor(() => expect(decodeSrgbBuffer).toHaveBeenCalledTimes(1));
  });

  it("ignores i typed in the title field", async () => {
    mount(PASTE);
    await loadImage();
    const title = screen.getByRole("textbox");
    fireEvent.keyDown(title, { key: "i" });
    expect(canvasEl()).toHaveAttribute("data-inspect", "false");
  });

  it("shows the loupe and the colour under the pointer", async () => {
    await enterAndHover();
    expect(screen.getByText("3, 1")).toBeInTheDocument();
    const loupe = screen.getByTestId("inspect-loupe");
    expect(loupe).toHaveAttribute("data-smoothing", "off");
    expect(loupe).toHaveAttribute("width", "15");
    // Drawn unsmoothed, 15 x 15 pixels, the pixel under the pointer in the middle.
    expect(fakeContext.imageSmoothingEnabled).toBe(false);
    const last = drawn[drawn.length - 1];
    expect(last).toHaveLength(15 * 15 * 4);
    const centre = (7 * 15 + 7) * 4;
    expect(Array.from(last.slice(centre, centre + 4))).toEqual([150, 50, 100, 255]);
    expect(document.querySelector('[data-ui-area="editorImage.inspectHud"]')).not.toBeNull();
  });

  it("hides the HUD when the pointer leaves", async () => {
    await enterAndHover();
    fireEvent.pointerLeave(layer());
    await waitFor(() => expect(screen.queryByText(PIXEL_HEX)).toBeNull());
  });

  it("C copies the shown colour, and the format switch changes what is copied", async () => {
    await enterAndHover();
    press("c");
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(PIXEL_HEX));
    expect(await screen.findByText("Copied")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "RGB" }));
    await screen.findByText("rgb(150, 50, 100)");
    press("C");
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith("rgb(150, 50, 100)"));

    fireEvent.click(screen.getByRole("button", { name: "OKLCH" }));
    press("c");
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(3));
    expect(writeText.mock.lastCall?.[0]).toMatch(/^oklch\(\d\.\d{3} \d\.\d{3} \d+\.\d\)$/);
  });

  it("the Copy button does what C does", async () => {
    await enterAndHover();
    fireEvent.click(screen.getByRole("button", { name: "Copy color" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(PIXEL_HEX));
  });

  it("Cmd+C keeps its own meaning and copies nothing", async () => {
    await enterAndHover();
    press("c", { metaKey: true });
    press("c", { ctrlKey: true });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("C copies nothing before the pointer is over a pixel", async () => {
    mount(PASTE);
    await loadImage();
    press("i");
    press("c");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("As captured copies the raw bytes and offers only hex and rgb", async () => {
    await enterAndHover();
    expect(await screen.findByText("Out of sRGB")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "OKLCH" }));
    fireEvent.click(screen.getByRole("button", { name: "As captured" }));
    expect(screen.getByRole("button", { name: "HSL" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "OKLCH" })).toBeDisabled();
    // oklch falls back to the rgb form for raw bytes
    await screen.findByText("rgb(1, 2, 3)");
    press("c");
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith("rgb(1, 2, 3)"));
    fireEvent.click(screen.getByRole("button", { name: "HEX" }));
    press("c");
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith("#010203"));
  });

  it("says so when the pixels cannot be read", async () => {
    decodeSrgbBuffer.mockRejectedValue(new Error("no canvas"));
    mount(PASTE);
    await loadImage();
    press("i");
    expect(await screen.findAllByText("Pixel reading unavailable")).not.toHaveLength(0);
    // Inspect stays usable (Esc still leaves) even though nothing can be read
    press("Escape");
    expect(canvasEl()).toHaveAttribute("data-inspect", "false");
  });

  it("entering Inspect does not stop the wheel from reaching the canvas", async () => {
    mount(PASTE);
    await loadImage();
    press("i");
    const wheel = vi.fn();
    canvasEl().addEventListener("wheel", wheel);
    fireEvent.wheel(layer(), { deltaX: 10, deltaY: 40 });
    expect(wheel).toHaveBeenCalledTimes(1);
    if (canvas) await waitFor(() => expect(canvasEl().dataset.panned).toBe("true"));
  });
});
