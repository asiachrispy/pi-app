import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { getAgentDir } from "@/lib/agent-dir";
import { getNamedCookie } from "@/lib/middleware-auth";
import { issueSessionCookieValue, parseSessionCookieValue } from "@/lib/signed-session-cookie";

export const LIVO_SESSION_COOKIE_NAME = "pi_livo_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface LivoSessionUser {
  livoUserId: string;
  email?: string;
  name?: string;
}

export interface StoredLivoSession extends LivoSessionUser {
  sidHash: string;
  createdAt: string;
  expiresAt: string;
}

function sessionStorePath(): string {
  return join(getAgentDir(), "auth", "livo-sessions.json");
}

function secret(): string {
  const value = process.env.PI_LIVO_SESSION_SECRET;
  if (!value || value.length < 24) throw new Error("PI_LIVO_SESSION_SECRET is required");
  return value;
}

function readStore(): Record<string, StoredLivoSession> {
  try {
    return JSON.parse(readFileSync(sessionStorePath(), "utf8")) as Record<string, StoredLivoSession>;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, StoredLivoSession>): void {
  const file = sessionStorePath();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(store, null, 2));
}

export function normalizePiReturnTo(value: string | null | undefined): string {
  const origin = process.env.PI_PUBLIC_ORIGIN ?? "https://pi.gottao.com";
  const raw = value || "/app/";
  const url = raw.startsWith("/") ? new URL(raw, origin) : new URL(raw);
  const allowed = new URL(origin);
  if (url.protocol !== allowed.protocol || url.host !== allowed.host) {
    throw new Error("returnTo is not allowed");
  }
  if (url.pathname === "/" && url.searchParams.has("session")) {
    url.pathname = "/app/";
  }
  return url.toString();
}

export function createLivoSession(user: LivoSessionUser): { cookieValue: string; expiresAt: Date } {
  const sid = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const sessionSecret = secret();
  const store = readStore();
  store[sid] = {
    ...user,
    sidHash: sid,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  writeStore(store);
  return { cookieValue: issueSessionCookieValue(sid, expiresAt.getTime(), sessionSecret), expiresAt };
}

export function readLivoSession(req: Request): StoredLivoSession | null {
  const value = getNamedCookie(req, LIVO_SESSION_COOKIE_NAME);
  return readLivoSessionCookieValue(value);
}

export function readLivoSessionCookieValue(value: string | null | undefined): StoredLivoSession | null {
  if (!value) return null;
  const parsed = parseSessionCookieValue(value, secret());
  if (!parsed) return null;
  const stored = readStore()[parsed.sessionId];
  if (!stored || Date.parse(stored.expiresAt) <= Date.now()) return null;
  return stored;
}

export function hasLivoSessionCookie(req: Request): boolean {
  return Boolean(getNamedCookie(req, LIVO_SESSION_COOKIE_NAME));
}

export function deleteLivoSession(req: Request): void {
  const session = readLivoSession(req);
  if (!session) return;
  const store = readStore();
  delete store[session.sidHash];
  writeStore(store);
}

export function livoUserWorkspaceRoot(livoUserId: string): string {
  const root = process.env.PI_WEB_LIVO_WORKSPACE_ROOT ?? "/data/pi-agent/workspaces/livo";
  return join(root, "users", livoUserId);
}

function pathBelongsToRoot(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === "" || (!rel.startsWith("..") && rel !== ".." && !rel.startsWith("/"));
}

export function resolveLivoUserWorkspacePath(cwd: string | null | undefined, livoUserId: string): string | null {
  const root = resolve(livoUserWorkspaceRoot(livoUserId));
  const raw = cwd?.trim() ?? "";
  const target = raw ? (isAbsolute(raw) ? resolve(raw) : resolve(root, raw)) : root;
  return pathBelongsToRoot(root, target) ? target : null;
}

export function cwdBelongsToLivoUser(cwd: string | null | undefined, livoUserId: string): boolean {
  if (!cwd) return false;
  const root = resolve(livoUserWorkspaceRoot(livoUserId));
  const target = resolve(cwd);
  return pathBelongsToRoot(root, target);
}

export function realCwdBelongsToLivoUser(cwd: string | null | undefined, livoUserId: string): boolean {
  if (!cwd || !cwdBelongsToLivoUser(cwd, livoUserId)) return false;
  try {
    return pathBelongsToRoot(realpathSync(livoUserWorkspaceRoot(livoUserId)), realpathSync(cwd));
  } catch {
    return false;
  }
}
