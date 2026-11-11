import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { dismissOnboarding, SCREENSHOT_ASSET_ID } from "../e2e/helpers/launch";
import { startScenario, type Scenario } from "./helpers";

/**
 * NIW2-704, the colors panel in the real app:
 *
 * - a 5K synthetic photograph (gradients plus noise: millions of distinct colors) — the main
 *   thread must not run a task longer than 100 ms from the Colors click to the list, nor from a
 *   color click to its highlight;
 * - a UI-like shot with two near-identical whites — they must be listed side by side, and
 *   clicking one must highlight exactly its pixels;
 * - both with the `image-canvas` flag off and on.
 *
 * `COLORS_BEFORE=1` only opens Inspect and shoots its bar, for the "before" on a commit
 * without the panel.
 */

const SCENARIO = "image-colors";
const BEFORE = process.env.COLORS_BEFORE === "1";
const PANEL = '[data-ui-area="editorImage.inspectColors"]';
const LONG_TASK_LIMIT_MS = 100;
const FLAGS = (canvas: boolean): Record<string, string> => ({
  KAIPU_FLAG_OVERRIDES: JSON.stringify({ "image-inspect": true, "image-canvas": canvas }),
});

// ── A minimal RGBA PNG encoder (filter 0 on every row) ──────────────────────

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(
      raw,
      y * (width * 4 + 1) + 1,
    );
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 1 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** 5120x2880: smooth gradients with per-pixel noise, like a photograph's sensor grain. */
function photograph(): { width: number; height: number; png: Buffer } {
  const width = 5120;
  const height = 2880;
  const rgba = new Uint8Array(width * height * 4);
  let seed = 7;
  const noise = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return ((seed >>> 24) & 31) - 16;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      rgba[i] = Math.max(0, Math.min(255, (x / width) * 255 + noise()));
      rgba[i + 1] = Math.max(0, Math.min(255, (y / height) * 255 + noise()));
      rgba[i + 2] = Math.max(0, Math.min(255, 128 + 100 * Math.sin(x / 300 + y / 500) + noise()));
      rgba[i + 3] = 255;
    }
  }
  return { width, height, png: encodePng(width, height, rgba) };
}

/**
 * 1200x800, a settings-page look: a #ffffff page, a #fafafa card (the white nobody meant to
 * add), dark text bars and a blue button.
 */
const UI_CARD = { x: 200, y: 160, w: 800, h: 480 };
function uiShot(): { width: number; height: number; png: Buffer } {
  const width = 1200;
  const height = 800;
  const rgba = new Uint8Array(width * height * 4);
  const fill = (x0: number, y0: number, w: number, h: number, c: [number, number, number]) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) rgba.set([...c, 255], (y * width + x) * 4);
    }
  };
  fill(0, 0, width, height, [255, 255, 255]);
  fill(UI_CARD.x, UI_CARD.y, UI_CARD.w, UI_CARD.h, [250, 250, 250]);
  for (let row = 0; row < 6; row++) fill(260, 220 + row * 56, 420 - row * 30, 18, [33, 37, 41]);
  fill(260, 560, 180, 48, [37, 99, 235]);
  fill(0, 0, width, 64, [33, 37, 41]);
  return { width, height, png: encodePng(width, height, rgba) };
}

function seed(png: Buffer, title: string) {
  return async (vaultDir: string): Promise<void> => {
    await mkdir(path.join(vaultDir, ".kaipu"), { recursive: true });
    await writeFile(path.join(vaultDir, "colors-fixture.png"), png);
    await writeFile(
      path.join(vaultDir, ".kaipu", "colors-fixture.json"),
      JSON.stringify({
        sidecarVersion: 2,
        assetId: SCREENSHOT_ASSET_ID,
        title,
        createdAt: 1_700_000_000_000,
      }),
    );
  };
}

