import { test, expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { copyFile, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { dismissOnboarding, localIdForAssetId } from "../e2e/helpers/launch";
import { decodePng } from "../ui-catalog/png";
import { startScenario, type Scenario } from "./helpers";

// Hide recognized text in one click (NIW2-706): with `image-text` and `image-canvas` on, the
// redact tool outlines the recognized line under the pointer and a click redacts it. After
// the save the stored image has those pixels replaced, and the text cache has none of its
// words. Without the helper the redact tool still draws a region by dragging.
//
// Run on a Mac that has the helper (`bash scripts/build-text-recognition.sh`) and a build
// (`electron-vite build`), from apps/kaipu-record:
//   bun run proof:run -- verify/image-text-hide.verify.ts --grep "after|helper missing"
// The "before" shots are taken on the commit WITHOUT the change (the M8 tip): copy this file
// over that checkout, build it, then
//   bun run proof:run -- verify/image-text-hide.verify.ts --grep "before"
// Everything runs in a throwaway vault; no user data is read.

const APP_ROOT = path.resolve(__dirname, "..");
const FIXTURE_PNG = path.join(APP_ROOT, "ui-catalog", "fixtures", "text", "settings-text.png");
const HELPER = path.join(APP_ROOT, "resources", "native", "kaipu-text-recognition");
const ASSET_ID = "c0a1a10c-0000-4000-8000-000000000104";
const STEM = "Display settings";
/** The fixture's pixel size, and a point on its first row ("Language: English", x 44-170, y 92-108). */
const FIXTURE = { w: 560, h: 340 };
const ROW_POINT = { x: 100, y: 100 };
/** The first row's text, generously: every pixel the redaction may touch is inside it. */
const ROW_AREA = { x0: 30, y0: 80, x1: 190, y1: 120 };
const ROW_WORDS = ["Language:", "English"];

const FLAGS_ON = {
  KAIPU_FLAG_OVERRIDES: JSON.stringify({ "image-canvas": true, "image-text": true }),
};

async function openTextItem(s: Scenario): Promise<void> {
  const meta = path.join(s.vaultDir, ".kaipu");
  await copyFile(FIXTURE_PNG, path.join(s.vaultDir, `${STEM}.png`));
  await writeFile(
    path.join(meta, `${STEM}.json`),
    JSON.stringify({
      sidecarVersion: 2,
      assetId: ASSET_ID,
      title: STEM,
      createdAt: 1_700_000_000_000,
    }),
  );
  await s.page.reload();
  await dismissOnboarding(s.page);
  await s.page.evaluate((assetId) => (location.hash = `#/library/${assetId}`), ASSET_ID);
  await s.page.getByRole("button", { name: "Edit image", exact: true }).click();
  await expect(s.page.getByRole("button", { name: /^Save/ })).toBeEnabled({ timeout: 15_000 });
  await expect(s.page.locator('[data-canvas="true"] img').first()).toBeVisible();
}

/** Screen point of a fixture pixel. */
async function screenPoint(page: Page, px: { x: number; y: number }) {
  const box = await page.locator('[data-canvas="true"] img').first().boundingBox();
  if (!box) throw new Error("the shot has no box");
  return {
    x: box.x + (box.width * px.x) / FIXTURE.w,
    y: box.y + (box.height * px.y) / FIXTURE.h,
  };
}

const pickRedact = (page: Page) =>
  page.getByRole("button", { name: "Redact", exact: true }).first().click();
const shotPath = (s: Scenario, name: string): string => path.join(s.outDir, name);

async function saveOverwrite(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Save/ }).click();
  const overwrite = page.getByRole("button", { name: "Overwrite" });
  await overwrite.waitFor({ state: "visible", timeout: 3_000 }).then(
    () => overwrite.click(),
    () => undefined,
  );
}

