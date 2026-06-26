import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { AuthPrincipal } from "@/lib/auth/principal";
import { livoPrincipalFromSession, principalReadOnly } from "@/lib/auth/principal";
import { resolveLanOrigin } from "./lan-origin";
import { buildConnectionOffer, buildOfferUrl } from "./pi-relay/connection-offer";
import { generateRelayKeyPair } from "./pi-relay/crypto";
import { DEFAULT_RELAY_ENDPOINT } from "./pi-relay/types";
import { appendRemoteAuditEvent, getClientIp } from "./remote-audit-log";
import { readLivoSession } from "./livo-sso";
import {
  getBearerToken,
  getSessionCookie,
  isLoopbackRequest,
  isSameOriginLoopbackRequest,
  timingSafeEqualString,
} from "./request-auth-common";
import {
  PAIRING_CODE_TTL_MS,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  type RemoteAuthConfig,
  type RemoteAuthPublicStatus,
  type RemotePairingOffer,
  type RemoteRelayConfig,
} from "./remote-auth-types";
import {
  ensureRemoteAuthConfig,
  loadRemoteAuthConfig,
  saveRemoteAuthConfig,
  syncRemoteAuthEnv,
} from "./remote-auth-store";
export { issueSessionCookieValue, parseSessionCookieValue } from "./signed-session-cookie";
import { issueSessionCookieValue, parseSessionCookieValue } from "./signed-session-cookie";

const SCRYPT_KEYLEN = 32;

export function isRemoteAccessEnabled(): boolean {
  if (process.env.PI_WEB_REMOTE === "1") return true;
  const config = loadRemoteAuthConfig();
  return Boolean(config?.enabled);
}

export function getSigningSecret(): string | null {
  return process.env.PI_WEB_REMOTE_SIGNING_SECRET
    ?? loadRemoteAuthConfig()?.signingSecret
    ?? null;
}

export function hashSecret(value: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(value, salt, SCRYPT_KEYLEN);
  return `${salt.toString("base64url")}.${hash.toString("base64url")}`;
}

