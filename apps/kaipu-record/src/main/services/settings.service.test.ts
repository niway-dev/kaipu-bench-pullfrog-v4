import { describe, expect, it } from "vitest";
import { DEFAULT_EXPORT_QUALITY, DEFAULT_SETTINGS, type AppSettings } from "@shared/types";
import { defaultShortcutsFor } from "@shared/shortcut-defaults";
import { DEFAULT_QUALITY, QUALITY_PRESETS } from "@shared/recording-quality";
import { DEFAULT_LOCALE } from "@kaipu/i18n";
import {
  isValidTheme,
  mergeSettings as mergeSettingsFor,
  mergeShortcuts as mergeShortcutsFor,
  migrateLegacyShortcuts,
  SHORTCUTS_VERSION,
} from "./settings.service";

// Pin the platform so these tests do not depend on the machine running them.
const DEFAULT_SHORTCUTS = defaultShortcutsFor("darwin");
const mergeSettings = (stored: Parameters<typeof mergeSettingsFor>[0]) =>
  mergeSettingsFor(stored, "darwin");
const mergeShortcuts = (stored: unknown) => mergeShortcutsFor(stored, "darwin");
const MAC_SETTINGS = { ...DEFAULT_SETTINGS, shortcuts: DEFAULT_SHORTCUTS };

describe("DEFAULT_SETTINGS", () => {
  // `@shared/types` cannot import the i18n package (preload bundle), so its
  // locale default is a literal. This is the guard that keeps the copy honest.
  it("uses the same locale default as @kaipu/i18n", () => {
    expect(DEFAULT_SETTINGS.locale).toBe(DEFAULT_LOCALE);
  });
});

describe("isValidTheme", () => {
  it("accepts the known themes", () => {
    expect(isValidTheme("light")).toBe(true);
    expect(isValidTheme("dark")).toBe(true);
  });

  it("rejects unknown or non-string values", () => {
    // "system" is a legacy stored value from builds that declared but never
    // applied it — it must coerce to the dark default via mergeSettings.
    expect(isValidTheme("system")).toBe(false);
    expect(isValidTheme("blue")).toBe(false);
    expect(isValidTheme(undefined)).toBe(false);
    expect(isValidTheme(42)).toBe(false);
  });
});

