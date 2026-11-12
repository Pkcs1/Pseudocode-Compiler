import fs from "node:fs";
import path from "node:path";
import {
  inspectSource,
  InspectResult,
  ExecutionHandle,
} from "./engine";

export type { InspectResult };

export function getProjectRoot(): string {
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

export async function inspectCode(source: string): Promise<InspectResult> {
  return inspectSource(source);
}

export interface ActiveSession {
  id: string;
  handle?: ExecutionHandle;
  createdAt: number;
  lastActivity: number;
}

declare global {
  var __pseudocodeSessions: Map<string, ActiveSession> | undefined;
}

const sessions: Map<string, ActiveSession> =
  globalThis.__pseudocodeSessions ?? new Map<string, ActiveSession>();
globalThis.__pseudocodeSessions = sessions;

export function registerSession(
  id: string,
  handle?: ExecutionHandle
): ActiveSession {
  const session: ActiveSession = {
    id,
    handle,
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
    try {
      session.handle?.stop();
    } catch {
      // ignore
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
