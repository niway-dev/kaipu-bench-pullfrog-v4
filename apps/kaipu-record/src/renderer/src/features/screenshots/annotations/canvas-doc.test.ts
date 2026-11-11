import { describe, expect, it } from "vitest";
import { buildCanvasDoc, parseCanvasDoc } from "./canvas-doc";
import type { Annotation, Scene } from "./scene";

const annotations: Annotation[] = [
  { id: "a1", kind: "box", x: 0.1, y: 0.1, w: 0.2, h: 0.2, color: "#f00", stroke: 2, seed: 5 },
  { id: "a2", kind: "arrow", x1: -0.2, y1: 0, x2: 1.4, y2: 0.5, color: "#0f0", stroke: 1, seed: 6 },
  {
    id: "a3",
    kind: "text",
    x: 0.3,
    y: 0.3,
    text: "hi",
    color: "#00f",
    size: 1,
    width: 0.2,
    fontPx: 20,
  },
  {
    id: "a4",
    kind: "path",
    points: [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
    ],
    color: "#fff",
    stroke: 2,
  },
  { id: "a5", kind: "blur", x: 0.5, y: 0.5, w: 0.1, h: 0.1 },
  { id: "a6", kind: "blur", x: 0.6, y: 0.6, w: 0.1, h: 0.1, style: "solid" },
  { id: "a7", kind: "step", x: 0.7, y: 0.2, color: "#f00", size: 2 },
];
const scene: Scene = {
  beautify: { bg: "ocean", padding: 24, radius: 8, shadow: 30 },
  annotations,
  exportFrame: { x: -0.1, y: -0.1, w: 1.2, h: 1.2 },
};
const base = { pixelWidth: 800, pixelHeight: 600 };

function docWith(patch: (d: any) => void): string {
  const d = JSON.parse(JSON.stringify(buildCanvasDoc(scene, base)));
  patch(d);
  return JSON.stringify(d);
}

describe("canvas document", () => {
  it("round-trips build -> JSON -> parse with redactions locked", () => {
    const parsed = parseCanvasDoc(JSON.stringify(buildCanvasDoc(scene, base)));
    expect(parsed).not.toBeNull();
    expect(parsed!.base).toMatchObject({ assetId: "base", x: 0, y: 0, w: 800, h: 600 });
    expect(parsed!.scene.crop).toBeUndefined();
    expect(parsed!.scene.beautify).toEqual(scene.beautify);
    expect(parsed!.scene.exportFrame).toEqual(scene.exportFrame);
    expect(parsed!.scene.annotations).toEqual(
      annotations.map((a) => (a.kind === "blur" ? { ...a, locked: true } : a)),
    );
  });

  it("returns null for corrupt JSON", () => {
    expect(parseCanvasDoc("{not json")).toBeNull();
    expect(parseCanvasDoc("42")).toBeNull();
  });
  it("returns null for a newer schema version", () => {
    expect(parseCanvasDoc(docWith((d) => (d.schemaVersion = 2)))).toBeNull();
  });
  it("returns null for an unknown annotation kind", () => {
    expect(parseCanvasDoc(docWith((d) => d.items.push({ id: "z", kind: "star" })))).toBeNull();
  });
  it("returns null for a bad asset id", () => {
    expect(parseCanvasDoc(docWith((d) => (d.items[0].assetId = "../x")))).toBeNull();
    // `__proto__` would not be an own key of the asset map.
    expect(parseCanvasDoc(docWith((d) => (d.items[0].assetId = "__proto__")))).toBeNull();
  });
  it("returns null for a non-finite or wrong-typed field", () => {
    // JSON has no NaN: a null coordinate is what NaN serializes to.
    expect(parseCanvasDoc(docWith((d) => (d.items[1].x = null)))).toBeNull();
    expect(parseCanvasDoc(docWith((d) => (d.items[2].y2 = "1")))).toBeNull();
  });
  it("returns null for a stroke or text size outside its preset table", () => {
    // A stroke level indexes STROKE_WIDTHS: 4 would draw a NaN stroke.
    expect(parseCanvasDoc(docWith((d) => (d.items[2].stroke = 4)))).toBeNull();
    expect(parseCanvasDoc(docWith((d) => (d.items[2].stroke = 1.5)))).toBeNull();
    expect(parseCanvasDoc(docWith((d) => (d.items[4].stroke = -1)))).toBeNull();
    // A step size indexes STEP_PX.
    expect(parseCanvasDoc(docWith((d) => (d.items[7].size = 4)))).toBeNull();
  });
  it("returns null for a frame value outside the panel's range", () => {
    expect(parseCanvasDoc(docWith((d) => (d.frame.padding = -100)))).toBeNull();
    expect(parseCanvasDoc(docWith((d) => (d.frame.radius = 1000)))).toBeNull();
  });
  it("returns null for an unknown background", () => {
    expect(parseCanvasDoc(docWith((d) => (d.frame.bg = "nope")))).toBeNull();
  });
  it("returns null for a bad exportFrame, redaction style, or missing base", () => {
    expect(
      parseCanvasDoc(docWith((d) => (d.exportFrame = { x: 0, y: 0, w: "a", h: 1 }))),
    ).toBeNull();
    expect(parseCanvasDoc(docWith((d) => (d.items[5].style = "gaussian")))).toBeNull();
    expect(parseCanvasDoc(docWith((d) => d.items.shift()))).toBeNull();
    expect(parseCanvasDoc(docWith((d) => (d.items[0].w = 0)))).toBeNull();
  });
});
