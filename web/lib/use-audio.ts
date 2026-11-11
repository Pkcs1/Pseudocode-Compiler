"use client";

import { useEffect, useRef } from "react";

// 12 authentic mechanical key switch click variations extracted from user's audio
const DOWN_VARIATIONS: Array<[number, number]> = [
  [315, 85],   // var 1 - crisp click
  [470, 85],   // var 2 - mid click
  [570, 85],   // var 3 - sharp tactile click
  [1690, 85],  // var 4 - deep thock
  [1890, 85],  // var 5 - snappy click
  [2168, 85],  // var 6 - solid downstroke
  [3088, 85],  // var 7 - pronounced click
  [3225, 85],  // var 8 - clean tactile bump
  [5455, 85],  // var 9 - firm click
  [6588, 85],  // var 10 - sharp clack
  [7040, 85],  // var 11 - bright click
  [7238, 85],  // var 12 - resonant click
];

// 6 authentic mechanical release / upstroke variations
const UP_VARIATIONS: Array<[number, number]> = [
  [759, 70],
  [1062, 70],
  [1515, 70],
  [3456, 70],
  [5353, 70],
  [6367, 70],
];

const ENTER_DOWN: [number, number] = [7680, 115]; // Deep, heavy enter clack
const ENTER_UP: [number, number] = [7778, 70];
const SPACE_DOWN: [number, number] = [2665, 100]; // Wide, solid spacebar thock
const SPACE_UP: [number, number] = [2748, 70];
const BACKSPACE_DOWN: [number, number] = [5455, 90];

export function useAudioSprite(enabled: boolean, volume: number = 0.7) {
  const ctxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const readyRef = useRef(false);
  const strokeCounterRef = useRef(0);

  useEffect(() => {
    readyRef.current = false;
    if (!enabled || volume <= 0) return;

    const controller = new AbortController();
    let context: AudioContext | null = null;
    let started = false;

    const removeListeners = () => {
      window.removeEventListener("click", initAudio);
      window.removeEventListener("keydown", initAudio);
      window.removeEventListener("touchstart", initAudio);
    };

    async function initAudio() {
      if (started) return;
      started = true;
      removeListeners();

      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        context = new AudioCtx();
        ctxRef.current = context;
        void context.resume().catch(() => {});

        const response = await fetch("/sounds/sound.ogg", {
          signal: controller.signal,
        });
        if (!response.ok || controller.signal.aborted) return;
        const bytes = await response.arrayBuffer();
        if (controller.signal.aborted) return;
        const buffer = await context.decodeAudioData(bytes);
        if (controller.signal.aborted) return;

        bufferRef.current = buffer;
        readyRef.current = true;
      } catch {
        // fail silently if audio cannot load
      }
    }

    window.addEventListener("click", initAudio, { once: true });
    window.addEventListener("keydown", initAudio, { once: true });
    window.addEventListener("touchstart", initAudio, { once: true });

    return () => {
      removeListeners();
      controller.abort();
      readyRef.current = false;
      bufferRef.current = null;
      ctxRef.current = null;
      if (context) void context.close().catch(() => {});
    };
  }, [enabled, volume]);

  const playSound = (
    sound: [number, number] | undefined,
    gainMultiplier = 1.0,
    withPitchJitter = true
  ) => {
    if (!enabled || volume <= 0 || !readyRef.current || !ctxRef.current || !bufferRef.current || !sound) {
      return;
    }

    try {
      if (ctxRef.current.state === "suspended") {
        void ctxRef.current.resume();
      }

      const src = ctxRef.current.createBufferSource();
      src.buffer = bufferRef.current;

      // Realistic pitch variation (±3.5%) so rapid keystrokes feel organic
      if (withPitchJitter) {
        src.playbackRate.value = 0.965 + Math.random() * 0.07;
      }

      // Hardware gain node for volume control
      const gainNode = ctxRef.current.createGain();
      const targetGain = Math.max(0, Math.min(1, volume * gainMultiplier));
      gainNode.gain.value = targetGain;

      src.connect(gainNode);
      gainNode.connect(ctxRef.current.destination);

      src.start(0, sound[0] / 1000, sound[1] / 1000);
    } catch {
      // Audio play error fallback
    }
  };

  const down = (key: string) => {
    if (!enabled || volume <= 0) return;

    if (key === "Enter") {
      playSound(ENTER_DOWN, 1.0, false);
      return;
    }
    if (key === " " || key === "Space") {
      playSound(SPACE_DOWN, 0.95, true);
      return;
    }
    if (key === "Backspace" || key === "Delete") {
      playSound(BACKSPACE_DOWN, 0.9, true);
      return;
    }

    // Pick variation using a combination of key code and stroke sequence
    const charCode = key.length > 0 ? key.charCodeAt(0) : 65;
    const varIdx = (charCode + strokeCounterRef.current++) % DOWN_VARIATIONS.length;
    playSound(DOWN_VARIATIONS[varIdx], 0.85, true);
  };

  const up = (key: string) => {
    if (!enabled || volume <= 0) return;

    if (key === "Enter") {
      playSound(ENTER_UP, 0.45, false);
      return;
    }
    if (key === " " || key === "Space") {
      playSound(SPACE_UP, 0.45, true);
      return;
    }

    const varIdx = strokeCounterRef.current % UP_VARIATIONS.length;
    playSound(UP_VARIATIONS[varIdx], 0.35, true);
  };

  const playClickPreview = (targetVolume?: number) => {
    if (targetVolume !== undefined && targetVolume <= 0) return;
    const testVol = targetVolume !== undefined ? targetVolume : volume;
    if (testVol <= 0) return;
    const sample = DOWN_VARIATIONS[Math.floor(Math.random() * DOWN_VARIATIONS.length)];
    playSound(sample, (targetVolume !== undefined ? targetVolume / (volume || 1) : 1) * 0.85, true);
  };

  return { down, up, playClickPreview };
}
