import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const ROOTS = [
  "pages/screenshot-editor",
  "features/screenshots/annotations",
  "features/screenshots/beautify",
  "features/screenshots/canvas",
  "features/screenshots/inspect",
  "features/screenshots/reopen",
  "features/screenshots/text-selection",
  "features/screenshots/export",
  "features/screenshots/toolbar",
  "features/screenshots/capture-title-input.module.css",
];

function modules(dir: string): string[] {
  if (dir.endsWith(".module.css")) return [dir];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return modules(full);
    return name.endsWith(".module.css") ? [full] : [];
  });
}

/** Global color/shadow variables the image editor must not read: it reads `--ie-*` only. */
const GLOBAL_COLOR =
  /var\(\s*--(bg-|text|line\s*[),]|border|accent|shadow|canvas-dot|danger|glow)[a-z0-9-]*/g;

/** Exceptions, by variable name, each with the reason it has no `--ie-*` equivalent. */
const ALLOWED: Record<string, string> = {
  "--accent-green": "status green (saved state); the mock defines no status colors",
  "--danger": "destructive red; the mock defines no status colors",
  "--accent-primary-hover": "hover shade of the accent; the mock defines only --ie-accent",
  "--glow-accent": "accent glow on the primary button; the mock defines no glow",
};

describe("image editor CSS reads only --ie-* colors", () => {
  const files = ROOTS.flatMap((r) => modules(join(SRC, r)));

  it("finds the module files", () => {
    expect(files.length).toBeGreaterThan(8);
  });

  it.each(files.map((f) => [relative(SRC, f), f]))("%s", (_name, file) => {
    const text = readFileSync(file as string, "utf8");
    const offenders = [...text.matchAll(GLOBAL_COLOR)]
      .map((m) => /--[a-z0-9-]+/.exec(m[0])![0])
      .filter((v) => !(v in ALLOWED));
    expect(offenders).toEqual([]);
  });
});
