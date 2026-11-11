import { useEffect, useRef, useState } from "react";
import type { RecognizedWord } from "@kaipu/domain/schemas";

/** What recognition has produced for the image the editor holds. */
export type RecognizedText =
  | { status: "pending" }
  | { status: "ready"; words: RecognizedWord[] }
  | { status: "unavailable" };

interface Run {
  getBytes: () => Promise<ArrayBuffer>;
  assetId: string;
  promise: Promise<RecognizedText>;
}

/**
 * Recognizes the text of the image the editor opened, once per (image bytes, asset id).
 *
 * `getBytes` is the editor's cached read of the image exactly as loaded (before any unsaved
 * edit), so its identity names the image: a new image is a new function. The saved item's id
 * is read through `getId` at the moment the call goes out and never restarts the run, so the
 * id a first save creates does not trigger a second recognition. Recognition never throws and
 * never blocks the canvas: it is pending until it settles, and a result for an image that has
 * since been replaced is dropped.
 *
 * Disabled (flag off, image not loaded) it is `pending` and calls nothing.
 */
export function useRecognizedText(opts: {
  enabled: boolean;
  getBytes: (() => Promise<ArrayBuffer>) | null;
  assetId: string;
  getId: () => string | null;
}): RecognizedText {
  const { enabled, getBytes, assetId, getId } = opts;
  const [text, setText] = useState<RecognizedText>({ status: "pending" });
  const getIdRef = useRef(getId);
  getIdRef.current = getId;
  // Keeps the one run per image across effect re-runs (StrictMode mounts twice).
  const runRef = useRef<Run | null>(null);

  useEffect(() => {
    if (!enabled || !getBytes) return;
    let run = runRef.current;
    if (!run || run.getBytes !== getBytes || run.assetId !== assetId) {
      const promise: Promise<RecognizedText> = (async () => {
        try {
          const png = await getBytes();
          const result = await window.electronAPI.recognizeScreenshotText({
            id: getIdRef.current(),
            assetId,
            png,
          });
          return result.status === "ready"
            ? { status: "ready" as const, words: result.words }
            : { status: "unavailable" as const };
        } catch {
          // The image could not be read, or the call itself failed: no text, not a crash.
          return { status: "unavailable" as const };
        }
      })();
      run = { getBytes, assetId, promise };
      runRef.current = run;
    }
    let live = true;
    setText((prev) => (prev.status === "pending" ? prev : { status: "pending" }));
    void run.promise.then((result) => {
      if (live) setText(result);
    });
    return () => {
      live = false;
    };
  }, [enabled, getBytes, assetId]);

  return text;
}
