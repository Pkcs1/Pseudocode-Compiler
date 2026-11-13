"use client";

import React from "react";
import {
  FlaskConical,
  Plus,
  Play,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TestCase, TestResult, TestStatus } from "@/lib/test-runner";

interface TestCasesPanelProps {
  cases: TestCase[];
  results: Record<string, TestResult | undefined>;
  /** ids of cases currently running */
  running: Set<string>;
  onChangeCase: (id: string, patch: Partial<Pick<TestCase, "input" | "expected">>) => void;
  onAddCase: () => void;
  onRemoveCase: (id: string) => void;
  onRunCase: (id: string) => void;
  onRunAll: () => void;
  onJumpToLine: (line: number) => void;
}

const STATUS_META: Record<
  TestStatus,
  { label: string; icon: React.ElementType; chip: string; cell: string }
> = {
  pass: {
    label: "Lulus",
    icon: CheckCircle2,
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    cell: "text-emerald-800 dark:text-emerald-200",
  },
  fail: {
    label: "Salah",
    icon: XCircle,
    chip: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    cell: "text-rose-700 dark:text-rose-300",
  },
  error: {
    label: "Error",
    icon: AlertTriangle,
    chip: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    cell: "text-rose-700 dark:text-rose-300",
  },
  timeout: {
    label: "Timeout",
    icon: Clock,
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    cell: "text-amber-700 dark:text-amber-300",
  },
  done: {
    label: "Selesai",
    icon: Circle,
    chip: "bg-slate-500/15 text-slate-700 dark:text-neutral-300",
    cell: "text-[#0f172a] dark:text-neutral-100",
  },
};

const CELL_TEXTAREA =
  "block w-full min-h-[3.25rem] resize-y rounded-md border border-[#e5e5df] bg-[#fbfbfa] px-2 py-1.5 font-mono text-xs leading-5 text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#a5b4fc] focus:bg-white dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-100 dark:placeholder:text-neutral-600 dark:focus:border-sky-500/50 dark:focus:bg-neutral-900";

/** Column layout shared by the header row and each case row (from `sm` up). */
const ROW_GRID = "sm:grid sm:grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_92px]";

/** Small caption shown above each field when rows are stacked (phones). */
const FIELD_LABEL =
  "sm:hidden block mb-1 text-[10px] uppercase tracking-wider font-semibold text-[#64748b] dark:text-neutral-500";

function rowsFor(text: string): number {
  return Math.min(8, Math.max(2, text.split("\n").length));
}

