/**
 * Pseudocode → Go source converter.
 *
 * Walks the parsed AST and emits an equivalent, idiomatic `package main` program.
 * Expression types come from the semantic checker, so mixed integer/real/char
 * arithmetic gets the explicit conversions Go requires, and the generated
 * program prints exactly what the interpreter prints:
 *
 * - integer → int (64-bit, wraps on overflow like the interpreter), real → float64,
 *   char → rune, boolean → bool, string → string, struct → struct, alias → type alias.
 * - `/` is always real division; `div` / `mod` map to Go's truncating `/` and `%`.
 * - Only the `fmt` package is used (plus `math` solely for a fractional power like `x ^ 0.5`).
 * - `output(...)` → fmt.Println (space-separated); reals go through a helper that
 *   formats them the way the interpreter does (`3.0` prints as `3`).
 * - `input(...)` → fmt.Scan (whitespace-separated tokens).
 * - kamus variables are declared at the top of main(); ones that are never read get
 *   `_ = x` so Go's "declared and not used" check passes.
 */

import type {
  AssignStmt,
  Decl,
  Expr,
  ForStmt,
  IfStmt,
  InputStmt,
  OutputStmt,
  Program,
  Stmt,
  VarExpr,
  FieldAccessExpr,
} from "./ast";
import { tokenize } from "./lexer";
import { parse } from "./parser";
import { SemanticChecker } from "./checker";
import { PseudoError } from "./errors";

export type GoTranspileResult =
  | { ok: true; code: string }
  | { ok: false; error: PseudoError | Error };

/** Go keywords, predeclared identifiers, and names the generated code uses itself. */
const RESERVED = new Set([
  // keywords
  "break", "case", "chan", "const", "continue", "default", "defer", "else", "fallthrough",
  "for", "func", "go", "goto", "if", "import", "interface", "map", "package", "range",
  "return", "select", "struct", "switch", "type", "var",
  // predeclared
  "any", "append", "bool", "byte", "cap", "clear", "close", "comparable", "complex",
  "complex64", "complex128", "copy", "delete", "error", "false", "float32", "float64",
  "imag", "int", "int8", "int16", "int32", "int64", "iota", "len", "make", "max", "min",
  "new", "nil", "panic", "print", "println", "real", "recover", "rune", "string", "true",
  "uint", "uint8", "uint16", "uint32", "uint64", "uintptr",
  // used by the generated program
  "main", "fmt", "math", "powInt", "powReal", "formatReal", "scanChar",
]);

const BASE_GO_TYPE: Record<string, string> = {
  integer: "int",
  real: "float64",
  string: "string",
  boolean: "bool",
  char: "rune",
};

/** Binding strength of Go operators (higher binds tighter); used to add only needed parens. */
const GO_PREC: Record<string, number> = {
  "||": 1,
  "&&": 2,
  "==": 3, "!=": 3, "<": 3, "<=": 3, ">": 3, ">=": 3,
  "+": 4, "-": 4, "|": 4,
  "*": 5, "/": 5, "%": 5, "<<": 5, ">>": 5, "&": 5,
};
const PREC_UNARY = 6;
const PREC_ATOM = 7;

interface GoExpr {
  code: string;
  /** Pseudocode type of the value (resolved, e.g. "integer", "real", or a struct name). */
  type: string;
  prec: number;
  /** An untyped Go constant (built only from literals): Go folds these with exact math. */
  untyped?: boolean;
}

class GoTranspiler {
  private checker: SemanticChecker;
  private out: string[] = [];
  private depth = 0;
  private names = new Map<string, string>();
  private usedNames = new Set<string>();
  private imports = new Set<string>();
  private needPowInt = false;
  private needPowReal = false;
  private needFormatReal = false;
  private needScanChar = false;
  private tempSeq = 0;
  /** Loop counters whose value is read outside their own `for` loops. */
  private counterReadOutside = new Set<string>();

  constructor(checker: SemanticChecker) {
    this.checker = checker;
  }

  /** Go-safe identifier for a pseudocode name (kept as-is unless it clashes with Go). */
  private id(name: string): string {
    const known = this.names.get(name);
    if (known) return known;
    let goName = name;
    while (RESERVED.has(goName) || this.usedNames.has(goName)) goName += "_";
    this.names.set(name, goName);
    this.usedNames.add(goName);
    return goName;
  }

