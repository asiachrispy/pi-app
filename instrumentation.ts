export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { ensureRemoteAuthConfig } = await import("./lib/remote-auth-store");
  ensureRemoteAuthConfig();
}
