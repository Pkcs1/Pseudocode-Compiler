import { syntaxError } from "./errors";

export const KEYWORDS: Record<string, string> = {
  program: "PROGRAM",
  kamus: "KAMUS",
  algoritma: "ALGORITMA",
  endprogram: "ENDPROGRAM",
  input: "INPUT",
  output: "OUTPUT",
  integer: "TYPE_INTEGER",
  real: "TYPE_REAL",
  string: "TYPE_STRING",
  boolean: "TYPE_BOOLEAN",
  char: "TYPE_CHAR",
  true: "BOOL_LIT",
  false: "BOOL_LIT",
  div: "DIV",
  mod: "MOD",
  not: "NOT",
  and: "AND",
  or: "OR",
  len: "LEN",
  constant: "CONSTANT",
  type: "TYPE",
  for: "FOR",
  to: "TO",
  step: "STEP",
  do: "DO",
  endfor: "ENDFOR",
  if: "IF",
  then: "THEN",
  else: "ELSE",
  endif: "ENDIF",
  while: "WHILE",
  endwhile: "ENDWHILE",
  repeat: "REPEAT",
  until: "UNTIL",
};

export const TWO_CHAR_TOKENS: Record<string, string> = {
  "<-": "ASSIGN",
  "<<": "SHL",
  ">>": "SHR",
  "<=": "LE",
  ">=": "GE",
  "==": "EQ",
  "!=": "NEQ",
  "<>": "NEQ",
};

export const SINGLE_CHAR_TOKENS: Record<string, string> = {
  "+": "PLUS",
  "-": "MINUS",
  "*": "STAR",
  "/": "SLASH",
  "^": "CARET",
  "&": "AMP",
  "|": "PIPE",
  "<": "LT",
  ">": "GT",
  "(": "LPAREN",
  ")": "RPAREN",
  "=": "ASSIGN",
  ":": "COLON",
  ",": "COMMA",
  ".": "DOT",
};

export interface Token {
  type: string;
  value: any;
  line: number;
  col: number;
}

export function normalizeSmartQuotes(source: string): string {
  return source
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u2190/g, "<-")
    .replace(/\uf0df/g, "<-");
}

