import { NextResponse } from "next/server";

export interface MutatingRequestSafetyInput {
  host: string | null | undefined;
  origin?: string | null;
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

function hostnameFromOrigin(origin: string | null | undefined): string {
  if (!origin) return "";
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "::1" || hostname === "0:0:0:0:0:0:0:1" || hostname.startsWith("127.");
}

export function isSafeMutatingRequest(input: MutatingRequestSafetyInput): boolean {
  if (process.env.PI_WEB_ALLOW_REMOTE_MUTATIONS === "1") return true;

  const hostName = hostnameFromHost(input.host);
  if (!isLoopbackHostname(hostName)) return false;

  if (!input.origin) return true;
  const originName = hostnameFromOrigin(input.origin);
  return originName !== "" && originName === hostName;
}

export function rejectUnsafeMutation(req: Request): NextResponse | null {
  if (isSafeMutatingRequest({ host: req.headers.get("host"), origin: req.headers.get("origin") })) {
    return null;
  }
  return NextResponse.json(
    { error: "Mutation rejected: pi-web only accepts local same-origin writes by default." },
    { status: 403 }
  );
}
