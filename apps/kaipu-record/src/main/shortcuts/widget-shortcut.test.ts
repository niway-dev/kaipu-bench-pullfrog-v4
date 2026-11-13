import { describe, expect, it } from "vitest";
import { decideWidgetShortcut } from "./widget-shortcut";

const idle = { takeActive: false, takePending: false, overlayOpen: false, overlayIntent: null };

describe("decideWidgetShortcut: the record key (⌘⇧2)", () => {
  const key = "record" as const;

  it("opens the widget when nothing is going on", () => {
    expect(decideWidgetShortcut({ key, ...idle })).toBe("open");
  });

  it("stops a live take", () => {
    expect(decideWidgetShortcut({ key, ...idle, takeActive: true })).toBe("stop");
  });

  it("stops a pending take (the countdown), which cancels it", () => {
    expect(decideWidgetShortcut({ key, ...idle, takePending: true })).toBe("stop");
  });

  it("closes the widget when it is open in the recording intent", () => {
    expect(decideWidgetShortcut({ key, ...idle, overlayOpen: true, overlayIntent: "record" })).toBe(
      "close",
    );
  });

  it("switches the widget when it is open in the screenshot intent", () => {
    expect(
      decideWidgetShortcut({ key, ...idle, overlayOpen: true, overlayIntent: "capture" }),
    ).toBe("switch");
  });

  it("prefers stopping a take over anything about a widget opened above it", () => {
    for (const overlayIntent of ["capture", "record"] as const) {
      expect(
        decideWidgetShortcut({
          key,
          takeActive: true,
          takePending: false,
          overlayOpen: true,
          overlayIntent,
        }),
      ).toBe("stop");
      expect(
        decideWidgetShortcut({
          key,
          takeActive: false,
          takePending: true,
          overlayOpen: true,
          overlayIntent,
        }),
      ).toBe("stop");
    }
  });
});

describe("decideWidgetShortcut: the capture key (⌘⇧1)", () => {
  const key = "capture" as const;

  it("opens the widget when nothing is going on", () => {
    expect(decideWidgetShortcut({ key, ...idle })).toBe("open");
  });

  it("leaves a take to the capture-while-recording path", () => {
    expect(decideWidgetShortcut({ key, ...idle, takeActive: true })).toBe("during-take");
    expect(decideWidgetShortcut({ key, ...idle, takePending: true })).toBe("during-take");
  });

  it("closes the widget when it is open in the screenshot intent", () => {
    expect(
      decideWidgetShortcut({ key, ...idle, overlayOpen: true, overlayIntent: "capture" }),
    ).toBe("close");
  });

  it("switches the widget when it is open in the recording intent", () => {
    expect(decideWidgetShortcut({ key, ...idle, overlayOpen: true, overlayIntent: "record" })).toBe(
      "switch",
    );
  });

  it("keeps the take's path even with a widget open above it", () => {
    expect(
      decideWidgetShortcut({
        key,
        takeActive: true,
        takePending: false,
        overlayOpen: true,
        overlayIntent: "capture",
      }),
    ).toBe("during-take");
  });
});
