"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  Repeat,
  ListOrdered,
  Table2,
  TriangleAlert,
  Keyboard,
  Printer,
  Calculator,
  GitBranch,
  CircleCheck,
  RotateCcw,
  Lightbulb,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExecutionTrace, TraceLoopFrame, TraceStep } from "@/lib/engine";

type TraceMode = "steps" | "loops" | "table";
type State = Record<string, string | null>;

interface TraceViewProps {
  trace: ExecutionTrace | null;
  /** Declared variables from the kamus (name -> type). */
  declared: Record<string, string>;
  code: string;
  isRunning: boolean;
  onJumpTo: (line: number, col: number) => void;
}

/* ------------------------------------------------------------------------ */
/* Helpers: turn a source line + variable values into beginner explanations  */
/* ------------------------------------------------------------------------ */

const WORDS = new Set([
  "div",
  "mod",
  "and",
  "or",
  "not",
  "true",
  "false",
  "len",
  "if",
  "then",
  "else",
  "while",
  "do",
  "until",
  "for",
  "to",
  "downto",
  "step",
]);

function stripComment(line: string): string {
  return line.replace(/\/\/.*$/, "").replace(/\{[^}]*\}/g, "").trim();
}

/** Replace every variable name in `expr` with its value, e.g. "a + b" -> "3 + 4". */
function substitute(expr: string, state: State): string {
  return expr.replace(
    /"(?:[^"\\]|\\.)*"|'[^']*'|\b[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*/g,
    (m) => {
      if (m.startsWith('"') || m.startsWith("'")) return m;
      if (WORDS.has(m.toLowerCase())) return m;
      if (m in state) return state[m] ?? "?";
      return m;
    }
  );
}

function hasVariable(expr: string, state: State): boolean {
  return substitute(expr, state) !== expr;
}

function parseAssign(line: string): { target: string; expr: string } | null {
  const m = stripComment(line).match(/^([A-Za-z_][\w.]*)\s*(?:<-|=)\s*(.+)$/);
  return m ? { target: m[1], expr: m[2] } : null;
}

function parseCondition(line: string): string | null {
  const l = stripComment(line);
  const m =
    l.match(/^(?:else\s+)?if\s+(.+?)\s+then\b/i) ??
    l.match(/^while\s+(.+?)\s+do\b/i) ??
    l.match(/^until\s+(.+)$/i);
  return m ? m[1] : null;
}

const fmt = (v: string | null | undefined) =>
  v === null || v === undefined ? "belum diisi" : v;

function numericDelta(
  before: string | null | undefined,
  after: string | null | undefined
): string | null {
  if (before === null || before === undefined || after === null || after === undefined) {
    return null;
  }
  const b = Number(before);
  const a = Number(after);
  if (!Number.isFinite(b) || !Number.isFinite(a)) return null;
  const diff = a - b;
  if (diff === 0) return null;
  const formatted = Number.isInteger(diff) ? String(diff) : diff.toFixed(2).replace(/\.?0+$/, "");
  return diff > 0 ? `+${formatted}` : formatted;
}

/* ------------------------------------------------------------------------ */

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-[#f1f5f9] text-[#0f172a] font-mono text-xs border border-[#e2e8f0] dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700">
      {children}
    </code>
  );
}

function Val({ v }: { v: string | null | undefined }) {
  return (
    <strong
      className={cn(
        "font-mono font-semibold",
        v === null || v === undefined
          ? "text-[#94a3b8] font-sans font-normal italic"
          : "text-[#0f172a] dark:text-white"
      )}
    >
      {fmt(v)}
    </strong>
  );
}

function DeltaBadge({
  before,
  after,
}: {
  before: string | null | undefined;
  after: string | null | undefined;
}) {
  const d = numericDelta(before, after);
  if (!d) return null;
  const isPos = d.startsWith("+");
  return (
    <span
      className={cn(
        "ml-1 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-bold",
        isPos
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
          : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
      )}
    >
      {d}
    </span>
  );
}

const KIND_STYLE: Record<
  string,
  { icon: React.ElementType; label: string; color: string; bg: string }
> = {
  assign: {
    icon: Calculator,
    label: "Hitung & Simpan",
    color: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-50 border-sky-200 dark:bg-sky-500/10 dark:border-sky-500/25",
  },
  input: {
    icon: Keyboard,
    label: "Baca Input",
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/25",
  },
  output: {
    icon: Printer,
    label: "Tampilkan Output",
    color: "text-orange-700 dark:text-orange-300",
    bg: "bg-orange-50 border-orange-200 dark:bg-orange-500/10 dark:border-orange-500/25",
  },
  if: {
    icon: GitBranch,
    label: "Cek Kondisi If",
    color: "text-fuchsia-700 dark:text-fuchsia-300",
    bg: "bg-fuchsia-50 border-fuchsia-200 dark:bg-fuchsia-500/10 dark:border-fuchsia-500/25",
  },
  else: {
    icon: GitBranch,
    label: "Masuk Cabang Else",
    color: "text-fuchsia-700 dark:text-fuchsia-300",
    bg: "bg-fuchsia-50 border-fuchsia-200 dark:bg-fuchsia-500/10 dark:border-fuchsia-500/25",
  },
  "loop-check": {
    icon: RotateCcw,
    label: "Cek Kondisi Until",
    color: "text-purple-700 dark:text-purple-300",
    bg: "bg-purple-50 border-purple-200 dark:bg-purple-500/10 dark:border-purple-500/25",
  },
};

