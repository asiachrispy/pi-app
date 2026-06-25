#!/usr/bin/env node
/**
 * 多租户迁移清理：删除全局 agentDir 下的旧共享 session 数据。
 *
 * 背景：方案二上线后，Livo 租户只读各自 `users/{userId}/.pi-agent/sessions/`，
 * 旧的全局共享 session（`$AGENT_DIR/sessions/`）不再出现在任何租户视图，可清理。
 *
 * 严格遵循"只清全局 sessions、保留凭证"：
 *   删除：$AGENT_DIR/sessions/        （旧共享会话）
 *   保留：$AGENT_DIR/auth.json        （统一付费凭证，所有租户共享）
 *   保留：$AGENT_DIR/models.json      （模型配置）
 *   保留：其余一切（preferences/scene/skills/auth/...）
 *
 * 注意：本脚本只处理"全局 agentDir"，不碰任何租户目录
 * (`$PI_WEB_LIVO_WORKSPACE_ROOT/users/*`)，租户数据天然隔离、无需迁移。
 *
 * 用法：
 *   node scripts/cleanup-legacy-global-sessions.mjs            # dry-run，只打印将删什么
 *   node scripts/cleanup-legacy-global-sessions.mjs --apply    # 真正删除
 *   PI_CODING_AGENT_DIR=/custom/path node ... --apply          # 指定 agentDir
 */
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function resolveAgentDir() {
  const env = process.env.PI_CODING_AGENT_DIR;
  if (env) {
    if (env === "~") return homedir();
    if (env.startsWith("~/")) return join(homedir(), env.slice(2));
    return env;
  }
  return join(homedir(), ".pi", "agent");
}

const apply = process.argv.includes("--apply");
const agentDir = resolveAgentDir();
const sessionsDir = join(agentDir, "sessions");

console.log(`[cleanup] global agentDir : ${agentDir}`);
console.log(`[cleanup] target sessions : ${sessionsDir}`);
console.log(`[cleanup] mode            : ${apply ? "APPLY (will delete)" : "DRY-RUN (no changes)"}`);
console.log("[cleanup] 保留: auth.json / models.json / preferences / scene / skills 等全部不动");

if (!existsSync(sessionsDir)) {
  console.log("[cleanup] sessions 目录不存在，无需清理。");
  process.exit(0);
}

// 统计待删内容（不递归全展开，只到 cwd 子目录 + jsonl 计数）
let cwdDirs = 0;
let jsonlFiles = 0;
try {
  for (const entry of readdirSync(sessionsDir, { withFileTypes: true })) {
    const full = join(sessionsDir, entry.name);
    if (entry.isDirectory()) {
      cwdDirs += 1;
      try {
        jsonlFiles += readdirSync(full).filter((f) => f.endsWith(".jsonl")).length;
      } catch { /* ignore */ }
    } else if (entry.name.endsWith(".jsonl")) {
      jsonlFiles += 1;
    }
  }
} catch (e) {
  console.error(`[cleanup] 无法读取 sessions 目录: ${String(e)}`);
  process.exit(1);
}

console.log(`[cleanup] 将删除: ${cwdDirs} 个 cwd 子目录 / 约 ${jsonlFiles} 个 .jsonl 会话文件`);

if (!apply) {
  console.log("[cleanup] DRY-RUN 完成。确认无误后加 --apply 真正删除。");
  process.exit(0);
}

// 安全护栏：绝不删 agentDir 本身，只删其下的 sessions 目录
const realSessions = statSync(sessionsDir);
if (!realSessions.isDirectory()) {
  console.error("[cleanup] sessions 不是目录，中止。");
  process.exit(1);
}

rmSync(sessionsDir, { recursive: true, force: true });
console.log(`[cleanup] 已删除 ${sessionsDir}`);
console.log("[cleanup] 完成。凭证与模型配置保留，下次会话将写入各租户独立目录。");
