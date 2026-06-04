/** Stage browser-selected files on disk so the agent gets absolute paths (any location). */

import type { FilePathRef } from "@/lib/message-file-refs";
import { basenameFromPath, displayNameFromFilePath } from "@/lib/message-file-refs";

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export async function stageFilesFromBrowser(files: File[]): Promise<FilePathRef[]> {
  if (!files.length) return [];
  const payload = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      base64: await readFileAsBase64(file),
    })),
  );
  const res = await fetch("/api/files/stage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: payload }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    files?: Array<{ path: string; label?: string; name?: string }>;
    paths?: string[];
  };
  if (data.files?.length) {
    return data.files.map((f) => ({
      path: f.path,
      label: (f.label ?? f.name ?? displayNameFromFilePath(f.path)).trim() || displayNameFromFilePath(f.path),
    }));
  }
  return (data.paths ?? []).map((p) => ({
    path: p,
    label: displayNameFromFilePath(p),
  }));
}

export async function pickFilePathsNative(): Promise<FilePathRef[] | null> {
  if (typeof window === "undefined") return null;
  const pick = window.piNative?.pickFiles;
  if (!pick) return null;
  const result = await pick();
  if (!result?.length) return null;
  return result.map((p) => ({
    path: p,
    label: basenameFromPath(p),
  }));
}
