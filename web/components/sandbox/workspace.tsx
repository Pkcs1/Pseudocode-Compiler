"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Play,
  Square,
  BookOpen,
  Code2,
} from "lucide-react";
import { PseudocodeEditor, JumpRequest } from "./pseudocode-editor";
import { ResultsPane, TerminalEntry } from "./results-pane";
import { SyntaxCheatsheetModal } from "./syntax-cheatsheet-modal";
import { TestCasesPanel } from "./test-cases-panel";
import { runTestCase, TestCase, TestResult } from "@/lib/test-runner";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { SoundVolumeControl } from "./sound-volume-control";
import { InspectResult } from "@/lib/runner";
import { useAudioSprite } from "@/lib/use-audio";
import {
  inspectSource,
  executePseudocode,
  ExecutionHandle,
  VariableSnapshot,
  Diagnostic,
} from "@/lib/engine";

/** Delay before re-checking the code after a keystroke (like Error Lens' delay). */
const INSPECT_DEBOUNCE_MS = 250;

let testCaseSeq = 0;
const newTestCase = (): TestCase => ({ id: `case-${++testCaseSeq}`, input: "", expected: "" });

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Drag handle between two panes (LeetCode style). Double-click resets the split. */
function ResizeHandle({
  axis,
  containerRef,
  onResize,
  onReset,
  className,
}: {
  axis: "x" | "y";
  containerRef: React.RefObject<HTMLDivElement | null>;
  onResize: (pct: number) => void;
  onReset: () => void;
  className?: string;
}) {
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e: React.PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    setDragging(true);
    const move = (ev: PointerEvent) => {
      const pct =
        axis === "x"
          ? ((ev.clientX - rect.left) / rect.width) * 100
          : ((ev.clientY - rect.top) / rect.height) * 100;
      onResize(clamp(pct, 20, 80));
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      role="separator"
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      title="Geser untuk mengubah ukuran (klik dua kali untuk reset)"
      onPointerDown={onPointerDown}
      onDoubleClick={onReset}
      className={cn(
        "group shrink-0 items-center justify-center touch-none",
        axis === "x" ? "w-2 cursor-col-resize" : "h-2 cursor-row-resize",
        className
      )}
    >
      <div
        className={cn(
          "rounded-full transition-colors",
          axis === "x" ? "w-[3px] h-10" : "h-[3px] w-10",
          dragging
            ? "bg-[#5b45ff] dark:bg-sky-400"
            : "bg-[#d4d4cf] group-hover:bg-[#5b45ff] dark:bg-neutral-700 dark:group-hover:bg-sky-400"
        )}
      />
    </div>
  );
}

const EXAMPLES: Record<string, string> = {
  warung: `program Warung
kamus
    harga, jumlah, diskon : integer
    persen, totalAwal, potongan, total : real
algoritma
    input(harga, jumlah, diskon)
    persen = diskon / 100
    totalAwal = harga * jumlah
    potongan = totalAwal * persen
    total = totalAwal - potongan
    output(total, total >= 50000)
endprogram`,
  rata: `program RataRata
kamus
    i, n, x, tot : integer
    rata : real
algoritma
    input(n)
    tot <- 0
    for i <- 1 to n do
        input(x)
        tot <- tot + x
    endfor
    rata <- tot / n
    output(rata, rata >= 70)
endprogram`,
  tes: `program CekNilai
kamus
    x : integer
algoritma
    input(x)
    if x > 10 then
        output("X lebih besar dari 10")
    else
        output("X kurang dari atau sama dengan 10")
    endif
endprogram`,
  titik: `program JarakTitik
kamus
    type Titik : < x : real, y : real >
    p1, p2 : Titik
    dx, dy : real
algoritma
    input(p1.x, p1.y)
    input(p2.x, p2.y)
    dx <- p2.x - p1.x
    dy <- p2.y - p1.y
    output("Selisih koordinat:", dx, dy)
endprogram`,
};

