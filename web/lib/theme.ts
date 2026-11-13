"use client";

import { useSyncExternalStore } from "react";

/** User's theme choice. "system" follows the OS light/dark setting. */
export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "pseudo-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "dark" || saved === "system" ? saved : "light";
  } catch {
    return "light";
  }
}

function resolveDark(pref: ThemePreference): boolean {
  return pref === "dark" || (pref === "system" && window.matchMedia(DARK_QUERY).matches);
}

/** Put the `dark` class on <html> to match the preference. */
function apply(pref: ThemePreference) {
  document.documentElement.classList.toggle("dark", resolveDark(pref));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia(DARK_QUERY);
  const onSystemChange = () => {
    if (readPreference() === "system") {
      apply("system");
      listener();
    }
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      apply(readPreference());
      listener();
    }
  };
  media.addEventListener("change", onSystemChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onSystemChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function setThemePreference(pref: ThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Storage unavailable: the theme still applies for this page view.
  }
  apply(pref);
  listeners.forEach((l) => l());
}

/** The saved choice (light / dark / system). */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, readPreference, () => "light");
}

/** Whether the page is currently dark (after resolving "system"). */
export function useIsDark(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => resolveDark(readPreference()),
    () => false
  );
}
