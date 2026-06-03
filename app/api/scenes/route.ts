import { NextResponse } from "next/server";
import { readAllSceneOverrides } from "@/lib/scene-overrides";
import { getScenesWithOverrides } from "@/lib/scenes";
import { requireApiAuth } from "@/lib/api-auth";

export async function GET(req: Request) {
  const rejected = requireApiAuth(req);
  if (rejected) return rejected;

  return NextResponse.json({ scenes: getScenesWithOverrides(readAllSceneOverrides()) });
}
