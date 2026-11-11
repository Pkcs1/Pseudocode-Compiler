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
    <div ref={containerRef} className="relative inline-flex items-center">
      {/* Speaker Toggle Button */}
      <div className="flex items-center p-0.5 rounded-lg border border-neutral-700/80 bg-neutral-800/80">
        <button
          type="button"
          onClick={toggleMute}
          title={volume === 0 ? "Bunyikan suara (Muted)" : `Suara ${percent}% (Klik untuk mute)`}
          className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all cursor-pointer"
        >
          {volume === 0 ? (
            <VolumeX className="w-4 h-4 text-neutral-500" />
          ) : volume < 0.5 ? (
            <Volume1 className="w-4 h-4 text-emerald-400" />
          ) : (
            <Volume2 className="w-4 h-4 text-emerald-400" />
          )}
        </button>

        {/* Volume popover toggle button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title="Atur tingkat volume suara"
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-1 text-[11px] font-mono font-medium rounded-md transition-all cursor-pointer",
            isOpen
              ? "bg-neutral-700 text-emerald-400"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/60"
          )}
        >
          <span>{percent}%</span>
          <Sliders className="w-3 h-3 opacity-60" />
        </button>
      </div>

      {/* Popover Slider & Presets */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-56 p-3 rounded-xl border border-neutral-700/90 bg-neutral-900 shadow-2xl backdrop-blur-md text-xs space-y-3">
          <div className="flex items-center justify-between text-neutral-300 font-medium">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Volume Ketikan</span>
            </span>
            <span className="font-mono text-emerald-400 font-bold">{percent}%</span>
          </div>

          {/* Range input */}
          <div className="space-y-1">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={percent}
              onChange={handleSliderChange}
              className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] font-mono text-neutral-500">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Quick presets */}
          <div className="pt-2 border-t border-neutral-800 flex items-center justify-between gap-1">
            {[
              { label: "Mute", val: 0 },
              { label: "30%", val: 0.3 },
              { label: "70%", val: 0.7 },
              { label: "100%", val: 1.0 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handlePreset(preset.val)}
                className={cn(
                  "flex-1 py-1 rounded text-[10px] font-mono font-medium transition-all cursor-pointer border",
                  (percent === 0 && preset.val === 0) ||
                    (Math.abs(percent - preset.val * 100) < 5 && percent > 0)
                    ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-300"
                    : "bg-neutral-800/80 border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-700"
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
