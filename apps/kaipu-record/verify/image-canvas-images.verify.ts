import { test, expect, type Page } from "@playwright/test";
import { copyFile, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dismissOnboarding, localIdForAssetId, SCREENSHOT_ASSET_ID } from "../e2e/helpers/launch";
import { startScenario, type Scenario } from "./helpers";

// image-canvas images (NIW2-703): with the flag on, an image pasted from the clipboard or
// picked from the Library lands on the canvas as an object beside the shot. It can be moved,
// it widens the Copy export, and a save stores it as an asset next to the document so that
// reopening the item from the Library restores it.
//
// Run on the Mac mini: `node node_modules/@playwright/test/cli.js test -c verify/playwright.config.ts image-canvas-images`.
// `NIW2_703_PHASE=before` stops after the paste: the build without the feature has no Add
// image control, so only the paste attempt is recorded there.

const FLAG_ON = { KAIPU_FLAG_OVERRIDES: JSON.stringify({ "image-canvas": true }) };
const BEFORE = process.env.NIW2_703_PHASE === "before";

/** A solid-colour PNG as a data URL, drawn by the renderer's own canvas (illustrative colours). */
async function solidPng(page: Page, color: string, w: number, h: number): Promise<string> {
  return page.evaluate(
    ([c, width, height]) => {
      const canvas = document.createElement("canvas");
      canvas.width = width as number;
      canvas.height = height as number;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = c as string;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 36px sans-serif";
      ctx.fillText(c as string, 20, 110);
      return canvas.toDataURL("image/png");
    },
    [color, w, h] as const,
  );
}

async function openFromLibrary(s: Scenario): Promise<void> {
  await s.page.evaluate((assetId) => (location.hash = `#/library/${assetId}`), SCREENSHOT_ASSET_ID);
  await s.page.getByRole("button", { name: "Edit image", exact: true }).click();
  await expect(s.page.getByRole("button", { name: /^Save/ })).toBeEnabled({ timeout: 15_000 });
  await expect(s.page.locator('[data-canvas="true"]')).toBeVisible();
}

