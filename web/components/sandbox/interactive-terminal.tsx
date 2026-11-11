"use client";

import React, { useRef, useEffect, useState } from "react";
import {
  Terminal as TerminalIcon,
  Trash2,
  TableProperties,
  Layers,
  AlertCircle,
  CheckCircle2,
  Loader2,
  CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InspectResult } from "@/lib/runner";

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

interface InteractiveTerminalProps {
  entries: TerminalEntry[];
  isRunning: boolean;
  isWaitingInput: boolean;
  onSendInput: (val: string) => void;
  onClear: () => void;
  inspectData: InspectResult | null;
  onKeyDownSound?: (key: string) => void;
  onKeyUpSound?: (key: string) => void;
}

export function InteractiveTerminal({
  entries,
  isRunning,
  isWaitingInput,
  onSendInput,
  onClear,
  inspectData,
  onKeyDownSound,
  onKeyUpSound,
}: InteractiveTerminalProps) {
  const [activeTab, setActiveTab] = useState<"console" | "kamus" | "ast">("console");
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Focus input automatically whenever waiting for input
  useEffect(() => {
    if (isWaitingInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isWaitingInput]);

  // Auto-scroll to bottom as output streams or prompt appears
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [entries, isWaitingInput]);

  const handleSubmitInput = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isWaitingInput) return;
    const val = inputValue;
    setInputValue("");
    onSendInput(val);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDownSound?.(e.key);
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmitInput();
    }
  };

  return (
    <div className="flex flex-col h-full rounded-xl border border-neutral-800 bg-neutral-900 shadow-xl overflow-hidden transition-colors dark:border-neutral-800 dark:bg-neutral-950">
      {/* Terminal Title Bar & Tabs */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800/80 bg-neutral-900/90 select-none">
        <div className="flex items-center gap-3">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5 mr-1">
            <span className="w-3 h-3 rounded-full bg-red-500/80 border border-red-600/40 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-600/40 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-600/40 inline-block" />
          </div>

          {/* Tab Selector */}
          <div className="flex items-center p-0.5 rounded-lg bg-neutral-950/70 border border-neutral-800/80 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("console")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all cursor-pointer",
                activeTab === "console"
                  ? "bg-neutral-800 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              )}
            >
              <TerminalIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span>Console</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("kamus")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all cursor-pointer",
                activeTab === "kamus"
                  ? "bg-neutral-800 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              )}
            >
              <TableProperties className="w-3.5 h-3.5 text-sky-400" />
              <span>Kamus & Simbol</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("ast")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all cursor-pointer",
                activeTab === "ast"
                  ? "bg-neutral-800 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              )}
            >
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Tokens & AST</span>
            </button>
          </div>
        </div>

        {/* Right side status & clear button */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30">
              <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
              <span>{isWaitingInput ? "Menunggu Masukan..." : "Sedang Berjalan"}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono text-neutral-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500/80 inline-block mr-1" />
              <span>Siap</span>
            </div>
          )}

          {activeTab === "console" && (
            <button
              type="button"
              onClick={onClear}
              title="Bersihkan layar konsol"
              className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="relative flex-1 overflow-hidden font-mono text-xs">
        {/* TAB 1: CONSOLE */}
        {activeTab === "console" && (
          <div
            ref={scrollContainerRef}
            onClick={() => {
              if (isWaitingInput && inputRef.current) {
                inputRef.current.focus();
              }
            }}
            className="h-full overflow-y-auto p-4 space-y-2 select-text cursor-text"
          >
            {/* Initial banner */}
            <div className="pb-3 border-b border-neutral-800/60 text-neutral-500 space-y-1">
              <div className="text-emerald-400 font-semibold text-xs tracking-wide">
                Telkom University Alpro 1 Interactive Terminal Sandbox
              </div>
              <div className="text-[11px] text-neutral-400">
                Ketik masukan langsung di baris terminal ketika program meminta input().
              </div>
            </div>

            {/* Output entries stream */}
            {entries.map((entry) => {
              if (entry.type === "command") {
                return (
                  <div key={entry.id} className="flex items-center gap-2 text-neutral-300 py-1">
                    <span className="text-emerald-400 font-bold select-none">$</span>
                    <span>{entry.text}</span>
                  </div>
                );
              }

              if (entry.type === "stdout") {
                return (
                  <div
                    key={entry.id}
                    className="text-zinc-100 whitespace-pre-wrap leading-relaxed"
                  >
                    {entry.text}
                  </div>
                );
              }

              if (entry.type === "input-echo") {
                return (
                  <div key={entry.id} className="flex items-center gap-2 text-cyan-300 font-semibold py-0.5">
                    <span className="text-cyan-400 select-none">&gt;</span>
                    <span>{entry.text}</span>
                  </div>
                );
              }

              if (entry.type === "system") {
                return (
                  <div key={entry.id} className="text-neutral-500 italic py-0.5">
                    {entry.text}
                  </div>
                );
              }

              if (entry.type === "error" && entry.error) {
                return (
                  <div
                    key={entry.id}
                    className="my-3 p-3.5 rounded-lg border border-rose-500/40 bg-rose-950/30 text-rose-200 space-y-2"
                  >
                    <div className="flex items-center gap-2 text-rose-400 font-semibold">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>[{entry.error.category.toUpperCase()}]</span>
                      <span className="text-xs text-rose-300/80">
                        Baris {entry.error.line}, Kolom {entry.error.col}
                      </span>
                    </div>
                    <div className="text-xs text-rose-100 whitespace-pre-wrap">
                      {entry.error.message}
                    </div>
                    {entry.error.formatted && (
                      <pre className="p-2.5 rounded bg-black/50 border border-rose-500/20 font-mono text-xs text-rose-300 overflow-x-auto whitespace-pre">
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
                    className="pt-2 text-[11px] text-neutral-500 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>
                      [Program selesai dijalankan {entry.durationMs !== undefined ? `dalam ${entry.durationMs}ms` : ""}]
                    </span>
                  </div>
                );
              }

              return null;
            })}

            {/* IN-TERMINAL ACTIVE INPUT PROMPT */}
            {isWaitingInput && (
              <form
                onSubmit={handleSubmitInput}
                className="flex items-center gap-2 pt-1 pb-2 text-cyan-300"
              >
                <span className="font-bold text-sm text-cyan-400 select-none animate-pulse">
                  &gt;
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  onKeyUp={(e) => onKeyUpSound?.(e.key)}
                  placeholder="Ketik input lalu tekan Enter..."
                  className="flex-1 bg-transparent border-none outline-none font-mono text-xs text-cyan-200 placeholder:text-neutral-600 focus:ring-0"
                />
                <button
                  type="submit"
                  title="Kirim masukan (Enter)"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 text-[10px] hover:bg-cyan-600/30 cursor-pointer"
                >
                  <span>Kirim</span>
                  <CornerDownLeft className="w-3 h-3" />
                </button>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: KAMUS & SIMBOL */}
        {activeTab === "kamus" && (
          <div className="h-full overflow-y-auto p-4 space-y-4">
            {!inspectData ? (
              <div className="text-neutral-500 text-center py-8">
                Klik &quot;Jalankan&quot; atau tunggu parsing kode untuk melihat tabel kamus.
              </div>
            ) : (
              <>
                {/* Variabel */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-emerald-400 text-xs uppercase tracking-wider">
                    Variabel Terdaftar ({Object.keys(inspectData.kamus.variables || {}).length})
                  </h3>
                  {Object.keys(inspectData.kamus.variables || {}).length === 0 ? (
                    <div className="text-neutral-500 italic text-[11px]">
                      Tidak ada variabel dideklarasikan
                    </div>
                  ) : (
                    <div className="border border-neutral-800 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-neutral-950/80 text-neutral-400 border-b border-neutral-800">
                          <tr>
                            <th className="py-2 px-3 font-medium">Nama Variabel</th>
                            <th className="py-2 px-3 font-medium">Tipe Data</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/60 bg-neutral-900/40">
                          {Object.entries(inspectData.kamus.variables).map(([name, type]) => (
                            <tr key={name} className="hover:bg-neutral-800/30">
                              <td className="py-1.5 px-3 font-mono text-cyan-300">{name}</td>
                              <td className="py-1.5 px-3 font-mono text-purple-300">{type}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Konstanta */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-amber-400 text-xs uppercase tracking-wider">
                    Konstanta ({inspectData.kamus.constants?.length || 0})
                  </h3>
                  {!inspectData.kamus.constants?.length ? (
                    <div className="text-neutral-500 italic text-[11px]">
                      Tidak ada konstanta
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {inspectData.kamus.constants.map((c) => (
                        <span
                          key={c}
                          className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs"
                        >
                          constant {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Structs */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-sky-400 text-xs uppercase tracking-wider">
                    Tipe Bentukan (Struct) ({Object.keys(inspectData.kamus.structs || {}).length})
                  </h3>
                  {Object.keys(inspectData.kamus.structs || {}).length === 0 ? (
                    <div className="text-neutral-500 italic text-[11px]">
                      Tidak ada struct dideklarasikan
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(inspectData.kamus.structs).map(([stName, fields]) => (
                        <div
                          key={stName}
                          className="p-3 rounded-lg border border-neutral-800 bg-neutral-950/60"
                        >
                          <div className="font-mono font-semibold text-sky-300 mb-1.5">
                            type {stName} : &lt; ... &gt;
                          </div>
                          <div className="pl-3 border-l-2 border-neutral-800 space-y-1">
                            {Object.entries(fields).map(([fname, ftype]) => (
                              <div key={fname} className="text-neutral-300 font-mono text-[11px]">
                                <span className="text-neutral-400">{fname}</span> :{" "}
                                <span className="text-purple-400">{ftype}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Aliases */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-rose-400 text-xs uppercase tracking-wider">
                    Alias Tipe ({Object.keys(inspectData.kamus.aliases || {}).length})
                  </h3>
                  {Object.keys(inspectData.kamus.aliases || {}).length === 0 ? (
                    <div className="text-neutral-500 italic text-[11px]">
                      Tidak ada alias tipe
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(inspectData.kamus.aliases).map(([name, target]) => (
                        <span
                          key={name}
                          className="px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 font-mono text-xs"
                        >
                          type {name} : {target}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: TOKENS & AST */}
        {activeTab === "ast" && (
          <div className="h-full overflow-y-auto p-4 space-y-4">
            {!inspectData ? (
              <div className="text-neutral-500 text-center py-8">
                Data AST & Tokens belum tersedia.
              </div>
            ) : (
              <>
                {/* Tokens Stream */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-emerald-400 text-xs uppercase tracking-wider">
                    Aliran Token Lexer ({inspectData.tokens?.length || 0})
                  </h3>
                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 rounded-lg bg-neutral-950/60 border border-neutral-800">
                    {inspectData.tokens?.map((tok, i) => (
                      <span
                        key={i}
                        title={`Line ${tok.line}, Col ${tok.col}`}
                        className="px-1.5 py-0.5 rounded bg-neutral-800/80 border border-neutral-700/60 font-mono text-[11px] text-neutral-300"
                      >
                        <span className="text-emerald-400 font-bold">{tok.type}</span>
                        {tok.value && tok.value !== tok.type && (
                          <span className="text-neutral-400 ml-1">({tok.value})</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                {/* AST Tree */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-purple-400 text-xs uppercase tracking-wider">
                    Pohon Sintaks Abstrak (AST JSON)
                  </h3>
                  <pre className="p-3 rounded-lg bg-neutral-950/80 border border-neutral-800 font-mono text-xs text-purple-300/90 overflow-x-auto max-h-80 whitespace-pre">
                    {inspectData.ast
                      ? JSON.stringify(inspectData.ast, null, 2)
                      : "Pohon AST kosong atau terjadi kesalahan sintaks"}
                  </pre>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
