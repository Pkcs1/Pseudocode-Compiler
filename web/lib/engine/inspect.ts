import { SemanticChecker } from "./checker";
import { PseudoError } from "./errors";
import { normalizeSmartQuotes, tokenize } from "./lexer";
import { lintProgram } from "./lint";
import { parseWithRecovery } from "./parser";

export type DiagnosticSeverity = "error" | "warning";

/** One problem in the source, shown inline in the editor (Error Lens style). */
export interface Diagnostic {
  severity: DiagnosticSeverity;
  category: string;
  message: string;
  line: number;
  col: number;
  /** Number of characters to underline starting at `col` (0 = end of line). */
  length: number;
}

export const KATEGORI_PERINGATAN = "peringatan";

export interface InspectResult {
  tokens: Array<{
    type: string;
    value: string;
    line: number;
    col: number;
  }>;
  ast: Record<string, unknown> | null;
  kamus: {
    aliases: Record<string, string>;
    structs: Record<string, Record<string, string>>;
    constants: string[];
    variables: Record<string, string>;
  };
  error: {
    category: string;
    message: string;
    line: number;
    col: number;
    formatted: string;
  } | null;
  /** Every error and warning, sorted by position. `error` is the first error. */
  diagnostics: Diagnostic[];
}

function spanLength(sourceLines: string[], line: number, col: number): number {
  const text = sourceLines[line - 1] ?? "";
  if (col > text.length) return 0;
  const rest = text.slice(col - 1);
  const word = rest.match(/^[A-Za-z0-9_]+/) ?? rest.match(/^"[^"]*"?/) ?? rest.match(/^'[^']*'?/);
  return word ? word[0].length : 1;
}

export function inspectSource(source: string): InspectResult {
  const normalized = normalizeSmartQuotes(source);
  const sourceLines = normalized.split(/\r?\n/);

  const result: InspectResult = {
    tokens: [],
    ast: null,
    kamus: {
      aliases: {},
      structs: {},
      constants: [],
      variables: {},
    },
    error: null,
    diagnostics: [],
  };

  const toDiag = (err: PseudoError, severity: DiagnosticSeverity = "error"): Diagnostic => ({
    severity,
    category: err.category,
    message: err.message,
    line: err.line,
    col: err.col,
    length: spanLength(sourceLines, err.line, err.col),
  });

  try {
    // 1. Lexer (recovering: keeps going after bad characters / strings)
    const lexErrors: PseudoError[] = [];
    const tokens = tokenize(normalized, lexErrors);
    result.tokens = tokens
      .filter((tok) => tok.type !== "EOF")
      .map((tok) => ({
        type: tok.type,
        value: tok.value !== null && tok.value !== undefined ? String(tok.value) : "",
        line: tok.line,
        col: tok.col,
      }));

    // 2. Parser (recovering: reports every syntax error, not just the first)
    const { program, errors: parseErrors } = parseWithRecovery(tokens, normalized);
    result.ast = JSON.parse(
      JSON.stringify(program, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    // 3. Checker (collecting: every statement is checked independently)
    const checker = new SemanticChecker(sourceLines, { collectErrors: true });
    try {
      checker.checkProgram(program);
    } catch (err) {
      if (!(err instanceof PseudoError)) throw err;
      checker.errors.push(err);
    }

    // Errors on a line that already has an earlier-stage error are almost
    // always follow-on noise from it, so only the root cause is kept.
    const lexLines = new Set(lexErrors.map((e) => e.line));
    const syntaxErrors = [
      ...lexErrors,
      ...parseErrors.filter((e) => !lexLines.has(e.line)),
    ];
    const syntaxLines = new Set(syntaxErrors.map((e) => e.line));
    const semanticErrors = checker.errors.filter((e) => !syntaxLines.has(e.line));

    const diagnostics: Diagnostic[] = [
      ...syntaxErrors.map((e) => toDiag(e)),
      ...semanticErrors.map((e) => toDiag(e)),
    ];

    // 4. Warnings — only when the program parsed cleanly, otherwise the AST is
    // incomplete and "unused variable" style hints would be wrong.
    if (syntaxErrors.length === 0) {
      const errorLines = new Set(diagnostics.map((d) => d.line));
      const warnings = [...checker.warnings, ...lintProgram(program)];
      for (const w of warnings) {
        if (errorLines.has(w.line)) continue;
        diagnostics.push({
          severity: "warning",
          category: KATEGORI_PERINGATAN,
          message: w.message,
          line: w.line,
          col: w.col,
          length: spanLength(sourceLines, w.line, w.col),
        });
      }
    }

    // Sort by position and drop exact duplicates.
    const seen = new Set<string>();
    result.diagnostics = diagnostics
      .sort((a, b) => a.line - b.line || a.col - b.col)
      .filter((d) => {
        const key = `${d.line}:${d.col}:${d.message}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    const aliases: Record<string, string> = {};
    for (const [k, v] of checker.aliases.entries()) {
      aliases[k] = v.targetType;
    }

    const structs: Record<string, Record<string, string>> = {};
    for (const [k, v] of checker.structs.entries()) {
      structs[k] = v;
    }

    const variables: Record<string, string> = {};
    for (const [k, v] of checker.variables.entries()) {
      variables[k] = v;
    }

    result.kamus = {
      aliases,
      structs,
      constants: Array.from(checker.constants),
      variables,
    };

    const firstError = [...syntaxErrors, ...semanticErrors].sort(
      (a, b) => a.line - b.line || a.col - b.col
    )[0];
    if (firstError) {
      result.error = {
        category: firstError.category,
        message: firstError.message,
        line: firstError.line,
        col: firstError.col,
        formatted: firstError.formatError(sourceLines),
      };
    }
  } catch (err: unknown) {
    if (err instanceof PseudoError) {
      result.error = {
        category: err.category,
        message: err.message,
        line: err.line,
        col: err.col,
        formatted: err.formatError(sourceLines),
      };
      result.diagnostics = [toDiag(err)];
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      result.error = {
        category: "kesalahan internal",
        message: msg,
        line: 1,
        col: 1,
        formatted: `Error internal: ${msg}`,
      };
      result.diagnostics = [
        { severity: "error", category: "kesalahan internal", message: msg, line: 1, col: 1, length: 0 },
      ];
    }
  }

  return result;
}