describe("mergeSettings", () => {
  it("returns the defaults when nothing is stored", () => {
    expect(mergeSettings(null)).toEqual(MAC_SETTINGS);
    expect(mergeSettings(undefined)).toEqual(MAC_SETTINGS);
  });

  it("keeps valid stored values", () => {
    const shortcuts = {
      startRecording: "Command+Control+1",
      stopRecording: "Command+Control+2",
      bringToFront: "Command+Control+3",
      captureScreenshot: "Command+Control+4",
      captureWindow: "Command+Control+0",
      captureInstant: "Command+Control+Shift+9",
    };
    expect(
      mergeSettings({
        theme: "dark",
        locale: "en",
        launchAtLogin: true,
        showInDock: false,
        recordingQuality: QUALITY_PRESETS.max,
        showBarInRecording: true,
        recordingCountdownSeconds: 5,
        showBrandBadge: true,
        screenshotCopy: "manual",
        shortcuts,
        deviceId: "stored-id",
        uploadMode: "manual",
        exportQuality: "maximum",
        showRecordingSavedCard: false,
        screenshotFrame: { "1": { x: 10, y: 20, width: 300, height: 200 } },
        recordingArea: { "2": { x: 0, y: 0, width: 640, height: 360 } },
        recordingMode: "window",
        screenshotMode: "frame",
        trayHintShown: true,
        diagnosticsEnabled: false,
        microphone: { deviceId: "yeti", label: "Yeti Nano" },
      }),
    ).toEqual({
      theme: "dark",
      locale: "en",
      launchAtLogin: true,
      showInDock: false,
      recordingQuality: QUALITY_PRESETS.max,
      showBarInRecording: true,
      recordingCountdownSeconds: 5,
      showBrandBadge: true,
      screenshotCopy: "manual",
      screenshotAfterCapture: "preview",
      shortcuts,
      deviceId: "stored-id",
      uploadMode: "manual",
      exportQuality: "maximum",
      showRecordingSavedCard: false,
      screenshotFrame: { "1": { x: 10, y: 20, width: 300, height: 200 } },
      recordingArea: { "2": { x: 0, y: 0, width: 640, height: 360 } },
      recordingMode: "window",
      screenshotMode: "frame",
      trayHintShown: true,
      diagnosticsEnabled: false,
      cameraBubble: {
        shape: "circle",
        cornerRadius: 0.18,
        size: 240,
        deviceId: null,
        mirrored: true,
        framing: { enabled: false, zoom: 1, x: 0, y: 0 },
      },
      audio: {
        micLevel: 100,
        noiseSuppression: true,
        systemAudioVolume: 100,
        duckSystemAudioWhileTalking: false,
      },
      microphone: { deviceId: "yeti", label: "Yeti Nano" },
      editor: { hiddenTracks: [] },
    });
  });

  it("drops a remembered microphone without a device id", () => {
    expect(mergeSettings({}).microphone).toBeNull();
    expect(mergeSettings({ microphone: { deviceId: "", label: "x" } }).microphone).toBeNull();
    expect(
      mergeSettings({ microphone: "yeti" as unknown as AppSettings["microphone"] }).microphone,
    ).toBeNull();
    expect(
      mergeSettings({
        microphone: { deviceId: "yeti", label: 3 } as unknown as AppSettings["microphone"],
      }).microphone,
    ).toEqual({ deviceId: "yeti", label: "" });
  });

  it("keeps a known ratio on a remembered recording area and drops an unknown one", () => {
    expect(
      mergeSettings({
        recordingArea: {
          "1": { x: 0, y: 0, width: 640, height: 360, ratio: "16:9" },
          "2": { x: 0, y: 0, width: 300, height: 300, ratio: "4:3" },
        } as never,
      }).recordingArea,
    ).toEqual({
      "1": { x: 0, y: 0, width: 640, height: 360, ratio: "16:9" },
      "2": { x: 0, y: 0, width: 300, height: 300 },
    });
  });

  it("defaults the recording mode to Screen and keeps any known mode, Window included", () => {
    expect(DEFAULT_SETTINGS.recordingMode).toBe("screen");
    expect(mergeSettings({}).recordingMode).toBe("screen");
    expect(mergeSettings({ recordingMode: "window" }).recordingMode).toBe("window");
    expect(mergeSettings({ recordingMode: "frame" }).recordingMode).toBe("frame");
    expect(mergeSettings({ recordingMode: "area" as never }).recordingMode).toBe("screen");
  });

  it("remembers no frame by default and drops malformed remembered frames", () => {
    expect(DEFAULT_SETTINGS.screenshotFrame).toEqual({});
    expect(mergeSettings({}).screenshotFrame).toEqual({});
    expect(mergeSettings({ screenshotFrame: "nope" as never }).screenshotFrame).toEqual({});
    expect(DEFAULT_SETTINGS.recordingArea).toEqual({});
    expect(mergeSettings({}).recordingArea).toEqual({});
    expect(
      mergeSettings({
        recordingArea: {
          "1": { x: 0, y: 0, width: 640, height: 360 },
          "2": "junk",
        } as never,
      }).recordingArea,
    ).toEqual({ "1": { x: 0, y: 0, width: 640, height: 360 } });
    expect(
      mergeSettings({
        screenshotFrame: {
          "1": { x: -5, y: 0, width: 640, height: 480 },
          "2": { x: 0, y: 0, width: 0, height: 480 },
          "3": { x: 0, y: Number.NaN, width: 10, height: 10 },
          "4": "big" as never,
        },
      }).screenshotFrame,
    ).toEqual({ "1": { x: -5, y: 0, width: 640, height: 480 } });
  });

  it("defaults the current screenshot mode to Frame", () => {
    expect(DEFAULT_SETTINGS.screenshotMode).toBe("frame");
    expect(mergeSettings({}).screenshotMode).toBe("frame");
    expect(mergeSettings({ screenshotMode: "screen" }).screenshotMode).toBe("screen");
  });

  it('reads a stored "window" as Frame while Window mode is off (the flag as shipped)', () => {
    expect(mergeSettings({ screenshotMode: "window" }).screenshotMode).toBe("frame");
  });

  it('migrates a stored legacy "area" mode, and drops an unknown one, to Frame', () => {
    expect(mergeSettings({ screenshotMode: "area" as never }).screenshotMode).toBe("frame");
    expect(mergeSettings({ screenshotMode: "banana" as never }).screenshotMode).toBe("frame");
    expect(mergeSettings({ screenshotMode: 2 as never }).screenshotMode).toBe("frame");
  });

  it("defaults Export quality to Balanced and sanitizes it (NIW2-218)", () => {
    expect(DEFAULT_SETTINGS.exportQuality).toBe(DEFAULT_EXPORT_QUALITY);
    expect(mergeSettings({}).exportQuality).toBe("balanced");
    expect(mergeSettings({ exportQuality: "maximum" }).exportQuality).toBe("maximum");
    expect(mergeSettings({ exportQuality: "original" as never }).exportQuality).toBe("balanced");
  });

  it("shows the Recording saved card by default and keeps a boolean choice (NIW2-218)", () => {
    expect(DEFAULT_SETTINGS.showRecordingSavedCard).toBe(true);
    expect(mergeSettings({}).showRecordingSavedCard).toBe(true);
    expect(mergeSettings({ showRecordingSavedCard: false }).showRecordingSavedCard).toBe(false);
    expect(mergeSettings({ showRecordingSavedCard: "no" as never }).showRecordingSavedCard).toBe(
      true,
    );
  });

  it("has not shown the tray hint by default and keeps a boolean flag", () => {
    expect(DEFAULT_SETTINGS.trayHintShown).toBe(false);
    expect(mergeSettings({}).trayHintShown).toBe(false);
    expect(mergeSettings({ trayHintShown: true }).trayHintShown).toBe(true);
    expect(mergeSettings({ trayHintShown: "yes" as never }).trayHintShown).toBe(false);
  });

  it("sends diagnostics by default and keeps a boolean opt-out", () => {
    expect(DEFAULT_SETTINGS.diagnosticsEnabled).toBe(true);
    expect(mergeSettings({}).diagnosticsEnabled).toBe(true);
    expect(mergeSettings({ diagnosticsEnabled: false }).diagnosticsEnabled).toBe(false);
    expect(mergeSettings({ diagnosticsEnabled: "off" as never }).diagnosticsEnabled).toBe(true);
  });

  it("drops the last-used export preset keys older settings files carry (NIW2-218)", () => {
    const merged = mergeSettings({
      lastExportPreset: "vertical",
      lastExportFraming: "fill",
    } as never);
    expect(merged).not.toHaveProperty("lastExportPreset");
    expect(merged).not.toHaveProperty("lastExportFraming");
    expect(merged.exportQuality).toBe("balanced");
  });

  it('coerces a legacy persisted "system" theme to the dark default', () => {
    expect(mergeSettings({ theme: "system" as never }).theme).toBe("dark");
  });

  it("keeps a valid persisted locale and defaults an invalid one", () => {
    expect(mergeSettings({ locale: "es" }).locale).toBe("es");
    expect(mergeSettings({ locale: "fr" as never }).locale).toBe("en");
    expect(mergeSettings({}).locale).toBe("en");
  });

  it("defaults showBarInRecording to false when absent or invalid", () => {
    expect(mergeSettings({}).showBarInRecording).toBe(false);
    expect(mergeSettings({ showBarInRecording: "yes" as never }).showBarInRecording).toBe(false);
  });

  it("loads a file that still holds the retired sidebarMode, and drops it (NIW2-626)", () => {
    const merged = mergeSettings({ sidebarMode: "collapsed", theme: "light" } as never);
    expect(merged.theme).toBe("light");
    expect(merged).not.toHaveProperty("sidebarMode");
  });

  it("keeps each offered countdown length (0, 3, 5)", () => {
    for (const seconds of [0, 3, 5] as const) {
      expect(mergeSettings({ recordingCountdownSeconds: seconds }).recordingCountdownSeconds).toBe(
        seconds,
      );
    }
  });

  it("defaults recordingCountdownSeconds to 3 when absent or not an offered length", () => {
    expect(mergeSettings({}).recordingCountdownSeconds).toBe(3);
    for (const invalid of [1, 2, 4, 10, -3, 3.5, NaN, "5", null, true]) {
      expect(
        mergeSettings({ recordingCountdownSeconds: invalid as never }).recordingCountdownSeconds,
      ).toBe(3);
    }
  });

  it("fills in default shortcuts when absent", () => {
    expect(mergeSettings({}).shortcuts).toEqual(DEFAULT_SHORTCUTS);
  });

  it("defaults showInDock to true when absent or invalid", () => {
    expect(mergeSettings({ theme: "dark" }).showInDock).toBe(true);
    expect(mergeSettings({ showInDock: "no" as never }).showInDock).toBe(true);
  });

  it("sanitizes recordingQuality — keeps valid, defaults garbage/absent", () => {
    expect(mergeSettings({}).recordingQuality).toEqual(DEFAULT_QUALITY);
    expect(
      mergeSettings({
        recordingQuality: { resolution: 9, fps: 1, bitrate: "x" } as never,
      }).recordingQuality,
    ).toEqual(DEFAULT_QUALITY);
    const custom = { resolution: 2160, fps: 48, bitrate: "max" } as const;
    expect(mergeSettings({ recordingQuality: custom }).recordingQuality).toEqual(custom);
  });

  it("falls back to defaults for invalid fields", () => {
    expect(
      mergeSettings({
        theme: "neon" as never,
        launchAtLogin: "yes" as never,
        showInDock: 1 as never,
      }),
    ).toEqual(MAC_SETTINGS);
  });
});