test("after: a click hides the line; the save bakes it and the cache drops its words", async () => {
  test.setTimeout(240_000);
  const s = await startScenario("image-text-hide", { env: FLAGS_ON, videoName: "video-after" });
  try {
    await dismissOnboarding(s.page);
    await openTextItem(s);
    await pickRedact(s.page);
    // The first recognition on a Mac compiles Vision's model (13.5 s measured).
    await expect(s.page.locator('[data-ui-area="editorImage.textHideHint"]')).toContainText(
      "Click a line of text",
      { timeout: 60_000 },
    );
    const p = await screenPoint(s.page, ROW_POINT);
    await s.page.mouse.move(p.x, p.y);
    await expect(s.page.locator('[data-testid="text-target"]')).toBeVisible();
    await s.page.screenshot({ path: shotPath(s, "01-hover.png") });

    await s.page.mouse.down();
    await s.page.mouse.up();
    await expect(s.page.locator('[data-testid="redaction-tile"]')).toHaveCount(1);
    // The hidden line is no longer a target.
    await expect(s.page.locator('[data-testid="text-target"]')).toHaveCount(0);
    await s.page.mouse.move(p.x + 400, p.y + 400);
    await s.page.screenshot({ path: shotPath(s, "02-hidden.png") });

    await saveOverwrite(s.page);
    const id = await localIdForAssetId(s.vaultDir, ASSET_ID);
    const meta = path.join(s.vaultDir, ".kaipu");
    const cache = path.join(meta, `${id}.text.json`);
    const stored = path.join(meta, `${id}.assets`, "base.png");
    // Opening the item already caches the words recognized in the original. The save must
    // replace that entry with one for the stored (redacted) image: wait until the cache names
    // the stored bytes' hash, so this never reads the entry written on open.
    const sha256 = async (file: string) =>
      createHash("sha256")
        .update(await readFile(file))
        .digest("hex");
    await expect
      .poll(
        async () => {
          try {
            const raw = JSON.parse(await readFile(cache, "utf-8")) as {
              assets?: Record<string, { sha256?: string }>;
            };
            return raw.assets?.base?.sha256 === (await sha256(stored));
          } catch {
            return false;
          }
        },
        { timeout: 20_000 },
      )
      .toBe(true);
    const file = JSON.parse(await readFile(cache, "utf-8")) as {
      assets: Record<
        string,
        { words: { text: string; rect: { x: number; y: number; w: number; h: number } }[] }
      >;
    };
    const words = file.assets.base.words;
    await copyFile(cache, shotPath(s, "03-text.json"));
    console.log(
      `[verify] image-text-hide: cache words ${JSON.stringify(words.map((w) => w.text))}`,
    );
    // Other rows are still cached; nothing of the hidden row is.
    expect(words.length).toBeGreaterThan(0);
    for (const w of words) {
      expect(ROW_WORDS).not.toContain(w.text);
      const inRow = w.rect.y < ROW_AREA.y1 && w.rect.y + w.rect.h > ROW_AREA.y0;
      expect(inRow, `cached word "${w.text}" sits in the hidden row`).toBe(false);
    }

    // The stored image: the row's pixels changed, every pixel well outside it did not.
    await copyFile(stored, shotPath(s, "04-stored-base.png"));
    const after = decodePng(await readFile(stored));
    const before = decodePng(await readFile(FIXTURE_PNG));
    expect([after.width, after.height]).toEqual([before.width, before.height]);
    let changedInRow = 0;
    let changedOutside = 0;
    for (let y = 0; y < after.height; y += 1) {
      for (let x = 0; x < after.width; x += 1) {
        const i = (y * after.width + x) * 4;
        const differs =
          after.data[i] !== before.data[i] ||
          after.data[i + 1] !== before.data[i + 1] ||
          after.data[i + 2] !== before.data[i + 2] ||
          after.data[i + 3] !== before.data[i + 3];
        if (!differs) continue;
        const inRow = x >= ROW_AREA.x0 && x < ROW_AREA.x1 && y >= ROW_AREA.y0 && y < ROW_AREA.y1;
        if (inRow) changedInRow += 1;
        else changedOutside += 1;
      }
    }
    console.log(
      `[verify] image-text-hide: pixels changed in the row ${changedInRow}, outside ${changedOutside}`,
    );
    expect(changedInRow).toBeGreaterThan(500);
    expect(changedOutside).toBe(0);
  } finally {
    await s.finish();
  }
});

test("helper missing: the redact tool still draws a region by dragging", async () => {
  test.setTimeout(180_000);
  await rename(HELPER, `${HELPER}.disabled`);
  try {
    const s = await startScenario("image-text-hide", {
      env: FLAGS_ON,
      keepOutput: true,
      videoName: "video-unavailable",
    });
    try {
      await dismissOnboarding(s.page);
      await openTextItem(s);
      await pickRedact(s.page);
      const from = await screenPoint(s.page, { x: 40, y: 85 });
      const to = await screenPoint(s.page, { x: 200, y: 115 });
      // Recognition gives up (no helper): the hint leaves, "Recognizing text…" included, so a
      // run stuck pending fails here instead of passing for unavailable.
      await expect(s.page.locator('[data-ui-area="editorImage.textHideHint"]')).toHaveCount(0, {
        timeout: 10_000,
      });
      await s.page.mouse.move(from.x, from.y);
      await s.page.mouse.down();
      await s.page.mouse.move(to.x, to.y, { steps: 12 });
      await s.page.mouse.up();
      await expect(s.page.locator('[data-testid="redaction-tile"]')).toHaveCount(1);
      await s.page.screenshot({ path: shotPath(s, "05-unavailable-drag.png") });
    } finally {
      await s.finish();
    }
  } finally {
    await rename(`${HELPER}.disabled`, HELPER);
  }
});

// Runs on the commit without the change too (it imports nothing from the new code).
test("before: the redact tool over the same line", async () => {
  test.setTimeout(180_000);
  const s = await startScenario("image-text-hide", {
    env: FLAGS_ON,
    keepOutput: true,
    videoName: "video-before",
  });
  try {
    await dismissOnboarding(s.page);
    await openTextItem(s);
    await pickRedact(s.page);
    // Give recognition the same time the "after" run waits for.
    await s.page.waitForTimeout(20_000);
    const p = await screenPoint(s.page, ROW_POINT);
    await s.page.mouse.move(p.x, p.y);
    await s.page.screenshot({ path: shotPath(s, "00-before-hover.png") });
    await s.page.mouse.down();
    await s.page.mouse.up();
    await s.page.mouse.move(p.x + 400, p.y + 400);
    await s.page.screenshot({ path: shotPath(s, "00-before-click.png") });
  } finally {
    await s.finish();
  }
});
