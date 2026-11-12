import { describe, expect, it } from "vitest";
import { inspectKeyAction } from "../inspect/inspect-keys";
import { isFitContentKey } from "./fit-key";

const ev = (extra: Partial<Parameters<typeof isFitContentKey>[0]> = {}) => ({
  code: "Digit1",
  key: "!",
  shiftKey: true,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  target: document.body as EventTarget | null,
  ...extra,
});

describe("isFitContentKey", () => {
  it("is Shift+1, read from the physical key", () => {
    expect(isFitContentKey(ev(), false)).toBe(true);
    // Another layout types a different character with Shift+1.
    expect(isFitContentKey(ev({ key: "&" }), false)).toBe(true);
  });

  it("needs Shift and no other modifier", () => {
    expect(isFitContentKey(ev({ shiftKey: false, key: "1" }), false)).toBe(false);
    expect(isFitContentKey(ev({ metaKey: true }), false)).toBe(false);
    expect(isFitContentKey(ev({ ctrlKey: true }), false)).toBe(false);
    expect(isFitContentKey(ev({ altKey: true }), false)).toBe(false);
  });

  it("is not the number pad or another digit", () => {
    expect(isFitContentKey(ev({ code: "Numpad1" }), false)).toBe(false);
    expect(isFitContentKey(ev({ code: "Digit2", key: "@" }), false)).toBe(false);
  });

  it("is ignored while typing and while a modal is open", () => {
    expect(isFitContentKey(ev({ target: document.createElement("input") }), false)).toBe(false);
    expect(isFitContentKey(ev({ target: document.createElement("textarea") }), false)).toBe(false);
    expect(isFitContentKey(ev(), true)).toBe(false);
  });
});

describe("Inspect's 1 key and Shift+1", () => {
  const key = (extra: object) => ({
    key: "1",
    code: "Digit1",
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    target: document.body as EventTarget | null,
    ...extra,
  });

  it("the plain 1 still picks the horizontal ruler", () => {
    expect(inspectKeyAction(key({ shiftKey: false }), true, false)).toBe("rulerX");
  });

  it("Shift+1 no longer does in canvas mode: it fits the content instead", () => {
    expect(inspectKeyAction(key({ key: "!", shiftKey: true }), true, false, true)).toBeNull();
  });

  it("2 is untouched by Shift", () => {
    expect(inspectKeyAction(key({ key: "@", code: "Digit2", shiftKey: true }), true, false)).toBe(
      "rulerY",
    );
  });
});
