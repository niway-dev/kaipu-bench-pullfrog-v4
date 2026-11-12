import { test, expect, type Page } from "@playwright/test";
import { copyFile, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { dismissOnboarding, localIdForAssetId } from "../e2e/helpers/launch";
import { startScenario, type Scenario } from "./helpers";

// Select text (NIW2-705, ADR 0055): with `image-text` (and `image-canvas`) on, the editor
// recognizes the words of a screenshot with Apple Vision, the user drags across them and
// Cmd+C puts the text on the clipboard. Without the helper the tool says it is unavailable
// and the canvas keeps working.
//
// Run on a Mac that has the helper (`bash scripts/build-text-recognition.sh`) and a build
// (`electron-vite build`), from apps/kaipu-record:
//   bun run proof:run -- verify/image-text.verify.ts --grep "after|helper missing"
// The "before" shot is taken on the commit WITHOUT the change: copy this file and
// `ui-catalog/fixtures/text/settings-text.png` over that checkout, build it, then
//   bun run proof:run -- verify/image-text.verify.ts --grep "before"
// Everything runs in a throwaway vault; no user data is read.

const APP_ROOT = path.resolve(__dirname, "..");
// Inlined (not imported from the UI catalog) so this file also runs on the old commit.
const FIXTURE_PNG = path.join(APP_ROOT, "ui-catalog", "fixtures", "text", "settings-text.png");
const HELPER = path.join(APP_ROOT, "resources", "native", "kaipu-text-recognition");
const ASSET_ID = "c0a1a10c-0000-4000-8000-000000000104";
const STEM = "Display settings";
/** The fixture's pixel size and the first row's text box (x 44-170, y 92-108). */
const FIXTURE = { w: 560, h: 340 };
const ROW = { fromX: 60, toX: 190, y: 100 };
/** What a drag across the first row must copy. */
const EXPECTED_ROW_TEXT = "Language: English";

const FLAGS_ON = {
  KAIPU_FLAG_OVERRIDES: JSON.stringify({ "image-canvas": true, "image-text": true }),
};
const CANVAS_ONLY = { KAIPU_FLAG_OVERRIDES: JSON.stringify({ "image-canvas": true }) };

/** Put the text screenshot in the throwaway vault and open it in the editor. */
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
  // The Library reads the vault when it mounts: reload so it lists the new item.
  await s.page.reload();
  await dismissOnboarding(s.page);
  await s.page.evaluate((assetId) => (location.hash = `#/library/${assetId}`), ASSET_ID);
  await s.page.getByRole("button", { name: "Edit image", exact: true }).click();
  await expect(s.page.getByRole("button", { name: /^Save/ })).toBeEnabled({ timeout: 15_000 });
  await expect(s.page.locator('[data-canvas="true"] img').first()).toBeVisible();
}

const status = (page: Page) => page.locator('[data-ui-area="editorImage.textStatus"]');

async function imageBox(
  page: Page,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page.locator('[data-canvas="true"] img').first().boundingBox();
  if (!box) throw new Error("the shot has no box");
  return box;
}

const shotPath = (s: Scenario, name: string): string => path.join(s.outDir, name);

