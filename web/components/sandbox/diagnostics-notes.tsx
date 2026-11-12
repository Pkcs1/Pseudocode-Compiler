"use client";

import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  BookOpen,
  Trash2,
  FileCode2,
} from "lucide-react";
import { InspectResult } from "@/lib/runner";

interface DiagnosticsNotesProps {
  code: string;
  inspectData: InspectResult | null;
  onLoadExample: (name: string) => void;
  onOpenCheatsheet: () => void;
  onClearConsole: () => void;
}

export function DiagnosticsNotes({
  code,
  inspectData,
  onLoadExample,
  onOpenCheatsheet,
  onClearConsole,
}: DiagnosticsNotesProps) {
  const lineCount = code ? code.split("\n").length : 0;
  const tokenCount = inspectData?.tokens?.length || 0;
  const hasError = !!inspectData?.error;

  // Feature detection from source
  const lowerCode = code.toLowerCase();
  const hasForLoop = /\bfor\b/.test(lowerCode);
  const hasWhileLoop = /\bwhile\b/.test(lowerCode);
  const hasRepeat = /\brepeat\b/.test(lowerCode);
  const hasIf = /\bif\b/.test(lowerCode);
  const hasStruct = /\btype\b/.test(lowerCode) && /</.test(lowerCode);
  const hasIO = /\b(input|output|read|write)\b/.test(lowerCode);

  return (
    <div className="flex flex-col h-full min-h-0 rounded-2xl border border-neutral-800 bg-[#0d0f12] shadow-xl overflow-hidden font-mono transition-colors">
      {/* Pane Header (Option 2 NOTES & NEXT style) */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800/90 bg-[#12151b] select-none">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs text-neutral-200 tracking-wider">
            NOTES &amp; NEXT
          </span>
          <span className="text-neutral-600 text-xs">•</span>
          <span className="text-[11px] text-neutral-400">Diagnostik Compiler</span>
        </div>

        <div>
          {hasError ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-rose-500/10 border border-rose-500/30 text-rose-300">
              <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
              <span>Perlu Perbaikan</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
              <span>Sintaks Valid</span>
            </span>
          )}
        </div>
      </div>

      {/* Body: Split into NOTES and NEXT (just like Image 2) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col justify-between gap-4 text-xs">
        {/* 1. NOTES SECTION */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-neutral-400 uppercase tracking-wider text-[11px] font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>NOTES</span>
          </div>

          {/* Diagnostic status card */}
          {hasError && inspectData?.error ? (
            <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-950/20 text-rose-200 space-y-1">
              <div className="flex items-center justify-between font-semibold text-[11px] text-rose-400">
                <span>[{inspectData.error.category.toUpperCase()}]</span>
                <span>Baris {inspectData.error.line}, Kol {inspectData.error.col}</span>
              </div>
              <p className="text-xs text-rose-100 leading-relaxed">
                {inspectData.error.message}
              </p>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Semantik valid. Semua variabel di Algoritma telah dideklarasikan di Kamus.</span>
            </div>
          )}

          {/* Analysis bullet points (like Image 2 bullet notes) */}
          <ul className="space-y-1.5 text-[11px] text-neutral-400 leading-relaxed list-none pl-1">
            <li className="flex items-start gap-2">
              <span className="text-neutral-500 select-none">•</span>
              <span>
                Total <strong className="text-neutral-200">{lineCount} baris</strong> dan{" "}
                <strong className="text-neutral-200">{tokenCount} token</strong> terurai oleh lexer.
              </span>
            </li>

            {(hasForLoop || hasWhileLoop || hasRepeat) && (
              <li className="flex items-start gap-2">
                <span className="text-neutral-500 select-none">•</span>
                <span>
                  Perulangan aktif:{" "}
                  <strong className="text-purple-300">
                    {[
                      hasForLoop && "for-to-do",
                      hasWhileLoop && "while-do",
                      hasRepeat && "repeat-until",
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </strong>
                  .
                </span>
              </li>
            )}

            {hasIf && (
              <li className="flex items-start gap-2">
                <span className="text-neutral-500 select-none">•</span>
                <span>
                  Percabangan terdeteksi:{" "}
                  <strong className="text-sky-300">if-then-else-endif</strong>.
                </span>
              </li>
            )}

            {hasStruct && (
              <li className="flex items-start gap-2">
                <span className="text-neutral-500 select-none">•</span>
                <span>
                  Tipe bentukan rekaman (struct) multi-field terdeteksi.
                </span>
              </li>
            )}

            {hasIO && (
              <li className="flex items-start gap-2">
                <span className="text-neutral-500 select-none">•</span>
                <span>
                  Operasi I/O terminal aktif via instruksi <code>input()</code> atau <code>output()</code>.
                </span>
              </li>
            )}
          </ul>
        </div>

        {/* 2. NEXT SECTION (Numbered Quick Actions, like Image 2 NEXT) */}
        <div className="pt-3 border-t border-neutral-800/80 space-y-2">
          <div className="flex items-center gap-1.5 text-neutral-400 uppercase tracking-wider text-[11px] font-semibold">
            <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
            <span>NEXT / TINDAKAN CEPAT</span>
          </div>

          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => onLoadExample("warung")}
              className="w-full text-left px-2.5 py-1.5 rounded-lg border border-neutral-800/80 bg-neutral-900/60 hover:bg-neutral-800/90 text-neutral-300 hover:text-white transition-all flex items-center gap-2 group cursor-pointer text-[11px]"
            >
              <span className="w-4 h-4 rounded bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-[10px] shrink-0 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                1
              </span>
              <span className="flex-1 truncate">Muat Kasus Warung (Hitung Diskon)</span>
              <FileCode2 className="w-3 h-3 text-neutral-500 group-hover:text-purple-400" />
            </button>

            <button
              type="button"
              onClick={() => onLoadExample("rata")}
              className="w-full text-left px-2.5 py-1.5 rounded-lg border border-neutral-800/80 bg-neutral-900/60 hover:bg-neutral-800/90 text-neutral-300 hover:text-white transition-all flex items-center gap-2 group cursor-pointer text-[11px]"
            >
              <span className="w-4 h-4 rounded bg-sky-500/20 text-sky-300 font-bold flex items-center justify-center text-[10px] shrink-0 group-hover:bg-sky-500 group-hover:text-white transition-colors">
                2
              </span>
              <span className="flex-1 truncate">Muat Rata-Rata (Perulangan For)</span>
              <FileCode2 className="w-3 h-3 text-neutral-500 group-hover:text-sky-400" />
            </button>

            <button
              type="button"
              onClick={() => onLoadExample("tes")}
              className="w-full text-left px-2.5 py-1.5 rounded-lg border border-neutral-800/80 bg-neutral-900/60 hover:bg-neutral-800/90 text-neutral-300 hover:text-white transition-all flex items-center gap-2 group cursor-pointer text-[11px]"
            >
              <span className="w-4 h-4 rounded bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center text-[10px] shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                3
              </span>
              <span className="flex-1 truncate">Muat Percabangan (If - Else)</span>
              <FileCode2 className="w-3 h-3 text-neutral-500 group-hover:text-emerald-400" />
            </button>

            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={onOpenCheatsheet}
                className="flex-1 px-2 py-1 rounded-md border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors text-[10px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <BookOpen className="w-3 h-3 text-amber-400" />
                <span>Panduan Sintaks</span>
              </button>

              <button
                type="button"
                onClick={onClearConsole}
                className="px-2 py-1 rounded-md border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors text-[10px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Bersihkan</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
