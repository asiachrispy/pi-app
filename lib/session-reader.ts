import { isAbsolute, join, resolve } from "node:path";
import { SessionManager, buildSessionContext as piBuildSessionContext } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@/lib/agent-dir";
import { resolveLivoWorkspaceRoot } from "@/lib/livo/config";
import { TENANT_AGENT_DIR_NAME } from "@/lib/livo/tenant-context";
import type { SessionEntry, SessionInfo, SessionContext, SessionTreeNode, SessionMessageEntry, AssistantMessage } from "./types";
import type { SessionEntry as PiSessionEntry, SessionInfo as PiSessionInfo } from "@earendil-works/pi-coding-agent";
import { extractFileRefsFromText } from "./message-file-refs";
import { normalizeAgentMessage } from "./normalize";
import { loadPiWebPreferences } from "./pi-web-preferences";
import { readProductSessionMetadataMap } from "./scene-metadata";
import { getPickerCwds, isSystemTempCwd } from "./session-projects";

export { getAgentDir };

export function getSessionsDir(): string {
  return `${getAgentDir()}/sessions`;
}

/**
 * 列出某 agentDir 下的所有 pi session（方案二：agentDir 必传，显式隔离）。
 *
 * 关键：session 存储布局有两种，listAll 的调用方式不同：
 * - 全局/非租户 agentDir（含 dev 的 PI_CODING_AGENT_DIR=~/tmp/pi-dev-agent）：
 *   两层 `{agentDir}/sessions/{encode(cwd)}/*.jsonl`，用无参 `listAll()` 扫子目录。
 * - 租户 agentDir：单层 `{agentDir}/sessions/*.jsonl`，用 `listAll(sessionDir)` 只扫一层。
 *
 * 判定依据：**是否是租户布局**（agentDir 落在 Livo 工作区根下的 .pi-agent），
 * 而非"是否等于默认目录"——否则 dev 隔离目录会被误判为租户单层布局。
 */
async function listPiSessions(agentDir: string): Promise<PiSessionInfo[]> {
  if (isTenantAgentDir(agentDir)) {
    // 租户单层布局：直接列 sessions 目录。
    return SessionManager.listAll(join(agentDir, "sessions"));
  }
  // 全局/dev 两层布局：必须传该 agentDir 的 sessions 根，让 pi 扫其下所有 cwd 子目录。
  // 注意：无参 listAll() 读 process.env 默认目录；dev 下需显式传 agentDir 的 sessions 根，
  // 但 listAll(dir) 只扫单层。两层布局需借助 pi 内部按 sessions/ 递归——无参版才递归，
  // 故全局场景仍用无参 listAll()（它读 PI_CODING_AGENT_DIR，dev/prod 都正确）。
  return SessionManager.listAll();
}

/** agentDir 是否为 Livo 租户目录（落在工作区根下、以 .pi-agent 结尾的单层布局）。导出供测试。 */
export function isTenantAgentDir(agentDir: string): boolean {
  const livoRoot = resolveLivoWorkspaceRoot();
  const resolved = resolve(agentDir);
  return resolved.startsWith(livoRoot + "/") && resolved.endsWith(`${TENANT_AGENT_DIR_NAME}`);
}

/** Project picker cwds（方案二：agentDir 必传）。租户只列自己 agentDir 下的 cwd。 */
export async function listProjectCwdsForPicker(agentDir: string): Promise<string[]> {
  const merged: Array<{ cwd: string; modified: string }> = [];
  const appendSessions = (sessions: PiSessionInfo[]) => {
    for (const session of sessions) {
      if (!session.cwd) continue;
      merged.push({
        cwd: session.cwd,
        modified: session.modified instanceof Date ? session.modified.toISOString() : String(session.modified),
      });
    }
  };

  appendSessions(await listPiSessions(agentDir));

  // 注：旧版在 dev 隔离时会额外并入 prod (~/.pi/agent) 的 session 到 picker，
  // 依赖临时改 process.env 的 hack（并发不安全，已废弃）。该合并仅为 dev 便利、
  // 与多租户无关，故移除——dev 只列自己 agentDir 的 cwd。

  const cwds = getPickerCwds(merged);
  const prefs = loadPiWebPreferences();
  for (const raw of [prefs.defaultWorkspaceCwd, ...(prefs.recentWorkspaceCwds ?? [])]) {
    const cwd = raw?.trim();
    if (cwd && !cwds.includes(cwd) && !isSystemTempCwd(cwd)) {
      cwds.push(cwd);
    }
  }
  const excluded = new Set(prefs.excludedProjectCwds ?? []);
  return excluded.size === 0 ? cwds : cwds.filter((cwd) => !excluded.has(cwd));
}

