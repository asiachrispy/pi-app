import { NextResponse } from "next/server";

export function rejectDisabledTerminal(): NextResponse | null {
  if (process.env.PI_WEB_TERMINAL_DISABLED === "1") {
    return NextResponse.json({ error: "terminal_disabled" }, { status: 403 });
  }
  return null;
}
