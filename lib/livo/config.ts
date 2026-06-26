import { homedir } from "node:os";
import { join, resolve } from "node:path";

/** 生产默认；本地未设 env 时回退 ~/livo（与 S2S workspace 路由一致）。 */
export const DEFAULT_LIVO_WORKSPACE_ROOT = "/data/pi-agent/workspaces/livo";

/** Livo 多租户工作区根目录（绝对路径）。 */
export function resolveLivoWorkspaceRoot(): string {
  const configured = process.env.PI_WEB_LIVO_WORKSPACE_ROOT?.trim();
  if (configured) return resolve(configured);
  return resolve(join(homedir(), "livo"));
}

export function isLivoSsoEnabled(): boolean {
  return process.env.PI_LIVO_SSO_ENABLED === "1";
}

export function isLivoIntegrationEnabled(): boolean {
  const mode = process.env.PI_LIVO_MODE;
  return (
    isLivoSsoEnabled()
    || process.env.PI_LIVO_INTEGRATION_ENABLED === "1"
    || mode === "cloud"
    || mode === "local"
  );
}
