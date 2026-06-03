import { NextResponse } from "next/server";
import { authorizeRequest, rejectUnauthorizedMutation, rejectUnauthorizedRequest } from "./remote-auth";

export interface RequestSafetyInput {
  host: string | null | undefined;
  origin?: string | null;
}

/** @deprecated Prefer authorizeRequest(req) from remote-auth */
export function isSafeMutatingRequest(input: RequestSafetyInput): boolean {
  const headers = new Headers();
  if (input.host) headers.set("host", input.host);
  if (input.origin) headers.set("origin", input.origin);
  const req = new Request("http://local/", { method: "POST", headers });
  const auth = authorizeRequest(req);
  return auth.authorized && !(auth.readOnly && auth.authorized);
}

export function rejectUnsafeMutation(req: Request): NextResponse | null {
  return rejectUnauthorizedMutation(req);
}

export function rejectUnsafeRequest(req: Request): NextResponse | null {
  return rejectUnauthorizedRequest(req);
}

export { authorizeRequest, isAuthorizedForRequest, isLoopbackRequest, isSameOriginLoopbackRequest } from "./remote-auth";
