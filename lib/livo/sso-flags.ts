/** Edge/middleware 安全：仅读 env，不 import node:os/path。 */

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
