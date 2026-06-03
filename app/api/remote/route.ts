import { NextResponse } from "next/server";
import {
  createPairingOffer,
  disableRemoteAccess,
  enableRemoteAccess,
  getPublicRemoteStatus,
  createRelayOffer,
  isLoopbackRequest,
  isSameOriginLoopbackRequest,
  rejectUnauthorizedRequest,
  renameRemoteSession,
  revokeAllRemoteSessions,
  revokeRemoteSession,
  rotateMasterToken,
  updateRemoteSettings,
} from "@/lib/remote-auth";
import { ensureRemoteAuthConfig, loadRemoteAuthConfig } from "@/lib/remote-auth-store";

function requireLocalManagement(req: Request): NextResponse | null {
  if (isLoopbackRequest(req) && isSameOriginLoopbackRequest(req)) {
    return null;
  }
  return rejectUnauthorizedRequest(req);
}

export async function GET(req: Request) {
  const rejected = rejectUnauthorizedRequest(req);
  if (rejected) return rejected;

  ensureRemoteAuthConfig();
  const config = loadRemoteAuthConfig();
  return NextResponse.json({
    status: getPublicRemoteStatus(),
    sessions: config?.sessions ?? [],
  });
}

export async function POST(req: Request) {
  const localOnly = requireLocalManagement(req);
  if (localOnly) return localOnly;

  try {
    const body = await req.json() as {
      action?: string;
      allowedHostnames?: string[];
      readOnly?: boolean;
      sessionId?: string;
      label?: string;
      relayEndpoint?: string;
    };

    switch (body.action) {
      case "enable": {
        const { masterToken } = enableRemoteAccess({
          allowedHostnames: body.allowedHostnames,
          readOnly: body.readOnly,
        });
        return NextResponse.json({
          status: getPublicRemoteStatus(),
          masterToken,
        });
      }
      case "disable": {
        disableRemoteAccess();
        return NextResponse.json({ status: getPublicRemoteStatus() });
      }
      case "rotate-token": {
        const { masterToken } = rotateMasterToken();
        return NextResponse.json({
          status: getPublicRemoteStatus(),
          masterToken,
        });
      }
      case "create-pairing": {
        const offer = createPairingOffer(req);
        return NextResponse.json({ offer, status: getPublicRemoteStatus() });
      }
      case "update-settings": {
        updateRemoteSettings({
          allowedHostnames: body.allowedHostnames,
          readOnly: body.readOnly,
        });
        return NextResponse.json({ status: getPublicRemoteStatus() });
      }
      case "revoke-session": {
        if (!body.sessionId) {
          return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
        }
        revokeRemoteSession(body.sessionId);
        const config = loadRemoteAuthConfig();
        return NextResponse.json({
          status: getPublicRemoteStatus(),
          sessions: config?.sessions ?? [],
        });
      }
      case "revoke-all-sessions": {
        revokeAllRemoteSessions();
        const config = loadRemoteAuthConfig();
        return NextResponse.json({
          status: getPublicRemoteStatus(),
          sessions: config?.sessions ?? [],
        });
      }
      case "rename-session": {
        if (!body.sessionId) {
          return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
        }
        renameRemoteSession(body.sessionId, body.label ?? "");
        const config = loadRemoteAuthConfig();
        return NextResponse.json({
          status: getPublicRemoteStatus(),
          sessions: config?.sessions ?? [],
        });
      }
      case "create-relay-offer": {
        const { offerUrl } = createRelayOffer(req, body.relayEndpoint);
        return NextResponse.json({
          status: getPublicRemoteStatus(),
          relayOfferUrl: offerUrl,
        });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
