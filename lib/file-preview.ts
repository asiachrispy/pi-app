import { fileAttachmentKindFromName } from "@/lib/message-file-refs";
import { getFileName } from "@/lib/file-paths";

/** How the right-hand preview panel should handle a file. */
export type FilePreviewKind = "image" | "audio" | "pdf" | "text" | "system";

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"]);
const AUDIO_EXTS = new Set(["mp3", "wav", "ogg", "oga", "opus", "m4a", "aac", "flac", "weba", "webm"]);
const OFFICE_EXTS = new Set(["doc", "docx", "xls", "xlsx", "ppt", "pptx"]);

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function effectiveExtension(filePath: string, displayLabel?: string): string {
  const pathExt = fileExtension(getFileName(filePath));
  if (pathExt) return pathExt;
  if (displayLabel?.trim()) return fileExtension(displayLabel.trim());
  return "";
}

/** Prefer built-in preview; otherwise open with the OS default app. */
export function resolveFilePreviewKind(filePath: string, displayLabel?: string): FilePreviewKind {
  const ext = effectiveExtension(filePath, displayLabel);

  if (IMAGE_EXTS.has(ext)) return "image";
  if (AUDIO_EXTS.has(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  if (displayLabel && fileAttachmentKindFromName(displayLabel) === "pdf") return "pdf";

  if (OFFICE_EXTS.has(ext)) return "system";
  if (displayLabel) {
    const kind = fileAttachmentKindFromName(displayLabel);
    if (kind === "word" || kind === "excel") return "system";
    if (fileExtension(displayLabel) === "ppt" || fileExtension(displayLabel) === "pptx") return "system";
  }

  return "text";
}

export function canPreviewInApp(kind: FilePreviewKind): boolean {
  return kind !== "system";
}

export function canOpenWithSystemApp(): boolean {
  return typeof window !== "undefined" && Boolean(window.piNative?.openPath);
}

export async function openFileWithSystemApp(filePath: string): Promise<boolean> {
  const open = window.piNative?.openPath;
  if (!open) return false;
  await open(filePath);
  return true;
}

export function systemPreviewHintKey(filePath: string, displayLabel?: string): string {
  const ext = effectiveExtension(filePath, displayLabel);
  if (ext === "ppt" || ext === "pptx") return "fileViewer.officePptHint";
  if (ext === "xls" || ext === "xlsx") return "fileViewer.officeExcelHint";
  if (ext === "doc" || ext === "docx") return "fileViewer.officeWordHint";
  return "fileViewer.officeBinaryHint";
}
