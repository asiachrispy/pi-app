import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  LIVO_SESSION_COOKIE_NAME,
  livoUserWorkspaceRoot,
  readLivoSessionCookieValue,
} from "@/lib/livo-sso";
import { isLivoSsoEnabled } from "@/lib/livo/config";
import { buildSsoStartUrl } from "@/lib/livo/workbench";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let initialDefaultCwd: string | null = null;
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value)) value.forEach((entry) => query.append(key, entry));
  }
  const search = query.toString() ? `?${query.toString()}` : "";

  if (isLivoSsoEnabled()) {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(LIVO_SESSION_COOKIE_NAME);
    const livoSession = readLivoSessionCookieValue(sessionCookie?.value);
    if (!livoSession) {
      redirect(buildSsoStartUrl(search));
    }
    initialDefaultCwd = livoUserWorkspaceRoot(livoSession.livoUserId);
  }

  return (
    <Suspense>
      <AppShell initialDefaultCwd={initialDefaultCwd} />
    </Suspense>
  );
}