  /** A fresh helper variable name that can't clash with user names. */
  private temp(base: string): string {
    let name: string;
    do name = `${base}${++this.tempSeq}`;
    while (RESERVED.has(name) || this.usedNames.has(name) || this.checker.variables.has(name));
    this.usedNames.add(name);
    return name;
  }

  private emit(line = "") {
    this.out.push(line ? "\t".repeat(this.depth) + line : "");
  }

  private goType(typeName: string): string {
    return BASE_GO_TYPE[typeName] ?? this.id(typeName);
  }

  private typeOf(expr: Expr): string {
    return this.checker.checkExpr(expr);
  }

  // --- Expressions -----------------------------------------------------------------

  private paren(e: GoExpr, minPrec: number): string {
    return e.prec < minPrec ? `(${e.code})` : e.code;
  }

  /** Convert `e` to the Go representation of pseudocode type `to`. */
  private convert(e: GoExpr, to: string): GoExpr {
    if (e.type === to) return e;
    if (to === "real" && e.type === "integer" && e.untyped && /^-?\d+$/.test(e.code)) {
      return { code: `${e.code}.0`, type: "real", prec: e.prec, untyped: true };
    }
    if (to === "real" && (e.type === "integer" || e.type === "char")) {
      return { code: `float64(${e.code})`, type: "real", prec: PREC_ATOM };
    }
    if (to === "integer" && e.type === "char") {
      return { code: `int(${e.code})`, type: "integer", prec: PREC_ATOM };
    }
    if (to === "char" && e.type === "integer") {
      return { code: `rune(${e.code})`, type: "char", prec: PREC_ATOM };
    }
    return e;
  }

  private literal(value: unknown, typeName: string): GoExpr {
    if (typeName === "string") {
      return { code: JSON.stringify(String(value)), type: "string", prec: PREC_ATOM };
    }
    if (typeName === "char") {
      const cp = Number(value);
      const ch = String.fromCodePoint(cp);
      const code =
        ch === "'" ? "'\\''" : ch === "\\" ? "'\\\\'" : cp >= 32 && cp < 127 ? `'${ch}'` : `rune(${cp})`;
      return { code, type: "char", prec: PREC_ATOM };
    }
    if (typeName === "boolean") {
      const v = value === true || value === "true";
      return { code: v ? "true" : "false", type: "boolean", prec: PREC_ATOM };
    }
    if (typeName === "real") {
      let s = String(value);
      if (/^-?\d+$/.test(s)) s += ".0";
      return { code: s, type: "real", prec: s.startsWith("-") ? PREC_UNARY : PREC_ATOM, untyped: true };
    }
    const s = String(value);
    return { code: s, type: "integer", prec: s.startsWith("-") ? PREC_UNARY : PREC_ATOM, untyped: true };
  }

  private lvalue(target: VarExpr | FieldAccessExpr): GoExpr {
    return this.expr(target);
  }

  expr(expr: Expr): GoExpr {
    switch (expr._type) {
      case "LiteralExpr":
        return this.literal(expr.value, expr.typeName);
      case "VarExpr":
        return { code: this.id(expr.name), type: this.typeOf(expr), prec: PREC_ATOM };
      case "FieldAccessExpr": {
        const obj = this.expr(expr.obj);
        return {
          code: `${this.paren(obj, PREC_ATOM)}.${this.id(expr.fieldName)}`,
          type: this.typeOf(expr),
          prec: PREC_ATOM,
        };
      }
      case "LenExpr":
        return { code: `len(${this.expr(expr.arg).code})`, type: "integer", prec: PREC_ATOM };
      case "UnaryExpr": {
        const operand = this.expr(expr.operand);
        if (expr.op === "not") {
          return { code: `!${this.paren(operand, PREC_UNARY)}`, type: "boolean", prec: PREC_UNARY };
        }
        // Unary +/- on a char yields an integer.
        const num = operand.type === "char" ? this.convert(operand, "integer") : operand;
        const op = expr.op === "-" ? "-" : "+";
        if (op === "+") return num;
        // Avoid `--x` (a syntax error in Go).
        const inner = this.paren(num, PREC_UNARY);
        return {
          code: inner.startsWith("-") ? `-(${inner})` : `-${inner}`,
          type: num.type,
          prec: PREC_UNARY,
          untyped: num.untyped,
        };
      }
      case "BinaryExpr":
        return this.binary(expr.op.toLowerCase(), expr.left, expr.right, this.typeOf(expr));
      default:
        throw new Error("ekspresi tidak dikenali saat konversi ke Go.");
    }
  }