async function openInspect(s: Scenario): Promise<void> {
  await dismissOnboarding(s.page);
  await s.page.evaluate((id) => (location.hash = `#/editor/image/${id}`), SCREENSHOT_ASSET_ID);
  await expect(s.page.getByRole("button", { name: /^Save/ })).toBeEnabled({ timeout: 30_000 });
  await s.page.getByRole("button", { name: "Inspect (I)" }).click();
  await expect(s.page.locator('[data-ui-area="editorImage.inspectBar"]')).toBeVisible();
  // The decode (M1) finishes before the panel is measured: it is not this milestone's cost.
  await expect(s.page.getByText("Reading pixels…")).toHaveCount(0, { timeout: 60_000 });
}

/**
 * Main-thread stalls, from a heartbeat: a 5 ms timer records every gap over 50 ms between its
 * ticks, which is how long the thread was blocked. (`PerformanceObserver` with `longtask`
 * reports nothing in this Electron, so it cannot be the measure.)
 */
async function startLongTasks(s: Scenario): Promise<void> {
  await s.page.evaluate(() => {
    const w = window as unknown as { __longTasks: number[] };
    w.__longTasks = [];
    let last = performance.now();
    const tick = (): void => {
      const now = performance.now();
      if (now - last > 50) w.__longTasks.push(Math.round(now - last));
      last = now;
      setTimeout(tick, 5);
    };
    setTimeout(tick, 5);
  });
  // Prove the heartbeat sees a stall: a 150 ms busy loop must show up as one.
  await s.page.evaluate(() => {
    const end = performance.now() + 150;
    while (performance.now() < end) {
      // busy
    }
  });
  await expect
    .poll(async () => Math.max(0, ...(await takeLongTasks(s))), { timeout: 5_000 })
    .toBeGreaterThanOrEqual(150);
  await s.page.waitForTimeout(200);
  await takeLongTasks(s);
}
const takeLongTasks = (s: Scenario): Promise<number[]> =>
  s.page.evaluate(() => {
    const w = window as unknown as { __longTasks: number[] };
    const out = w.__longTasks;
    w.__longTasks = [];
    return out;
  });

const shot = (s: Scenario, name: string): Promise<Buffer> =>
  s.page.screenshot({ path: path.join(s.outDir, `${name}.png`) });

const results: Record<string, unknown> = {};
// Every launch after the first keeps the shots of the earlier ones.
let launches = 0;
const keepOutput = (): boolean => launches++ > 0;
const failures: string[] = [];

async function photographRun(canvas: boolean): Promise<void> {
  const tag = canvas ? "canvas-on" : "canvas-off";
  const fixture = photograph();
  const s = await startScenario(SCENARIO, {
    env: FLAGS(canvas),
    keepOutput: keepOutput(),
    videoName: `video-photo-${tag}`,
    seedVault: seed(fixture.png, "Colors photograph"),
  });
  try {
    await openInspect(s);
    await startLongTasks(s);
    const t0 = Date.now();
    await s.page.getByRole("button", { name: "Colors", exact: true }).click();
    await expect(s.page.locator(PANEL)).toHaveAttribute("data-state", "list", { timeout: 30_000 });
    const listMs = Date.now() - t0;
    const listTasks = await takeLongTasks(s);
    await shot(s, `photo-${tag}-list`);

    const t1 = Date.now();
    await s.page.locator(`${PANEL} li > button`).first().click();
    await expect(s.page.locator("[data-testid='inspect-locate']")).toBeVisible({ timeout: 30_000 });
    const locateMs = Date.now() - t1;
    const locateTasks = await takeLongTasks(s);
    await shot(s, `photo-${tag}-located`);

    const summary = await s.page.locator(PANEL).locator("header").textContent();
    const maxTask = Math.max(0, ...listTasks, ...locateTasks);
    results[`photo-${tag}`] = { listMs, locateMs, listTasks, locateTasks, maxTask, summary };
    if (maxTask > LONG_TASK_LIMIT_MS) {
      failures.push(`photo ${tag}: a main-thread task took ${Math.round(maxTask)} ms`);
    }
  } finally {
    await s.finish();
  }
}

