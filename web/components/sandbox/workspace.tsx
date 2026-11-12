"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Square,
  BookOpen,
  Code2,
} from "lucide-react";
import { PseudocodeEditor } from "./pseudocode-editor";
import { ResultsPane, TerminalEntry } from "./results-pane";
import { DiagnosticsNotes } from "./diagnostics-notes";
import { SyntaxCheatsheetModal } from "./syntax-cheatsheet-modal";
import { ThemeToggle } from "./theme-toggle";
import { SoundVolumeControl } from "./sound-volume-control";
import { InspectResult } from "@/lib/runner";
import { useAudioSprite } from "@/lib/use-audio";
import {
  inspectSource,
  executePseudocode,
  ExecutionHandle,
  VariableSnapshot,
} from "@/lib/engine";

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
  const [errorLine, setErrorLine] = useState<number | null>(null);
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

  // Immediate in-browser semantic inspection on code changes
  useEffect(() => {
    if (!code.trim()) {
      setInspectData(null);
      setErrorLine(null);
      return;
    }
    try {
      const data = inspectSource(code);
      setInspectData(data);
      if (data.error?.line) {
        setErrorLine(data.error.line);
      } else {
        setErrorLine(null);
      }
    } catch {
      // ignore
    }
  }, [code]);

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
    setErrorLine(null);
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
    const ins = inspectSource(code);
    setInspectData(ins);
    if (ins.error?.line) {
      setErrorLine(ins.error.line);
    }

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
            setErrorLine(err.line);
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
    <div className="flex flex-col w-full max-w-7xl mx-auto gap-3.5 select-text">
      {/* Top Navigation & App Header */}
      <header className="relative z-40 flex flex-wrap items-center justify-between gap-3 px-5 py-3 rounded-2xl border border-[#e5e5df] bg-[#fbfbfa]/95 shadow-md text-[#0f172a] backdrop-blur-md dark:border-neutral-800 dark:bg-[#0d0f12]/95 dark:text-white transition-colors">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#ede9fe] border border-[#ddd6fe] text-[#5b45ff] dark:bg-purple-500/10 dark:border-purple-500/30 dark:text-purple-400">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-[#0f172a] dark:text-white font-mono">
                Pseudocode Compiler
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[#edeef0] border border-[#e2e2dc] text-[#475569] dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300 text-[10px] font-mono">
                v1.0
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#64748b] dark:text-neutral-400 font-mono">
              <span className="text-[#16a34a] dark:text-emerald-400 flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] dark:bg-emerald-400 inline-block" />
                client engine online
              </span>
            </div>
          </div>
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

      {/* TOP PANE: Structured Code Editor with VS Code Syntax Highlighting */}
      <section className="w-full h-[330px] min-h-[260px] relative z-10">
        <PseudocodeEditor
          code={code}
          onChange={setCode}
          onRun={runCode}
          isRunning={isRunning}
          onStop={stopExecution}
          errorLine={errorLine}
          onKeyDownSound={soundDown}
          onKeyUpSound={soundUp}
          onLoadExample={handleLoadExample}
          lastExecutionMs={lastExecutionMs}
        />
      </section>

      {/* BOTTOM PANE: Split Dual-Card Layout (RESULTS + NOTES) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 h-[360px] min-h-[280px] w-full">
        {/* Left 7 Columns: RESULTS (Console Terminal & Kamus Symbol Table with Sparkbars) */}
        <div className="lg:col-span-7 h-full min-h-0">
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
          />
        </div>

        {/* Right 5 Columns: NOTES (Diagnostics & Analysis) */}
        <div className="lg:col-span-5 h-full min-h-0">
          <DiagnosticsNotes
            code={code}
            inspectData={inspectData}
            onOpenCheatsheet={() => setIsCheatsheetOpen(true)}
            onClearConsole={() => setEntries([])}
          />
        </div>
      </section>

      {/* Cheatsheet Modal */}
      <SyntaxCheatsheetModal
        isOpen={isCheatsheetOpen}
        onClose={() => setIsCheatsheetOpen(false)}
        onInsertCode={(snippet) => setCode(snippet)}
      />
    </div>
  );
}
