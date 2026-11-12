import React from "react";
import { Lock } from "lucide-react";
import { useLocale, useTranslations } from "@kaipu/i18n";
import { uiArea } from "@renderer/lib/ui-area";
import styles from "./redaction-lock-tag.module.css";

/**
 * "Permanent · saved Nov 11" (mock H4a): the tag a selected, already-saved redaction wears just
 * right of its region. `left`/`top` are the region's top-right corner in the annotation layer's
 * px; the offset and the size are one screen size at any zoom (the layer is scaled by it), like
 * the other canvas chrome. `lockedAt` is absent for a redaction locked before the time was kept.
 */
export function RedactionLockTag({
  left,
  top,
  lockedAt,
}: {
  left: number;
  top: number;
  lockedAt?: number;
}): React.JSX.Element {
  const t = useTranslations("screenshots");
  const locale = useLocale();
  const text =
    lockedAt === undefined
      ? t("redactionPermanent")
      : t("redactionPermanentSaved", {
          date: new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(
            new Date(lockedAt),
          ),
        });
  return (
    <div
      {...uiArea("editorImage.redactionLock")}
      className={styles.tag}
      style={{ left, top }}
      data-testid="redaction-lock-tag"
      aria-hidden
    >
      <Lock size={11} aria-hidden />
      <span>{text}</span>
    </div>
  );
}