describe("mergeShortcuts", () => {
  it("returns the defaults when nothing is stored", () => {
    expect(mergeShortcuts(null)).toEqual(DEFAULT_SHORTCUTS);
    expect(mergeShortcuts(undefined)).toEqual(DEFAULT_SHORTCUTS);
    expect(mergeShortcuts("garbage")).toEqual(DEFAULT_SHORTCUTS);
  });

  it("keeps valid per-action bindings and defaults the rest", () => {
    expect(
      mergeShortcuts({
        startRecording: "Command+Control+G",
        stopRecording: "",
      }),
    ).toEqual({
      startRecording: "Command+Control+G",
      stopRecording: DEFAULT_SHORTCUTS.stopRecording,
      bringToFront: DEFAULT_SHORTCUTS.bringToFront,
      captureScreenshot: DEFAULT_SHORTCUTS.captureScreenshot,
      captureWindow: DEFAULT_SHORTCUTS.captureWindow,
      captureInstant: DEFAULT_SHORTCUTS.captureInstant,
    });
  });

  it("gives a settings file with only some bindings the defaults for the rest", () => {
    const merged = mergeShortcuts({
      startRecording: "Command+Control+1",
      captureScreenshot: "Command+Control+4",
    });
    expect(merged.captureScreenshot).toBe("Command+Control+4");
    expect(merged.captureWindow).toBe("Command+Control+W");
    expect(merged.captureInstant).toBe("Command+Shift+2");
  });

  it("drops the keys of removed shortcuts instead of carrying them", () => {
    const merged = mergeShortcuts({
      startRecording: "Command+Control+G",
      toggleMicrophone: "Command+Control+M",
      recordArea: "Command+Control+Shift+R",
    });
    expect(Object.keys(merged).sort()).toEqual(Object.keys(DEFAULT_SHORTCUTS).sort());
    expect(merged).not.toHaveProperty("toggleMicrophone");
    expect(merged).not.toHaveProperty("recordArea");
  });

  it("ignores non-string bindings", () => {
    expect(mergeShortcuts({ bringToFront: 42 }).bringToFront).toBe(DEFAULT_SHORTCUTS.bringToFront);
  });
});

