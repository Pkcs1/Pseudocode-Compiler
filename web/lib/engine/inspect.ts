import { SemanticChecker } from "./checker";
import { PseudoError } from "./errors";
import { normalizeSmartQuotes, tokenize } from "./lexer";
import { parse } from "./parser";

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
  };

  try {
    // 1. Lexer
    const tokens = tokenize(normalized);
    result.tokens = tokens
      .filter((tok) => tok.type !== "EOF")
      .map((tok) => ({
        type: tok.type,
        value: tok.value !== null && tok.value !== undefined ? String(tok.value) : "",
        line: tok.line,
        col: tok.col,
      }));

    // 2. Parser
    const program = parse(tokens, normalized);
    result.ast = JSON.parse(
      JSON.stringify(program, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    // 3. Checker
    const checker = new SemanticChecker(sourceLines);
    checker.checkProgram(program);

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
  } catch (err: unknown) {
    if (err instanceof PseudoError) {
      result.error = {
        category: err.category,
        message: err.message,
        line: err.line,
        col: err.col,
        formatted: err.formatError(sourceLines),
      };
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      result.error = {
        category: "kesalahan internal",
        message: msg,
        line: 1,
        col: 1,
        formatted: `Error internal: ${msg}`,
      };
    }
  }

  return result;
}
