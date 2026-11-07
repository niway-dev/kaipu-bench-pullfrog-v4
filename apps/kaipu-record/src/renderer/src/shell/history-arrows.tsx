import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useInRouterContext, useNavigate } from "react-router-dom";
import { useTranslations } from "@kaipu/i18n";
import { uiArea } from "@renderer/lib/ui-area";
import styles from "./title-bar.module.css";
import { useHistoryPosition } from "./use-history-position";

/**
 * Back and Forward through the in-app history, beside the logo like most desktop apps.
 * They move the router's history, so an editor's leave guard still gets to ask about an
 * unsaved edit, exactly as it does for a sidebar click.
 *
 * `hidden` draws nothing but keeps the position tracking mounted: a page pushed while the
 * buttons are away (sign-in, the onboarding takeover) drops the browser's forward entries,
 * and an unmounted hook would come back believing they still exist.
 */
export function HistoryArrows({ hidden = false }: { hidden?: boolean }): React.JSX.Element | null {
  // The bar also draws in tests and screens that have no router; no history there.
  if (!useInRouterContext()) return null;
  return <Arrows hidden={hidden} />;
}

function Arrows({ hidden }: { hidden: boolean }): React.JSX.Element | null {
  const t = useTranslations("nav");
  const navigate = useNavigate();
  const { canGoBack, canGoForward } = useHistoryPosition();
  if (hidden) return null;
  return (
    <div
      {...uiArea("shell.historyArrows")}
      className={`${styles.history} ${styles.interactive}`}
      data-state={canGoBack ? "canGoBack" : "atStart"}
    >
      <button
        type="button"
        className={styles.historyButton}
        aria-label={t("back")}
        title={t("back")}
        disabled={!canGoBack}
        onClick={() => navigate(-1)}
      >
        <ChevronLeft size={18} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className={styles.historyButton}
        aria-label={t("forward")}
        title={t("forward")}
        disabled={!canGoForward}
        onClick={() => navigate(1)}
      >
        <ChevronRight size={18} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
