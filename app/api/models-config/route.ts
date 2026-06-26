import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { getAgentDir } from "@/lib/agent-dir";
import { rejectUnsafeMutation } from "@/lib/local-request-guard";
import { isAuthError, requireApiAuth } from "@/lib/api-auth";
import { normalizeModelsJson, type NormalizedModelsJson } from "@/lib/models-config-normalize";
import { destroyAllRpcSessions } from "@/lib/rpc-manager";
import { rejectLivoGlobalConfigWrite } from "@/lib/livo/global-config-guard";

export const dynamic = "force-dynamic";

function getModelsPath(): string {
  return join(getAgentDir(), "models.json");
}

function readModelsJson(): Record<string, unknown> {
  const path = getModelsPath();
  if (!existsSync(path)) return { providers: {} };
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return { providers: {} };
  }
}

function writeModelsJson(data: NormalizedModelsJson): void {
  const path = getModelsPath();
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
}

export async function GET(req: Request) {
  const auth = requireApiAuth(req);
  if (isAuthError(auth)) return auth;
  return NextResponse.json(readModelsJson());
}

export async function PUT(req: Request) {
  const rejected = rejectUnsafeMutation(req);
  if (rejected) return rejected;
  const livoRejected = rejectLivoGlobalConfigWrite(req);
  if (livoRejected) return livoRejected;

  try {
    const body = await req.json() as Record<string, unknown>;
    writeModelsJson(normalizeModelsJson(body));
    destroyAllRpcSessions();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
