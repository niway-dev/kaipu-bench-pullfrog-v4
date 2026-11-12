import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RecognizedWord } from "@kaipu/domain/schemas";
import { AnnotationLayer } from "./annotation-layer";
import { ANNOTATION_COLORS } from "./tools";
import type { EditorScene } from "./use-editor-scene";
import type { AnnotationToolsController } from "./use-annotation-tools";
import type { TextLayerModel } from "../text-selection";

vi.mock("./redaction-preview", () => ({ useRedactionTile: vi.fn(() => null) }));

const tools = (tool: AnnotationToolsController["tool"]): AnnotationToolsController => ({
  tool,
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
});

const scene = {
  beautify: { state: {} },
  annotations: [],
  selectedId: null,
  select: vi.fn(),
} as unknown as EditorScene;

const word = (text: string, line: number, x: number, y: number): RecognizedWord => ({
  text,
  line,
  rect: { x, y, w: 80, h: 20 },
  confidence: 1,
});

// A 400x400 image shown at 100x100. Line 0 holds two words, line 1 one word.
const WORDS = [word("a", 0, 40, 40), word("b", 0, 200, 40), word("c", 1, 40, 200)];

function mount(tool: AnnotationToolsController["tool"] = "selectText") {
  for (const prop of ["clientWidth", "clientHeight"]) {
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => 100 });
  }
  const model: TextLayerModel = {
    words: WORDS,
    natural: { w: 400, h: 400 },
    selected: new Set(),
    select: vi.fn(),
    clear: vi.fn(),
  };
  const utils = render(
    <AnnotationLayer scene={scene} tools={tools(tool)} src="" text={model} />,
  );
  const layer = utils.container.firstChild as HTMLElement;
  layer.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 }) as DOMRect;
  return { ...utils, layer };
}

describe("AnnotationLayer — recognized text hover (mock G2)", () => {
  it("underlines every recognized line, one per line", () => {
    const { container } = mount();
    expect(container.querySelectorAll('[data-testid="text-line-underline"]')).toHaveLength(2);
  });

  it("draws no underline when the tool is not Select text", () => {
    const { container } = mount("select");
    expect(container.querySelector('[data-testid="text-lines"]')).toBeNull();
  });

  it("fills the line under the pointer and tags it; leaving clears both", () => {
    const { container, layer } = mount();
    expect(container.querySelector('[data-hover]')).toBeNull();
    expect(container.querySelector('[data-testid="text-line-tag"]')).toBeNull();
    // Line 0 spans display x 10-70, y 10-15; the pointer is on its word "a".
    fireEvent.pointerMove(layer, { clientX: 15, clientY: 12, pointerId: 1 });
    const boxes = container.querySelectorAll('[data-testid="text-line-box"]');
    expect(boxes[0].hasAttribute("data-hover")).toBe(true);
    expect(boxes[1].hasAttribute("data-hover")).toBe(false);
    expect(container.querySelector('[data-testid="text-line-tag"]')).not.toBeNull();
    fireEvent.pointerLeave(layer);
    expect(container.querySelector('[data-hover]')).toBeNull();
    expect(container.querySelector('[data-testid="text-line-tag"]')).toBeNull();
  });
});
