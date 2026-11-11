import { describe, expect, it } from "vitest";
import { DEFAULT_ACCELERATORS, SHORTCUT_ACTIONS as DOMAIN_ACTIONS } from "@kaipu/domain/constants";
import { defaultShortcutsFor } from "../shortcut-defaults";
import { SHORTCUT_ACTIONS, SHORTCUT_DEFINITIONS } from "./ipc";

/**
 * `ipc.ts` cannot import the shared constants: it is reachable from the preload
 * bundle, which externalizes workspace packages and then fails to load their
 * TypeScript — the app opens to a black window when that happens. So the
 * accelerators are literals there and this is what keeps them honest, the same
 * shape `settings.service.test.ts` uses to pin DEFAULT_LOCALE.
 *
 * This test file is NOT in the preload bundle, so importing domain here is free.
 */
describe("the desktop shortcut defaults", () => {
  it("lists the same actions as @kaipu/domain", () => {
    expect([...SHORTCUT_ACTIONS].sort()).toEqual([...DOMAIN_ACTIONS].sort());
  });

  it("binds each action to the accelerator domain declares for macOS", () => {
    for (const definition of SHORTCUT_DEFINITIONS) {
      expect(definition.defaultAccelerator.mac).toBe(DEFAULT_ACCELERATORS.mac[definition.action]);
    }
  });

  it("keeps exactly the five global shortcuts, plus the flag-gated Window one", () => {
    expect([...SHORTCUT_ACTIONS].sort()).toEqual(
      [
        "startRecording",
        "stopRecording",
        "bringToFront",
        "captureScreenshot",
        "captureInstant",
        "captureWindow",
      ].sort(),
    );
  });

  it("pins the shortcuts to their documented macOS combos", () => {
    const mac = defaultShortcutsFor("darwin");
    expect(mac).toEqual({
      startRecording: "Command+Control+C",
      stopRecording: "Command+Control+S",
      bringToFront: "Command+Control+O",
      captureScreenshot: "Command+Shift+1",
      captureWindow: "Command+Control+W",
      captureInstant: "Command+Shift+2",
    });
  });

  it("pins the shortcuts to their documented Windows combos", () => {
    const win = defaultShortcutsFor("win32");
    expect(win).toEqual({
      startRecording: "Control+Alt+C",
      stopRecording: "Control+Alt+S",
      bringToFront: "Control+Alt+O",
      captureScreenshot: "Control+Alt+1",
      captureWindow: "Control+Alt+W",
      captureInstant: "Control+Alt+2",
    });
  });

  it("never binds a macOS system screenshot key (Command+Shift+3, 4 or 5)", () => {
    for (const accelerator of Object.values(defaultShortcutsFor("darwin"))) {
      expect(accelerator).not.toMatch(/^Command\+Shift\+[345]$/);
    }
  });

  it("describes the generic capture shortcut as opening the capture widget", () => {
    const capture = SHORTCUT_DEFINITIONS.find((d) => d.action === "captureScreenshot");
    const window = SHORTCUT_DEFINITIONS.find((d) => d.action === "captureWindow");
    expect(capture).toMatchObject({
      group: "app",
      label: "Open capture",
      description: "Open the capture widget to choose what to capture",
    });
    expect(window).toMatchObject({ group: "app", label: "Capture window", statusWord: "window" });
  });

  it("binds each action to the accelerator domain declares for Windows", () => {
    for (const definition of SHORTCUT_DEFINITIONS) {
      expect(definition.defaultAccelerator.win).toBe(
        DEFAULT_ACCELERATORS.windows[definition.action],
      );
    }
  });

  it("has a non-empty default on both platforms for every action", () => {
    for (const platform of ["darwin", "win32"]) {
      const defaults = defaultShortcutsFor(platform);
      for (const action of SHORTCUT_ACTIONS) {
        expect(defaults[action].length).toBeGreaterThan(0);
      }
    }
  });

  it("never puts Command or Super in a Windows default", () => {
    for (const accelerator of Object.values(defaultShortcutsFor("win32"))) {
      expect(accelerator).not.toMatch(/Command|Cmd|Super|Meta/);
    }
  });

  it("resolves win32 to the Windows pair and everything else to macOS's", () => {
    expect(defaultShortcutsFor("win32").startRecording).toBe("Control+Alt+C");
    expect(defaultShortcutsFor("darwin").startRecording).toBe("Command+Control+C");
    // Linux is not a supported target yet; it falls back to the macOS pair.
    expect(defaultShortcutsFor("linux")).toEqual(defaultShortcutsFor("darwin"));
  });

  it("defines every action exactly once", () => {
    const actions = SHORTCUT_DEFINITIONS.map((d) => d.action);
    expect(new Set(actions).size).toBe(actions.length);
    expect(actions).toHaveLength(SHORTCUT_ACTIONS.length);
  });
});