test("after: select text, copy it, and cache the words on save", async () => {
  test.setTimeout(240_000);
  const s = await startScenario("image-text", { env: FLAGS_ON, videoName: "video-after" });
  try {
    await dismissOnboarding(s.page);
    await openTextItem(s);
    await s.page.getByRole("button", { name: "Select text", exact: true }).click();
    // The first recognition on a Mac compiles Vision's model (13.5 s measured).
    await expect(status(s.page)).toContainText("words found", { timeout: 60_000 });
    await s.page.screenshot({ path: shotPath(s, "01-ready.png"), animations: "disabled" });

    const box = await imageBox(s.page);
    const at = (x: number) => ({
      x: box.x + (box.width * x) / FIXTURE.w,
      y: box.y + (box.height * ROW.y) / FIXTURE.h,
    });
    const from = at(ROW.fromX);
    const to = at(ROW.toX);
    await s.page.mouse.move(from.x, from.y);
    await s.page.mouse.down();
    await s.page.mouse.move(to.x, to.y, { steps: 12 });
    await s.page.mouse.up();
    await expect(s.page.locator('[data-testid="text-highlight"]')).toHaveCount(2);
    await s.page.screenshot({ path: shotPath(s, "02-selected.png"), animations: "disabled" });

    // An empty clipboard first, so a stale value cannot pass for the copy.
    await s.app.evaluate(({ clipboard }) => clipboard.clear());
    await s.page.keyboard.press("Meta+c");
    await expect
      .poll(() => s.app.evaluate(({ clipboard }) => clipboard.readText()), { timeout: 10_000 })
      .toBe(EXPECTED_ROW_TEXT);
    const copied = await s.app.evaluate(({ clipboard }) => clipboard.readText());
    await writeFile(shotPath(s, "03-clipboard.txt"), copied);
    console.log(`[verify] image-text: clipboard ${JSON.stringify(copied)}`);

    // Save (a vault item asks Overwrite or keep a copy), then the words are cached beside it.
    await s.page.getByRole("button", { name: /^Save/ }).click();
    const overwrite = s.page.getByRole("button", { name: "Overwrite" });
    await overwrite.waitFor({ state: "visible", timeout: 3_000 }).then(
      () => overwrite.click(),
      () => undefined,
    );
    const id = await localIdForAssetId(s.vaultDir, ASSET_ID);
    const cache = path.join(s.vaultDir, ".kaipu", `${id}.text.json`);
    await expect
      .poll(
        () =>
          readFile(cache, "utf-8")
            .then((raw) => (JSON.parse(raw) as { assets?: Record<string, unknown> }).assets?.base)
            .catch(() => undefined),
        { timeout: 20_000 },
      )
      .toBeDefined();
    const file = JSON.parse(await readFile(cache, "utf-8")) as {
      schemaVersion: number;
      assets: Record<string, { sha256: string; words: { text: string }[] }>;
    };
    expect(file.schemaVersion).toBe(1);
    expect(file.assets.base.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(file.assets.base.words.length).toBeGreaterThan(0);
    await copyFile(cache, shotPath(s, "05-text.json"));
  } finally {
    await s.finish();
  }
});

test("helper missing: Select text says it is unavailable and the canvas still works", async () => {
  test.setTimeout(180_000);
  await rename(HELPER, `${HELPER}.disabled`);
  try {
    const s = await startScenario("image-text", {
      env: FLAGS_ON,
      keepOutput: true,
      videoName: "video-unavailable",
    });
    try {
      await dismissOnboarding(s.page);
      await openTextItem(s);
      await s.page.getByRole("button", { name: "Select text", exact: true }).click();
      await expect(status(s.page)).toContainText("Text recognition is not available", {
        timeout: 30_000,
      });
      // The image is still there and drawn.
      const natural = await s.page
        .locator('[data-canvas="true"] img')
        .first()
        .evaluate((img) => (img as HTMLImageElement).naturalWidth);
      expect(natural).toBe(FIXTURE.w);
      await s.page.screenshot({ path: shotPath(s, "04-unavailable.png"), animations: "disabled" });
    } finally {
      await s.finish();
    }
  } finally {
    await rename(`${HELPER}.disabled`, HELPER);
  }
});

// Runs on the commit without the change too (it imports nothing from the new code).
test("before: the editor on the same screenshot", async () => {
  test.setTimeout(120_000);
  const s = await startScenario("image-text", {
    env: CANVAS_ONLY,
    keepOutput: true,
    videoName: "video-before",
  });
  try {
    await dismissOnboarding(s.page);
    await openTextItem(s);
    await s.page.screenshot({ path: shotPath(s, "00-before.png"), animations: "disabled" });
  } finally {
    await s.finish();
  }
});
