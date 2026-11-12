import React from "react";
import { PanelRight } from "lucide-react";
import { useTranslations } from "@kaipu/i18n";
import { uiArea } from "@renderer/lib/ui-area";
import { useTip } from "./tip";
import styles from "./toolbar-parts.module.css";

/** The compact toolbar's button that opens and closes the right panel's sheet (mock B3). */
export function PanelToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const t = useTranslations("screenshots");
  const { bind, node } = useTip(t("panelToggle"));
  return (
    <span {...uiArea("editorImage.panelToggle")} className={styles.tipWrap} data-open={open}>
      <button
        type="button"
        aria-label={t("panelToggle")}
        aria-expanded={open}
        className={styles.panelToggle}
        {...bind}
        onClick={onToggle}
      >
        <PanelRight size={16} />
      </button>
      {node}
    </span>
  );
}
