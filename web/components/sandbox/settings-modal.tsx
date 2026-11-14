"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Trash2, RotateCcw, Palette, IndentIncrease, Rainbow, Sun, Moon, Monitor, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EditorSettings,
  RainbowStyle,
  RAINBOW_PRESETS,
  MAX_RAINBOW_COLORS,
  DEFAULT_EDITOR_SETTINGS,
  useEditorSettings,
  updateEditorSettings,
} from "@/lib/editor-settings";
import { ThemePreference, setThemePreference, useThemePreference } from "@/lib/theme";
import { IndentGuides } from "./indent-guides";

type TabId = "appearance" | "editor" | "rainbow";

const TABS: { id: TabId; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "appearance", label: "Tampilan", description: "Pilih tema terang, gelap, atau ikuti sistem.", icon: Palette },
  { id: "editor", label: "Editor", description: "Atur IntelliSense serta cara tombol Tab dan Backspace bekerja di editor.", icon: IndentIncrease },
  { id: "rainbow", label: "Indent Rainbow", description: "Warnai setiap tingkat indentasi agar struktur kode mudah dibaca.", icon: Rainbow },
];

const PREVIEW_LINES = [
  "algoritma",
  "    i <- 1",
  "    while i <= n do",
  "        if i mod 2 = 0 then",
  "            output(i)",
  "        endif",
  "       i <- i + 1",
  "    endwhile",
];