async function leaveEditor(s: Scenario): Promise<void> {
  await s.page.evaluate((assetId) => (location.hash = `#/library/${assetId}`), SCREENSHOT_ASSET_ID);
  await expect(s.page.getByRole("button", { name: "Edit image", exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

/** Click Copy and read the size of the image the app put on the clipboard. */
async function copiedSize(s: Scenario): Promise<{ width: number; height: number }> {
  await s.app.evaluate(({ clipboard }) => clipboard.clear());
  await s.page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(s.page.getByRole("button", { name: "Copied", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  return s.app.evaluate(({ clipboard }) => clipboard.readImage().getSize());
}

/** Every object lies inside the visible canvas: nothing added or reopened is off screen. */
async function expectAllInCanvas(page: Page, label: string): Promise<void> {
  const canvas = await page.locator('[data-canvas="true"]').boundingBox();
  if (!canvas) throw new Error("no canvas box");
  const boxes = await page.locator("[data-annotation]").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
    }),
  );
  for (const [i, b] of boxes.entries()) {
    const where = `${label}: object ${i} ${JSON.stringify(b)} in canvas ${JSON.stringify(canvas)}`;
    expect(b.x, where).toBeGreaterThanOrEqual(canvas.x - 1);
    expect(b.y, where).toBeGreaterThanOrEqual(canvas.y - 1);
    expect(b.right, where).toBeLessThanOrEqual(canvas.x + canvas.width + 1);
    expect(b.bottom, where).toBeLessThanOrEqual(canvas.y + canvas.height + 1);
  }
}

interface DocItem {
  id: string;
  kind: string;
}
interface Doc {
  schemaVersion: number;
  items: DocItem[];
}

test("image-canvas images: paste, add from the Library, move, copy, save, reopen", async () => {
  test.setTimeout(300_000);
  const s = await startScenario("image-canvas-images", {
    env: FLAG_ON,
    videoName: "video-images",
  });
  const page = s.page;
  const objects = page.locator("[data-annotation]");
  try {
    await dismissOnboarding(page);
    // The app's default window size: no resize anywhere in this scenario.
    await page.evaluate((id) => (location.hash = `#/editor/image/${id}`), SCREENSHOT_ASSET_ID);
    await expect(page.getByRole("button", { name: /^Save/ })).toBeEnabled({ timeout: 15_000 });
    await expect(page.locator('[data-canvas="true"]')).toBeVisible();
    await s.shot("editor");
    const id = await localIdForAssetId(s.vaultDir, SCREENSHOT_ASSET_ID);
    const sizes: Record<string, unknown> = { phase: BEFORE ? "before" : "after" };

    // A second shot in the throwaway vault, so the Library picker has something to offer
    // (it leaves out the shot being edited).
    const libDataUrl = await solidPng(page, "#2e7d32", 400, 260);
    const libPng = Buffer.from(libDataUrl.split(",")[1], "base64");
    await writeFile(path.join(s.vaultDir, "e2e-shot-green.png"), libPng);
    await writeFile(
      path.join(s.vaultDir, ".kaipu", "e2e-shot-green.json"),
      JSON.stringify({
        sidecarVersion: 2,
        assetId: "e2e0a5e7-0000-4000-8000-000000000551",
        title: "Green shot",
        createdAt: 1_700_000_100_000,
      }),
    );

    if (!BEFORE) sizes.copyBase = await copiedSize(s);

    // Paste a distinct image: the clipboard gets a solid 320x200 PNG; click the canvas
    // background (not an object) so the focus is on the page, then Meta+V.
    const pasteDataUrl = await solidPng(page, "#c62828", 320, 200);
    await s.app.evaluate(
      ({ clipboard, nativeImage }, url) => clipboard.writeImage(nativeImage.createFromDataURL(url)),
      pasteDataUrl,
    );
    await page.mouse.click(300, 700);
    await page.keyboard.press("Meta+V");
    await page.waitForTimeout(2_000);
    await s.shot("after-paste");
    const pasted = await objects.count();
    sizes.objectsAfterPaste = pasted;
    console.log(`[verify] image-canvas-images: ${pasted} canvas object(s) after the paste`);

    if (BEFORE) {
      await writeFile(path.join(s.outDir, "sizes.json"), JSON.stringify(sizes, null, 2));
      return;
    }
    expect(pasted, "the pasted image is an object on the canvas").toBe(1);

    // Add from the Library.
    await page.getByRole("button", { name: "Add image", exact: true }).click();
    await page.getByRole("menuitem", { name: "From Library" }).click();
    await expect(page.getByText("Green shot", { exact: true })).toBeVisible();
    await s.shot("library-picker");
    await page.getByRole("button", { name: "Green shot" }).click();
    await expect(objects).toHaveCount(2);
    await page.waitForTimeout(500);
    await s.shot("two-added");
    await expectAllInCanvas(page, "after adding from the Library");

    // Move the pasted image (the first object) 150 px down-left with the select tool. It sits
    // beside the shot, partly outside the viewport, so grab the part that is visible.
    await page.getByRole("button", { name: "Select", exact: true }).click();
    const pastedShape = objects.first();
    const before = await pastedShape.boundingBox();
    if (!before) throw new Error("the pasted image has no box");
    const panelLeft = (await page.getByText("Beautify", { exact: true }).boundingBox())?.x ?? 1100;
    const x0 = Math.max(before.x, 0);
    const x1 = Math.min(before.x + before.width, panelLeft - 4);
    const grab = { x: (x0 + x1) / 2, y: before.y + before.height / 2 };
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move(grab.x - 150, grab.y + 150, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    const after = await pastedShape.boundingBox();
    if (!after) throw new Error("the pasted image has no box after the drag");
    sizes.drag = { before, after, dx: after.x - before.x, dy: after.y - before.y };
    await s.shot("moved");
    expect(after.y - before.y, "the pasted image moved down").toBeGreaterThan(60);
    expect(after.x - before.x, "the pasted image moved left").toBeLessThan(-60);

    // Copy exports the whole canvas: wider than the shot alone.
    const copyAll = await copiedSize(s);
    sizes.copyWithImages = copyAll;
    await writeFile(path.join(s.outDir, "sizes.json"), JSON.stringify(sizes, null, 2));
    console.log(`[verify] image-canvas-images: sizes ${JSON.stringify(sizes)}`);
    const base = sizes.copyBase as { width: number; height: number };
    expect(copyAll.width, "the export is wider than the shot alone").toBeGreaterThan(base.width);

    // The edit autosaves: wait for the document to hold the base and both added images.
    const docPath = path.join(s.vaultDir, ".kaipu", `${id}.canvas.json`);
    const readDoc = async (): Promise<Doc> => JSON.parse(await readFile(docPath, "utf-8")) as Doc;
    await expect
      .poll(
        () =>
          readDoc()
            .then((d) => d.items.filter((i) => i.kind === "image").length)
            .catch(() => 0),
        { timeout: 30_000 },
      )
      .toBe(3);
    await leaveEditor(s);

    const doc = await readDoc();
    expect(doc.schemaVersion).toBe(2);
    expect(doc.items.filter((i) => i.kind === "image")).toHaveLength(3);
    const assetsDir = path.join(s.vaultDir, ".kaipu", `${id}.assets`);
    const assets = (await readdir(assetsDir)).sort();
    await writeFile(
      path.join(s.outDir, "vault.json"),
      JSON.stringify({ id, assetsDir: `.kaipu/${id}.assets`, assets, canvas: doc }, null, 2),
    );
    await copyFile(docPath, path.join(s.outDir, "canvas.json"));
    console.log(`[verify] image-canvas-images: assets ${JSON.stringify(assets)}`);

    // Reopen from the Library: the added images are objects again.
    await openFromLibrary(s);
    await page.waitForTimeout(1_000);
    await s.shot("reopened");
    await expect(objects).toHaveCount(2);
    await expectAllInCanvas(page, "after reopening");
  } finally {
    await s.finish();
  }
});
