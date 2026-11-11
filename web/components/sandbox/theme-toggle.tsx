"use client";

import { useState, useTransition } from "react";
import { Moon, Sun } from "lucide-react";

interface ThemeToggleProps {
  onToggleSound?: () => void;
}

export function ThemeToggle({ onToggleSound }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("pseudo-theme") !== "light";
  });
  const [, startTransition] = useTransition();

  const toggle = () => {
    onToggleSound?.();
    startTransition(() => {
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
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-neutral-700/60 bg-neutral-800/60 hover:bg-neutral-700/80 text-neutral-300 hover:text-white transition-all cursor-pointer dark:border-neutral-700 dark:bg-neutral-800"
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 text-sky-400" />
      )}
    </button>
  );
}
