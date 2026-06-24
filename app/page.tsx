import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";

export default async function Home() {
  if (process.env.PI_LIVO_SSO_ENABLED === "1") {
    const cookieStore = await cookies();
    if (!cookieStore.get("pi_livo_session")) {
      redirect("/api/livo/sso/start?returnTo=/app/");
    }
  }

  return (
    <Suspense>
      <AppShell />
    </Suspense>
  );
}
