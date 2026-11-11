import { act, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnnotationLayer } from "./annotation-layer";
import { ANNOTATION_COLORS } from "./tools";
import { handlesFor } from "./handles";
import { useRedactionTile } from "./redaction-preview";
import type { Annotation, BlurAnnotation, BoxAnnotation, ImageAnnotation } from "./scene";
import type { EditorScene } from "./use-editor-scene";
import type { AnnotationToolsController } from "./use-annotation-tools";

// The tile decode needs fetch and a real canvas; the layer tests only care what it is asked
// for and where the returned tile is drawn.
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
    ...overrides,
  };
}

function makeScene(
  annotations: Annotation[],
  selectedId: string | null,
  beautify: { radius?: number; shadow?: number } = {},
): EditorScene {
  return {
    beautify: { state: beautify } as unknown as EditorScene["beautify"],
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

const box: BoxAnnotation = {
  id: "b1",
  kind: "box",
  x: 0.1,
  y: 0.1,
  w: 0.2,
  h: 0.2,
  color: ANNOTATION_COLORS[0].value,
  stroke: 1,
  seed: 1,
};

afterEach(() => {
  // @ts-expect-error — drop the instance-less stubs renderSizedLayer put on the prototype
  delete HTMLElement.prototype.clientWidth;
  // @ts-expect-error — see above
  delete HTMLElement.prototype.clientHeight;
});

describe("AnnotationLayer — canvas-mode redaction", () => {
  const unlocked: Annotation = { id: "u1", kind: "blur", x: 0.1, y: 0.1, w: 0.2, h: 0.2 };
  const locked: Annotation = { ...unlocked, id: "l1", locked: true };

  it("keeps the gaussian filter with the flag off", () => {
    const { container } = render(
      <AnnotationLayer scene={makeScene([unlocked], null)} tools={makeTools()} src="" />,
    );
    expect(container.querySelector("feGaussianBlur")).not.toBeNull();
  });

  it("draws no gaussian in canvas mode and nothing at all for a locked blur", () => {
    const { container } = render(
      <AnnotationLayer
        scene={makeScene([unlocked, locked], null)}
        tools={makeTools()}
        src=""
        canvasMode
      />,
    );
    expect(container.querySelector("feGaussianBlur")).toBeNull();
    expect(container.querySelector('[data-annotation="u1"]')).not.toBeNull();
    expect(container.querySelector('[data-annotation="l1"]')).toBeNull();
  });

  it("does not delete a locked blur on Backspace in canvas mode", () => {
    const scene = makeScene([locked], "l1");
    render(<AnnotationLayer scene={scene} tools={makeTools()} src="" canvasMode />);
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(scene.removeSelected).not.toHaveBeenCalled();
  });
});

describe("AnnotationLayer — keyboard", () => {
  it("deletes the selected annotation on Backspace", () => {
    const scene = makeScene([box], "b1");
    render(<AnnotationLayer scene={scene} tools={makeTools()} src="" />);
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(scene.removeSelected).toHaveBeenCalledTimes(1);
  });

  it("does not delete while typing in a text field", () => {
    const scene = makeScene([box], "b1");
    render(
      <>
        <input data-testid="field" />
        <AnnotationLayer scene={scene} tools={makeTools()} src="" />
      </>,
    );
    fireEvent.keyDown(screen.getByTestId("field"), { key: "Backspace" });
    expect(scene.removeSelected).not.toHaveBeenCalled();
  });

  it("does not delete while a modal is open", () => {
    const scene = makeScene([box], "b1");
    render(
      <>
        <div aria-modal="true" />
        <AnnotationLayer scene={scene} tools={makeTools()} src="" />
      </>,
    );
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(scene.removeSelected).not.toHaveBeenCalled();
  });
});

describe("AnnotationLayer — text tool", () => {
  function openTextInput(scene: EditorScene): HTMLElement {
    const { container } = render(
      <AnnotationLayer scene={scene} tools={makeTools({ tool: "text" })} src="" />,
    );
    fireEvent.pointerDown(container.firstChild as HTMLElement, { clientX: 10, clientY: 10 });
    return screen.getByPlaceholderText("Type…");
  }

  it("commits the text exactly once on Enter (no duplicate)", () => {
    const scene = makeScene([], null);
    const input = openTextInput(scene);
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(scene.addAnnotation).toHaveBeenCalledTimes(1);
  });

  it("does not commit on Escape (cancel)", () => {
    const scene = makeScene([], null);
    const input = openTextInput(scene);
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(scene.addAnnotation).not.toHaveBeenCalled();
  });

  it("Alt+Enter does not commit — it inserts a newline (spreadsheet/Excalidraw)", () => {
    const scene = makeScene([], null);
    const input = openTextInput(scene);
    fireEvent.change(input, { target: { value: "line 1" } });
    fireEvent.keyDown(input, { key: "Enter", altKey: true });
    expect(scene.addAnnotation).not.toHaveBeenCalled();
  });

  it("Shift+Enter does not commit either (also a newline)", () => {
    const scene = makeScene([], null);
    const input = openTextInput(scene);
    fireEvent.change(input, { target: { value: "line 1" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(scene.addAnnotation).not.toHaveBeenCalled();
  });

  it("commits multi-line text with its newline preserved", () => {
    const scene = makeScene([], null);
    const input = openTextInput(scene);
    fireEvent.change(input, { target: { value: "line 1\nline 2" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(scene.addAnnotation).toHaveBeenCalledTimes(1);
    expect((scene.addAnnotation as ReturnType<typeof vi.fn>).mock.calls[0][0].text).toBe(
      "line 1\nline 2",
    );
  });

  // Give the layer a real box so toNorm maps client coords to normalized space and
  // the geometric hit-test can find a label (jsdom reports 0×0 otherwise).
  function renderSizedLayer(scene: EditorScene, tools: AnnotationToolsController) {
    // The layer measures itself from clientWidth/clientHeight on mount (jsdom: 0×0),
    // which would make every px-based derivation (handle tolerance, shape transforms)
    // degenerate. Restored in afterEach.
    for (const prop of ["clientWidth", "clientHeight"]) {
      Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => 100 });
    }
    const utils = render(<AnnotationLayer scene={scene} tools={tools} src="" />);
    const layer = utils.container.firstChild as HTMLElement;
    layer.setPointerCapture = vi.fn();
    layer.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
      }) as DOMRect;
    return { ...utils, layer };
  }

  const label: Annotation = {
    id: "t1",
    kind: "text",
    x: 0.3,
    y: 0.3,
    text: "Hello",
    color: ANNOTATION_COLORS[0].value,
    size: 1,
  };

  it("double-clicking a label re-opens it prefilled and updates it in place", () => {
    const scene = makeScene([label], "t1");
    const { layer } = renderSizedLayer(scene, makeTools({ tool: "select" }));
    fireEvent.doubleClick(layer, { clientX: 30, clientY: 30 });
    const input = screen.getByDisplayValue("Hello"); // prefilled with the current text
    fireEvent.change(input, { target: { value: "Hello world" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(scene.commitAnnotation).toHaveBeenCalledWith("t1", { text: "Hello world" });
    expect(scene.addAnnotation).not.toHaveBeenCalled(); // updates, never duplicates
  });

  it("clearing the text while re-editing deletes the label", () => {
    const scene = makeScene([label], "t1");
    const { layer } = renderSizedLayer(scene, makeTools({ tool: "select" }));
    fireEvent.doubleClick(layer, { clientX: 30, clientY: 30 });
    const input = screen.getByDisplayValue("Hello");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(scene.removeAnnotation).toHaveBeenCalledWith("t1");
    expect(scene.removeSelected).not.toHaveBeenCalled();
    expect(scene.commitAnnotation).not.toHaveBeenCalled();
  });

  it("clearing a label and then grabbing another shape deletes the label, not the shape (SHOT-B5)", async () => {
    const farBox: BoxAnnotation = { ...box, x: 0.7, y: 0.7, w: 0.2, h: 0.2 };
    const scene = makeScene([label, farBox], "t1");
    const { layer } = renderSizedLayer(scene, makeTools({ tool: "select" }));
    fireEvent.doubleClick(layer, { clientX: 30, clientY: 30 });
    const input = screen.getByDisplayValue("Hello");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.pointerDown(layer, { clientX: 80, clientY: 80 }); // the far box
    // Blur-to-commit only arms after one frame.
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    fireEvent.blur(input);
    expect(scene.removeAnnotation).toHaveBeenCalledWith("t1");
    expect(scene.removeSelected).not.toHaveBeenCalled();
  });

  it("shows the resize handles for a selected label that is not being edited", () => {
    const scene = makeScene([label], "t1");
    const { container } = renderSizedLayer(scene, makeTools({ tool: "select" }));
    expect(container.querySelectorAll('[data-testid="resize-handle"]').length).toBeGreaterThan(0);
  });

  it("hides the resize handles while the label is being edited", () => {
    // The handles are drawn from the label's STORED geometry, which stops matching
    // what the user is typing the moment they type it — a box that visibly deforms
    // around the inline editor. Resizing is impossible mid-edit anyway.
    const scene = makeScene([label], "t1");
    const { container, layer } = renderSizedLayer(scene, makeTools({ tool: "select" }));
    fireEvent.doubleClick(layer, { clientX: 30, clientY: 30 });
    screen.getByDisplayValue("Hello"); // the inline editor is open
    expect(container.querySelectorAll('[data-testid="resize-handle"]')).toHaveLength(0);
  });

  it("does not resize from a hidden handle while the label is being edited", () => {
    // The handles are gone, so their geometry must not be hit-tested either —
    // otherwise a corner the user cannot see still grabs and rescales the font.
    const scene = makeScene([label], "t1");
    const { layer } = renderSizedLayer(scene, makeTools({ tool: "select" }));
    fireEvent.doubleClick(layer, { clientX: 30, clientY: 30 });
    const handle = handlesFor(label, { w: 100, h: 100 })[0];
    fireEvent.pointerDown(layer, { clientX: handle.x * 100, clientY: handle.y * 100 });
    fireEvent.pointerMove(layer, { clientX: handle.x * 100 + 20, clientY: handle.y * 100 + 20 });
    fireEvent.pointerUp(layer);
    // A resize of a text label rescales its font; nothing may do that mid-edit.
    expect(scene.commitAnnotation).not.toHaveBeenCalled();
  });

  it("does not drag the label out from under its own inline editor", () => {
    // The hit-test keeps an 8px margin around the label and the textarea covers only
    // the box, so a press in that ring reaches the layer. It must not grab the label
    // the user is typing into.
    const scene = makeScene([label], "t1");
    const { layer } = renderSizedLayer(scene, makeTools({ tool: "select" }));
    fireEvent.doubleClick(layer, { clientX: 30, clientY: 30 });
    fireEvent.pointerDown(layer, { clientX: 31, clientY: 31 });
    fireEvent.pointerMove(layer, { clientX: 45, clientY: 45 });
    fireEvent.pointerUp(layer);
    expect(scene.commitAnnotation).not.toHaveBeenCalled();
  });

  it("still lets another shape be grabbed while a label is being edited", () => {
    // Only the edited label is off limits; the rest of the canvas keeps working.
    // The box sits well clear of the label so each click lands on one of them.
    const farBox: BoxAnnotation = { ...box, x: 0.05, y: 0.05, w: 0.1, h: 0.1 };
    const scene = makeScene([label, farBox], "t1");
    const { layer } = renderSizedLayer(scene, makeTools({ tool: "select" }));
    fireEvent.doubleClick(layer, { clientX: 30, clientY: 30 });
    screen.getByDisplayValue("Hello"); // the label's editor is open
    fireEvent.pointerDown(layer, { clientX: 10, clientY: 10 }); // inside the box
    fireEvent.pointerMove(layer, { clientX: 20, clientY: 20 });
    fireEvent.pointerUp(layer);
    expect(scene.select).toHaveBeenCalledWith("b1");
    expect(scene.commitAnnotation).toHaveBeenCalledWith("b1", expect.any(Object));
  });

  // A box big enough that its centre is outside every handle's 12px hit tolerance.
  const bigBox: BoxAnnotation = { ...box, w: 0.6, h: 0.6 };

  it("commits a move once on release with the final geometry", () => {
    const scene = makeScene([bigBox], "b1"); // bigBox at 0.1,0.1, clear of every handle
    const { layer } = renderSizedLayer(scene, makeTools({ tool: "select" }));
    fireEvent.pointerDown(layer, { clientX: 40, clientY: 40 });
    fireEvent.pointerMove(layer, { clientX: 50, clientY: 50 });
    fireEvent.pointerMove(layer, { clientX: 50, clientY: 50 });
    expect(scene.commitAnnotation).not.toHaveBeenCalled();
    fireEvent.pointerUp(layer);
    expect(scene.commitAnnotation).toHaveBeenCalledTimes(1);
    expect(scene.commitAnnotation).toHaveBeenCalledWith(
      "b1",
      expect.objectContaining({ x: expect.closeTo(0.2, 5), y: expect.closeTo(0.2, 5) }),
    );
    expect(scene.beginInteract).not.toHaveBeenCalled();
  });

  it("a click without movement commits nothing", () => {
    const scene = makeScene([bigBox], "b1");
    const { layer } = renderSizedLayer(scene, makeTools({ tool: "select" }));
    fireEvent.pointerDown(layer, { clientX: 40, clientY: 40 });
    fireEvent.pointerUp(layer);
    expect(scene.commitAnnotation).not.toHaveBeenCalled();
  });

  it("the dragged shape moves in the DOM before any commit", () => {
    const scene = makeScene([bigBox], "b1");
    const { layer, container } = renderSizedLayer(scene, makeTools({ tool: "select" }));
    const group = (): string | null | undefined =>
      container.querySelector("g[data-annotation='b1']")?.getAttribute("transform");
    const before = group();
    expect(before).toBeTruthy();
    fireEvent.pointerDown(layer, { clientX: 40, clientY: 40 });
    fireEvent.pointerMove(layer, { clientX: 60, clientY: 60 });
    expect(group()).not.toBe(before);
    expect(scene.commitAnnotation).not.toHaveBeenCalled();
  });

  it("commits a resize once on release", () => {
    const scene = makeScene([box], "b1");
    const { layer } = renderSizedLayer(scene, makeTools({ tool: "select" }));
    const handle = handlesFor(box, { w: 100, h: 100 })[0];
    fireEvent.pointerDown(layer, { clientX: handle.x * 100, clientY: handle.y * 100 });
    fireEvent.pointerMove(layer, { clientX: handle.x * 100 + 5, clientY: handle.y * 100 + 5 });
    fireEvent.pointerMove(layer, { clientX: handle.x * 100 + 10, clientY: handle.y * 100 + 10 });
    expect(scene.commitAnnotation).not.toHaveBeenCalled();
    fireEvent.pointerUp(layer);
    expect(scene.commitAnnotation).toHaveBeenCalledTimes(1);
    expect(scene.beginInteract).not.toHaveBeenCalled();
  });

  it("auto-selects after committing text (switches to the select tool)", () => {
    const scene = makeScene([], null);
    const tools = makeTools({ tool: "text" });
    const { container } = render(<AnnotationLayer scene={scene} tools={tools} src="" />);
    fireEvent.pointerDown(container.firstChild as HTMLElement, { clientX: 10, clientY: 10 });
    const input = screen.getByPlaceholderText("Type…");
    fireEvent.change(input, { target: { value: "hi" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(tools.setTool).toHaveBeenCalledWith("select");
    expect(scene.select).toHaveBeenCalled();
  });
});

describe("AnnotationLayer — pen tool", () => {
  it("commits one path on a down → move → up freehand stroke", () => {
    const scene = makeScene([], null);
    const addAnnotation = scene.addAnnotation as ReturnType<typeof vi.fn>;
    const { container } = render(
      <AnnotationLayer scene={scene} tools={makeTools({ tool: "pen" })} src="" />,
    );
    const layer = container.firstChild as HTMLElement;
    fireEvent.pointerDown(layer, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(layer, { clientX: 20, clientY: 30 });
    fireEvent.pointerMove(layer, { clientX: 40, clientY: 50 });
    fireEvent.pointerUp(layer);
    expect(addAnnotation).toHaveBeenCalledTimes(1);
    expect(addAnnotation.mock.calls[0][0].kind).toBe("path");
  });
});

describe("AnnotationLayer — canvas mode (NIW2-698)", () => {
  // The layer measures the SHOT (100×100 here); the canvas is bigger, so a press can land
  // outside it. The hit surface carries such a press to the layer's handler.
  function renderCanvasLayer(scene: EditorScene, tools: AnnotationToolsController, canvas = true) {
    for (const prop of ["clientWidth", "clientHeight"]) {
      Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => 100 });
    }
    const utils = render(<AnnotationLayer scene={scene} tools={tools} src="" canvas={canvas} />);
    const layer = utils.container.firstChild as HTMLElement;
    layer.setPointerCapture = vi.fn();
    layer.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
      }) as DOMRect;
    return { ...utils, layer };
  }

  it("renders an invisible hit surface only in canvas mode", () => {
    const on = renderCanvasLayer(makeScene([], null), makeTools());
    expect(screen.queryByTestId("canvas-hit-surface")).not.toBeNull();
    on.unmount();
    renderCanvasLayer(makeScene([], null), makeTools(), false);
    expect(screen.queryByTestId("canvas-hit-surface")).toBeNull();
  });

  it("a press outside the shot (on the hit surface) draws a box with coordinates outside 0–1", () => {
    const scene = makeScene([], null);
    const tools = makeTools({ tool: "box" });
    renderCanvasLayer(scene, tools);
    const surface = screen.getByTestId("canvas-hit-surface");
    surface.setPointerCapture = vi.fn();
    // Shot is 100×100 at (0,0): from (-50,-40) to (-10,-5) is entirely left/above it.
    fireEvent.pointerDown(surface, { clientX: -50, clientY: -40 });
    fireEvent.pointerMove(surface, { clientX: -10, clientY: -5 });
    fireEvent.pointerUp(surface);
    expect(scene.addAnnotation).toHaveBeenCalledTimes(1);
    const added = (scene.addAnnotation as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as BoxAnnotation;
    expect(added.kind).toBe("box");
    expect(added.x).toBeCloseTo(-0.5);
    expect(added.y).toBeCloseTo(-0.4);
    expect(added.w).toBeCloseTo(0.4);
    expect(added.h).toBeCloseTo(0.35);
  });

  it("text can be placed and committed outside the shot", () => {
    const scene = makeScene([], null);
    renderCanvasLayer(scene, makeTools({ tool: "text" }));
    fireEvent.pointerDown(screen.getByTestId("canvas-hit-surface"), { clientX: 160, clientY: 130 });
    const input = screen.getByPlaceholderText("Type…");
    fireEvent.change(input, { target: { value: "outside" } });
    fireEvent.keyDown(input, { key: "Enter" });
    const added = (scene.addAnnotation as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(added).toMatchObject({ kind: "text", text: "outside" });
    expect(added.x).toBeCloseTo(1.6);
    expect(added.y).toBeCloseTo(1.3);
  });

  it("a placed label outside the shot can be re-opened for editing", () => {
    const out: Annotation = {
      id: "t9",
      kind: "text",
      x: 1.6,
      y: 1.3,
      text: "Far",
      color: ANNOTATION_COLORS[0].value,
      size: 1,
    };
    const scene = makeScene([out], "t9");
    const { layer } = renderCanvasLayer(scene, makeTools({ tool: "select" }));
    fireEvent.doubleClick(layer, { clientX: 162, clientY: 132 });
    const input = screen.getByDisplayValue("Far");
    fireEvent.change(input, { target: { value: "Farther" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(scene.commitAnnotation).toHaveBeenCalledWith("t9", { text: "Farther" });
  });

  it("a shape can be moved from inside the shot to outside it", () => {
    // Not selected: a selected box's corner handles would take the press (they are within
    // 12 px of its centre at this size) and resize instead of move.
    const scene = makeScene([box], null);
    const { layer } = renderCanvasLayer(scene, makeTools({ tool: "select" }));
    fireEvent.pointerDown(layer, { clientX: 20, clientY: 20 }); // on the box
    fireEvent.pointerMove(layer, { clientX: 220, clientY: 20 });
    fireEvent.pointerUp(layer);
    const [, patch] = (scene.commitAnnotation as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(patch.x).toBeCloseTo(0.1 + 2);
  });

  it("the crop tool's presses outside the frame do not draw anything", () => {
    const scene = makeScene([], null);
    renderCanvasLayer(scene, makeTools({ tool: "crop" }));
    const surface = screen.getByTestId("canvas-hit-surface");
    fireEvent.pointerDown(surface, { clientX: -50, clientY: -40 });
    fireEvent.pointerMove(surface, { clientX: -10, clientY: -5 });
    fireEvent.pointerUp(surface);
    expect(scene.addAnnotation).not.toHaveBeenCalled();
  });
});

describe("AnnotationLayer — added images (NIW2-703)", () => {
  const image: ImageAnnotation = {
    id: "i1",
    kind: "image",
    assetId: "img-aaaaaaaaaaaa",
    x: 0.5,
    y: 0.25,
    w: 0.4,
    h: 0.3,
    pixelWidth: 40,
    pixelHeight: 30,
  };
  const urls = { "img-aaaaaaaaaaaa": "blob:added" };

  function renderImageLayer(
    scene: EditorScene,
    tools: AnnotationToolsController,
    props: Partial<React.ComponentProps<typeof AnnotationLayer>> = {},
  ) {
    for (const prop of ["clientWidth", "clientHeight"]) {
      Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => 100 });
    }
    const utils = render(
      <AnnotationLayer scene={scene} tools={tools} src="" canvas imageUrls={urls} {...props} />,
    );
    const layer = utils.container.firstChild as HTMLElement;
    layer.setPointerCapture = vi.fn();
    layer.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
      }) as DOMRect;
    return { ...utils, layer };
  }

  const imageEl = (c: HTMLElement): Element | null =>
    c.querySelector('[data-testid="canvas-image"]');

  it("draws the asset at its normalized rect, in display px", () => {
    const { container } = renderImageLayer(makeScene([image], null), makeTools());
    const el = imageEl(container)!;
    expect(el.getAttribute("href")).toBe("blob:added");
    expect(el.getAttribute("x")).toBe("50");
    expect(el.getAttribute("y")).toBe("25");
    expect(el.getAttribute("width")).toBe("40");
    expect(el.getAttribute("height")).toBe("30");
    expect(el.getAttribute("preserveAspectRatio")).toBe("none");
    expect(container.querySelector('[data-annotation="i1"]')).not.toBeNull();
  });

  it("draws nothing when the editor has no URL for the asset", () => {
    const { container } = renderImageLayer(makeScene([image], "i1"), makeTools(), {
      imageUrls: {},
    });
    expect(imageEl(container)).toBeNull();
    expect(container.querySelector('[data-annotation="i1"]')).toBeNull();
  });

  it("clips to the beautify radius and drops the beautify shadow behind it", () => {
    const { container } = renderImageLayer(
      makeScene([image], null, { radius: 12, shadow: 40 }),
      makeTools(),
    );
    expect(container.querySelector("clipPath rect")?.getAttribute("rx")).toBe("12");
    const drop = container.querySelector("feDropShadow")!;
    expect(drop.getAttribute("dy")).toBe("18"); // round(40 * 0.45), as the base's box-shadow
    expect(drop.getAttribute("stdDeviation")).toBe("22"); // round(40 * 0.9 + 8) / 2
    expect(drop.getAttribute("flood-opacity")).toBe("0.32");
  });

  it("draws no shadow when the beautify shadow is 0", () => {
    const { container } = renderImageLayer(makeScene([image], null), makeTools());
    expect(container.querySelector("feDropShadow")).toBeNull();
  });

  it("outlines it when selected, without resize handles", () => {
    const { container } = renderImageLayer(makeScene([image], "i1"), makeTools());
    expect(container.querySelector("rect[class*='selOutline']")).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="resize-handle"]')).toHaveLength(0);
  });

  it("a click on it selects it, and a drag commits a moved x/y", () => {
    const scene = makeScene([image], null);
    const { layer } = renderImageLayer(scene, makeTools({ tool: "select" }));
    fireEvent.pointerDown(layer, { clientX: 70, clientY: 40 });
    expect(scene.select).toHaveBeenCalledWith("i1");
    fireEvent.pointerMove(layer, { clientX: 80, clientY: 60 });
    fireEvent.pointerUp(layer);
    expect(scene.commitAnnotation).toHaveBeenCalledTimes(1);
    const [id, patch] = (scene.commitAnnotation as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(id).toBe("i1");
    expect(patch.x).toBeCloseTo(0.6);
    expect(patch.y).toBeCloseTo(0.45);
    expect(patch.w).toBeUndefined(); // it moves, it does not resize
  });

  it("moves in the DOM before the commit", () => {
    const scene = makeScene([image], null);
    const { layer, container } = renderImageLayer(scene, makeTools({ tool: "select" }));
    fireEvent.pointerDown(layer, { clientX: 70, clientY: 40 });
    fireEvent.pointerMove(layer, { clientX: 80, clientY: 40 });
    expect(Number(imageEl(container)!.getAttribute("x"))).toBeCloseTo(60);
    expect(scene.commitAnnotation).not.toHaveBeenCalled();
  });

  it("the whole rect is hittable, and the later item in z-order takes the click", () => {
    const over: BoxAnnotation = { ...box, id: "b2", x: 0.55, y: 0.3, w: 0.2, h: 0.2 };
    const scene = makeScene([image, over], null);
    const { layer } = renderImageLayer(scene, makeTools({ tool: "select" }));
    fireEvent.pointerDown(layer, { clientX: 89, clientY: 54 }); // far corner, image only
    expect(scene.select).toHaveBeenLastCalledWith("i1");
    fireEvent.pointerUp(layer);
    fireEvent.pointerDown(layer, { clientX: 65, clientY: 40 }); // inside the box above it
    expect(scene.select).toHaveBeenLastCalledWith("b2");
  });

  it("Delete removes the selected image", () => {
    const scene = makeScene([image], "i1");
    renderImageLayer(scene, makeTools());
    fireEvent.keyDown(window, { key: "Delete" });
    expect(scene.removeSelected).toHaveBeenCalledTimes(1);
  });

  it("the box tool still draws over an image", () => {
    const scene = makeScene([image], null);
    const { layer } = renderImageLayer(scene, makeTools({ tool: "box" }));
    fireEvent.pointerDown(layer, { clientX: 60, clientY: 30 });
    fireEvent.pointerMove(layer, { clientX: 80, clientY: 50 });
    fireEvent.pointerUp(layer);
    expect(scene.addAnnotation).toHaveBeenCalledTimes(1);
    expect(scene.select).not.toHaveBeenCalledWith("i1");
  });

  describe("redaction over an added image", () => {
    const blur: BlurAnnotation = { id: "u1", kind: "blur", x: 0.6, y: 0.3, w: 0.2, h: 0.15 };
    const tileMock = useRedactionTile as unknown as ReturnType<typeof vi.fn>;

    afterEach(() => tileMock.mockReset().mockImplementation(() => null));

    it("draws a tile computed from the image's URL in its local coordinates", () => {
      tileMock.mockImplementation((url: string) =>
        url === "blob:added"
          ? { url: "data:tile", rect: { x: 5, y: 6, w: 20, h: 15 }, naturalW: 40, naturalH: 30 }
          : null,
      );
      const { container } = renderImageLayer(makeScene([image, blur], null), makeTools(), {
        canvasMode: true,
      });
      const call = tileMock.mock.calls.find((c) => c[0] === "blob:added")!;
      expect(call[1].x).toBeCloseTo((0.6 - 0.5) / 0.4);
      expect(call[1].y).toBeCloseTo((0.3 - 0.25) / 0.3);
      expect(call[1].w).toBeCloseTo(0.2 / 0.4);
      expect(call[1].h).toBeCloseTo(0.15 / 0.3);
      expect(call[2]).toBe("blur");
      expect(call[3]).toBe(true);
      const tile = container.querySelector('[data-testid="image-redaction-tile"]')!;
      expect(tile.getAttribute("href")).toBe("data:tile");
      // The tile's px inside the image, scaled to the image's 40×30 display rect.
      expect(tile.getAttribute("x")).toBe("55");
      expect(tile.getAttribute("y")).toBe("31");
      expect(tile.getAttribute("width")).toBe("20");
      expect(tile.getAttribute("height")).toBe("15");
      // Inside the image's clip, so it follows the rounded corners.
      expect(tile.parentElement?.getAttribute("clip-path")).toMatch(/^url\(#iclip-i1\)$/);
    });

    it("passes the solid style through", () => {
      renderImageLayer(makeScene([image, { ...blur, style: "solid" }], null), makeTools(), {
        canvasMode: true,
      });
      expect(tileMock.mock.calls.some((c) => c[0] === "blob:added" && c[2] === "solid")).toBe(true);
    });

    it("skips a locked blur, a blur that misses the image, and the flag-off layer", () => {
      const miss: BlurAnnotation = { ...blur, id: "u2", x: 0, y: 0, w: 0.2, h: 0.2 };
      renderImageLayer(makeScene([image, { ...blur, locked: true }, miss], null), makeTools(), {
        canvasMode: true,
      });
      expect(tileMock.mock.calls.some((c) => c[0] === "blob:added")).toBe(false);
      tileMock.mockClear();
      renderImageLayer(makeScene([image, blur], null), makeTools());
      expect(tileMock.mock.calls.some((c) => c[0] === "blob:added")).toBe(false);
    });
  });
});
