"use client";

import { useSyncExternalStore } from "react";

/**
 * Keyboard-sound volume (0–1), persisted in localStorage.
 *
 * Read through useSyncExternalStore so the server render and the first client
 * render both use the default; the saved value is applied right after hydration
 * (reading localStorage in a useState initializer causes a hydration mismatch).
 */

const STORAGE_KEY = "pseudo-sound-volume";
export const DEFAULT_SOUND_VOLUME = 0.7;

let cache: number | null = null;
const listeners = new Set<() => void>();

function parse(raw: string | null): number {
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : DEFAULT_SOUND_VOLUME;
}

function getSnapshot(): number {
  if (cache !== null) return cache;
  try {
    cache = parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    cache = DEFAULT_SOUND_VOLUME;
  }
  return cache;
}

const getServerSnapshot = () => DEFAULT_SOUND_VOLUME;

function subscribe(listener: () => void) {
  listeners.add(listener);
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

export function setSoundVolume(volume: number) {
  cache = Math.min(1, Math.max(0, volume));
  try {
    localStorage.setItem(STORAGE_KEY, String(cache));
  } catch {
    // Storage unavailable: still applies for this session.
  }
  listeners.forEach((l) => l());
}

export function useSoundVolume(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
