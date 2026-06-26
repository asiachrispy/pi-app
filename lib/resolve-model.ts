import { AuthStorage, ModelRegistry } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";
import { getAgentDir } from "@/lib/agent-dir";
import type { AgentSessionLike, ModelLike } from "@/lib/pi-types";

type ModelRegistryLike = AgentSessionLike["modelRegistry"];

function findInRegistry(registry: ModelRegistryLike, provider: string, modelId: string) {
  return registry.find(provider, modelId)
    ?? registry.find(provider, modelId.toLowerCase())
    ?? registry.getAll().find((m) => m.provider === provider && m.id.toLowerCase() === modelId.toLowerCase());
}

// 方案二（统一付费）：凭证与模型配置钉死进程级全局 agentDir，绝不随租户切换。
// 在 pi.gottao.com 上该目录由 PI_CODING_AGENT_DIR=/data/pi-agent 指定；租户
// currentAgentDir() 会切到用户目录，但 getAgentDir() 仍保持全局配置根。
export function createGlobalModelConfig(): { authStorage: AuthStorage; modelRegistry: ModelRegistry } {
  const agentDir = getAgentDir();
  const authStorage = AuthStorage.create(join(agentDir, "auth.json"));
  return {
    authStorage,
    modelRegistry: ModelRegistry.create(authStorage, join(agentDir, "models.json")),
  };
}

function createDiskRegistry(): ModelRegistry {
  const { modelRegistry } = createGlobalModelConfig();
  return modelRegistry;
}

/** Resolve a model from the live session registry, refreshing from disk first. */
export function lookupModel(
  registry: ModelRegistryLike,
  provider: string,
  modelId: string,
): ModelLike | undefined {
  registry.refresh();
  const fromSession = findInRegistry(registry, provider, modelId);
  if (fromSession) return fromSession;

  const fresh = createDiskRegistry();
  const loadError = fresh.getError();
  if (loadError) throw new Error(loadError);

  const fromDisk = findInRegistry(fresh, provider, modelId);
  if (!fromDisk) return undefined;

  registry.refresh();
  return findInRegistry(registry, provider, modelId) ?? fromDisk;
}
