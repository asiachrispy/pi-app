import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { createAgentResourceLoader } from "@/lib/agent-resource-loader";
import { collectSlashCommands } from "@/lib/slash-commands";
import { isAuthError, requireApiAuth } from "@/lib/api-auth";
import { rejectLivoCwdOutsideWorkspace } from "@/lib/livo-session-guard";
import { currentAgentDir } from "@/lib/livo/tenant-gate";
import { withTenant } from "@/lib/livo/with-tenant";

export const dynamic = "force-dynamic";

export const GET = withTenant(async (req: Request) => {
  const auth = requireApiAuth(req);
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(req.url);
  const cwd = searchParams.get("cwd");
  if (!cwd) return NextResponse.json({ error: "cwd required" }, { status: 400 });
  if (!existsSync(cwd)) return NextResponse.json({ error: `Directory does not exist: ${cwd}` }, { status: 400 });

  const ownerRejected = rejectLivoCwdOutsideWorkspace(req, cwd);
  if (ownerRejected) return ownerRejected;

  try {
    const resourceLoader = await createAgentResourceLoader(cwd, currentAgentDir());
    const commands = collectSlashCommands({
      extensionRunner: { getRegisteredCommands: () => [] },
      promptTemplates: [],
      resourceLoader,
    });
    return NextResponse.json({ commands });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
});
