import React, { useId, useRef } from "react";
import { useTranslations } from "@kaipu/i18n";
import { uiArea } from "@renderer/lib/ui-area";
import styles from "./panel-tabs.module.css";

export type PanelTab = "tool" | "beautify" | "colors";

/** Every tab, in strip order: the active tool's options come first (NIW2-723). */
export const ALL_PANEL_TABS: readonly PanelTab[] = ["tool", "beautify", "colors"];

/**
 * The right side panel with its tab strip (mock A1): Tool, Beautify and, where Inspect exists,
 * Colors. Which tab is selected is the page's to say, because it follows the active tool and the
 * Inspect state rather than being kept here. `tabs` leaves Colors out when `image-inspect` is
 * off, because that tab is Inspect's.
 */
export function SidePanel({
  tab,
  onSelect,
  tabs = ALL_PANEL_TABS,
  children,
}: {
  tab: PanelTab;
  onSelect(tab: PanelTab): void;
  tabs?: readonly PanelTab[];
  children: React.ReactNode;
}): React.JSX.Element {
  const t = useTranslations("screenshots");
  const id = useId();
  const buttons = useRef<Record<PanelTab, HTMLButtonElement | null>>({
    tool: null,
    beautify: null,
    colors: null,
  });
  const names: Record<PanelTab, string> = {
    tool: t("toolPanelTab"),
    beautify: t("beautifyHeading"),
    colors: t("inspectColors"),
  };

  // Arrows move along the strip, wrapping at the ends, and focus follows the selection.
  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length];
    onSelect(next);
    buttons.current[next]?.focus();
  };

  return (
    <div className={styles.panel}>
      <div
        {...uiArea("editorImage.panelTabs")}
        role="tablist"
        aria-label={t("panelTabsLabel")}
        className={styles.tabs}
        data-state={tab}
        onKeyDown={onKeyDown}
      >
        {tabs.map((name) => (
          <button
            key={name}
            ref={(node) => {
              buttons.current[name] = node;
            }}
            type="button"
            role="tab"
            id={`${id}-${name}`}
            aria-selected={tab === name}
            aria-controls={`${id}-body`}
            tabIndex={tab === name ? 0 : -1}
            className={`${styles.tab} ${tab === name ? styles.tabOn : ""}`}
            onClick={() => onSelect(name)}
          >
            {names[name]}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-body`}
        aria-labelledby={`${id}-${tab}`}
        className={styles.body}
      >
        {children}
      </div>
    </div>
  );
}
