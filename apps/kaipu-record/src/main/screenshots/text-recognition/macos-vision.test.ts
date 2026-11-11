import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MacVisionTextRecognizer, TEXT_RECOGNITION_HELPER_VERSION } from "./macos-vision";

const directories: string[] = [];
beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

/** A fake helper: a node script that answers --version and --stdin like the real one. */
async function helper(opts: { version?: string; stdin: string }) {
  const directory = await mkdtemp(join(tmpdir(), "kaipu-text-recognition-"));
  directories.push(directory);
  const path = join(directory, "helper");
  const body = `
if (process.argv[2] === "--version") { console.log(${JSON.stringify(opts.version ?? TEXT_RECOGNITION_HELPER_VERSION)}); process.exit(0); }
process.stdin.resume();
process.stdin.on("end", () => { ${opts.stdin} });
`;
  await writeFile(path, `#!/usr/bin/env node\n${body}`, { mode: 0o700 });
  return path;
}

const png = new Uint8Array([137, 80, 78, 71]);
const word = { text: "Hello", rect: { x: 1, y: 2, w: 30, h: 10 }, line: 0, confidence: 0.9 };

it("returns the words of a valid helper output", async () => {
  const helperPath = await helper({
    stdin: `console.log(JSON.stringify({ version: 1, width: 100, height: 50, words: [${JSON.stringify(word)}] }));`,
  });
  const result = await new MacVisionTextRecognizer({ helperPath }).recognize(png);
  expect(result).toEqual([word]);
});

it("receives the png on stdin", async () => {
  const helperPath = await helper({
    stdin: `console.log(JSON.stringify({ version: 1, width: 1, height: 1, words: [] }));`,
  });
  expect(await new MacVisionTextRecognizer({ helperPath }).recognize(png)).toEqual([]);
});

it("is unavailable when the output is off-schema", async () => {
  const helperPath = await helper({
    stdin: `console.log(JSON.stringify({ version: 1, words: [{ text: "", rect: {}, line: -1 }] }));`,
  });
  expect(await new MacVisionTextRecognizer({ helperPath }).recognize(png)).toBe("unavailable");
});

it("is unavailable when the output is not JSON or has another version", async () => {
  const notJson = await helper({ stdin: `console.log("nope");` });
  expect(await new MacVisionTextRecognizer({ helperPath: notJson }).recognize(png)).toBe(
    "unavailable",
  );
  const v2 = await helper({ stdin: `console.log(JSON.stringify({ version: 2, words: [] }));` });
  expect(await new MacVisionTextRecognizer({ helperPath: v2 }).recognize(png)).toBe("unavailable");
});

it("is unavailable when the helper exits non-zero", async () => {
  const helperPath = await helper({ stdin: `console.error("boom"); process.exit(1);` });
  expect(await new MacVisionTextRecognizer({ helperPath }).recognize(png)).toBe("unavailable");
});

it("kills a helper that outlives the timeout", async () => {
  const helperPath = await helper({ stdin: `setInterval(() => {}, 1000);` });
  const started = Date.now();
  const result = await new MacVisionTextRecognizer({ helperPath, timeoutMs: 300 }).recognize(png);
  expect(result).toBe("unavailable");
  expect(Date.now() - started).toBeLessThan(5000);
});

it("is unavailable when the binary is missing", async () => {
  const helperPath = join(tmpdir(), "kaipu-missing-helper-binary");
  expect(await new MacVisionTextRecognizer({ helperPath }).recognize(png)).toBe("unavailable");
});

it("refuses a helper with another version, and checks the version only once", async () => {
  const helperPath = await helper({
    version: "kaipu-text-recognition/0",
    stdin: `console.log(JSON.stringify({ version: 1, words: [] }));`,
  });
  const recognizer = new MacVisionTextRecognizer({ helperPath });
  expect(await recognizer.recognize(png)).toBe("unavailable");
  expect(await recognizer.recognize(png)).toBe("unavailable");
  expect(console.warn).toHaveBeenCalledTimes(1);
});

it("checks the version again after a transient failure", async () => {
  const helperPath = await helper({
    stdin: `console.log(JSON.stringify({ version: 1, words: [] }));`,
  });
  const realSpawn = (await import("node:child_process")).spawn;
  let calls = 0;
  const spawnImpl = ((...args: Parameters<typeof realSpawn>) => {
    calls += 1;
    if (calls === 1) throw Object.assign(new Error("busy"), { code: "EAGAIN" });
    return realSpawn(...args);
  }) as typeof realSpawn;
  const recognizer = new MacVisionTextRecognizer({ helperPath, spawnImpl });
  expect(await recognizer.recognize(png)).toBe("unavailable");
  expect(await recognizer.recognize(png)).toEqual([]);
});

it("does not spawn --version again once the version is refused", async () => {
  const helperPath = await helper({
    version: "kaipu-text-recognition/0",
    stdin: `console.log(JSON.stringify({ version: 1, words: [] }));`,
  });
  const realSpawn = (await import("node:child_process")).spawn;
  const versionSpawns: string[][] = [];
  const spawnImpl = ((...args: Parameters<typeof realSpawn>) => {
    if (args[1]?.[0] === "--version") versionSpawns.push([...args[1]]);
    return realSpawn(...args);
  }) as typeof realSpawn;
  const recognizer = new MacVisionTextRecognizer({ helperPath, spawnImpl });
  await recognizer.recognize(png);
  await recognizer.recognize(png);
  expect(versionSpawns).toHaveLength(1);
});

it("kills a helper that prints more than the output cap", async () => {
  const helperPath = await helper({
    stdin: `const big = "x".repeat(1 << 20); for (let i = 0; i < 20; i++) process.stdout.write(big); setInterval(() => {}, 1000);`,
  });
  expect(await new MacVisionTextRecognizer({ helperPath }).recognize(png)).toBe("unavailable");
});
