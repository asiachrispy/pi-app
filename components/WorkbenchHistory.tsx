"use client";

import { useEffect, useState } from "react";
import type { ProductHistoryItem } from "@/lib/scenes";

interface Props {
  onOpenHistory: (item: ProductHistoryItem) => void;
}

export function WorkbenchHistory({ onOpenHistory }: Props) {
  const [items, setItems] = useState<ProductHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/history")
      .then((res) => res.json() as Promise<{ history: ProductHistoryItem[] }>)
      .then((data) => {
        if (!cancelled) setItems(data.history ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[980px] px-5 py-5">
        <div className="mb-4 border-b border-border pb-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0] text-text-dim">Workbench</div>
          <h1 className="m-0 mt-1 text-[22px] font-semibold tracking-[0] text-text">My Work</h1>
        </div>
        <div className="overflow-hidden rounded-[8px] border border-border bg-bg-panel">
          {loading && <div className="p-4 text-[13px] text-text-muted">Loading history...</div>}
          {!loading && items.length === 0 && <div className="p-4 text-[13px] text-text-muted">No work found.</div>}
          {items.map((item) => (
            <button
              key={item.sessionId}
              onClick={() => onOpenHistory(item)}
              className="grid w-full grid-cols-[minmax(0,1fr)_150px_96px] items-center gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-bg-hover max-[720px]:grid-cols-1"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-text">{item.title}</div>
                <div className="mt-1 truncate text-[12px] text-text-muted">{item.summary}</div>
              </div>
              <div className="text-[12px] text-text-muted">{item.sceneName}</div>
              <div className="text-[11px] text-text-dim">{new Date(item.updatedAt).toLocaleString()}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