  private binary(op: string, leftNode: Expr, rightNode: Expr, resultType: string): GoExpr {
    let left = this.expr(leftNode);
    let right = this.expr(rightNode);

    const make = (goOp: string, l: GoExpr, r: GoExpr, type: string): GoExpr => {
      const p = GO_PREC[goOp];
      // Go folds untyped constants with exact math (0.1 + 0.2 == 0.3), but the interpreter
      // uses float64 at every step. Typing one side as float64 makes Go round like it does.
      if (type === "real" && l.untyped && r.untyped) {
        l = { code: `float64(${l.code})`, type: "real", prec: PREC_ATOM };
      }
      // Go operators are left-associative: the right operand needs parens at equal precedence.
      return {
        code: `${this.paren(l, p)} ${goOp} ${this.paren(r, p + 1)}`,
        type,
        prec: p,
        untyped: !!(l.untyped && r.untyped),
      };
    };

    if (op === "and") return make("&&", left, right, "boolean");
    if (op === "or") return make("||", left, right, "boolean");

    if (op === "^") {
      if (resultType === "real") {
        const l = this.convert(left, "real");
        // Whole-number exponent (an integer, or a real literal like 2.0): plain multiplication.
        const wholeLiteral =
          rightNode._type === "LiteralExpr" && Number.isInteger(Number(rightNode.value));
        if (right.type !== "real" || wholeLiteral) {
          this.needPowReal = true;
          const r = wholeLiteral
            ? String(Number(rightNode.value))
            : this.convert(right, "integer").code;
          return { code: `powReal(${l.code}, ${r})`, type: "real", prec: PREC_ATOM };
        }
        // A fractional exponent (e.g. x ^ 0.5) has no fmt-only equivalent.
        this.imports.add("math");
        const r = this.convert(right, "real");
        return { code: `math.Pow(${l.code}, ${r.code})`, type: "real", prec: PREC_ATOM };
      }
      this.needPowInt = true;
      const l = this.convert(left, "integer");
      const r = this.convert(right, "integer");
      return { code: `powInt(${l.code}, ${r.code})`, type: "integer", prec: PREC_ATOM };
    }

    if (op === "/") {
      return make("/", this.convert(left, "real"), this.convert(right, "real"), "real");
    }

    if (["<", "<=", ">", ">=", "==", "!="].includes(op)) {
      // Bring both sides to a common type (char vs char compares as runes).
      if (left.type !== right.type) {
        const common = left.type === "real" || right.type === "real" ? "real" : "integer";
        left = this.convert(left, common);
        right = this.convert(right, common);
      }
      return make(op, left, right, "boolean");
    }

    // + (numbers or strings), -, *, div, mod, <<, >>, &, |
    const goOp = op === "div" ? "/" : op === "mod" ? "%" : op;
    if (resultType === "string") return make("+", left, right, "string");
    const target = resultType === "real" ? "real" : "integer";
    if (op === "<<" || op === ">>") {
      // The shift count may be any integer type in Go; only the shifted value sets the type.
      return make(goOp, this.convert(left, target), this.convert(right, "integer"), target);
    }
    return make(goOp, this.convert(left, target), this.convert(right, target), target);
  }

  /** Expression for a value that must have pseudocode type `type` (assignment, init, …). */
  private valueAs(expr: Expr, type: string): string {
    return this.convert(this.expr(expr), type).code;
  }

  // --- Declarations ----------------------------------------------------------------

  /** Constants that must become variables: Go constants can't call functions (`^`). */
  private localConstNames(decls: Decl[]): Set<string> {
    const local = new Set<string>();
    const needsLocal = (e: Expr): boolean => {
      switch (e._type) {
        case "BinaryExpr":
          return e.op === "^" || needsLocal(e.left) || needsLocal(e.right);
        case "UnaryExpr":
          return needsLocal(e.operand);
        case "VarExpr":
          return local.has(e.name); // depends on a constant that is already a variable
        default:
          return false;
      }
    };
    for (const d of decls) if (d._type === "ConstDecl" && needsLocal(d.value)) local.add(d.name);
    return local;
  }

