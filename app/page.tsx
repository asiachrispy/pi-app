import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { LIVO_SESSION_COOKIE_NAME, readLivoSessionCookieValue } from "@/lib/livo-sso";

export default async function Home() {
  if (process.env.PI_LIVO_SSO_ENABLED === "1") {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(LIVO_SESSION_COOKIE_NAME);
    if (!readLivoSessionCookieValue(sessionCookie?.value)) {
      redirect("/api/livo/sso/start?returnTo=/app/");
    }
  }

  return (
    <Suspense>
      <AppShell />
    </Suspense>
  );
}
