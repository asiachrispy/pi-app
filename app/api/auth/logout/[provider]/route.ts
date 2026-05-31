import { AuthStorage } from "@earendil-works/pi-coding-agent";
import { rejectUnsafeMutation } from "@/lib/local-request-guard";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const rejected = rejectUnsafeMutation(req);
  if (rejected) return rejected;

  const { provider } = await params;
  const authStorage = AuthStorage.create();
  const providers = authStorage.getOAuthProviders();
  if (!providers.find((p) => p.id === provider)) {
    return Response.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
  }
  authStorage.logout(provider);
  return Response.json({ ok: true });
}
