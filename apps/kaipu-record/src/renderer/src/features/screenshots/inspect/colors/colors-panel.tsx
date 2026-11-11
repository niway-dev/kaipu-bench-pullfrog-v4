import React from "react";
import { X } from "lucide-react";
import { useTranslations } from "@kaipu/i18n";
import { uiArea } from "@renderer/lib/ui-area";
import { formatColor, type ColorFormat } from "../color";
import { formatShare, unpackRgb, type ColorGroup, type LocateTarget } from "./histogram";
import { sameTarget, type ColorsController } from "./use-colors";
import styles from "./colors.module.css";

const css = (rgb: number): string => `#${rgb.toString(16).padStart(6, "0")}`;

function Row({
  group,
  total,
  format,
  located,
  onLocate,
}: {
  group: ColorGroup;
  total: number;
  format: ColorFormat;
  located: LocateTarget | null;
  onLocate(target: LocateTarget): void;
}): React.JSX.Element {
  const t = useTranslations("screenshots");
  const value = formatColor(unpackRgb(group.rgb), format);
  const groupTarget: LocateTarget = { kind: "group", id: group.id };
  const on = sameTarget(groupTarget, located);
  return (
    <li className={styles.row} data-group={group.id}>
      <button
        type="button"
        className={`${styles.group} ${on ? styles.on : ""}`}
        aria-pressed={on}
        title={t("inspectColorsLocateGroup", { color: value })}
        onClick={() => onLocate(groupTarget)}
      >
        <span className={styles.swatch} style={{ background: css(group.rgb) }} />
        <span className={styles.value}>{value}</span>
        <span className={styles.share}>{formatShare(group.count, total)}</span>
      </button>
      {group.members.length > 1 && (
        <div className={styles.members}>
          {group.members.map((member) => {
            const memberValue = formatColor(unpackRgb(member.rgb), format);
            const target: LocateTarget = { kind: "color", rgb: member.rgb };
            const memberOn = sameTarget(target, located);
            return (
              <button
                key={member.rgb}
                type="button"
                className={`${styles.member} ${memberOn ? styles.on : ""}`}
                aria-pressed={memberOn}
                title={t("inspectColorsLocateColor", { color: memberValue })}
                onClick={() => onLocate(target)}
              >
                <span className={styles.memberSwatch} style={{ background: css(member.rgb) }} />
                <span className={styles.value}>{memberValue}</span>
                <span className={styles.share}>{formatShare(member.count, total)}</span>
              </button>
            );
          })}
        </div>
      )}
    </li>
  );
}

/**
 * The colors panel: the image's colors, largest first, each with its share. A group with more
 * than one notable exact value lists them under it, so two whites that should have been one
 * are side by side. Clicking a group or a value highlights where it is in the image.
 * Values are sRGB in the Inspect bar's format.
 */
function ColorsPanelView({
  colors,
  format,
  reading,
}: {
  colors: ColorsController;
  format: ColorFormat;
  /** Inspect is still decoding the pixels. */
  reading: boolean;
}): React.JSX.Element {
  const t = useTranslations("screenshots");
  const { analysis, status, located, overlay } = colors;
  const state = located ? "located" : status === "ready" ? "list" : status;
  return (
    <section
      {...uiArea("editorImage.inspectColors")}
      className={styles.panel}
      aria-label={t("inspectColorsLabel")}
      data-state={state}
    >
      <header className={styles.header}>
        <span className={styles.title}>{t("inspectColors")}</span>
        {analysis && (
          <span className={styles.summary}>
            {t("inspectColorsSummary", {
              groups: analysis.totalGroups,
              distinct: analysis.distinct,
            })}
          </span>
        )}
      </header>
      {(reading || status === "counting") && (
        <span className={styles.status}>{t("inspectColorsCounting")}</span>
      )}
      {status === "error" && <span className={styles.status}>{t("inspectColorsUnavailable")}</span>}
      {analysis && analysis.groups.length === 0 && (
        <span className={styles.status}>{t("inspectColorsEmpty")}</span>
      )}
      {analysis && analysis.groups.length > 0 && (
        <ul className={styles.list}>
          {analysis.groups.map((group) => (
            <Row
              key={group.id}
              group={group}
              total={analysis.counted}
              format={format}
              located={located}
              onLocate={colors.locate}
            />
          ))}
        </ul>
      )}
      {analysis && analysis.totalGroups > analysis.groups.length && (
        <span className={styles.status}>
          {t("inspectColorsMore", {
            shown: analysis.groups.length,
            total: analysis.totalGroups,
          })}
        </span>
      )}
      {located && (
        <div className={styles.footer}>
          <span className={styles.status}>
            {overlay ? t("inspectColorsMatched", { count: overlay.matched }) : "…"}
          </span>
          <button type="button" className={styles.clear} onClick={() => colors.locate(null)}>
            <X size={12} />
            {t("inspectColorsClear")}
          </button>
        </div>
      )}
    </section>
  );
}

/** Memoized: the page re-renders on every hover move, the list only when its inputs change. */
export const ColorsPanel = React.memo(ColorsPanelView);
