"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Copy,
  Info,
  Search,
  TriangleAlert,
  Code2,
  Lightbulb,
  CircleX,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tokenizeLine, TOKEN_STYLE } from "@/lib/syntax-highlighter";
import { DOC_SECTIONS, DocBlock, DocExample, DocMistake, DocSection } from "@/lib/docs-content";
import { ThemeToggle } from "@/components/sandbox/theme-toggle";

// ---------------------------------------------------------------------------
// Inline text: `code`, **bold**, *italic*
// ---------------------------------------------------------------------------
function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
          return (
            <code
              key={i}
              className="px-1 py-px rounded bg-[#f1f1ee] border border-[#e5e5df] text-[0.85em] font-mono text-[#4f46e5] dark:bg-neutral-800/80 dark:border-neutral-700/70 dark:text-sky-300"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-[#0f172a] dark:text-neutral-100">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Highlighted code lines (shared by examples and mistake cards)
// ---------------------------------------------------------------------------
function CodeLines({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto py-2.5 font-mono text-[13px] leading-6 min-w-0" style={{ tabSize: 4 }}>
      {code.split("\n").map((line, i) => (
        <div key={i} className="flex">
          <span className="select-none w-9 shrink-0 pr-3 text-right text-[11px] text-[#cbd5e1] dark:text-neutral-700">
            {i + 1}
          </span>
          <span className="whitespace-pre pr-5">
            {line.length === 0
              ? " "
              : tokenizeLine(line).map((tok, j) => {
                  const st = TOKEN_STYLE[tok.type];
                  return (
                    <span
                      key={j}
                      style={{ color: st.color, fontWeight: st.fontWeight, fontStyle: st.fontStyle }}
                    >
                      {tok.text}
                    </span>
                  );
                })}
          </span>
        </div>
      ))}
    </pre>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard not available
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono text-[#475569] hover:bg-[#edeef0] hover:text-[#0f172a] dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors cursor-pointer"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-[#16a34a] dark:text-emerald-400" />
          <span className="text-[#16a34a] dark:text-emerald-400">Disalin</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          <span>Salin</span>
        </>
      )}
    </button>
  );
}

const PANE_LABEL = "text-[10px] font-semibold tracking-wider text-[#64748b] dark:text-neutral-500 mb-1";

// ---------------------------------------------------------------------------
// Code example: sized to its code (never stretched across the page), with the
// input/output beside it on wide screens.
// ---------------------------------------------------------------------------
function CodeExample({ example }: { example: DocExample }) {
  const hasOutput = example.output !== undefined;
  return (
    <div className="w-fit max-w-full min-w-[min(100%,360px)] rounded-xl border border-[#e4e4df] bg-white overflow-hidden shadow-xs dark:border-neutral-800 dark:bg-[#0d0f12]">
      <div className="flex items-center justify-between gap-6 px-3 py-1.5 border-b border-[#e5e5df] bg-[#fbfbfa] dark:border-neutral-800 dark:bg-[#12151b]">
        <span className="text-[10px] font-mono font-semibold tracking-wider text-[#64748b] dark:text-neutral-500">
          {hasOutput ? "PROGRAM LENGKAP" : "POTONGAN KODE"}
        </span>
        <CopyButton text={example.code} />
      </div>

      <div className={cn(hasOutput && "md:flex")}>
        <CodeLines code={example.code} />

        {hasOutput && (
          <div className="flex flex-col border-t md:border-t-0 md:border-l border-[#e5e5df] dark:border-neutral-800 font-mono text-xs bg-[#fafaf8] dark:bg-neutral-900/40 md:min-w-[200px]">
            {example.input !== undefined && (
              <div className="px-3 py-2 border-b border-[#e5e5df] dark:border-neutral-800">
                <div className={PANE_LABEL}>INPUT</div>
                <pre className="whitespace-pre-wrap text-[#4f46e5] dark:text-cyan-300">{example.input}</pre>
              </div>
            )}
            <div className="px-3 py-2 flex-1">
              <div className={PANE_LABEL}>OUTPUT</div>
              <pre className="whitespace-pre text-[#0f172a] dark:text-neutral-100">{example.output}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Common mistake: wrong code + the editor's error  |  corrected code
// ---------------------------------------------------------------------------
function MistakeCard({ mistake }: { mistake: DocMistake }) {
  return (
    <div className="w-fit max-w-full rounded-xl border border-[#e4e4df] bg-white overflow-hidden shadow-xs dark:border-neutral-800 dark:bg-[#0d0f12]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#e5e5df] bg-[#fbfbfa] dark:border-neutral-800 dark:bg-[#12151b]">
        <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span className="text-[10px] font-mono font-semibold tracking-wider text-[#64748b] dark:text-neutral-500">
          KESALAHAN UMUM
        </span>
        <span className="text-sm font-semibold text-[#0f172a] dark:text-neutral-100">{mistake.title}</span>
      </div>

      <div className="md:flex">
        {/* Wrong */}
        <div className="min-w-0 md:border-r border-[#e5e5df] dark:border-neutral-800">
          <div className="flex items-center gap-1.5 px-3 pt-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
            <CircleX className="w-3.5 h-3.5" strokeWidth={2.5} /> Salah
          </div>
          <CodeLines code={mistake.wrong} />
          {mistake.input !== undefined && (
            <div className="px-3 pb-2 font-mono text-xs text-[#64748b] dark:text-neutral-400">
              dengan input: <span className="text-[#4f46e5] dark:text-cyan-300">{mistake.input}</span>
            </div>
          )}
          <div className="mx-3 mb-3 flex items-start gap-1.5 rounded-md bg-rose-500/15 px-2.5 py-1.5 font-mono text-xs text-rose-800 dark:text-rose-200 md:max-w-[440px]">
            <CircleX className="w-3.5 h-3.5 mt-px shrink-0 text-rose-600 dark:text-rose-400" strokeWidth={2.5} />
            <span>{mistake.error}</span>
          </div>
        </div>

        {/* Right */}
        <div className="min-w-0 border-t md:border-t-0 border-[#e5e5df] dark:border-neutral-800">
          <div className="flex items-center gap-1.5 px-3 pt-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} /> Benar
          </div>
          <CodeLines code={mistake.right} />
        </div>
      </div>

      <div className="px-3.5 py-2.5 border-t border-[#e5e5df] dark:border-neutral-800 text-sm leading-6 text-[#334155] dark:text-neutral-300 bg-[#fafaf8] dark:bg-neutral-900/40">
        <Inline text={mistake.explain} />
      </div>
    </div>
  );
}

const TEXT = "text-[15px] leading-7 text-[#334155] dark:text-neutral-300";

function Block({ block }: { block: DocBlock }) {
  switch (block.kind) {
    case "p":
      return (
        <p className={TEXT}>
          <Inline text={block.text} />
        </p>
      );
    case "h3":
      return (
        <h3 className="pt-3 text-base font-semibold text-[#0f172a] dark:text-neutral-100">{block.text}</h3>
      );
    case "code":
      return <CodeExample example={block.example} />;
    case "mistake":
      return <MistakeCard mistake={block.mistake} />;
    case "list":
      return (
        <ul className={cn("space-y-1.5", TEXT)}>
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-[11px] w-1.5 h-1.5 rounded-full bg-[#a5b4fc] dark:bg-sky-500/60 shrink-0" />
              <span>
                <Inline text={item} />
              </span>
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className={cn("space-y-2", TEXT)}>
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 flex items-center justify-center w-6 h-6 shrink-0 rounded-full bg-[#ede9fe] text-[#4f46e5] text-xs font-bold font-mono dark:bg-sky-500/15 dark:text-sky-300">
                {i + 1}
              </span>
              <span>
                <Inline text={item} />
              </span>
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="space-y-1.5">
          {block.caption && (
            <p className="text-sm text-[#64748b] dark:text-neutral-400">
              <Inline text={block.caption} />
            </p>
          )}
          <div className="overflow-x-auto rounded-xl border border-[#e4e4df] bg-white dark:border-neutral-800 dark:bg-[#0d0f12]">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-[#fbfbfa] dark:bg-[#12151b]">
                <tr>
                  {block.head.map((h, i) => (
                    <th
                      key={i}
                      className="text-left px-3 py-2 text-[11px] uppercase tracking-wider font-semibold text-[#64748b] dark:text-neutral-500 border-b border-[#e5e5df] dark:border-neutral-800"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, i) => (
                  <tr key={i} className="border-b last:border-b-0 border-[#efefea] dark:border-neutral-800/70">
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-2 align-top leading-6 text-[#334155] dark:text-neutral-300">
                        <Inline text={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    case "note": {
      const tone = {
        warning: {
          Icon: TriangleAlert,
          label: "Perhatian",
          box: "bg-amber-500/15 text-amber-950 dark:text-amber-100",
          icon: "text-amber-600 dark:text-amber-400",
        },
        info: {
          Icon: Info,
          label: "Catatan",
          box: "bg-[#5b45ff]/10 text-[#1e1b4b] dark:bg-sky-500/10 dark:text-sky-100",
          icon: "text-[#5b45ff] dark:text-sky-400",
        },
        tip: {
          Icon: Lightbulb,
          label: "Tips",
          box: "bg-emerald-500/15 text-emerald-950 dark:text-emerald-100",
          icon: "text-emerald-600 dark:text-emerald-400",
        },
      }[block.tone];
      return (
        <div className={cn("flex gap-2.5 rounded-xl px-3.5 py-2.5 text-sm leading-6", tone.box)}>
          <tone.Icon className={cn("w-4 h-4 mt-1 shrink-0", tone.icon)} />
          <span>
            <strong className="font-semibold">{tone.label}: </strong>
            <Inline text={block.text} />
          </span>
        </div>
      );
    }
  }
}

function sectionText(section: DocSection): string {
  const parts = [section.title, section.summary];
  for (const b of section.blocks) {
    if (b.kind === "p" || b.kind === "note" || b.kind === "h3") parts.push(b.text);
    else if (b.kind === "list" || b.kind === "steps") parts.push(...b.items);
    else if (b.kind === "table") parts.push(...b.head, ...b.rows.flat());
    else if (b.kind === "code") parts.push(b.example.code);
    else if (b.kind === "mistake") parts.push(b.mistake.title, b.mistake.explain, b.mistake.error);
  }
  return parts.join(" ").toLowerCase();
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export function DocsView() {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string>(DOC_SECTIONS[0].id);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DOC_SECTIONS;
    return DOC_SECTIONS.filter((s) => sectionText(s).includes(q));
  }, [query]);

  const groups = useMemo(() => {
    const map = new Map<string, DocSection[]>();
    for (const s of visible) {
      const list = map.get(s.group) ?? [];
      list.push(s);
      map.set(s.group, list);
    }
    return Array.from(map.entries());
  }, [visible]);

  // Scroll-spy: highlight the section currently being read.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActiveId(top.target.id);
      },
      { rootMargin: "-80px 0px -65% 0px" }
    );
    for (const s of visible) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [visible]);

  const nav = (
    <nav className="space-y-5">
      {groups.map(([group, sections]) => (
        <div key={group}>
          <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] dark:text-neutral-500">
            {group}
          </div>
          <ul className="space-y-0.5">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={() => setActiveId(s.id)}
                  className={cn(
                    "block px-2 py-1 rounded-md text-[13px] transition-colors",
                    activeId === s.id
                      ? "bg-[#ede9fe] text-[#4f46e5] font-medium dark:bg-sky-500/10 dark:text-sky-300"
                      : "text-[#475569] hover:bg-[#f1f1ee] hover:text-[#0f172a] dark:text-neutral-400 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-100"
                  )}
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {groups.length === 0 && (
        <p className="px-2 text-xs text-[#94a3b8] dark:text-neutral-500">Tidak ada hasil.</p>
      )}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-[#eef0f4] dark:bg-neutral-950">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-[#e5e5df] bg-[#fbfbfa]/95 backdrop-blur-md dark:border-neutral-800 dark:bg-[#0d0f12]/95">
        <div className="flex items-center gap-3 px-4 lg:px-6 py-2.5">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium text-[#475569] hover:bg-[#edeef0] hover:text-[#0f172a] dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Editor</span>
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#ede9fe] border border-[#ddd6fe] text-[#5b45ff] dark:bg-purple-500/10 dark:border-purple-500/30 dark:text-purple-400 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm tracking-tight font-mono text-[#0f172a] dark:text-white truncate">
              Dokumentasi Pseudocode
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <label className="relative hidden sm:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94a3b8] dark:text-neutral-500" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari: input, for, mod…"
                className="w-56 lg:w-72 pl-8 pr-3 py-1.5 rounded-lg border border-[#e2e2dc] bg-white text-xs font-mono text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#a5b4fc] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-600 dark:focus:border-sky-500/60"
              />
            </label>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="px-4 lg:px-6 lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-8">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-[57px] max-h-[calc(100dvh-57px)] overflow-y-auto py-6 pr-2">{nav}</div>
        </aside>

        <main className="py-6 lg:py-8 min-w-0">
          {/* Mobile: search + table of contents */}
          <div className="lg:hidden mb-6 space-y-3">
            <label className="relative block sm:hidden">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94a3b8]" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari: input, for, mod…"
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-[#e2e2dc] bg-white text-sm font-mono outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </label>
            <details className="rounded-xl border border-[#e4e4df] bg-white px-3 py-2 dark:border-neutral-800 dark:bg-[#0d0f12]">
              <summary className="cursor-pointer text-sm font-medium text-[#0f172a] dark:text-neutral-200">
                Daftar isi
              </summary>
              <div className="pt-3">{nav}</div>
            </details>
          </div>

          {/* Intro */}
          {!query && (
            <div className="mb-10">
              <h1 className="text-3xl font-bold tracking-tight text-[#0f172a] dark:text-white">
                Bahasa Pseudocode Alpro 1
              </h1>
              <p className="mt-3 text-[15px] leading-7 text-[#475569] dark:text-neutral-400">
                Panduan menulis program dari nol, cocok untuk yang baru pertama kali belajar pemrograman.
                Mulai dari bagian <strong>Mulai di Sini</strong>, lalu baca berurutan. Setiap program lengkap
                disertai input dan output yang benar-benar dihasilkan compiler ini, dan setiap bagian
                dilengkapi contoh kesalahan umum beserta cara memperbaikinya.
              </p>
              <Link
                href="/"
                className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5b45ff] hover:bg-[#4f46e5] text-white text-xs font-mono font-semibold dark:bg-emerald-600 dark:hover:bg-emerald-500 transition-colors"
              >
                <Code2 className="w-3.5 h-3.5" />
                Buka Editor
              </Link>
            </div>
          )}

          {visible.length === 0 && (
            <p className="text-sm text-[#64748b] dark:text-neutral-400">
              Tidak ada bagian yang cocok dengan &quot;{query}&quot;.
            </p>
          )}

          <div className="space-y-14">
            {visible.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-20">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#5b45ff] dark:text-sky-400">
                  {s.group}
                </div>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#0f172a] dark:text-white">
                  <a href={`#${s.id}`} className="hover:underline underline-offset-4 decoration-[#cbd5e1]">
                    {s.title}
                  </a>
                </h2>
                <p className="mt-1 text-sm text-[#64748b] dark:text-neutral-400">{s.summary}</p>
                <div className="mt-5 space-y-4">
                  {s.blocks.map((b, i) => (
                    <Block key={i} block={b} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