// ---------- Small building blocks ----------

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex p-0.5 rounded-lg bg-[#f1f1ee] border border-[#e2e2dc] dark:bg-neutral-950/80 dark:border-neutral-800">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap",
            value === o.value
              ? "bg-white text-[#0f172a] shadow-xs dark:bg-neutral-800 dark:text-white"
              : "text-[#64748b] hover:text-[#0f172a] dark:text-neutral-400 dark:hover:text-neutral-200"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer",
        checked ? "bg-[#5b45ff] dark:bg-emerald-600" : "bg-[#d4d4cf] dark:bg-neutral-700"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-[#0f172a] dark:text-neutral-200">{title}</div>
        {hint && <div className="text-[11px] text-[#64748b] dark:text-neutral-500 leading-4 mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 rounded bg-[#edeef0] border border-[#e2e2dc] text-[#334155] dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300 text-[10px]">
      {children}
    </kbd>
  );
}

const setRainbow = (patch: Partial<EditorSettings["rainbow"]>) =>
  updateEditorSettings((s) => ({ ...s, rainbow: { ...s.rainbow, ...patch } }));

// ---------- Tab: Appearance ----------

/** Miniature editor mock-up shown in each theme card. */
function ThemeThumb({ dark }: { dark: boolean }) {
  return (
    <div className={cn("h-full w-full p-2 flex flex-col gap-1.5", dark ? "bg-[#0d0f12]" : "bg-[#eef0f4]")}>
      <div className={cn("h-2 rounded-sm", dark ? "bg-neutral-800" : "bg-white")} />
      <div className={cn("flex-1 rounded-sm p-1.5 space-y-1", dark ? "bg-[#12151b]" : "bg-white")}>
        <div className={cn("h-1 w-8 rounded-full", dark ? "bg-sky-400/70" : "bg-[#5b45ff]/70")} />
        <div className="flex gap-1">
          <div className="h-1 w-2 rounded-full bg-transparent" />
          <div className={cn("h-1 w-10 rounded-full", dark ? "bg-neutral-600" : "bg-slate-300")} />
        </div>
        <div className="flex gap-1">
          <div className="h-1 w-2 rounded-full bg-transparent" />
          <div className={cn("h-1 w-6 rounded-full", dark ? "bg-emerald-400/60" : "bg-emerald-500/60")} />
        </div>
      </div>
    </div>
  );
}

function AppearanceTab({ onSound }: { onSound?: () => void }) {
  const theme = useThemePreference();
  const options: { value: ThemePreference; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: "light", label: "Terang", icon: Sun },
    { value: "dark", label: "Gelap", icon: Moon },
    { value: "system", label: "Sistem", icon: Monitor },
  ];
  return (
    <div className="py-3">
      <div className="text-xs font-semibold text-[#0f172a] dark:text-neutral-200">Tema</div>
      <div className="text-[11px] text-[#64748b] dark:text-neutral-500 mt-0.5 mb-3">
        &quot;Sistem&quot; mengikuti pengaturan terang/gelap perangkat Anda.
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {options.map(({ value, label, icon: Icon }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => {
                if (!active) onSound?.();
                setThemePreference(value);
              }}
              className="group text-left cursor-pointer"
            >
              <div
                className={cn(
                  "relative h-20 rounded-xl overflow-hidden border-2 transition-colors",
                  active
                    ? "border-[#5b45ff] dark:border-sky-400"
                    : "border-[#e2e2dc] group-hover:border-[#c7c7c0] dark:border-neutral-700 dark:group-hover:border-neutral-500"
                )}
              >
                {value === "system" ? (
                  <div className="flex h-full">
                    <div className="w-1/2 overflow-hidden"><ThemeThumb dark={false} /></div>
                    <div className="w-1/2 overflow-hidden"><ThemeThumb dark /></div>
                  </div>
                ) : (
                  <ThemeThumb dark={value === "dark"} />
                )}
                {active && (
                  <span className="absolute top-1.5 right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-[#5b45ff] dark:bg-sky-500 text-white">
                    <Check className="w-2.5 h-2.5" strokeWidth={3} />
                  </span>
                )}
              </div>
              <div
                className={cn(
                  "mt-1.5 flex items-center gap-1.5 text-[11px] font-medium",
                  active ? "text-[#0f172a] dark:text-white" : "text-[#64748b] dark:text-neutral-400"
                )}
              >
                <Icon className="w-3 h-3" />
                {label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Tab: Indentation ----------

function EditorTab({ settings }: { settings: EditorSettings }) {
  return (
    <div className="divide-y divide-[#f1f1ee] dark:divide-neutral-800">
      <Row title="Ukuran tab" hint="Lebar satu tingkat indentasi (dalam spasi).">
        <Segmented
          value={settings.tabSize}
          options={[
            { value: 2, label: "2" },
            { value: 4, label: "4" },
            { value: 8, label: "8" },
          ]}
          onChange={(v) => updateEditorSettings((s) => ({ ...s, tabSize: v }))}
        />
      </Row>
      <Row title="Tombol Tab menyisipkan" hint="Spasi disarankan agar tampilan kode sama di mana pun.">
        <Segmented
          value={settings.insertSpaces ? "spaces" : "tab"}
          options={[
            { value: "spaces", label: "Spasi" },
            { value: "tab", label: "Karakter Tab" },
          ]}
          onChange={(v) => updateEditorSettings((s) => ({ ...s, insertSpaces: v === "spaces" }))}
        />
      </Row>
      <Row title="IntelliSense" hint="Tampilkan saran kode otomatis saat mengetik.">
        <Switch
          checked={settings.intellisense}
          onChange={(v) => updateEditorSettings((s) => ({ ...s, intellisense: v }))}
          label="IntelliSense"
        />
      </Row>
      <Row
        title="Tutup blok otomatis"
        hint="Enter setelah if … then, for … do, while … do, repeat, atau program menambahkan endif/endfor/endwhile/until/endprogram."
      >
        <Switch
          checked={settings.autoCloseBlocks}
          onChange={(v) => updateEditorSettings((s) => ({ ...s, autoCloseBlocks: v }))}
          label="Tutup blok otomatis"
        />
      </Row>
      <div className="py-3">
        <div className="text-xs font-semibold text-[#0f172a] dark:text-neutral-200 mb-2">Pintasan keyboard</div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-[11px] text-[#475569] dark:text-neutral-400">
          <dt><Kbd>Tab</Kbd></dt>
          <dd>Tambah satu tingkat indentasi (semua baris jika beberapa baris dipilih)</dd>
          <dt><Kbd>Shift + Tab</Kbd></dt>
          <dd>Kurangi satu tingkat indentasi</dd>
          <dt><Kbd>Backspace</Kbd></dt>
          <dd>Di awal baris, hapus satu tingkat indentasi sekaligus</dd>
          <dt><Kbd>Enter</Kbd></dt>
          <dd>Baris baru mengikuti indentasi; setelah <code>if … then</code>, <code>for … do</code>, dst. penutupnya ditambahkan otomatis</dd>
          <dt><Kbd>Ctrl + = / -</Kbd></dt>
          <dd>Perbesar / perkecil kode saja (juga Ctrl + scroll); <Kbd>Ctrl + 0</Kbd> kembali ke 100%</dd>
          <dt><Kbd>Ctrl + Space</Kbd></dt>
          <dd>Buka saran kode (IntelliSense)</dd>
          <dt><Kbd>↑ / ↓</Kbd></dt>
          <dd>Pilih saran; <Kbd>Enter</Kbd>/<Kbd>Tab</Kbd> sisipkan, <Kbd>Esc</Kbd> tutup</dd>
          <dt><Kbd>Ctrl + ,</Kbd></dt>
          <dd>Buka pengaturan ini</dd>
        </dl>
      </div>
    </div>
  );
}

// ---------- Tab: Indent rainbow ----------

function RainbowTab({ settings }: { settings: EditorSettings }) {
  const { rainbow } = settings;
  const activePreset = RAINBOW_PRESETS.find(
    (p) => p.colors.length === rainbow.colors.length && p.colors.every((c, i) => c === rainbow.colors[i])
  )?.id;
  const setColor = (idx: number, color: string) =>
    setRainbow({ colors: rainbow.colors.map((c, i) => (i === idx ? color : c)) });

  return (
    <div className="divide-y divide-[#f1f1ee] dark:divide-neutral-800">
      <Row title="Warnai indentasi" hint="Setiap tingkat indentasi diberi warna berbeda.">
        <Switch checked={rainbow.enabled} onChange={(v) => setRainbow({ enabled: v })} label="Warnai indentasi" />
      </Row>

      <div className={cn("divide-y divide-[#f1f1ee] dark:divide-neutral-800", !rainbow.enabled && "opacity-50 pointer-events-none")}>
        <Row title="Gaya">
          <Segmented<RainbowStyle>
            value={rainbow.style}
            options={[
              { value: "fill", label: "Blok" },
              { value: "line", label: "Garis" },
              { value: "both", label: "Keduanya" },
            ]}
            onChange={(v) => setRainbow({ style: v })}
          />
        </Row>

        <Row title="Intensitas" hint={`${Math.round(rainbow.opacity * 100)}%`}>
          <input
            type="range"
            min={0.03}
            max={0.35}
            step={0.01}
            value={rainbow.opacity}
            onChange={(e) => setRainbow({ opacity: Number(e.target.value) })}
            className="w-28 sm:w-32 accent-[#5b45ff] dark:accent-emerald-500 cursor-pointer"
            aria-label="Intensitas warna"
          />
        </Row>

        <Row title="Tandai indentasi tidak rata" hint="Merah jika indentasi bukan kelipatan ukuran tab.">
          <Switch
            checked={rainbow.highlightErrors}
            onChange={(v) => setRainbow({ highlightErrors: v })}
            label="Tandai indentasi tidak rata"
          />
        </Row>

        <div className="py-3 space-y-2.5">
          <div className="text-xs font-semibold text-[#0f172a] dark:text-neutral-200">Warna</div>
          <div className="flex flex-wrap gap-1">
            {RAINBOW_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setRainbow({ colors: p.colors })}
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] cursor-pointer transition-colors",
                  activePreset === p.id
                    ? "border-[#5b45ff] text-[#4f46e5] bg-[#ede9fe] dark:border-sky-500/60 dark:text-sky-300 dark:bg-sky-500/10"
                    : "border-[#e2e2dc] text-[#475569] hover:bg-[#f1f1ee] dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
                )}
              >
                <span className="flex">
                  {p.colors.slice(0, 4).map((c) => (
                    <span key={c} className="w-1.5 h-2.5 first:rounded-l-sm last:rounded-r-sm" style={{ background: c }} />
                  ))}
                </span>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {rainbow.colors.map((color, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1 pl-1 pr-1.5 py-1 rounded-lg border border-[#e2e2dc] bg-[#fbfbfa] dark:border-neutral-700 dark:bg-neutral-800/60"
              >
                <label className="relative w-6 h-6 rounded-md overflow-hidden border border-black/10 cursor-pointer" style={{ background: color }}>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(idx, e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    aria-label={`Warna tingkat ${idx + 1}`}
                  />
                </label>
                <span className="text-[10px] text-[#64748b] dark:text-neutral-400 tabular-nums">{idx + 1}</span>
                {rainbow.colors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setRainbow({ colors: rainbow.colors.filter((_, i) => i !== idx) })}
                    title="Hapus warna"
                    className="p-0.5 rounded text-[#94a3b8] hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            {rainbow.colors.length < MAX_RAINBOW_COLORS && (
              <button
                type="button"
                onClick={() =>
                  setRainbow({
                    colors: [...rainbow.colors, RAINBOW_PRESETS[0].colors[rainbow.colors.length % RAINBOW_PRESETS[0].colors.length]],
                  })
                }
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-dashed border-[#d4d4cf] text-[11px] text-[#64748b] hover:text-[#0f172a] hover:border-[#a5b4fc] dark:border-neutral-700 dark:text-neutral-400 dark:hover:text-white cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                Warna
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className="py-3">
        <div className="text-xs font-semibold text-[#0f172a] dark:text-neutral-200 mb-2">Pratinjau</div>
        <pre
          className="py-2 px-3 rounded-xl border border-[#e5e5df] bg-[#ffffff] text-[12px] leading-5 text-[#334155] overflow-x-auto dark:border-neutral-800 dark:bg-[#0d0f12] dark:text-neutral-300"
          style={{ tabSize: settings.tabSize }}
        >
          {PREVIEW_LINES.map((l, i) => {
            // Re-express the 4-space sample in the chosen indentation unit.
            const spaces = l.match(/^ */)![0].length;
            const unit = settings.insertSpaces ? " ".repeat(settings.tabSize) : "\t";
            const line = unit.repeat(Math.floor(spaces / 4)) + " ".repeat(spaces % 4) + l.trimStart();
            return (
              <div key={i} className="relative h-5 whitespace-pre">
                <IndentGuides line={line} settings={settings} />
                <span className="relative">{line}</span>
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}

// ---------- Modal ----------

export function SettingsModal({
  open,
  onClose,
  onSound,
}: {
  open: boolean;
  onClose: () => void;
  /** Click sound played when the theme changes. */
  onSound?: () => void;
}) {
  const settings = useEditorSettings();
  const [tab, setTab] = useState<TabId>("appearance");
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const current = TABS.find((t) => t.id === tab)!;
  const resetTab = () => {
    if (tab === "appearance") setThemePreference("light");
    else if (tab === "editor")
      updateEditorSettings((s) => ({
        ...s,
        tabSize: DEFAULT_EDITOR_SETTINGS.tabSize,
        insertSpaces: DEFAULT_EDITOR_SETTINGS.insertSpaces,
        intellisense: DEFAULT_EDITOR_SETTINGS.intellisense,
        autoCloseBlocks: DEFAULT_EDITOR_SETTINGS.autoCloseBlocks,
        fontSize: DEFAULT_EDITOR_SETTINGS.fontSize,
      }));
    else updateEditorSettings((s) => ({ ...s, rainbow: DEFAULT_EDITOR_SETTINGS.rainbow }));
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px] sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
        className="w-full sm:max-w-3xl h-[88dvh] sm:h-[min(600px,85dvh)] flex flex-col sm:flex-row overflow-hidden rounded-t-2xl sm:rounded-2xl border border-[#e2e2dc] bg-white shadow-2xl outline-none font-mono dark:border-neutral-800 dark:bg-neutral-900"
      >
        {/* Sidebar (desktop) / tab strip (mobile) */}
        <nav className="shrink-0 sm:w-52 border-b sm:border-b-0 sm:border-r border-[#e5e5df] bg-[#fbfbfa] dark:border-neutral-800 dark:bg-[#12151b]">
          <div className="flex items-center justify-between px-4 pt-3 pb-2 sm:pt-4 sm:pb-3">
            <h2 id="settings-title" className="text-sm font-bold text-[#0f172a] dark:text-white">
              Pengaturan
            </h2>
            <button
              type="button"
              onClick={onClose}
              title="Tutup (Esc)"
              className="sm:hidden p-1 rounded-md text-[#64748b] hover:text-[#0f172a] hover:bg-[#edeef0] dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div role="tablist" aria-orientation="vertical" className="flex sm:flex-col gap-1 px-2 pb-2 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`settings-tab-${id}`}
                aria-selected={tab === id}
                aria-controls="settings-panel"
                onClick={() => setTab(id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap text-left transition-colors cursor-pointer",
                  tab === id
                    ? "bg-[#ede9fe] text-[#4f46e5] dark:bg-neutral-800 dark:text-white"
                    : "text-[#475569] hover:bg-[#f1f1ee] hover:text-[#0f172a] dark:text-neutral-400 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-200"
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <section
          id="settings-panel"
          role="tabpanel"
          aria-labelledby={`settings-tab-${tab}`}
          className="flex-1 min-h-0 min-w-0 flex flex-col"
        >
          <header className="flex items-start justify-between gap-3 px-4 sm:px-6 pt-4 pb-3 border-b border-[#f1f1ee] dark:border-neutral-800">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#0f172a] dark:text-white">{current.label}</h3>
              <p className="text-[11px] text-[#64748b] dark:text-neutral-500 mt-0.5">{current.description}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              title="Tutup (Esc)"
              className="hidden sm:inline-flex p-1 rounded-md text-[#64748b] hover:text-[#0f172a] hover:bg-[#edeef0] dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6">
            {tab === "appearance" && <AppearanceTab onSound={onSound} />}
            {tab === "editor" && <EditorTab settings={settings} />}
            {tab === "rainbow" && <RainbowTab settings={settings} />}
          </div>

          <footer className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-t border-[#e5e5df] dark:border-neutral-800">
            <button
              type="button"
              onClick={resetTab}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f1ee] dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Kembalikan default
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#5b45ff] hover:bg-[#4f46e5] text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 cursor-pointer"
            >
              Selesai
            </button>
          </footer>
        </section>
      </div>
    </div>,
    document.body
  );
}