export function TestCasesPanel({
  cases,
  results,
  running,
  onChangeCase,
  onAddCase,
  onRemoveCase,
  onRunCase,
  onRunAll,
  onJumpToLine,
}: TestCasesPanelProps) {
  const finished = cases.map((c) => results[c.id]).filter(Boolean) as TestResult[];
  const compared = finished.filter((r) => r.status !== "done");
  const passed = compared.filter((r) => r.status === "pass").length;
  const isAnyRunning = running.size > 0;

  return (
    <div className="flex flex-col h-full min-h-0 rounded-xl border border-[#e4e4df] bg-[#ffffff] shadow-sm dark:border-neutral-800 dark:bg-[#0d0f12] overflow-hidden font-mono transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[#e5e5df] bg-[#fbfbfa] dark:border-neutral-800/90 dark:bg-[#12151b] select-none">
        <div className="flex items-center gap-2 min-w-0">
          <FlaskConical className="w-3.5 h-3.5 text-[#5b45ff] dark:text-sky-400 shrink-0" />
          <span className="font-bold text-xs text-[#0f172a] dark:text-neutral-200 tracking-wider whitespace-nowrap">
            TEST CASE
          </span>
          <span className="hidden sm:inline text-[#cbd5e1] dark:text-neutral-600 text-xs">•</span>
          <span className="hidden sm:inline text-[11px] text-[#64748b] dark:text-neutral-400 truncate">
            {cases.length} kasus
          </span>
          {compared.length > 0 && !isAnyRunning && (
            <span
              className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap",
                passed === compared.length
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
              )}
            >
              {passed}/{compared.length} lulus
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onAddCase}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-lg border border-[#e2e2dc] bg-[#f1f1ee] hover:bg-[#e4e4df] text-[#475569] hover:text-[#0f172a] dark:border-neutral-700/80 dark:bg-neutral-800/80 dark:text-neutral-300 dark:hover:text-white transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Kasus</span>
          </button>
          <button
            type="button"
            onClick={onRunAll}
            disabled={isAnyRunning || cases.length === 0}
            title="Jalankan semua test case (Ctrl + Shift + Enter)"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-[#16a34a] hover:bg-[#15803d] text-white disabled:opacity-60 disabled:cursor-not-allowed dark:bg-emerald-600 dark:hover:bg-emerald-500 transition-colors cursor-pointer"
          >
            {isAnyRunning ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Play className="w-3 h-3 fill-current" />
            )}
            <span>
              <span className="hidden sm:inline">Jalankan </span>Tes
            </span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        {cases.length === 0 ? (
          <div className="p-4 text-xs text-[#64748b] dark:text-neutral-500">
            Belum ada test case. Klik <strong>+ Kasus</strong> untuk menambahkan.
          </div>
        ) : (
          <div role="table" className="text-xs">
            <div
              role="row"
              className={cn(
                "hidden sticky top-0 z-10 bg-[#f8f8f6] dark:bg-[#101318] text-[10px] uppercase tracking-wider text-[#64748b] dark:text-neutral-500 border-b border-[#e5e5df] dark:border-neutral-800",
                ROW_GRID
              )}
            >
              <div role="columnheader" className="py-1.5 text-center font-semibold">#</div>
              <div role="columnheader" className="py-1.5 px-2 font-semibold">Input</div>
              <div role="columnheader" className="py-1.5 px-2 font-semibold">Output Diharapkan</div>
              <div role="columnheader" className="py-1.5 px-2 font-semibold">Output Program</div>
              <div role="columnheader" className="py-1.5 px-2 font-semibold">Status</div>
            </div>
            <div role="rowgroup">
              {cases.map((tc, idx) => {
                const result = results[tc.id];
                const isRunning = running.has(tc.id);
                const meta = result ? STATUS_META[result.status] : null;
                const StatusIcon = meta?.icon;
                return (
                  <div
                    role="row"
                    key={tc.id}
                    className={cn(
                      "relative px-2 pt-2 pb-3 sm:p-0 space-y-2 sm:space-y-0 border-b border-[#efefea] dark:border-neutral-800/70",
                      result?.status === "pass" && "bg-emerald-500/[0.04]",
                      (result?.status === "fail" || result?.status === "error") && "bg-rose-500/[0.04]",
                      ROW_GRID
                    )}
                  >
                    <div role="cell" className="sm:py-2 sm:text-center text-[11px] font-semibold text-[#94a3b8] dark:text-neutral-500">
                      <span className="sm:hidden">Kasus </span>
                      {idx + 1}
                    </div>
                    <div role="cell" className="sm:py-2 sm:px-1.5">
                      <span className={FIELD_LABEL}>Input</span>
                      <textarea
                        value={tc.input}
                        rows={rowsFor(tc.input)}
                        spellCheck={false}
                        placeholder={"contoh:\n5 3"}
                        onChange={(e) => onChangeCase(tc.id, { input: e.target.value })}
                        className={CELL_TEXTAREA}
                      />
                    </div>
                    <div role="cell" className="sm:py-2 sm:px-1.5">
                      <span className={FIELD_LABEL}>Output Diharapkan</span>
                      <textarea
                        value={tc.expected}
                        rows={rowsFor(tc.expected)}
                        spellCheck={false}
                        placeholder="kosongkan untuk hanya menjalankan"
                        onChange={(e) => onChangeCase(tc.id, { expected: e.target.value })}
                        className={CELL_TEXTAREA}
                      />
                    </div>
                    <div role="cell" className="sm:py-2 sm:px-1.5">
                      <span className={FIELD_LABEL}>Output Program</span>
                      <div
                        className={cn(
                          "min-h-[3.25rem] max-h-40 overflow-auto rounded-md border border-dashed border-[#e5e5df] px-2 py-1.5 leading-5 whitespace-pre-wrap break-words dark:border-neutral-800",
                          meta?.cell ?? "text-[#94a3b8] dark:text-neutral-600"
                        )}
                      >
                        {isRunning ? (
                          <span className="inline-flex items-center gap-1.5 text-[#64748b] dark:text-neutral-400">
                            <Loader2 className="w-3 h-3 animate-spin" /> berjalan…
                          </span>
                        ) : result ? (
                          <>
                            {result.output}
                            {result.error && (
                              <button
                                type="button"
                                onClick={() => result.errorLine && onJumpToLine(result.errorLine)}
                                className="block text-left mt-0.5 underline decoration-dotted underline-offset-2 cursor-pointer"
                                title="Klik untuk menuju baris error"
                              >
                                {result.errorLine ? `Baris ${result.errorLine}: ` : ""}
                                {result.error}
                              </button>
                            )}
                            {!result.output && !result.error && (
                              <span className="italic opacity-70">(tidak ada output)</span>
                            )}
                          </>
                        ) : (
                          <span className="italic">belum dijalankan</span>
                        )}
                      </div>
                    </div>
                    {/* Status + actions: top-right corner on phones, own column from sm */}
                    <div role="cell" className="absolute top-1.5 right-2 sm:static sm:py-2 sm:px-1.5">
                      <div className="flex flex-row-reverse sm:flex-col items-center sm:items-start gap-1.5">
                        {meta && StatusIcon && !isRunning ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold",
                              meta.chip
                            )}
                          >
                            <StatusIcon className="w-3 h-3" strokeWidth={2.5} />
                            {meta.label}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#94a3b8] dark:text-neutral-600">—</span>
                        )}
                        {result && !isRunning && (
                          <span className="text-[10px] text-[#94a3b8] dark:text-neutral-500">
                            {result.durationMs}ms
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onRunCase(tc.id)}
                            disabled={isAnyRunning}
                            title="Jalankan kasus ini"
                            className="p-1 rounded-md text-[#16a34a] hover:bg-emerald-500/15 disabled:opacity-40 disabled:cursor-not-allowed dark:text-emerald-400 transition-colors cursor-pointer"
                          >
                            <Play className="w-3 h-3 fill-current" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveCase(tc.id)}
                            disabled={isAnyRunning}
                            title="Hapus kasus ini"
                            className="p-1 rounded-md text-[#94a3b8] hover:text-rose-600 hover:bg-rose-500/15 disabled:opacity-40 disabled:cursor-not-allowed dark:text-neutral-500 dark:hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
