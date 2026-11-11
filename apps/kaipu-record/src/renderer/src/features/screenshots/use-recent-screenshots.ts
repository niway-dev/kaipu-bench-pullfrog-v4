import { useCallback, useEffect, useState } from "react";
import type { LocalRecording } from "@shared/types/library-storage";

/**
 * Recent screenshots from the unified vault, newest first. Reuses the library
 * list and filters to `kind === "screenshot"`. Re-reads whenever main broadcasts
 * `library:changed` (a saved screenshot, an import, a rename), so a capture saved
 * moments ago appears without waiting for the window to regain focus.
 */
export function useRecentScreenshots(limit = 6): { shots: LocalRecording[] } {
  const [shots, setShots] = useState<LocalRecording[]>([]);

  const refresh = useCallback(() => {
    void window.electronAPI
      .listLocalRecordings()
      .then((items) => {
        setShots(items.filter((item) => item.kind === "screenshot").slice(0, limit));
      })
      // A vault error keeps the previous shots on screen instead of an unhandled rejection.
      .catch(() => {});
  }, [limit]);

  useEffect(() => {
    refresh();
    return window.electronAPI.onLibraryChanged(refresh);
  }, [refresh]);

  return { shots };
}
