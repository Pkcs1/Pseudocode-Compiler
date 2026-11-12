"use client";

import React, { useState, useRef, useEffect } from "react";
import { Volume2, Volume1, VolumeX, Sliders } from "lucide-react";
import { cn } from "@/lib/utils";

interface SoundVolumeControlProps {
  volume: number; // 0.0 to 1.0
  onVolumeChange: (vol: number) => void;
  onPreviewClick?: (vol: number) => void;
}

export function SoundVolumeControl({
  volume,
  onVolumeChange,
  onPreviewClick,
}: SoundVolumeControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prevVolumeRef = useRef<number>(volume > 0 ? volume : 0.7);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const toggleMute = () => {
    if (volume > 0) {
      prevVolumeRef.current = volume;
      onVolumeChange(0);
    } else {
      const restored = prevVolumeRef.current > 0 ? prevVolumeRef.current : 0.7;
      onVolumeChange(restored);
      onPreviewClick?.(restored);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value) / 100;
    onVolumeChange(val);
    if (val > 0) {
      prevVolumeRef.current = val;
    }
    onPreviewClick?.(val);
  };

  const handlePreset = (val: number) => {
    onVolumeChange(val);
    if (val > 0) {
      prevVolumeRef.current = val;
    }
    onPreviewClick?.(val);
  };

  const percent = Math.round(volume * 100);

  return (
    <div ref={containerRef} className="relative z-50 inline-flex items-center">
      {/* Speaker Toggle Button */}
      <div className="flex items-center p-0.5 rounded-xl border border-[#e2e2dc] bg-[#fbfbfa] dark:border-neutral-700/80 dark:bg-neutral-800/80">
        <button
          type="button"
          onClick={toggleMute}
          title={volume === 0 ? "Bunyikan suara (Muted)" : `Suara ${percent}% (Klik untuk mute)`}
          className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[#edeef0] text-[#475569] hover:text-[#0f172a] dark:hover:bg-neutral-700 dark:text-neutral-300 dark:hover:text-white transition-all cursor-pointer"
        >
          {volume === 0 ? (
            <VolumeX className="w-4 h-4 text-neutral-400" />
          ) : volume < 0.5 ? (
            <Volume1 className="w-4 h-4 text-[#5b45ff] dark:text-emerald-400" />
          ) : (
            <Volume2 className="w-4 h-4 text-[#5b45ff] dark:text-emerald-400" />
          )}
        </button>

        {/* Volume popover toggle button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title="Atur tingkat volume suara"
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-1 text-[11px] font-mono font-medium rounded-lg transition-all cursor-pointer",
            isOpen
              ? "bg-[#ede9fe] text-[#4f46e5] dark:bg-neutral-700 dark:text-emerald-400"
              : "text-[#64748b] hover:text-[#0f172a] hover:bg-[#edeef0] dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-700/60"
          )}
        >
          <span>{percent}%</span>
          <Sliders className="w-3 h-3 opacity-60" />
        </button>
      </div>

      {/* Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-[#e2e2dc] bg-[#ffffff] p-3 shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-150 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#64748b] dark:text-neutral-400">Efek Suara Ketik</span>
              <span className="font-semibold text-[#5b45ff] dark:text-emerald-400">{percent}%</span>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="0"
              max="100"
              value={percent}
              onChange={handleSliderChange}
              className="w-full h-1.5 bg-[#e2e2dc] rounded-lg appearance-none cursor-pointer accent-[#5b45ff] dark:bg-neutral-800 dark:accent-emerald-500"
            />

            {/* Presets */}
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-[#f1f1ee] dark:border-neutral-800/80">
              <button
                type="button"
                onClick={() => handlePreset(0)}
                className={cn(
                  "px-2 py-1 text-[10px] font-mono rounded-md transition-colors cursor-pointer",
                  percent === 0
                    ? "bg-[#ede9fe] text-[#4f46e5] font-bold dark:bg-neutral-700 dark:text-white"
                    : "text-[#64748b] hover:bg-[#f1f1ee] dark:text-neutral-400 dark:hover:bg-neutral-800"
                )}
              >
                Mute
              </button>
              <button
                type="button"
                onClick={() => handlePreset(0.3)}
                className={cn(
                  "px-2 py-1 text-[10px] font-mono rounded-md transition-colors cursor-pointer",
                  percent === 30
                    ? "bg-[#ede9fe] text-[#4f46e5] font-bold dark:bg-neutral-700 dark:text-white"
                    : "text-[#64748b] hover:bg-[#f1f1ee] dark:text-neutral-400 dark:hover:bg-neutral-800"
                )}
              >
                30%
              </button>
              <button
                type="button"
                onClick={() => handlePreset(0.7)}
                className={cn(
                  "px-2 py-1 text-[10px] font-mono rounded-md transition-colors cursor-pointer",
                  percent === 70
                    ? "bg-[#ede9fe] text-[#4f46e5] font-bold dark:bg-neutral-700 dark:text-white"
                    : "text-[#64748b] hover:bg-[#f1f1ee] dark:text-neutral-400 dark:hover:bg-neutral-800"
                )}
              >
                70%
              </button>
              <button
                type="button"
                onClick={() => handlePreset(1.0)}
                className={cn(
                  "px-2 py-1 text-[10px] font-mono rounded-md transition-colors cursor-pointer",
                  percent === 100
                    ? "bg-[#ede9fe] text-[#4f46e5] font-bold dark:bg-neutral-700 dark:text-white"
                    : "text-[#64748b] hover:bg-[#f1f1ee] dark:text-neutral-400 dark:hover:bg-neutral-800"
                )}
              >
                100%
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
