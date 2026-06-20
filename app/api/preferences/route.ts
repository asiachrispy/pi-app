import { NextResponse } from "next/server";
import { rejectUnsafeMutation } from "@/lib/local-request-guard";
import { requireApiAuth } from "@/lib/api-auth";
import {
  addExcludedProjectCwd,
  loadPiWebPreferences,
  mergePiWebPreferences,
  savePiWebPreferences,
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
  // excludedProjectCwds is handled inside the PUT handler to keep
  // read-modify-write in a single call chain — see PUT below.

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

    // Pull excludedProjectCwds out of the body BEFORE sanitizePatch +
    // mergePiWebPreferences so we can handle it atomically. Otherwise
    // two concurrent PUTs would both read stale state and the second
    // would overwrite the first.
    const rawExcluded = body.excludedProjectCwds as unknown;
    delete (body as Record<string, unknown>).excludedProjectCwds;

    // Process all other preference fields normally.
    let preferences = mergePiWebPreferences(sanitizePatch(body));

    // Handle excludedProjectCwds: union for adds, replace for restore.
    if (Array.isArray(rawExcluded)) {
      const cleaned = (rawExcluded as unknown[])
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);

      if (cleaned.length === 0) {
        // Explicit empty array — clear all excluded cwds.
        if ((preferences.excludedProjectCwds?.length ?? 0) > 0) {
          preferences = savePiWebPreferences({ ...preferences, excludedProjectCwds: [] });
        }
      } else {
        const current = preferences.excludedProjectCwds ?? [];
        // Replace when every incoming cwd already exists (Settings restore).
        const isReplace = cleaned.every((c) => current.includes(c));
        if (isReplace) {
          preferences = savePiWebPreferences({ ...preferences, excludedProjectCwds: cleaned });
        } else {
          // Union: add each new cwd via its own atomic read-append-write.
          for (const cwd of cleaned) {
            preferences = addExcludedProjectCwd(cwd);
          }
        }
      }
    }

    return NextResponse.json({ ok: true, preferences });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