  /** Package-level declarations: struct/alias types and constants. */
  private globalDeclarations(decls: Decl[], localConsts: Set<string>) {
    for (const d of decls) {
      if (d._type === "AliasDecl") {
        this.emit(`type ${this.id(d.aliasName)} = ${this.goType(d.targetType)}`);
        this.emit();
      } else if (d._type === "StructDecl") {
        this.emit(`type ${this.id(d.structName)} struct {`);
        this.depth++;
        for (const f of d.fields) {
          this.emit(`${f.names.map((n) => this.id(n)).join(", ")} ${this.goType(f.typeName)}`);
        }
        this.depth--;
        this.emit("}");
        this.emit();
      }
    }

    const consts = decls.filter((d) => d._type === "ConstDecl" && !localConsts.has(d.name));
    if (consts.length > 0) {
      this.emit("const (");
      this.depth++;
      for (const d of consts) {
        if (d._type !== "ConstDecl") continue;
        const type = this.checker.variables.get(d.name) ?? d.typeName;
        this.emit(`${this.id(d.name)} ${this.goType(d.typeName)} = ${this.valueAs(d.value, type)}`);
      }
      this.depth--;
      this.emit(")");
      this.emit();
    }
  }

  /**
   * The kamus variables, declared at the top of main(). Go rejects a local variable
   * that is never read ("declared and not used"), so those get a `_ = x` line.
   */
  private localDeclarations(decls: Decl[], localConsts: Set<string>, used: Set<string>) {
    const local = decls.filter(
      (d) => d._type === "VarDecl" || (d._type === "ConstDecl" && localConsts.has(d.name))
    );
    if (local.length === 0) return;

    // One `var` statement per kamus line (no grouped `var ( … )` block inside main).
    for (const d of local) {
      if (d._type === "ConstDecl") {
        const type = this.checker.variables.get(d.name) ?? d.typeName;
        this.emit(`var ${this.id(d.name)} ${this.goType(d.typeName)} = ${this.valueAs(d.value, type)} // konstanta`);
      } else if (d._type === "VarDecl") {
        this.emit(`var ${d.names.map((n) => this.id(n)).join(", ")} ${this.goType(d.typeName)}`);
      }
    }

    const unused = local
      .flatMap((d) => (d._type === "VarDecl" ? d.names : d._type === "ConstDecl" ? [d.name] : []))
      .filter((n) => !used.has(n));
    if (unused.length > 0) {
      this.emit("// Go menolak variabel lokal yang tidak pernah dibaca; '_ =' menandainya terpakai.");
      unused.forEach((n) => this.emit(`_ = ${this.id(n)}`));
    }
    this.emit();
  }

  /**
   * Names Go counts as "used": read in any expression, passed to fmt.Scan (&x),
   * used as a for-loop counter (read by the loop condition), or the root of an
   * assigned struct field. Plain assignment `x = …` alone does not count.
   */
  private readVariables(program: Program, localConsts: Set<string>): Set<string> {
    const used = new Set<string>();
    const root = (t: Expr): string | null =>
      t._type === "VarExpr" ? t.name : t._type === "FieldAccessExpr" ? root(t.obj) : null;
    const reads = (e: Expr) => {
      switch (e._type) {
        case "VarExpr":
          used.add(e.name);
          return;
        case "FieldAccessExpr":
          return reads(e.obj);
        case "LenExpr":
          return reads(e.arg);
        case "UnaryExpr":
          return reads(e.operand);
        case "BinaryExpr":
          reads(e.left);
          reads(e.right);
          return;
      }
    };
    const walk = (list: Stmt[]) => {
      for (const s of list) {
        switch (s._type) {
          case "AssignStmt": {
            if (s.target._type === "FieldAccessExpr") {
              const r = root(s.target);
              if (r) used.add(r);
            }
            reads(s.value);
            break;
          }
          case "InputStmt":
            s.targets.forEach((t) => {
              const r = root(t);
              if (r) used.add(r);
            });
            break;
          case "OutputStmt":
            s.values.forEach(reads);
            break;
          case "ForStmt":
            used.add(s.varName);
            reads(s.startExpr);
            reads(s.endExpr);
            if (s.stepExpr) reads(s.stepExpr);
            walk(s.body);
            break;
          case "IfStmt":
            s.branches.forEach((b) => {
              reads(b.condition);
              walk(b.body);
            });
            walk(s.elseBody);
            break;
          case "WhileStmt":
          case "RepeatStmt":
            reads(s.condition);
            walk(s.body);
            break;
        }
      }
    };
    walk(program.statements);
    // A constant-turned-variable may be read by another one's initializer.
    for (const d of program.declarations) {
      if (d._type === "ConstDecl" && localConsts.has(d.name)) reads(d.value);
    }
    return used;
  }

