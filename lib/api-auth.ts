import type { NextResponse } from "next/server";
import { rejectUnauthorizedRequest } from "./remote-auth";

export function requireApiAuth(req: Request): NextResponse | null {
  return rejectUnauthorizedRequest(req);
}