export function Workspace() {
  const [code, setCode] = useState<string>("");
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isWaitingInput, setIsWaitingInput] = useState<boolean>(false);
  const [inspectData, setInspectData] = useState<InspectResult | null>(null);
  const [variableSnapshot, setVariableSnapshot] = useState<VariableSnapshot | null>(null);
  const [lastExecutionMs, setLastExecutionMs] = useState<number | null>(null);
  // Error raised while the program was running (shown inline until the code changes).
  // Tagged with the code it came from, so it disappears as soon as the code is edited.
  const [runtimeError, setRuntimeError] = useState<{ diag: Diagnostic; code: string } | null>(null);
  const [jumpTo, setJumpTo] = useState<JumpRequest | null>(null);

  // Test cases (run the program against fixed input/expected output)
  const [testCases, setTestCases] = useState<TestCase[]>(() => [newTestCase()]);
  const [testResults, setTestResults] = useState<Record<string, TestResult | undefined>>({});
  const [runningTests, setRunningTests] = useState<Set<string>>(() => new Set());

  // LeetCode-style split sizes (percent)
  const DEFAULT_LEFT = 52;
  const DEFAULT_TOP = 55;
  const [leftPct, setLeftPct] = useState(DEFAULT_LEFT);
  const [topPct, setTopPct] = useState(DEFAULT_TOP);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const [soundVolume, setSoundVolume] = useState<number>(() => {
    if (typeof window === "undefined") return 0.7;
    const saved = localStorage.getItem("pseudo-sound-volume");
    return saved !== null ? Number(saved) : 0.7;
  });
  const [isCheatsheetOpen, setIsCheatsheetOpen] = useState<boolean>(false);

  const runnerHandleRef = useRef<ExecutionHandle | null>(null);
  const { down: soundDown, up: soundUp, playClickPreview } = useAudioSprite(
    soundVolume > 0,
    soundVolume
  );

  const handleVolumeChange = (vol: number) => {
    setSoundVolume(vol);
    if (typeof window !== "undefined") {
      localStorage.setItem("pseudo-sound-volume", String(vol));
    }
  };

  // Live in-browser inspection (lexer + parser + checker + lint) on code changes
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        setInspectData(code.trim() ? inspectSource(code) : null);
      } catch {
        // ignore
      }
    }, INSPECT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [code]);

  // Static diagnostics + the runtime error from the last run (if not already listed).
  const diagnostics = useMemo<Diagnostic[]>(() => {
    if (!code.trim()) return [];
    const list = inspectData?.diagnostics ?? [];
    const rt = runtimeError?.code === code ? runtimeError.diag : null;
    if (rt && !list.some((d) => d.line === rt.line && d.message === rt.message)) {
      return [...list, rt].sort((a, b) => a.line - b.line || a.col - b.col);
    }
    return list;
  }, [code, inspectData, runtimeError]);

  const handleJumpToDiagnostic = useCallback((line: number, col: number) => {
    setJumpTo({ line, col, nonce: Date.now() });
  }, []);

  const runTests = async (ids: string[]) => {
    if (runningTests.size > 0 || ids.length === 0) return;
    soundDown("Enter");
    const source = code;
    const byId = new Map(testCases.map((tc) => [tc.id, tc]));
    setTestResults((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });
    setRunningTests(new Set(ids));
    for (const id of ids) {
      const tc = byId.get(id);
      if (!tc) continue;
      const result = await runTestCase(source, tc);
      setTestResults((prev) => ({ ...prev, [id]: result }));
      setRunningTests((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const runAllTests = () => runTests(testCases.map((tc) => tc.id));

  const updateTestCase = (id: string, patch: Partial<Pick<TestCase, "input" | "expected">>) => {
    setTestCases((prev) => prev.map((tc) => (tc.id === id ? { ...tc, ...patch } : tc)));
    // The old result no longer matches what's in the row.
    setTestResults((prev) => ({ ...prev, [id]: undefined }));
  };

  const addTestCase = () => setTestCases((prev) => [...prev, newTestCase()]);

  const removeTestCase = (id: string) => {
    setTestCases((prev) => prev.filter((tc) => tc.id !== id));
    setTestResults((prev) => ({ ...prev, [id]: undefined }));
  };

  const stopExecution = useCallback(() => {
    if (runnerHandleRef.current) {
      runnerHandleRef.current.stop();
      runnerHandleRef.current = null;
    }

    setIsRunning(false);
    setIsWaitingInput(false);
    setEntries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: "system",
        text: "[Eksekusi program dihentikan pengguna]",
      },
    ]);
  }, []);

  const runCode = () => {
    if (isRunning) {
      stopExecution();
      return;
    }

    soundDown("Enter");
    setRuntimeError(null);
    setIsRunning(true);
    setIsWaitingInput(false);

    // Add command banner
    setEntries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: "command",
        text: "pseudo run program.pseudo",
      },
    ]);

    // Inspect
    setInspectData(inspectSource(code));

    try {
      const handle = executePseudocode(code, {
        onStdout: (text) => {
          setEntries((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              type: "stdout",
              text,
            },
          ]);
        },
        onNeedInput: () => {
          setIsWaitingInput(true);
        },
        onVariablesSnapshot: (snap) => {
          setVariableSnapshot(snap);
        },
        onError: (err, durationMs) => {
          setIsWaitingInput(false);
          setIsRunning(false);
          setLastExecutionMs(durationMs);
          if (err.line) {
            setRuntimeError({
              code,
              diag: {
                severity: "error",
                category: err.category,
                message: err.message,
                line: err.line,
                col: err.col,
                length: 0,
              },
            });
          }
          setEntries((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              type: "error",
              error: err,
              durationMs,
            },
          ]);
        },
        onExit: (codeNum, durationMs, snap) => {
          setIsWaitingInput(false);
          setIsRunning(false);
          setLastExecutionMs(durationMs);
          if (snap) {
            setVariableSnapshot(snap);
          }
          setEntries((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              type: "exit",
              code: codeNum,
              durationMs,
            },
          ]);
        },
      });

      runnerHandleRef.current = handle;
    } catch (err: unknown) {
      setIsRunning(false);
      setIsWaitingInput(false);
      const msg = err instanceof Error ? err.message : String(err);
      setEntries((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: "error",
          error: {
            category: "kesalahan eksekusi",
            message: msg,
            line: 1,
            col: 1,
            formatted: `Gagal menjalankan program: ${msg}`,
          },
        },
      ]);
    }
  };

  const handleSendInput = (val: string) => {
    soundDown("Enter");
    setIsWaitingInput(false);

    // Append to console history
    setEntries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: "input-echo",
        text: val,
      },
    ]);

    if (runnerHandleRef.current) {
      runnerHandleRef.current.sendInput(val);
    }
  };

  const handleLoadExample = (name: string) => {
    if (EXAMPLES[name]) {
      setCode(EXAMPLES[name]);
      setVariableSnapshot(null);
      soundDown("Enter");
    }
  };

  return (
    <div className="flex flex-col w-full min-h-dvh lg:h-dvh gap-2 p-2 select-text">
      {/* Top Navigation & App Header */}
      <header className="relative z-40 flex flex-wrap items-center justify-between gap-3 px-4 py-2 rounded-xl border border-[#e5e5df] bg-[#fbfbfa]/95 shadow-sm text-[#0f172a] backdrop-blur-md dark:border-neutral-800 dark:bg-[#0d0f12]/95 dark:text-white transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#ede9fe] border border-[#ddd6fe] text-[#5b45ff] dark:bg-purple-500/10 dark:border-purple-500/30 dark:text-purple-400">
            <Code2 className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm tracking-tight text-[#0f172a] dark:text-white font-mono">
            Pseudocode Compiler
          </span>
          <span className="px-1.5 py-0.5 rounded bg-[#edeef0] border border-[#e2e2dc] text-[#475569] dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300 text-[10px] font-mono">
            v1.0
          </span>
          <span className="hidden md:flex text-[11px] text-[#16a34a] dark:text-emerald-400 items-center gap-1 font-medium font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] dark:bg-emerald-400 inline-block" />
            client engine online
          </span>
        </div>
        {/* Global Controls */}
        <div className="flex items-center gap-2">
          {/* Run / Stop Button */}
          {isRunning ? (
            <button
              type="button"
              onClick={stopExecution}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-medium text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-all cursor-pointer font-mono"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Hentikan</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={runCode}
              title="Jalankan pseudocode (Ctrl + Enter)"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-semibold text-xs bg-[#5b45ff] hover:bg-[#4f46e5] text-white shadow-sm dark:bg-emerald-600 dark:hover:bg-emerald-500 transition-all cursor-pointer font-mono"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Jalankan</span>
            </button>
          )}

          {/* Cheatsheet Button */}
          <button
            type="button"
            onClick={() => {
              soundDown("Enter");
              setIsCheatsheetOpen(true);
            }}
            title="Buka panduan sintaks pseudocode"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#e2e2dc] bg-[#fbfbfa] hover:bg-[#edeef0] text-[#475569] hover:text-[#0f172a] dark:border-neutral-700/80 dark:bg-neutral-800/80 dark:text-neutral-300 dark:hover:text-white text-xs font-mono font-medium transition-all cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#5b45ff] dark:text-amber-400" />
            <span className="hidden sm:inline">Panduan</span>
          </button>

          {/* Sound Volume Control */}
          <SoundVolumeControl
            volume={soundVolume}
            onVolumeChange={handleVolumeChange}
            onPreviewClick={(v) => playClickPreview(v)}
          />

          {/* Dark / Light Mode Toggle */}
          <ThemeToggle onToggleSound={() => soundDown("Enter")} />
        </div>
      </header>

      {/* MAIN: LeetCode-style split — editor | (test cases / results) */}
      <div
        ref={mainRef}
        className="flex flex-col gap-2 lg:gap-0 lg:flex-row lg:flex-1 lg:min-h-0"
        style={{ "--left": `${leftPct}%`, "--top": `${topPct}%` } as React.CSSProperties}
      >
        {/* Left: Code Editor */}
        <section className="relative z-10 h-[65vh] lg:h-auto lg:min-w-0 lg:w-[var(--left)]">
          <PseudocodeEditor
            code={code}
            onChange={setCode}
            onRun={runCode}
            onRunTests={runAllTests}
            isRunning={isRunning}
            onStop={stopExecution}
            diagnostics={diagnostics}
            jumpTo={jumpTo}
            onKeyDownSound={soundDown}
            onKeyUpSound={soundUp}
            onLoadExample={handleLoadExample}
            lastExecutionMs={lastExecutionMs}
          />
        </section>

        <ResizeHandle
          axis="x"
          containerRef={mainRef}
          onResize={setLeftPct}
          onReset={() => setLeftPct(DEFAULT_LEFT)}
          className="hidden lg:flex"
        />

        {/* Right: Problems / Terminal / Kamus (top) + Test cases (bottom) */}
        <div ref={rightRef} className="flex flex-col gap-2 lg:gap-0 lg:flex-1 lg:min-w-0 lg:min-h-0">
          <section className="h-[55vh] lg:min-h-0 lg:h-[var(--top)]">
            <ResultsPane
              entries={entries}
              isRunning={isRunning}
              isWaitingInput={isWaitingInput}
              onSendInput={handleSendInput}
              onClear={() => setEntries([])}
              inspectData={inspectData}
              variableSnapshot={variableSnapshot}
              lastExecutionMs={lastExecutionMs}
              onKeyDownSound={soundDown}
              onKeyUpSound={soundUp}
              diagnostics={diagnostics}
              onJumpTo={handleJumpToDiagnostic}
            />
          </section>

          <ResizeHandle
            axis="y"
            containerRef={rightRef}
            onResize={setTopPct}
            onReset={() => setTopPct(DEFAULT_TOP)}
            className="hidden lg:flex"
          />

          <section className="h-[55vh] lg:h-auto lg:flex-1 lg:min-h-0">
            <TestCasesPanel
              cases={testCases}
              results={testResults}
              running={runningTests}
              onChangeCase={updateTestCase}
              onAddCase={addTestCase}
              onRemoveCase={removeTestCase}
              onRunCase={(id) => runTests([id])}
              onRunAll={runAllTests}
              onJumpToLine={(line) => handleJumpToDiagnostic(line, 1)}
            />
          </section>
        </div>
      </div>

      {/* Cheatsheet Modal */}
      <SyntaxCheatsheetModal
        isOpen={isCheatsheetOpen}
        onClose={() => setIsCheatsheetOpen(false)}
        onInsertCode={(snippet) => setCode(snippet)}
      />
    </div>
  );
}