  // --- Statements ------------------------------------------------------------------

  private block(stmts: Stmt[]) {
    this.depth++;
    for (const s of stmts) this.stmt(s);
    this.depth--;
  }

  private stmt(stmt: Stmt) {
    switch (stmt._type) {
      case "AssignStmt":
        return this.assign(stmt);
      case "InputStmt":
        return this.input(stmt);
      case "OutputStmt":
        return this.output(stmt);
      case "ForStmt":
        return this.forStmt(stmt);
      case "IfStmt":
        return this.ifStmt(stmt);
      case "WhileStmt":
        this.emit(`for ${this.expr(stmt.condition).code} {`);
        this.block(stmt.body);
        this.emit("}");
        return;
      case "RepeatStmt":
        this.emit("for {");
        this.block(stmt.body);
        this.depth++;
        this.emit(`if ${this.expr(stmt.condition).code} {`);
        this.depth++;
        this.emit("break");
        this.depth--;
        this.emit("}");
        this.depth--;
        this.emit("}");
        return;
    }
  }

  private assign(stmt: AssignStmt) {
    const target = this.lvalue(stmt.target);
    const value = this.convert(this.expr(stmt.value), target.type);
    // x <- x + 1  →  x++ ;  x <- x - 1  →  x--
    const v = stmt.value;
    if (
      v._type === "BinaryExpr" &&
      (v.op === "+" || v.op === "-") &&
      target.type === "integer" &&
      v.right._type === "LiteralExpr" &&
      String(v.right.value) === "1" &&
      this.expr(v.left).code === target.code
    ) {
      this.emit(`${target.code}${v.op}${v.op}`);
      return;
    }
    this.emit(`${target.code} = ${value.code}`);
  }

  private input(stmt: InputStmt) {
    // Consecutive non-char targets share one fmt.Scan call; chars need the helper.
    let batch: string[] = [];
    const flush = () => {
      if (batch.length) {
        this.imports.add("fmt");
        this.emit(`fmt.Scan(${batch.join(", ")})`);
      }
      batch = [];
    };
    for (const t of stmt.targets) {
      const target = this.lvalue(t);
      if (target.type === "char") {
        flush();
        this.needScanChar = true;
        this.emit(`scanChar(&${target.code})`);
      } else {
        batch.push(`&${target.code}`);
      }
    }
    flush();
  }

  private output(stmt: OutputStmt) {
    const args = stmt.values.map((v) => {
      const e = this.expr(v);
      if (e.type === "real") {
        this.needFormatReal = true;
        return `formatReal(${e.code})`;
      }
      if (e.type === "char") return `string(${e.code})`;
      return e.code;
    });
    this.imports.add("fmt");
    this.emit(`fmt.Println(${args.join(", ")})`);
  }

  /** Whether `expr` can't change while the loop body runs (so it can be re-evaluated). */
  private isStable(expr: Expr, assigned: Set<string>): boolean {
    switch (expr._type) {
      case "LiteralExpr":
        return true;
      case "VarExpr":
        return !assigned.has(expr.name);
      case "FieldAccessExpr":
        return this.isStable(expr.obj, assigned);
      case "LenExpr":
        return this.isStable(expr.arg, assigned);
      case "UnaryExpr":
        return this.isStable(expr.operand, assigned);
      case "BinaryExpr":
        return this.isStable(expr.left, assigned) && this.isStable(expr.right, assigned);
      default:
        return false;
    }
  }

  /** Root variable names written anywhere in `stmts` (assignments, input, loop counters). */
  private assignedIn(stmts: Stmt[], acc = new Set<string>()): Set<string> {
    const root = (t: Expr): string | null =>
      t._type === "VarExpr" ? t.name : t._type === "FieldAccessExpr" ? root(t.obj) : null;
    for (const s of stmts) {
      if (s._type === "AssignStmt") {
        const r = root(s.target);
        if (r) acc.add(r);
      } else if (s._type === "InputStmt") {
        for (const t of s.targets) {
          const r = root(t);
          if (r) acc.add(r);
        }
      } else if (s._type === "ForStmt") {
        acc.add(s.varName);
        this.assignedIn(s.body, acc);
      } else if (s._type === "IfStmt") {
        for (const b of s.branches) this.assignedIn(b.body, acc);
        this.assignedIn(s.elseBody, acc);
      } else if (s._type === "WhileStmt" || s._type === "RepeatStmt") {
        this.assignedIn(s.body, acc);
      }
    }
    return acc;
  }

