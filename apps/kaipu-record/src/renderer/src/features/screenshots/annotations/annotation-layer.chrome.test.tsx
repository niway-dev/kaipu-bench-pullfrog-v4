import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnnotationLayer } from "./annotation-layer";
import { ANNOTATION_COLORS } from "./tools";
import type { Annotation, ImageAnnotation } from "./scene";
import type { EditorScene } from "./use-editor-scene";
import type { AnnotationToolsController } from "./use-annotation-tools";

// Canvas chrome of the annotation layer (NIW2-711, mock A4 and the live report behind A3).
vi.mock("./redaction-preview", () => ({ useRedactionTile: vi.fn(() => null) }));

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

function makeScene(annotations: Annotation[], selectedId: string | null): EditorScene {
  return {
    beautify: { state: {} } as unknown as EditorScene["beautify"],
    annotations,
    selectedId,
    select: vi.fn(),
    addAnnotation: vi.fn(),
    commitAnnotation: vi.fn(),
    beginInteract: vi.fn(),
    endInteract: vi.fn(),
    removeAnnotation: vi.fn(),
    removeSelected: vi.fn(),
    crop: undefined,
    setCrop: vi.fn(),
    setExportFrame: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
  };
}

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
  Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
});

/** A 100 px layer standing for a 100 px base image: 1 layer px = 1 source px. */
function renderLayer(
  scene: EditorScene,
  tools: AnnotationToolsController,
  props: Partial<React.ComponentProps<typeof AnnotationLayer>> = {},
) {
  for (const prop of ["clientWidth", "clientHeight"]) {
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => 100 });
  }
  const utils = render(
    <AnnotationLayer
      scene={scene}
      tools={tools}
      src=""
      canvas
      canvasMode
      natural={{ w: 100, h: 100 }}
      imageUrls={{ a: "blob:a", b: "blob:b" }}
      {...props}
    />,
  );
  const layer = utils.container.firstChild as HTMLElement;
  layer.setPointerCapture = vi.fn();
  layer.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 }) as DOMRect;
  return { ...utils, layer };
}

const image = (id: string, assetId: string, x: number, y = 0.25): ImageAnnotation => ({
  id,
  kind: "image",
  assetId,
  x,
  y,
  w: 0.4,
  h: 0.3,
  pixelWidth: 40,
  pixelHeight: 30,
});

describe("AnnotationLayer — selected added image (mock A4)", () => {
  it("wears the frame, eight handles and the tag with the image's pixel size", () => {
    renderLayer(makeScene([image("i1", "a", 0.5)], "i1"), makeTools());
    const chrome = screen.getByTestId("image-selection");
    // Layer px: the image sits at (50, 25) and is 40 x 30.
    expect(chrome).toHaveStyle({ left: "50px", top: "25px", width: "40px", height: "30px" });
    expect(screen.getAllByTestId("image-handle")).toHaveLength(8);
    expect(screen.getByTestId("image-tag")).toHaveTextContent("Drag to move");
    expect(screen.getByTestId("image-tag")).toHaveTextContent("40 × 30 px");
    // The accent frame is the image's own outline, on the image's exact rect.
    const frame = document.querySelector("rect[class*='selOutline']")!;
    expect(frame.getAttribute("x")).toBe("50");
    expect(frame.getAttribute("width")).toBe("40");
    // The layer's own SVG handles are not drawn for an image: these are the chrome's.
    expect(screen.queryAllByTestId("resize-handle")).toHaveLength(0);
  });

  it("is absent when nothing is selected, and when another tool is active", () => {
    const { unmount } = renderLayer(makeScene([image("i1", "a", 0.5)], null), makeTools());
    expect(screen.queryByTestId("image-selection")).toBeNull();
    unmount();
    renderLayer(makeScene([image("i1", "a", 0.5)], "i1"), makeTools({ tool: "box" }));
    expect(screen.queryByTestId("image-selection")).toBeNull();
  });

  it("measures the gap to the nearest image in source px, on a dashed line", () => {
    // i1 spans x 120..160: 20 px right of the base (0..100). A farther image at 300 is ignored.
    renderLayer(makeScene([image("i1", "a", 1.2), image("i2", "b", 3)], "i1"), makeTools());
    const gaps = screen.getAllByTestId("image-gap");
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toHaveAttribute("data-axis", "x");
    expect(screen.getByTestId("image-gap-label")).toHaveTextContent("20 px");
    // From the base's right edge (100) across the gap, at the middle of the shared height.
    expect(gaps[0]).toHaveStyle({ left: "100px", width: "20px" });
  });

  it("shows no gap when the image overlaps its neighbour", () => {
    renderLayer(makeScene([image("i1", "a", 0.5)], "i1"), makeTools());
    expect(screen.queryByTestId("image-gap")).toBeNull();
  });

  it("shows no gap measure without the base's size", () => {
    renderLayer(makeScene([image("i1", "a", 1.2)], "i1"), makeTools(), { natural: undefined });
    expect(screen.queryByTestId("image-gap")).toBeNull();
  });
});

describe("AnnotationLayer — reports what is on screen while a drag is in flight", () => {
  it("reports the draft while drawing, and null once it is released", () => {
    const onLive = vi.fn();
    const { layer } = renderLayer(makeScene([], null), makeTools({ tool: "box" }), { onLive });
    onLive.mockClear();
    fireEvent.pointerDown(layer, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(layer, { clientX: 60, clientY: 60, pointerId: 1 });
    const drawing = onLive.mock.calls.at(-1)![0] as Annotation[];
    expect(drawing).toHaveLength(1);
    expect(drawing[0]).toMatchObject({ kind: "box" });
    fireEvent.pointerUp(layer, { pointerId: 1 });
    expect(onLive.mock.calls.at(-1)![0]).toBeNull();
  });

  it("reports the stored shapes with the move applied while one is dragged", () => {
    const onLive = vi.fn();
    const { layer } = renderLayer(makeScene([image("i1", "a", 0.5)], "i1"), makeTools(), {
      onLive,
    });
    fireEvent.pointerDown(layer, { button: 0, clientX: 70, clientY: 40, pointerId: 1 });
    fireEvent.pointerMove(layer, { clientX: 170, clientY: 40, pointerId: 1 });
    const moving = onLive.mock.calls.at(-1)![0] as ImageAnnotation[];
    expect(moving[0].x).toBeCloseTo(1.5);
    fireEvent.pointerUp(layer, { pointerId: 1 });
    expect(onLive.mock.calls.at(-1)![0]).toBeNull();
  });
});
