import { stat } from "node:fs/promises";
import type { TextRecognizer } from "@kaipu/domain/schemas";
import { warmUpPng } from "./warm-up-image";

/** How long after launch the warm-up waits, so it never competes with startup. */
export const WARM_UP_IDLE_DELAY_MS = 8_000;

export interface WarmUpDeps {
  /** The ungated recognizer: the gate waits for the warm-up, so using it here would deadlock. */
  recognizer: TextRecognizer;
  platform: NodeJS.Platform;
  /** Whether the helper binary is there. */
  helperPresent: () => Promise<boolean>;
  /** Runs `run` once the app has been idle for a few seconds. */
  scheduleIdle: (run: () => void) => void;
}

/**
 * Pays Vision's first-use model compile (13-20 s) in the background, so the editor's first
 * recognition takes the warm 0.5-0.9 s. It runs once per launch, when both the idle delay
 * has passed and the `image-text` flag is on (main learns the flag from the renderer, which
 * can resolve it after the delay). There is no stamp that skips it: macOS can drop Vision's
 * compiled model (OS update, maybe a reboot) while the helper binary is unchanged, and a warm
 * run costs only 0.5-0.9 s in the background. Failures are never user-facing.
 */
export class TextRecognitionWarmUp {
  private idle = false;
  private enabled = false;
  private started = false;
  private running: Promise<void> = Promise.resolve();

  constructor(private readonly deps: WarmUpDeps) {}

  start(): void {
    if (this.deps.platform !== "darwin") return;
    this.deps.scheduleIdle(() => {
      this.idle = true;
      this.maybeRun();
    });
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.maybeRun();
  }

  /**
   * An editor recognition already started the helper cold on its own, so a later warm-up
   * would only spawn a second process for a model that is compiling anyway.
   */
  noteEditorRecognition(): void {
    this.started = true;
  }

  /** Resolves when no warm-up is running (immediately when none is). Never rejects. */
  whenSettled(): Promise<void> {
    return this.running;
  }

  private maybeRun(): void {
    if (this.started || !this.idle || !this.enabled) return;
    this.started = true;
    this.running = this.run().catch((error) =>
      console.warn("[text-recognition] warm-up failed:", error),
    );
  }

  private async run(): Promise<void> {
    if (!(await this.deps.helperPresent())) return;
    await this.deps.recognizer.recognize(warmUpPng());
  }
}

/**
 * A recognizer whose calls wait for a running warm-up, so an editor request that arrives
 * during it queues behind the cold run instead of starting a second cold helper process.
 */
export function withWarmUpGate(
  recognizer: TextRecognizer,
  warmUp: TextRecognitionWarmUp,
): TextRecognizer {
  return {
    async recognize(png) {
      await warmUp.whenSettled();
      warmUp.noteEditorRecognition();
      return recognizer.recognize(png);
    },
  };
}

/** Real-filesystem check for the helper binary. */
export function fileHelperPresent(helperPath: string): () => Promise<boolean> {
  return () =>
    stat(helperPath).then(
      (info) => info.isFile(),
      () => false,
    );
}
