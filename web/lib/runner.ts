import { ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface InspectResult {
  tokens: Array<{
    type: string;
    value: string;
    line: number;
    col: number;
  }>;
  ast: Record<string, unknown> | null;
  kamus: {
    aliases: Record<string, string>;
    structs: Record<string, Record<string, string>>;
    constants: string[];
    variables: Record<string, string>;
  };
  error: {
    category: string;
    message: string;
    line: number;
    col: number;
    formatted: string;
  } | null;
}

export function getProjectRoot(): string {
  // Check if we are running from inside web/ or project root
  const direct = path.join(process.cwd(), "interactive_runner.py");
  if (fs.existsSync(direct)) {
    return process.cwd();
  }
  const parent = path.resolve(process.cwd(), "..");
  if (fs.existsSync(path.join(parent, "interactive_runner.py"))) {
    return parent;
  }
  return process.cwd();
}

export function getPythonCommand(): string {
  return process.env.PYTHON_PATH || "python";
}

export async function inspectCode(source: string): Promise<InspectResult> {
  const root = getProjectRoot();
  const runnerPath = path.join(root, "interactive_runner.py");
  const pyCmd = getPythonCommand();

  return new Promise((resolve, reject) => {
    const proc = spawn(/*turbopackIgnore: true*/ pyCmd, [runnerPath, "--inspect"], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    proc.on("error", (err) => {
      reject(err);
    });

    proc.on("close", (code) => {
      if (code !== 0 && !stdout.trim()) {
        resolve({
          tokens: [],
          ast: null,
          kamus: { aliases: {}, structs: {}, constants: [], variables: {} },
          error: {
            category: "kesalahan eksekusi runner",
            message: stderr.trim() || `Proses inspeksi keluar dengan kode ${code}`,
            line: 1,
            col: 1,
            formatted: stderr.trim() || `Proses inspeksi keluar dengan kode ${code}`,
          },
        });
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as InspectResult;
        resolve(parsed);
      } catch (e) {
        resolve({
          tokens: [],
          ast: null,
          kamus: { aliases: {}, structs: {}, constants: [], variables: {} },
          error: {
            category: "kesalahan parse inspeksi",
            message: e instanceof Error ? e.message : String(e),
            line: 1,
            col: 1,
            formatted: `Gagal membaca hasil inspeksi:\n${stdout}\n${stderr}`,
          },
        });
      }
    });

    // Write source payload to stdin
    proc.stdin.write(JSON.stringify({ source }));
    proc.stdin.end();
  });
}

export interface ActiveSession {
  id: string;
  proc: ChildProcess;
  createdAt: number;
  lastActivity: number;
}

declare global {
  var __pseudocodeSessions: Map<string, ActiveSession> | undefined;
}

const sessions: Map<string, ActiveSession> =
  globalThis.__pseudocodeSessions ?? new Map<string, ActiveSession>();
globalThis.__pseudocodeSessions = sessions;

export function registerSession(id: string, proc: ChildProcess): ActiveSession {
  const session: ActiveSession = {
    id,
    proc,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): ActiveSession | undefined {
  const session = sessions.get(id);
  if (session) {
    session.lastActivity = Date.now();
  }
  return session;
}

export function removeSession(id: string): void {
  const session = sessions.get(id);
  if (session) {
    if (!session.proc.killed) {
      try {
        session.proc.kill();
      } catch {
        // ignore
      }
    }
    sessions.delete(id);
  }
}

// Periodically clean up stale sessions (> 5 minutes old)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
      if (now - session.lastActivity > 5 * 60 * 1000) {
        removeSession(id);
      }
    }
  }, 60 * 1000).unref?.();
}
