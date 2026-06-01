import { NextResponse } from "next/server";
import { getScenes } from "@/lib/scenes";

export async function GET() {
  return NextResponse.json({ scenes: getScenes() });
}
