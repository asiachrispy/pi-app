import { NextResponse } from "next/server";
import { listAllSessions } from "@/lib/session-reader";
import { readProductSessionMetadata } from "@/lib/scene-metadata";
import { buildHistoryItems } from "@/lib/scenes";

export async function GET() {
  try {
    const sessions = await listAllSessions();
    const metadata = readProductSessionMetadata();
    return NextResponse.json({ history: buildHistoryItems(sessions, metadata) });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
