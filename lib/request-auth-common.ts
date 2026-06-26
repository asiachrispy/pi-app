import { SESSION_COOKIE_NAME } from "./remote-auth-types";

export function hostnameFromHost(host: string | null | undefined): string {
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

export function getNamedCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return decodeURIComponent(trimmed.slice(name.length + 1));
    }
  }
  return null;
}

export function getSessionCookie(req: Request): string | null {
  return getNamedCookie(req, SESSION_COOKIE_NAME);
}

export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export function hasBearerPrefix(req: Request): boolean {
  return req.headers.get("authorization")?.startsWith("Bearer ") ?? false;
}

export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
