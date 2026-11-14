"use client";

import React, { useRef, useState, useMemo, useEffect, useCallback } from "react";
import {
  Copy,
  Check,
  Play,
  Square,
  CircleX,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorSettings, visualWidth } from "@/lib/editor-settings";
import { IndentGuides, indentGuideWidth } from "./indent-guides";
import { tokenizeLine, TOKEN_STYLE } from "@/lib/syntax-highlighter";
import type { Diagnostic } from "@/lib/engine";
import {
  getCompletions,
  expandInsert,
  type CompletionContext,
  type CompletionItem,
  type CompletionKind,
} from "@/lib/intellisense";

export interface JumpRequest {
  line: number;
  col: number;
  /** Changes on every request so jumping to the same spot twice still works. */
  nonce: number;
}

const LINE_HEIGHT_PX = 24;
/** Editor text padding (py-3 / px-4). */
const PAD_TOP_PX = 12;
const PAD_LEFT_PX = 16;
const SUGGEST_ROW_PX = 26;
const SUGGEST_MAX_ROWS = 8;

const KIND_BADGE: Record<CompletionKind, { label: string; className: string }> = {
  keyword: { label: "kw", className: "text-[#5b45ff] bg-[#5b45ff]/10 dark:text-purple-300 dark:bg-purple-400/15" },
  snippet: { label: "{}", className: "text-amber-700 bg-amber-500/15 dark:text-amber-300 dark:bg-amber-400/15" },
  function: { label: "ƒ", className: "text-sky-700 bg-sky-500/15 dark:text-sky-300 dark:bg-sky-400/15" },
  type: { label: "T", className: "text-teal-700 bg-teal-500/15 dark:text-teal-300 dark:bg-teal-400/15" },
  variable: { label: "x", className: "text-emerald-700 bg-emerald-500/15 dark:text-emerald-300 dark:bg-emerald-400/15" },
  constant: { label: "π", className: "text-rose-700 bg-rose-500/15 dark:text-rose-300 dark:bg-rose-400/15" },
  field: { label: ".", className: "text-indigo-700 bg-indigo-500/15 dark:text-indigo-300 dark:bg-indigo-400/15" },
};

type SuggestState = CompletionContext & { index: number };

/** Column (1-based) → visual offset in characters, expanding tabs. */
function visualOffset(lineText: string, col: number, tabSize: number): number {
  const upTo = Math.min(col - 1, lineText.length);
  return visualWidth(lineText.slice(0, upTo), tabSize) + Math.max(0, col - 1 - lineText.length);
}

/**
 * Replace `[start, end)` of the textarea with `text` the way typing would, so the
 * browser's undo stack (Ctrl+Z) keeps working, then select `[selStart, selEnd]`.
 * Fires a normal `input` event, so React's onChange runs as usual.
 */
function replaceRange(
  ta: HTMLTextAreaElement,
  start: number,
  end: number,
  text: string,
  selStart: number,
  selEnd: number = selStart
) {
  ta.focus();
  ta.setSelectionRange(start, end);
  let ok = false;
  try {
    ok = text
      ? document.execCommand("insertText", false, text)
      : start === end || document.execCommand("delete");
  } catch {
    ok = false;
  }
  if (!ok) {
    ta.setRangeText(text, start, end, "end");
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }
  ta.setSelectionRange(selStart, selEnd);
}

/** Offset of the first character of the line containing `pos`. */
const lineStartOf = (value: string, pos: number) => value.lastIndexOf("\n", pos - 1) + 1;

/** Offset just past the last character (before the newline) of the line containing `pos`. */
const lineEndOf = (value: string, pos: number) => {
  const nl = value.indexOf("\n", pos);
  return nl === -1 ? value.length : nl;
};

