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
import { isLivoSessionStoreVerifyEnabled } from "@/lib/middleware-internal-verify";

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
    if (livoSession) {
      initialDefaultCwd = livoUserWorkspaceRoot(livoSession.livoUserId);
    } else if (!isLivoSessionStoreVerifyEnabled()) {
      // Edge 未接 internal verify 时，Node 仍做 store 校验（#10 前兼容）
      redirect(buildSsoStartUrl(search));
    }
  }

  return (
    <Suspense>
      <AppShell initialDefaultCwd={initialDefaultCwd} />
    </Suspense>
  );
}
