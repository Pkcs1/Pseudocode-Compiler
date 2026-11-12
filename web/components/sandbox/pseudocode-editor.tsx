"use client";

import React, { useRef, useState, useMemo, useEffect } from "react";
import {
  Copy,
  Check,
  Play,
  Square,
  FileCode,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tokenizeLine, TOKEN_STYLE } from "@/lib/syntax-highlighter";

interface PseudocodeEditorProps {
  code: string;
  onChange: (value: string) => void;
  onRun: () => void;
  isRunning?: boolean;
  onStop?: () => void;
  errorLine?: number | null;
  onKeyDownSound?: (key: string) => void;
  onKeyUpSound?: (key: string) => void;
  onLoadExample?: (name: string) => void;
  lastExecutionMs?: number | null;
}

const RAINBOW_INDENTS = [
  { border: "border-indigo-500/30 dark:border-emerald-500/30", bg: "bg-indigo-500/[0.03] dark:bg-emerald-500/[0.03]" },
  { border: "border-teal-500/30 dark:border-sky-500/30", bg: "bg-teal-500/[0.03] dark:bg-sky-500/[0.03]" },
  { border: "border-purple-500/30 dark:border-purple-500/30", bg: "bg-purple-500/[0.03] dark:bg-purple-500/[0.03]" },
  { border: "border-amber-500/30 dark:border-amber-500/30", bg: "bg-amber-500/[0.03] dark:bg-amber-500/[0.03]" },
  { border: "border-rose-500/30 dark:border-rose-500/30", bg: "bg-rose-500/[0.03] dark:bg-rose-500/[0.03]" },
];

