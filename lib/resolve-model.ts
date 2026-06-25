import { AuthStorage, ModelRegistry } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";
import { getDefaultAgentDir } from "@/lib/agent-dir";
import type { AgentSessionLike, ModelLike } from "@/lib/pi-types";

type ModelRegistryLike = AgentSessionLike["modelRegistry"];

function findInRegistry(registry: ModelRegistryLike, provider: string, modelId: string) {
  return registry.find(provider, modelId)
    ?? registry.find(provider, modelId.toLowerCase())
    ?? registry.getAll().find((m) => m.provider === provider && m.id.toLowerCase() === modelId.toLowerCase());
}

// 方案二（统一付费）：凭证与模型配置钉死全局 agentDir，绝不随租户切换。
// 用 getDefaultAgentDir()（永远 ~/.pi/agent）而非 getAgentDir()，即便将来后者被
// 改造也不受影响——所有租户共享同一份 auth.json / models.json。
const GLOBAL_AGENT_DIR = getDefaultAgentDir();

function createDiskRegistry(): ModelRegistry {
  return ModelRegistry.create(
    AuthStorage.create(join(GLOBAL_AGENT_DIR, "auth.json")),
    join(GLOBAL_AGENT_DIR, "models.json"),
  );
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
