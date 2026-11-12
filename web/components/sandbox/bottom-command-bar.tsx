"use client";

import React, { useState, useRef, useEffect } from "react";
import { CornerDownLeft, Terminal, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomCommandBarProps {
  isRunning: boolean;
  isWaitingInput: boolean;
  onSendInput: (val: string) => void;
  onRun: () => void;
  onClear: () => void;
  onOpenCheatsheet: () => void;
  onLoadExample: (name: string) => void;
  onKeyDownSound?: (key: string) => void;
  onKeyUpSound?: (key: string) => void;
}

export function BottomCommandBar({
  isRunning,
  isWaitingInput,
  onSendInput,
  onRun,
  onClear,
  onOpenCheatsheet,
  onLoadExample,
  onKeyDownSound,
  onKeyUpSound,
}: BottomCommandBarProps) {
  const [commandText, setCommandText] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Automatically focus whenever input is required by program
  useEffect(() => {
    if (isWaitingInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isWaitingInput]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = commandText.trim();

    if (isWaitingInput) {
      onSendInput(commandText);
      setCommandText("");
      return;
    }

    // Process slash commands when idle
    if (trimmed.startsWith("/")) {
      const cmd = trimmed.toLowerCase();
      if (cmd === "/run" || cmd === "/jalankan") {
        onRun();
      } else if (cmd === "/clear" || cmd === "/bersihkan") {
        onClear();
      } else if (cmd === "/sintaks" || cmd === "/panduan") {
        onOpenCheatsheet();
      } else if (cmd === "/warung") {
        onLoadExample("warung");
      } else if (cmd === "/rata") {
        onLoadExample("rata");
      } else if (cmd === "/tes") {
        onLoadExample("tes");
      }
      setCommandText("");
      return;
    }

    if (trimmed && !isRunning) {
      onRun();
      setCommandText("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!e.repeat) {
      onKeyDownSound?.(e.key);
    }
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full rounded-2xl border border-neutral-800 bg-[#0d0f12] shadow-xl overflow-hidden font-mono text-xs transition-colors">
      {/* Active input row */}
      <form
        onSubmit={handleSubmit}
        className={cn(
          "flex items-center gap-3 px-4 py-3 transition-colors",
          isWaitingInput
            ? "bg-cyan-950/20 border-b border-cyan-500/20"
            : "bg-[#11141a] border-b border-neutral-800/80"
        )}
      >
        {/* Prompt label */}
        <div className="flex items-center gap-1.5 shrink-0 select-none">
          {isWaitingInput ? (
            <span className="font-bold text-cyan-400 flex items-center gap-1">
              <span>program=&gt;</span>
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            </span>
          ) : (
            <span className="font-semibold text-emerald-400 flex items-center gap-1">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>pseudo=&gt;</span>
            </span>
          )}
        </div>

        {/* Input box */}
        <input
          ref={inputRef}
          type="text"
          value={commandText}
          onChange={(e) => setCommandText(e.target.value)}
          onKeyDown={handleKeyDown}
          onKeyUp={(e) => onKeyUpSound?.(e.key)}
          placeholder={
            isWaitingInput
              ? "Masukkan nilai input program di sini (tekan Enter untuk kirim)..."
              : "Ketik perintah (/run, /warung, /sintaks, /clear) atau masukkan argumen..."
          }
          className={cn(
            "flex-1 bg-transparent border-none outline-none font-mono text-xs focus:ring-0 placeholder:text-neutral-600 transition-colors",
            isWaitingInput ? "text-cyan-200" : "text-neutral-200"
          )}
        />

        {/* Action Button */}
        {isWaitingInput ? (
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-[11px] shadow-sm transition-all cursor-pointer shrink-0"
          >
            <span>Kirim</span>
            <CornerDownLeft className="w-3 h-3" />
          </button>
        ) : (
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white font-medium text-[11px] transition-all cursor-pointer shrink-0 border border-neutral-700"
          >
            <span>Jalankan</span>
            <Send className="w-3 h-3 text-emerald-400" />
          </button>
        )}
      </form>

      {/* Shortcut bar footer (like Image 2 bottom shortcut row) */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-[#090b0e] text-[10px] text-neutral-500 select-none gap-2">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onRun}
            className="hover:text-neutral-300 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span className="text-emerald-400 font-semibold">/run</span>
            <span>Jalankan</span>
          </button>
          <button
            type="button"
            onClick={onOpenCheatsheet}
            className="hover:text-neutral-300 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span className="text-sky-400 font-semibold">/sintaks</span>
            <span>Panduan</span>
          </button>
          <button
            type="button"
            onClick={() => onLoadExample("warung")}
            className="hover:text-neutral-300 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span className="text-purple-400 font-semibold">/warung</span>
            <span>Contoh 1</span>
          </button>
          <button
            type="button"
            onClick={() => onLoadExample("rata")}
            className="hover:text-neutral-300 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span className="text-purple-400 font-semibold">/rata</span>
            <span>Contoh 2</span>
          </button>
          <button
            type="button"
            onClick={onClear}
            className="hover:text-neutral-300 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span className="text-rose-400 font-semibold">/clear</span>
            <span>Bersihkan</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-neutral-500">
          <kbd className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-[9px] text-neutral-400">
            Ctrl + Enter
          </kbd>
          <span>Jalankan</span>
        </div>
      </div>
    </div>
  );
}
