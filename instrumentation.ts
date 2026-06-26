export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initLivoSessionStore } = await import("./lib/auth/session-store");
    await initLivoSessionStore();
  }
}
