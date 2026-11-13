import { describe, expect, it } from "vitest";
import { decideStartShortcut } from "./start-shortcut";

const idle = { takeActive: false, takePending: false, overlayOpen: false };

describe("decideStartShortcut", () => {
  it("opens the selector when nothing is going on", () => {
    expect(decideStartShortcut(idle)).toBe("open");
  });

  it("stops a live take", () => {
    expect(decideStartShortcut({ ...idle, takeActive: true })).toBe("stop");
  });

  it("stops a pending take (the countdown), which cancels it", () => {
    expect(decideStartShortcut({ ...idle, takePending: true })).toBe("stop");
  });

  it("closes the selector when it is open", () => {
    expect(decideStartShortcut({ ...idle, overlayOpen: true })).toBe("close");
  });

  it("prefers stopping a take over closing a selector opened above it", () => {
    expect(decideStartShortcut({ takeActive: true, takePending: false, overlayOpen: true })).toBe(
      "stop",
    );
    expect(decideStartShortcut({ takeActive: false, takePending: true, overlayOpen: true })).toBe(
      "stop",
    );
  });
});
