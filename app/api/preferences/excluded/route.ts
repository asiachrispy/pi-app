import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { rejectUnsafeMutation } from "@/lib/local-request-guard";
import {
  addExcludedProjectCwd,
  loadPiWebPreferences,
  removeExcludedProjectCwd,
} from "@/lib/pi-web-preferences";

/** POST: add cwds to excludedProjectCwds (always union). */
export async function POST(req: Request) {
  const rejected = rejectUnsafeMutation(req) || requireApiAuth(req);
  if (rejected) return rejected;

  try {
    const body = await req.json() as { cwds?: string[] };
    const cwds = Array.isArray(body.cwds) ? body.cwds : [];
    for (const raw of cwds) {
      const cwd = typeof raw === "string" ? raw.trim() : "";
      if (cwd) addExcludedProjectCwd(cwd);
    }
    return NextResponse.json({
      ok: true,
      excludedProjectCwds: loadPiWebPreferences().excludedProjectCwds ?? [],
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/** DELETE ?cwd=... : remove a single cwd from excludedProjectCwds. */
export async function DELETE(req: Request) {
  const rejected = rejectUnsafeMutation(req) || requireApiAuth(req);
  if (rejected) return rejected;

  try {
    const url = new URL(req.url);
    const cwd = url.searchParams.get("cwd");
    if (cwd && cwd.trim()) {
      removeExcludedProjectCwd(cwd.trim());
    }
    return NextResponse.json({
      ok: true,
      excludedProjectCwds: loadPiWebPreferences().excludedProjectCwds ?? [],
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
