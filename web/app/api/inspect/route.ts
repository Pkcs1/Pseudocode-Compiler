import { NextResponse } from "next/server";
import { inspectCode } from "@/lib/runner";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const source = typeof body?.source === "string" ? body.source : "";

    const result = await inspectCode(source);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        tokens: [],
        ast: null,
        kamus: { aliases: {}, structs: {}, constants: [], variables: {} },
        diagnostics: [],
        error: {
          category: "kesalahan server",
          message: err instanceof Error ? err.message : String(err),
          line: 1,
          col: 1,
          formatted: `Gagal menjalankan inspeksi compiler: ${err}`,
        },
      },
      { status: 500 }
    );
  }
}