export function PseudocodeEditor({
  code,
  onChange,
  onRun,
  isRunning = false,
  onStop,
  errorLine,
  onKeyDownSound,
  onKeyUpSound,
  onLoadExample,
  lastExecutionMs,
}: PseudocodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lineNumbersRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLPreElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [isExampleMenuOpen, setIsExampleMenuOpen] = useState(false);

  const lines = useMemo(() => code.split("\n"), [code]);
  const lineCount = lines.length;

  // Sync scrolling between textarea, gutter, and highlighted code overlay
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = scrollTop;
    }
    if (backdropRef.current) {
      backdropRef.current.scrollTop = scrollTop;
      backdropRef.current.scrollLeft = scrollLeft;
    }
  };

  const updateCursorPosition = () => {
    if (!textareaRef.current) return;
    const pos = textareaRef.current.selectionStart;
    const textBefore = code.substring(0, pos);
    const curLines = textBefore.split("\n");
    setCursorPos({
      line: curLines.length,
      col: curLines[curLines.length - 1].length + 1,
    });
  };

  // Keyboard navigation & auto-indent
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!e.repeat) {
      onKeyDownSound?.(e.key);
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (isRunning && onStop) {
        onStop();
      } else {
        onRun();
      }
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) return;

    if (e.key === "Tab") {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (e.shiftKey) {
        // Unindent 4 spaces
        const before = code.substring(0, start);
        const lastNewline = before.lastIndexOf("\n");
        const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
        const linePrefix = code.substring(lineStart, lineStart + 4);
        if (linePrefix === "    ") {
          const nextCode =
            code.substring(0, lineStart) + code.substring(lineStart + 4);
          onChange(nextCode);
          setTimeout(() => {
            textarea.selectionStart = Math.max(lineStart, start - 4);
            textarea.selectionEnd = Math.max(lineStart, end - 4);
          }, 0);
        }
      } else {
        // Insert 4 spaces
        const nextCode =
          code.substring(0, start) + "    " + code.substring(end);
        onChange(nextCode);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 4;
        }, 0);
      }
      return;
    }

    if (e.key === "Enter") {
      const start = textarea.selectionStart;
      const textBefore = code.substring(0, start);
      const curLine = textBefore.split("\n").pop() || "";
      const matchIndent = curLine.match(/^(\s+)/);
      if (matchIndent) {
        e.preventDefault();
        const indent = matchIndent[1];
        const nextCode =
          code.substring(0, start) + "\n" + indent + code.substring(start);
        onChange(nextCode);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd =
            start + 1 + indent.length;
        }, 0);
      }
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyUpSound?.(e.key);
    updateCursorPosition();
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // Close example menu if clicked outside
  useEffect(() => {
    const handleGlobalClick = () => setIsExampleMenuOpen(false);
    if (isExampleMenuOpen) {
      window.addEventListener("click", handleGlobalClick);
      return () => window.removeEventListener("click", handleGlobalClick);
    }
  }, [isExampleMenuOpen]);

  return (
    <div className="flex flex-col h-full min-h-0 rounded-2xl border border-[#e4e4df] bg-[#ffffff] shadow-md dark:border-neutral-800 dark:bg-[#0d0f12] dark:shadow-2xl overflow-hidden transition-colors">
      {/* Top Window Header (Option 2 Window Header Style with Light Palette & Dark Toggle) */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b border-[#e5e5df] bg-[#fbfbfa] dark:border-neutral-800/90 dark:bg-[#12151b] select-none gap-2">
        <div className="flex items-center gap-3">
          {/* macOS Traffic Lights */}
          <div className="flex items-center gap-1.5 mr-1">
            <span className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block" />
            <span className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block" />
            <span className="w-3 h-3 rounded-full bg-[#27c93f] inline-block" />
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-[#5b45ff] text-white font-mono text-[11px] font-bold shadow-xs dark:bg-purple-500/20 dark:border dark:border-purple-500/30 dark:text-purple-300">
              KODE PSEUDOCODE
            </span>
            <span className="text-[#64748b] dark:text-neutral-400 font-mono text-xs hidden sm:inline-flex items-center gap-1.5">
              <span>program.pseudo</span>
              <span className="text-[#cbd5e1] dark:text-neutral-600">•</span>
              <span className="text-[#16a34a] dark:text-emerald-400/80">UTF-8</span>
            </span>
          </div>
        </div>

        {/* Action Controls / Toolbar (Option 2 Lavender Pills Style) */}
        <div className="flex items-center gap-2">
          {/* Run / Stop Button */}
          {isRunning ? (
            <button
              type="button"
              onClick={onStop}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all cursor-pointer font-mono"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Hentikan</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onRun}
              title="Jalankan kode pseudocode (Ctrl + Enter)"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[#5b45ff] hover:bg-[#4f46e5] text-white shadow-xs dark:bg-emerald-600 dark:hover:bg-emerald-500 transition-all cursor-pointer font-mono"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Jalankan</span>
              {lastExecutionMs !== null && lastExecutionMs !== undefined && (
                <span className="ml-1 text-[10px] text-[#ede9fe] bg-[#4338ca] dark:bg-emerald-700/60 dark:text-emerald-200 px-1 rounded">
                  {lastExecutionMs}ms
                </span>
              )}
            </button>
          )}

          {/* Example Loader Dropdown (Lavender action pill) */}
          {onLoadExample && (
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExampleMenuOpen(!isExampleMenuOpen);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded-lg border border-[#ddd6fe] bg-[#ede9fe] text-[#4f46e5] hover:bg-[#ddd6fe] dark:border-neutral-700/80 dark:bg-neutral-800/80 dark:text-neutral-300 dark:hover:text-white transition-all cursor-pointer"
              >
                <FileCode className="w-3 h-3 text-[#5b45ff] dark:text-sky-400" />
                <span>Contoh</span>
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>

              {isExampleMenuOpen && (
                <div className="absolute right-0 mt-1 w-48 rounded-xl border border-[#e2e2dc] bg-[#ffffff] text-[#0f172a] shadow-xl dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 z-30 py-1 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      onLoadExample("warung");
                      setIsExampleMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#ede9fe]/60 dark:hover:bg-neutral-800 transition-colors flex items-center justify-between"
                  >
                    <span>1. Warung Diskon</span>
                    <span className="text-[10px] text-[#64748b] dark:text-neutral-500">I/O</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onLoadExample("rata");
                      setIsExampleMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#ede9fe]/60 dark:hover:bg-neutral-800 transition-colors flex items-center justify-between"
                  >
                    <span>2. Rata-Rata</span>
                    <span className="text-[10px] text-[#64748b] dark:text-neutral-500">For Loop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onLoadExample("tes");
                      setIsExampleMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#ede9fe]/60 dark:hover:bg-neutral-800 transition-colors flex items-center justify-between"
                  >
                    <span>3. Percabangan</span>
                    <span className="text-[10px] text-[#64748b] dark:text-neutral-500">If-Else</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onLoadExample("titik");
                      setIsExampleMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#ede9fe]/60 dark:hover:bg-neutral-800 transition-colors flex items-center justify-between"
                  >
                    <span>4. Tipe Bentukan</span>
                    <span className="text-[10px] text-[#64748b] dark:text-neutral-500">Struct</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Copy Button */}
          <button
            type="button"
            onClick={copyCode}
            title="Salin isi program"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded-lg border border-[#e2e2dc] bg-[#f1f1ee] hover:bg-[#e4e4df] text-[#475569] hover:text-[#0f172a] dark:border-neutral-700/80 dark:bg-neutral-800/80 dark:text-neutral-300 dark:hover:text-white transition-all cursor-pointer"
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
        </div>
      </div>

      {/* Code Editor Body */}
      <div className="relative flex-1 min-h-0 flex overflow-hidden font-mono text-sm bg-[#ffffff] dark:bg-[#0d0f12]">
        {/* Line Numbers Gutter */}
        <div
          ref={lineNumbersRef}
          className="w-12 select-none py-3 bg-[#f8f8f6] border-r border-[#e5e5df] text-right pr-3 font-mono text-xs text-[#94a3b8] dark:bg-[#0a0c0f] dark:border-neutral-800/70 dark:text-neutral-500 overflow-hidden"
        >
          {Array.from({ length: lineCount }).map((_, i) => {
            const lineNum = i + 1;
            const isError = errorLine === lineNum;
            const isCurrent = cursorPos.line === lineNum;
            return (
              <div
                key={lineNum}
                className={cn(
                  "h-6 leading-6 flex items-center justify-end relative transition-colors",
                  isError && "text-rose-600 font-bold bg-rose-500/15 rounded-l dark:text-rose-400 dark:bg-rose-500/20",
                  isCurrent && !isError && "text-[#0f172a] font-semibold dark:text-neutral-300"
                )}
              >
                {isError && (
                  <span className="absolute -left-1 top-2 w-1.5 h-1.5 rounded-full bg-rose-500" />
                )}
                {lineNum}
              </div>
            );
          })}
        </div>

        {/* Editor Area: Syntax Highlight Backdrop + Rainbow Indent + Transparent Textarea */}
        <div className="relative flex-1 min-h-0 h-full overflow-hidden">
          {/* 1. Syntax Highlighted Code Backdrop */}
          <pre
            ref={backdropRef}
            aria-hidden="true"
            tabIndex={-1}
            style={{ tabSize: 4 }}
            className="absolute inset-0 pointer-events-none py-3 px-4 font-mono text-sm leading-6 overflow-hidden select-none whitespace-pre m-0 border-0"
          >
            {lines.map((line, idx) => {
              const lineNum = idx + 1;
              const isError = errorLine === lineNum;
              const isCurrent = cursorPos.line === lineNum;
              const tokens = tokenizeLine(line);

              // Rainbow indent calculations
              const match = line.match(/^ */);
              const spaceCount = match ? match[0].length : 0;
              const indentCount = Math.floor(spaceCount / 4);

              return (
                <div
                  key={idx}
                  className={cn(
                    "h-6 leading-6 whitespace-pre relative flex items-center",
                    isError && "bg-rose-500/15 rounded-sm",
                    isCurrent && !isError && "bg-[#f8f8f6] dark:bg-neutral-800/20"
                  )}
                >
                  {/* Subtle Rainbow Indent Guide Lines */}
                  {indentCount > 0 && (
                    <div className="absolute top-0 bottom-0 left-0 flex pointer-events-none">
                      {Array.from({ length: indentCount }).map((_, level) => {
                        const color =
                          RAINBOW_INDENTS[level % RAINBOW_INDENTS.length];
                        return (
                          <span
                            key={level}
                            className={cn(
                              "inline-block h-6 border-l transition-colors",
                              color.border
                            )}
                            style={{ width: "4ch" }}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Highlighted Tokens with dynamic Theme Palette */}
                  <span className="relative z-10">
                    {tokens.length > 0 ? (
                      tokens.map((tok, tIdx) => {
                        const style = TOKEN_STYLE[tok.type];
                        return (
                          <span
                            key={tIdx}
                            style={{
                              color: style.color,
                              fontWeight: style.fontWeight,
                              fontStyle: style.fontStyle,
                            }}
                          >
                            {tok.text}
                          </span>
                        );
                      })
                    ) : (
                      <span className="opacity-0"> </span>
                    )}
                  </span>
                </div>
              );
            })}
          </pre>

          {/* 2. Interactive Textarea Overlay */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => {
              onChange(e.target.value);
              updateCursorPosition();
            }}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onClick={updateCursorPosition}
            onScroll={handleScroll}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            style={{ tabSize: 4 }}
            placeholder="Tulis kode pseudocode di sini (atau muat contoh)..."
            className="relative z-20 w-full h-full resize-none py-3 px-4 bg-transparent outline-none border-none text-transparent caret-[#5b45ff] dark:caret-sky-400 placeholder:text-[#94a3b8] dark:placeholder:text-neutral-600 font-mono text-sm leading-6 selection:bg-[#ede9fe] selection:text-[#1e1b4b] dark:selection:bg-sky-500/25 dark:selection:text-white overflow-auto whitespace-pre m-0"
          />
        </div>
      </div>

      {/* Editor Footer / Status Rail */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[#e5e5df] bg-[#fbfbfa] text-[11px] font-mono text-[#64748b] dark:border-neutral-800/80 dark:bg-[#101318] dark:text-neutral-400 select-none">
        <div className="flex items-center gap-3">
          <span>
            Baris <span className="text-[#0f172a] dark:text-neutral-200 font-semibold">{cursorPos.line}</span>, Kolom{" "}
            <span className="text-[#0f172a] dark:text-neutral-200 font-semibold">{cursorPos.col}</span>
          </span>
          <span className="text-[#cbd5e1] dark:text-neutral-700">|</span>
          <span>{lineCount} baris</span>
          <span className="text-[#cbd5e1] dark:text-neutral-700">|</span>
          <span>{code.length} karakter</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-1.5 py-0.5 rounded bg-[#edeef0] border border-[#e2e2dc] text-[#334155] dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300 text-[10px]">
            Ctrl + Enter
          </kbd>
          <span>Jalankan</span>
        </div>
      </div>
    </div>
  );
}
