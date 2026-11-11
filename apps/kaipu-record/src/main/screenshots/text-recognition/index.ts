import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RecognizedWord, TextRecognizer } from "@kaipu/domain/schemas";
import { MacVisionTextRecognizer } from "./macos-vision";

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
}): TextRecognizer {
  const platform = opts.platform ?? process.platform;
  // Windows.Media.Ocr arrives with milestone M10 (NIW2-707); until then it is unavailable.
  if (platform !== "darwin") return unavailableRecognizer;
  return new MacVisionTextRecognizer({
    helperPath: textRecognitionHelperPath(opts.resourcesPath, opts.appPath),
  });
}
