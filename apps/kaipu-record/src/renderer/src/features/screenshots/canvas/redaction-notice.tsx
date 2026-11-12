import React, { useId } from "react";
import { Lock } from "lucide-react";
import { useTranslations } from "@kaipu/i18n";
import { uiArea } from "@renderer/lib/ui-area";
import styles from "./redaction-notice.module.css";

/**
 * "Saving makes redactions permanent" (mock H4b): the one-time notice shown before the first
 * redaction of a machine is saved. Deliberately NOT modal: no scrim, no `aria-modal`, no focus
 * trap. The page stays reachable (Save must keep working, and the editor's key handlers stand
 * down for a modal), and the page holds its autosave while this is open.
 *
 * `onUndo` removes the most recent unsaved redaction and closes without acknowledging;
 * `onAcknowledge` closes it for good.
 */
export function RedactionNotice({
  onUndo,
  onAcknowledge,
}: {
  onUndo: () => void;
  onAcknowledge: () => void;
}): React.JSX.Element {
  const t = useTranslations("screenshots");
  const titleId = useId();
  return (
    <div
      {...uiArea("editorImage.redactionNotice")}
      role="dialog"
      aria-labelledby={titleId}
      className={styles.notice}
    >
      <div className={styles.header}>
        <span className={styles.tile} aria-hidden>
          <Lock size={15} />
        </span>
        <h2 id={titleId} className={styles.title}>
          {t("redactionNoticeTitle")}
        </h2>
      </div>
      <p className={styles.body}>{t("redactionNoticeBody")}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onUndo}>
          {t("redactionNoticeUndo")}
        </button>
        <button type="button" className={styles.primary} onClick={onAcknowledge}>
          {t("redactionNoticeOk")}
        </button>
      </div>
      <p className={styles.footnote}>{t("redactionNoticeFootnote")}</p>
    </div>
  );
}
