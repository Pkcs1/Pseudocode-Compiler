const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]+/g;

/**
 * Extracts the program name declared after the `program` keyword
 * (e.g. `program abc` -> `"abc"`), ignoring `{ ... }` and `// ...` comments.
 * Returns `null` if no valid program name is present.
 */
export function extractProgramName(code: string): string | null {
  const withoutComments = code
    .replace(/\{[\s\S]*?\}/g, " ")
    .replace(/\/\/[^\n]*/g, "");
  const match = withoutComments.match(/^\s*program[ \t]+([^\s]+)/im);
  if (!match) return null;

  const sanitized = match[1]
    .replace(INVALID_FILENAME_CHARS, "")
    .replace(/[. ]+$/g, "")
    .trim();

  return sanitized.length > 0 ? sanitized : null;
}

/**
 * Returns `<programName>.txt` when a valid `program <name>` header exists,
 * or `null` otherwise.
 */
export function getDownloadFilename(code: string): string | null {
  const name = extractProgramName(code);
  return name ? `${name}.txt` : null;
}

/** Triggers a UTF-8 `.txt` file download in the browser. */
export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
