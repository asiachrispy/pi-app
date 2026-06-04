import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getAgentDir } from "@/lib/agent-dir";
import { requireApiAuth } from "@/lib/api-auth";

const MAX_FILES = 20;
const MAX_BYTES_PER_FILE = 50 * 1024 * 1024;

function safeBaseName(name: string): string {
  const base = path.basename(name).replace(/[/\\<>:"|?*\u0000-\u001f]/g, "_").trim();
  return base.length > 0 ? base.slice(0, 200) : "file";
}

export async function POST(req: Request) {
  const rejected = requireApiAuth(req);
  if (rejected) return rejected;

  try {
    const body = (await req.json()) as {
      files?: { name: string; mimeType?: string; base64: string }[];
    };
    const files = body.files;
    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: "files array required" }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `At most ${MAX_FILES} files per request` }, { status: 400 });
    }

    const stagedDir = path.join(getAgentDir(), "staged-uploads");
    await mkdir(stagedDir, { recursive: true });

    const staged: { path: string; label: string }[] = [];
    for (const file of files) {
      if (!file?.name || typeof file.base64 !== "string") {
        return NextResponse.json({ error: "Each file needs name and base64" }, { status: 400 });
      }
      const originalName = path.basename(file.name);
      const buf = Buffer.from(file.base64, "base64");
      if (buf.length > MAX_BYTES_PER_FILE) {
        return NextResponse.json(
          { error: `File too large (max ${MAX_BYTES_PER_FILE / (1024 * 1024)}MB): ${originalName}` },
          { status: 400 },
        );
      }
      const dest = path.join(stagedDir, `${randomUUID()}_${safeBaseName(originalName)}`);
      await writeFile(dest, buf);
      staged.push({ path: dest, label: originalName });
    }

    return NextResponse.json({ files: staged });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
