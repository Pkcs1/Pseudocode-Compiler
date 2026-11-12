"use client";

import React, { useState } from "react";
import { X, Code2, Copy, Check } from "lucide-react";

interface AstInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  ast: Record<string, unknown> | null;
}

export function AstInspectorModal({ isOpen, onClose, ast }: AstInspectorModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const jsonString = ast ? JSON.stringify(ast, null, 2) : "Tidak ada Abstract Syntax Tree (AST)";

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border border-neutral-800 bg-neutral-950 text-neutral-100 shadow-2xl overflow-hidden font-mono text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 bg-neutral-900/80">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 mr-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-purple-400" />
              <span className="font-semibold text-sm text-white">
                Abstract Syntax Tree (AST) Inspector
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Disalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin JSON</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-auto p-4 bg-neutral-950">
          <pre className="font-mono text-xs leading-5 text-purple-200/90 whitespace-pre overflow-x-auto selection:bg-purple-500/30">
            {jsonString}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-neutral-800 bg-neutral-900/60 text-[11px] text-neutral-400 flex items-center justify-between">
          <span>Struktur pohon sintaks hasil parser engine</span>
          <span>Esc untuk menutup</span>
        </div>
      </div>
    </div>
  );
}
