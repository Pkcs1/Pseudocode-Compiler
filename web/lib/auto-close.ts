import { visualWidth } from "./editor-settings";

/**
 * Auto-closing blocks: pressing Enter at the end of a line that opens a block
 * (`if … then`, `for … do`, `while … do`, `repeat`, `program X`) indents the new line
 * and, when the block isn't closed yet, inserts the matching closing keyword below.
 */

interface BlockRule {
  /** Matches the trimmed opener line. */
  open: RegExp;
  /** Keyword that closes the block, or null when the line only increases indentation. */
  close: string | null;
  /** First words of a following line (at the opener's indent) that mean the block is already closed. */
  closedBy: string[];
  /** Whether the body is indented one level (the `program` body isn't, per SPEC). */
  indentBody: boolean;
}

const RULES: BlockRule[] = [
  // `else if … then` continues an existing `if` chain: no new `endif`.
  { open: /^else\s+if\b.*\bthen$/, close: null, closedBy: [], indentBody: true },
  { open: /^if\b.*\bthen$/, close: "endif", closedBy: ["endif", "else"], indentBody: true },
  { open: /^for\b.*\bdo$/, close: "endfor", closedBy: ["endfor"], indentBody: true },
  { open: /^while\b.*\bdo$/, close: "endwhile", closedBy: ["endwhile"], indentBody: true },
  { open: /^repeat$/, close: "until ", closedBy: ["until"], indentBody: true },
  { open: /^program\s+\w+$/, close: "endprogram", closedBy: ["endprogram"], indentBody: false },
  // Sections and `else` have no closer of their own; just indent their body.
  { open: /^(kamus|algoritma|else)$/, close: null, closedBy: [], indentBody: true },
];

/** Strip a trailing `// …` or `{ … }` comment (outside string/char literals) and surrounding whitespace. */
function codeOf(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if ((c === "/" && line[i + 1] === "/") || c === "{") {
      return line.slice(0, i).trim();
    }
  }
  return line.trim();
}

const firstWord = (line: string) => (line.trim().match(/^[A-Za-z_]\w*/)?.[0] ?? "");

/**
 * Whether the block opened at `openerIndent` is already closed: the first following
 * non-blank line that isn't indented deeper than the opener starts with a closer.
 * `program` is special-cased, since `kamus`/`algoritma` sit at the same indent as it.
 */
function alreadyClosed(rest: string[], rule: BlockRule, openerIndent: number, tabSize: number): boolean {
  if (rule.close === "endprogram") return rest.some((l) => firstWord(l) === "endprogram");
  for (const line of rest) {
    if (line.trim() === "") continue;
    const indent = visualWidth(line.match(/^[ \t]*/)![0], tabSize);
    if (indent > openerIndent) continue;
    return indent === openerIndent && rule.closedBy.includes(firstWord(line));
  }
  return false;
}

export interface EnterEdit {
  text: string;
  /** Caret offset within `text`. */
  caret: number;
}

/**
 * What to insert when Enter is pressed with the caret at `pos` (no selection), or null
 * to fall back to the default behaviour. Only applies at the end of an opener line.
 */
export function blockEnterEdit(
  value: string,
  pos: number,
  indentUnit: string,
  tabSize: number,
  autoClose: boolean
): EnterEdit | null {
  const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
  const nl = value.indexOf("\n", pos);
  const lineEnd = nl === -1 ? value.length : nl;
  if (value.slice(pos, lineEnd).trim() !== "") return null; // caret not at end of line

  const line = value.slice(lineStart, pos);
  const code = codeOf(line);
  const rule = RULES.find((r) => r.open.test(code));
  if (!rule) return null;

  const indent = line.match(/^[ \t]*/)![0];
  const bodyIndent = rule.indentBody ? indent + indentUnit : indent;
  const head = "\n" + bodyIndent;

  if (!autoClose || !rule.close) return { text: head, caret: head.length };

  const rest = nl === -1 ? [] : value.slice(nl + 1).split("\n");
  if (alreadyClosed(rest, rule, visualWidth(indent, tabSize), tabSize)) {
    return { text: head, caret: head.length };
  }
  return { text: head + "\n" + indent + rule.close, caret: head.length };
}

/**
 * Keywords that close or continue a block, mapped to how their matching opener is found.
 * `pair` = [opener, closer]: scan upward, skipping nested pairs, to the unmatched opener.
 * `program` = align with the `program` line (sections and `endprogram` sit at its indent).
 */
const DEDENT: Record<string, { pair: [string, string] } | "program"> = {
  endif: { pair: ["if", "endif"] },
  else: { pair: ["if", "endif"] },
  endfor: { pair: ["for", "endfor"] },
  endwhile: { pair: ["while", "endwhile"] },
  until: { pair: ["repeat", "until"] },
  kamus: "program",
  algoritma: "program",
  endprogram: "program",
};

export interface DedentEdit {
  /** Range of the current line's leading whitespace to replace… */
  start: number;
  end: number;
  /** …with this indentation. */
  indent: string;
}

/**
 * VS Code-style "outdent on type": once the line holds only a closing keyword
 * (`endif`, `else`, `endfor`, `endwhile`, `until`, `kamus`, `algoritma`, `endprogram`)
 * with the caret right after it, re-align it with its opener. Null if nothing changes.
 */
export function electricDedent(value: string, pos: number): DedentEdit | null {
  const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
  const nl = value.indexOf("\n", pos);
  const lineEnd = nl === -1 ? value.length : nl;
  if (value.slice(pos, lineEnd).trim() !== "") return null;

  const line = value.slice(lineStart, pos);
  const word = line.trim();
  const rule = DEDENT[word];
  if (!rule) return null;

  const above = value.slice(0, Math.max(0, lineStart - 1)).split("\n");
  if (lineStart === 0) above.length = 0;
  let target: string | null = null;

  if (rule === "program") {
    for (let i = above.length - 1; i >= 0; i--) {
      if (firstWord(above[i]) === "program") {
        target = above[i].match(/^[ \t]*/)![0];
        break;
      }
    }
    target ??= "";
  } else {
    const [opener, closer] = rule.pair;
    let depth = 0;
    for (let i = above.length - 1; i >= 0; i--) {
      const w = firstWord(above[i]);
      if (w === closer) depth++;
      else if (w === opener) {
        if (depth === 0) {
          target = above[i].match(/^[ \t]*/)![0];
          break;
        }
        depth--;
      }
    }
  }

  const current = line.match(/^[ \t]*/)![0];
  if (target === null || target === current) return null;
  return { start: lineStart, end: lineStart + current.length, indent: target };
}