  private forStmt(stmt: ForStmt) {
    const v = this.id(stmt.varName);
    const varType = this.checker.variables.get(stmt.varName) ?? "integer";
    const assigned = this.assignedIn(stmt.body);
    assigned.add(stmt.varName);

    // `end` and `step` are evaluated once, before the loop. Re-evaluating them in the
    // Go condition is equivalent only if the body can't change them.
    const hoisted: string[] = [];
    const once = (expr: Expr, base: string): GoExpr => {
      const e = this.convert(this.expr(expr), varType);
      if (this.isStable(expr, assigned)) return e;
      const name = this.temp(base);
      hoisted.push(`${name} := ${e.code}`);
      return { code: name, type: varType, prec: PREC_ATOM };
    };

    // The interpreter keeps the counter in a hidden variable: assigning it in the body
    // doesn't change the iteration, and afterwards it holds the last value (or the start
    // value if the body never ran). Mirror that when the difference is observable.
    const bodyWritesCounter = this.assignedIn(stmt.body).has(stmt.varName);
    const faithful = bodyWritesCounter || this.counterReadOutside.has(stmt.varName);
    const loopVar = faithful ? this.temp(`${v}Iter`) : v;

    const start = this.valueAs(stmt.startExpr, varType);
    const end = once(stmt.endExpr, "batas");
    let step: GoExpr | null = stmt.stepExpr ? once(stmt.stepExpr, "langkah") : null;

    // Direction: known from `downto`, or from a literal step's sign.
    let dir: "up" | "down" | "runtime" = stmt.descending ? "down" : "up";
    if (!stmt.descending && step) {
      const lit = stmt.stepExpr!;
      const negLiteral =
        lit._type === "UnaryExpr" && lit.op === "-" && lit.operand._type === "LiteralExpr";
      if (negLiteral) dir = "down";
      else if (lit._type !== "LiteralExpr") dir = "runtime";
    }
    if (dir === "runtime" && step && !hoisted.some((h) => h.startsWith(step!.code + " "))) {
      // The sign is needed twice per iteration: evaluate it once.
      const name = this.temp("langkah");
      hoisted.push(`${name} := ${step.code}`);
      step = { code: name, type: varType, prec: PREC_ATOM };
    }

    const lv = loopVar;
    let post: string;
    if (!step || step.code === "1") post = stmt.descending ? `${lv}--` : `${lv}++`;
    else if (stmt.descending) post = `${lv} -= ${this.paren(step, PREC_UNARY)}`;
    else if (dir === "down" && step.code.startsWith("-")) {
      const mag = step.code.slice(1);
      post = mag === "1" ? `${lv}--` : `${lv} -= ${mag}`;
    } else post = `${lv} += ${step.code}`;

    const endCode = this.paren(end, 4);
    const cond =
      dir === "up"
        ? `${lv} <= ${endCode}`
        : dir === "down"
        ? `${lv} >= ${endCode}`
        : `(${step!.code} > 0 && ${lv} <= ${endCode}) || (${step!.code} < 0 && ${lv} >= ${endCode})`;

    if (hoisted.length) {
      this.emit("{");
      this.depth++;
      hoisted.forEach((h) => this.emit(h));
    }
    if (faithful) {
      this.emit(`${v} = ${start}`);
      this.emit(`for ${lv} := ${v}; ${cond}; ${post} {`);
      this.depth++;
      this.emit(`${v} = ${lv}`);
      this.depth--;
    } else {
      this.emit(`for ${v} = ${start}; ${cond}; ${post} {`);
    }
    this.block(stmt.body);
    this.emit("}");
    if (hoisted.length) {
      this.depth--;
      this.emit("}");
    }
  }

  private ifStmt(stmt: IfStmt) {
    stmt.branches.forEach((b, i) => {
      const cond = this.expr(b.condition).code;
      this.emit(i === 0 ? `if ${cond} {` : `} else if ${cond} {`);
      this.block(b.body);
    });
    if (stmt.elseBody.length > 0) {
      this.emit("} else {");
      this.block(stmt.elseBody);
    }
    this.emit("}");
  }

