"use client";

import React, { useMemo, useState } from "react";
import { Check, Copy, Download, CircleX } from "lucide-react";
import { transpileToGo } from "@/lib/engine";
import { TOKEN_STYLE, type TokenType } from "@/lib/syntax-highlighter";

const GO_KEYWORDS = new Set([
  "break", "case", "chan", "const", "continue", "default", "defer", "else", "fallthrough",
  "for", "func", "go", "goto", "if", "import", "interface", "map", "package", "range",
  "return", "select", "struct", "switch", "type", "var",
]);
const GO_TYPES = new Set(["int", "int64", "float64", "string", "bool", "rune", "byte"]);
const GO_BOOLS = new Set(["true", "false", "nil"]);

/** Minimal Go highlighter: comments, strings/runes, numbers, keywords, types, calls. */
function tokenizeGo(line: string): { text: string; type: TokenType }[] {
  const out: { text: string; type: TokenType }[] = [];
  const re =
    /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)|([A-Za-z_]\w*)|(\s+)|([^\sA-Za-z_\d"']+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const [text, comment, str, num, word] = m;
    let type: TokenType = "plain";
    if (comment) type = "comment";
    else if (str) type = "string";
    else if (num) type = "number";
    else if (word) {
      if (GO_KEYWORDS.has(word)) type = "keyword";
      else if (GO_TYPES.has(word)) type = "type";
      else if (GO_BOOLS.has(word)) type = "boolean";
      else if (line[re.lastIndex] === "(") type = "function";
      else type = "identifier";
    } else if (m[6]) type = /^[(){}[\],.;]+$/.test(text) ? "punctuation" : "operator";
    out.push({ text, type });
  }
  return out;
}

/** The "Go" results tab: the current program converted to Go, ready to copy or download. */
export function GoView({ code }: { code: string }) {
  const result = useMemo(() => (code.trim() ? transpileToGo(code) : null), [code]);
  const [copied, setCopied] = useState(false);

  if (!result) {
    return (
      <div className="h-full flex items-center justify-center text-[#64748b] dark:text-neutral-500 p-6 text-center">
        Tulis program pseudocode untuk melihat hasil konversinya ke Go.
      </div>
    );
  }

  if (!result.ok) {
    const err = result.error as Error & { line?: number };
    return (
      <div className="h-full overflow-y-auto p-4">
        <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <CircleX className="w-4 h-4 shrink-0 mt-px" />
          <div className="space-y-1 leading-relaxed">
            <div className="font-semibold">Program belum bisa dikonversi ke Go.</div>
            <div>
              {err.line ? `Baris ${err.line}: ` : ""}
              {err.message}
            </div>
            <div className="text-rose-600/80 dark:text-rose-300/70">
              Perbaiki kesalahan di tab Masalah terlebih dahulu.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const goCode = result.code;
  const lines = goCode.replace(/\n$/, "").split("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(goCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: nothing else to do.
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([goCode], { type: "text/x-go" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "main.go";
    a.click();
    URL.revokeObjectURL(url);
  };

  const btn =
    "inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[#e2e2dc] bg-[#f8f8f6] hover:bg-[#edeef0] text-[#475569] hover:text-[#0f172a] dark:border-neutral-700/80 dark:bg-neutral-800/80 dark:text-neutral-300 dark:hover:text-white transition-colors cursor-pointer text-[11px]";

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-[#ecece7] dark:border-neutral-800/80 text-[11px] text-[#64748b] dark:text-neutral-400">
        <span className="truncate">
          <span className="font-semibold text-[#0f172a] dark:text-neutral-200">main.go</span>
          <span className="hidden sm:inline"> · jalankan dengan </span>
          <code className="hidden sm:inline px-1 rounded bg-[#f1f1ee] dark:bg-neutral-800">go run main.go</code>
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={copy} className={btn} title="Salin kode Go">
            {copied ? <Check className="w-3 h-3 text-[#16a34a]" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? "Disalin" : "Salin"}</span>
          </button>
          <button type="button" onClick={download} className={btn} title="Unduh sebagai main.go">
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Unduh</span>
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <pre className="m-0 py-2 text-xs leading-5" style={{ tabSize: 4 }}>
          {lines.map((line, i) => (
            <div key={i} className="flex">
              <span className="sticky left-0 w-10 shrink-0 pr-3 text-right select-none text-[#94a3b8] dark:text-neutral-600 bg-[#ffffff] dark:bg-[#0d0f12]">
                {i + 1}
              </span>
              <code className="whitespace-pre pr-4">
                {tokenizeGo(line).map((t, j) => {
                  const style = TOKEN_STYLE[t.type];
                  return (
                    <span
                      key={j}
                      style={{ color: style.color, fontWeight: style.fontWeight, fontStyle: style.fontStyle }}
                    >
                      {t.text}
                    </span>
                  );
                })}
                {line === "" && " "}
              </code>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
