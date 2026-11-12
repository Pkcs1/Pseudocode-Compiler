import crypto from "node:crypto";
import { registerSession, removeSession } from "@/lib/runner";
import { executePseudocode } from "@/lib/engine";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const source = typeof body?.source === "string" ? body.source : "";

    const sessionId = crypto.randomUUID();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        // Send initial ready event with sessionId so client knows where to send inputs
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "init", sessionId })}\n\n`)
        );

        let isClosed = false;
        const safeEnqueue = (data: string) => {
          if (!isClosed) {
            try {
              controller.enqueue(encoder.encode(data));
            } catch {
              isClosed = true;
            }
          }
        };

        const safeClose = () => {
          if (!isClosed) {
            isClosed = true;
            removeSession(sessionId);
            try {
              controller.close();
            } catch {
              // ignore
            }
          }
        };

        const handle = executePseudocode(source, {
          onStdout: (text) => {
            safeEnqueue(`data: ${JSON.stringify({ type: "stdout", text })}\n\n`);
          },
          onNeedInput: () => {
            safeEnqueue(`data: ${JSON.stringify({ type: "need_input" })}\n\n`);
          },
          onError: (error, durationMs) => {
            safeEnqueue(
              `data: ${JSON.stringify({ type: "error", error, durationMs })}\n\n`
            );
            safeClose();
          },
          onExit: (code, durationMs) => {
            safeEnqueue(
              `data: ${JSON.stringify({ type: "exit", code, durationMs })}\n\n`
            );
            safeClose();
          },
        });

        registerSession(sessionId, handle);
      },
      cancel() {
        removeSession(sessionId);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({
        error: {
          category: "kesalahan server",
          message: msg,
          line: 1,
          col: 1,
          formatted: `Gagal memulai sesi compiler: ${msg}`,
        },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