/** 列出某 agentDir 下所有 session 的展示信息（方案二：agentDir 必传）。 */
export async function listAllSessions(agentDir: string): Promise<SessionInfo[]> {
  const piSessions: PiSessionInfo[] = await listPiSessions(agentDir);
  const pathToId = new Map<string, string>();
  for (const s of piSessions) pathToId.set(s.path, s.id);
  const productMetadata = readProductSessionMetadataMap();

  const cache = getPathCache();
  return piSessions.map((s) => {
    const metadata = productMetadata[s.id];
    // Populate path cache (按 agentDir 前缀隔离) so resolveSessionPath works without a full scan
    cache.set(pathCacheKey(agentDir, s.id), s.path);
    return {
      path: s.path,
      id: s.id,
      cwd: s.cwd,
      name: s.name,
      created: s.created instanceof Date ? s.created.toISOString() : String(s.created),
      modified: s.modified instanceof Date ? s.modified.toISOString() : String(s.modified),
      messageCount: s.messageCount,
      firstMessage: s.firstMessage || "(no messages)",
      parentSessionId: s.parentSessionPath ? pathToId.get(s.parentSessionPath) : undefined,
      productTitle: metadata?.title,
      productStatus: metadata?.status,
      lastResultSummary: metadata?.lastResultSummary,
    };
  });
}

// ============================================================================
// Session path cache: sessionId → absolute file path
// Stored in globalThis for hot-reload safety
// 缓存键含 agentDir 前缀，杜绝跨租户穿透（欠陷2）：不同租户的 agentDir 不同，
// 即便 sessionId 相同也不会命中彼此的路径。
// ============================================================================
declare global {
  var __piSessionPathCache: Map<string, string> | undefined;
}

function getPathCache(): Map<string, string> {
  if (!globalThis.__piSessionPathCache) globalThis.__piSessionPathCache = new Map();
  return globalThis.__piSessionPathCache;
}

/** 缓存键 = agentDir 前缀 + sessionId，按租户隔离。 */
function pathCacheKey(agentDir: string, sessionId: string): string {
  return `${resolve(agentDir)}\u0000${sessionId}`;
}

export async function resolveSessionPath(sessionId: string, agentDir: string): Promise<string | null> {
  const key = pathCacheKey(agentDir, sessionId);
  const cached = getPathCache().get(key);
  if (cached) return cached;

  // Cache miss: scan all sessions in this agentDir to populate cache, then retry
  await listAllSessions(agentDir);
  return getPathCache().get(key) ?? null;
}

export function cacheSessionPath(sessionId: string, filePath: string, agentDir: string): void {
  getPathCache().set(pathCacheKey(agentDir, sessionId), filePath);
}

export function invalidateSessionPathCache(sessionId: string, agentDir: string): void {
  getPathCache().delete(pathCacheKey(agentDir, sessionId));
}

export function getSessionEntries(filePath: string): SessionEntry[] {
  const entries = SessionManager.open(filePath).getEntries();
  return entries as unknown as SessionEntry[];
}

// Short-TTL cache of files referenced per session, keyed by session id. Scanning
// a whole transcript on every preview request would be wasteful; 5s matches the
// allowed-roots cache and is short enough that newly-touched files appear fast.
declare global {
  var __piSessionRefFilesCache: Map<string, { files: Set<string>; expiresAt: number }> | undefined;
}

const SESSION_REF_FILES_TTL_MS = 5_000;
const TOOL_FILE_PATH_KEYS = ["path", "file_path", "filePath", "notebook_path", "notebookPath"];

function getRefFilesCache(): Map<string, { files: Set<string>; expiresAt: number }> {
  if (!globalThis.__piSessionRefFilesCache) globalThis.__piSessionRefFilesCache = new Map();
  return globalThis.__piSessionRefFilesCache;
}

/**
 * Collect absolute file paths the agent referenced in a session: file-reference
 * tags inside user/assistant text plus file-path arguments of tool calls.
 * Relative paths are resolved against the session cwd. Lets the file preview open
 * files the conversation actually touched even when they sit outside the
 * cwd-derived allowed roots. Cached briefly to avoid rescanning transcripts.
 */