describe("platform-specific shortcut defaults", () => {
  it("gives a Windows user Control+Alt defaults", () => {
    expect(mergeSettingsFor(null, "win32").shortcuts).toEqual(defaultShortcutsFor("win32"));
    expect(mergeSettingsFor(null, "win32").shortcuts.startRecording).toBe("Control+Alt+C");
  });

  it("keeps a stored binding and fills the rest with the platform's defaults", () => {
    const merged = mergeShortcutsFor({ startRecording: "Control+Alt+G" }, "win32");
    expect(merged.startRecording).toBe("Control+Alt+G");
    expect(merged.stopRecording).toBe("Control+Alt+S");
  });
});

describe("deviceId", () => {
  it("defaults to an empty string (the store fills it in)", () => {
    expect(mergeSettings(null).deviceId).toBe("");
  });

  it("preserves a stored device id", () => {
    expect(mergeSettings({ deviceId: "abc-123" }).deviceId).toBe("abc-123");
  });

  it("ignores a non-string device id", () => {
    expect(mergeSettings({ deviceId: 42 as unknown as string }).deviceId).toBe("");
  });
});

describe("uploadMode", () => {
  it("defaults to local-only, so creating an account never starts uploads", () => {
    expect(mergeSettings(null).uploadMode).toBe("local-only");
    expect(mergeSettings({ theme: "light" }).uploadMode).toBe("local-only");
  });

  it("keeps each valid mode", () => {
    for (const mode of ["local-only", "manual", "automatic"] as const) {
      expect(mergeSettings({ uploadMode: mode }).uploadMode).toBe(mode);
    }
  });

  it("drops an unknown mode instead of persisting it", () => {
    expect(mergeSettings({ uploadMode: "everything" as unknown as "manual" }).uploadMode).toBe(
      "local-only",
    );
  });
});

