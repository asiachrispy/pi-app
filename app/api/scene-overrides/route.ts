import { NextResponse } from "next/server";
import { readAllSceneOverrides } from "@/lib/scene-overrides";
import { requireApiAuth } from "@/lib/api-auth";

export async function GET(req: Request) {
  const rejected = requireApiAuth(req);
  if (rejected) return rejected;

  try {
    const overrides = readAllSceneOverrides();
    return NextResponse.json({ overrides });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to read scene overrides: ${String(error)}` },
      { status: 500 },
    );
  }
}
