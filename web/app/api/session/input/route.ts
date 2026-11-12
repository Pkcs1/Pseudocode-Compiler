import { NextResponse } from "next/server";
import { getSession } from "@/lib/runner";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
    const input = typeof body?.input === "string" ? body.input : "";

    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "sessionId is required" }, { status: 400 });
    }

    const session = getSession(sessionId);
    if (!session || !session.handle) {
      return NextResponse.json(
        { ok: false, error: "Sesi tidak ditemukan atau telah selesai" },
        { status: 404 }
      );
    }

    session.handle.sendInput(input);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
