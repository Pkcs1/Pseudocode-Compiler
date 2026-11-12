"use client";

import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  BookOpen,
  Trash2,
} from "lucide-react";
import { InspectResult } from "@/lib/runner";

interface DiagnosticsNotesProps {
  code: string;
  inspectData: InspectResult | null;
  onOpenCheatsheet: () => void;
  onClearConsole: () => void;
}

export function DiagnosticsNotes({
  code,
  inspectData,
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
    <div className="flex flex-col h-full min-h-0 rounded-2xl border border-[#e4e4df] bg-[#ffffff] shadow-md dark:border-neutral-800 dark:bg-[#0d0f12] dark:shadow-xl overflow-hidden font-mono transition-colors">
      {/* Pane Header (Option 2 NOTES style) */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#e5e5df] bg-[#fbfbfa] dark:border-neutral-800/90 dark:bg-[#12151b] select-none">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs text-[#0f172a] dark:text-neutral-200 tracking-wider">
            NOTES
          </span>
          <span className="text-[#cbd5e1] dark:text-neutral-600 text-xs">•</span>
          <span className="text-[11px] text-[#64748b] dark:text-neutral-400">Diagnostik Compiler</span>
        </div>

        <div>
          {hasError ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300 font-semibold">
              <AlertTriangle className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />
              <span>Perlu Perbaikan</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-[#16a34a] border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300 font-semibold">
              <CheckCircle2 className="w-2.5 h-2.5 text-[#16a34a] dark:text-emerald-400" />
              <span>Sintaks Valid</span>
            </span>
          )}
        </div>
      </div>

      {/* Body: NOTES & Compiler Diagnostics */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col justify-between gap-4 text-xs bg-[#ffffff] dark:bg-transparent">
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-[#64748b] dark:text-neutral-400 uppercase tracking-wider text-[11px] font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-[#5b45ff] dark:text-amber-400" />
            <span>CATATAN &amp; DIAGNOSTIK</span>
          </div>

          {/* Diagnostic status card */}
          {hasError && inspectData?.error ? (
            <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-950/20 dark:text-rose-200 space-y-1">
              <div className="flex items-center justify-between font-semibold text-[11px] text-rose-700 dark:text-rose-400">
                <span>[{inspectData.error.category.toUpperCase()}]</span>
                <span>Baris {inspectData.error.line}, Kol {inspectData.error.col}</span>
              </div>
              <p className="text-xs text-rose-950 dark:text-rose-100 leading-relaxed">
                {inspectData.error.message}
              </p>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/20 dark:text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#16a34a] dark:text-emerald-400 shrink-0" />
              <span>Semantik valid. Semua variabel di Algoritma telah dideklarasikan di Kamus.</span>
            </div>
          )}

          {/* Analysis bullet points (Option 2 NOTES bullet list style) */}
          <ul className="space-y-1.5 text-[11px] text-[#475569] dark:text-neutral-400 leading-relaxed list-none pl-1">
            <li className="flex items-start gap-2">
              <span className="text-[#94a3b8] dark:text-neutral-500 select-none">•</span>
              <span>
                Total <strong className="text-[#0f172a] dark:text-neutral-200 font-semibold">{lineCount} baris</strong> dan{" "}
                <strong className="text-[#0f172a] dark:text-neutral-200 font-semibold">{tokenCount} token</strong> terurai oleh lexer.
              </span>
            </li>

            {(hasForLoop || hasWhileLoop || hasRepeat) && (
              <li className="flex items-start gap-2">
                <span className="text-[#94a3b8] dark:text-neutral-500 select-none">•</span>
                <span>
                  Perulangan aktif:{" "}
                  <strong className="text-[#5b45ff] dark:text-purple-300 font-semibold">
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
                <span className="text-[#94a3b8] dark:text-neutral-500 select-none">•</span>
                <span>
                  Percabangan terdeteksi:{" "}
                  <strong className="text-[#2563eb] dark:text-sky-300 font-semibold">if-then-else-endif</strong>.
                </span>
              </li>
            )}

            {hasStruct && (
              <li className="flex items-start gap-2">
                <span className="text-[#94a3b8] dark:text-neutral-500 select-none">•</span>
                <span>
                  Tipe bentukan rekaman (struct) multi-field terdeteksi.
                </span>
              </li>
            )}

            {hasIO && (
              <li className="flex items-start gap-2">
                <span className="text-[#94a3b8] dark:text-neutral-500 select-none">•</span>
                <span>
                  Operasi I/O terminal aktif via instruksi <code>input()</code> atau <code>output()</code>.
                </span>
              </li>
            )}
          </ul>
        </div>

        {/* Bottom Utility Actions (Lavender pill buttons) */}
        <div className="pt-2 border-t border-[#e5e5df] dark:border-neutral-800/80 flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenCheatsheet}
            className="flex-1 px-3 py-1.5 rounded-lg border border-[#ddd6fe] bg-[#ede9fe] text-[#4f46e5] hover:bg-[#ddd6fe] dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-neutral-300 dark:hover:text-white transition-colors text-[11px] flex items-center justify-center gap-1.5 cursor-pointer font-mono font-medium"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#5b45ff] dark:text-amber-400" />
            <span>Panduan Sintaks</span>
          </button>

          <button
            type="button"
            onClick={onClearConsole}
            className="px-3 py-1.5 rounded-lg border border-[#e2e2dc] bg-[#f1f1ee] hover:bg-[#e4e4df] text-[#475569] hover:text-[#0f172a] dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors text-[11px] flex items-center justify-center gap-1.5 cursor-pointer font-mono"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Bersihkan Log</span>
          </button>
        </div>
      </div>
    </div>
  );
}
