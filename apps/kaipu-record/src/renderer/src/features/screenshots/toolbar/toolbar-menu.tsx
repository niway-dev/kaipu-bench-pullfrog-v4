import React, { useEffect, useState } from "react";
import type { UiAreaProps } from "@renderer/lib/ui-area";
import { Kbd, useTip } from "./tip";
import styles from "./toolbar-parts.module.css";

export interface ToolbarMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  /** The key or shortcut that does the same, shown at the right edge. */
  hint?: string;
  /** The item names the current choice (the active drawing tool). */
  active?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

/** A divider between groups of items. */
export const MENU_DIVIDER = "divider" as const;

/**
 * The compact toolbar's menu button (Draw, More): a button that opens a list under it. Closed by
 * picking an item, by Esc, or by a click anywhere else. While it is open it is a `role="menu"`,
 * which the tool shortcuts treat as "a menu is open" and stay quiet.
 *
 * The caller spreads its own `uiArea(...)` literal as `area`, so the catalog coverage test finds it.
 */
export function ToolbarMenu({
  area,
  label,
  menuLabel,
  buttonClassName,
  items,
  children,
}: {
  area: UiAreaProps;
  /** The button's accessible name and tooltip. */
  label: string;
  menuLabel: string;
  /** Extra class for the button (its look when a choice in the menu is active). */
  buttonClassName?: string;
  items: ReadonlyArray<ToolbarMenuItem | typeof MENU_DIVIDER>;
  /** The button's content: icons. */
  children: React.ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const { bind, node } = useTip(label);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  return (
    <span {...area} className={styles.menuAnchor} data-open={open}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${styles.menuButton} ${buttonClassName ?? ""}`}
        {...bind}
        onClick={() => setOpen(!open)}
      >
        {children}
      </button>
      {!open && node}
      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} aria-hidden />
          <div className={styles.menu} role="menu" aria-label={menuLabel}>
            {items.map((item, i) =>
              item === MENU_DIVIDER ? (
                <div key={`divider-${i}`} className={styles.menuDivider} role="separator" />
              ) : (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  className={`${styles.menuItem} ${item.active ? styles.menuItemActive : ""}`}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  <span className={styles.menuIcon}>{item.icon}</span>
                  {item.label}
                  <span className={styles.menuSpacer} />
                  {item.hint ? <Kbd>{item.hint}</Kbd> : null}
                </button>
              ),
            )}
          </div>
        </>
      )}
    </span>
  );
}
