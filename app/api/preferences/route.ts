import { NextResponse } from "next/server";
import { rejectUnsafeMutation } from "@/lib/local-request-guard";
import { requireApiAuth } from "@/lib/api-auth";
import {
  loadPiWebPreferences,
  mergePiWebPreferences,
  type PiWebPreferences,
  type ToolMode,
} from "@/lib/pi-web-preferences";

export const dynamic = "force-dynamic";

const TOOL_MODES = new Set<ToolMode>(["simple", "default", "full"]);

function sanitizePatch(body: unknown): Partial<PiWebPreferences> {
  if (!body || typeof body !== "object") return {};
  const input = body as Record<string, unknown>;
  const patch: Partial<PiWebPreferences> = {};

  if (typeof input.defaultWorkspaceCwd === "string" && input.defaultWorkspaceCwd.trim()) {
    patch.defaultWorkspaceCwd = input.defaultWorkspaceCwd.trim();
  }
  if (typeof input.toolMode === "string" && TOOL_MODES.has(input.toolMode as ToolMode)) {
    patch.toolMode = input.toolMode as ToolMode;
  }
  if (typeof input.notificationsEnabled === "boolean") {
    patch.notificationsEnabled = input.notificationsEnabled;
  }
  if (typeof input.branchSummarizeBeforeSwitch === "boolean") {
    patch.branchSummarizeBeforeSwitch = input.branchSummarizeBeforeSwitch;
  }
  if (typeof input.keepAwakeAlways === "boolean") {
    patch.keepAwakeAlways = input.keepAwakeAlways;
  }
  if (Array.isArray(input.excludedProjectCwds)) {
    const cleaned = input.excludedProjectCwds
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    // Explicit empty array → clear all exclusions (restore last project).
    if (cleaned.length === 0) {
      const current = loadPiWebPreferences().excludedProjectCwds;
      if (current && current.length > 0) patch.excludedProjectCwds = [];
    } else {
      // Merge with existing excluded cwds (union) to prevent a TOCTOU race
      // when the user hides several projects in rapid succession. Each click
      // is a separate PUT; without the union the second PUT would overwrite
      // the first, keeping only the last excluded cwd.
      //
      // Full replacement is still used when the incoming list is a subset of
      // the current (Settings → restore button sent the final list to keep).
      const current = loadPiWebPreferences().excludedProjectCwds ?? [];
      const incoming = new Set(cleaned);
      const allCurrentRemoved = current.every((c) => !incoming.has(c));
      if (allCurrentRemoved && cleaned.length < current.length) {
        // Client sent a subset — treat as replace (restore action).
        patch.excludedProjectCwds = Array.from(incoming);
      } else {
        patch.excludedProjectCwds = Array.from(new Set([...current, ...cleaned]));
      }
    }
  }

  return patch;
}

export async function GET(req: Request) {
  const rejected = requireApiAuth(req);
  if (rejected) return rejected;
  return NextResponse.json({ preferences: loadPiWebPreferences() });
}

export async function PUT(req: Request) {
  const rejected = rejectUnsafeMutation(req);
  if (rejected) return rejected;

  try {
    const body = await req.json();
    const preferences = mergePiWebPreferences(sanitizePatch(body));
    return NextResponse.json({ ok: true, preferences });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
