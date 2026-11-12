/**
 * What reopening a saved screenshot found beside it (ADR 0053), in canvas mode:
 *
 * - `loaded`: a document that read, validated and has every asset: the editor mounts it, and
 *   says so (`savedAt` is when it was written, null if that could not be read);
 * - `absent`: no document: a plain screenshot, nothing to say;
 * - `unreadable`: a document exists but could not be used (corrupt, unsupported, an asset
 *   missing, or the read failed): the flat PNG opens and the editor says the layers are gone.
 */
export type CanvasLoad<Doc> =
  | { status: "loaded"; doc: Doc; savedAt: number | null }
  | { status: "absent" }
  | { status: "unreadable" };

/**
 * When the document beside a shot was last written, or null when no document file exists,
 * or "failed" when the stat itself could not be had. Never rejects.
 */
async function statDocument(id: string): Promise<{ savedAt: number } | null | "failed"> {
  try {
    return (await window.electronAPI.statScreenshotCanvas(id)) ?? null;
  } catch {
    return "failed";
  }
}

/** The saved time of a document that loaded: null when it cannot be told. */
export async function savedAtOf(id: string): Promise<number | null> {
  const stat = await statDocument(id);
  return stat === "failed" ? null : (stat?.savedAt ?? null);
}

/**
 * The reader gave up on a shot (null, or a document it could not use): `unreadable` when a
 * document file is there, `absent` when it is not. The reader answers null for both, so this
 * is the one place the two are told apart. When the stat itself fails the answer is unknown, so
 * it is `unreadable`: the user is warned rather than left to overwrite layers unaware.
 */
export async function whyNoDocument(id: string): Promise<"absent" | "unreadable"> {
  return (await statDocument(id)) === null ? "absent" : "unreadable";
}
