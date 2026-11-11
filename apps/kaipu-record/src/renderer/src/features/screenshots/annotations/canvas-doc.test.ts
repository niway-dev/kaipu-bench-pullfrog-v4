import { describe, expect, it } from "vitest";
import { CANVAS_DOC_VERSION, buildCanvasDoc, parseCanvasDoc } from "./canvas-doc";
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
];
const scene: Scene = {
  beautify: { bg: "ocean", padding: 24, radius: 8, shadow: 30 },
  annotations,
  exportFrame: { x: -0.1, y: -0.1, w: 1.2, h: 1.2 },
};
const base = { pixelWidth: 800, pixelHeight: 600 };

/** Deep equality that tolerates float noise from the world <-> normalized conversion. */
function expectClose(actual: unknown, expected: unknown, path = "value"): void {
  if (typeof expected === "number") {
    expect(actual, path).toBeCloseTo(expected, 9);
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual), path).toBe(true);
    expect((actual as unknown[]).length, path).toBe(expected.length);
    expected.forEach((e, i) => expectClose((actual as unknown[])[i], e, `${path}[${i}]`));
  } else if (typeof expected === "object" && expected !== null) {
    expect(Object.keys(actual as object).sort(), path).toEqual(Object.keys(expected).sort());
    for (const [k, e] of Object.entries(expected)) {
      expectClose((actual as Record<string, unknown>)[k], e, `${path}.${k}`);
    }
  } else {
    expect(actual, path).toEqual(expected);
  }
}

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
    expectClose(parsed!.scene.exportFrame, scene.exportFrame);
    expectClose(
      parsed!.scene.annotations,
      annotations.map((a) => (a.kind === "blur" ? { ...a, locked: true } : a)),
    );
  });

  it("writes the current version with every geometry in world units", () => {
    const doc = buildCanvasDoc(scene, base);
    expect(doc.schemaVersion).toBe(CANVAS_DOC_VERSION);
    expect(CANVAS_DOC_VERSION).toBe(2);
    const [, box, arrow, text, path] = doc.items as any[];
    expect(box).toMatchObject({ x: 80, y: 60, w: 160, h: 120 });
    expect(arrow).toMatchObject({ x1: -160, y1: 0, x2: 1120, y2: 300 });
    expect(text).toMatchObject({ x: 240, y: 180, width: 160, fontPx: 20, size: 1 });
    expect(path.points[1]).toEqual({ x: 400, y: 300 });
    expect(doc.exportFrame).toEqual({ x: -80, y: -60, w: 960, h: 720 });
  });

  it("round-trips images at their z-position, with the scene otherwise intact", () => {
    // Illustrative: 400x300 image right of the 800x600 base, one above-left of it.
    const withImages: Scene = {
      ...scene,
      annotations: [
        annotations[0],
        {
          id: "a7",
          kind: "image",
          assetId: "img-aaaaaaaaaaaa",
          x: 1.1,
          y: 0.05,
          w: 0.5,
          h: 0.5,
          pixelWidth: 400,
          pixelHeight: 300,
        },
        annotations[1],
        {
          id: "a8",
          kind: "image",
          assetId: "img-bbbbbbbbbbbb",
          x: -0.7,
          y: -0.6,
          w: 0.25,
          h: 0.25,
          pixelWidth: 200,
          pixelHeight: 150,
        },
        annotations[4],
      ],
    };
    const doc = buildCanvasDoc(withImages, base);
    expect((doc.items[2] as any).x).toBeCloseTo(880);
    expect((doc.items[2] as any).w).toBeCloseTo(400);
    const parsed = parseCanvasDoc(JSON.stringify(doc))!;
    expect(parsed.scene.annotations.map((a) => a.kind)).toEqual([
      "box",
      "image",
      "arrow",
      "image",
      "blur",
    ]);
    expectClose(
      parsed.scene.annotations,
      withImages.annotations.map((a) => (a.kind === "blur" ? { ...a, locked: true } : a)),
    );
  });

  it("reads a v1 document unchanged: base-normalized, extra image items ignored", () => {
    const v1 = {
      schemaVersion: 1,
      items: [
        {
          id: "image-base",
          kind: "image",
          assetId: "base",
          x: 0,
          y: 0,
          w: 800,
          h: 600,
          pixelWidth: 800,
          pixelHeight: 600,
        },
        {
          id: "a1",
          kind: "box",
          x: 0.1,
          y: 0.2,
          w: 0.3,
          h: 0.4,
          color: "#f00",
          stroke: 2,
          seed: 5,
        },
        {
          id: "x",
          kind: "image",
          assetId: "img-ignored",
          x: 900,
          y: 0,
          w: 10,
          h: 10,
          pixelWidth: 10,
          pixelHeight: 10,
        },
        { id: "a5", kind: "blur", x: 0.5, y: 0.5, w: 0.1, h: 0.1, locked: true },
      ],
      frame: { bg: "ocean", padding: 24, radius: 8, shadow: 30 },
      exportFrame: { x: -0.1, y: -0.1, w: 1.2, h: 1.2 },
    };
    const parsed = parseCanvasDoc(JSON.stringify(v1))!;
    expect(parsed.scene.annotations).toEqual([v1.items[1], v1.items[3]]);
    expect(parsed.scene.exportFrame).toEqual(v1.exportFrame);
  });

  it("converts by the base's rect when the base is not at 0,0", () => {
    // Illustrative: the base sits at (100,50), 800x600. World x = 100 + 0.1 * 800 = 180.
    const v2 = {
      schemaVersion: 2,
      items: [
        {
          id: "image-base",
          kind: "image",
          assetId: "base",
          x: 100,
          y: 50,
          w: 800,
          h: 600,
          pixelWidth: 800,
          pixelHeight: 600,
        },
        {
          id: "a1",
          kind: "box",
          x: 180,
          y: 110,
          w: 160,
          h: 120,
          color: "#f00",
          stroke: 2,
          seed: 5,
        },
        { id: "a3", kind: "text", x: 180, y: 110, text: "hi", color: "#00f", size: 1, width: 160 },
        {
          id: "a4",
          kind: "path",
          points: [
            { x: 100, y: 50 },
            { x: 500, y: 350 },
          ],
          color: "#fff",
          stroke: 2,
        },
        {
          id: "a7",
          kind: "image",
          assetId: "img-aaaaaaaaaaaa",
          x: 1000,
          y: 50,
          w: 400,
          h: 300,
          pixelWidth: 400,
          pixelHeight: 300,
        },
      ],
      frame: { bg: "none", padding: 0, radius: 0, shadow: 0 },
      exportFrame: { x: 100, y: 50, w: 1300, h: 600 },
    };
    const parsed = parseCanvasDoc(JSON.stringify(v2))!;
    expect(parsed.base).toMatchObject({ x: 100, y: 50, w: 800, h: 600 });
    const [box, text, path, image] = parsed.scene.annotations as any[];
    expect(box).toMatchObject({ x: 0.1, y: 0.1, w: 0.2, h: 0.2 });
    expect(text).toMatchObject({ x: 0.1, y: 0.1, width: 0.2 });
    expect(path.points).toEqual([
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
    ]);
    expect(image).toMatchObject({ x: 1.125, y: 0, w: 0.5, h: 0.5, pixelWidth: 400 });
    expect(parsed.scene.exportFrame).toEqual({ x: 0, y: 0, w: 1.625, h: 1 });
  });

  it("returns null for corrupt JSON", () => {
    expect(parseCanvasDoc("{not json")).toBeNull();
    expect(parseCanvasDoc("42")).toBeNull();
  });
  it("returns null for an unknown schema version", () => {
    expect(parseCanvasDoc(docWith((d) => (d.schemaVersion = 3)))).toBeNull();
    expect(parseCanvasDoc(docWith((d) => (d.schemaVersion = 0)))).toBeNull();
    expect(parseCanvasDoc(docWith((d) => delete d.schemaVersion))).toBeNull();
  });
  it("returns null for an added image with a bad or reserved asset id", () => {
    const image = {
      id: "a7",
      kind: "image",
      assetId: "img-aaaaaaaaaaaa",
      x: 900,
      y: 0,
      w: 100,
      h: 100,
      pixelWidth: 100,
      pixelHeight: 100,
    };
    expect(parseCanvasDoc(docWith((d) => d.items.push(image)))).not.toBeNull();
    expect(parseCanvasDoc(docWith((d) => d.items.push({ ...image, assetId: "../x" })))).toBeNull();
    expect(parseCanvasDoc(docWith((d) => d.items.push({ ...image, assetId: "base" })))).toBeNull();
    expect(parseCanvasDoc(docWith((d) => d.items.push({ ...image, w: 0 })))).toBeNull();
  });
  it("returns null for an unknown annotation kind", () => {
    expect(parseCanvasDoc(docWith((d) => d.items.push({ id: "z", kind: "star" })))).toBeNull();
  });
  it("returns null for a bad asset id", () => {
    expect(parseCanvasDoc(docWith((d) => (d.items[0].assetId = "../x")))).toBeNull();
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