export async function collectSessionReferencedFiles(sessionId: string, agentDir: string): Promise<Set<string>> {
  const now = Date.now();
  const cache = getRefFilesCache();
  const cacheKey = pathCacheKey(agentDir, sessionId); // 按 agentDir 前缀隔离，防跨租户穿透
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.files;

  const files = new Set<string>();
  const store = (): Set<string> => {
    cache.set(cacheKey, { files, expiresAt: now + SESSION_REF_FILES_TTL_MS });
    return files;
  };

  const filePath = await resolveSessionPath(sessionId, agentDir);
  if (!filePath) return store();

  let cwd: string | undefined;
  try {
    const sessions = await listAllSessions(agentDir);
    cwd = sessions.find((s) => s.id === sessionId)?.cwd;
  } catch {
    // Without a cwd we simply skip relative paths below.
  }

  let entries: SessionEntry[];
  try {
    entries = getSessionEntries(filePath);
  } catch {
    return store();
  }

  const addRaw = (raw: unknown): void => {
    if (typeof raw !== "string") return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (isAbsolute(trimmed)) files.add(resolve(trimmed));
    else if (cwd) files.add(resolve(cwd, trimmed));
  };
  const addFromText = (text: string): void => {
    for (const ref of extractFileRefsFromText(text)) addRaw(ref.path);
  };

  for (const entry of entries) {
    if (entry.type !== "message") continue;
    const message = (entry as SessionMessageEntry).message;
    if (!message) continue;
    if (message.role === "user" || message.role === "custom") {
      const content = message.content;
      if (typeof content === "string") addFromText(content);
      else for (const block of content) if (block.type === "text") addFromText(block.text);
    } else if (message.role === "assistant") {
      for (const block of message.content) {
        if (block.type === "text") {
          addFromText(block.text);
        } else if (block.type === "toolCall") {
          const input = block.input ?? {};
          for (const key of TOOL_FILE_PATH_KEYS) {
            if (key in input) addRaw((input as Record<string, unknown>)[key]);
          }
        }
      }
    }
  }

  return store();
}

export function buildTree(entries: SessionEntry[]): SessionTreeNode[] {
  const nodeMap = new Map<string, SessionTreeNode>();
  const labelsById = new Map<string, string>();

  for (const entry of entries) {
    if (entry.type === "label") {
      const l = entry as { type: "label"; targetId: string; label?: string };
      if (l.label) labelsById.set(l.targetId, l.label);
      else labelsById.delete(l.targetId);
    }
  }

  const roots: SessionTreeNode[] = [];
  for (const entry of entries) {
    nodeMap.set(entry.id, { entry, children: [], label: labelsById.get(entry.id) });
  }
  for (const entry of entries) {
    const node = nodeMap.get(entry.id)!;
    if (!entry.parentId) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(entry.parentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  }

  const stack = [...roots];
  while (stack.length > 0) {
    const node = stack.pop()!;
    node.children.sort((a, b) => new Date(a.entry.timestamp).getTime() - new Date(b.entry.timestamp).getTime());
    stack.push(...node.children);
  }
  return roots;
}

export function buildSessionContext(entries: SessionEntry[], leafId?: string | null): SessionContext {
  const byId = new Map<string, SessionEntry>();
  for (const e of entries) byId.set(e.id, e);

  const piEntries = entries as unknown as PiSessionEntry[];
  const piCtx = piBuildSessionContext(piEntries, leafId, byId as unknown as Map<string, PiSessionEntry>);

  // Build entryIds: parallel array to messages[], mapping each message back to its entry id.
  // Needed for fork and navigate_tree calls from the UI.
  let targetLeaf: SessionEntry | undefined;
  if (leafId === null) {
    return { messages: [], entryIds: [], thinkingLevel: piCtx.thinkingLevel, model: piCtx.model };
  }
  if (leafId) targetLeaf = byId.get(leafId);
  if (!targetLeaf) targetLeaf = entries[entries.length - 1];
  if (!targetLeaf) {
    return { messages: [], entryIds: [], thinkingLevel: piCtx.thinkingLevel, model: piCtx.model };
  }

  // Walk path from target leaf to root
  const path: SessionEntry[] = [];
  let cur: SessionEntry | undefined = targetLeaf;
  while (cur) {
    path.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }

  // Find the last compaction on path (mirrors pi's buildSessionContext logic)
  let compactionId: string | undefined;
  let firstKeptEntryId: string | undefined;
  for (const e of path) {
    if (e.type === "compaction") {
      compactionId = e.id;
      firstKeptEntryId = (e as { firstKeptEntryId: string }).firstKeptEntryId;
    }
  }

  const entryIds: string[] = [];
  if (compactionId) {
    // The first message in piCtx.messages is the synthetic compaction summary — map to compaction entry id
    entryIds.push(compactionId);
    const compactionIdx = path.findIndex((e) => e.id === compactionId);
    const firstKeptIdx = firstKeptEntryId
      ? path.findIndex((e, i) => i < compactionIdx && e.id === firstKeptEntryId)
      : -1;
    const startIdx = firstKeptIdx >= 0 ? firstKeptIdx : compactionIdx;
    for (let i = startIdx; i < compactionIdx; i++) {
      if (path[i].type === "message") entryIds.push(path[i].id);
    }
    for (let i = compactionIdx + 1; i < path.length; i++) {
      if (path[i].type === "message") entryIds.push(path[i].id);
    }
  } else {
    for (const e of path) {
      if (e.type === "message") entryIds.push(e.id);
    }
  }

  const messages = (piCtx.messages as AssistantMessage[]).map((msg) =>
    normalizeAgentMessage(msg as never),
  );

  return {
    messages,
    entryIds,
    thinkingLevel: piCtx.thinkingLevel,
    model: piCtx.model,
  };
}

export function getLeafId(entries: SessionEntry[]): string | null {
  if (entries.length === 0) return null;
  return entries[entries.length - 1].id;
}