export function tokenize(source: string): Token[] {
  const normalized = normalizeSmartQuotes(source);
  const lines = normalized.split(/\r?\n/);
  const tokens: Token[] = [];

  let pos = 0;
  const length = normalized.length;
  let line = 1;
  let col = 1;

  function currentLineText(lineNo: number): string {
    if (lineNo >= 1 && lineNo <= lines.length) {
      return lines[lineNo - 1];
    }
    return "";
  }

  function isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
  }

  function isAlpha(ch: string): boolean {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");
  }

  function isAlphaNumeric(ch: string): boolean {
    return isAlpha(ch) || isDigit(ch) || ch === "_";
  }

  while (pos < length) {
    const ch = normalized[pos];

    // 1. Newline
    if (ch === "\n") {
      pos++;
      line++;
      col = 1;
      continue;
    }

    // Whitespace
    if (ch === " " || ch === "\t" || ch === "\r") {
      pos++;
      col++;
      continue;
    }

    // 2. Single-line comment //
    if (ch === "/" && pos + 1 < length && normalized[pos + 1] === "/") {
      while (pos < length && normalized[pos] !== "\n") {
        pos++;
        col++;
      }
      continue;
    }

    // Block comment { ... }
    if (ch === "{") {
      const startLine = line;
      const startCol = col;
      pos++;
      col++;
      while (pos < length && normalized[pos] !== "}") {
        if (normalized[pos] === "\n") {
          line++;
          col = 1;
        } else {
          col++;
        }
        pos++;
      }
      if (pos >= length) {
        throw syntaxError(
          "komentar '{ ... }' tidak ditutup dengan tanda '}'.",
          startLine,
          startCol,
          currentLineText(startLine)
        );
      }
      pos++;
      col++;
      continue;
    }

    // 3. String literal "..."
    if (ch === '"') {
      const startCol = col;
      pos++;
      col++;
      const chars: string[] = [];
      const escapeMap: Record<string, string> = {
        '"': '"',
        "\\": "\\",
        n: "\n",
        t: "\t",
      };

      while (
        pos < length &&
        normalized[pos] !== '"' &&
        normalized[pos] !== "\n" &&
        normalized[pos] !== "\r"
      ) {
        if (normalized[pos] === "\\" && pos + 1 < length) {
          const esc = normalized[pos + 1];
          if (escapeMap[esc] !== undefined) {
            chars.push(escapeMap[esc]);
            pos += 2;
            col += 2;
            continue;
          }
        }
        chars.push(normalized[pos]);
        pos++;
        col++;
      }

      if (pos >= length || normalized[pos] !== '"') {
        throw syntaxError(
          'string tidak ditutup dengan tanda petik dua (").',
          line,
          startCol,
          currentLineText(line)
        );
      }
      pos++;
      col++;
      tokens.push({
        type: "STRING_LIT",
        value: chars.join(""),
        line,
        col: startCol,
      });
      continue;
    }

    // 4. Char literal '...'
    if (ch === "'") {
      const startCol = col;
      pos++;
      col++;
      const charBuf: string[] = [];
      const escapeMap: Record<string, string> = {
        "'": "'",
        "\\": "\\",
        n: "\n",
        t: "\t",
      };

      while (
        pos < length &&
        normalized[pos] !== "'" &&
        normalized[pos] !== "\n" &&
        normalized[pos] !== "\r"
      ) {
        if (normalized[pos] === "\\" && pos + 1 < length) {
          const esc = normalized[pos + 1];
          if (escapeMap[esc] !== undefined) {
            charBuf.push(escapeMap[esc]);
            pos += 2;
            col += 2;
            continue;
          }
        }
        charBuf.push(normalized[pos]);
        pos++;
        col++;
      }

      if (pos >= length || normalized[pos] !== "'") {
        throw syntaxError(
          "karakter (char) tidak ditutup dengan tanda petik tunggal (').",
          line,
          startCol,
          currentLineText(line)
        );
      }
      pos++;
      col++;
      const content = charBuf.join("");
      if (content.length !== 1) {
        throw syntaxError(
          `literal char harus berisi tepat 1 karakter, bukan '${content}'.`,
          line,
          startCol,
          currentLineText(line)
        );
      }
      tokens.push({
        type: "CHAR_LIT",
        value: content.charCodeAt(0),
        line,
        col: startCol,
      });
      continue;
    }

    // 5. Numbers (Integer / Real)
    if (isDigit(ch)) {
      const startCol = col;
      let numStr = "";
      while (pos < length && isDigit(normalized[pos])) {
        numStr += normalized[pos];
        pos++;
        col++;
      }

      if (pos < length && normalized[pos] === ".") {
        if (pos + 1 < length && isDigit(normalized[pos + 1])) {
          numStr += ".";
          pos++;
          col++;
          while (pos < length && isDigit(normalized[pos])) {
            numStr += normalized[pos];
            pos++;
            col++;
          }
          tokens.push({
            type: "REAL_LIT",
            value: parseFloat(numStr),
            line,
            col: startCol,
          });
        } else {
          throw syntaxError(
            `angka desimal '${numStr}.' tidak valid (harus ada angka di belakang titik).`,
            line,
            startCol,
            currentLineText(line)
          );
        }
      } else {
        tokens.push({
          type: "INT_LIT",
          value: BigInt(numStr),
          line,
          col: startCol,
        });
      }
      continue;
    }

    // 6. Identifier / Keyword
    if (isAlpha(ch) || ch === "_") {
      const startCol = col;
      let ident = "";
      while (pos < length && isAlphaNumeric(normalized[pos])) {
        ident += normalized[pos];
        pos++;
        col++;
      }

      const tokenType = KEYWORDS[ident] || "IDENTIFIER";
      if (tokenType === "BOOL_LIT") {
        tokens.push({
          type: "BOOL_LIT",
          value: ident === "true",
          line,
          col: startCol,
        });
      } else {
        tokens.push({
          type: tokenType,
          value: ident,
          line,
          col: startCol,
        });
      }
      continue;
    }

    // 7. Two-char tokens
    if (pos + 1 < length) {
      const twoCh = normalized.slice(pos, pos + 2);
      if (TWO_CHAR_TOKENS[twoCh]) {
        tokens.push({
          type: TWO_CHAR_TOKENS[twoCh],
          value: twoCh,
          line,
          col,
        });
        pos += 2;
        col += 2;
        continue;
      }
    }

    // 8. Single-char tokens
    if (SINGLE_CHAR_TOKENS[ch]) {
      tokens.push({
        type: SINGLE_CHAR_TOKENS[ch],
        value: ch,
        line,
        col,
      });
      pos++;
      col++;
      continue;
    }

    // 9. Unknown character
    throw syntaxError(
      `karakter '${ch}' tidak dikenal di dalam pseudocode.`,
      line,
      col,
      currentLineText(line)
    );
  }

  let eofLine = 1;
  let eofCol = 1;
  if (tokens.length > 0) {
    const lastTok = tokens[tokens.length - 1];
    eofLine = lastTok.line;
    eofCol = lastTok.col + String(lastTok.value).length;
  }
  tokens.push({
    type: "EOF",
    value: null,
    line: eofLine,
    col: eofCol,
  });

  return tokens;
}
