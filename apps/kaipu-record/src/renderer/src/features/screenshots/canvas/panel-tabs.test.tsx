import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ALL_PANEL_TABS, SidePanel, type PanelTab } from "./panel-tabs";

function mount(tab: PanelTab, tabs: readonly PanelTab[] = ALL_PANEL_TABS) {
  const onSelect = vi.fn();
  render(
    <SidePanel tab={tab} onSelect={onSelect} tabs={tabs}>
      <p>body</p>
    </SidePanel>,
  );
  return onSelect;
}

describe("SidePanel", () => {
  it("lists Tool, Beautify and Colors in that order, with the selected one marked", () => {
    mount("tool");
    expect(screen.getAllByRole("tab").map((el) => el.textContent)).toEqual([
      "Tool",
      "Beautify",
      "Colors",
    ]);
    expect(screen.getByRole("tab", { name: "Tool" })).toHaveAttribute("aria-selected", "true");
  });

  it("leaves out the tabs it is not given", () => {
    mount("beautify", ["tool", "beautify"]);
    expect(screen.queryByRole("tab", { name: "Colors" })).toBeNull();
  });

  it("selects a tab on click", () => {
    const onSelect = mount("beautify");
    fireEvent.click(screen.getByRole("tab", { name: "Tool" }));
    expect(onSelect).toHaveBeenCalledWith("tool");
  });

  it("moves along the strip with the arrows, wrapping at both ends", () => {
    const onSelect = mount("tool");
    const strip = screen.getByRole("tablist");
    fireEvent.keyDown(strip, { key: "ArrowRight" });
    expect(onSelect).toHaveBeenLastCalledWith("beautify");
    fireEvent.keyDown(strip, { key: "ArrowLeft" });
    expect(onSelect).toHaveBeenLastCalledWith("colors");
  });

  it("wraps over only the tabs it shows", () => {
    const onSelect = mount("beautify", ["tool", "beautify"]);
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(onSelect).toHaveBeenLastCalledWith("tool");
  });
});
