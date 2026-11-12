"use client";

import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";

interface ThemeToggleProps {
  onToggleSound?: () => void;
}

export function ThemeToggle({ onToggleSound }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    const saved = localStorage.getItem("pseudo-theme");
    const active = saved === "dark";
    setIsDark(active);
    if (active) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggle = () => {
    onToggleSound?.();
    setIsDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("pseudo-theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("pseudo-theme", "light");
      }
      return next;
    });
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