describe("screenshotSave (removed)", () => {
  it("drops the retired preference from a stored file", () => {
    expect(mergeSettings({ screenshotSave: "manual" } as never)).not.toHaveProperty(
      "screenshotSave",
    );
  });
});

describe("showBrandBadge", () => {
  it("defaults to off — the free app carries no watermark", () => {
    expect(DEFAULT_SETTINGS.showBrandBadge).toBe(false);
    expect(mergeSettings(null).showBrandBadge).toBe(false);
  });

  it("keeps a stored boolean and coerces anything else to off", () => {
    expect(mergeSettings({ showBrandBadge: true }).showBrandBadge).toBe(true);
    expect(mergeSettings({ showBrandBadge: "yes" as never }).showBrandBadge).toBe(false);
  });
});

describe("screenshotCopy", () => {
  it("defaults to auto", () => {
    expect(DEFAULT_SETTINGS.screenshotCopy).toBe("auto");
    expect(mergeSettings(null).screenshotCopy).toBe("auto");
  });

  it("keeps a valid stored mode and coerces anything else to the default", () => {
    expect(mergeSettings({ screenshotCopy: "manual" }).screenshotCopy).toBe("manual");
    expect(mergeSettings({ screenshotCopy: "always" as never }).screenshotCopy).toBe("auto");
    expect(mergeSettings({ screenshotCopy: 3 as never }).screenshotCopy).toBe("auto");
  });
});

describe("mergeSettings — cameraBubble", () => {
  it("defaults to a medium circle on the OS default camera", () => {
    expect(mergeSettings(null).cameraBubble).toEqual({
      shape: "circle",
      cornerRadius: 0.18,
      size: 240,
      deviceId: null,
      mirrored: true,
      framing: { enabled: false, zoom: 1, x: 0, y: 0 },
    });
  });

  it("keeps a valid stored value", () => {
    const cameraBubble = {
      shape: "rounded",
      cornerRadius: 0.18,
      size: 300,
      deviceId: "cam-1",
      mirrored: false,
      framing: { enabled: true, zoom: 2, x: 0.5, y: -0.25 },
    } as const;
    expect(mergeSettings({ cameraBubble }).cameraBubble).toEqual(cameraBubble);
  });

  it("falls back field by field and clamps the size", () => {
    expect(
      mergeSettings({
        cameraBubble: { shape: "hexagon", size: 9000, deviceId: 4, mirrored: "yes" },
      } as never).cameraBubble,
    ).toEqual({
      shape: "circle",
      cornerRadius: 0.18,
      size: 480,
      deviceId: null,
      mirrored: true,
      framing: { enabled: false, zoom: 1, x: 0, y: 0 },
    });
    expect(mergeSettings({ cameraBubble: { size: 50.4 } } as never).cameraBubble).toEqual({
      shape: "circle",
      cornerRadius: 0.18,
      size: 120,
      deviceId: null,
      mirrored: true,
      framing: { enabled: false, zoom: 1, x: 0, y: 0 },
    });
    expect(mergeSettings({ cameraBubble: "big" } as never).cameraBubble.size).toBe(240);
  });
});

describe("mergeSettings — audio", () => {
  it("defaults to today's recording", () => {
    expect(mergeSettings(null).audio).toEqual({
      micLevel: 100,
      noiseSuppression: true,
      systemAudioVolume: 100,
      duckSystemAudioWhileTalking: false,
    });
  });

  it("keeps a valid stored value", () => {
    const audio = {
      micLevel: 70,
      noiseSuppression: false,
      systemAudioVolume: 40,
      duckSystemAudioWhileTalking: true,
    };
    expect(mergeSettings({ audio }).audio).toEqual(audio);
  });

  it("falls back field by field and clamps numbers", () => {
    expect(
      mergeSettings({ audio: { micLevel: 900, noiseSuppression: "no" } } as never).audio,
    ).toEqual({
      micLevel: 200,
      noiseSuppression: true,
      systemAudioVolume: 100,
      duckSystemAudioWhileTalking: false,
    });
    expect(mergeSettings({ audio: 3 } as never).audio.micLevel).toBe(100);
  });
});

describe("screenshotAfterCapture", () => {
  it("defaults old or invalid settings to preview and preserves an editor choice", () => {
    expect(mergeSettings(null).screenshotAfterCapture).toBe("preview");
    expect(mergeSettings({ screenshotAfterCapture: "editor" }).screenshotAfterCapture).toBe(
      "editor",
    );
    expect(
      mergeSettings({ screenshotAfterCapture: "unknown" as never }).screenshotAfterCapture,
    ).toBe("preview");
  });
});

