import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  WINDOWS_OCR_SCRIPT,
  WindowsOcrTextRecognizer,
  windowsOcrArgs,
  windowsPowerShellPath,
} from "./windows-ocr";

// These tests replace PowerShell with a node script, so they prove the process contract
// (stdin, exit code, stderr, schema, timeout), never Windows.Media.Ocr itself. The script is
// run for real only on a Windows runner: .github/workflows/text-recognition-windows.yml.

const directories: string[] = [];
let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

/** A stand-in for powershell.exe: `body` runs once stdin has ended, with it in `input`. */
async function fakePowerShell(body: string): Promise<WindowsOcrTextRecognizer> {
  const directory = await mkdtemp(join(tmpdir(), "kaipu-windows-ocr-"));
  directories.push(directory);
  const path = join(directory, "fake-powershell.cjs");
  await writeFile(
    path,
    `let input = "";
process.stdin.setEncoding("ascii");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => { ${body} });
`,
  );
  return new WindowsOcrTextRecognizer({ command: process.execPath, args: [path] });
}

const png = new Uint8Array([137, 80, 78, 71, 0, 255, 10, 13]);
const word = { text: "Hello", rect: { x: 1, y: 2, w: 30, h: 10 }, line: 0, confidence: 1 };

it("sends the png as base64 on stdin and returns the words it prints", async () => {
  const recognizer = await fakePowerShell(`
const bytes = Buffer.from(input.trim(), "base64");
if (!bytes.equals(Buffer.from(${JSON.stringify([...png])}))) process.exit(3);
process.stdout.write(JSON.stringify({ version: 1, width: 100, height: 50, words: [${JSON.stringify(word)}] }));
`);
  expect(await recognizer.recognize(png)).toEqual([word]);
});

it("returns an empty list when the image has no text", async () => {
  const recognizer = await fakePowerShell(
    `process.stdout.write(JSON.stringify({ version: 1, width: 1, height: 1, words: [] }));`,
  );
  expect(await recognizer.recognize(png)).toEqual([]);
});

it("is unavailable, with the script's error in the log, when it exits non-zero", async () => {
  const recognizer = await fakePowerShell(
    `process.stderr.write("no OCR language pack is installed\\n"); process.exit(1);`,
  );
  expect(await recognizer.recognize(png)).toBe("unavailable");
  expect(String(warn.mock.calls[0]?.[0])).toContain("no OCR language pack is installed");
});

it("is unavailable when the output is not JSON, off-schema, or another version", async () => {
  for (const body of [
    `process.stdout.write("WARNING: something");`,
    `process.stdout.write(JSON.stringify({ version: 1, words: [{ text: "", rect: {}, line: -1 }] }));`,
    `process.stdout.write(JSON.stringify({ version: 2, words: [] }));`,
  ]) {
    expect(await (await fakePowerShell(body)).recognize(png)).toBe("unavailable");
  }
});

it("is unavailable when PowerShell does not exist", async () => {
  const recognizer = new WindowsOcrTextRecognizer({
    command: join(tmpdir(), "kaipu-no-such-powershell.exe"),
  });
  expect(await recognizer.recognize(png)).toBe("unavailable");
});

it("is unavailable when the script does not answer in time", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kaipu-windows-ocr-"));
  directories.push(directory);
  const path = join(directory, "hang.cjs");
  await writeFile(path, `setInterval(() => {}, 1000);`);
  const recognizer = new WindowsOcrTextRecognizer({
    command: process.execPath,
    args: [path],
    timeoutMs: 300,
  });
  expect(await recognizer.recognize(png)).toBe("unavailable");
  expect(String(warn.mock.calls[0]?.[0])).toContain("timed out");
});

it("runs Windows PowerShell 5.1 by absolute path, never pwsh", () => {
  expect(windowsPowerShellPath({ SystemRoot: "C:\\Windows" })).toBe(
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  );
  expect(windowsPowerShellPath({})).toBe("powershell.exe");
});

it("passes the script as -EncodedCommand, within the Windows command line limit", () => {
  const args = windowsOcrArgs();
  expect(args.slice(0, -1)).toEqual([
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-EncodedCommand",
  ]);
  const encoded = args.at(-1) ?? "";
  expect(Buffer.from(encoded, "base64").toString("utf16le")).toBe(WINDOWS_OCR_SCRIPT);
  // CreateProcess caps the whole command line at 32,767 characters.
  const commandLine = [windowsPowerShellPath({ SystemRoot: "C:\\Windows" }), ...args].join(" ");
  expect(commandLine.length).toBeLessThan(32_767);
});