async function uiRun(canvas: boolean): Promise<void> {
  const tag = canvas ? "canvas-on" : "canvas-off";
  const fixture = uiShot();
  const s = await startScenario(SCENARIO, {
    env: FLAGS(canvas),
    keepOutput: keepOutput(),
    videoName: `video-ui-${tag}`,
    seedVault: seed(fixture.png, "Colors two whites"),
  });
  try {
    await openInspect(s);
    if (BEFORE) {
      await shot(s, `before-ui-${tag}-inspect`);
      results[`before-ui-${tag}`] = {
        colorsButtons: await s.page.getByRole("button", { name: "Colors", exact: true }).count(),
      };
      return;
    }
    await s.page.getByRole("button", { name: "Colors", exact: true }).click();
    await expect(s.page.locator(PANEL)).toHaveAttribute("data-state", "list", { timeout: 30_000 });
    await shot(s, `ui-${tag}-list`);
    await s.page.locator(PANEL).screenshot({ path: path.join(s.outDir, `ui-${tag}-panel.png`) });

    const white = s.page.getByTitle("Highlight only #ffffff");
    const card = s.page.getByTitle("Highlight only #fafafa");
    const sideBySide = (await white.count()) === 1 && (await card.count()) === 1;
    if (!sideBySide) failures.push(`ui ${tag}: #ffffff and #fafafa are not both listed`);

    await card.click();
    const overlay = s.page.locator("[data-testid='inspect-locate']");
    await expect(overlay).toBeVisible({ timeout: 10_000 });
    const matched = Number(await overlay.getAttribute("data-matched"));
    const expected = UI_CARD.w * UI_CARD.h - countCardInk();
    if (matched !== expected)
      failures.push(`ui ${tag}: #fafafa matched ${matched}, want ${expected}`);
    // The overlay covers exactly the image.
    const [imgBox, overlayBox] = await Promise.all([
      s.page.locator('[data-ui-area="editorImage.canvas"] img').first().boundingBox(),
      overlay.boundingBox(),
    ]);
    const aligned =
      !!imgBox &&
      !!overlayBox &&
      Math.abs(imgBox.x - overlayBox.x) < 1 &&
      Math.abs(imgBox.y - overlayBox.y) < 1 &&
      Math.abs(imgBox.width - overlayBox.width) < 1 &&
      Math.abs(imgBox.height - overlayBox.height) < 1;
    if (!aligned)
      failures.push(
        `ui ${tag}: overlay ${JSON.stringify(overlayBox)} vs image ${JSON.stringify(imgBox)}`,
      );
    await shot(s, `ui-${tag}-located-card`);

    // Zoom in: the highlight stays on the same pixels.
    await s.page.getByTitle(/^Zoom in/).click();
    await s.page.getByTitle(/^Zoom in/).click();
    await s.page.waitForTimeout(300);
    await shot(s, `ui-${tag}-located-zoomed`);

    results[`ui-${tag}`] = { sideBySide, matched, expected, aligned };
  } finally {
    await s.finish();
  }
}

/** Card pixels covered by the text bars and the button (not #fafafa). */
function countCardInk(): number {
  let ink = 0;
  for (let row = 0; row < 6; row++) ink += (420 - row * 30) * 18;
  return ink + 180 * 48;
}

test("image-colors: list, two whites, locate, 5K main-thread budget, canvas off and on", async () => {
  test.setTimeout(900_000);
  let outDir = "";
  try {
    for (const canvas of [false, true]) await uiRun(canvas);
    if (!BEFORE) for (const canvas of [false, true]) await photographRun(canvas);
  } finally {
    outDir = path.join(__dirname, "..", "test-results", "verify", SCENARIO);
    await mkdir(outDir, { recursive: true });
    await writeFile(
      path.join(outDir, BEFORE ? "results-before.json" : "results.json"),
      JSON.stringify({ results, failures }, null, 2),
    );
    console.log(`[verify] image-colors: ${JSON.stringify({ results, failures })}`);
  }
  expect(failures, failures.join("\n")).toEqual([]);
});