function explain(step: TraceStep, prev: State, sourceLine: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  if (step.kind === "assign") {
    const a = parseAssign(sourceLine);
    const target = a?.target ?? step.changes[0]?.name;
    const after = target ? step.state[target] : undefined;
    if (a && hasVariable(a.expr, prev)) {
      out.push(
        <span key="calc">
          Masukkan nilai variabel ke rumus: <Code>{a.expr}</Code>{" "}
          <ArrowRight className="inline w-3 h-3 text-[#64748b]" />{" "}
          <Code>{substitute(a.expr, prev)}</Code> = <Val v={after} />
        </span>
      );
    }
    if (target) {
      const before = prev[target];
      out.push(
        before === null || before === undefined ? (
          <span key="res">
            Variabel <Code>{target}</Code> diisi nilai awal <Val v={after} />
          </span>
        ) : before === after ? (
          <span key="res">
            Nilai <Code>{target}</Code> <strong>tetap</strong> <Val v={after} />{" "}
            <span className="text-[#64748b] dark:text-neutral-400">
              (hasil hitung sama dengan nilai sebelumnya)
            </span>
          </span>
        ) : (
          <span key="res">
            Nilai <Code>{target}</Code> berubah dari <Val v={before} /> menjadi{" "}
            <Val v={after} />
            <DeltaBadge before={before} after={after} />
          </span>
        )
      );
    }
  } else if (step.kind === "input") {
    out.push(
      <span key="in">
        Membaca input pengguna:{" "}
        {step.changes.length === 0 ? (
          "nilai sama dengan nilai sebelumnya"
        ) : (
          step.changes.map((c, i) => (
            <React.Fragment key={c.name}>
              {i > 0 && ", "}
              variabel <Code>{c.name}</Code> diisi <Val v={c.after} />
              {c.before !== null && c.before !== undefined && (
                <span className="text-[#64748b] dark:text-neutral-400">
                  {" "}
                  (sebelumnya <Val v={c.before} />)
                </span>
              )}
            </React.Fragment>
          ))
        )}
      </span>
    );
  } else if (step.kind === "output") {
    out.push(
      <span key="out">
        Mencetak ke layar:{" "}
        <span className="px-2 py-0.5 rounded bg-[#0f172a] font-mono text-xs text-emerald-300 dark:bg-black border border-neutral-700">
          {step.output || " "}
        </span>
      </span>
    );
  } else if (step.kind === "if" || step.kind === "loop-check") {
    const cond = parseCondition(sourceLine);
    if (cond) {
      out.push(
        <span key="cond">
          Periksa syarat: <Code>{cond}</Code>
          {hasVariable(cond, prev) && (
            <>
              {" "}
              <ArrowRight className="inline w-3 h-3 text-[#64748b]" />{" "}
              <Code>{substitute(cond, prev)}</Code>
            </>
          )}{" "}
          <ArrowRight className="inline w-3 h-3 text-[#64748b]" />{" "}
          <CondBadge ok={step.condition} />
        </span>
      );
    }
    if (step.note) out.push(<span key="note">{step.note}</span>);
  } else if (step.note) {
    out.push(<span key="note">{step.note}</span>);
  }
  return out;
}

/** Short single-line summary used in the classic Tabel Trace "Keterangan" column. */
function shortSummary(step: TraceStep, prev: State, sourceLine: string): string {
  if (step.kind === "assign") {
    const a = parseAssign(sourceLine);
    const target = a?.target ?? step.changes[0]?.name;
    const after = target ? step.state[target] : undefined;
    const before = target ? prev[target] : undefined;
    const calcPart =
      a && hasVariable(a.expr, prev) ? `${substitute(a.expr, prev)} = ${after ?? "?"}; ` : "";
    if (!target) return calcPart;
    if (before === null || before === undefined) return `${calcPart}${target} diisi ${after}`;
    if (before === after) return `${calcPart}${target} tetap ${after}`;
    const d = numericDelta(before, after);
    return `${calcPart}${target}: ${before} → ${after}${d ? ` (${d})` : ""}`;
  }
  if (step.kind === "input") {
    if (step.changes.length === 0) return "Input nilai yang sama";
    return step.changes.map((c) => `input ${c.name} = ${c.after}`).join(", ");
  }
  if (step.kind === "output") {
    return `Layar mencetak: ${step.output ?? ""}`;
  }
  return step.note ?? "";
}

function CondBadge({ ok }: { ok?: boolean }) {
  if (ok === undefined) return null;
  return (
    <span
      className={cn(
        "px-1.5 py-0.5 rounded text-[10px] font-bold",
        ok
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
      )}
    >
      {ok ? "BENAR ✓" : "SALAH ✗"}
    </span>
  );
}

function loopTitle(f: Pick<TraceLoopFrame, "kind" | "label">) {
  return f.kind === "for"
    ? `Perulangan ${f.label}`
    : f.kind === "while"
    ? "Perulangan while"
    : "Perulangan repeat-until";
}

/* ------------------------------------------------------------------------ */

interface IterationSummary {
  iteration: number;
  /** Variable state right before this iteration started. */
  startState: State;
  /** Variable state at the end of this iteration. */
  endState: State;
  /** Variables read via `input(...)` during this iteration. */
  inputVars: Set<string>;
  /** Variables targeted by an assignment or input during this iteration. */
  touchedVars: Set<string>;
  /** Steps executed inside this iteration. */
  steps: TraceStep[];
  /** Lines printed during this iteration. */
  outputs: string[];
}

/** One execution of a loop, with complete start/end states for every iteration. */
interface LoopRun {
  frame: Omit<TraceLoopFrame, "iteration">;
  counterVar?: string;
  parents: TraceLoopFrame[];
  initial: State;
  finalState: State;
  iterations: Map<number, IterationSummary>;
  vars: Set<string>;
  endNote?: string;
}

const MAX_LOOP_RUNS = 60;
const PLAY_INTERVAL_MS = 950;