describe("mergeSettings — editor", () => {
  it("shows every lane by default", () => {
    expect(mergeSettings(null).editor).toEqual({ hiddenTracks: [] });
    expect(mergeSettings({}).editor).toEqual({ hiddenTracks: [] });
  });

  it("keeps the stored hidden lanes, activity included, and drops clips and unknown keys", () => {
    expect(
      mergeSettings({
        editor: { hiddenTracks: ["zooms", "activity", "clips", "overlay"] },
      } as never).editor,
    ).toEqual({ hiddenTracks: ["zooms", "activity"] });
  });

  it("survives a wrong shape", () => {
    expect(mergeSettings({ editor: 3 } as never).editor).toEqual({ hiddenTracks: [] });
    expect(mergeSettings({ editor: { hiddenTracks: "zooms" } } as never).editor).toEqual({
      hiddenTracks: [],
    });
  });
});

describe("migrateLegacyShortcuts", () => {
  const oldMac = {
    startRecording: "Command+Control+C",
    stopRecording: "Command+Control+S",
    bringToFront: "Command+Control+O",
    captureScreenshot: "Command+Control+X",
    captureScreen: "Command+Control+Shift+X",
    captureFrame: "Command+Control+Shift+F",
    captureWindow: "Command+Control+W",
    captureInstant: "Command+Control+I",
    recordArea: "Command+Control+Shift+R",
    toggleMicrophone: "Command+Control+M",
    toggleSystemAudio: "Command+Control+A",
    toggleCamera: "Command+Control+K",
  };
  const load = (stored: unknown, platform = "darwin") =>
    mergeShortcutsFor(migrateLegacyShortcuts(stored).shortcuts, platform);

  it("moves a user still on the old defaults to the new ones", () => {
    const merged = load(oldMac);
    expect(merged.captureScreenshot).toBe("Command+Shift+1");
    expect(merged.captureInstant).toBe("Command+Shift+2");
    // Unchanged defaults stay as they were.
    expect(merged.startRecording).toBe("Command+Control+C");
    expect(merged.captureWindow).toBe("Command+Control+W");
  });

  it("moves the Windows old defaults to the Windows new ones", () => {
    const merged = load(
      { captureScreenshot: "Control+Alt+X", captureInstant: "Control+Alt+I" },
      "win32",
    );
    expect(merged.captureScreenshot).toBe("Control+Alt+1");
    expect(merged.captureInstant).toBe("Control+Alt+2");
  });

  it("keeps a custom binding, whether or not the file carries removed keys", () => {
    const merged = load({
      ...oldMac,
      captureScreenshot: "Command+Control+4",
      captureInstant: "Command+Control+Shift+2",
    });
    expect(merged.captureScreenshot).toBe("Command+Control+4");
    expect(merged.captureInstant).toBe("Command+Control+Shift+2");
  });

  it("removes the keys of the dropped shortcuts and reports the file as migrated", () => {
    const result = migrateLegacyShortcuts(oldMac);
    expect(result.migrated).toBe(true);
    for (const key of [
      "captureScreen",
      "captureFrame",
      "recordArea",
      "toggleMicrophone",
      "toggleSystemAudio",
      "toggleCamera",
    ]) {
      expect(result.shortcuts).not.toHaveProperty(key);
    }
  });

  it("leaves a current file alone and reports nothing to persist", () => {
    const current = { startRecording: "Command+Control+G", captureScreenshot: "Command+Shift+1" };
    expect(migrateLegacyShortcuts(current)).toEqual({ shortcuts: current, migrated: false });
  });

  it("does nothing for a file already at the current version", () => {
    const stored = {
      captureScreenshot: "Command+Control+X",
      recordArea: "Command+Control+Shift+R",
    };
    expect(migrateLegacyShortcuts(stored, SHORTCUTS_VERSION)).toEqual({
      shortcuts: stored,
      migrated: false,
    });
  });

  it("passes anything that is not an object through", () => {
    expect(migrateLegacyShortcuts(undefined)).toEqual({ shortcuts: undefined, migrated: false });
    expect(migrateLegacyShortcuts("x")).toEqual({ shortcuts: "x", migrated: false });
    expect(migrateLegacyShortcuts([1])).toEqual({ shortcuts: [1], migrated: false });
  });
});
