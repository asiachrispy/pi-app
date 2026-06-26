import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { NextResponse } from "next/server";
import { runNpx } from "@/lib/npx";
import { rejectUnsafeMutation } from "@/lib/local-request-guard";
import { usesIsolatedAgentDataDir } from "@/lib/agent-dir";
import { currentAgentDir } from "@/lib/livo/tenant-gate";
import { withTenant } from "@/lib/livo/with-tenant";
import { readLivoSession } from "@/lib/livo-sso";
import { mirrorNamedGlobalSkills, parseInstalledSkillNames } from "@/lib/skill-mirror";

export const dynamic = "force-dynamic";

const ANSI_RE = /\x1B\[[0-9;]*m/g;

// POST /api/skills/install  body: { package: string; scope: "global" | "project"; cwd?: string }
export const POST = withTenant(async (req: Request) => {
  const rejected = rejectUnsafeMutation(req);
  if (rejected) return rejected;

  try {
    const { package: pkg, scope, cwd } = await req.json() as { package?: string; scope?: string; cwd?: string };
    if (!pkg?.trim()) return NextResponse.json({ error: "package required" }, { status: 400 });

    const isGlobal = scope !== "project";
    if (isGlobal && readLivoSession(req)) {
      return NextResponse.json(
        { error: "Global skill install is read-only for Livo tenants" },
        { status: 403 },
      );
    }
    const args = ["skills", "add", pkg.trim(), "-y", "--agent", "pi"];
    if (isGlobal) args.push("-g");

    // The upstream CLI hardcodes global skills to ~/.pi/agent/skills, see
    // skills CLI: agents.pi.globalSkillsDir = join(home, ".pi/agent/skills").
    const upstreamGlobalSkillsDir = join(homedir(), ".pi", "agent", "skills");
    // Ensure the dir exists so the upstream CLI can write into it on first install.
    if (isGlobal && !existsSync(upstreamGlobalSkillsDir)) {
      await mkdir(upstreamGlobalSkillsDir, { recursive: true });
    }

    console.log(`[skills/install] running: npx ${args.join(" ")}`);
    const { stdout, stderr } = await runNpx(args, {
      timeout: 60000,
      cwd: !isGlobal && cwd ? cwd : undefined,
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    const output = (stdout + stderr).replace(ANSI_RE, "");
    const success = /Installation complete|Installed \d+ skill/.test(output);
    if (!success) {
      return NextResponse.json({ error: output.slice(-300) || "Install failed" }, { status: 500 });
    }

    // Mirror the install's actually-created skills into the dev agent dir.
    // On prod these paths are identical, so this is a no-op.
    let mirrored: string[] = [];
    if (isGlobal && usesIsolatedAgentDataDir()) {
      const installedNames = parseInstalledSkillNames(output);
      if (installedNames.length > 0) {
        const targetDir = join(currentAgentDir(), "skills");
        await mkdir(targetDir, { recursive: true });
        mirrored = await mirrorNamedGlobalSkills(
          upstreamGlobalSkillsDir,
          targetDir,
          installedNames,
        );
        if (mirrored.length > 0) {
          console.log(
            `[skills/install] mirrored global skills into ${targetDir}: ${mirrored.join(", ")}`,
          );
        }
      }
    }

    return NextResponse.json({ success: true, output, mirrored });
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const output = ((err.stdout ?? "") + (err.stderr ?? "")).replace(ANSI_RE, "");
    return NextResponse.json({ error: output || (err.message ?? String(e)) }, { status: 500 });
  }
});
