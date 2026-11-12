/**
 * Whether this machine has acknowledged "Saving makes redactions permanent" (mock H4b), kept in
 * `localStorage` like the onboarding flag. Every access is wrapped in try/catch because
 * localStorage can throw in restricted renderer contexts: unreadable counts as not seen (the
 * notice shows), and a failed write only means it shows again next time.
 */
export const REDACTION_NOTICE_KEY = "kaipu.imageEditor.redactionNoticeSeen";

export function hasSeenRedactionNotice(): boolean {
  try {
    return localStorage.getItem(REDACTION_NOTICE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markRedactionNoticeSeen(): void {
  try {
    localStorage.setItem(REDACTION_NOTICE_KEY, "1");
  } catch {
    // Ignore: the notice will simply show again.
  }
}
