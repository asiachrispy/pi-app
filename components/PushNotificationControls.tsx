"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import {
  getCurrentPushSubscription,
  pushSubscriptionPayload,
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/service-worker-client";

interface PushStatus {
  enabled: boolean;
  publicKey: string | null;
  subscriptionCount: number;
}

export function PushNotificationControls() {
  const { t } = useI18n();
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [browserSubscribed, setBrowserSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/push");
    if (!res.ok) return;
    const data = (await res.json()) as { push?: PushStatus };
    setPushStatus(data.push ?? null);
    const sub = await getCurrentPushSubscription();
    setBrowserSubscribed(Boolean(sub));
  }, []);

  useEffect(() => {
    const ok = typeof window !== "undefined"
      && "serviceWorker" in navigator
      && "PushManager" in window
      && "Notification" in window;
    setSupported(ok);
    if (!ok) return;
    void registerServiceWorker();
    void refresh();
  }, [refresh]);

  const handleSubscribe = async () => {
    setBusy(true);
    setError(null);
    try {
      const statusRes = await fetch("/api/push");
      const statusData = (await statusRes.json()) as { push?: PushStatus };
      const publicKey = statusData.push?.publicKey;
      if (!publicKey) throw new Error("Push is not configured on the server");
      const subscription = await subscribeToPush(publicKey);
      if (!subscription) throw new Error("Notification permission denied");
      const payload = pushSubscriptionPayload(subscription);
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "subscribe", subscription: payload }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Subscribe failed");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleUnsubscribe = async () => {
    setBusy(true);
    setError(null);
    try {
      const sub = await getCurrentPushSubscription();
      if (sub) {
        const payload = pushSubscriptionPayload(sub);
        await fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "unsubscribe", subscription: { endpoint: payload.endpoint } }),
        });
        await unsubscribeFromPush();
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!supported) {
    return (
      <div className="text-[12px] text-text-muted">{t("remoteAccess.pushUnsupported")}</div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-[12px] leading-5 text-text-muted">{t("remoteAccess.pushDescription")}</div>
      {error && <div className="text-[12px] text-text-muted">{error}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => void handleSubscribe()}
          disabled={busy || browserSubscribed}
          className="h-8 rounded-[7px] bg-accent px-3 text-[12px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? t("remoteAccess.pushEnabling") : t("remoteAccess.pushEnable")}
        </button>
        <button
          onClick={() => void handleUnsubscribe()}
          disabled={busy || !browserSubscribed}
          className="h-8 rounded-[7px] border border-border bg-bg-elevated px-3 text-[12px] font-medium text-text-muted hover:bg-bg-hover hover:text-text disabled:opacity-50"
        >
          {t("remoteAccess.pushDisable")}
        </button>
      </div>
      {pushStatus && (
        <div className="text-[11px] text-text-dim">
          {t("remoteAccess.pushServerCount", { count: pushStatus.subscriptionCount })}
        </div>
      )}
    </div>
  );
}
