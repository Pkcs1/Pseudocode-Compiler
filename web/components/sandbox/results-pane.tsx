"use client";

import React, { useRef, useEffect, useState } from "react";
import {
  Terminal as TerminalIcon,
  TableProperties,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InspectResult } from "@/lib/runner";
import { VariableSnapshot } from "@/lib/engine";

export interface TerminalEntry {
  id: string;
  type: "command" | "stdout" | "input-echo" | "error" | "system" | "exit";
  text?: string;
  error?: {
    category: string;
    message: string;
    line: number;
    col: number;
    formatted: string;
  };
  durationMs?: number;
  code?: number;
}

interface ResultsPaneProps {
  entries: TerminalEntry[];
  isRunning: boolean;
  isWaitingInput: boolean;
  onSendInput: (val: string) => void;
  onClear: () => void;
  inspectData: InspectResult | null;
  variableSnapshot?: VariableSnapshot | null;
  lastExecutionMs?: number | null;
  onKeyDownSound?: (key: string) => void;
  onKeyUpSound?: (key: string) => void;
}

export function ResultsPane({
  entries,
  isRunning,
  isWaitingInput,
  onSendInput,
  onClear,
  inspectData,
  variableSnapshot,
  lastExecutionMs,
  onKeyDownSound,
  onKeyUpSound,
}: ResultsPaneProps) {
  const [activeTab, setActiveTab] = useState<"console" | "kamus">("console");
  const [inlineInput, setInlineInput] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-focus input when waiting for input
  useEffect(() => {
    if (isWaitingInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isWaitingInput]);

  // Auto-scroll terminal on new entries
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [entries, isWaitingInput]);

  const handleInlineSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isWaitingInput) return;
    const val = inlineInput;
    setInlineInput("");
    onSendInput(val);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.repeat) return;
    onKeyDownSound?.(e.key);
    if (e.key === "Enter") {
      e.preventDefault();
      handleInlineSubmit();
    }
  };

  // Merge declared variables with runtime values
  const declaredVariables = inspectData?.kamus?.variables || {};
  const variableEntries = Object.entries(declaredVariables);
  const totalVars = variableEntries.length;

  // Find max numeric value for sparkline bar scaling
  let maxNumericValue = 1;
  if (variableSnapshot) {
    for (const item of Object.values(variableSnapshot)) {
      if (item.numericValue !== undefined && !Number.isNaN(item.numericValue)) {
        maxNumericValue = Math.max(maxNumericValue, Math.abs(item.numericValue));
      }
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 rounded-2xl border border-[#e4e4df] bg-[#ffffff] shadow-md dark:border-neutral-800 dark:bg-[#0d0f12] dark:shadow-xl overflow-hidden font-mono transition-colors">
      {/* Pane Header (Option 2 RESULTS bar) */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#e5e5df] bg-[#fbfbfa] dark:border-neutral-800/90 dark:bg-[#12151b] select-none">
        <div className="flex items-center gap-3">
          {/* Section Title */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-[#0f172a] dark:text-neutral-200 tracking-wider">
              RESULTS
            </span>
            <span className="text-[#cbd5e1] dark:text-neutral-600 text-xs">•</span>
            <span className="text-[11px] text-[#64748b] dark:text-neutral-400">
              {activeTab === "console"
                ? `${entries.length} baris log`
                : `${totalVars} variabel`}
            </span>
            {lastExecutionMs !== null && lastExecutionMs !== undefined && (
              <>
                <span className="text-[#cbd5e1] dark:text-neutral-600 text-xs">•</span>
                <span className="text-[10px] text-[#4f46e5] bg-[#ede9fe] border border-[#ddd6fe] dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20 px-1.5 py-0.5 rounded font-semibold">
                  {lastExecutionMs}ms
                </span>
              </>
            )}
          </div>

          {/* Tab Selector */}
          <div className="flex items-center p-0.5 rounded-lg bg-[#f1f1ee] border border-[#e2e2dc] dark:bg-neutral-950/80 dark:border-neutral-800 text-xs ml-2">
            <button
              type="button"
              onClick={() => setActiveTab("console")}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer",
                activeTab === "console"
                  ? "bg-[#ffffff] text-[#0f172a] shadow-xs dark:bg-neutral-800 dark:text-white"
                  : "text-[#64748b] hover:text-[#0f172a] dark:text-neutral-400 dark:hover:text-neutral-200"
              )}
            >
              <TerminalIcon className="w-3 h-3 text-[#16a34a] dark:text-emerald-400" />
              <span>Konsol</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("kamus")}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer",
                activeTab === "kamus"
                  ? "bg-[#ffffff] text-[#0f172a] shadow-xs dark:bg-neutral-800 dark:text-white"
                  : "text-[#64748b] hover:text-[#0f172a] dark:text-neutral-400 dark:hover:text-neutral-200"
              )}
            >
              <TableProperties className="w-3 h-3 text-[#5b45ff] dark:text-purple-400" />
              <span>Tabel Kamus</span>
            </button>
          </div>
        </div>

        {/* Right side status badge & clear button */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30 font-medium">
              <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-600 dark:text-amber-400" />
              <span>{isWaitingInput ? "Menunggu Input" : "Berjalan"}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-[#16a34a] dark:text-neutral-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] inline-block mr-0.5" />
              <span>Siap</span>
            </div>
          )}

          {activeTab === "console" && (
            <button
              type="button"
              onClick={onClear}
              title="Bersihkan log konsol"
              className="p-1 rounded-md text-[#64748b] hover:text-[#0f172a] hover:bg-[#edeef0] dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Pane Content */}
      <div className="relative flex-1 min-h-0 overflow-hidden text-xs bg-[#ffffff] dark:bg-transparent">
        {/* VIEW 1: TERMINAL CONSOLE */}
        {activeTab === "console" && (
          <div
            ref={scrollContainerRef}
            onClick={() => {
              if (isWaitingInput && inputRef.current) {
                inputRef.current.focus();
              }
            }}
            className="h-full min-h-0 overflow-y-auto p-4 space-y-2 select-text cursor-text"
          >
            {entries.length === 0 && !isRunning && (
              <div className="text-[#64748b] dark:text-neutral-500 text-xs py-4 flex items-center gap-2">
                <span className="text-[#16a34a] dark:text-emerald-400 font-bold">$</span>
                <span>Klik &quot;Jalankan&quot; atau tekan Ctrl+Enter untuk mengeksekusi program.</span>
              </div>
            )}

            {entries.map((entry) => {
              if (entry.type === "command") {
                return (
                  <div key={entry.id} className="flex items-center gap-2 text-[#0f172a] dark:text-neutral-300 py-0.5">
                    <span className="text-[#16a34a] dark:text-emerald-400 font-bold select-none">$</span>
                    <span className="text-[#4f46e5] dark:text-emerald-300/90 font-medium">{entry.text}</span>
                  </div>
                );
              }

              if (entry.type === "stdout") {
                return (
                  <div
                    key={entry.id}
                    className="text-[#0f172a] dark:text-neutral-100 whitespace-pre-wrap leading-relaxed selection:bg-[#ede9fe] dark:selection:bg-neutral-700"
                  >
                    {entry.text}
                  </div>
                );
              }

              if (entry.type === "input-echo") {
                return (
                  <div key={entry.id} className="flex items-center gap-2 text-[#4f46e5] dark:text-cyan-300 font-semibold py-0.5">
                    <span className="text-[#5b45ff] dark:text-cyan-400 select-none">&gt;</span>
                    <span>{entry.text}</span>
                  </div>
                );
              }

              if (entry.type === "system") {
                return (
                  <div key={entry.id} className="text-[#64748b] dark:text-neutral-500 italic py-0.5 text-[11px]">
                    {entry.text}
                  </div>
                );
              }

              if (entry.type === "error" && entry.error) {
                return (
                  <div
                    key={entry.id}
                    className="my-2 p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-950/20 dark:text-rose-200 space-y-1.5"
                  >
                    <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-semibold text-xs">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>[{entry.error.category.toUpperCase()}]</span>
                      <span className="text-[11px] text-rose-600 dark:text-rose-300/80">
                        Baris {entry.error.line}, Kolom {entry.error.col}
                      </span>
                    </div>
                    <div className="text-xs text-rose-950 dark:text-rose-100 whitespace-pre-wrap">
                      {entry.error.message}
                    </div>
                    {entry.error.formatted && (
                      <pre className="p-2 rounded-lg bg-[#ffffff] border border-rose-200 dark:bg-black/50 dark:border-rose-500/20 font-mono text-[11px] text-rose-800 dark:text-rose-300 overflow-x-auto whitespace-pre">
                        {entry.error.formatted}
                      </pre>
                    )}
                  </div>
                );
              }

              if (entry.type === "exit") {
                return (
                  <div
                    key={entry.id}
                    className="pt-1.5 text-[11px] text-[#16a34a] dark:text-neutral-400 flex items-center gap-1.5 font-medium"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a] dark:text-emerald-400" />
                    <span>
                      [Program selesai{entry.durationMs !== undefined ? ` dalam ${entry.durationMs}ms` : ""}]
                    </span>
                  </div>
                );
              }

              return null;
            })}

            {/* In-Console Input Prompt */}
            {isWaitingInput && (
              <form
                onSubmit={handleInlineSubmit}
                className="flex items-center gap-2 pt-1 pb-1 text-[#4f46e5] dark:text-cyan-300"
              >
                <span className="font-bold text-sm text-[#5b45ff] dark:text-cyan-400 select-none">&gt;</span>
                <div className="relative flex-1 flex items-center">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inlineInput}
                    onChange={(e) => setInlineInput(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    onKeyUp={(e) => onKeyUpSound?.(e.key)}
                    placeholder="Masukkan nilai..."
                    className="w-full bg-transparent border-none outline-none font-mono text-xs text-[#0f172a] dark:text-cyan-200 placeholder:text-[#94a3b8] dark:placeholder:text-neutral-600 focus:ring-0"
                  />
                  <span className="inline-block font-mono font-bold text-[#5b45ff] dark:text-cyan-400 text-sm animate-pulse ml-0.5 select-none">
                    _
                  </span>
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#5b45ff] text-white hover:bg-[#4f46e5] dark:bg-cyan-600/20 dark:border dark:border-cyan-500/40 dark:text-cyan-300 text-[10px] cursor-pointer"
                >
                  <span>Kirim</span>
                  <CornerDownLeft className="w-3 h-3" />
                </button>
              </form>
            )}

            {!isRunning && !isWaitingInput && entries.length > 0 && (
              <div className="flex items-center gap-1.5 text-[#64748b] dark:text-neutral-500 pt-1 font-mono text-xs select-none">
                <span className="text-[#16a34a] dark:text-emerald-400 font-bold">&gt;</span>
                <span className="inline-block font-mono font-bold text-[#16a34a] dark:text-emerald-400 text-sm animate-pulse">_</span>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: KAMUS & SIMBOL (Structured Table with Sparkbars like Image 2 RESULTS) */}
        {activeTab === "kamus" && (
          <div className="h-full min-h-0 overflow-y-auto p-3 flex flex-col justify-between">
            {totalVars === 0 ? (
              <div className="text-[#64748b] dark:text-neutral-500 text-center py-8">
                Tidak ada variabel yang dideklarasikan pada bagian Kamus.
              </div>
            ) : (
              <div className="border border-[#e4e4df] rounded-xl overflow-hidden bg-[#ffffff] dark:border-neutral-800 dark:bg-[#101217]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#f4f4f0] text-[#475569] border-b border-[#e4e4df] text-[11px] font-semibold dark:bg-[#141820] dark:text-neutral-400 dark:border-neutral-800">
                    <tr>
                      <th className="py-2 px-3">Variabel</th>
                      <th className="py-2 px-3">Tipe</th>
                      <th className="py-2 px-3">Nilai Runtime</th>
                      <th className="py-2 px-3">Visualisasi / Nilai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f1ee] dark:divide-neutral-800/60 font-mono text-xs">
                    {variableEntries.map(([name, type], idx) => {
                      const snapshotItem = variableSnapshot?.[name];
                      const valStr = snapshotItem?.value ?? "(belum dieksekusi)";
                      const numVal = snapshotItem?.numericValue;

                      // Highlight active row like row 2026-06 in reference image
                      const isHighlight = idx === 0 && valStr !== "(belum dieksekusi)";

                      // Calculate sparkbar percentage if numeric
                      const barPercent =
                        numVal !== undefined && !Number.isNaN(numVal) && maxNumericValue > 0
                          ? Math.min(100, Math.max(8, Math.round((Math.abs(numVal) / maxNumericValue) * 100)))
                          : 0;

                      return (
                        <tr
                          key={name}
                          className={cn(
                            "transition-colors",
                            isHighlight
                              ? "bg-[#ede9fe]/50 text-[#4f46e5] font-semibold dark:bg-purple-950/20"
                              : "hover:bg-[#fbfbfa] dark:hover:bg-neutral-800/25"
                          )}
                        >
                          {/* Variable Name */}
                          <td className="py-2 px-3 text-[#0f172a] dark:text-[#9cdcfe] font-medium">{name}</td>

                          {/* Data Type */}
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#ede9fe] text-[#4f46e5] border border-[#ddd6fe] dark:bg-purple-500/15 dark:border-purple-500/25 dark:text-[#4ec9b0]">
                              {type}
                            </span>
                          </td>

                          {/* Runtime Value */}
                          <td className="py-2 px-3 text-[#0f172a] dark:text-neutral-200">
                            {valStr === "true" ? (
                              <span className="text-[#16a34a] font-semibold">true</span>
                            ) : valStr === "false" ? (
                              <span className="text-rose-600 font-semibold">false</span>
                            ) : valStr === "(belum diisi)" ? (
                              <span className="text-[#94a3b8] italic text-[11px]">(belum diisi)</span>
                            ) : (
                              <span>{valStr}</span>
                            )}
                          </td>

                          {/* Visual sparkbar (like Image 2 RESULTS sparklines) */}
                          <td className="py-2 px-3">
                            {numVal !== undefined && !Number.isNaN(numVal) ? (
                              <div className="flex items-center gap-2">
                                <div className="h-2.5 rounded-sm bg-[#e2e8f0] dark:bg-neutral-800 overflow-hidden w-24 flex items-center">
                                  <div
                                    className={cn(
                                      "h-full rounded-sm transition-all duration-300",
                                      isHighlight
                                        ? "bg-[#5b45ff]"
                                        : "bg-[#94a3b8] dark:bg-purple-500/80"
                                    )}
                                    style={{ width: `${barPercent}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-[#64748b] dark:text-neutral-400">{numVal}</span>
                              </div>
                            ) : valStr === "true" || valStr === "false" ? (
                              <span
                                className={cn(
                                  "inline-block w-2.5 h-2.5 rounded-full",
                                  valStr === "true" ? "bg-[#16a34a]" : "bg-rose-500"
                                )}
                              />
                            ) : (
                              <span className="text-[#94a3b8] text-[10px]">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary Footer Row (like Image 2: avg Jan-May 32.1% ... Δ +10.3 pts) */}
            <div className="mt-3 pt-2.5 border-t border-[#e5e5df] dark:border-neutral-800/80 text-[11px] text-[#64748b] dark:text-neutral-400 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span>
                  Total Kamus: <strong className="text-[#0f172a] dark:text-neutral-200">{totalVars} variabel</strong>
                </span>
                <span className="text-[#cbd5e1] dark:text-neutral-700">•</span>
                <span>
                  Konstanta:{" "}
                  <strong className="text-[#0f172a] dark:text-neutral-200">
                    {inspectData?.kamus?.constants?.length || 0}
                  </strong>
                </span>
              </div>
              <div className="text-[#16a34a] font-semibold flex items-center gap-1">
                <span>✓ Simbol terverifikasi</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
