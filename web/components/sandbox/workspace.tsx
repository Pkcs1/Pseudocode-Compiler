"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Square,
  BookOpen,
  Code,
} from "lucide-react";
import { PseudocodeEditor } from "./pseudocode-editor";
import { InteractiveTerminal, TerminalEntry } from "./interactive-terminal";
import { SyntaxCheatsheetModal } from "./syntax-cheatsheet-modal";
import { ThemeToggle } from "./theme-toggle";
import { SoundVolumeControl } from "./sound-volume-control";
import { InspectResult } from "@/lib/runner";
import { useAudioSprite } from "@/lib/use-audio";
import { inspectSource, executePseudocode, ExecutionHandle } from "@/lib/engine";

export function Workspace() {
  const [code, setCode] = useState<string>("");
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isWaitingInput, setIsWaitingInput] = useState<boolean>(false);
  const [inspectData, setInspectData] = useState<InspectResult | null>(null);
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

  // Immediate in-browser inspection on code changes
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
        text: "[Eksekusi program dihentikan]",
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
        onError: (err, durationMs) => {
          setIsWaitingInput(false);
          setIsRunning(false);
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
        onExit: (codeNum, durationMs) => {
          setIsWaitingInput(false);
          setIsRunning(false);
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

  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto gap-4">
      {/* Top Navigation & Action Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-3 rounded-2xl border border-neutral-800 bg-neutral-900/90 shadow-md backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Code className="w-5 h-5" />
          </div>
          <span className="font-bold text-base tracking-tight text-white">
            Pseudocode Compiler
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Run / Stop Button */}
          {isRunning ? (
            <button
              type="button"
              onClick={stopExecution}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-medium text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Hentikan</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={runCode}
              title="Jalankan pseudocode (Ctrl + Enter)"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-medium text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer"
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700/80 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-medium transition-all cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Sintaks</span>
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

      {/* Main Dual-Terminal Split */}
      <main className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[600px] max-h-[75vh] w-full min-h-0">
        {/* Left: Pseudocode Editor Terminal */}
        <PseudocodeEditor
          code={code}
          onChange={setCode}
          onRun={runCode}
          errorLine={errorLine}
          onKeyDownSound={soundDown}
          onKeyUpSound={soundUp}
        />

        {/* Right: Interactive Terminal Sandbox with in-terminal input & tabs */}
        <InteractiveTerminal
          entries={entries}
          isRunning={isRunning}
          isWaitingInput={isWaitingInput}
          onSendInput={handleSendInput}
          onClear={() => setEntries([])}
          inspectData={inspectData}
          onKeyDownSound={soundDown}
          onKeyUpSound={soundUp}
        />
      </main>

      {/* Cheatsheet Modal */}
      <SyntaxCheatsheetModal
        isOpen={isCheatsheetOpen}
        onClose={() => setIsCheatsheetOpen(false)}
        onInsertCode={(snippet) => setCode(snippet)}
      />
    </div>
  );
}
