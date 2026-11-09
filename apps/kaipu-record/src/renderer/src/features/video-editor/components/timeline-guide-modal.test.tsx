import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import enMessages from "../../../../../../../../packages/i18n/messages/en.json";
import esMessages from "../../../../../../../../packages/i18n/messages/es.json";
import { GUIDE_CONTENT, GUIDE_TABS, neighbourTab, type GuideTab } from "../track-guide";
import { TimelineGuideModal } from "./timeline-guide-modal";

function Harness({ start, onClose }: { start: GuideTab; onClose: () => void }) {
  const [tab, setTab] = useState(start);
  return <TimelineGuideModal tab={tab} onTabChange={setTab} onClose={onClose} />;
}

const selectedTab = (): string =>
  screen.getByRole("tab", { selected: true }).textContent?.trim() ?? "";

describe("TimelineGuideModal", () => {
  it("opens on the given tab and walks the tabs with Next and Previous", () => {
    render(<Harness start="clips" onClose={vi.fn()} />);
    expect(selectedTab()).toContain("Clips");
    // The sample timeline's lane labels carry the same names: the walk lives in the footer.
    const walk = within(screen.getByRole("dialog").querySelector("footer")!);
    fireEvent.click(walk.getByRole("button", { name: /Objects/ }));
    expect(selectedTab()).toContain("Objects");
    fireEvent.click(walk.getByRole("button", { name: /Clips/ }));
    expect(selectedTab()).toContain("Clips");
  });

  it("moves between tabs with the arrow keys, and only the selected tab is a Tab stop", () => {
    render(<Harness start="clips" onClose={vi.fn()} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.getAttribute("tabindex"))).toEqual([
      "0",
      "-1",
      "-1",
      "-1",
      "-1",
      "-1",
    ]);
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(selectedTab()).toContain("Objects");
    expect(screen.getByRole("tab", { selected: true })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "End" });
    expect(selectedTab()).toContain("Webcam");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(selectedTab()).toContain("Clips");
  });

  it("switches tabs when one is pressed", () => {
    render(<Harness start="clips" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: /Zooms/ }));
    expect(selectedTab()).toContain("Zooms");
  });

  it("closes with Escape", () => {
    const onClose = vi.fn();
    render(<Harness start="zooms" onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes with Escape even when focus fell to the page", () => {
    const onClose = vi.fn();
    render(<Harness start="zooms" onClose={onClose} />);
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps Tab inside the dialog", () => {
    render(<Harness start="clips" onClose={vi.fn()} />);
    const buttons = within(screen.getByRole("dialog")).getAllByRole("button");
    const last = buttons.filter((b) => !(b as HTMLButtonElement).disabled).at(-1)!;
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(last);
  });
});

describe("track guide content", () => {
  const ve = (messages: unknown): Record<string, string> =>
    (messages as { videoEditor: Record<string, string> }).videoEditor;

  it("has every message key in English and Spanish", () => {
    const keys = new Set<string>();
    for (const tab of GUIDE_TABS) {
      const c = GUIDE_CONTENT[tab];
      keys.add(c.nameKey).add(c.introKey).add(c.whyKey);
      c.legend.forEach((l) => keys.add(l.textKey));
      c.how.forEach((h) => {
        keys.add(h.textKey);
        if (h.chipKey) keys.add(h.chipKey);
      });
    }
    for (const key of keys) {
      expect(ve(enMessages)[key], `en ${key}`).toBeTruthy();
      expect(ve(esMessages)[key], `es ${key}`).toBeTruthy();
    }
  });

  it("promises nothing the Objects lane cannot do yet", () => {
    const c = GUIDE_CONTENT.annotations;
    const text = [c.introKey, c.whyKey, ...c.legend.map((l) => l.textKey)]
      .map((k) => ve(enMessages)[k])
      .join(" ");
    expect(text).not.toMatch(/image|gif/i);
  });

  it("stops at both ends", () => {
    expect(neighbourTab("clips", -1)).toBeNull();
    expect(neighbourTab("webcam", 1)).toBeNull();
    expect(neighbourTab("clips", 1)).toBe("annotations");
  });
});
