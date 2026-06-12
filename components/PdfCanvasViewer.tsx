"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { FilePreviewHeader } from "@/components/FilePreviewHeader";
import { displayNameFromFilePath } from "@/lib/message-file-refs";
import { encodeFilePathForApi, getRelativeFilePath } from "@/lib/file-paths";

interface Props {
  filePath: string;
  cwd?: string;
  displayLabel?: string;
  /** Active session id; lets the API allow files the agent referenced outside cwd. */
  sessionId?: string;
}

function clearManualChildren(host: HTMLDivElement | null): void {
  if (!host) return;
  while (host.firstChild) {
    host.removeChild(host.firstChild);
  }
}

async function fetchPdfBytes(filePath: string, sessionId?: string): Promise<ArrayBuffer> {
  const encoded = encodeFilePathForApi(filePath);
  const query = sessionId ? `&sessionId=${encodeURIComponent(sessionId)}` : "";
  const res = await fetch(`/api/files/${encoded}?type=read${query}`, { credentials: "same-origin" });
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    if (contentType.includes("application/json")) {
      const body = (await res.json()) as { error?: string };
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    throw new Error(`HTTP ${res.status}`);
  }
  if (contentType.includes("application/json")) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error ?? "Not a PDF");
  }
  return res.arrayBuffer();
}

export function PdfCanvasViewer({ filePath, cwd, displayLabel, sessionId }: Props) {
  const { t } = useI18n();
  /** PDF page canvases only — never mount React children here. */
  const pagesRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const title = (displayLabel?.trim() || displayNameFromFilePath(filePath)) || getRelativeFilePath(filePath, cwd);
  const pdfBadge =
    pageCount > 0 ? `${t("fileViewer.pdf")} · ${pageCount}` : t("fileViewer.pdf");

  useEffect(() => {
    let cancelled = false;
    let destroyDoc: (() => void) | null = null;
    const pagesHost = pagesRef.current;
    clearManualChildren(pagesHost);

    setLoading(true);
    setError(null);
    setPageCount(0);

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const data = await fetchPdfBytes(filePath, sessionId);
        if (cancelled) return;

        const task = pdfjs.getDocument({ data });
        const pdf = await task.promise;
        if (cancelled) {
          void pdf.destroy();
          return;
        }
        destroyDoc = () => void pdf.destroy();
        if (!cancelled) setPageCount(pdf.numPages);

        const host = pagesRef.current;
        if (!host || cancelled) return;

        clearManualChildren(host);

        if (host.clientWidth === 0) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
        if (cancelled) return;

        const hostWidth = host.clientWidth > 0 ? host.clientWidth - 32 : 720;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNum);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = hostWidth / baseViewport.width;
          const viewport = page.getViewport({ scale: Math.min(Math.max(scale, 0.5), 2.5) });

          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.display = "block";
          canvas.style.maxWidth = "100%";
          canvas.style.height = "auto";
          canvas.style.margin = "0 auto 16px";
          canvas.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)";

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;

          await page.render({ canvasContext: ctx, viewport }).promise;
          if (cancelled) return;

          const wrap = document.createElement("div");
          wrap.style.display = "flex";
          wrap.style.justifyContent = "center";
          wrap.appendChild(canvas);
          host.appendChild(wrap);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      destroyDoc?.();
      clearManualChildren(pagesHost);
    };
  }, [filePath, sessionId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <FilePreviewHeader title={title} filePath={filePath} badge={pdfBadge} />
      <div style={{ flex: 1, overflow: "hidden", position: "relative", background: "var(--bg-panel)" }}>
        <div
          ref={pagesRef}
          style={{
            height: "100%",
            overflow: "auto",
            padding: 16,
            visibility: loading || error ? "hidden" : "visible",
          }}
        />
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              fontSize: 13,
              background: "var(--bg-panel)",
            }}
          >
            {t("fileViewer.loading")}
          </div>
        )}
        {!loading && error && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: 24,
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 13,
              background: "var(--bg-panel)",
            }}
          >
            <p style={{ margin: 0, color: "#f87171" }}>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
