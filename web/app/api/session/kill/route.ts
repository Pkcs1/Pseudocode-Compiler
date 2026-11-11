import { NextResponse } from "next/server";
import { removeSession } from "@/lib/runner";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";

    if (sessionId) {
      removeSession(sessionId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
