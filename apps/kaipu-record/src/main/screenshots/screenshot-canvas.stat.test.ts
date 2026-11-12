import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryVault } from "../library/library-vault";
import { statCanvas } from "./screenshot-canvas";

describe("statCanvas", () => {
  let directory: string;
  let vault: LibraryVault;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "kaipu-canvas-stat-"));
    vault = new LibraryVault(directory);
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("is null when no document is stored", async () => {
    expect(await statCanvas(vault, "S")).toBeNull();
  });

  it("returns the time the document was last written, even if its content is corrupt", async () => {
    const file = vault.companionPaths("S").canvasDoc;
    await mkdir(join(directory, ".kaipu"), { recursive: true });
    await writeFile(file, "{not json");
    const when = new Date("2026-11-11T11:56:00Z");
    await utimes(file, when, when);
    expect(await statCanvas(vault, "S")).toEqual({ savedAt: when.getTime() });
  });

  it("is null for an id that would leave the metadata folder", async () => {
    expect(await statCanvas(vault, "../.kaipu/S")).toBeNull();
  });

  it("rejects with the error code when the stat fails for a reason other than a missing document", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // A regular file where the metadata folder should be: stat fails with ENOTDIR, not ENOENT.
    await writeFile(join(directory, ".kaipu"), "not a folder");
    const error = await statCanvas(vault, "S").catch((e: Error) => e);
    expect(error).toMatchObject({ code: "ENOTDIR" });
    // The message carries the code, never a path.
    expect((error as Error).message).toBe("canvas document stat failed: ENOTDIR");
  });
});
