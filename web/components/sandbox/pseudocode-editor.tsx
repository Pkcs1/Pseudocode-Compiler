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
  { border: "border-emerald-500/30", bg: "bg-emerald-500/[0.03]" },
  { border: "border-sky-500/30", bg: "bg-sky-500/[0.03]" },
  { border: "border-purple-500/30", bg: "bg-purple-500/[0.03]" },
  { border: "border-amber-500/30", bg: "bg-amber-500/[0.03]" },
  { border: "border-rose-500/30", bg: "bg-rose-500/[0.03]" },
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
    <div className="flex flex-col h-full min-h-0 rounded-2xl border border-neutral-800 bg-[#0d0f12] shadow-2xl overflow-hidden transition-colors">
      {/* Top Window Header (Option 2 Window Header Style with Option 1 Dark Aesthetic) */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b border-neutral-800/90 bg-[#12151b] select-none gap-2">
        <div className="flex items-center gap-3">
          {/* macOS Traffic Lights */}
          <div className="flex items-center gap-1.5 mr-1">
            <span className="w-3 h-3 rounded-full bg-red-500/80 border border-red-600/40 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-600/40 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-600/40 inline-block" />
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-purple-300 font-mono text-[11px] font-semibold">
              KODE PSEUDOCODE
            </span>
            <span className="text-neutral-400 font-mono text-xs hidden sm:inline-flex items-center gap-1.5">
              <span>program.pseudo</span>
              <span className="text-neutral-600">•</span>
              <span className="text-emerald-400/80">UTF-8</span>
            </span>
          </div>
        </div>

        {/* Action Controls / Toolbar (like in Image 2) */}
        <div className="flex items-center gap-2">
          {/* Run / Stop Button */}
          {isRunning ? (
            <button
              type="button"
              onClick={onStop}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-rose-600/90 hover:bg-rose-500 text-white shadow-sm transition-all cursor-pointer"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Hentikan</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onRun}
              title="Jalankan kode pseudocode (Ctrl + Enter)"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer font-mono"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Jalankan</span>
              {lastExecutionMs !== null && lastExecutionMs !== undefined && (
                <span className="ml-1 text-[10px] text-emerald-200 bg-emerald-700/60 px-1 rounded">
                  {lastExecutionMs}ms
                </span>
              )}
            </button>
          )}

          {/* Example Loader Dropdown */}
          {onLoadExample && (
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExampleMenuOpen(!isExampleMenuOpen);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded-lg border border-neutral-700/80 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all cursor-pointer"
              >
                <FileCode className="w-3 h-3 text-sky-400" />
                <span>Contoh</span>
                <ChevronDown className="w-3 h-3 text-neutral-400" />
              </button>

              {isExampleMenuOpen && (
                <div className="absolute right-0 mt-1 w-48 rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl z-30 py-1 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      onLoadExample("warung");
                      setIsExampleMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 text-neutral-200 transition-colors flex items-center justify-between"
                  >
                    <span>1. Warung Diskon</span>
                    <span className="text-[10px] text-neutral-500">I/O</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onLoadExample("rata");
                      setIsExampleMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 text-neutral-200 transition-colors flex items-center justify-between"
                  >
                    <span>2. Rata-Rata</span>
                    <span className="text-[10px] text-neutral-500">For Loop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onLoadExample("tes");
                      setIsExampleMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 text-neutral-200 transition-colors flex items-center justify-between"
                  >
                    <span>3. Percabangan</span>
                    <span className="text-[10px] text-neutral-500">If-Else</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onLoadExample("titik");
                      setIsExampleMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 text-neutral-200 transition-colors flex items-center justify-between"
                  >
                    <span>4. Tipe Bentukan</span>
                    <span className="text-[10px] text-neutral-500">Struct</span>
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
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded-lg border border-neutral-700/80 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Disalin</span>
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
      <div className="relative flex-1 min-h-0 flex overflow-hidden font-mono text-sm bg-[#0d0f12]">
        {/* Line Numbers Gutter */}
        <div
          ref={lineNumbersRef}
          className="w-12 select-none py-3 bg-[#0a0c0f] border-r border-neutral-800/70 text-right pr-3 font-mono text-xs text-neutral-500 overflow-hidden"
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
                  isError && "text-rose-400 font-bold bg-rose-500/20 rounded-l",
                  isCurrent && !isError && "text-neutral-300"
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
          {/* 1. Syntax Highlighted Code Backdrop (VS Code Dark+ Colors) */}
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
                    isCurrent && !isError && "bg-neutral-800/20"
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

                  {/* Highlighted Tokens with VS Code Palette */}
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
            className="relative z-20 w-full h-full resize-none py-3 px-4 bg-transparent outline-none border-none text-transparent caret-sky-400 placeholder:text-neutral-600 font-mono text-sm leading-6 selection:bg-sky-500/25 dark:selection:bg-sky-500/30 overflow-auto whitespace-pre m-0"
          />
        </div>
      </div>

      {/* Editor Footer / Status Rail */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-neutral-800/80 bg-[#101318] text-[11px] font-mono text-neutral-400 select-none">
        <div className="flex items-center gap-3">
          <span>
            Baris <span className="text-neutral-200">{cursorPos.line}</span>, Kolom{" "}
            <span className="text-neutral-200">{cursorPos.col}</span>
          </span>
          <span className="text-neutral-700">|</span>
          <span>{lineCount} baris</span>
          <span className="text-neutral-700">|</span>
          <span>{code.length} karakter</span>
        </div>
        <div className="flex items-center gap-2 text-neutral-400">
          <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-300 text-[10px]">
            Ctrl + Enter
          </kbd>
          <span className="text-neutral-400">Jalankan</span>
        </div>
      </div>
    </div>
  );
}
