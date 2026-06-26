import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  LIVO_SESSION_COOKIE_NAME,
  livoUserWorkspaceRoot,
  readLivoSessionCookieValue,
} from "@/lib/livo-sso";

export const dynamic = "force-dynamic";

export default async function Home() {
  let initialDefaultCwd: string | null = null;

  if (process.env.PI_LIVO_SSO_ENABLED === "1") {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(LIVO_SESSION_COOKIE_NAME);
    const livoSession = readLivoSessionCookieValue(sessionCookie?.value);
    if (!livoSession) {
      redirect("/api/livo/sso/start?returnTo=/app/");
    }
    initialDefaultCwd = livoUserWorkspaceRoot(livoSession.livoUserId);
  }

  return (
    <Suspense>
      <AppShell initialDefaultCwd={initialDefaultCwd} />
    </Suspense>
  );
}
