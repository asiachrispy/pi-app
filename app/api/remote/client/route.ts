import { NextResponse } from "next/server";
import { getClientRemoteContext } from "@/lib/remote-auth";

export async function GET(req: Request) {
  return NextResponse.json(getClientRemoteContext(req));
}
