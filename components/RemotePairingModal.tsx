"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n/provider";

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  pairingUrl: string | null;
  qrDataUrl: string | null;
  loading: boolean;
  error: string | null;
  copyState: "idle" | "copied" | "failed";
  onCopy: () => void;
}

export function RemotePairingModal({
  open,
  onClose,
  pairingUrl,
  qrDataUrl,
  loading,
  error,
  copyState,
  onCopy,
}: Props) {
  const { t } = useI18n();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center bg-[rgba(0,0,0,0.36)] px-4 py-8 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("remoteAccess.pairingTitle")}
        className="w-full max-w-[640px] overflow-hidden rounded-[12px] border border-border bg-bg-popover"
        style={{ boxShadow: "var(--shadow-popover)" }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="m-0 text-[16px] font-semibold text-text">{t("remoteAccess.pairingTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="h-7 w-7 shrink-0 rounded-[6px] border border-border bg-bg-subtle text-[14px] leading-none text-text-muted hover:bg-bg-hover hover:text-text"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-5">
          {loading && !qrDataUrl ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-[13px] text-text-muted">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
              {t("remoteAccess.generatingPairing")}
            </div>
          ) : (
            <>
              <p className="m-0 text-center text-[13px] leading-5 text-text-muted">
                {t("remoteAccess.pairingModalHint")}
              </p>

              {error && (
                <div className="mt-4 rounded-[6px] border border-border bg-bg-subtle px-3 py-2 text-center text-[12px] text-text-muted">
                  {error}
                </div>
              )}

              <div className="mt-5 flex justify-center">
                <div className="flex h-[320px] w-[320px] items-center justify-center rounded-[12px] border border-border bg-white p-3">
                  {qrDataUrl ? (
                    <Image
                      src={qrDataUrl}
                      alt={t("remoteAccess.qrAlt")}
                      width={280}
                      height={280}
                      unoptimized
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
                  )}
                </div>
              </div>

              {pairingUrl && (
                <div className="mt-5 flex gap-2">
                  <input
                    readOnly
                    value={pairingUrl}
                    aria-label={t("remoteAccess.copyPairingLink")}
                    className="min-w-0 flex-1 rounded-[8px] border border-border bg-bg-subtle px-3 py-2 font-mono text-[11px] text-text-muted outline-none"
                  />
                  <button
                    type="button"
                    onClick={onCopy}
                    className="flex h-[34px] shrink-0 items-center gap-1.5 rounded-[8px] border border-border bg-bg-elevated px-3 text-[12px] font-medium text-text hover:bg-bg-hover"
                  >
                    <CopyIcon />
                    {copyState === "copied" ? t("common.copied") : copyState === "failed" ? t("common.failed") : t("common.copy")}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
