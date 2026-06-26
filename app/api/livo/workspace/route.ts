import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/api-auth";
import { invalidateAllowedRootsCache } from "@/lib/allowed-roots-cache";
import { resolveLivoWorkspaceRoot } from "@/lib/livo/config";
import { workbenchPublicUrl } from "@/lib/livo/workbench";
import { pathBelongsToRoot } from "@/lib/livo/path-utils";
import { rejectLivoIntegrationDisabled } from "@/lib/livo-route-guard";

const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;
const LIVO_AGENTS_MD = `# Livo Meeting Execution Rules

你是 Livo 会议执行助手。

## 安全边界
- 只生成草稿、方案、研究材料或开发任务说明。
- 不自动发送邮件。
- 不提交代码。
- 不删除文件。

## 输入与输出
- 每次执行前先阅读本次任务指定的 inputs/meeting-brief.md 和 inputs/transcript.txt。
- 中间草稿、临时笔记保存到 meetings/{fileId}/working/。
- 最终交付保存到 meetings/{fileId}/outputs/。
- 每条任务的最终产出单独保存为一个文件。
- summary.md 必须最后生成。

## 执行原则
- 按任务编号顺序执行。
- 能直接产出文件的，直接做。
- 需要外部数据或动作的，先完成能完成的准备部分。
- 只能由人完成的，输出带上下文的提醒清单。
- 不因单条任务卡住而中止整批任务。
- 信息不全时，先产出可用草稿，用 [待确认: 说明] 标注缺失信息。
- 低风险歧义自行决定，并在产出末尾说明假设。
- 高风险歧义保留占位符，并列出明确待确认问题。

## 联网搜索与调研
- Pi 已安装 pi-search-hub、bash 等工具，**可以**检索公开网页与新闻。
- 任务含「搜索 / 调研 / 最新 / 今天 / 新闻 / 查一下」等意图时：**必须先调用搜索工具或 bash**，再写 outputs。
- **禁止**以「无实时联网」「知识截止某日期」为由跳过检索或只产出「关键词包 / 模板」。
- **禁止**编造搜索结果；引用须来自实际检索到的来源（标题 + URL 或工具输出摘要）。
- 仅当搜索工具报错、无 API 凭证、或目标需登录/付费平台时，才标 ⏳ 需你确认，并写明失败原因与已尝试步骤。

## Summary
最后必须在 meetings/{fileId}/outputs/summary.md 写入执行结果汇总。

状态只能使用：
- ✅ 已完成
- ⏳ 需你确认
- ⚠️ 只能你来做
`;

function safeSegment(value: unknown, field: string): string | NextResponse {
  if (typeof value !== "string" || !SAFE_SEGMENT.test(value)) {
    return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
  }
  return value;
}

// POST /api/livo/workspace  body: { userId: string; meetingId: string }
// Creates the narrow Livo workspace used by server-to-server Livo dispatch.
export async function POST(req: Request) {
  const disabled = rejectLivoIntegrationDisabled();
  if (disabled) return disabled;

  const auth = requireApiAuth(req);
  if (isAuthError(auth)) return auth;

  try {
    const body = await req.json() as {
      userId?: unknown;
      meetingId?: unknown;
      summary?: unknown;
      todos?: unknown;
      transcript?: unknown;
    };
    const userId = safeSegment(body.userId, "userId");
    if (userId instanceof NextResponse) return userId;
    const meetingId = safeSegment(body.meetingId, "meetingId");
    if (meetingId instanceof NextResponse) return meetingId;

    const root = resolveLivoWorkspaceRoot();
    const cwd = resolve(root, "users", userId);
    const meetingPath = resolve(cwd, "meetings", meetingId);
    if (!pathBelongsToRoot(root, cwd) || !pathBelongsToRoot(root, meetingPath)) {
      return NextResponse.json({ error: "Workspace escapes Livo root" }, { status: 400 });
    }

    mkdirSync(cwd, { recursive: true });
    if (!existsSync(join(cwd, "AGENTS.md"))) {
      writeFileSync(join(cwd, "AGENTS.md"), LIVO_AGENTS_MD);
    }
    mkdirSync(join(meetingPath, "inputs"), { recursive: true });
    mkdirSync(join(meetingPath, "working"), { recursive: true });
    mkdirSync(join(meetingPath, "outputs"), { recursive: true });
    writeInputFile(
      meetingPath,
      "meeting-brief.md",
      `# Meeting Brief\n\n## Summary\n${stringInput(body.summary)}\n\n## Todos\n${stringInput(body.todos)}\n`
    );
    writeInputFile(meetingPath, "transcript.txt", body.transcript);
    invalidateAllowedRootsCache();
    const workspaceId = `livo:${userId}`;
    const publicOrigin = process.env.PI_PUBLIC_ORIGIN || "https://pi.gottao.com";
    const workspaceUrl = workbenchPublicUrl(
      publicOrigin,
      `?workspace=${encodeURIComponent(workspaceId)}&meeting=${encodeURIComponent(meetingId)}`,
    );
    return NextResponse.json({ success: true, workspaceId, meetingId, cwd, meetingPath, workspaceUrl });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

function writeInputFile(meetingPath: string, name: string, value: unknown) {
  if (typeof value !== "string") return;
  writeFileSync(join(meetingPath, "inputs", name), value);
}

function stringInput(value: unknown): string {
  return typeof value === "string" ? value : "";
}
