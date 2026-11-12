export const KATEGORI_SINTAKS = "kesalahan sintaks";
export const KATEGORI_SEMAN = "kesalahan tipe/deklarasi";
export const KATEGORI_RUNTIME = "kesalahan saat program berjalan";

export class PseudoError extends Error {
  category: string;
  line: number;
  col: number;
  sourceLine: string;

  constructor(
    category: string,
    message: string,
    line: number,
    col: number = 1,
    sourceLine: string = ""
  ) {
    super(message);
    this.name = "PseudoError";
    this.category = category;
    this.line = line;
    this.col = Math.max(1, col);
    this.sourceLine = sourceLine;
  }

  formatError(sourceLines?: string[]): string {
    let lineText = this.sourceLine;
    if (!lineText && sourceLines && this.line >= 1 && this.line <= sourceLines.length) {
      lineText = sourceLines[this.line - 1];
    }

    const header = `Error (baris ${this.line}) [${this.category}]: ${this.message}`;
    if (!lineText && sourceLines !== undefined && sourceLines.length === 0) {
      return header;
    }

    let expandedLine = "";
    let pointerCol = 1;
    for (let idx = 0; idx < lineText.length; idx++) {
      const ch = lineText[idx];
      const charIndex = idx + 1;
      if (ch === "\t") {
        expandedLine += "    ";
        if (charIndex < this.col) {
          pointerCol += 4;
        }
      } else {
        expandedLine += ch;
        if (charIndex < this.col) {
          pointerCol += 1;
        }
      }
    }

    if (this.col > lineText.length) {
      pointerCol += this.col - lineText.length - 1;
    }

    const prefix = `${this.line.toString().padStart(4, " ")} | `;
    const caretSpaces = " ".repeat(prefix.length + Math.max(0, pointerCol - 1));
    return `${header}\n${prefix}${expandedLine}\n${caretSpaces}^`;
  }
}

export function syntaxError(
  message: string,
  line: number,
  col: number = 1,
  sourceLine: string = ""
): PseudoError {
  return new PseudoError(KATEGORI_SINTAKS, message, line, col, sourceLine);
}

export function semanticError(
  message: string,
  line: number,
  col: number = 1,
  sourceLine: string = ""
): PseudoError {
  return new PseudoError(KATEGORI_SEMAN, message, line, col, sourceLine);
}

export function runtimeError(
  message: string,
  line: number,
  col: number = 1,
  sourceLine: string = ""
): PseudoError {
  return new PseudoError(KATEGORI_RUNTIME, message, line, col, sourceLine);
}
