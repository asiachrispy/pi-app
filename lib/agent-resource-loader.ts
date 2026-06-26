import {
  DefaultResourceLoader,
  SettingsManager,
  type ResourceLoader,
} from "@earendil-works/pi-coding-agent";
import { PI_WEB_SKILL_WORKFLOW_APPEND } from "@/lib/skill-system-prompt";
import { defaultLivoPluginPaths } from "@/lib/livo-default-plugins";
import { isTenantAgentDir } from "@/lib/session-reader";

/**
 * Resource loader for in-process AgentSession; adds Pi Web skill workflow guidance.
 * 方案二：agentDir 必传 —— skills/settings/resource 跟随该 agentDir（租户或全局），
 * 不再隐式读全局 getAgentDir()，否则即便 session 落租户目录，skills/settings 仍串全局。
 */
export async function createAgentResourceLoader(cwd: string, agentDir: string): Promise<ResourceLoader> {
  const settingsManager = SettingsManager.create(cwd, agentDir);
  const defaultPluginPaths = isTenantAgentDir(agentDir) ? defaultLivoPluginPaths() : [];
  const loader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    ...(defaultPluginPaths.length ? { additionalExtensionPaths: defaultPluginPaths } : {}),
    appendSystemPrompt: [PI_WEB_SKILL_WORKFLOW_APPEND],
  });
  await loader.reload();
  return loader;
}
