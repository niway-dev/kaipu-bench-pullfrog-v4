/**
 * Runs the real Windows text recognition backend (`windows-ocr.ts`, ADR 0055) on two
 * 1920×1080 fixtures, checks what it recognized, and times every call end to end (PowerShell
 * start, WinRT load, decode, OCR, JSON). Windows only.
 *
 *   bun apps/kaipu-record/scripts/measure-windows-ocr.ts [report.json]
 *
 * Run by .github/workflows/text-recognition-windows.yml. "Cold" is the first call of this
 * script, before it touches PowerShell or WinRT for anything else: the first OCR this job
 * runs on a fresh runner VM. It is not a first run on a consumer machine, and the runner
 * image may have touched OCR while it was built. Exit code 1 when a check fails; the 1.5 s target is reported, not
 * enforced.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { cpus, release, totalmem } from "node:os";
import { join } from "node:path";
import { textOfWords, wordsInReadingOrder } from "@kaipu/domain/schemas";
import type { RecognizedWord } from "@kaipu/domain/schemas";
import {
  WindowsOcrTextRecognizer,
  windowsPowerShellPath,
} from "../src/main/screenshots/text-recognition/windows-ocr";

const TARGET_COLD_MS = 1500;
const WARM_RUNS = 4;
const fixtures = join(
  import.meta.dir,
  "..",
  "src",
  "main",
  "screenshots",
  "text-recognition",
  "fixtures",
);

if (process.platform !== "win32") {
  console.error("measure-windows-ocr runs on Windows only.");
  process.exit(2);
}

const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${message}`);
  if (!ok) failures.push(message);
};

function powershell(command: string): string {
  return execFileSync(
    windowsPowerShellPath(),
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command],
    { encoding: "utf8" },
  ).trim();
}

const recognizer = new WindowsOcrTextRecognizer();

async function timed(png: Uint8Array): Promise<{ ms: number; words: RecognizedWord[] }> {
  const started = performance.now();
  const result = await recognizer.recognize(png);
  const ms = Math.round(performance.now() - started);
  if (result === "unavailable") throw new Error("the backend answered unavailable");
  return { ms, words: result };
}

const runs: Record<string, number[]> = {};
const samples: Record<string, RecognizedWord[]> = {};
for (const name of ["settings-text-1080p.png", "settings-text-1080p-dense.png"]) {
  const png = new Uint8Array(readFileSync(join(fixtures, name)));
  runs[name] = [];
  for (let i = 0; i <= WARM_RUNS; i++) {
    try {
      const { ms, words } = await timed(png);
      runs[name].push(ms);
      samples[name] = words;
    } catch (error) {
      check(false, `${name} run ${i + 1}: ${(error as Error).message}`);
      break;
    }
  }
  console.log(`${name} (ms)`, runs[name].join(", "));
}

const machine = {
  os: release(),
  caption: powershell("(Get-CimInstance Win32_OperatingSystem).Caption"),
  cpu: cpus()[0]?.model ?? "unknown",
  cores: cpus().length,
  memoryGiB: Math.round(totalmem() / 2 ** 30),
  powershell: powershell("$PSVersionTable.PSVersion.ToString()"),
  profileLanguages: powershell("(Get-WinUserLanguageList).LanguageTag -join ','"),
  ocrLanguages: powershell(
    "$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]; ([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | ForEach-Object { $_.LanguageTag }) -join ','",
  ),
};
console.log("machine", JSON.stringify(machine));

// After the timed runs, so none of this warms the cold one. PowerShell start alone, to
// read how much of each call is the shell rather than OCR.
const shellStart: number[] = [];
for (let i = 0; i < 3; i++) {
  const started = performance.now();
  powershell("exit 0");
  shellStart.push(Math.round(performance.now() - started));
}
console.log("powershell start (ms)", shellStart.join(", "));

// The sparse fixture is settings-text.png (560×340) centered in 1920×1080: offset (680, 370).
const sparse = samples["settings-text-1080p.png"] ?? [];
const text = textOfWords(wordsInReadingOrder(sparse));
console.log("recognized text:\n" + text);
for (const line of [
  "Display settings",
  "Language: English",
  "Theme: Dark mode",
  "Frame rate: 60 fps",
  "Changes apply the next time you record",
  "Save changes",
]) {
  check(text.split("\n").includes(line), `line "${line}" recognized as one line`);
}
const display = sparse.find((word) => word.text === "Display");
check(
  display !== undefined &&
    Math.abs(display.rect.x - 708) <= 12 &&
    Math.abs(display.rect.y + display.rect.h / 2 - 394) <= 12,
  `"Display" box in source pixels near (708, 394 centre): ${JSON.stringify(display?.rect)}`,
);
check(
  sparse.every(
    (word) =>
      word.rect.x >= 680 &&
      word.rect.x + word.rect.w <= 1240 &&
      word.rect.y >= 370 &&
      word.rect.y + word.rect.h <= 710,
  ),
  "every box lies inside the card (680..1240 × 370..710)",
);
const dense = samples["settings-text-1080p-dense.png"] ?? [];
check(
  dense.filter((word) => word.text === "Display").length === 9,
  `dense fixture: 9 "Display" words (got ${dense.filter((word) => word.text === "Display").length})`,
);

// The sparse fixture rotated 10° clockwise about the image centre. Windows OCR reports such
// text deskewed, with TextAngle; the script must rotate the boxes back. "Display" (centre
// about (747, 394) upright) lands near (775, 359); unrotated boxes would stay near (747, 394).
try {
  const tilted = (
    await timed(new Uint8Array(readFileSync(join(fixtures, "settings-text-1080p-tilted.png"))))
  ).words;
  samples["settings-text-1080p-tilted.png"] = tilted;
  const word = tilted.find((candidate) => candidate.text === "Display");
  const centre = word && { x: word.rect.x + word.rect.w / 2, y: word.rect.y + word.rect.h / 2 };
  check(
    centre !== undefined && Math.abs(centre.x - 775) <= 20 && Math.abs(centre.y - 359) <= 20,
    `tilted fixture: "Display" box centre near (775, 359): ${JSON.stringify(centre)}`,
  );
} catch (error) {
  check(false, `tilted fixture: ${(error as Error).message}`);
}

const cold = runs["settings-text-1080p.png"]?.[0];
console.log(
  `cold ${cold ?? "n/a"} ms against the ${TARGET_COLD_MS} ms target: ${
    cold !== undefined && cold < TARGET_COLD_MS ? "under" : "OVER"
  }`,
);

const report = {
  machine,
  shellStartMs: shellStart,
  runsMs: runs,
  targetColdMs: TARGET_COLD_MS,
  failures,
  samples,
};
const out = process.argv[2];
if (out) writeFileSync(out, JSON.stringify(report, null, 2));
process.exit(failures.length === 0 ? 0 : 1);
