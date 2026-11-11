"use client";

import React, { useRef, useState, useMemo } from "react";
import { Sparkles, Copy, Check, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PseudocodeEditorProps {
  code: string;
  onChange: (value: string) => void;
  onRun: () => void;
  errorLine?: number | null;
  onKeyDownSound?: (key: string) => void;
  onKeyUpSound?: (key: string) => void;
}

export function PseudocodeEditor({
  code,
  onChange,
  onRun,
  errorLine,
  onKeyDownSound,
  onKeyUpSound,
}: PseudocodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lineNumbersRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  const lines = useMemo(() => code.split("\n"), [code]);
  const lineCount = lines.length;

  // Sync scroll between textarea and line numbers gutter
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
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

  // Handle Tab, Shift-Tab, Enter auto-indent, and Ctrl+Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDownSound?.(e.key);

    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      onRun();
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) return;

    if (e.key === "Tab") {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (e.shiftKey) {
        // Unindent 4 spaces if possible
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

  // Normalize PPT formatting (smart quotes, PPT arrow characters, irregular tabs)
  const fixPptFormatting = () => {
    const normalized = code
      .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u2190\uF0DF]/g, "<-")
      .replace(/\t/g, "    ");
    onChange(normalized);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex flex-col h-full rounded-xl border border-neutral-800 bg-neutral-900 shadow-xl overflow-hidden transition-colors dark:border-neutral-800 dark:bg-neutral-950">
      {/* Window title bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/80 bg-neutral-900/90 select-none">
        <div className="flex items-center gap-2">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5 mr-2">
            <span className="w-3 h-3 rounded-full bg-red-500/80 border border-red-600/40 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-600/40 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-600/40 inline-block" />
          </div>

          <Code2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono font-medium text-neutral-300">
            program.pseudo
          </span>
          {errorLine && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Error di baris {errorLine}
            </span>
          )}
        </div>

        {/* Toolbar actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fixPptFormatting}
            title="Perbaiki tanda petik miring dan panah PPT otomatis"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-neutral-700/80 bg-neutral-800/70 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Rapikan PPT</span>
          </button>

          <button
            type="button"
            onClick={copyCode}
            title="Salin isi program"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-neutral-700/80 bg-neutral-800/70 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Disalin</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Salin</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Editor body */}
      <div className="relative flex-1 flex overflow-hidden font-mono text-sm">
        {/* Line Numbers Gutter */}
        <div
          ref={lineNumbersRef}
          className="w-12 select-none py-3 bg-neutral-950/60 border-r border-neutral-800/60 text-right pr-3 font-mono text-xs text-neutral-500 overflow-hidden leading-6"
        >
          {Array.from({ length: lineCount }).map((_, i) => {
            const lineNum = i + 1;
            const isError = errorLine === lineNum;
            const isCurrent = cursorPos.line === lineNum;
            return (
              <div
                key={lineNum}
                className={cn(
                  "relative transition-colors",
                  isError && "text-rose-400 font-bold bg-rose-500/20 rounded-l",
                  isCurrent && !isError && "text-neutral-300"
                )}
              >
                {isError && (
                  <span className="absolute -left-1 top-1.5 w-1.5 h-1.5 rounded-full bg-rose-500" />
                )}
                {lineNum}
              </div>
            );
          })}
        </div>

        {/* Textarea */}
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
          placeholder="Tulis kode pseudocode di sini..."
          className="flex-1 resize-none py-3 px-4 bg-transparent outline-none border-none text-zinc-100 placeholder:text-neutral-600 font-mono text-sm leading-6 selection:bg-emerald-500/30 overflow-y-auto whitespace-pre"
        />
      </div>

      {/* Editor footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-neutral-800/60 bg-neutral-900/60 text-[11px] font-mono text-neutral-400 select-none">
        <div className="flex items-center gap-3">
          <span>
            Baris {cursorPos.line}, Kolom {cursorPos.col}
          </span>
          <span className="text-neutral-600">|</span>
          <span>{lineCount} baris</span>
        </div>
        <div className="flex items-center gap-2 text-neutral-400">
          <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-300 text-[10px]">
            Ctrl + Enter
          </kbd>
          <span>untuk Menjalankan</span>
        </div>
      </div>
    </div>
  );
}
