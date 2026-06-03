import { SESSION_COOKIE_NAME } from "./remote-auth-types";

export interface MiddlewareAuthContext {
  authorized: boolean;
  loopback: boolean;
  remoteEnabled: boolean;
  readOnly: boolean;
  reason: string | null;
}

function hostnameFromHost(host: string | null | undefined): string {
  if (!host) return "";
  const trimmed = host.trim().toLowerCase();
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    return end === -1 ? trimmed : trimmed.slice(1, end);
  }
  return trimmed.split(":")[0] ?? "";
}

export function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "::1" || hostname === "0:0:0:0:0:0:0:1" || hostname.startsWith("127.");
}

function hostnameFromOrigin(origin: string | null | undefined): string {
  if (!origin) return "";
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isLoopbackRequest(req: Request): boolean {
  return isLoopbackHostname(hostnameFromHost(req.headers.get("host")));
}

export function isSameOriginLoopbackRequest(req: Request): boolean {
  const hostName = hostnameFromHost(req.headers.get("host"));
  if (!isLoopbackHostname(hostName)) return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  return hostnameFromOrigin(origin) === hostName;
}

export function getSessionCookie(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      return decodeURIComponent(trimmed.slice(SESSION_COOKIE_NAME.length + 1));
    }
  }
  return null;
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySessionCookieValue(value: string, secret: string): Promise<boolean> {
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [sessionId, expiresRaw, signature] = parts;
  if (!sessionId || !expiresRaw || !signature) return false;
  const expiresAtMs = Number(expiresRaw);
  if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) return false;

  const payload = `${sessionId}.${expiresRaw}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = bytesToBase64Url(new Uint8Array(signed));
  return timingSafeEqualString(expected, signature);
}

export function isRemoteAccessEnabledEnv(): boolean {
  return process.env.PI_WEB_REMOTE === "1";
}

/** Edge-safe env-backed auth for middleware. Route handlers still run full disk auth. */
export async function authorizeMiddlewareRequest(req: Request): Promise<MiddlewareAuthContext> {
  const loopback = isLoopbackRequest(req);
  const remoteEnabled = isRemoteAccessEnabledEnv();
  const readOnly = process.env.PI_WEB_REMOTE_READ_ONLY === "1";

  if (!remoteEnabled) {
    if (loopback && isSameOriginLoopbackRequest(req)) {
      return { authorized: true, loopback: true, remoteEnabled: false, readOnly: false, reason: null };
    }
    return {
      authorized: false,
      loopback,
      remoteEnabled: false,
      readOnly: false,
      reason: loopback ? "Cross-origin request rejected" : "Remote access is disabled",
    };
  }

  if (loopback && isSameOriginLoopbackRequest(req)) {
    return { authorized: true, loopback: true, remoteEnabled: true, readOnly: false, reason: null };
  }

  const envToken = process.env.PI_WEB_REMOTE_TOKEN;
  const bearer = getBearerToken(req);
  if (envToken && bearer && timingSafeEqualString(bearer, envToken)) {
    return { authorized: true, loopback, remoteEnabled: true, readOnly, reason: null };
  }

  const secret = process.env.PI_WEB_REMOTE_SIGNING_SECRET;
  const cookieValue = getSessionCookie(req);
  if (secret && cookieValue && await verifySessionCookieValue(cookieValue, secret)) {
    return { authorized: true, loopback, remoteEnabled: true, readOnly, reason: null };
  }

  if (process.env.PI_WEB_ALLOW_REMOTE_MUTATIONS === "1") {
    return { authorized: true, loopback, remoteEnabled: true, readOnly: false, reason: null };
  }

  return {
    authorized: false,
    loopback,
    remoteEnabled: true,
    readOnly,
    reason: "Authentication required",
  };
}
