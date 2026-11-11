import React from "react";
import { Pipette } from "lucide-react";
import { useTranslations } from "@kaipu/i18n";
import { uiArea } from "@renderer/lib/ui-area";
import styles from "./inspect.module.css";

/** Toolbar button that turns Inspect on or off. Rendered only when `image-inspect` is on. */
export function InspectToggle({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const t = useTranslations("screenshots");
  const label = t("inspectTitle");
  return (
    <div className={styles.toggleGroup}>
      <button
        {...uiArea("editorImage.inspectToggle")}
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={active}
        className={`${styles.toggle} ${active ? styles.toggleOn : ""}`}
        onClick={onToggle}
      >
        <Pipette size={19} />
      </button>
    </div>
  );
}
