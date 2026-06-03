"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

interface ClientRemoteContext {
  remoteEnabled: boolean;
  authenticated: boolean;
  readOnly: boolean;
  loopback: boolean;
}

export function RemoteAccessBanner() {
  const { t } = useI18n();
  const [context, setContext] = useState<ClientRemoteContext | null>(null);

  useEffect(() => {
    void fetch("/api/remote/client")
      .then((res) => res.json() as Promise<ClientRemoteContext>)
      .then(setContext)
      .catch(() => setContext(null));
  }, []);

  if (!context?.remoteEnabled || !context.authenticated || !context.readOnly || context.loopback) {
    return null;
  }

  return (
    <div className="border-b border-border bg-bg-panel px-4 py-2 text-center text-[12px] text-text-muted">
      {t("remoteAccess.readOnlyBanner")}
    </div>
  );
}
