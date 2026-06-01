"use client";

import { useEffect, useState } from "react";
import type { ProductHistoryItem, Scene } from "@/lib/scenes";

interface Props {
  onOpenScene: (scene: Scene) => void;
  onOpenHistory: (item: ProductHistoryItem) => void;
  onOpenSettings: () => void;
  launchingSceneId?: string | null;
}

export function WorkbenchHome({ onOpenScene, onOpenHistory, onOpenSettings, launchingSceneId }: Props) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [history, setHistory] = useState<ProductHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/scenes").then((res) => res.json() as Promise<{ scenes: Scene[] }>),
      fetch("/api/history").then((res) => res.json() as Promise<{ history: ProductHistoryItem[] }>).catch(() => ({ history: [] })),
    ]).then(([sceneData, historyData]) => {
      if (cancelled) return;
      setScenes(sceneData.scenes ?? []);
      setHistory((historyData.history ?? []).slice(0, 5));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-5 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0] text-text-dim">Enterprise Workbench</div>
            <h1 className="m-0 mt-1 text-[24px] font-semibold leading-tight tracking-[0] text-text">Scenes</h1>
          </div>
          <button
            onClick={onOpenSettings}
            className="h-8 rounded-[7px] border border-border bg-bg-panel px-3 text-[12px] font-medium text-text-muted hover:bg-bg-hover hover:text-text"
          >
            Platform settings
          </button>
        </div>

        {loading ? (
          <div className="rounded-[8px] border border-border bg-bg-panel p-4 text-[13px] text-text-muted">Loading scenes...</div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
            {scenes.map((scene) => (
              <button
                key={scene.id}
                onClick={() => onOpenScene(scene)}
                className="group flex min-h-[190px] flex-col items-start rounded-[8px] border border-border bg-bg-panel p-4 text-left transition hover:border-[color-mix(in_srgb,var(--accent)_42%,var(--border))] hover:bg-bg-elevated"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="rounded-[6px] border border-border bg-bg-subtle px-2 py-1 text-[11px] font-medium text-text-muted">{scene.category}</span>
                  <span className="text-[11px] text-text-dim">{scene.suggestedStarters.length} starters</span>
                </div>
                <div className="mt-4 text-[17px] font-semibold leading-snug text-text">{scene.name}</div>
                <div className="mt-2 line-clamp-3 text-[13px] leading-6 text-text-muted">{scene.description}</div>
                <div className="mt-auto flex w-full items-center justify-between pt-4">
                  <span className="text-[12px] text-text-dim">{scene.outputStyle.split(".")[0]}</span>
                  <span className="rounded-[7px] bg-accent px-3 py-1.5 text-[12px] font-semibold text-white">
                    {launchingSceneId === scene.id ? "Opening..." : "Open"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        <section className="mt-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="m-0 text-[14px] font-semibold text-text">My Work</h2>
            <span className="text-[11px] text-text-dim">Recent scene runs and chats</span>
          </div>
          <div className="overflow-hidden rounded-[8px] border border-border bg-bg-panel">
            {history.length === 0 ? (
              <div className="p-4 text-[13px] text-text-muted">No recent work yet.</div>
            ) : (
              history.map((item) => (
                <button
                  key={item.sessionId}
                  onClick={() => onOpenHistory(item)}
                  className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-bg-hover"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-text">{item.title}</div>
                    <div className="mt-1 truncate text-[12px] text-text-muted">{item.sceneName} · {item.summary}</div>
                  </div>
                  <div className="shrink-0 text-[11px] text-text-dim">{new Date(item.updatedAt).toLocaleDateString()}</div>
                </button>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
