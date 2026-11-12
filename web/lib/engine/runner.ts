import { SemanticChecker } from "./checker";
import { PseudoError } from "./errors";
import { AsyncInputReader, Interpreter } from "./interpreter";
import { normalizeSmartQuotes, tokenize } from "./lexer";
import { parse } from "./parser";

export interface ExecutionErrorDetail {
  category: string;
  message: string;
  line: number;
  col: number;
  formatted: string;
}

export interface ExecutionCallbacks {
  onStdout: (text: string) => void;
  onNeedInput: () => void;
  onError: (error: ExecutionErrorDetail, durationMs: number) => void;
  onExit: (code: number, durationMs: number) => void;
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
  const reader = new AsyncInputReader(() => {
    if (!isStopped) {
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
      interpreterInstance = interpreter;

      await interpreter.run(program);

      if (!isStopped) {
        const endTime = typeof performance !== "undefined" ? performance.now() : Date.now();
        callbacks.onExit(0, Math.round(endTime - startTime));
      }
    } catch (err: unknown) {
      if (isStopped) return;
      const endTime = typeof performance !== "undefined" ? performance.now() : Date.now();
      const durationMs = Math.round(endTime - startTime);

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
