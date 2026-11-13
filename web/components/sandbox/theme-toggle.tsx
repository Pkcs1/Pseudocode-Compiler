"use client";

import { Moon, Sun } from "lucide-react";
import { setThemePreference, useIsDark } from "@/lib/theme";

interface ThemeToggleProps {
  onToggleSound?: () => void;
}

/** Quick light/dark switch (used on the docs page; the editor uses the settings popup). */
export function ThemeToggle({ onToggleSound }: ThemeToggleProps) {
  const isDark = useIsDark();

  const toggle = () => {
    onToggleSound?.();
    setThemePreference(isDark ? "light" : "dark");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "Ganti ke mode terang (Light Mode)" : "Ganti ke mode gelap (Dark Mode)"}
      className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-[#e2e2dc] bg-[#fbfbfa] hover:bg-[#edeef0] text-[#475569] hover:text-[#0f172a] transition-all cursor-pointer dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:text-white"
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 text-[#5b45ff]" />
      )}
    </button>
  );
}
