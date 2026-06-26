/** 生产默认工作区根（199 与 piweb-install 一致）。 */
export const DEFAULT_LIVO_WORKSPACE_ROOT = "/data/pi-agent/workspaces/livo";

/** Client/Edge 安全：不 import node:os/path；打包时 PI_WEB_LIVO_WORKSPACE_ROOT 会内联。 */
export function resolveLivoWorkspaceRootDisplay(): string {
  const configured = process.env.PI_WEB_LIVO_WORKSPACE_ROOT?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return DEFAULT_LIVO_WORKSPACE_ROOT;
}
