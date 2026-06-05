"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { canOpenWithSystemApp, openFileWithSystemApp } from "@/lib/file-preview";

interface Props {
  title: string;
  filePath: string;
  /** Optional right-side badge before the open button (e.g. "PDF · 12"). */
  badge?: string;
  actions?: ReactNode;
}

export function FilePreviewHeader({ title, filePath, badge, actions }: Props) {
  const { t } = useI18n();
  const canOpenExternally = canOpenWithSystemApp();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "4px 12px 4px 16px",
        borderBottom: "1px solid var(--border)",
        fontSize: 11,
        color: "var(--text-dim)",
        background: "var(--bg)",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: "var(--text)",
          fontSize: 12,
        }}
        title={filePath}
      >
        {title}
      </span>
      {badge && <span style={{ flexShrink: 0, color: "var(--text-dim)" }}>{badge}</span>}
      {actions}
      {canOpenExternally && (
        <button
          type="button"
          onClick={() => void openFileWithSystemApp(filePath)}
          title={filePath}
          style={{
            flexShrink: 0,
            padding: "4px 10px",
            fontSize: 11,
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--bg-hover)",
            color: "var(--text)",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          {t("fileViewer.openExternally")}
        </button>
      )}
    </div>
  );
}
