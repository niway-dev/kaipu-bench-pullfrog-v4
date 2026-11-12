import type { RecognizedWord, TextRecognizer } from "@kaipu/domain/schemas";

/** What `KAIPU_TEXT_RECOGNITION` asks for: always unavailable, or a pause before the real run. */
export type TextRecognitionOverride = { kind: "unavailable" } | { kind: "delay"; ms: number };

/** The longest pause accepted: the catalog uses 60 s to hold the "reading" state. */
const MAX_DELAY_MS = 10 * 60_000;

/**
 * Parses `KAIPU_TEXT_RECOGNITION` (`unavailable` or `delay:<ms>`), for the UI state catalog
 * and local checks. Unpackaged builds only, like `KAIPU_FLAG_OVERRIDES`: a packaged app
 * ignores it. An unset variable is no override and no noise; a bad value is no override
 * and is reported through `rejected` so the caller logs it once.
 */
export function parseTextRecognitionOverride(
  raw: string | undefined,
  opts: { isPackaged: boolean },
): { override: TextRecognitionOverride | null; rejected: string | null } {
  if (opts.isPackaged || raw === undefined || raw === "") return { override: null, rejected: null };
  const value = raw.trim();
  if (value === "unavailable") return { override: { kind: "unavailable" }, rejected: null };
  const match = /^delay:(\d+)$/.exec(value);
  if (match) {
    const ms = Number(match[1]);
    if (ms <= MAX_DELAY_MS) return { override: { kind: "delay", ms }, rejected: null };
  }
  return { override: null, rejected: raw };
}

/** `recognizer` with the override applied. */
export function withTextRecognitionOverride(
  recognizer: TextRecognizer,
  override: TextRecognitionOverride | null,
): TextRecognizer {
  if (!override) return recognizer;
  if (override.kind === "unavailable") {
    return {
      async recognize(): Promise<RecognizedWord[] | "unavailable"> {
        return "unavailable";
      },
    };
  }
  return {
    async recognize(...args: Parameters<TextRecognizer["recognize"]>) {
      await new Promise((resolve) => setTimeout(resolve, override.ms));
      return recognizer.recognize(...args);
    },
  };
}
