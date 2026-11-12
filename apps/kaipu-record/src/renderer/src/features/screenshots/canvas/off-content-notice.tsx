import React from "react";
import { ArrowUp } from "lucide-react";
import { useTranslations } from "@kaipu/i18n";
import { uiArea } from "@renderer/lib/ui-area";
import { directionAngle, type Direction } from "./off-content";
import styles from "./off-content-notice.module.css";

const TEXT_KEY = {
  up: "offContentUp",
  upRight: "offContentUpRight",
  right: "offContentRight",
  downRight: "offContentDownRight",
  down: "offContentDown",
  downLeft: "offContentDownLeft",
  left: "offContentLeft",
  upLeft: "offContentUpLeft",
} as const satisfies Record<Direction, string>;

/**
 * "Most of the content is <direction>" (mock A6): a pill at the stage's bottom-right with an
 * arrow turned toward the content and the key that brings it back. Pressing it fits the
 * content in view.
 */
export function OffContentNotice({
  direction,
  onFit,
}: {
  direction: Direction;
  onFit: () => void;
}): React.JSX.Element {
  const t = useTranslations("screenshots");
  return (
    <button
      type="button"
      {...uiArea("editorImage.offContentNotice")}
      className={styles.notice}
      data-direction={direction}
      onClick={onFit}
    >
      <ArrowUp
        size={16}
        strokeWidth={2.4}
        className={styles.arrow}
        style={{ transform: `rotate(${directionAngle(direction)}deg)` }}
        aria-hidden
      />
      <span>{t(TEXT_KEY[direction])}</span>
      <kbd className={styles.key}>⇧1</kbd>
    </button>
  );
}
