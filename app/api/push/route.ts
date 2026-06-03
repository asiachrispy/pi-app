import { NextResponse } from "next/server";
import {
  addPushSubscription,
  getPushPublicStatus,
  removePushSubscription,
  sendTestPush,
} from "@/lib/push-notifications";
import {
  isLoopbackRequest,
  isSameOriginLoopbackRequest,
  rejectUnauthorizedRequest,
} from "@/lib/remote-auth";

function requireLocalManagement(req: Request): NextResponse | null {
  if (isLoopbackRequest(req) && isSameOriginLoopbackRequest(req)) return null;
  return rejectUnauthorizedRequest(req);
}

export async function GET(req: Request) {
  const rejected = rejectUnauthorizedRequest(req);
  if (rejected) return rejected;
  return NextResponse.json({ push: getPushPublicStatus() });
}

export async function POST(req: Request) {
  const rejected = rejectUnauthorizedRequest(req);
  if (rejected) return rejected;

  try {
    const body = await req.json() as {
      action?: string;
      subscription?: {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
    };

    switch (body.action) {
      case "subscribe": {
        const endpoint = body.subscription?.endpoint;
        const p256dh = body.subscription?.keys?.p256dh;
        const auth = body.subscription?.keys?.auth;
        if (!endpoint || !p256dh || !auth) {
          return NextResponse.json({ error: "subscription is required" }, { status: 400 });
        }
        addPushSubscription({
          endpoint,
          keys: { p256dh, auth },
          userAgent: req.headers.get("user-agent") ?? undefined,
        });
        return NextResponse.json({ push: getPushPublicStatus() });
      }
      case "unsubscribe": {
        const endpoint = body.subscription?.endpoint;
        if (!endpoint) {
          return NextResponse.json({ error: "subscription.endpoint is required" }, { status: 400 });
        }
        removePushSubscription(endpoint);
        return NextResponse.json({ push: getPushPublicStatus() });
      }
      case "test": {
        const localOnly = requireLocalManagement(req);
        if (localOnly) return localOnly;
        const result = await sendTestPush();
        return NextResponse.json({ push: getPushPublicStatus(), result });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
