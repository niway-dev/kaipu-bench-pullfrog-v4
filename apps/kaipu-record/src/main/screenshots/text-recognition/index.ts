import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RecognizedWord, TextRecognizer } from "@kaipu/domain/schemas";
import { MacVisionTextRecognizer } from "./macos-vision";
import { WindowsOcrTextRecognizer } from "./windows-ocr";
import { parseTextRecognitionOverride, withTextRecognitionOverride } from "./dev-override";

const HELPER_NAME = "kaipu-text-recognition";

/** Same lookup as `nativeHelperPath` for the capture helper: dev tree first, then asar.unpacked. */
export function textRecognitionHelperPath(resourcesPath: string, appPath?: string): string {
  if (appPath) {
    for (const root of [appPath, join(appPath, "..", "..")]) {
      const dev = join(root, "resources", "native", HELPER_NAME);
      if (existsSync(dev)) return dev;
    }
  }
  return join(resourcesPath, "app.asar.unpacked", "resources", "native", HELPER_NAME);
}

const unavailableRecognizer: TextRecognizer = {
  async recognize(): Promise<RecognizedWord[] | "unavailable"> {
    return "unavailable";
  },
};

export function createTextRecognizer(opts: {
  resourcesPath: string;
  appPath?: string;
  platform?: NodeJS.Platform;
  /**
   * `KAIPU_TEXT_RECOGNITION` is honored only when this is explicitly `false` (an unpackaged
   * build), like `KAIPU_FLAG_OVERRIDES`; left out, it is treated as packaged and ignored.
   */
  isPackaged?: boolean;
  env?: NodeJS.ProcessEnv;
}): TextRecognizer {
  const { override, rejected } = parseTextRecognitionOverride(
    (opts.env ?? process.env).KAIPU_TEXT_RECOGNITION,
    { isPackaged: opts.isPackaged !== false },
  );
  if (rejected !== null) console.warn(`[text-recognition] override rejected: ${rejected}`);
  if (override) console.log(`[text-recognition] override active: ${JSON.stringify(override)}`);
  return withTextRecognitionOverride(createPlatformRecognizer(opts), override);
}

function createPlatformRecognizer(opts: {
  resourcesPath: string;
  appPath?: string;
  platform?: NodeJS.Platform;
}): TextRecognizer {
  const platform = opts.platform ?? process.platform;
  if (platform === "darwin") {
    return new MacVisionTextRecognizer({
      helperPath: textRecognitionHelperPath(opts.resourcesPath, opts.appPath),
    });
  }
  // Windows.Media.Ocr through Windows PowerShell; no helper to resolve (ADR 0055).
  if (platform === "win32") return new WindowsOcrTextRecognizer();
  return unavailableRecognizer;
}
