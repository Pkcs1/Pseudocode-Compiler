/**
 * IntelliSense for the pseudocode editor: completion items for keywords,
 * snippets, built-ins, and the symbols declared in the program's `kamus`
 * (variables, constants, record types and their fields).
 *
 * Pure functions only — the editor component owns the popup UI.
 */

export type CompletionKind =
  | "keyword"
  | "snippet"
  | "function"
  | "type"
  | "variable"
  | "constant"
  | "field";

export interface CompletionItem {
  label: string;
  kind: CompletionKind;
  /** Short text shown at the right of the row (e.g. the variable's type). */
  detail?: string;
  /** Explanation shown under the list for the selected item. */
  doc?: string;
  /**
   * Text to insert. `$0` marks where the caret goes; each `\t` at the start of
   * a line is one indentation step; new lines keep the current line's indent.
   * Defaults to `label`.
   */
  insert?: string;
}

export interface CompletionContext {
  /** Offset in the text where the word being completed starts. */
  from: number;
  /** The caret offset (end of the word being completed). */
  to: number;
  /** What has been typed of the word so far. */
  prefix: string;
  items: CompletionItem[];
}

interface Symbols {
  /** Variable name → type name. */
  variables: Map<string, string>;
  /** Constant name → type name. */
  constants: Map<string, string>;
  /** Record type name → field name → field type. */
  records: Map<string, Map<string, string>>;
  /** Other user-defined types (aliases). */
  types: Set<string>;
}

const BASIC_TYPES = ["integer", "real", "string", "boolean", "char"];

const KEYWORDS: { label: string; doc: string }[] = [
  { label: "program", doc: "Awal program: `program NamaProgram`." },
  { label: "kamus", doc: "Bagian deklarasi variabel, konstanta, dan tipe." },
  { label: "algoritma", doc: "Bagian instruksi yang dijalankan." },
  { label: "endprogram", doc: "Akhir program." },
  { label: "if", doc: "Percabangan: `if kondisi then … endif`." },
  { label: "then", doc: "Mengikuti kondisi `if`." },
  { label: "else", doc: "Cabang alternatif dari `if`." },
  { label: "endif", doc: "Menutup blok `if`." },
  { label: "for", doc: "Perulangan dengan pencacah: `for i <- 1 to n do … endfor`." },
  { label: "to", doc: "Pencacah `for` naik." },
  { label: "downto", doc: "Pencacah `for` turun." },
  { label: "step", doc: "Besar langkah pencacah `for`." },
  { label: "do", doc: "Awal badan `for` / `while`." },
  { label: "endfor", doc: "Menutup blok `for`." },
  { label: "while", doc: "Perulangan selama kondisi benar: `while kondisi do … endwhile`." },
  { label: "endwhile", doc: "Menutup blok `while`." },
  { label: "repeat", doc: "Perulangan minimal sekali: `repeat … until kondisi`." },
  { label: "until", doc: "Kondisi berhenti dari `repeat`." },
  { label: "constant", doc: "Deklarasi konstanta: `constant NAMA : tipe <- nilai`." },
  { label: "type", doc: "Deklarasi tipe bentukan (record): `type Nama < … >`." },
  { label: "and", doc: "Operator logika DAN." },
  { label: "or", doc: "Operator logika ATAU." },
  { label: "not", doc: "Operator logika NEGASI." },
  { label: "div", doc: "Pembagian bilangan bulat." },
  { label: "mod", doc: "Sisa hasil bagi." },
  { label: "true", doc: "Nilai boolean benar." },
  { label: "false", doc: "Nilai boolean salah." },
];

const FUNCTIONS: CompletionItem[] = [
  {
    label: "input",
    kind: "function",
    detail: "input(var, …)",
    doc: "Membaca masukan ke satu atau beberapa variabel.",
    insert: "input($0)",
  },
  {
    label: "output",
    kind: "function",
    detail: "output(nilai, …)",
    doc: "Menampilkan satu atau beberapa nilai, dipisah spasi.",
    insert: "output($0)",
  },
  {
    label: "len",
    kind: "function",
    detail: "len(s) → integer",
    doc: "Panjang string.",
    insert: "len($0)",
  },
];

