import { test, expect, type Page } from "@playwright/test";
import { copyFile, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { dismissOnboarding, localIdForAssetId, SCREENSHOT_ASSET_ID } from "../e2e/helpers/launch";
import { startScenario, type Scenario } from "./helpers";

// image-canvas document (NIW2-700, ADR 0053): with the flag on, a save stores the editable
// document beside the flattened PNG, and reopening the item from the Library restores the
// annotations as objects. Redactions are destructive: the stored base asset no longer holds
// the pixels under a blur. Without the document, the editor opens the flat PNG.
//
// Run on the Mac mini: `bun run proof:run -- verify/image-canvas-document.verify.ts`.
// Not covered here: "a quiet capture writes no canvas.json". The harness has no quiet
// capture to start, so that case stays in the renderer unit tests and the main-process tests.

const FLAG_ON = { KAIPU_FLAG_OVERRIDES: JSON.stringify({ "image-canvas": true }) };
const FIXTURE_PNG = path.resolve(__dirname, "..", "e2e", "fixtures", "sample.png");

interface Pixels {
  width: number;
  height: number;
  bitmap: Buffer;
}

/** Decode a PNG with Electron's own decoder (the verify runner has no image library). */
async function decode(s: Scenario, png: Buffer): Promise<Pixels> {
  const raw = await s.app.evaluate(({ nativeImage }, base64) => {
    const image = nativeImage.createFromBuffer(Buffer.from(base64, "base64"));
    const { width, height } = image.getSize();
    return { width, height, bitmap: image.toBitmap().toString("base64") };
  }, png.toString("base64"));
  return { width: raw.width, height: raw.height, bitmap: Buffer.from(raw.bitmap, "base64") };
}

/** How many pixels differ between two same-size bitmaps, inside and outside a pixel rect. */
function diffInOut(
  a: Pixels,
  b: Pixels,
  rect: { x0: number; y0: number; x1: number; y1: number },
): { inside: number; outside: number } {
  let inside = 0;
  let outside = 0;
  for (let y = 0; y < a.height; y += 1) {
    for (let x = 0; x < a.width; x += 1) {
      const i = (y * a.width + x) * 4;
      const same =
        a.bitmap[i] === b.bitmap[i] &&
        a.bitmap[i + 1] === b.bitmap[i + 1] &&
        a.bitmap[i + 2] === b.bitmap[i + 2];
      if (same) continue;
      const within = x >= rect.x0 && x < rect.x1 && y >= rect.y0 && y < rect.y1;
      if (within) inside += 1;
      else outside += 1;
    }
  }
  return { inside, outside };
}

interface DocItem {
  id: string;
  kind: string;
  locked?: boolean;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  x1?: number;
  y1?: number;
}
interface Doc {
  schemaVersion: number;
  items: DocItem[];
}

const metaPath = (s: Scenario, id: string, file: string): string =>
  path.join(s.vaultDir, ".kaipu", file.replace("<id>", id));

async function readDoc(s: Scenario, id: string): Promise<Doc> {
  return JSON.parse(await readFile(metaPath(s, id, "<id>.canvas.json"), "utf-8")) as Doc;
}

/** The shot's box on screen (the image inside the canvas). */
async function shotBox(
  page: Page,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page.locator('[data-canvas="true"] img').first().boundingBox();
  if (!box) throw new Error("the shot has no box");
  return box;
}

/** Open the seeded screenshot's editor from the Library detail page, through its Edit button. */
async function openFromLibrary(s: Scenario): Promise<void> {
  await s.page.evaluate((assetId) => (location.hash = `#/library/${assetId}`), SCREENSHOT_ASSET_ID);
  await s.page.getByRole("button", { name: "Edit image", exact: true }).click();
  await expect(s.page.getByRole("button", { name: /^Save/ })).toBeEnabled({ timeout: 15_000 });
  await expect(s.page.locator('[data-canvas="true"]')).toBeVisible();
}

/** Leave the editor to the Library. A vault shot saves its pending edits before it leaves. */
async function leaveEditor(s: Scenario): Promise<void> {
  await s.page.evaluate((assetId) => (location.hash = `#/library/${assetId}`), SCREENSHOT_ASSET_ID);
  await expect(s.page.getByRole("button", { name: "Edit image", exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

const annotationObjects = (page: Page) => page.locator("[data-annotation]");

test("image-canvas document: save, reopen from the Library, redaction baked, flat fallback", async () => {
  test.setTimeout(240_000);
  const s = await startScenario("image-canvas-document", {
    env: FLAG_ON,
    videoName: "video-document",
  });
  try {
    await dismissOnboarding(s.page);
    await openFromLibrary(s);
    const id = await localIdForAssetId(s.vaultDir, SCREENSHOT_ASSET_ID);

    // Opening is not an edit: nothing is written until the user changes something.
    await s.page.waitForTimeout(2_000);
    await expect(readFile(metaPath(s, id, "<id>.canvas.json"))).rejects.toThrow();

    // Draw an arrow and a blur (the tool names are the toolbar's).
    const box = await shotBox(s.page);
    const at = (fx: number, fy: number) => ({
      x: box.x + box.width * fx,
      y: box.y + box.height * fy,
    });
    await s.page.getByRole("button", { name: "Arrow", exact: true }).click();
    const a0 = at(0.1, 0.1);
    const a1 = at(0.5, 0.1);
    await s.page.mouse.move(a0.x, a0.y);
    await s.page.mouse.down();
    await s.page.mouse.move(a1.x, a1.y, { steps: 8 });
    await s.page.mouse.up();
    await s.page.getByRole("button", { name: "Blur", exact: true }).first().click();
    const b0 = at(0.55, 0.55);
    const b1 = at(0.85, 0.85);
    await s.page.mouse.move(b0.x, b0.y);
    await s.page.mouse.down();
    await s.page.mouse.move(b1.x, b1.y, { steps: 8 });
    await s.page.mouse.up();
    await expect(annotationObjects(s.page)).toHaveCount(2);
    // The live preview shows the real redaction: a raster tile of the blurred pixels. A
    // tainted canvas once made it draw nothing while the save still baked the blur.
    await expect(s.page.locator('svg image[href^="data:image/png"]')).toHaveCount(1);
    await s.shot("drawn");

    // The edit autosaves over the vault item, with the document.
    await expect
      .poll(
        () =>
          readDoc(s, id)
            .then((d) => d.items.length)
            .catch(() => 0),
        { timeout: 20_000 },
      )
      .toBe(3);
    await leaveEditor(s);

    // The stored document has the arrow and a locked blur; the asset lost the blur's pixels.
    const doc = await readDoc(s, id);
    const arrow = doc.items.find((i) => i.kind === "arrow");
    const blur = doc.items.find((i) => i.kind === "blur");
    expect(doc.schemaVersion).toBe(1);
    expect(doc.items[0].kind).toBe("image");
    expect(arrow, "the document has the arrow").toBeDefined();
    expect(blur?.locked, "the blur is locked in the document").toBe(true);
    const original = await decode(s, await readFile(FIXTURE_PNG));
    const assetPath = path.join(s.vaultDir, ".kaipu", `${id}.assets`, "base.png");
    const asset = await decode(s, await readFile(assetPath));
    expect(asset.width).toBe(original.width);
    expect(asset.height).toBe(original.height);
    const rect = {
      x0: Math.floor((blur!.x ?? 0) * asset.width),
      y0: Math.floor((blur!.y ?? 0) * asset.height),
      x1: Math.ceil(((blur!.x ?? 0) + (blur!.w ?? 0)) * asset.width),
      y1: Math.ceil(((blur!.y ?? 0) + (blur!.h ?? 0)) * asset.height),
    };
    const diff = diffInOut(original, asset, rect);
    const saved = {
      id,
      rect,
      differingInsideBlur: diff.inside,
      differingOutsideBlur: diff.outside,
    };
    await writeFile(path.join(s.outDir, "asset-diff.json"), JSON.stringify(saved, null, 2));
    console.log(`[verify] image-canvas-document: asset-diff.json ${JSON.stringify(saved)}`);
    expect(diff.inside, "pixels inside the blur rect differ from the original").toBeGreaterThan(0);
    expect(diff.outside, "pixels outside the blur rect are untouched").toBe(0);

    // Reopen from the Library: the annotations are objects, and the arrow can be dragged.
    await openFromLibrary(s);
    await s.shot("reopened");
    // The locked blur is baked into the asset and draws nothing: only the arrow is an object.
    await expect(annotationObjects(s.page)).toHaveCount(1);
    const arrowShape = s.page.locator(`[data-annotation="${arrow!.id}"]`);
    const before = await arrowShape.boundingBox();
    if (!before) throw new Error("the arrow has no box after reopen");
    await s.shot("reopened-before-drag");
    await s.page.getByRole("button", { name: "Select", exact: true }).click();
    const grab = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
    await s.page.mouse.click(grab.x, grab.y);
    await s.page.mouse.move(grab.x, grab.y);
    await s.page.mouse.down();
    await s.page.mouse.move(grab.x, grab.y + 60, { steps: 8 });
    await s.page.mouse.up();
    const after = await arrowShape.boundingBox();
    if (!after) throw new Error("the arrow has no box after the drag");
    await s.shot("reopened-after-drag");
    const moved = { before, after, dy: after.y - before.y };
    await writeFile(path.join(s.outDir, "drag.json"), JSON.stringify(moved, null, 2));
    console.log(`[verify] image-canvas-document: drag.json ${JSON.stringify(moved)}`);
    expect(Math.abs(moved.dy), "the arrow moved when dragged").toBeGreaterThan(20);
    // The move autosaves; wait for the document to hold it before leaving.
    await expect
      .poll(
        () =>
          readDoc(s, id).then((d) => {
            const a = d.items.find((i) => i.kind === "arrow");
            return a?.y1 !== arrow!.y1;
          }),
        { timeout: 20_000 },
      )
      .toBe(true);
    await leaveEditor(s);

    // Keep the stored document and base asset beside the shots as evidence.
    await copyFile(metaPath(s, id, "<id>.canvas.json"), path.join(s.outDir, "canvas.json"));
    await copyFile(assetPath, path.join(s.outDir, "base.png"));

    // Without the document, the editor opens the flattened PNG: no annotation objects.
    await rm(metaPath(s, id, "<id>.canvas.json"));
    await openFromLibrary(s);
    await expect(annotationObjects(s.page)).toHaveCount(0);
    await s.shot("flat-fallback");
    console.log(
      `[verify] image-canvas-document: flat fallback shows ${await annotationObjects(s.page).count()} annotation objects`,
    );
  } finally {
    await s.finish();
  }
});
