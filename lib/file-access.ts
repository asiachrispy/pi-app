import fs from "node:fs";
import { readdirSync } from "fs";
import { homedir } from "os";
import path from "path";
import { getAgentDir, listAllSessions } from "./session-reader";

// Short-TTL cache for the allowed-roots set. Without this, every file list/read
// request re-scans every pi session on disk just to check access. 5s is short
// enough that newly-created cwds appear promptly; stored on globalThis so it
// survives Next.js hot-reload.
declare global {
  var __piAllowedRootsCache: { roots: Set<string>; expiresAt: number } | undefined;
  var __piAdditionalAllowedRoots: Set<string> | undefined;
}

const ALLOWED_ROOTS_TTL_MS = 5_000;
const WINDOWS_ABSOLUTE_RE = /^[a-zA-Z]:[\\/]/;

export type ParsedByteRange =
  | { start: number; end: number }
  | { error: "invalid" | "unsatisfiable" };
export function normalizeSlashes(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

export function isWindowsAbsolutePath(filePath: string): boolean {
  return WINDOWS_ABSOLUTE_RE.test(filePath) || filePath.startsWith("\\\\") || filePath.startsWith("//");
}

export function filePathFromSegments(segments: string[]): string {
  const joined = segments.join("/");
  const slashJoined = normalizeSlashes(joined);
  if (isWindowsAbsolutePath(slashJoined)) return slashJoined;
  return "/" + joined.replace(/^\/+/, "");
}

/** Read a single file path only when it stays inside the allowed roots. */
export function canReadFilePath(target: string, allowedRoots: Set<string>): boolean {
  return isPathAllowed(target, allowedRoots) && isRealPathAllowed(target, allowedRoots);
}

function getAdditionalAllowedRoots(): Set<string> {
  if (!globalThis.__piAdditionalAllowedRoots) {
    globalThis.__piAdditionalAllowedRoots = new Set();
  }
  return globalThis.__piAdditionalAllowedRoots;
}

export function allowFileRoot(root: string): void {
  if (!root) return;
  const normalizedRoot = normalizeSlashes(root);
  getAdditionalAllowedRoots().add(normalizedRoot);
  globalThis.__piAllowedRootsCache?.roots.add(normalizedRoot);
}

export async function getAllowedFileRoots(): Promise<Set<string>> {
  const now = Date.now();
  const cached = globalThis.__piAllowedRootsCache;
  if (cached && cached.expiresAt > now) return cached.roots;

  const sessions = await listAllSessions(getAgentDir());
  const roots = new Set<string>();
  for (const s of sessions) {
    if (s.cwd) roots.add(normalizeSlashes(s.cwd));
  }

  // Also allow ~/pi-cwd-* directories created by the default-cwd endpoint.
  try {
    for (const name of readdirSync(homedir())) {
      if (/^pi-cwd-\d{8}$/.test(name)) {
        roots.add(normalizeSlashes(path.join(homedir(), name)));
      }
    }
  } catch {
    // ignore if home is unreadable
  }

  for (const root of getAdditionalAllowedRoots()) roots.add(root);

  globalThis.__piAllowedRootsCache = { roots, expiresAt: now + ALLOWED_ROOTS_TTL_MS };
  return roots;
}

export function isFilePathAllowed(target: string, allowedRoots: Set<string>): boolean {
  return isPathAllowed(target, allowedRoots);
}

export function isPathAllowed(target: string, allowedRoots: Set<string>): boolean {
  for (const root of allowedRoots) {
    const useWindowsRules = isWindowsAbsolutePath(target) || isWindowsAbsolutePath(root);
    const resolver = useWindowsRules ? path.win32 : path;
    const sep = useWindowsRules ? "\\" : path.sep;
    const normalized = resolver.resolve(target);
    const normalizedRoot = resolver.resolve(root);
    const comparable = useWindowsRules ? normalized.toLowerCase() : normalized;
    const comparableRoot = useWindowsRules ? normalizedRoot.toLowerCase() : normalizedRoot;
    const rootWithSep = comparableRoot.endsWith(sep) ? comparableRoot : comparableRoot + sep;
    if (comparable === comparableRoot || comparable.startsWith(rootWithSep)) {
      return true;
    }
  }
  return false;
}

export function isRealPathAllowed(target: string, allowedRoots: Set<string>): boolean {
  let realTarget: string;
  try {
    realTarget = fs.realpathSync(target);
  } catch {
    return false;
  }

  const realRoots = new Set<string>();
  for (const root of allowedRoots) {
    try {
      realRoots.add(fs.realpathSync(root));
    } catch {
      // Ignore stale session cwd entries and other roots that no longer exist.
    }
  }
  return isPathAllowed(realTarget, realRoots);
}

/**
 * Allow a file the agent actually referenced in the active session, even when it
 * sits outside the cwd-derived allowed roots. `referencedFiles` must already hold
 * absolute paths (resolved against the session cwd). Symlinks are compared by
 * realpath, so a symlinked target can only resolve to a referenced file — this
 * cannot be used to escape to an unreferenced path.
 */
export function isReferencedFileAllowed(target: string, referencedFiles: Set<string>): boolean {
  if (referencedFiles.size === 0) return false;
  if (referencedFiles.has(path.resolve(target))) return true;

  let realTarget: string;
  try {
    realTarget = fs.realpathSync(target);
  } catch {
    return false;
  }
  if (referencedFiles.has(realTarget)) return true;
  for (const ref of referencedFiles) {
    try {
      if (fs.realpathSync(ref) === realTarget) return true;
    } catch {
      // Ignore referenced files that no longer exist on disk.
    }
  }
  return false;
}

export function parseByteRange(rangeHeader: string, size: number): ParsedByteRange {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match) return { error: "invalid" };
  if (!match[1] && !match[2]) return { error: "invalid" };

  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : size - 1;
  if (!match[1] && match[2]) {
    const suffixLength = Number(match[2]);
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  }

  if (
    !Number.isSafeInteger(start)
    || !Number.isSafeInteger(end)
    || start < 0
    || end < start
    || start >= size
  ) {
    return { error: "unsatisfiable" };
  }

  return { start, end: Math.min(end, size - 1) };
}
