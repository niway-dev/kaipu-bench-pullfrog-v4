import { afterEach, expect, it } from "vitest";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTextRecognizer, textRecognitionHelperPath } from "./index";
import { MacVisionTextRecognizer } from "./macos-vision";
import { WindowsOcrTextRecognizer } from "./windows-ocr";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

it("resolves the packaged helper under app.asar.unpacked when no dev build exists", () => {
  expect(textRecognitionHelperPath("/Res", "/nowhere/app")).toBe(
    join("/Res", "app.asar.unpacked", "resources", "native", "kaipu-text-recognition"),
  );
});

it("prefers the dev build under the app path", async () => {
  const appPath = await mkdtemp(join(tmpdir(), "kaipu-text-recognition-app-"));
  directories.push(appPath);
  await mkdir(join(appPath, "resources", "native"), { recursive: true });
  const dev = join(appPath, "resources", "native", "kaipu-text-recognition");
  await writeFile(dev, "");
  expect(textRecognitionHelperPath("/Res", appPath)).toBe(dev);
});

it("returns a Vision recognizer on darwin", () => {
  expect(createTextRecognizer({ resourcesPath: "/Res", platform: "darwin" })).toBeInstanceOf(
    MacVisionTextRecognizer,
  );
});

it("returns a Windows.Media.Ocr recognizer on win32", () => {
  expect(createTextRecognizer({ resourcesPath: "/Res", platform: "win32" })).toBeInstanceOf(
    WindowsOcrTextRecognizer,
  );
});

it("is unavailable on every other platform", async () => {
  for (const platform of ["linux", "freebsd"] as const) {
    const recognizer = createTextRecognizer({ resourcesPath: "/Res", platform });
    expect(await recognizer.recognize(new Uint8Array([1]))).toBe("unavailable");
  }
});
