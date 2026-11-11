import { describe, expect, it } from "vitest";
import { inspectKeyAction } from "./inspect-keys";

const key = (k: string, extra: Partial<Parameters<typeof inspectKeyAction>[0]> = {}) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  target: document.body as EventTarget | null,
  ...extra,
});

describe("inspectKeyAction", () => {
  it("toggles on i or I, active or not", () => {
    for (const active of [false, true]) {
      expect(inspectKeyAction(key("i"), active, false)).toBe("toggle");
      expect(inspectKeyAction(key("I"), active, false)).toBe("toggle");
    }
  });

  it("exits on Escape only while active", () => {
    expect(inspectKeyAction(key("Escape"), true, false)).toBe("exit");
    expect(inspectKeyAction(key("Escape"), false, false)).toBeNull();
  });

  it("copies on c or C only while active", () => {
    expect(inspectKeyAction(key("c"), true, false)).toBe("copy");
    expect(inspectKeyAction(key("C"), true, false)).toBe("copy");
    expect(inspectKeyAction(key("c"), false, false)).toBeNull();
  });

  it("ignores any key with a modifier, so Cmd+C and Ctrl+I keep their meaning", () => {
    for (const mod of ["metaKey", "ctrlKey", "altKey"] as const) {
      expect(inspectKeyAction(key("c", { [mod]: true }), true, false)).toBeNull();
      expect(inspectKeyAction(key("i", { [mod]: true }), true, false)).toBeNull();
      expect(inspectKeyAction(key("Escape", { [mod]: true }), true, false)).toBeNull();
    }
  });

  it("ignores other keys", () => {
    expect(inspectKeyAction(key("x"), true, false)).toBeNull();
    expect(inspectKeyAction(key("Enter"), true, false)).toBeNull();
  });

  it("ignores keys typed into a text field", () => {
    for (const tag of ["input", "textarea", "select"]) {
      const el = document.createElement(tag);
      expect(inspectKeyAction(key("i", { target: el }), true, false), tag).toBeNull();
      expect(inspectKeyAction(key("Escape", { target: el }), true, false), tag).toBeNull();
    }
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    expect(inspectKeyAction(key("c", { target: editable }), true, false)).toBeNull();
  });

  it("treats contenteditable=false and a plain button as not editing", () => {
    const off = document.createElement("div");
    off.setAttribute("contenteditable", "false");
    expect(inspectKeyAction(key("i", { target: off }), false, false)).toBe("toggle");
    const button = document.createElement("button");
    expect(inspectKeyAction(key("i", { target: button }), false, false)).toBe("toggle");
    expect(inspectKeyAction(key("i", { target: null }), false, false)).toBe("toggle");
  });

  it("ignores everything while a modal dialog is open", () => {
    expect(inspectKeyAction(key("i"), false, true)).toBeNull();
    expect(inspectKeyAction(key("Escape"), true, true)).toBeNull();
    expect(inspectKeyAction(key("c"), true, true)).toBeNull();
  });
});
