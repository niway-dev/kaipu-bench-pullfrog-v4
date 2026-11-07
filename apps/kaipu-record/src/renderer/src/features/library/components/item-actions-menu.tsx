import { useEffect, useRef, useState } from "react";
import { Check, Copy, FolderInput, HardDriveDownload, MoreHorizontal, Trash2 } from "lucide-react";
import { useTranslations } from "@kaipu/i18n";
import { showToast } from "@renderer/ui/toast-store";
import { useOptionalWorkspaces } from "@renderer/features/workspaces/workspaces-context";
import { MoveTargetList, useMoveLock } from "@renderer/features/workspaces/move/move-target-list";
import { useMoveItems } from "@renderer/features/workspaces/move/use-move-items";
import { uiArea } from "@renderer/lib/ui-area";
import { reasonText } from "@renderer/features/workspaces/move/move-flow";
import { closeItemPage } from "@renderer/features/workspaces/prepare-switch";
import styles from "./item-actions-menu.module.css";

/**
 * The "•••" menu of the item page (NIW2-669): Copy image, Copy path, Move to workspace…,
 * Remove local download, and Delete…. It floats over the content (absolute), so opening it
 * never moves the layout. Escape and a click outside close it; the arrow keys walk the items.
 */
export function ItemActionsMenu({
  assetId,
  isScreenshot,
  copied,
  canRemoveLocalCopy,
  onCopyImage,
  onCopyPath,
  onRemoveLocalCopy,
  onDelete,
}: {
  assetId: string;
  isScreenshot: boolean;
  copied: boolean;
  canRemoveLocalCopy: boolean;
  onCopyImage(): void;
  onCopyPath(): void;
  onRemoveLocalCopy(): void;
  onDelete(): void;
}): React.JSX.Element {
  const t = useTranslations("library");
  const tm = useTranslations("move");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "move">("menu");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const workspaces = useOptionalWorkspaces();
  const move = useMoveItems();
  const lock = useMoveLock(workspaces?.state ?? null);
  const canMove = Boolean(workspaces?.state && workspaces.active);

  const close = (refocus: boolean): void => {
    setOpen(false);
    setView("menu");
    if (refocus) trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent): void => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
        setView("menu");
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
  }, [open, view]);

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = [
      ...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []),
    ];
    if (items.length === 0) return;
    event.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "ArrowDown" ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  const run = (action: () => void): void => {
    close(false);
    action();
  };

  const pickTarget = async (target: string | "new"): Promise<void> => {
    close(false);
    // The current id and the exports come from a fresh list: a rename may have changed the id.
    const library = await window.electronAPI.listLocalRecordings();
    const item = library.find((entry) => entry.assetId === assetId);
    if (!item) {
      showToast({ message: reasonText("not-found", (key) => tm(key as Parameters<typeof tm>[0])) });
      return;
    }
    await move({ items: [item], target, library, before: closeItemPage });
  };

  return (
    <div ref={root} className={styles.anchor} onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("moreActions")}
        title={t("moreActions")}
        data-open={open || undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <MoreHorizontal size={16} strokeWidth={1.8} />
      </button>
      {open && (
        <div
          {...uiArea("libraryDetail.itemMenu")}
          ref={menu}
          className={styles.menu}
          role="menu"
          aria-label={t("moreActions")}
        >
          {view === "menu" ? (
            <>
              {isScreenshot && (
                <button
                  type="button"
                  role="menuitem"
                  className={styles.item}
                  onClick={() => run(onCopyImage)}
                >
                  {copied ? (
                    <Check size={14} strokeWidth={1.8} />
                  ) : (
                    <Copy size={14} strokeWidth={1.8} />
                  )}
                  {copied ? t("copied") : t("copyImage")}
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                className={styles.item}
                onClick={() => run(onCopyPath)}
              >
                <Copy size={14} strokeWidth={1.8} />
                {t("copyPath")}
              </button>
              {canMove && (
                <button
                  type="button"
                  role="menuitem"
                  className={styles.item}
                  onClick={() => setView("move")}
                >
                  <FolderInput size={14} strokeWidth={1.8} />
                  {t("moveToWorkspace")}
                </button>
              )}
              {canRemoveLocalCopy && (
                <button
                  type="button"
                  role="menuitem"
                  className={styles.item}
                  onClick={() => run(onRemoveLocalCopy)}
                >
                  <HardDriveDownload size={14} strokeWidth={1.8} />
                  {t("removeLocalCopy")}
                </button>
              )}
              <div className={styles.divider} role="separator" />
              <button
                type="button"
                role="menuitem"
                className={styles.item}
                data-danger
                onClick={() => run(onDelete)}
              >
                <Trash2 size={14} strokeWidth={1.8} />
                {t("deleteMenu")}
              </button>
            </>
          ) : (
            workspaces?.state &&
            workspaces.active && (
              <div className={styles.moveView}>
                <MoveTargetList
                  state={workspaces.state}
                  active={workspaces.active}
                  lock={lock}
                  onPick={(target) => void pickTarget(target)}
                />
                <p className={styles.footnote}>{tm("closesPage")}</p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
