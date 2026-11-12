import { spawn } from "node:child_process";

/** Largest stdout a recognition backend may print; more is treated as a broken backend. */
export const MAX_STDOUT_BYTES = 16 * 1024 * 1024;
/** How much of stderr is kept for the "unavailable" log line, when a backend asks for it. */
const MAX_STDERR_BYTES = 2048;

export interface HelperRunResult {
  ok: boolean;
  stdout: string;
  reason?: string;
  /** The executable does not exist; no retry can change that. */
  missing?: boolean;
}

export interface HelperRunOptions {
  command: string;
  args: string[];
  input: Uint8Array | undefined;
  timeoutMs: number;
  spawnImpl: typeof spawn;
  /** Keep the start of stderr and append it to a failure reason. Off: stderr is ignored. */
  keepStderr?: boolean;
}

/**
 * Runs one recognition backend process: writes `input` to its stdin, collects stdout up to
 * `MAX_STDOUT_BYTES`, kills it after `timeoutMs`. Never rejects.
 */
export function runHelperProcess(options: HelperRunOptions): Promise<HelperRunResult> {
  const { command, args, input, timeoutMs, spawnImpl, keepStderr = false } = options;
  return new Promise((resolve) => {
    let settled = false;
    const chunks: Buffer[] = [];
    let size = 0;
    let stderr = "";
    let child: ReturnType<typeof spawn> | undefined;
    const finish = (result: HelperRunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const withStderr = (reason: string) => {
      const detail = stderr.trim().replace(/\s+/g, " ");
      return keepStderr && detail ? `${reason}: ${detail}` : reason;
    };
    const timer = setTimeout(() => {
      child?.kill("SIGKILL");
      finish({ ok: false, stdout: "", reason: `timed out after ${timeoutMs} ms` });
    }, timeoutMs);
    try {
      child = spawnImpl(command, args, {
        stdio: ["pipe", "pipe", keepStderr ? "pipe" : "ignore"],
        windowsHide: true,
      });
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
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < MAX_STDERR_BYTES) {
        stderr += chunk.toString("utf8").slice(0, MAX_STDERR_BYTES - stderr.length);
      }
    });
    child.on("close", (code) => {
      if (code === 0) finish({ ok: true, stdout: Buffer.concat(chunks).toString("utf8") });
      else finish({ ok: false, stdout: "", reason: withStderr(`exit code ${code}`) });
    });
    // A process that exits before reading stdin raises EPIPE; the exit code reports it.
    child.stdin?.on("error", () => {});
    if (input) child.stdin?.end(input);
    else child.stdin?.end();
  });
}

function errorCode(error: unknown): string {
  return (error as NodeJS.ErrnoException)?.code ?? "unknown";
}
