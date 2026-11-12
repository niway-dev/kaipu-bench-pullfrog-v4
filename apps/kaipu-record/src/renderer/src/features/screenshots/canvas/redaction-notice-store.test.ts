import { afterEach, describe, expect, it, vi } from "vitest";
import {
  REDACTION_NOTICE_KEY,
  hasSeenRedactionNotice,
  markRedactionNoticeSeen,
} from "./redaction-notice-store";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("redaction notice store", () => {
  it("reads as unseen on a fresh machine", () => {
    expect(hasSeenRedactionNotice()).toBe(false);
  });

  it("stores the acknowledgement under its key as 1", () => {
    markRedactionNoticeSeen();
    expect(REDACTION_NOTICE_KEY).toBe("kaipu.imageEditor.redactionNoticeSeen");
    expect(localStorage.getItem(REDACTION_NOTICE_KEY)).toBe("1");
    expect(hasSeenRedactionNotice()).toBe(true);
  });

  it("only the value 1 counts as seen", () => {
    localStorage.setItem(REDACTION_NOTICE_KEY, "true");
    expect(hasSeenRedactionNotice()).toBe(false);
  });

  it("treats unreadable storage as unseen and a failed write as a no-op", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(hasSeenRedactionNotice()).toBe(false);
    expect(() => markRedactionNoticeSeen()).not.toThrow();
  });
});