const SNIPPETS: CompletionItem[] = [
  {
    label: "program",
    kind: "snippet",
    detail: "kerangka program",
    doc: "program … kamus … algoritma … endprogram",
    insert: "program $0\nkamus\n\t\nalgoritma\n\t\nendprogram",
  },
  {
    label: "if",
    kind: "snippet",
    detail: "if … then … endif",
    doc: "Percabangan satu arah.",
    insert: "if $0 then\n\t\nendif",
  },
  {
    label: "ifelse",
    kind: "snippet",
    detail: "if … then … else … endif",
    doc: "Percabangan dua arah.",
    insert: "if $0 then\n\t\nelse\n\t\nendif",
  },
  {
    label: "for",
    kind: "snippet",
    detail: "for i <- 1 to n do … endfor",
    doc: "Perulangan dengan pencacah naik.",
    insert: "for i <- 1 to $0 do\n\t\nendfor",
  },
  {
    label: "fordownto",
    kind: "snippet",
    detail: "for i <- n downto 1 do … endfor",
    doc: "Perulangan dengan pencacah turun.",
    insert: "for i <- $0 downto 1 do\n\t\nendfor",
  },
  {
    label: "while",
    kind: "snippet",
    detail: "while … do … endwhile",
    doc: "Perulangan selama kondisi benar.",
    insert: "while $0 do\n\t\nendwhile",
  },
  {
    label: "repeat",
    kind: "snippet",
    detail: "repeat … until …",
    doc: "Perulangan yang dijalankan minimal sekali.",
    insert: "repeat\n\t$0\nuntil ",
  },
  {
    label: "type",
    kind: "snippet",
    detail: "type Nama < … >",
    doc: "Tipe bentukan (record) dengan beberapa field.",
    insert: "type $0 <\n\t\n>",
  },
  {
    label: "constant",
    kind: "snippet",
    detail: "constant NAMA : tipe <- nilai",
    doc: "Konstanta yang nilainya tidak berubah.",
    insert: "constant $0 : integer <- ",
  },
];

const IDENT = "[A-Za-z_][A-Za-z0-9_]*";
const RESERVED = new Set([...KEYWORDS.map((k) => k.label), ...BASIC_TYPES, "input", "output", "len"]);

/** Remove `{ … }` comments and string literals so they don't look like declarations. */
function stripLine(line: string): string {
  return line
    .replace(/\{[^}]*\}?/g, " ")
    .replace(/"[^"]*"?/g, '""')
    .replace(/'[^']*'?/g, "''");
}

/** Collect the symbols declared in the program text. */
export function collectSymbols(code: string): Symbols {
  const symbols: Symbols = {
    variables: new Map(),
    constants: new Map(),
    records: new Map(),
    types: new Set(),
  };
  let inKamus = false;
  let record: Map<string, string> | null = null;

  for (const raw of code.split("\n")) {
    const line = stripLine(raw).trim();
    const lower = line.toLowerCase();
    if (lower === "kamus") {
      inKamus = true;
      continue;
    }
    if (lower === "algoritma" || lower.startsWith("endprogram")) {
      inKamus = false;
      record = null;
      continue;
    }
    if (!inKamus) continue;

    if (record) {
      if (line.startsWith(">")) {
        record = null;
        continue;
      }
      const field = line.match(new RegExp(`^(${IDENT}(?:\\s*,\\s*${IDENT})*)\\s*:\\s*(${IDENT})`));
      if (field) for (const name of field[1].split(",")) record.set(name.trim(), field[2]);
      continue;
    }

    const typeDecl = line.match(new RegExp(`^type\\s+(${IDENT})\\s*(<|:)?`));
    if (typeDecl) {
      if (typeDecl[2] === "<") {
        record = new Map();
        symbols.records.set(typeDecl[1], record);
        // Fields written on the same line: `type P < x : integer, y : integer >`
        const rest = line.slice(line.indexOf("<") + 1);
        for (const m of rest.matchAll(new RegExp(`(${IDENT}(?:\\s*,\\s*${IDENT})*)\\s*:\\s*(${IDENT})`, "g")))
          for (const name of m[1].split(",")) record.set(name.trim(), m[2]);
        if (rest.includes(">")) record = null;
      } else {
        symbols.types.add(typeDecl[1]);
      }
      continue;
    }

    const constDecl = line.match(new RegExp(`^constant\\s+(${IDENT})\\s*:\\s*(${IDENT})`));
    if (constDecl) {
      symbols.constants.set(constDecl[1], constDecl[2]);
      continue;
    }

    const varDecl = line.match(new RegExp(`^(${IDENT}(?:\\s*,\\s*${IDENT})*)\\s*:\\s*(${IDENT})`));
    if (varDecl) {
      for (const name of varDecl[1].split(",")) {
        const n = name.trim();
        if (!RESERVED.has(n)) symbols.variables.set(n, varDecl[2]);
      }
    }
  }
  return symbols;
}

/** True when `before` (text of the line up to the caret) ends inside a string or comment. */
function insideStringOrComment(before: string): boolean {
  let quote: string | null = null;
  let comment = false;
  for (const ch of before) {
    if (comment) {
      if (ch === "}") comment = false;
    } else if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "{") comment = true;
  }
  return quote !== null || comment;
}

/** Whether the caret is between `kamus` and `algoritma`. */
function inKamusSection(code: string, offset: number): boolean {
  const lines = code.slice(0, offset).split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim().toLowerCase();
    if (l === "algoritma") return false;
    if (l === "kamus") return true;
  }
  return false;
}