  /** Fill `counterReadOutside`: for-loop counters that some expression reads outside their loops. */
  private findCountersReadOutside(stmts: Stmt[]) {
    const counters = new Set<string>();
    const collect = (list: Stmt[]) => {
      for (const s of list) {
        if (s._type === "ForStmt") {
          counters.add(s.varName);
          collect(s.body);
        } else if (s._type === "IfStmt") {
          s.branches.forEach((b) => collect(b.body));
          collect(s.elseBody);
        } else if (s._type === "WhileStmt" || s._type === "RepeatStmt") collect(s.body);
      }
    };
    collect(stmts);

    const reads = (e: Expr, active: Set<string>) => {
      switch (e._type) {
        case "VarExpr":
          if (counters.has(e.name) && !active.has(e.name)) this.counterReadOutside.add(e.name);
          return;
        case "FieldAccessExpr":
          return reads(e.obj, active);
        case "LenExpr":
          return reads(e.arg, active);
        case "UnaryExpr":
          return reads(e.operand, active);
        case "BinaryExpr":
          reads(e.left, active);
          reads(e.right, active);
          return;
      }
    };
    const walk = (list: Stmt[], active: Set<string>) => {
      for (const s of list) {
        switch (s._type) {
          case "AssignStmt":
            if (s.target._type === "FieldAccessExpr") reads(s.target.obj, active);
            reads(s.value, active);
            break;
          case "OutputStmt":
            s.values.forEach((v) => reads(v, active));
            break;
          case "ForStmt":
            // start/end/step are evaluated before this loop's counter is active.
            reads(s.startExpr, active);
            reads(s.endExpr, active);
            if (s.stepExpr) reads(s.stepExpr, active);
            walk(s.body, new Set([...active, s.varName]));
            break;
          case "IfStmt":
            s.branches.forEach((b) => {
              reads(b.condition, active);
              walk(b.body, active);
            });
            walk(s.elseBody, active);
            break;
          case "WhileStmt":
          case "RepeatStmt":
            reads(s.condition, active);
            walk(s.body, active);
            break;
        }
      }
    };
    walk(stmts, new Set());
  }

  // --- Program ---------------------------------------------------------------------

