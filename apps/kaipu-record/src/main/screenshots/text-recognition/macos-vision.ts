import { spawn } from "node:child_process";
import { z } from "zod";
import { recognizedWordsSchema } from "@kaipu/domain/schemas";
import type { RecognizedWord, TextRecognizer } from "@kaipu/domain/schemas";

/** Bumped with native/text-recognition/main.swift when the protocol changes. */
export const TEXT_RECOGNITION_HELPER_VERSION = "kaipu-text-recognition/1";
/**
 * The first recognition on a machine compiles Vision's model and took 13.5 s in the M0
 * spike; warm runs take 0.2–0.6 s. A shorter timeout would turn first use into
 * "unavailable".
 */
const DEFAULT_TIMEOUT_MS = 45_000;
const VERSION_TIMEOUT_MS = 2_000;
const MAX_STDOUT_BYTES = 16 * 1024 * 1024;

const helperOutputSchema = z.object({
  version: z.literal(1),
  words: recognizedWordsSchema,
});

export interface MacVisionTextRecognizerOptions {
  helperPath: string;
  timeoutMs?: number;
  spawnImpl?: typeof spawn;
}

interface RunResult {
  ok: boolean;
  stdout: string;
  reason?: string;
  /** The helper binary does not exist; no retry can change that. */
  missing?: boolean;
}

export class MacVisionTextRecognizer implements TextRecognizer {
  private readonly helperPath: string;
  private readonly timeoutMs: number;
  private readonly spawnImpl: typeof spawn;
  private versionCheck: Promise<boolean> | undefined;

  constructor(options: MacVisionTextRecognizerOptions) {
    this.helperPath = options.helperPath;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.spawnImpl = options.spawnImpl ?? spawn;
  }

  async recognize(png: Uint8Array): Promise<RecognizedWord[] | "unavailable"> {
    try {
      this.versionCheck ??= this.checkVersion();
      if (!(await this.versionCheck)) return "unavailable";
      const result = await this.run(["--stdin"], png, this.timeoutMs);
      if (!result.ok) return this.unavailable(result.reason ?? "failed");
      let json: unknown;
      try {
        json = JSON.parse(result.stdout);
      } catch {
        return this.unavailable("output is not JSON");
      }
      const parsed = helperOutputSchema.safeParse(json);
      if (!parsed.success) return this.unavailable("output does not match the schema");
      return parsed.data.words;
    } catch (error) {
      return this.unavailable(error instanceof Error ? error.message : "unexpected error");
    }
  }

  private unavailable(reason: string): "unavailable" {
    console.warn(`[text-recognition] unavailable: ${reason}`);
    return "unavailable";
  }

  private async checkVersion(): Promise<boolean> {
    const result = await this.run(["--version"], undefined, VERSION_TIMEOUT_MS);
    if (!result.ok) {
      this.unavailable(`version check failed (${result.reason ?? "failed"})`);
      // Only a missing binary is a definitive answer; a timeout or another spawn error may
      // pass on the next call, so the check is not remembered.
      if (!result.missing) this.versionCheck = undefined;
      return false;
    }
    if (result.stdout.trim() !== TEXT_RECOGNITION_HELPER_VERSION) {
      this.unavailable("unsupported helper version");
      return false;
    }
    return true;
  }

  private run(
    args: string[],
    input: Uint8Array | undefined,
    timeoutMs: number,
  ): Promise<RunResult> {
    return new Promise((resolve) => {
      let settled = false;
      const chunks: Buffer[] = [];
      let size = 0;
      let child: ReturnType<typeof spawn> | undefined;
      const finish = (result: RunResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };
      const timer = setTimeout(() => {
        child?.kill("SIGKILL");
        finish({ ok: false, stdout: "", reason: `timed out after ${timeoutMs} ms` });
      }, timeoutMs);
      try {
        child = this.spawnImpl(this.helperPath, args, { stdio: ["pipe", "pipe", "ignore"] });
      } catch (error) {
        finish({
          ok: false,
          stdout: "",
          reason: `spawn failed (${errorCode(error)})`,
          missing: errorCode(error) === "ENOENT",
        });
        return;
      }
      child.on("error", (error) =>
        finish({
          ok: false,
          stdout: "",
          reason: `spawn failed (${errorCode(error)})`,
          missing: errorCode(error) === "ENOENT",
        }),
      );
      child.stdout?.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_STDOUT_BYTES) {
          child?.kill("SIGKILL");
          finish({ ok: false, stdout: "", reason: "output too large" });
          return;
        }
        chunks.push(chunk);
      });
      child.on("close", (code) => {
        if (code === 0) finish({ ok: true, stdout: Buffer.concat(chunks).toString("utf8") });
        else finish({ ok: false, stdout: "", reason: `exit code ${code}` });
      });
      // A helper that exits before reading stdin raises EPIPE; the exit code reports it.
      child.stdin?.on("error", () => {});
      if (input) child.stdin?.end(input);
      else child.stdin?.end();
    });
  }
}

function errorCode(error: unknown): string {
  return (error as NodeJS.ErrnoException)?.code ?? "unknown";
}