const DIAG_STYLE = {
  error: {
    lineBg: "bg-rose-500/[0.09] dark:bg-rose-500/[0.12]",
    gutter: "text-rose-600 dark:text-rose-400",
    message: "text-rose-600/90 dark:text-rose-400/90",
    squiggle: "rgb(225 29 72)",
  },
  warning: {
    lineBg: "bg-amber-400/[0.12] dark:bg-amber-400/[0.09]",
    gutter: "text-amber-600 dark:text-amber-400",
    message: "text-amber-700/90 dark:text-amber-400/90",
    squiggle: "rgb(217 119 6)",
  },
} as const;

interface PseudocodeEditorProps {
  code: string;
  onChange: (value: string) => void;
  onRun: () => void;
  /** Ctrl/Cmd + Shift + Enter: run all test cases. */
  onRunTests?: () => void;
  isRunning?: boolean;
  onStop?: () => void;
  /** Errors & warnings rendered inline (Error Lens style). */
  diagnostics?: Diagnostic[];
  /** Move the caret to a position (e.g. when a diagnostic is clicked). */
  jumpTo?: JumpRequest | null;
  onKeyDownSound?: (key: string) => void;
  onKeyUpSound?: (key: string) => void;
  lastExecutionMs?: number | null;
}

export function PseudocodeEditor({
  code,
  onChange,
  onRun,
  onRunTests,
  isRunning = false,
  onStop,
  diagnostics = [],
  jumpTo,
  onKeyDownSound,
  onKeyUpSound,
  lastExecutionMs,
}: PseudocodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lineNumbersRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLPreElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const settings = useEditorSettings();
  const { tabSize, insertSpaces, intellisense } = settings;

  // IntelliSense suggestion popup
  const [suggest, setSuggest] = useState<SuggestState | null>(null);
  const suggestRef = useRef<SuggestState | null>(null);
  // Keep the ref in step synchronously: key handlers read it before React re-renders.
  const updateSuggest = useCallback((next: SuggestState | null) => {
    suggestRef.current = next;
    setSuggest(next);
  }, []);
  const suppressSuggestRef = useRef(false);
  const suggestListRef = useRef<HTMLDivElement | null>(null);
  const [editorScroll, setEditorScroll] = useState({ top: 0, left: 0, height: 0 });

  /** Recompute suggestions at the caret. `open` = allowed to open a closed popup. */
  const refreshSuggest = useCallback((open: boolean, explicit = false) => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (!intellisense) {
      if (suggestRef.current) updateSuggest(null);
      return;
    }
    if (!open && !suggestRef.current) return;
    if (ta.selectionStart !== ta.selectionEnd) {
      updateSuggest(null);
      return;
    }
    const ctx = getCompletions(ta.value, ta.selectionStart, explicit);
    const prev = suggestRef.current;
    if (!ctx || (!open && prev && prev.from !== ctx.from)) {
      updateSuggest(null);
      return;
    }
    // Keep the highlighted item if it's still in the list.
    const keep = prev ? ctx.items.findIndex((it) => it === prev.items[prev.index]) : -1;
    updateSuggest({ ...ctx, index: Math.max(0, keep) });
    setEditorScroll({ top: ta.scrollTop, left: ta.scrollLeft, height: ta.clientHeight });
  }, [intellisense, updateSuggest]);

  // Close any open popup when IntelliSense is switched off in settings.
  useEffect(() => {
    if (!intellisense && suggestRef.current) updateSuggest(null);
  }, [intellisense, updateSuggest]);

  const acceptSuggestion = useCallback(
    (item: CompletionItem) => {
      const ta = textareaRef.current;
      const s = suggestRef.current;
      if (!ta || !s) return;
      const lineStart = lineStartOf(ta.value, s.from);
      const baseIndent = ta.value.slice(lineStart, s.from).match(/^[ \t]*/)![0];
      const { text, caret } = expandInsert(item, baseIndent, insertSpaces ? " ".repeat(tabSize) : "\t");
      suppressSuggestRef.current = true;
      replaceRange(ta, s.from, s.to, text, s.from + caret);
      suppressSuggestRef.current = false;
      updateSuggest(null);
    },
    [insertSpaces, tabSize, updateSuggest]
  );

  // Keep the highlighted suggestion scrolled into view.
  useEffect(() => {
    const list = suggestListRef.current;
    if (!list || !suggest) return;
    const top = suggest.index * SUGGEST_ROW_PX;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (top + SUGGEST_ROW_PX > list.scrollTop + list.clientHeight)
      list.scrollTop = top + SUGGEST_ROW_PX - list.clientHeight;
  }, [suggest]);

  const lines = useMemo(() => code.split("\n"), [code]);
  const lineCount = lines.length;

  // Diagnostics grouped per line, most severe first (errors before warnings).
  const diagsByLine = useMemo(() => {
    const map = new Map<number, Diagnostic[]>();
    for (const d of diagnostics) {
      const list = map.get(d.line) ?? [];
      list.push(d);
      map.set(d.line, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          (a.severity === "error" ? 0 : 1) - (b.severity === "error" ? 0 : 1) ||
          a.col - b.col
      );
    }
    return map;
  }, [diagnostics]);

  // Jump the caret to a requested diagnostic position.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!jumpTo || !textarea) return;
    const all = textarea.value.split("\n");
    const lineIdx = Math.min(Math.max(jumpTo.line, 1), all.length) - 1;
    let offset = 0;
    for (let i = 0; i < lineIdx; i++) offset += all[i].length + 1;
    offset += Math.min(Math.max(jumpTo.col - 1, 0), all[lineIdx].length);
    textarea.focus();
    textarea.setSelectionRange(offset, offset);
    textarea.scrollTop = Math.max(
      0,
      lineIdx * LINE_HEIGHT_PX - textarea.clientHeight / 2 + LINE_HEIGHT_PX
    );
    setCursorPos({ line: lineIdx + 1, col: jumpTo.col });
  }, [jumpTo]);

  // Sync scrolling between textarea, gutter, and highlighted code overlay
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    if (suggestRef.current)
      setEditorScroll({ top: scrollTop, left: scrollLeft, height: e.currentTarget.clientHeight });
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = scrollTop;
    }
    if (backdropRef.current) {
      backdropRef.current.scrollTop = scrollTop;
      backdropRef.current.scrollLeft = scrollLeft;
    }
  };

  // Read the caret from the textarea itself (its live value, not the `code`
  // prop, which still holds the previous text during onChange/keydown).
  const updateCursorPosition = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    // The caret is the end of the selection the user is moving.
    const pos =
      textarea.selectionDirection === "backward"
        ? textarea.selectionStart
        : textarea.selectionEnd;
    const textBefore = textarea.value.substring(0, pos);
    const lastNewline = textBefore.lastIndexOf("\n");
    let line = 1;
    for (let i = 0; i < textBefore.length; i++) if (textBefore[i] === "\n") line++;
    const col = pos - lastNewline;
    setCursorPos((prev) => (prev.line === line && prev.col === col ? prev : { line, col }));
  }, []);

  // Follow every caret move: arrow keys (incl. held keys), mouse clicks and
  // drags, and programmatic moves like auto-indent or jump-to-line.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const onSelectionChange = () => {
      if (document.activeElement !== textarea) return;
      updateCursorPosition();
      // Caret moved away from the word being completed → update or close the popup.
      const s = suggestRef.current;
      if (s && !suppressSuggestRef.current && textarea.selectionStart !== s.to) refreshSuggest(false);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    textarea.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      textarea.removeEventListener("selectionchange", onSelectionChange);
    };
  }, [updateCursorPosition, refreshSuggest]);

  // Keyboard navigation & auto-indent
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!e.repeat) {
      onKeyDownSound?.(e.key);
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Enter" && onRunTests) {
      e.preventDefault();
      onRunTests();
      return;
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

    // Ctrl+Space: open suggestions on demand.
    if (e.ctrlKey && (e.key === " " || e.code === "Space")) {
      e.preventDefault();
      refreshSuggest(true, true);
      return;
    }

    // Suggestion popup navigation
    const s = suggestRef.current;
    if (s && !e.nativeEvent.isComposing) {
      const n = s.items.length;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        updateSuggest({ ...s, index: (s.index + step + n) % n });
        return;
      }
      if (e.key === "PageDown" || e.key === "PageUp") {
        e.preventDefault();
        const step = e.key === "PageDown" ? SUGGEST_MAX_ROWS : -SUGGEST_MAX_ROWS;
        updateSuggest({ ...s, index: Math.min(n - 1, Math.max(0, s.index + step)) });
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        acceptSuggestion(s.items[s.index]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        updateSuggest(null);
        return;
      }
    }

    if (e.nativeEvent.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;

    const value = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const indentUnit = insertSpaces ? " ".repeat(tabSize) : "\t";

    if (e.key === "Tab") {
      e.preventDefault();
      const firstLineStart = lineStartOf(value, start);
      // A selection ending at column 0 doesn't include that last line (VS Code behaviour).
      const effectiveEnd = end > start && value[end - 1] === "\n" ? end - 1 : end;
      const multiLine = value.slice(start, effectiveEnd).includes("\n");

      if (!e.shiftKey && !multiLine) {
        // Insert one indentation step, up to the next tab stop.
        const col = visualWidth(value.slice(firstLineStart, start), tabSize);
        const text = insertSpaces ? " ".repeat(tabSize - (col % tabSize)) : "\t";
        replaceRange(textarea, start, end, text, start + text.length);
        updateCursorPosition();
        return;
      }

      // Indent / outdent every line touched by the selection.
      const blockEnd = lineEndOf(value, effectiveEnd);
      const blockLines = value.slice(firstLineStart, blockEnd).split("\n");
      // Per line: [offset of line start in the original text, removed chars, inserted chars]
      const edits: [number, number, number][] = [];
      let offset = firstLineStart;
      const nextLines = blockLines.map((line) => {
        const at = offset;
        offset += line.length + 1;
        if (!e.shiftKey) {
          if (line.trim() === "" && blockLines.length > 1) return line; // skip blank lines
          edits.push([at, 0, indentUnit.length]);
          return indentUnit + line;
        }
        let remove = 0;
        if (line.startsWith("\t")) remove = 1;
        else {
          const spaces = line.match(/^ */)![0].length;
          remove = Math.min(spaces, spaces % tabSize || tabSize);
        }
        if (remove > 0) edits.push([at, remove, 0]);
        return line.slice(remove);
      });
      if (edits.length === 0) return;

      // Map an offset in the old text to the new text. A position exactly at a line
      // start stays before the inserted indent (so a whole-line selection grows to cover it);
      // a position inside removed whitespace collapses to the line start.
      const map = (pos: number) => {
        let shift = 0;
        for (const [at, removed, inserted] of edits) {
          if (pos < at || (pos === at && inserted > 0)) break;
          if (pos <= at + removed) return at + shift;
          shift += inserted - removed;
        }
        return pos + shift;
      };
      replaceRange(textarea, firstLineStart, blockEnd, nextLines.join("\n"), map(start), map(end));
      updateCursorPosition();
      return;
    }

    if (e.key === "Backspace" && !e.shiftKey && start === end && start > 0) {
      // Inside leading whitespace made of spaces: delete back to the previous tab stop.
      const lineStart = lineStartOf(value, start);
      const before = value.slice(lineStart, start);
      if (before.length > 0 && /^ +$/.test(before)) {
        e.preventDefault();
        const remove = before.length % tabSize || tabSize;
        replaceRange(textarea, start - remove, start, "", start - remove);
        updateCursorPosition();
      }
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      // Keep the current line's indentation on the new line.
      const lineStart = lineStartOf(value, start);
      const indent = value.slice(lineStart, start).match(/^[ \t]*/)![0];
      if (indent) {
        e.preventDefault();
        const text = "\n" + indent;
        replaceRange(textarea, start, end, text, start + text.length);
        updateCursorPosition();
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

  return (
    <div className="flex flex-col h-full min-h-0 rounded-xl border border-[#e4e4df] bg-[#ffffff] shadow-sm dark:border-neutral-800 dark:bg-[#0d0f12] dark:shadow-2xl overflow-hidden transition-colors">
      {/* Top Window Header (Option 2 Window Header Style with Light Palette & Dark Toggle) */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#e5e5df] bg-[#fbfbfa] dark:border-neutral-800/90 dark:bg-[#12151b] select-none gap-2">
        <div className="flex items-center gap-3">
          {/* macOS Traffic Lights */}
          <div className="hidden sm:flex items-center gap-1.5 mr-1">
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
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all cursor-pointer font-mono"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Hentikan</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onRun}
              title="Jalankan kode pseudocode (Ctrl + Enter)"
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[#5b45ff] hover:bg-[#4f46e5] text-white shadow-xs dark:bg-emerald-600 dark:hover:bg-emerald-500 transition-all cursor-pointer font-mono"
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
            const lineDiags = diagsByLine.get(lineNum);
            const top = lineDiags?.[0];
            const style = top ? DIAG_STYLE[top.severity] : null;
            const isCurrent = cursorPos.line === lineNum;
            return (
              <div
                key={lineNum}
                title={lineDiags?.map((d) => `• ${d.message}`).join("\n")}
                className={cn(
                  "h-6 leading-6 flex items-center justify-end relative transition-colors",
                  style && cn(style.gutter, style.lineBg, "font-bold"),
                  isCurrent && !style && "text-[#0f172a] font-semibold dark:text-neutral-300"
                )}
              >
                {top?.severity === "error" && (
                  <CircleX className="absolute left-1 w-3 h-3" strokeWidth={2.5} />
                )}
                {top?.severity === "warning" && (
                  <TriangleAlert className="absolute left-1 w-3 h-3" strokeWidth={2.5} />
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
            style={{ tabSize }}
            className="absolute inset-0 pointer-events-none py-3 px-4 font-mono text-sm leading-6 overflow-hidden select-none whitespace-pre m-0 border-0"
          >
            {lines.map((line, idx) => {
              const lineNum = idx + 1;
              const lineDiags = diagsByLine.get(lineNum);
              const top = lineDiags?.[0];
              const diagStyle = top ? DIAG_STYLE[top.severity] : null;
              const isCurrent = cursorPos.line === lineNum;
              const tokens = tokenizeLine(line);
              // The current-line highlight starts after the indent guides so it
              // doesn't tint their colors.
              const guideWidth = isCurrent ? indentGuideWidth(line, settings, true) : 0;

              return (
                <div
                  key={idx}
                  className={cn(
                    "h-6 leading-6 whitespace-pre relative flex items-center",
                    diagStyle && cn(diagStyle.lineBg, "rounded-sm"),
                    isCurrent && !diagStyle && guideWidth === 0 && "bg-[#f8f8f6] dark:bg-neutral-800/20"
                  )}
                >
                  {isCurrent && !diagStyle && guideWidth > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute top-0 bottom-0 right-0 pointer-events-none bg-[#f8f8f6] dark:bg-neutral-800/20"
                      style={{ left: `${guideWidth}ch` }}
                    />
                  )}
                  {/* Squiggly underline under each problem's location */}
                  {lineDiags?.map((d, dIdx) => {
                    const start = visualOffset(line, d.col, tabSize);
                    const text =
                      d.length > 0 ? line.slice(d.col - 1, d.col - 1 + d.length) : "";
                    return (
                      <span
                        key={`sq-${dIdx}`}
                        className="absolute top-0 h-6 leading-6 text-transparent pointer-events-none z-20"
                        style={{
                          left: `${start}ch`,
                          textDecorationLine: "underline",
                          textDecorationStyle: "wavy",
                          textDecorationColor: DIAG_STYLE[d.severity].squiggle,
                          textDecorationSkipInk: "none",
                          textUnderlineOffset: "4px",
                        }}
                      >
                        {text.replace(/\t/g, " ".repeat(tabSize)) || "\u00a0\u00a0"}
                      </span>
                    );
                  })}

                  {/* indent-rainbow style coloring (configurable in the settings popup) */}
                  <IndentGuides line={line} settings={settings} isCurrent={isCurrent} />

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

                  {/* Inline diagnostic message (Error Lens style) */}
                  {top && diagStyle && (
                    <span
                      className={cn(
                        "relative z-10 ml-10 text-[12px] italic font-medium tracking-tight",
                        diagStyle.message
                      )}
                    >
                      {top.message}
                      {lineDiags!.length > 1 && (
                        <span className="not-italic ml-2 px-1 rounded bg-current/10 text-[10px] font-semibold">
                          +{lineDiags!.length - 1}
                        </span>
                      )}
                    </span>
                  )}
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
              if (suppressSuggestRef.current) return;
              const ev = e.nativeEvent as InputEvent;
              const typed = ev.inputType === "insertText" && !!ev.data && /[A-Za-z0-9_.]$/.test(ev.data);
              if (typed) refreshSuggest(true);
              else if (ev.inputType?.startsWith("delete")) refreshSuggest(false);
              else updateSuggest(null);
            }}
            onBlur={() => updateSuggest(null)}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onClick={updateCursorPosition}
            onScroll={handleScroll}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            style={{ tabSize }}
            placeholder="Tulis kode pseudocode di sini (atau muat contoh)..."
            className="relative z-20 w-full h-full resize-none py-3 px-4 bg-transparent outline-none border-none text-transparent caret-[#5b45ff] dark:caret-sky-400 placeholder:text-[#94a3b8] dark:placeholder:text-neutral-600 font-mono text-sm leading-6 code-input overflow-auto whitespace-pre m-0"
          />

          {/* 3. IntelliSense suggestion popup */}
          {suggest && (
            <SuggestWidget
              suggest={suggest}
              code={code}
              tabSize={tabSize}
              scroll={editorScroll}
              listRef={suggestListRef}
              onHover={(index) => updateSuggest({ ...suggest, index })}
              onAccept={acceptSuggestion}
            />
          )}
        </div>
      </div>

      {/* Editor Footer / Status Rail */}
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2 border-t border-[#e5e5df] bg-[#fbfbfa] text-[11px] whitespace-nowrap font-mono text-[#64748b] dark:border-neutral-800/80 dark:bg-[#101318] dark:text-neutral-400 select-none">
        <div className="flex items-center gap-3">
          <span>
            Baris <span className="text-[#0f172a] dark:text-neutral-200 font-semibold">{cursorPos.line}</span>, Kolom{" "}
            <span className="text-[#0f172a] dark:text-neutral-200 font-semibold">{cursorPos.col}</span>
          </span>
          <span className="text-[#cbd5e1] dark:text-neutral-700">|</span>
          <span>{lineCount} baris</span>
          <span className="hidden sm:inline text-[#cbd5e1] dark:text-neutral-700">|</span>
          <span className="hidden sm:inline">{code.length} karakter</span>
        </div>
        {/* Keyboard shortcuts: irrelevant on touch-sized screens */}
        <div className="hidden md:flex items-center gap-2">
          <kbd className="px-1.5 py-0.5 rounded bg-[#edeef0] border border-[#e2e2dc] text-[#334155] dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300 text-[10px]">
            Ctrl + Enter
          </kbd>
          <span>Jalankan</span>
          {onRunTests && (
            <>
              <kbd className="ml-2 hidden sm:inline px-1.5 py-0.5 rounded bg-[#edeef0] border border-[#e2e2dc] text-[#334155] dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300 text-[10px]">
                Ctrl + Shift + Enter
              </kbd>
              <span className="hidden sm:inline">Tes</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** The IntelliSense suggestion list, positioned under (or above) the word being completed. */
function SuggestWidget({
  suggest,
  code,
  tabSize,
  scroll,
  listRef,
  onHover,
  onAccept,
}: {
  suggest: SuggestState;
  code: string;
  tabSize: number;
  scroll: { top: number; left: number; height: number };
  listRef: React.RefObject<HTMLDivElement | null>;
  onHover: (index: number) => void;
  onAccept: (item: CompletionItem) => void;
}) {
  const lineIdx = code.slice(0, suggest.from).split("\n").length - 1;
  const lineText = code.split("\n")[lineIdx] ?? "";
  const col = visualWidth(lineText.slice(0, suggest.from - lineStartOf(code, suggest.from)), tabSize);
  const rows = Math.min(suggest.items.length, SUGGEST_MAX_ROWS);
  const lineTop = PAD_TOP_PX + lineIdx * LINE_HEIGHT_PX - scroll.top;
  const viewH = scroll.height;
  const popupH = rows * SUGGEST_ROW_PX + 60;
  const above = lineTop + LINE_HEIGHT_PX + popupH > viewH && lineTop - popupH > 0;
  const selected = suggest.items[suggest.index];
  return (
    <div
      className="absolute z-30 w-72 max-w-[calc(100%-1rem)] rounded-lg border border-[#e2e2dc] bg-white shadow-lg dark:border-neutral-700 dark:bg-[#161a21] dark:shadow-black/50 text-xs overflow-hidden"
      style={{
        left: `max(0.5rem, min(calc(${PAD_LEFT_PX - scroll.left}px + ${col}ch), calc(100% - 18.5rem)))`,
        ...(above
          ? { bottom: `calc(100% - ${lineTop}px)` }
          : { top: lineTop + LINE_HEIGHT_PX }),
      }}
      onMouseDown={(e) => e.preventDefault()}
      role="listbox"
      aria-label="Saran kode"
    >
      <div
        ref={listRef}
        className="overflow-y-auto"
        style={{ maxHeight: SUGGEST_MAX_ROWS * SUGGEST_ROW_PX }}
      >
        {suggest.items.map((item, i) => {
          const badge = KIND_BADGE[item.kind];
          const active = i === suggest.index;
          const matchLen = item.label.toLowerCase().startsWith(suggest.prefix.toLowerCase())
            ? suggest.prefix.length
            : 0;
          return (
            <div
              key={`${item.kind}:${item.label}`}
              role="option"
              aria-selected={active}
              className={cn(
                "flex items-center gap-2 px-2 cursor-pointer",
                active
                  ? "bg-[#5b45ff]/10 text-[#0f172a] dark:bg-sky-500/15 dark:text-white"
                  : "text-[#334155] hover:bg-[#f1f1ee] dark:text-neutral-300 dark:hover:bg-neutral-800/60"
              )}
              style={{ height: SUGGEST_ROW_PX }}
              onMouseEnter={() => onHover(i)}
              onClick={() => onAccept(item)}
            >
              <span
                className={cn(
                  "w-5 h-4 shrink-0 rounded text-[10px] font-bold leading-4 text-center",
                  badge.className
                )}
              >
                {badge.label}
              </span>
              <span className="truncate">
                <span className="font-bold text-[#5b45ff] dark:text-sky-300">
                  {item.label.slice(0, matchLen)}
                </span>
                {item.label.slice(matchLen)}
              </span>
              {item.detail && (
                <span className="ml-auto pl-2 truncate text-[10px] text-[#94a3b8] dark:text-neutral-500">
                  {item.detail}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {selected?.doc && (
        <div className="px-2.5 py-1.5 border-t border-[#ecece7] bg-[#fbfbfa] text-[11px] leading-snug text-[#475569] dark:border-neutral-800 dark:bg-[#12151b] dark:text-neutral-400 whitespace-normal">
          {selected.doc}
        </div>
      )}
    </div>
  );
}
