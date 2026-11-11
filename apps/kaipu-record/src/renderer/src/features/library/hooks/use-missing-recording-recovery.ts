import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { captureEvent } from "@renderer/features/analytics";

/** Delay before the single recovery re-list — long enough for a just-finalized
 *  file to become visible in the vault, short enough to still feel instant. */
const RETRY_DELAY_MS = 500;

export interface MissingRecoveryParams {
  /** Asset id from the URL (`/library/:assetId`). */
  id: string | undefined;
  /** Whether that id is present in the currently-listed vault. */
  found: boolean;
  /** The library list is still being read. */
  isLoading: boolean;
  /** The last list came back with a vault error: the item is "unknown", not missing. */
  hasError?: boolean;
  /** Size of the current list — context for the diagnostic event. */
  listSize: number;
  /** True when we arrived straight from a finished recording (see app-shell). */
  fromRecording: boolean;
  /** Re-list the vault. */
  refresh: () => Promise<void>;
}

/**
 * Recovers a detail page whose recording id isn't in the vault list. The one case
 * we've observed (rarely, never reproduced locally) is a transient race right
 * after a recording finalizes: the navigation to `/library/:assetId` beats the item
 * into the freshly-listed vault, so `videos.find` misses and the page would show
 * "File not found" for a recording that is, in fact, on disk.
 *
 * Rather than dead-ending, we re-list once after a short grace delay and, if the
 * id is *still* missing, log the miss to PostHog (to catch it in the wild) and
 * fall back to the Library — where the recording actually is.
 *
 * Returns `recovering`, so the page can keep showing its loader (never the scary
 * not-found screen) until recovery has truly given up.
 */
export function useMissingRecordingRecovery(params: MissingRecoveryParams): {
  recovering: boolean;
} {
  const { id, found, isLoading, hasError = false, listSize, fromRecording, refresh } = params;
  const navigate = useNavigate();
  // The id whose single re-list has completed. Keyed by id, so navigating between two
  // detail pages (same component, new param) starts over without any explicit reset,
  // and a retry that finishes after the id changed cannot redirect for the new one.
  const [retriedFor, setRetriedFor] = useState<string | undefined>(undefined);
  // Guards against a second re-list / a second redirect while state is catching up.
  const startedFor = useRef<string | undefined>(undefined);
  const reportedFor = useRef<string | undefined>(undefined);

  // An unreadable vault (unplugged drive, EACCES) hides items it still holds: treating
  // that as "missing" would re-list pointlessly and then redirect away from a real item.
  const missing = !isLoading && !hasError && !!id && !found;
  const retried = !!id && retriedFor === id;

  useEffect(() => {
    if (found) {
      // The item showed up — arm recovery again for a later disappearance.
      startedFor.current = undefined;
      reportedFor.current = undefined;
      setRetriedFor(undefined);
    }
  }, [found, retriedFor]);

  useEffect(() => {
    if (!missing || !id || retried || startedFor.current === id) return undefined;
    const timer = setTimeout(() => {
      startedFor.current = id;
      // The redirect follows the retry's completion, not a loading flip: a re-list that
      // returns the same list changes nothing the hook could otherwise observe.
      void refresh().finally(() => setRetriedFor(id));
    }, RETRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [missing, id, retried, refresh]);

  useEffect(() => {
    if (!missing || !retried || reportedFor.current === id) return;
    reportedFor.current = id;
    captureEvent("library-detail-missing", { id, listSize, fromRecording });
    navigate("/library", { replace: true });
  }, [missing, retried, id, listSize, fromRecording, navigate]);

  return { recovering: missing && !retried };
}
