import { test, expect, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { dismissOnboarding, SCREENSHOT_ASSET_ID } from "../e2e/helpers/launch";
import { startScenario, type Scenario } from "./helpers";

// image-canvas (NIW2-698): the flag's content-box canvas must leave a plain export untouched
// (parity with the flag off), and must let content sit outside the image (the export grows).

/** What `Copy` put on the clipboard: its size and raw pixels (so two copies can be compared). */
interface Clip {
  width: number;
  height: number;
  bitmap: Buffer;
  png: Buffer;
}

const FLAG_ON = { KAIPU_FLAG_OVERRIDES: JSON.stringify({ "image-canvas": true }) };

async function openImageEditor(s: Scenario): Promise<void> {
  await dismissOnboarding(s.page);
  await s.page.evaluate((id) => (location.hash = `#/editor/image/${id}`), SCREENSHOT_ASSET_ID);
  await expect(s.page.getByRole("button", { name: /^Save/ })).toBeEnabled({ timeout: 15_000 });
}

/** Click Copy and read what the app wrote to the system clipboard. */
async function copyToClipboard(s: Scenario): Promise<Clip> {
  await s.app.evaluate(({ clipboard }) => clipboard.clear());
  await s.page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(s.page.getByRole("button", { name: "Copied", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  const raw = await s.app.evaluate(({ clipboard }) => {
    const image = clipboard.readImage();
    const { width, height } = image.getSize();
    return {
      width,
      height,
      bitmap: image.toBitmap().toString("base64"),
      png: image.toPNG().toString("base64"),
    };
  });
  return {
    width: raw.width,
    height: raw.height,
    bitmap: Buffer.from(raw.bitmap, "base64"),
    png: Buffer.from(raw.png, "base64"),
  };
}

async function save(s: Scenario, name: string, clip: Clip): Promise<void> {
  await writeFile(path.join(s.outDir, name), clip.png);
}

/** Pick the Ocean background and push padding to its maximum, the same clicks on both sides. */
async function beautify(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Ocean", exact: true }).click();
  const padding = page.locator('input[type="range"]').first();
  await padding.focus();
  await padding.press("End");
}

async function parity(s: Scenario, file: string, off: Clip, on: Clip): Promise<void> {
  let differing = 0;
  const sameSize = off.width === on.width && off.height === on.height;
  if (sameSize && off.bitmap.length === on.bitmap.length) {
    for (let i = 0; i < off.bitmap.length; i += 4) {
      if (
        off.bitmap[i] !== on.bitmap[i] ||
        off.bitmap[i + 1] !== on.bitmap[i + 1] ||
        off.bitmap[i + 2] !== on.bitmap[i + 2] ||
        off.bitmap[i + 3] !== on.bitmap[i + 3]
      )
        differing += 1;
    }
  } else {
    differing = -1; // sizes differ, pixels are not comparable
  }
  const result = {
    flagOff: { width: off.width, height: off.height },
    flagOn: { width: on.width, height: on.height },
    sameSize,
    differingPixels: differing,
    identical: sameSize && differing === 0,
  };
  await writeFile(path.join(s.outDir, file), JSON.stringify(result, null, 2));
  console.log(`[verify] image-canvas: ${file} ${JSON.stringify(result)}`);
  expect(result.identical, `${file}: flag-on export differs from flag-off`).toBe(true);
}

test("image-canvas: export parity with the flag off, content outside the image, pan and zoom", async () => {
  test.setTimeout(240_000);

  // Launch 1: flag off. The editor and the exports the flag must not change.
  let offPlain: Clip;
  let offBeautified: Clip;
  const off = await startScenario("image-canvas", { videoName: "video-flag-off" });
  try {
    await openImageEditor(off);
    await off.shot("flag-off-editor");
    offPlain = await copyToClipboard(off);
    await save(off, "flag-off.png", offPlain);
    await beautify(off.page);
    offBeautified = await copyToClipboard(off);
    await save(off, "flag-off-beautified.png", offBeautified);
  } finally {
    await off.finish();
  }

  // Launch 2: flag on.
  const on = await startScenario("image-canvas", {
    env: FLAG_ON,
    keepOutput: true,
    shotOffset: 1,
    videoName: "video-flag-on",
  });
  try {
    await openImageEditor(on);
    await expect(on.page.locator('[data-canvas="true"]')).toBeVisible();
    await on.shot("flag-on-editor");
    const onPlain = await copyToClipboard(on);
    await save(on, "flag-on.png", onPlain);
    await parity(on, "parity.json", offPlain, onPlain);

    // Same beautify clicks, then compare, then start from a clean editor for the rest.
    await beautify(on.page);
    const onBeautified = await copyToClipboard(on);
    await save(on, "flag-on-beautified.png", onBeautified);
    await parity(on, "parity-beautified.json", offBeautified, onBeautified);
    await on.page.reload();
    await openImageEditor(on);
    await on.page.getByRole("button", { name: "Copy", exact: true }).waitFor();

    // D. Text outside the image grows the export.
    await on.page.getByRole("button", { name: "Text", exact: true }).click();
    const canvasBox = await on.page.locator('[data-canvas="true"]').boundingBox();
    const imageBox = await on.page.locator('[data-canvas="true"] img').first().boundingBox();
    if (!canvasBox || !imageBox) throw new Error("canvas or image has no box");
    const x = imageBox.x + imageBox.width + 40;
    const y = imageBox.y + 30;
    expect(x, "the click must land inside the canvas, right of the image").toBeLessThan(
      canvasBox.x + canvasBox.width - 200,
    );
    await on.page.mouse.click(x, y);
    const input = on.page.getByPlaceholder("Type…");
    await expect(input).toBeVisible();
    await input.pressSequentially("Outside the image");
    // Enter commits; Escape would cancel the label.
    await input.press("Enter");
    await expect(input).toBeHidden();
    await on.shot("text-outside");
    const withText = await copyToClipboard(on);
    await save(on, "text-outside.png", withText);
    const textResult = {
      imageFlagOff: { width: offPlain.width, height: offPlain.height },
      textOutside: { width: withText.width, height: withText.height },
      widerThanImage: withText.width > offPlain.width,
      atLeastAsTall: withText.height >= offPlain.height,
    };
    await writeFile(path.join(on.outDir, "text-outside.json"), JSON.stringify(textResult, null, 2));
    console.log(`[verify] image-canvas: text-outside.json ${JSON.stringify(textResult)}`);
    expect(withText.width).toBeGreaterThan(offPlain.width);
    expect(withText.height).toBeGreaterThanOrEqual(offPlain.height);

    // E. Zoom out twice, pan with the wheel, then the export-frame (Crop) tool.
    const zoomOut = on.page.getByRole("button", { name: "Zoom out", exact: true });
    await zoomOut.click();
    await zoomOut.click();
    await on.shot("zoomed-out");
    await on.page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
    await on.page.mouse.wheel(200, 0);
    await expect(on.page.locator('[data-canvas="true"]')).toHaveAttribute("data-panned", "true");
    await on.shot("panned");
    await on.page.getByRole("button", { name: "Crop", exact: true }).click();
    await on.shot("export-frame-tool");
  } finally {
    await on.finish();
  }
});