/** Rank items: exact-case prefix, then case-insensitive prefix, then subsequence. */
function rank(items: CompletionItem[], prefix: string): CompletionItem[] {
  if (!prefix) return items;
  const p = prefix.toLowerCase();
  const scored: [number, number, CompletionItem][] = [];
  items.forEach((item, i) => {
    const l = item.label.toLowerCase();
    let score = -1;
    if (item.label.startsWith(prefix)) score = 0;
    else if (l.startsWith(p)) score = 1;
    else {
      let j = 0;
      for (const ch of l) if (ch === p[j]) j++;
      if (j === p.length) score = 2;
    }
    if (score >= 0) scored.push([score, i, item]);
  });
  scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return scored.map((s) => s[2]);
}

/**
 * Completions for the caret at `offset`, or null when none apply.
 * `explicit` is true for Ctrl+Space (show everything even with an empty prefix).
 */
export function getCompletions(code: string, offset: number, explicit = false): CompletionContext | null {
  const lineStart = code.lastIndexOf("\n", offset - 1) + 1;
  const before = code.slice(lineStart, offset);
  if (insideStringOrComment(before)) return null;

  const word = before.match(new RegExp(`${IDENT}$|$`))![0];
  // Don't complete in the middle of a word or a number like `3.1`.
  if (/^[0-9]/.test(word) || /[A-Za-z0-9_]/.test(code[offset] ?? "")) return null;
  const from = offset - word.length;
  const symbols = collectSymbols(code);

  // Member access: `rec.field`
  const member = before.slice(0, before.length - word.length).match(new RegExp(`(${IDENT})\\s*\\.\\s*$`));
  if (member) {
    const typeName = symbols.variables.get(member[1]) ?? symbols.constants.get(member[1]);
    const fields = typeName ? symbols.records.get(typeName) : undefined;
    if (!fields) return null;
    const items = rank(
      [...fields].map(([name, type]) => ({
        label: name,
        kind: "field" as const,
        detail: type,
        doc: `Field dari ${typeName}.`,
      })),
      word
    );
    return items.length ? { from, to: offset, prefix: word, items } : null;
  }

  if (!word && !explicit) return null;

  const userTypes = [...symbols.records.keys(), ...symbols.types];
  const typeItems: CompletionItem[] = [
    ...BASIC_TYPES.map((t) => ({ label: t, kind: "type" as const, detail: "tipe dasar" })),
    ...userTypes.map((t) => ({
      label: t,
      kind: "type" as const,
      detail: symbols.records.has(t) ? "record" : "tipe",
      doc: symbols.records.has(t)
        ? `Field: ${[...symbols.records.get(t)!].map(([f, ft]) => `${f} : ${ft}`).join(", ") || "(kosong)"}`
        : undefined,
    })),
  ];

  // After `name :` in the kamus only a type makes sense.
  const afterColon = new RegExp(`^\\s*(?:constant\\s+)?${IDENT}(?:\\s*,\\s*${IDENT})*\\s*:\\s*$`);
  if (afterColon.test(before.slice(0, before.length - word.length)) && inKamusSection(code, offset)) {
    const items = rank(typeItems, word);
    return items.length ? { from, to: offset, prefix: word, items } : null;
  }

  // Only snippets & keywords are useful at the start of a statement; the rest anywhere.
  const atLineStart = before.slice(0, before.length - word.length).trim() === "";
  const items: CompletionItem[] = [
    ...[...symbols.variables].map(([name, type]) => ({
      label: name,
      kind: "variable" as const,
      detail: type,
      doc: symbols.records.has(type)
        ? `Variabel bertipe ${type}. Ketik "." untuk melihat field-nya.`
        : `Variabel bertipe ${type}.`,
    })),
    ...[...symbols.constants].map(([name, type]) => ({
      label: name,
      kind: "constant" as const,
      detail: type,
      doc: `Konstanta bertipe ${type}.`,
    })),
    ...FUNCTIONS,
    ...(atLineStart ? SNIPPETS : []),
    ...KEYWORDS.map((k) => ({ label: k.label, kind: "keyword" as const, doc: k.doc })),
    ...typeItems,
  ];

  // De-duplicate by label + kind (e.g. a snippet and keyword both named `if` stay).
  const seen = new Set<string>();
  const unique = items.filter((it) => {
    const key = `${it.kind}:${it.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const ranked = rank(unique, word);
  // Nothing to offer when the only match is exactly what's typed.
  if (
    !explicit &&
    ranked.every((it) => it.label === word && (it.insert ?? it.label) === it.label)
  )
    return null;
  return ranked.length ? { from, to: offset, prefix: word, items: ranked } : null;
}

/**
 * Expand an item's insert text for a line indented with `baseIndent`.
 * Returns the text and the caret position within it.
 */
export function expandInsert(
  item: CompletionItem,
  baseIndent: string,
  indentUnit: string
): { text: string; caret: number } {
  const template = item.insert ?? item.label;
  const expanded = template
    .split("\n")
    .map((line, i) => {
      const tabs = line.match(/^\t*/)![0].length;
      const body = indentUnit.repeat(tabs) + line.slice(tabs);
      return i === 0 ? body : baseIndent + body;
    })
    .join("\n");
  const caret = expanded.indexOf("$0");
  return caret < 0
    ? { text: expanded, caret: expanded.length }
    : { text: expanded.replace("$0", ""), caret };
}
