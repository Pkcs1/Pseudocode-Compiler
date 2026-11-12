/**
 * Syntax tokenization for Indonesian Pseudocode.
 * Supports both Light Mode (from the reference image: indigo keywords, green strings, amber numbers)
 * and Dark Mode (VS Code Dark+), controlled via CSS custom properties in globals.css.
 */

export type TokenType =
  | "comment"
  | "string"
  | "number"
  | "keyword"
  | "type"
  | "function"
  | "operator"
  | "boolean"
  | "identifier"
  | "punctuation"
  | "plain";

export interface HighlightToken {
  text: string;
  type: TokenType;
}

const KEYWORDS_STRUCTURE = new Set([
  "program",
  "endprogram",
  "kamus",
  "algoritma",
  "if",
  "then",
  "else",
  "endif",
  "for",
  "to",
  "downto",
  "step",
  "do",
  "endfor",
  "while",
  "endwhile",
  "repeat",
  "until",
]);

const KEYWORDS_TYPES = new Set([
  "integer",
  "real",
  "string",
  "boolean",
  "char",
  "type",
  "constant",
  "record",
  "endrecord",
]);

const KEYWORDS_FUNCTIONS = new Set([
  "input",
  "output",
  "read",
  "write",
  "len",
  "print",
  "println",
]);

const KEYWORDS_OPERATORS = new Set(["and", "or", "not", "div", "mod"]);

const KEYWORDS_BOOLEAN = new Set(["true", "false"]);

export const TOKEN_STYLE: Record<
  TokenType,
  { color: string; fontWeight?: string; fontStyle?: string }
> = {
  comment: { color: "var(--syn-comment)", fontStyle: "italic" },
  string: { color: "var(--syn-string)" },
  number: { color: "var(--syn-number)" },
  keyword: { color: "var(--syn-keyword)", fontWeight: "600" },
  type: { color: "var(--syn-type)", fontWeight: "600" },
  function: { color: "var(--syn-func)", fontWeight: "500" },
  operator: { color: "var(--syn-operator)" },
  boolean: { color: "var(--syn-bool)", fontWeight: "600" },
  identifier: { color: "var(--syn-ident)" },
  punctuation: { color: "var(--syn-punct)" },
  plain: { color: "var(--syn-plain)" },
};

/**
 * Tokenize a line of pseudocode into an array of HighlightToken objects.
 */
export function tokenizeLine(line: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let i = 0;
  const len = line.length;

  while (i < len) {
    // 1. Whitespace
    if (/\s/.test(line[i])) {
      let ws = "";
      while (i < len && /\s/.test(line[i])) {
        ws += line[i];
        i++;
      }
      tokens.push({ text: ws, type: "plain" });
      continue;
    }

    // 2. Comments: // ... or { ... }
    if (line[i] === "/" && line[i + 1] === "/") {
      tokens.push({ text: line.slice(i), type: "comment" });
      break;
    }

    if (line[i] === "{") {
      let comment = "{";
      i++;
      while (i < len && line[i] !== "}") {
        comment += line[i];
        i++;
      }
      if (i < len && line[i] === "}") {
        comment += "}";
        i++;
      }
      tokens.push({ text: comment, type: "comment" });
      continue;
    }

    // 3. Strings: "..." or '...' (or smart quotes)
    if (
      line[i] === '"' ||
      line[i] === "'" ||
      line[i] === "“" ||
      line[i] === "”" ||
      line[i] === "‘" ||
      line[i] === "’"
    ) {
      const quoteChar = line[i];
      const closeQuote =
        quoteChar === "“" ? "”" : quoteChar === "‘" ? "’" : quoteChar;
      let str = quoteChar;
      i++;
      while (i < len && line[i] !== closeQuote && line[i] !== quoteChar) {
        if (line[i] === "\\" && i + 1 < len) {
          str += line[i] + line[i + 1];
          i += 2;
        } else {
          str += line[i];
          i++;
        }
      }
      if (i < len) {
        str += line[i];
        i++;
      }
      tokens.push({ text: str, type: "string" });
      continue;
    }

    // 4. Numbers (integers or decimals)
    if (/\d/.test(line[i])) {
      let num = "";
      while (i < len && /\d/.test(line[i])) {
        num += line[i];
        i++;
      }
      if (i < len && line[i] === "." && /\d/.test(line[i + 1] || "")) {
        num += line[i];
        i++;
        while (i < len && /\d/.test(line[i])) {
          num += line[i];
          i++;
        }
      }
      tokens.push({ text: num, type: "number" });
      continue;
    }

    // 5. Multi-char operators: <-, ->, <=, >=, ==, !=, <>, <<, >>, ←, →
    const twoChars = line.slice(i, i + 2);
    if (
      twoChars === "<-" ||
      twoChars === "->" ||
      twoChars === "<=" ||
      twoChars === ">=" ||
      twoChars === "==" ||
      twoChars === "!=" ||
      twoChars === "<>" ||
      twoChars === "<<" ||
      twoChars === ">>"
    ) {
      tokens.push({ text: twoChars, type: "operator" });
      i += 2;
      continue;
    }
    if (line[i] === "←" || line[i] === "→") {
      tokens.push({ text: line[i], type: "operator" });
      i++;
      continue;
    }

    // 6. Word / Identifier / Keyword
    if (/[a-zA-Z_]/.test(line[i])) {
      let word = "";
      while (i < len && /[a-zA-Z0-9_]/.test(line[i])) {
        word += line[i];
        i++;
      }
      const lower = word.toLowerCase();

      if (KEYWORDS_STRUCTURE.has(lower)) {
        tokens.push({ text: word, type: "keyword" });
      } else if (KEYWORDS_TYPES.has(lower)) {
        tokens.push({ text: word, type: "type" });
      } else if (KEYWORDS_FUNCTIONS.has(lower)) {
        tokens.push({ text: word, type: "function" });
      } else if (KEYWORDS_OPERATORS.has(lower)) {
        tokens.push({ text: word, type: "operator" });
      } else if (KEYWORDS_BOOLEAN.has(lower)) {
        tokens.push({ text: word, type: "boolean" });
      } else {
        tokens.push({ text: word, type: "identifier" });
      }
      continue;
    }

    // 7. Single char operators / punctuation
    const char = line[i];
    if (/[+\-*/^&|<>=]/.test(char)) {
      tokens.push({ text: char, type: "operator" });
    } else if (/[:;,()[\]]/.test(char)) {
      tokens.push({ text: char, type: "punctuation" });
    } else {
      tokens.push({ text: char, type: "plain" });
    }
    i++;
  }

  return tokens;
}
