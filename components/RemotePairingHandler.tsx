"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";

export function RemotePairingHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useI18n();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("pair");
    if (!code) return;

    let cancelled = false;
    void (async () => {
      setMessage(t("remoteAccess.pairingInProgress"));
      setError(null);
      try {
        const res = await fetch("/api/remote/pair", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Pairing failed");
        if (cancelled) return;
        setMessage(t("remoteAccess.pairingSuccess"));
        window.dispatchEvent(new CustomEvent("pi-web-pairing-success"));
        const url = new URL(window.location.href);
        url.searchParams.delete("pair");
        router.replace(`${url.pathname}${url.search}${url.hash}`);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setMessage(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams, t]);

  if (!message && !error) return null;

  return (
    <div className="border-b border-border bg-bg-panel px-4 py-2 text-[12px]">
      {message && <span className="text-text">{message}</span>}
      {error && <span className="text-text-muted">{error}</span>}
    </div>
  );
}
