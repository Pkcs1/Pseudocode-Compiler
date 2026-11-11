import { spawn } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
import { getProjectRoot, getPythonCommand, registerSession, removeSession } from "@/lib/runner";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const source = typeof body?.source === "string" ? body.source : "";

    const sessionId = crypto.randomUUID();
    const root = getProjectRoot();
    const runnerPath = path.join(root, "interactive_runner.py");
    const pyCmd = getPythonCommand();

    // Spawn interactive runner in root directory
    const proc = spawn(/*turbopackIgnore: true*/ pyCmd, [runnerPath], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONUNBUFFERED: "1", PYTHONIOENCODING: "utf-8" },
    });

    registerSession(sessionId, proc);

    // Initial message to runner contains source code
    proc.stdin.write(JSON.stringify({ source }) + "\n");

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        // Send initial ready event with sessionId so client knows where to send inputs
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "init", sessionId })}\n\n`)
        );

        let lineBuffer = "";
        let exitSent = false;

        proc.stdout.on("data", (chunk: Buffer) => {
          lineBuffer += chunk.toString("utf8");
          const lines = lineBuffer.split("\n");
          // Keep incomplete line in lineBuffer
          lineBuffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const event = JSON.parse(trimmed);
              if (event.type === "exit" || event.type === "error") {
                exitSent = true;
              }
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
              );
            } catch {
              // Raw stdout fallback
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "stdout", text: line + "\n" })}\n\n`
                )
              );
            }
          }
        });

        proc.stderr.on("data", (chunk: Buffer) => {
          const text = chunk.toString("utf8");
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "stdout", text, isStderr: true })}\n\n`
            )
          );
        });

        proc.on("error", (err) => {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                error: {
                  category: "kesalahan sistem runner",
                  message: err.message,
                  line: 1,
                  col: 1,
                  formatted: `Gagal menjalankan runner: ${err.message}`,
                },
              })}\n\n`
            )
          );
          removeSession(sessionId);
          try {
            controller.close();
          } catch {
            // ignore
          }
        });

        proc.on("close", (code) => {
          // Flush remaining buffer if any
          if (lineBuffer.trim()) {
            try {
              const event = JSON.parse(lineBuffer.trim());
              if (event.type === "exit" || event.type === "error") {
                exitSent = true;
              }
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
              );
            } catch {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "stdout", text: lineBuffer })}\n\n`
                )
              );
            }
          }

          if (!exitSent) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "exit", code: code ?? 0 })}\n\n`
              )
            );
          }
          removeSession(sessionId);
          try {
            controller.close();
          } catch {
            // ignore
          }
        });

        // Kill process if client disconnects
        req.signal.addEventListener("abort", () => {
          removeSession(sessionId);
          try {
            proc.kill();
          } catch {
            // ignore
          }
        });
      },
      cancel() {
        removeSession(sessionId);
        try {
          proc.kill();
        } catch {
          // ignore
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
