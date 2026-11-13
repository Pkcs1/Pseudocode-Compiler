"use client";

import { useSyncExternalStore } from "react";

/** How indent-rainbow paints each indentation level. */
export type RainbowStyle = "fill" | "line" | "both";

export interface EditorSettings {
  /** Width of one indentation level, in columns. */
  tabSize: 2 | 4 | 8;
  /** Tab inserts spaces (VS Code's `editor.insertSpaces`) instead of a `\t` character. */
  insertSpaces: boolean;
  rainbow: {
    enabled: boolean;
    style: RainbowStyle;
    /** Colors cycled per indentation level, as `#rrggbb`. */
    colors: string[];
    /** Strength of the fill color, 0–1. Lines are drawn a bit stronger. */
    opacity: number;
    /** Paint indentation that isn't a multiple of the tab size in red (indent-rainbow's errorColor). */
    highlightErrors: boolean;
  };
}

export const RAINBOW_PRESETS: { id: string; label: string; colors: string[] }[] = [
  { id: "default", label: "Bawaan", colors: ["#6366f1", "#14b8a6", "#a855f7", "#f59e0b", "#f43f5e"] },
  { id: "indent-rainbow", label: "Indent Rainbow", colors: ["#ffff40", "#7fff7f", "#ff7fff", "#4fecec"] },
  { id: "pastel", label: "Pastel", colors: ["#fca5a5", "#fdba74", "#fde047", "#86efac", "#93c5fd", "#c4b5fd"] },
  { id: "mono", label: "Monokrom", colors: ["#94a3b8"] },
];

export const MAX_RAINBOW_COLORS = 8;

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  tabSize: 4,
  insertSpaces: true,
  rainbow: {
    enabled: true,
    style: "fill",
    colors: RAINBOW_PRESETS[0].colors,
    opacity: 0.1,
    highlightErrors: true,
  },
};

const STORAGE_KEY = "pseudo-editor-settings";
const HEX = /^#[0-9a-f]{6}$/i;

/** Accept whatever is stored, falling back to defaults for anything missing or invalid. */
function normalize(raw: unknown): EditorSettings {
  const d = DEFAULT_EDITOR_SETTINGS;
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Omit<Partial<EditorSettings>, "rainbow"> & { rainbow?: Partial<EditorSettings["rainbow"]> };
  const rb: Partial<EditorSettings["rainbow"]> = r.rainbow ?? {};
  const colors = Array.isArray(rb.colors)
    ? rb.colors.filter((c): c is string => typeof c === "string" && HEX.test(c)).slice(0, MAX_RAINBOW_COLORS)
    : [];
  return {
    tabSize: r.tabSize === 2 || r.tabSize === 4 || r.tabSize === 8 ? r.tabSize : d.tabSize,
    insertSpaces: typeof r.insertSpaces === "boolean" ? r.insertSpaces : d.insertSpaces,
    rainbow: {
      enabled: typeof rb.enabled === "boolean" ? rb.enabled : d.rainbow.enabled,
      style: rb.style === "fill" || rb.style === "line" || rb.style === "both" ? rb.style : d.rainbow.style,
      colors: colors.length > 0 ? colors : d.rainbow.colors,
      opacity:
        typeof rb.opacity === "number" && rb.opacity >= 0 && rb.opacity <= 1 ? rb.opacity : d.rainbow.opacity,
      highlightErrors:
        typeof rb.highlightErrors === "boolean" ? rb.highlightErrors : d.rainbow.highlightErrors,
    },
  };
}

// --- Tiny external store (shared by the editor and the settings popup) ---

let cache: EditorSettings | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): EditorSettings {
  if (cache) return cache;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    cache = saved ? normalize(JSON.parse(saved)) : DEFAULT_EDITOR_SETTINGS;
  } catch {
    cache = DEFAULT_EDITOR_SETTINGS;
  }
  return cache;
}

const getServerSnapshot = () => DEFAULT_EDITOR_SETTINGS;

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep several open tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function updateEditorSettings(update: (prev: EditorSettings) => EditorSettings) {
  cache = normalize(update(getSnapshot()));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Storage unavailable (private mode etc.): settings still apply for this session.
  }
  listeners.forEach((l) => l());
}

export function resetEditorSettings() {
  updateEditorSettings(() => DEFAULT_EDITOR_SETTINGS);
}

export function useEditorSettings(): EditorSettings {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// --- Helpers shared by the editor and the settings preview ---

export function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Visual width (in columns) of `text`, expanding tabs to the next tab stop. */
export function visualWidth(text: string, tabSize: number): number {
  let vis = 0;
  for (const ch of text) vis = ch === "\t" ? (Math.floor(vis / tabSize) + 1) * tabSize : vis + 1;
  return vis;
}
