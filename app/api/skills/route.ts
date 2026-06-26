import { NextResponse } from "next/server";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { DefaultResourceLoader, parseFrontmatter } from "@earendil-works/pi-coding-agent";
import { rejectUnsafeMutation } from "@/lib/local-request-guard";
import { isAuthError, requireApiAuth } from "@/lib/api-auth";
import { currentAgentDir } from "@/lib/livo/tenant-gate";
import { withTenant } from "@/lib/livo/with-tenant";

export const dynamic = "force-dynamic";

// GET /api/skills?cwd=<path>
// Uses DefaultResourceLoader (same logic as AgentSession startup) so settings.json
// skill paths, package skills, and .agents/skills directories are all included.
export const GET = withTenant(async (req: Request) => {
  const auth = requireApiAuth(req);
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(req.url);
  const cwd = searchParams.get("cwd");
  if (!cwd) return NextResponse.json({ error: "cwd required" }, { status: 400 });

  try {
    const loader = new DefaultResourceLoader({ cwd, agentDir: currentAgentDir() });
    await loader.reload();
    const { skills, diagnostics } = loader.getSkills();
    return NextResponse.json({ skills, diagnostics });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});

// PATCH /api/skills — toggle disable-model-invocation on a SKILL.md file
export const PATCH = withTenant(async (req: Request) => {
  const rejected = rejectUnsafeMutation(req);
  if (rejected) return rejected;

  try {
    const body = await req.json() as { filePath: string; disableModelInvocation: boolean };
    const { filePath, disableModelInvocation } = body;
    if (!filePath) return NextResponse.json({ error: "filePath required" }, { status: 400 });
    if (!existsSync(filePath)) return NextResponse.json({ error: "file not found" }, { status: 404 });

    const content = readFileSync(filePath, "utf8");
    const key = "disable-model-invocation";

    const { frontmatter } = parseFrontmatter<Record<string, unknown>>(content);
    const alreadySet = Boolean(frontmatter[key]);

    let updated = content;
    if (disableModelInvocation && !alreadySet) {
      updated = content.replace(/^---\r?\n/, `---\n${key}: true\n`);
      if (updated === content) updated = `---\n${key}: true\n---\n${content}`;
    } else if (!disableModelInvocation && alreadySet) {
      updated = content.replace(new RegExp(`^${key}\\s*:.*\\r?\\n`, "m"), "");
    }

    writeFileSync(filePath, updated, "utf8");
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});
