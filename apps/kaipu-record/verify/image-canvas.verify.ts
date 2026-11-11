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

/** Rightmost column holding a pixel that is not the white (#ffffff) fill, or -1 when none. */
function rightmostInkColumn(clip: Clip): number {
  for (let x = clip.width - 1; x >= 0; x -= 1) {
    for (let y = 0; y < clip.height; y += 1) {
      const i = (y * clip.width + x) * 4;
      const [a, b, c, alpha] = [
        clip.bitmap[i],
        clip.bitmap[i + 1],
        clip.bitmap[i + 2],
        clip.bitmap[i + 3],
      ];
      if (alpha !== 0 && (a !== 255 || b !== 255 || c !== 255)) return x;
    }
  }
  return -1;
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
  const onParity = await startScenario("image-canvas", {
    env: FLAG_ON,
    keepOutput: true,
    shotOffset: 1,
    videoName: "video-flag-on",
  });
  try {
    await openImageEditor(onParity);
    await expect(onParity.page.locator('[data-canvas="true"]')).toBeVisible();
    await onParity.shot("flag-on-editor");
    const onPlain = await copyToClipboard(onParity);
    await save(onParity, "flag-on.png", onPlain);
    await parity(onParity, "parity.json", offPlain, onPlain);

    // Same beautify clicks, then compare, then start from a clean editor for the rest.
    await beautify(onParity.page);
    const onBeautified = await copyToClipboard(onParity);
    await save(onParity, "flag-on-beautified.png", onBeautified);
    await parity(onParity, "parity-beautified.json", offBeautified, onBeautified);
  } finally {
    await onParity.finish();
  }

  // Launch 3: flag on, fresh vault. The editor autosaves into the stored PNG, so D and E
  // start from a clean, non-beautified image.
  const on = await startScenario("image-canvas", {
    env: FLAG_ON,
    keepOutput: true,
    shotOffset: 2,
    videoName: "video-flag-on-text",
  });
  try {
    await openImageEditor(on);
    await expect(on.page.locator('[data-canvas="true"]')).toBeVisible();
    await on.page.getByRole("button", { name: "Copy", exact: true }).waitFor();
    const offPlainSize = { width: offPlain.width, height: offPlain.height };

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
    const shotBefore = await on.page.locator('[data-canvas="true"] img').first().boundingBox();
    if (!shotBefore) throw new Error("shot has no box before the text");
    await on.page.mouse.click(x, y);
    const input = on.page.getByPlaceholder("Type…");
    await expect(input).toBeVisible();
    await input.pressSequentially("WWWWWWWWWW outside");
    // Enter commits; Escape would cancel the label.
    await input.press("Enter");
    await expect(input).toBeHidden();
    await on.shot("text-outside");
    const shotAfter = await on.page.locator('[data-canvas="true"] img').first().boundingBox();
    if (!shotAfter) throw new Error("shot has no box after the text");
    const noJump = {
      before: shotBefore,
      after: shotAfter,
      dx: shotAfter.x - shotBefore.x,
      dy: shotAfter.y - shotBefore.y,
    };
    await writeFile(path.join(on.outDir, "no-jump.json"), JSON.stringify(noJump, null, 2));
    console.log(`[verify] image-canvas: no-jump.json ${JSON.stringify(noJump)}`);
    const withText = await copyToClipboard(on);
    await save(on, "text-outside.png", withText);
    const inkColumn = rightmostInkColumn(withText);
    const textResult = {
      width: withText.width,
      height: withText.height,
      rightmostInkColumn: inkColumn,
      marginToRightEdge: withText.width - 1 - inkColumn,
      imageFlagOff: offPlainSize,
      textOutside: { width: withText.width, height: withText.height },
      widerThanImage: withText.width > offPlain.width,
      atLeastAsTall: withText.height >= offPlain.height,
    };
    await writeFile(path.join(on.outDir, "text-outside.json"), JSON.stringify(textResult, null, 2));
    console.log(`[verify] image-canvas: text-outside.json ${JSON.stringify(textResult)}`);
    expect(withText.width).toBeGreaterThan(offPlain.width);
    expect(withText.height).toBeGreaterThanOrEqual(offPlain.height);
    expect(inkColumn, "the copy has ink").toBeGreaterThanOrEqual(0);
    expect(
      withText.width - 1 - inkColumn,
      "the text must not be clipped at the right edge (>= 8 px margin)",
    ).toBeGreaterThanOrEqual(8);
    expect(Math.abs(noJump.dx), "shot x moved when extents changed").toBeLessThanOrEqual(2);
    expect(Math.abs(noJump.dy), "shot y moved when extents changed").toBeLessThanOrEqual(2);

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