export function TraceView({
  trace,
  declared,
  code,
  isRunning,
  onJumpTo,
}: TraceViewProps) {
  const [mode, setMode] = useState<TraceMode>("steps");
  const [onlyChanges, setOnlyChanges] = useState(false);
  const [selectedRaw, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [expandedIter, setExpandedIter] = useState<Record<string, boolean>>({});
  const selectedRef = useRef<HTMLDivElement | HTMLTableRowElement | null>(null);

  const sourceLines = useMemo(() => code.split(/\r?\n/), [code]);
  const steps = useMemo(() => trace?.steps ?? [], [trace]);
  const selected = Math.min(selectedRaw, Math.max(steps.length - 1, 0));

  const columns = useMemo(() => {
    const seen = new Set<string>();
    const cols: string[] = [];
    for (const s of steps) {
      for (const k of Object.keys(s.state)) {
        if (!seen.has(k)) {
          seen.add(k);
          cols.push(k);
        }
      }
    }
    return cols.length ? cols : Object.keys(declared);
  }, [steps, declared]);

  const visibleSteps = useMemo(
    () =>
      onlyChanges
        ? steps.filter(
            (s) =>
              s.changes.length > 0 ||
              s.kind === "loop" ||
              s.kind === "loop-end" ||
              s.kind === "output"
          )
        : steps,
    [steps, onlyChanges]
  );

  const loopRuns = useMemo(() => {
    const runs = new Map<number, LoopRun>();
    let prevState: State = {};
    for (const s of steps) {
      const srcLine = sourceLines[s.line - 1] ?? "";
      const assignedTarget = s.kind === "assign" ? parseAssign(srcLine)?.target : undefined;

      s.loops.forEach((f, depth) => {
        let run = runs.get(f.id);
        if (!run) {
          const counterVar = f.kind === "for" ? f.label.slice(4).trim() : undefined;
          run = {
            frame: { id: f.id, line: f.line, kind: f.kind, label: f.label },
            counterVar,
            parents: s.loops.slice(0, depth),
            initial: { ...prevState },
            finalState: { ...s.state },
            iterations: new Map(),
            vars: new Set(),
          };
          if (counterVar) run.vars.add(counterVar);
          runs.set(f.id, run);
        }
        run.finalState = s.state;

        let it = run.iterations.get(f.iteration);
        if (!it) {
          it = {
            iteration: f.iteration,
            startState: { ...prevState },
            endState: s.state,
            inputVars: new Set(),
            touchedVars: new Set(),
            steps: [],
            outputs: [],
          };
          run.iterations.set(f.iteration, it);
        }
        it.endState = s.state;

        // Only record direct steps of this loop (or nested steps for state tracking)
        if (depth === s.loops.length - 1) {
          it.steps.push(s);
        }

        for (const c of s.changes) {
          it.touchedVars.add(c.name);
          run.vars.add(c.name);
          if (s.kind === "input") {
            it.inputVars.add(c.name);
          }
        }
        if (assignedTarget) {
          it.touchedVars.add(assignedTarget);
          run.vars.add(assignedTarget);
        }
        if (s.kind === "output" && s.output !== undefined && depth === s.loops.length - 1) {
          it.outputs.push(s.output);
        }
      });

      if (s.kind === "loop-end" && s.loopId !== undefined) {
        const run = runs.get(s.loopId);
        if (run) {
          run.endNote = s.note;
        }
      }
      prevState = s.state;
    }
    return Array.from(runs.values());
  }, [steps, sourceLines]);

  // Collect all loop-start steps for quick iteration jumping in Step mode
  const loopStartSteps = useMemo(
    () => steps.filter((s) => s.kind === "loop"),
    [steps]
  );

  // Auto play: advance one visible step at a time.
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setSelected((cur) => {
        const pos = visibleSteps.findIndex((s) => s.index > cur);
        if (pos === -1) {
          setPlaying(false);
          return cur;
        }
        return visibleSteps[pos].index;
      });
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [playing, visibleSteps]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected, mode]);

  const go = (target: "first" | "prev" | "next" | "last") => {
    if (visibleSteps.length === 0) return;
    setPlaying(false);
    if (target === "first") return setSelected(visibleSteps[0].index);
    if (target === "last") return setSelected(visibleSteps[visibleSteps.length - 1].index);
    if (target === "next") {
      const n = visibleSteps.find((s) => s.index > selected);
      if (n) setSelected(n.index);
    } else {
      const p = [...visibleSteps].reverse().find((s) => s.index < selected);
      if (p) setSelected(p.index);
    }
  };

  /* ---------------------------- empty state ---------------------------- */
  if (steps.length === 0) {
    return (
      <div className="h-full min-h-0 overflow-y-auto p-4 space-y-3 text-[13px] leading-relaxed text-[#475569] dark:text-neutral-400 font-sans">
        <div className="p-3.5 rounded-xl border border-[#e4e4df] bg-[#fbfbfa] dark:border-neutral-800 dark:bg-[#12151b] space-y-2">
          <p className="font-semibold text-[#0f172a] dark:text-neutral-200 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <span>Cara Menggunakan Fitur Trace</span>
          </p>
          <p>
            {isRunning
              ? "Program sedang berjalan… jika program meminta input di tab Terminal, masukkan nilainya terlebih dahulu. Trace akan langsung muncul!"
              : "Klik tombol Jalankan (atau tekan Ctrl + Enter) untuk melihat bagaimana kode kamu dieksekusi baris demi baris dan bagaimana nilai variabel berubah di setiap putaran loop."}
          </p>
        </div>
        {columns.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-[#64748b] dark:text-neutral-400">
              Variabel yang siap dilacak ({columns.length}):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {columns.map((c) => (
                <span
                  key={c}
                  className="px-2.5 py-1 rounded-lg border border-[#e4e4df] bg-white text-xs font-mono text-[#0f172a] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                >
                  {c}
                  {declared[c] && (
                    <span className="ml-1.5 text-[#4f46e5] dark:text-[#4ec9b0]">
                      : {declared[c]}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const current = steps[selected];
  const prevOf = (s: TraceStep): State => (s.index > 0 ? steps[s.index - 1].state : {});
  const changedNow = new Map(current.changes.map((c) => [c.name, c]));
  const activeLoop = current.loops[current.loops.length - 1];

  return (
    <div className="h-full min-h-0 flex flex-col font-sans">
      {/* ------------------------------ Toolbar ------------------------------ */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 border-b border-[#f1f1ee] dark:border-neutral-800/80 text-xs bg-[#fbfbfa] dark:bg-[#12151b]">
        <div className="flex items-center p-0.5 rounded-lg bg-[#f1f1ee] border border-[#e2e2dc] dark:bg-neutral-950 dark:border-neutral-800">
          {(
            [
              { id: "steps", label: "Langkah demi Langkah", icon: ListOrdered },
              {
                id: "loops",
                label: `Per Putaran Loop${loopRuns.length > 0 ? ` (${loopRuns.length})` : ""}`,
                icon: Repeat,
              },
              { id: "table", label: "Tabel Trace", icon: Table2 },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMode(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer",
                mode === t.id
                  ? "bg-white text-[#0f172a] shadow-xs dark:bg-neutral-800 dark:text-white"
                  : "text-[#64748b] hover:text-[#0f172a] dark:text-neutral-400 dark:hover:text-neutral-200"
              )}
            >
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {(mode === "steps" || mode === "table") && (
          <div className="ml-auto flex items-center gap-1">
            <IconBtn title="Ke langkah pertama" onClick={() => go("first")}>
              <ChevronsLeft className="w-4 h-4" />
            </IconBtn>
            <IconBtn title="Langkah sebelumnya" onClick={() => go("prev")}>
              <ChevronLeft className="w-4 h-4" />
            </IconBtn>
            <button
              type="button"
              onClick={() => {
                if (!playing && selected >= steps.length - 1) {
                  setSelected(visibleSteps[0]?.index ?? 0);
                }
                setPlaying((p) => !p);
              }}
              title={playing ? "Jeda simulasi" : "Putar langkah demi langkah secara otomatis"}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium bg-[#5b45ff] text-white hover:bg-[#4f46e5] dark:bg-emerald-600 dark:hover:bg-emerald-500 cursor-pointer"
            >
              {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {playing ? "Jeda" : "Putar"}
            </button>
            <IconBtn title="Langkah berikutnya" onClick={() => go("next")}>
              <ChevronRight className="w-4 h-4" />
            </IconBtn>
            <IconBtn title="Ke langkah terakhir" onClick={() => go("last")}>
              <ChevronsRight className="w-4 h-4" />
            </IconBtn>
            <span className="ml-1 px-2 py-0.5 rounded bg-[#f1f1ee] dark:bg-neutral-800 tabular-nums text-[11px] font-medium text-[#475569] dark:text-neutral-300">
              Langkah {selected + 1} / {steps.length}
            </span>
          </div>
        )}
      </div>

      {trace?.truncated && (
        <div className="flex items-center gap-1.5 px-3 py-1 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300">
          <TriangleAlert className="w-3.5 h-3.5" />
          Program sangat panjang — menampilkan {trace.maxSteps} langkah pertama.
        </div>
      )}

      {/* =================================================================== */}
      {/* MODE 1: LANGKAH DEMI LANGKAH (Beginner-Friendly Story Cards)        */}
      {/* =================================================================== */}
      {mode === "steps" && (
        <>
          {/* Live Variable Memory Box */}
          <div className="px-3 py-2 border-b border-[#f1f1ee] dark:border-neutral-800/80 bg-[#fbfbfa] dark:bg-[#101319]">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#64748b] dark:text-neutral-400 mb-1.5">
              <span>
                Isi variabel pada{" "}
                <strong className="text-[#0f172a] dark:text-neutral-200">
                  Langkah #{selected + 1}
                </strong>{" "}
                (Baris {current.line})
                {activeLoop && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#ede9fe] text-[#4f46e5] font-medium dark:bg-purple-500/20 dark:text-purple-300">
                    {loopTitle(activeLoop)} · Putaran ke-{activeLoop.iteration}
                  </span>
                )}
              </span>
              <span className="text-[10px] text-[#94a3b8]">
                Kotak kuning = baru saja berubah di langkah ini
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {columns.map((c) => {
                const ch = changedNow.get(c);
                const val = current.state[c];
                return (
                  <div
                    key={c}
                    className={cn(
                      "min-w-20 px-2.5 py-1 rounded-lg border font-mono transition-all",
                      ch
                        ? "border-amber-400 bg-amber-50 shadow-2xs dark:border-amber-500/50 dark:bg-amber-500/15"
                        : "border-[#e4e4df] bg-white dark:border-neutral-800 dark:bg-neutral-900"
                    )}
                  >
                    <div className="flex items-center justify-between gap-1.5 text-[10px]">
                      <span className="font-semibold text-[#475569] dark:text-neutral-300">
                        {c}
                      </span>
                      {declared[c] && (
                        <span className="text-[9px] text-[#4f46e5] dark:text-[#4ec9b0]">
                          {declared[c]}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-baseline gap-1 text-sm font-bold text-[#0f172a] dark:text-white">
                      {val !== null && val !== undefined ? (
                        <span>{val}</span>
                      ) : (
                        <span className="text-[11px] font-sans font-normal italic text-[#94a3b8]">
                          belum diisi
                        </span>
                      )}
                      {ch && <DeltaBadge before={ch.before} after={ch.after} />}
                    </div>
                    {ch && (
                      <div className="text-[10px] font-sans text-amber-800 dark:text-amber-300">
                        dari {ch.before ?? "belum diisi"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Jump to Loop Iterations + Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-[11px] text-[#64748b] dark:text-neutral-400 border-b border-[#f1f1ee] dark:border-neutral-800/80">
            {loopStartSteps.length > 0 && loopStartSteps.length <= 25 ? (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-medium text-[#475569] dark:text-neutral-300">
                  Lompat ke Putaran:
                </span>
                {loopStartSteps.map((ls) => {
                  const f = ls.loops[ls.loops.length - 1];
                  if (!f) return null;
                  const isCurrentIter =
                    activeLoop?.id === f.id && activeLoop?.iteration === f.iteration;
                  return (
                    <button
                      key={ls.index}
                      type="button"
                      onClick={() => {
                        setPlaying(false);
                        setSelected(ls.index);
                      }}
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer",
                        isCurrentIter
                          ? "bg-[#5b45ff] text-white dark:bg-purple-500"
                          : "bg-[#f1f1ee] text-[#475569] hover:bg-[#e2e2dc] dark:bg-neutral-800 dark:text-neutral-300"
                      )}
                    >
                      #{f.iteration}
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Lightbulb className="w-3 h-3 text-amber-500" /> Klik langkah mana saja untuk
                melihat isi variabel pada saat itu.
              </span>
            )}

            <label className="ml-auto inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyChanges}
                onChange={(e) => setOnlyChanges(e.target.checked)}
                className="accent-[#5b45ff]"
              />
              Hanya langkah yang mengubah nilai
            </label>
          </div>

          {/* Step-by-Step Story Cards */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2.5 space-y-1.5">
            {visibleSteps.map((s) => {
              const isSel = s.index === selected;
              const line = sourceLines[s.line - 1] ?? "";
              const depth = s.kind === "loop" ? s.loops.length - 1 : s.loops.length;
              const indent = { marginLeft: `${Math.min(depth, 4) * 16}px` };

              if (s.kind === "loop" || s.kind === "loop-end") {
                const frame = s.kind === "loop" ? s.loops[s.loops.length - 1] : undefined;
                const isEnd = s.kind === "loop-end";
                return (
                  <div
                    key={s.index}
                    ref={(el) => {
                      if (isSel) selectedRef.current = el;
                    }}
                    style={indent}
                    onClick={() => setSelected(s.index)}
                    className={cn(
                      "rounded-xl px-3 py-2 cursor-pointer border text-[13px] transition-all",
                      isEnd
                        ? "bg-emerald-50/90 border-emerald-300 text-emerald-950 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-200"
                        : "bg-[#ede9fe]/90 border-[#c4b5fd] text-[#2e1065] dark:bg-purple-500/15 dark:border-purple-500/35 dark:text-purple-100",
                      isSel && "ring-2 ring-[#5b45ff] dark:ring-emerald-400"
                    )}
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      {isEnd ? (
                        <CircleCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <Repeat className="w-4 h-4 text-[#5b45ff] dark:text-purple-300 shrink-0" />
                      )}
                      <span>
                        {isEnd
                          ? "Perulangan Selesai"
                          : `${frame ? loopTitle(frame) : "Perulangan"} — Mulai Putaran ke-${frame?.iteration}`}
                      </span>
                      <code className="ml-1 px-1.5 py-0.5 rounded bg-white/70 dark:bg-black/30 font-mono text-[11px] font-normal">
                        {stripComment(line)}
                      </code>
                      <StepNo n={s.index + 1} line={s.line} onJumpTo={onJumpTo} />
                    </div>
                    <div className="text-xs mt-1 pl-6 opacity-90">{s.note}</div>
                  </div>
                );
              }

              const style = KIND_STYLE[s.kind] ?? KIND_STYLE.assign;
              const Icon = style.icon;
              const lines = explain(s, prevOf(s), line);
              const stepLoop = s.loops[s.loops.length - 1];
              return (
                <div
                  key={s.index}
                  ref={(el) => {
                    if (isSel) selectedRef.current = el;
                  }}
                  style={indent}
                  onClick={() => setSelected(s.index)}
                  className={cn(
                    "rounded-xl px-3 py-2 cursor-pointer border transition-all",
                    s.loops.length > 0 &&
                      "border-l-4 border-l-[#a78bfa] dark:border-l-purple-500/60",
                    isSel
                      ? "bg-[#f5f3ff] border-[#5b45ff] ring-1 ring-[#5b45ff] dark:bg-neutral-800/70 dark:border-emerald-400 dark:ring-emerald-400"
                      : "bg-white border-[#e5e7eb] hover:border-[#c7d2fe] dark:bg-[#11141b] dark:border-neutral-800 dark:hover:border-neutral-700"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold",
                        style.bg,
                        style.color
                      )}
                    >
                      <Icon className="w-3 h-3 shrink-0" />
                      {style.label}
                    </span>
                    <code className="font-mono font-semibold text-[#0f172a] dark:text-neutral-100">
                      {stripComment(line)}
                    </code>
                    {stepLoop && (
                      <span className="px-1.5 py-0.5 rounded bg-[#f3e8ff] text-[#6b21a8] dark:bg-purple-500/15 dark:text-purple-300 text-[10px] font-medium">
                        Putaran ke-{stepLoop.iteration}
                      </span>
                    )}
                    <StepNo n={s.index + 1} line={s.line} onJumpTo={onJumpTo} />
                  </div>
                  {lines.length > 0 && (
                    <div className="mt-1.5 pl-1 space-y-1 text-[13px] leading-relaxed text-[#334155] dark:text-neutral-300">
                      {lines.map((l, i) => (
                        <div key={i} className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[#94a3b8] select-none">•</span>
                          <span>{l}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* =================================================================== */}
      {/* MODE 2: PER PUTARAN LOOP (Beginner-Friendly Loop Iteration Tracker) */}
      {/* =================================================================== */}
      {mode === "loops" && (
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          <div className="flex gap-2.5 p-3 rounded-xl bg-sky-50 border border-sky-200 text-[13px] leading-relaxed text-sky-950 dark:bg-sky-500/10 dark:border-sky-500/25 dark:text-sky-100">
            <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
            <div className="space-y-1">
              <div className="font-semibold">Cara Membaca Tabel Putaran Loop:</div>
              <div>
                • Setiap baris adalah <strong>1 putaran (iterasi)</strong> dari loop. Kamu bisa
                melihat bagaimana nilai variabel berubah dari <strong>awal putaran → akhir putaran</strong>{" "}
                (contoh: <code className="px-1 rounded bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200 font-mono">0 → 1 (+1)</code>).
              </div>
              <div>
                • Klik baris putaran mana saja (atau tombol <strong>Rincian</strong>) untuk melihat{" "}
                <strong>perhitungan baris demi baris</strong> di dalam putaran tersebut!
              </div>
            </div>
          </div>

          {loopRuns.length === 0 && (
            <div className="p-6 text-center rounded-xl border border-[#e4e4df] dark:border-neutral-800 text-[13px] text-[#64748b] dark:text-neutral-400">
              Program ini tidak menjalankan perulangan (loop).
            </div>
          )}

          {loopRuns.slice(0, MAX_LOOP_RUNS).map((run) => {
            const vars = columns.filter((c) => run.vars.has(c));
            const iterations = Array.from(run.iterations.values());
            const hasOutput = iterations.some((it) => it.outputs.length > 0);
            return (
              <div
                key={run.frame.id}
                className="border border-[#e4e4df] rounded-xl overflow-hidden bg-white dark:border-neutral-800 dark:bg-[#101319] shadow-2xs"
              >
                {/* Loop Card Header */}
                <div className="px-3.5 py-2.5 bg-[#f4f4f0] dark:bg-[#141820] border-b border-[#e4e4df] dark:border-neutral-800">
                  <div className="flex flex-wrap items-center gap-2 text-[13px]">
                    <Repeat className="w-4 h-4 text-[#5b45ff] dark:text-purple-400" />
                    <span className="font-bold text-[#0f172a] dark:text-white">
                      {loopTitle(run.frame)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onJumpTo(run.frame.line, 1)}
                      className="px-2 py-0.5 rounded bg-white border border-[#e2e2dc] font-mono text-xs text-[#4f46e5] hover:underline dark:bg-neutral-900 dark:border-neutral-700 dark:text-sky-400 cursor-pointer"
                      title="Klik untuk menuju baris ini di editor"
                    >
                      {stripComment(sourceLines[run.frame.line - 1] ?? "")} (Baris {run.frame.line})
                    </button>
                    <span className="ml-auto px-2 py-0.5 rounded-full bg-[#ede9fe] text-[#4f46e5] dark:bg-purple-500/20 dark:text-purple-300 text-xs font-semibold">
                      Total {iterations.length} putaran
                    </span>
                  </div>
                  {run.parents.length > 0 && (
                    <div className="text-xs text-[#64748b] dark:text-neutral-400 mt-1">
                      Berada di dalam:{" "}
                      {run.parents
                        .map((p) => `${loopTitle(p)} (Putaran ke-${p.iteration})`)
                        .join(" › ")}
                    </div>
                  )}
                </div>

                {/* Per-Iteration Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px] border-collapse">
                    <thead className="text-xs bg-[#fbfbfa] text-[#475569] dark:bg-[#12161f] dark:text-neutral-400">
                      <tr className="border-b border-[#e4e4df] dark:border-neutral-800">
                        <th className="py-2 px-3 font-semibold w-36">Putaran</th>
                        {vars.map((v) => (
                          <th key={v} className="py-2 px-3 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#0f172a] dark:text-[#9cdcfe]">
                                {v}
                              </span>
                              {v === run.counterVar && (
                                <span className="px-1.5 py-0.2 rounded bg-[#ede9fe] text-[#4f46e5] dark:bg-purple-500/20 dark:text-purple-300 font-sans text-[10px] font-medium">
                                  penghitung
                                </span>
                              )}
                            </div>
                          </th>
                        ))}
                        {hasOutput && (
                          <th className="py-2 px-3 font-semibold">Output di Layar</th>
                        )}
                        <th className="py-2 px-3 text-right font-semibold w-28">Cara Hitung</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {/* Initial State Row before Iteration 1 */}
                      <tr className="border-b border-[#e4e4df] bg-[#f8fafc] dark:bg-neutral-900/50 dark:border-neutral-800 text-[#64748b] dark:text-neutral-400">
                        <td className="py-2 px-3 font-sans font-medium italic">
                          Sebelum Loop
                        </td>
                        {vars.map((v) => (
                          <td key={v} className="py-2 px-3">
                            {run.initial[v] ?? (
                              <span className="italic font-sans text-xs text-[#94a3b8]">
                                belum diisi
                              </span>
                            )}
                          </td>
                        ))}
                        {hasOutput && <td className="py-2 px-3 font-sans text-xs italic">–</td>}
                        <td className="py-2 px-3 text-right font-sans text-[11px] text-[#94a3b8]">
                          Nilai awal
                        </td>
                      </tr>

                      {/* One Row per Iteration */}
                      {iterations.map((it) => {
                        const key = `${run.frame.id}:${it.iteration}`;
                        const isExpanded = !!expandedIter[key];
                        return (
                          <React.Fragment key={it.iteration}>
                            <tr
                              onClick={() =>
                                setExpandedIter((prev) => ({ ...prev, [key]: !prev[key] }))
                              }
                              className={cn(
                                "border-b border-[#f1f1ee] dark:border-neutral-800/70 cursor-pointer transition-colors",
                                isExpanded
                                  ? "bg-[#f5f3ff]/70 dark:bg-purple-950/20"
                                  : "hover:bg-[#fbfbfa] dark:hover:bg-neutral-800/30"
                              )}
                            >
                              <td className="py-2 px-3 font-sans">
                                <div className="font-bold text-[#4f46e5] dark:text-purple-300">
                                  Putaran ke-{it.iteration}
                                </div>
                                {run.counterVar && (
                                  <div className="text-[11px] font-mono text-[#64748b] dark:text-neutral-400">
                                    {run.counterVar} = {it.endState[run.counterVar]}
                                  </div>
                                )}
                              </td>

                              {vars.map((v) => {
                                const before = it.startState[v];
                                const after = it.endState[v];
                                const isCounter = v === run.counterVar;
                                const isInput = it.inputVars.has(v);
                                const didChange = before !== after;
                                const wasTouched = it.touchedVars.has(v);

                                if (isCounter) {
                                  return (
                                    <td
                                      key={v}
                                      className="py-2 px-3 font-bold text-[#4f46e5] dark:text-purple-300"
                                    >
                                      {after ?? "–"}
                                    </td>
                                  );
                                }

                                if (isInput) {
                                  return (
                                    <td
                                      key={v}
                                      className="py-2 px-3 bg-emerald-50/70 dark:bg-emerald-500/10"
                                    >
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200 text-xs font-semibold">
                                        input: {after}
                                      </span>
                                    </td>
                                  );
                                }

                                if (didChange) {
                                  return (
                                    <td
                                      key={v}
                                      className="py-2 px-3 bg-amber-50/80 dark:bg-amber-500/10 tabular-nums"
                                    >
                                      <div className="flex items-center gap-1 flex-wrap">
                                        <span className="text-xs text-[#64748b] dark:text-neutral-400">
                                          {before ?? "kosong"}
                                        </span>
                                        <ArrowRight className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                        <span className="font-bold text-[#0f172a] dark:text-amber-100">
                                          {after ?? "kosong"}
                                        </span>
                                        <DeltaBadge before={before} after={after} />
                                      </div>
                                    </td>
                                  );
                                }

                                return (
                                  <td
                                    key={v}
                                    className="py-2 px-3 text-[#64748b] dark:text-neutral-500 tabular-nums"
                                  >
                                    {after !== null && after !== undefined ? (
                                      <span>
                                        {wasTouched && (
                                          <span className="font-sans text-[11px] text-[#94a3b8] mr-1">
                                            tetap
                                          </span>
                                        )}
                                        {after}
                                      </span>
                                    ) : (
                                      <span className="font-sans text-xs italic text-[#cbd5e1]">
                                        belum diisi
                                      </span>
                                    )}
                                  </td>
                                );
                              })}

                              {hasOutput && (
                                <td className="py-2 px-3">
                                  {it.outputs.length > 0 ? (
                                    <span className="px-2 py-0.5 rounded bg-[#0f172a] text-emerald-300 text-xs font-mono dark:bg-black">
                                      {it.outputs.join(" | ")}
                                    </span>
                                  ) : (
                                    <span className="text-[#cbd5e1]">–</span>
                                  )}
                                </td>
                              )}

                              <td className="py-2 px-3 text-right font-sans">
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[#4f46e5] hover:bg-[#ede9fe] dark:text-purple-300 dark:hover:bg-purple-500/20 cursor-pointer"
                                >
                                  <span>{isExpanded ? "Tutup" : "Rincian"}</span>
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </td>
                            </tr>

                            {/* Expanded Step-by-Step Breakdown inside this Iteration */}
                            {isExpanded && (
                              <tr className="border-b border-[#e4e4df] dark:border-neutral-800 bg-[#fbfbfa] dark:bg-[#0d1016]">
                                <td
                                  colSpan={vars.length + (hasOutput ? 3 : 2)}
                                  className="px-4 py-3 font-sans"
                                >
                                  <div className="text-xs font-semibold text-[#475569] dark:text-neutral-300 mb-2">
                                    Urutan proses di dalam Putaran ke-{it.iteration}:
                                  </div>
                                  <div className="space-y-1.5 pl-2 border-l-2 border-[#c4b5fd] dark:border-purple-500/40">
                                    {it.steps.map((st, idx) => {
                                      const stLine = sourceLines[st.line - 1] ?? "";
                                      const stExplain =
                                        st.kind === "loop"
                                          ? [<span key="l">{st.note}</span>]
                                          : explain(st, prevOf(st), stLine);
                                      return (
                                        <div
                                          key={st.index}
                                          className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2.5 text-xs py-1 px-2 rounded-lg bg-white border border-[#eef0f3] dark:bg-neutral-900 dark:border-neutral-800"
                                        >
                                          <span className="font-mono text-[11px] text-[#94a3b8] shrink-0">
                                            {idx + 1}. Baris {st.line}:
                                          </span>
                                          <code className="font-mono font-semibold text-[#0f172a] dark:text-neutral-200 shrink-0">
                                            {stripComment(stLine)}
                                          </code>
                                          <span className="text-[#475569] dark:text-neutral-300 space-x-2">
                                            {stExplain.map((node, i) => (
                                              <span key={i}>
                                                {i > 0 && " · "}
                                                {node}
                                              </span>
                                            ))}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Loop End Explanation & Total Change Footer */}
                <div className="px-3.5 py-2.5 bg-emerald-50/80 border-t border-emerald-200 text-xs text-emerald-950 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-200 space-y-1">
                  {run.endNote && (
                    <div className="flex items-center gap-1.5 font-medium">
                      <CircleCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>
                        <strong>Mengapa loop berhenti?</strong> {run.endNote}
                      </span>
                    </div>
                  )}
                  {vars.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-5 text-[11px] text-emerald-800 dark:text-emerald-300">
                      <span className="font-semibold">Hasil akhir setelah loop selesai:</span>
                      {vars
                        .filter((v) => v !== run.counterVar)
                        .map((v) => (
                          <span key={v} className="font-mono">
                            <strong>{v}</strong>: {run.initial[v] ?? "kosong"} →{" "}
                            <strong>{run.finalState[v] ?? "kosong"}</strong>
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loopRuns.length > MAX_LOOP_RUNS && (
            <div className="text-xs text-[#94a3b8]">
              … {loopRuns.length - MAX_LOOP_RUNS} eksekusi loop lainnya tidak ditampilkan.
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODE 3: TABEL TRACE (Clean Full Table with Clear Keterangan)        */}
      {/* =================================================================== */}
      {mode === "table" && (
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-[#f4f4f0] text-[#475569] text-[11px] font-semibold dark:bg-[#141820] dark:text-neutral-400">
              <tr className="border-b border-[#e4e4df] dark:border-neutral-800">
                <th className="py-2 px-2.5 w-9">#</th>
                <th className="py-2 px-2.5">Baris</th>
                <th className="py-2 px-2.5">Kode yang Dijalankan</th>
                <th className="py-2 px-2.5">Putaran Loop</th>
                {columns.map((c) => (
                  <th key={c} className="py-2 px-2.5 whitespace-nowrap font-mono">
                    <div className="text-[#0f172a] dark:text-[#9cdcfe]">{c}</div>
                    {declared[c] && (
                      <div className="text-[9px] font-normal text-[#4f46e5] dark:text-[#4ec9b0]">
                        {declared[c]}
                      </div>
                    )}
                  </th>
                ))}
                <th className="py-2 px-3 min-w-64">Penjelasan (Apa yang Terjadi)</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {visibleSteps.map((s) => {
                const changed = new Map(s.changes.map((c) => [c.name, c]));
                const isSel = s.index === selected;
                const srcLine = sourceLines[s.line - 1] ?? "";
                const prev = prevOf(s);
                return (
                  <tr
                    key={s.index}
                    ref={(el) => {
                      if (isSel) selectedRef.current = el;
                    }}
                    onClick={() => setSelected(s.index)}
                    className={cn(
                      "cursor-pointer border-b border-[#f1f1ee] dark:border-neutral-800/60",
                      s.iterationStart &&
                        "border-t-2 border-t-[#a78bfa] dark:border-t-purple-500/50",
                      s.kind === "loop-end" && "bg-emerald-50/40 dark:bg-emerald-950/15",
                      isSel
                        ? "bg-[#ede9fe]/70 dark:bg-purple-950/30"
                        : "hover:bg-[#fbfbfa] dark:hover:bg-neutral-800/25"
                    )}
                  >
                    <td className="py-1.5 px-2.5 text-[#94a3b8] tabular-nums">{s.index + 1}</td>
                    <td className="py-1.5 px-2.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onJumpTo(s.line, 1);
                        }}
                        title="Tampilkan baris ini di editor"
                        className="text-[#4f46e5] hover:underline dark:text-sky-400 tabular-nums cursor-pointer"
                      >
                        {s.line}
                      </button>
                    </td>
                    <td
                      className="py-1.5 px-2.5 max-w-56 truncate text-[#0f172a] dark:text-neutral-200"
                      title={stripComment(srcLine)}
                    >
                      {stripComment(srcLine)}
                    </td>
                    <td className="py-1.5 px-2.5 font-sans whitespace-nowrap">
                      {s.loops.length === 0 ? (
                        <span className="text-[#cbd5e1] dark:text-neutral-600">–</span>
                      ) : (
                        s.loops.map((f, i) => (
                          <React.Fragment key={f.id}>
                            {i > 0 && <span className="mx-0.5 text-[#94a3b8]">›</span>}
                            <span className="px-1.5 py-0.5 rounded bg-[#ede9fe] text-[#4f46e5] text-[10px] font-medium dark:bg-purple-500/15 dark:text-purple-300">
                              Putaran ke-{f.iteration}
                            </span>
                          </React.Fragment>
                        ))
                      )}
                    </td>
                    {columns.map((c) => {
                      const ch = changed.get(c);
                      const v = s.state[c];
                      return (
                        <td
                          key={c}
                          className={cn(
                            "py-1.5 px-2.5 whitespace-nowrap tabular-nums",
                            ch
                              ? "bg-amber-100/90 text-amber-950 font-bold dark:bg-amber-500/20 dark:text-amber-100"
                              : "text-[#64748b] dark:text-neutral-500"
                          )}
                        >
                          {ch && ch.before !== null && ch.before !== undefined ? (
                            <span>
                              <span className="font-normal text-[10px] text-amber-700 dark:text-amber-300">
                                {ch.before} →{" "}
                              </span>
                              {v}
                            </span>
                          ) : v !== null && v !== undefined ? (
                            v
                          ) : (
                            <span className="text-[#cbd5e1] dark:text-neutral-600">–</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-1.5 px-3 font-sans text-[#334155] dark:text-neutral-300">
                      {shortSummary(s, prev, srcLine)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="p-1 rounded-md text-[#475569] hover:bg-[#edeef0] dark:text-neutral-300 dark:hover:bg-neutral-800 cursor-pointer"
    >
      {children}
    </button>
  );
}

function StepNo({
  n,
  line,
  onJumpTo,
}: {
  n: number;
  line: number;
  onJumpTo: (l: number, c: number) => void;
}) {
  return (
    <span className="ml-auto shrink-0 flex items-center gap-2 text-[11px] font-normal text-[#64748b] dark:text-neutral-400">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onJumpTo(line, 1);
        }}
        title="Klik untuk menuju baris ini di editor"
        className="hover:underline hover:text-[#4f46e5] dark:hover:text-sky-400 cursor-pointer"
      >
        Baris {line}
      </button>
      <span className="tabular-nums font-mono text-[10px] text-[#94a3b8]">#{n}</span>
    </span>
  );
}
