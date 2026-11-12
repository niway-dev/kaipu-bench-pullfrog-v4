import React from "react";
import { PenLine, Pipette } from "lucide-react";
import { useTranslations } from "@kaipu/i18n";
import { uiArea } from "@renderer/lib/ui-area";
import { ToolButton } from "../toolbar/tip";
import styles from "./inspect-toggle.module.css";

/**
 * The editor's mode switch (mock B1): Annotate | Inspect, a two-segment control that drives the
 * same Inspect state the `I` key and Esc do. Rendered only when `image-inspect` is on.
 *
 * The `inspectToggle` ui-map area sits on the Inspect segment, the button the catalog presses
 * and whose pressed state is "on". Compact (mock B3) keeps the icons and drops the words.
 */
export function InspectToggle({
  active,
  onSelect,
  compact = false,
}: {
  active: boolean;
  /** `true` enters Inspect, `false` returns to Annotate. */
  onSelect: (inspect: boolean) => void;
  compact?: boolean;
}): React.JSX.Element {
  const t = useTranslations("screenshots");
  return (
    <div
      role="group"
      aria-label={t("modeSwitchLabel")}
      className={styles.switch}
      data-compact={compact}
    >
      <ToolButton
        label={t("modeAnnotate")}
        ariaLabel={t("modeAnnotateTitle")}
        keyHint="Esc"
        aria-pressed={!active}
        className={`${styles.segment} ${active ? "" : styles.segmentOn}`}
        onClick={() => onSelect(false)}
      >
        <PenLine size={15} />
        {!compact && t("modeAnnotate")}
      </ToolButton>
      <ToolButton
        {...uiArea("editorImage.inspectToggle")}
        label={t("modeInspect")}
        ariaLabel={t("inspectTitle")}
        keyHint="I"
        aria-pressed={active}
        className={`${styles.segment} ${active ? styles.segmentOn : ""}`}
        onClick={() => onSelect(true)}
      >
        <Pipette size={15} />
        {!compact && t("modeInspect")}
      </ToolButton>
    </div>
  );
}
