import { SemanticChecker } from "./checker";
import { PseudoError } from "./errors";
import {
  AsyncInputReader,
  ExecutionTrace,
  formatValue,
  Interpreter,
  UNINITIALIZED,
} from "./interpreter";
import { normalizeSmartQuotes, tokenize } from "./lexer";
import { parse } from "./parser";

export interface ExecutionErrorDetail {
  category: string;
  message: string;
  line: number;
  col: number;
  formatted: string;
}

export interface VariableSnapshotItem {
  type: string;
  value: string;
  numericValue?: number;
}

export type VariableSnapshot = Record<string, VariableSnapshotItem>;

export interface ExecutionCallbacks {
  onStdout: (text: string) => void;
  onNeedInput: () => void;
  onError: (error: ExecutionErrorDetail, durationMs: number) => void;
  onExit: (code: number, durationMs: number, snapshot?: VariableSnapshot) => void;
  onVariablesSnapshot?: (snapshot: VariableSnapshot) => void;
  /** When provided, execution is traced step by step (tabel trace). Called at
   *  every input request and when the program ends (normally or with an error). */
  onTrace?: (trace: ExecutionTrace) => void;
}

export interface ExecutionHandle {
  sendInput: (input: string) => void;
  stop: () => void;
}

export function executePseudocode(
  source: string,
  callbacks: ExecutionCallbacks
): ExecutionHandle {
  const normalized = normalizeSmartQuotes(source);
  const sourceLines = normalized.split(/\r?\n/);
  const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();

  let isStopped = false;
  let interpreterInstance: Interpreter | null = null;

  const getSnapshot = (): VariableSnapshot => {
    if (!interpreterInstance) return {};
    const snap: VariableSnapshot = {};
    for (const [varName, rawVal] of interpreterInstance.env.entries()) {
      const type = interpreterInstance.varTypes.get(varName) || "unknown";
      if (rawVal === UNINITIALIZED) {
        snap[varName] = { type, value: "(belum diisi)" };
      } else {
        const formatted = formatValue(rawVal, type);
        const num =
          typeof rawVal === "bigint"
            ? Number(rawVal)
            : typeof rawVal === "number"
            ? rawVal
            : undefined;
        snap[varName] = { type, value: formatted, numericValue: num };
      }
    }
    return snap;
  };

  const emitTrace = () => {
    if (callbacks.onTrace && interpreterInstance) {
      callbacks.onTrace(interpreterInstance.getTrace());
    }
  };

  const reader = new AsyncInputReader(() => {
    if (!isStopped) {
      emitTrace();
      callbacks.onVariablesSnapshot?.(getSnapshot());
      callbacks.onNeedInput();
    }
  });

  const runAsync = async () => {
    try {
      // 1. Lexer
      const tokens = tokenize(normalized);

      // 2. Parser
      const program = parse(tokens, normalized);

      // 3. Checker
      const checker = new SemanticChecker(sourceLines);
      checker.checkProgram(program);

      // 4. Interpreter
      const interpreter = new Interpreter(
        sourceLines,
        reader,
        (text) => {
          if (!isStopped) {
            callbacks.onStdout(text);
          }
        },
        500_000
      );
      if (callbacks.onTrace) interpreter.enableTrace();
      interpreterInstance = interpreter;

      await interpreter.run(program);

      if (!isStopped) {
        const endTime = typeof performance !== "undefined" ? performance.now() : Date.now();
        const snap = getSnapshot();
        emitTrace();
        callbacks.onVariablesSnapshot?.(snap);
        callbacks.onExit(0, Math.round(endTime - startTime), snap);
      }
    } catch (err: unknown) {
      if (isStopped) return;
      const endTime = typeof performance !== "undefined" ? performance.now() : Date.now();
      const durationMs = Math.round(endTime - startTime);
      emitTrace();

      if (err instanceof PseudoError) {
        callbacks.onError(
          {
            category: err.category,
            message: err.message,
            line: err.line,
            col: err.col,
            formatted: err.formatError(sourceLines),
          },
          durationMs
        );
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "Execution stopped by user") return;
        callbacks.onError(
          {
            category: "kesalahan internal",
            message: msg,
            line: 1,
            col: 1,
            formatted: `Error internal: ${msg}`,
          },
          durationMs
        );
      }
    }
  };

  runAsync();

  return {
    sendInput: (input: string) => {
      reader.feedLine(input);
    },
    stop: () => {
      isStopped = true;
      if (interpreterInstance) {
        interpreterInstance.stop();
      } else {
        reader.cancel();
      }
    },
  };
}