export function verifySecret(value: string, stored: string): boolean {
  const [saltB64, hashB64] = stored.split(".");
  if (!saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, "base64url");
  const expected = Buffer.from(hashB64, "base64url");
  const actual = scryptSync(value, salt, expected.length);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export {
  getBearerToken,
  getSessionCookie,
  isLoopbackRequest,
  isSameOriginLoopbackRequest,
} from "./request-auth-common";

function isAllowedHostname(req: Request, config: RemoteAuthConfig): boolean {
  if (config.allowedHostnames.length === 0) return true;
  const host = req.headers.get("host") ?? "";
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  return config.allowedHostnames.some((allowed) => allowed.toLowerCase() === hostname);
}

function sessionExists(config: RemoteAuthConfig, sessionId: string): boolean {
  return config.sessions.some((session) => session.id === sessionId);
}

export function remoteSessionExistsBySessionId(sessionId: string): boolean {
  const config = loadRemoteAuthConfig();
  if (!config) return false;
  return sessionExists(config, sessionId);
}

function touchSession(config: RemoteAuthConfig, sessionId: string, userAgent: string): RemoteAuthConfig {
  const now = new Date().toISOString();
  return {
    ...config,
    sessions: config.sessions.map((session) =>
      session.id === sessionId ? { ...session, lastSeenAt: now, userAgent: userAgent || session.userAgent } : session
    ),
  };
}

export interface RequestAuthContext {
  authorized: boolean;
  loopback: boolean;
  remoteEnabled: boolean;
  sessionId: string | null;
  readOnly: boolean;
  reason: string | null;
}

export function getClientRemoteContext(req: Request): {
  remoteEnabled: boolean;
  authenticated: boolean;
  readOnly: boolean;
  loopback: boolean;
} {
  const loopback = isLoopbackRequest(req);
  const remoteEnabled = isRemoteAccessEnabled();
  if (!remoteEnabled) {
    return { remoteEnabled: false, authenticated: true, readOnly: false, loopback };
  }
  if (loopback && isSameOriginLoopbackRequest(req)) {
    return { remoteEnabled: true, authenticated: true, readOnly: false, loopback: true };
  }
  const auth = authorizeRequest(req);
  return {
    remoteEnabled: true,
    authenticated: auth.authorized,
    readOnly: auth.readOnly,
    loopback: auth.loopback,
  };
}

export function resolveLivoPrincipal(req: Request): Extract<AuthPrincipal, { kind: "livo" }> | null {
  const livoSession = readLivoSession(req);
  return livoSession ? livoPrincipalFromSession(livoSession) as Extract<AuthPrincipal, { kind: "livo" }> : null;
}

export function resolveAuthPrincipal(req: Request): AuthPrincipal | null {
  const loopback = isLoopbackRequest(req);
  const config = loadRemoteAuthConfig();
  const remoteEnabled = isRemoteAccessEnabled();

  if (process.env.PI_WEB_ALLOW_REMOTE_MUTATIONS === "1") {
    return { kind: "open", reason: "allow_remote_mutations" };
  }

  if (!remoteEnabled) {
    if (loopback && isSameOriginLoopbackRequest(req)) {
      return { kind: "loopback" };
    }
    return null;
  }

  if (loopback && isSameOriginLoopbackRequest(req)) {
    return { kind: "loopback" };
  }

  if (config && !isAllowedHostname(req, config)) {
    return null;
  }

  const envToken = process.env.PI_WEB_REMOTE_TOKEN;
  const bearer = getBearerToken(req);
  if (envToken && bearer && timingSafeEqualString(bearer, envToken)) {
    return { kind: "bearer", scope: "env" };
  }

  if (config?.tokenHash && bearer && verifySecret(bearer, config.tokenHash)) {
    return { kind: "bearer", scope: "config" };
  }

  const secret = getSigningSecret();
  const cookieValue = getSessionCookie(req);
  if (secret && cookieValue) {
    const parsed = parseSessionCookieValue(cookieValue, secret);
    if (parsed && config && sessionExists(config, parsed.sessionId)) {
      return {
        kind: "remote",
        sessionId: parsed.sessionId,
        readOnly: Boolean(config.readOnly),
      };
    }
  }

  const livoSession = readLivoSession(req);
  if (livoSession) {
    return livoPrincipalFromSession(livoSession);
  }

  return null;
}

function unauthorizedAuthContext(req: Request): RequestAuthContext {
  const loopback = isLoopbackRequest(req);
  const config = loadRemoteAuthConfig();
  const remoteEnabled = isRemoteAccessEnabled();

  if (!remoteEnabled) {
    return {
      authorized: false,
      loopback,
      remoteEnabled: false,
      sessionId: null,
      readOnly: false,
      reason: loopback ? "Cross-origin request rejected" : "Remote access is disabled",
    };
  }

  if (config && !isAllowedHostname(req, config)) {
    return {
      authorized: false,
      loopback,
      remoteEnabled: true,
      sessionId: null,
      readOnly: Boolean(config.readOnly),
      reason: "Host is not allowed for remote access",
    };
  }

  return {
    authorized: false,
    loopback,
    remoteEnabled: true,
    sessionId: null,
    readOnly: Boolean(config?.readOnly),
    reason: "Authentication required",
  };
}

export function authorizeRequest(req: Request): RequestAuthContext {
  const loopback = isLoopbackRequest(req);
  const remoteEnabled = isRemoteAccessEnabled();
  const config = loadRemoteAuthConfig();
  const principal = resolveAuthPrincipal(req);

  if (!principal) {
    return unauthorizedAuthContext(req);
  }

  const readOnly = principal.kind === "bearer"
    ? Boolean(config?.readOnly)
    : principalReadOnly(principal);

  return {
    authorized: true,
    loopback,
    remoteEnabled,
    sessionId: principal.kind === "remote" ? principal.sessionId : null,
    readOnly,
    reason: null,
  };
}

export function isMutatingMethod(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

export function isAuthorizedForRequest(req: Request): boolean {
  const auth = authorizeRequest(req);
  if (!auth.authorized) return false;
  if (auth.readOnly && isMutatingMethod(req.method)) return false;
  return true;
}

export function buildSessionSetCookie(req: Request, value: string, maxAgeSec: number): string {
  const secure = req.url.startsWith("https://") ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`;
}

export function buildSessionClearCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function getPublicRemoteStatus(): RemoteAuthPublicStatus {
  const config = loadRemoteAuthConfig() ?? ensureRemoteAuthConfig();
  return {
    enabled: config.enabled,
    readOnly: Boolean(config.readOnly),
    allowedHostnames: config.allowedHostnames,
    sessionCount: config.sessions.length,
    hasMasterToken: Boolean(config.tokenHash),
  };
}

export function enableRemoteAccess(options?: { readOnly?: boolean; allowedHostnames?: string[] }): {
  config: RemoteAuthConfig;
  masterToken: string | null;
} {
  const config = ensureRemoteAuthConfig();
  const masterToken = randomBytes(24).toString("base64url");
  const next: RemoteAuthConfig = {
    ...config,
    enabled: true,
    tokenHash: hashSecret(masterToken),
    allowedHostnames: options?.allowedHostnames ?? config.allowedHostnames,
    readOnly: options?.readOnly ?? false,
  };
  saveRemoteAuthConfig(next);
  appendRemoteAuditEvent({ type: "remote_enabled" });
  return { config: next, masterToken };
}

export function disableRemoteAccess(): RemoteAuthConfig {
  const config = ensureRemoteAuthConfig();
  const next: RemoteAuthConfig = {
    ...config,
    enabled: false,
    sessions: [],
    pairingCodes: [],
  };
  saveRemoteAuthConfig(next);
  appendRemoteAuditEvent({ type: "remote_disabled" });
  return next;
}

export function rotateMasterToken(): { config: RemoteAuthConfig; masterToken: string } {
  const config = ensureRemoteAuthConfig();
  const masterToken = randomBytes(24).toString("base64url");
  const next: RemoteAuthConfig = {
    ...config,
    tokenHash: hashSecret(masterToken),
    sessions: [],
    pairingCodes: [],
  };
  saveRemoteAuthConfig(next);
  appendRemoteAuditEvent({ type: "token_rotated" });
  return { config: next, masterToken };
}

export function updateRemoteSettings(input: {
  allowedHostnames?: string[];
  readOnly?: boolean;
}): RemoteAuthConfig {
  const config = ensureRemoteAuthConfig();
  const next: RemoteAuthConfig = {
    ...config,
    allowedHostnames: input.allowedHostnames ?? config.allowedHostnames,
    readOnly: input.readOnly ?? config.readOnly,
  };
  saveRemoteAuthConfig(next);
  appendRemoteAuditEvent({ type: "settings_updated" });
  return next;
}

export function revokeRemoteSession(sessionId: string): RemoteAuthConfig {
  const config = ensureRemoteAuthConfig();
  const next: RemoteAuthConfig = {
    ...config,
    sessions: config.sessions.filter((session) => session.id !== sessionId),
  };
  saveRemoteAuthConfig(next);
  appendRemoteAuditEvent({ type: "session_revoked", sessionId });
  return next;
}

export function revokeAllRemoteSessions(): RemoteAuthConfig {
  const config = ensureRemoteAuthConfig();
  const next: RemoteAuthConfig = {
    ...config,
    sessions: [],
  };
  saveRemoteAuthConfig(next);
  appendRemoteAuditEvent({ type: "sessions_revoked_all", detail: `${config.sessions.length} sessions` });
  return next;
}

export function renameRemoteSession(sessionId: string, label: string): RemoteAuthConfig {
  const config = ensureRemoteAuthConfig();
  const trimmed = label.trim();
  const next: RemoteAuthConfig = {
    ...config,
    sessions: config.sessions.map((session) =>
      session.id === sessionId ? { ...session, label: trimmed || undefined } : session
    ),
  };
  saveRemoteAuthConfig(next);
  appendRemoteAuditEvent({ type: "session_renamed", sessionId, detail: trimmed });
  return next;
}

export function createRelayOffer(req: Request, relayEndpoint?: string): {
  offerUrl: string;
  relay: RemoteRelayConfig;
} {
  const config = ensureRemoteAuthConfig();
  if (!config.enabled) {
    throw new Error("Remote access is not enabled");
  }
  const keyPair = generateRelayKeyPair();
  const serverId = config.relay?.serverId ?? randomUUID();
  const endpoint = relayEndpoint?.trim() || config.relay?.defaultEndpoint || DEFAULT_RELAY_ENDPOINT;
  const relay: RemoteRelayConfig = {
    serverId,
    hostPublicKeyB64: keyPair.publicKeyB64,
    hostPrivateKeyB64: keyPair.privateKeyB64,
    defaultEndpoint: endpoint,
  };
  saveRemoteAuthConfig({ ...config, relay });
  const offer = buildConnectionOffer({
    serverId,
    hostPublicKeyB64: keyPair.publicKeyB64,
    relayEndpoint: endpoint,
  });
  const origin = new URL(req.url).origin;
  const offerUrl = buildOfferUrl(origin, offer);
  appendRemoteAuditEvent({ type: "relay_offer_created", detail: serverId });
  return { offerUrl, relay: { ...relay, hostPrivateKeyB64: "" } };
}

export function getRelayConfigForHost(): RemoteRelayConfig | null {
  const config = loadRemoteAuthConfig();
  if (!config?.relay?.hostPrivateKeyB64) return null;
  return config.relay;
}

export function createPairingOffer(req: Request): RemotePairingOffer {
  const config = ensureRemoteAuthConfig();
  if (!config.enabled) {
    throw new Error("Remote access is not enabled");
  }
  const code = randomBytes(18).toString("base64url");
  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS).toISOString();
  const pairingCodes = [
    ...config.pairingCodes.filter((entry) => new Date(entry.expiresAt).getTime() > Date.now()),
    { code, expiresAt },
  ];
  saveRemoteAuthConfig({ ...config, pairingCodes });
  appendRemoteAuditEvent({ type: "pairing_created" });
  const origin = resolveLanOrigin(req.url);
  return {
    code,
    expiresAt,
    pairingUrl: `${origin}/?pair=${encodeURIComponent(code)}`,
  };
}

export function redeemPairingCode(req: Request, code: string): { cookieValue: string; maxAgeSec: number } {
  const config = loadRemoteAuthConfig();
  if (!config?.enabled) {
    throw new Error("Remote access is not enabled");
  }
  const now = Date.now();
  const match = config.pairingCodes.find((entry) => entry.code === code && new Date(entry.expiresAt).getTime() > now);
  if (!match) {
    throw new Error("Invalid or expired pairing code");
  }
  const sessionId = randomUUID();
  const createdAt = new Date().toISOString();
  const userAgent = req.headers.get("user-agent") ?? "unknown";
  const expiresAtMs = now + SESSION_TTL_MS;
  const secret = config.signingSecret;
  const cookieValue = issueSessionCookieValue(sessionId, expiresAtMs, secret);
  const next: RemoteAuthConfig = {
    ...config,
    pairingCodes: config.pairingCodes.filter((entry) => entry.code !== code),
    sessions: [
      ...config.sessions,
      { id: sessionId, createdAt, userAgent, lastSeenAt: createdAt },
    ],
  };
  saveRemoteAuthConfig(next);
  appendRemoteAuditEvent({
    type: "pairing_redeemed",
    sessionId,
    userAgent,
    ip: getClientIp(req),
  });
  return { cookieValue, maxAgeSec: Math.floor(SESSION_TTL_MS / 1000) };
}

export function recordAuthorizedSessionTouch(req: Request, auth: RequestAuthContext): void {
  if (!auth.sessionId) return;
  const config = loadRemoteAuthConfig();
  if (!config) return;
  const userAgent = req.headers.get("user-agent") ?? "unknown";
  saveRemoteAuthConfig(touchSession(config, auth.sessionId, userAgent));
}

export function logRemoteAuthFailure(req: Request, auth: RequestAuthContext): void {
  if (auth.authorized) return;
  appendRemoteAuditEvent({
    type: "auth_failure",
    reason: auth.reason ?? "Unauthorized",
    path: new URL(req.url).pathname,
    method: req.method,
    ip: getClientIp(req),
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
}

export function rejectUnauthorizedRequest(req: Request): NextResponse | null {
  const auth = authorizeRequest(req);
  if (!auth.authorized) {
    logRemoteAuthFailure(req, auth);
    return NextResponse.json({ error: auth.reason ?? "Unauthorized" }, { status: 401 });
  }
  if (auth.readOnly && isMutatingMethod(req.method)) {
    return NextResponse.json({ error: "Remote access is read-only" }, { status: 403 });
  }
  recordAuthorizedSessionTouch(req, auth);
  return null;
}

export function rejectUnauthorizedMutation(req: Request): NextResponse | null {
  return rejectUnauthorizedRequest(req);
}

// Re-export env sync for startup
export { syncRemoteAuthEnv };
