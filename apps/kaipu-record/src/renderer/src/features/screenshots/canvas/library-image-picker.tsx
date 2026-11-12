import React, { useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { useTranslations } from "@kaipu/i18n";
import { ModalActions, ModalButton, ModalOverlay, ModalText, ModalTitle } from "@kaipu/ui";
import { reportError } from "@renderer/features/analytics";
import { uiArea } from "@renderer/lib/ui-area";
import type { LocalRecording } from "@shared/types/library-storage";
import styles from "./library-image-picker.module.css";

interface LibraryImagePickerProps {
  /** The shot being edited, by vault id and by identity (a rename changes the id). */
  excludeId: string | null;
  excludeAssetId: string | null;
  onPick(png: ArrayBuffer, pixelWidth: number, pixelHeight: number): void;
  onClose(): void;
}

/** The pixel size of an encoded image, without keeping it decoded. */
async function pixelSize(bytes: ArrayBuffer): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

/**
 * Pick a vault screenshot to place on the canvas (NIW2-703). It lists the Library's
 * screenshots, newest first, without the one being edited; a click reads that shot's
 * flattened PNG and hands it to the editor.
 */
export function LibraryImagePicker({
  excludeId,
  excludeAssetId,
  onPick,
  onClose,
}: LibraryImagePickerProps): React.JSX.Element {
  const t = useTranslations("screenshots");
  // Null while the list loads, so "empty" is never shown for a list that has not arrived.
  const [shots, setShots] = useState<LocalRecording[] | null>(null);
  const [busy, setBusy] = useState(false);
  // False once the dialog unmounts, so a load that finishes after Cancel adds nothing.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    window.electronAPI
      .listLocalRecordings()
      .then((items) => {
        if (!live) return;
        setShots(
          items
            .filter(
              (item) =>
                item.kind === "screenshot" &&
                item.id !== excludeId &&
                (excludeAssetId === null || item.assetId !== excludeAssetId),
            )
            .sort((a, b) => b.createdAt - a.createdAt),
        );
      })
      .catch((error) => {
        if (!live) return;
        setShots([]);
        reportError(t("libraryPickerError"), error, { context: { phase: "add-image-list" } });
      });
    return () => {
      live = false;
    };
    // The list is read once per open; the exclusions cannot change while the dialog is up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = async (shot: LocalRecording): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const png = await window.electronAPI.readScreenshotBytes(shot.id);
      const { width, height } = await pixelSize(png);
      // Escape or Cancel closed the dialog while the shot loaded: the user said no.
      if (!mounted.current) return;
      onPick(png, width, height);
      onClose();
    } catch (error) {
      setBusy(false);
      reportError(t("libraryPickerError"), error, {
        context: { phase: "add-image-library", id: shot.id },
      });
    }
  };

  return (
    <ModalOverlay onCancel={onClose} labelledBy="library-picker-title" size="wide">
      <div
        {...uiArea("editorImage.libraryPicker")}
        className={styles.sheet}
        data-empty={shots !== null && shots.length === 0}
      >
        <header className={styles.header}>
          <ModalTitle id="library-picker-title">{t("libraryPickerTitle")}</ModalTitle>
          <ModalText>{t("libraryPickerBody")}</ModalText>
        </header>
        <div className={styles.body}>
          {shots === null && <p className={styles.note}>{t("libraryPickerLoading")}</p>}
          {shots !== null && shots.length === 0 && (
            <p className={styles.note}>{t("libraryPickerEmpty")}</p>
          )}
          {shots !== null && shots.length > 0 && (
            <ul className={styles.grid}>
              {shots.map((shot) => (
                <li key={shot.id}>
                  <button
                    type="button"
                    className={styles.card}
                    title={shot.title}
                    disabled={busy}
                    onClick={() => void pick(shot)}
                  >
                    <span className={styles.poster}>
                      {shot.thumbnailUrl ? (
                        <img src={shot.thumbnailUrl} alt="" />
                      ) : (
                        <ImagePlus size={20} aria-hidden />
                      )}
                    </span>
                    <span className={styles.cardTitle}>{shot.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className={styles.footer}>
          <ModalActions>
            <ModalButton variant="ghost" onClick={onClose}>
              {t("cancel")}
            </ModalButton>
          </ModalActions>
        </footer>
      </div>
    </ModalOverlay>
  );
}
