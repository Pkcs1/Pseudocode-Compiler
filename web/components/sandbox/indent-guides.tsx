"use client";

import React from "react";
import { EditorSettings, hexToRgba, visualWidth } from "@/lib/editor-settings";

const ERROR_FILL = "rgba(239, 68, 68, 0.28)";

/**
 * Visual width (in ch) the indent guides cover on a line, or 0 when none are drawn.
 * Whitespace-only lines only get guides while the caret is on them, so blank
 * (auto-indented) lines don't paint stripes down the whole editor.
 */
export function indentGuideWidth(line: string, settings: EditorSettings, isCurrent: boolean): number {
  if (!settings.rainbow.enabled) return 0;
  const leading = line.match(/^[ \t]*/)![0];
  if (leading.length === line.length && !isCurrent) return 0;
  return visualWidth(leading, settings.tabSize);
}

/**
 * indent-rainbow style coloring for one line's leading whitespace.
 * Rendered absolutely behind the line's text, so it must be placed inside a
 * `relative` line container whose text starts at its left edge.
 */
export function IndentGuides({
  line,
  settings,
  isCurrent = false,
}: {
  line: string;
  settings: EditorSettings;
  isCurrent?: boolean;
}) {
  const { rainbow, tabSize } = settings;
  const width = indentGuideWidth(line, settings, isCurrent);
  if (width === 0) return null;
  const leading = line.match(/^[ \t]*/)![0];

  // Indentation that isn't a whole number of levels (e.g. 3 spaces with tab size 4).
  if (rainbow.highlightErrors && width % tabSize !== 0 && leading.length < line.length) {
    return (
      <span
        aria-hidden="true"
        className="absolute top-0 bottom-0 left-0 pointer-events-none"
        style={{ width: `${width}ch`, background: ERROR_FILL }}
        title="Indentasi tidak sesuai ukuran tab"
      />
    );
  }

  const levels = Math.floor(width / tabSize);
  const fill = rainbow.style !== "line";
  const stroke = rainbow.style !== "fill";
  const lineAlpha = Math.min(1, rainbow.opacity * 2.5 + 0.2);

  return (
    <span aria-hidden="true" className="absolute top-0 bottom-0 left-0 flex pointer-events-none">
      {Array.from({ length: levels }, (_, level) => {
        const color = rainbow.colors[level % rainbow.colors.length];
        return (
          <span
            key={level}
            className="h-full"
            style={{
              width: `${tabSize}ch`,
              background: fill ? hexToRgba(color, rainbow.opacity) : undefined,
              boxShadow: stroke ? `inset 1px 0 0 ${hexToRgba(color, lineAlpha)}` : undefined,
            }}
          />
        );
      })}
    </span>
  );
}
