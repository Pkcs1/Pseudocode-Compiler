import { executePseudocode } from "@/lib/engine";

export interface TestCase {
  id: string;
  /** Everything the program reads with input(...), one value per line / separated by spaces. */
  input: string;
  /** Expected program output. Empty = just run and show the output, no comparison. */
  expected: string;
}

export type TestStatus = "pass" | "fail" | "error" | "timeout" | "done";

export interface TestResult {
  status: TestStatus;
  output: string;
  /** Error message (compile/runtime error, timeout) when status is error/timeout. */
  error?: string;
  errorLine?: number;
  durationMs: number;
}

const DEFAULT_TIMEOUT_MS = 5000;

/** Compare outputs ignoring trailing spaces on each line and trailing blank lines. */
export function normalizeOutput(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n+$/, "");
}

/**
 * Run the program once with a fixed stdin. All input is queued up front, so
 * the program never waits for typing; if it asks for more values than were
 * given, it fails with the interpreter's "input habis" runtime error.
 */
export function runTestCase(
  code: string,
  testCase: Pick<TestCase, "input" | "expected">,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<TestResult> {
  return new Promise((resolve) => {
    let output = "";
    let settled = false;
    const startedAt = performance.now();

    const finish = (result: Omit<TestResult, "output" | "durationMs"> & { durationMs?: number }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        output,
        durationMs: result.durationMs ?? Math.round(performance.now() - startedAt),
        ...result,
      });
    };

    // Created before the handle exists, so a synchronous input request is
    // answered after the queued input below has been fed.
    let handle: ReturnType<typeof executePseudocode> | null = null;

    const timer = setTimeout(() => {
      handle?.stop();
      finish({
        status: "timeout",
        error: `program tidak selesai dalam ${timeoutMs / 1000} detik (kemungkinan perulangan tanpa akhir).`,
      });
    }, timeoutMs);

    handle = executePseudocode(code, {
      onStdout: (text) => {
        output += text;
      },
      onNeedInput: () => {
        // No more queued input: answering with an empty line makes the
        // interpreter raise "masukan (input) habis".
        queueMicrotask(() => handle?.sendInput(""));
      },
      onError: (err, durationMs) => {
        finish({ status: "error", error: err.message, errorLine: err.line, durationMs });
      },
      onExit: (_code, durationMs) => {
        const hasExpected = testCase.expected.trim().length > 0;
        const status: TestStatus = !hasExpected
          ? "done"
          : normalizeOutput(output) === normalizeOutput(testCase.expected)
          ? "pass"
          : "fail";
        finish({ status, durationMs });
      },
    });

    if (testCase.input.trim()) {
      // Blank lines are skipped: an empty line means "end of input" to the reader.
      for (const line of testCase.input.replace(/\r\n?/g, "\n").split("\n")) {
        if (line.trim()) handle.sendInput(line);
      }
    }
  });
}
