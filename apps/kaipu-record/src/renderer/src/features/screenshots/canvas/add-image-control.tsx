import React, { useEffect, useState } from "react";
import { Camera, ChevronDown, ImagePlus, Images } from "lucide-react";
import { useTranslations } from "@kaipu/i18n";
import { reportError } from "@renderer/features/analytics";
import { pasteShortcutLabel } from "@renderer/features/editor/use-paste-to-editor";
import { isMaintenanceError } from "@renderer/features/library/vault-errors";
import { useScreenshotMode } from "@renderer/features/screenshots/use-screenshot-mode";
import { useSupportedCaptureModes } from "@renderer/features/screenshots/use-supported-capture-modes";
import { uiArea } from "@renderer/lib/ui-area";
import { LibraryImagePicker } from "./library-image-picker";
import styles from "./add-image-control.module.css";

interface AddImageControlProps {
  /** Put a PNG on the canvas; the page owns placement, selection and the asset. */
  onAdd(png: ArrayBuffer, pixelWidth: number, pixelHeight: number): void;
  /** The shot being edited: the Library picker leaves it out (an image cannot hold itself). */
  excludeId: string | null;
  excludeAssetId: string | null;
  /** The toolbar's button classes, so the control matches the actions beside it. */
  buttonClassName: string;
  labelClassName: string;
}

/**
 * Canvas mode's "Add image" button (NIW2-703): a small menu to take a new capture or pick a
 * shot from the Library. Pasting an image works without opening it; the hint says so.
 *
 * Mounted only in canvas mode, so the flag-off editor never reads the screenshot settings
 * or the supported modes for it.
 */
export function AddImageControl({
  onAdd,
  excludeId,
  excludeAssetId,
  buttonClassName,
  labelClassName,
}: AddImageControlProps): React.JSX.Element {
  const t = useTranslations("screenshots");
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const { mode } = useScreenshotMode();
  const supported = useSupportedCaptureModes();
  // Unknown yet counts as available: main answers `unsupported` and nothing happens.
  const captureAvailable = supported === null || supported.includes(mode);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const newCapture = async (): Promise<void> => {
    setOpen(false);
    try {
      // The mode the app already resolved (the Screenshots page's pill): no new choice here.
      // `insert` sends the shot back to this editor only: main neither saves nor copies it.
      const shot = await window.electronAPI.captureScreenshot(mode, undefined, { insert: true });
      if (shot.kind !== "captured") return; // cancelled, or no backend: nothing to add
      onAdd(shot.png, shot.width, shot.height);
      window.electronAPI.revealAfterCapture();
    } catch (error) {
      // Refused before any window hid (maintenance), or the add itself failed: either way
      // main may have hidden the window, so bring it back.
      if (!isMaintenanceError(error)) reportError(t("addImageError"), error);
      window.electronAPI.revealAfterCapture();
    }
  };

  return (
    <>
      <div {...uiArea("editorImage.addImage")} className={styles.anchor} data-open={open}>
        <button
          type="button"
          className={buttonClassName}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t("addImage")}
          title={t("addImageTitle")}
          onClick={() => setOpen(!open)}
        >
          <ImagePlus size={16} />
          <span className={labelClassName}>{t("addImage")}</span>
          <ChevronDown size={12} aria-hidden />
        </button>
        {open && (
          <>
            <div className={styles.backdrop} onClick={() => setOpen(false)} aria-hidden />
            <div className={styles.menu} role="menu" aria-label={t("addImageMenu")}>
              <button
                type="button"
                role="menuitem"
                className={styles.item}
                disabled={!captureAvailable}
                title={captureAvailable ? undefined : t("notAvailable")}
                onClick={() => void newCapture()}
              >
                <Camera size={16} />
                {t("addImageNewCapture")}
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.item}
                onClick={() => {
                  setOpen(false);
                  setPicking(true);
                }}
              >
                <Images size={16} />
                {t("addImageFromLibrary")}
              </button>
              <p className={styles.hint}>{t("addImageHint", { shortcut: pasteShortcutLabel() })}</p>
            </div>
          </>
        )}
      </div>
      {picking && (
        <LibraryImagePicker
          excludeId={excludeId}
          excludeAssetId={excludeAssetId}
          onPick={onAdd}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}