  program(program: Program): string {
    // Reserve every declared name first so helpers/temps never take them.
    for (const d of program.declarations) {
      if (d._type === "VarDecl") d.names.forEach((n) => this.id(n));
      else if (d._type === "ConstDecl") this.id(d.name);
      else if (d._type === "AliasDecl") this.id(d.aliasName);
      else if (d._type === "StructDecl") this.id(d.structName);
    }

    this.findCountersReadOutside(program.statements);

    const localConsts = this.localConstNames(program.declarations);
    const header = this.out;
    this.out = [];
    this.globalDeclarations(program.declarations, localConsts);
    const decls = this.out;

    this.out = [];
    this.depth = 1;
    this.localDeclarations(
      program.declarations,
      localConsts,
      this.readVariables(program, localConsts)
    );
    for (const s of program.statements) this.stmt(s);
    // Drop the blank line after the var block when main has no statements.
    if (this.out[this.out.length - 1] === "") this.out.pop();
    const body = this.out;
    this.depth = 0;
    this.out = header;

    this.emit(`// Program ${program.name}: hasil konversi otomatis dari pseudocode.`);
    this.emit("package main");
    this.emit();
    if (this.needFormatReal || this.needScanChar) this.imports.add("fmt");
    const imports = [...this.imports].sort();
    if (imports.length === 1) {
      this.emit(`import "${imports[0]}"`);
      this.emit();
    } else if (imports.length > 1) {
      this.emit("import (");
      imports.forEach((p) => this.emit(`\t"${p}"`));
      this.emit(")");
      this.emit();
    }
    this.out.push(...decls);

    this.emit("func main() {");
    this.out.push(...body);
    this.emit("}");

    if (this.needPowInt) {
      this.out.push(
        "",
        "// powInt menghitung a pangkat b untuk bilangan bulat (b >= 0).",
        "func powInt(a, b int) int {",
        "\thasil := 1",
        "\tfor ; b > 0; b >>= 1 {",
        "\t\tif b&1 == 1 {",
        "\t\t\thasil *= a",
        "\t\t}",
        "\t\ta *= a",
        "\t}",
        "\treturn hasil",
        "}"
      );
    }
    if (this.needPowReal) {
      this.out.push(
        "",
        "// powReal menghitung a pangkat b untuk bilangan real dengan pangkat bulat.",
        "func powReal(a float64, b int) float64 {",
        "\tif b < 0 {",
        "\t\treturn 1 / powReal(a, -b)",
        "\t}",
        "\thasil := 1.0",
        "\tfor ; b > 0; b >>= 1 {",
        "\t\tif b&1 == 1 {",
        "\t\t\thasil *= a",
        "\t\t}",
        "\t\ta *= a",
        "\t}",
        "\treturn hasil",
        "}"
      );
    }
    if (this.needFormatReal) {
      this.out.push(
        "",
        "// formatReal mencetak bilangan real seperti interpreter pseudocode:",
        "// 3.0 dicetak \"3\" dan 1500000.5 dicetak \"1500000.5\" (fmt.Println akan",
        "// mencetaknya sebagai \"1.5000005e+06\").",
        "func formatReal(x float64) string {",
        "\tif x > -1e15 && x < 1e15 && x == float64(int64(x)) {",
        "\t\treturn fmt.Sprint(int64(x))",
        "\t}",
        "\tif x > 1.7976931348623157e308 {",
        "\t\treturn \"Infinity\"",
        "\t}",
        "\tif x < -1.7976931348623157e308 {",
        "\t\treturn \"-Infinity\"",
        "\t}",
        "\ts := fmt.Sprint(x) // contoh: 1.5000005e+06",
        "\te := -1",
        "\tfor i := 0; i < len(s); i++ {",
        "\t\tif s[i] == 'e' {",
        "\t\t\te = i",
        "\t\t}",
        "\t}",
        "\tif e < 0 {",
        "\t\treturn s",
        "\t}",
        "\tmantisa, pangkat := s[:e], 0",
        "\tfor _, c := range s[e+2:] {",
        "\t\tpangkat = pangkat*10 + int(c-'0')",
        "\t}",
        "\tif s[e+1] == '-' {",
        "\t\tpangkat = -pangkat",
        "\t}",
        "\tif pangkat >= 21 || pangkat <= -7 {",
        "\t\treturn fmt.Sprintf(\"%se%+d\", mantisa, pangkat)",
        "\t}",
        "\tnegatif := mantisa[0] == '-'",
        "\tif negatif {",
        "\t\tmantisa = mantisa[1:]",
        "\t}",
        "\tdigit := \"\"",
        "\tfor _, c := range mantisa {",
        "\t\tif c != '.' {",
        "\t\t\tdigit += string(c)",
        "\t\t}",
        "\t}",
        "\ttitik := 1 + pangkat // posisi titik desimal di dalam digit",
        "\thasil := \"\"",
        "\tif titik <= 0 {",
        "\t\thasil = \"0.\"",
        "\t\tfor i := 0; i < -titik; i++ {",
        "\t\t\thasil += \"0\"",
        "\t\t}",
        "\t\thasil += digit",
        "\t} else if titik >= len(digit) {",
        "\t\thasil = digit",
        "\t\tfor len(hasil) < titik {",
        "\t\t\thasil += \"0\"",
        "\t\t}",
        "\t} else {",
        "\t\thasil = digit[:titik] + \".\" + digit[titik:]",
        "\t}",
        "\tif negatif {",
        "\t\thasil = \"-\" + hasil",
        "\t}",
        "\treturn hasil",
        "}"
      );
    }
    if (this.needScanChar) {
      this.out.push(
        "",
        "// scanChar membaca satu token dan mengambil karakter pertamanya.",
        "func scanChar(c *rune) {",
        "\tvar s string",
        "\tfmt.Scan(&s)",
        "\tfor _, r := range s {",
        "\t\t*c = r",
        "\t\treturn",
        "\t}",
        "}"
      );
    }
    return this.out.join("\n") + "\n";
  }
}

/** Convert pseudocode source to a Go program. Fails on the first syntax/semantic error. */
export function transpileToGo(source: string): GoTranspileResult {
  try {
    const program = parse(tokenize(source), source);
    const checker = new SemanticChecker(source.split(/\r?\n/));
    checker.checkProgram(program);
    return { ok: true, code: new GoTranspiler(checker).program(program) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}
