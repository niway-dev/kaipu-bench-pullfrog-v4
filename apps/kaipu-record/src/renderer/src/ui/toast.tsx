import React, { useSyncExternalStore } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "@kaipu/i18n";
import { ToastList } from "@kaipu/ui";
import { dismissToast, getToasts, subscribeToasts } from "./toast-store";

/**
 * The desktop's toast host: the thin container ADR 0009 asks for. It reads this
 * app's store and resolves this app's copy, then hands both to the shared
 * presentational stack — which owns no store and knows no translation catalog,
 * so the web can mount the same component against its own.
 *
 * Mount once near the app root.
 */
export function ToastHost(): React.JSX.Element {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts);
  const t = useTranslations("common");
  const items = toasts.map((toast) => ({
    id: toast.id,
    action: toast.action,
    message:
      toast.tone === "success" ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Check
            size={13}
            strokeWidth={2.4}
            aria-hidden
            data-testid="toast-success-icon"
            style={{ color: "var(--accent-green)", flexShrink: 0 }}
          />
          {toast.message}
        </span>
      ) : (
        toast.message
      ),
  }));
  return <ToastList toasts={items} onDismiss={dismissToast} closeLabel={t("close")} />;
}
