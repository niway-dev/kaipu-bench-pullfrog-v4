import React, { useEffect, useRef, useState } from "react";
import { ImagePlus, Search, X } from "lucide-react";
import { useLocale, useTranslations } from "@kaipu/i18n";
import { ModalOverlay, ModalTitle } from "@kaipu/ui";
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

const COLUMNS = 4;

/** The file extension in caps ("PNG"), or null when the path has none. */
function formatOf(filePath: string): string | null {
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(filePath);
  return m ? m[1]!.toUpperCase() : null;
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
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
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

  // ModalOverlay focuses its own root after this child mounts, so wait a tick.
  useEffect(() => {
    const id = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(id);
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

  const needle = query.trim().toLowerCase();
  const visible = (shots ?? []).filter((shot) => shot.title.toLowerCase().includes(needle));
  // The selection is derived: a card that is filtered out (or none picked yet) falls back to the first.
  const selected = visible.find((shot) => shot.id === selectedId) ?? visible[0] ?? null;
  const dateFormat = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const target = e.target as HTMLElement;
    const inSearch = target === searchRef.current;
    const inGrid =
      target instanceof HTMLButtonElement && cardRefs.current.has(target.dataset.shotId ?? "");
    if (!inSearch && !inGrid) return;
    // The Enter that confirms an IME composition is the field's, not a "place it".
    if (e.key === "Enter" && inSearch && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (selected) void pick(selected);
      return;
    }
    // In the field, Left/Right keep moving the caret while there is text to move through.
    const step =
      e.key === "ArrowDown"
        ? COLUMNS
        : e.key === "ArrowUp"
          ? -COLUMNS
          : e.key === "ArrowRight" && !(inSearch && query)
            ? 1
            : e.key === "ArrowLeft" && !(inSearch && query)
              ? -1
              : 0;
    if (step === 0 || visible.length === 0) return;
    e.preventDefault();
    const at = selected ? visible.indexOf(selected) : 0;
    const next = visible[Math.min(visible.length - 1, Math.max(0, at + step))]!;
    setSelectedId(next.id);
    if (inGrid) cardRefs.current.get(next.id)?.focus();
  };

  return (
    <ModalOverlay onCancel={onClose} labelledBy="library-picker-title" size="wide">
      <div
        {...uiArea("editorImage.libraryPicker")}
        className={styles.sheet}
        data-empty={shots !== null && shots.length === 0}
        onKeyDown={onKeyDown}
      >
        <header className={styles.header}>
          <ModalTitle id="library-picker-title">{t("libraryPickerTitle")}</ModalTitle>
          <span className={styles.spacer} />
          <label className={styles.search}>
            <Search size={13} aria-hidden />
            <input
              ref={searchRef}
              type="text"
              value={query}
              placeholder={t("libraryPickerSearch")}
              aria-label={t("libraryPickerSearch")}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={styles.close}
            aria-label={t("libraryPickerClose")}
            onClick={onClose}
          >
            <X size={15} aria-hidden />
          </button>
        </header>
        <div className={styles.body}>
          {shots === null && <p className={styles.note}>{t("libraryPickerLoading")}</p>}
          {shots !== null && shots.length === 0 && (
            <p className={styles.note}>{t("libraryPickerEmpty")}</p>
          )}
          {shots !== null && shots.length > 0 && visible.length === 0 && (
            <p className={styles.note}>{t("libraryPickerNoMatch", { query: query.trim() })}</p>
          )}
          {visible.length > 0 && (
            <ul className={styles.grid}>
              {visible.map((shot) => {
                const isSelected = selected?.id === shot.id;
                const format = formatOf(shot.filePath ?? "");
                const date = dateFormat.format(new Date(shot.createdAt));
                return (
                  <li key={shot.id}>
                    <button
                      type="button"
                      ref={(el) => {
                        if (el) {
                          el.dataset.shotId = shot.id;
                          cardRefs.current.set(shot.id, el);
                        } else cardRefs.current.delete(shot.id);
                      }}
                      className={styles.card}
                      aria-label={shot.title}
                      aria-current={isSelected ? "true" : undefined}
                      data-selected={isSelected ? "true" : undefined}
                      disabled={busy}
                      onMouseEnter={(e) => {
                        setSelectedId(shot.id);
                        // Keyboard focus in the grid follows the pointer, so Enter places the
                        // card the ring is on, not a focused card that no longer shows it.
                        const focused = document.activeElement;
                        if (
                          focused instanceof HTMLButtonElement &&
                          focused !== e.currentTarget &&
                          cardRefs.current.has(focused.dataset.shotId ?? "")
                        )
                          e.currentTarget.focus();
                      }}
                      onFocus={() => setSelectedId(shot.id)}
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
                      <span className={styles.meta}>
                        {date}
                        {format ? ` \u00b7 ${format}` : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <footer className={styles.footer}>
          <span className={styles.hintText}>{t("libraryPickerLands")}</span>
          <span className={styles.spacer} />
          <button type="button" className={styles.ghost} onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={busy || selected === null}
            onClick={() => selected && void pick(selected)}
          >
            {t("libraryPickerPlace")}
          </button>
        </footer>
      </div>
    </ModalOverlay>
  );
}
