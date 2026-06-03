"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { probeServer } from "@/lib/api-fetch";

export function ServerConnectionBanner() {
  const { t } = useI18n();
  const [online, setOnline] = useState<boolean | null>(null);

  const check = useCallback(async () => {
    const ok = await probeServer();
    setOnline(ok);
  }, []);

  useEffect(() => {
    void check();
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => void check(), 15_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [check]);

  if (online !== false) return null;

  return (
    <div className="border-b border-[color-mix(in_srgb,#ef4444_40%,var(--border))] bg-[color-mix(in_srgb,#ef4444_8%,var(--bg-panel))] px-4 py-2 text-center text-[12px] text-text">
      {t("common.serverUnavailable")}{" "}
      <button type="button" onClick={() => void check()} className="underline hover:text-text-muted">
        {t("common.retry")}
      </button>
    </div>
  );
}
