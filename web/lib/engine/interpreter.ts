import {
  AliasDecl,
  AssignStmt,
  BinaryExpr,
  ConstDecl,
  Expr,
  FieldAccessExpr,
  ForStmt,
  IfStmt,
  InputStmt,
  LenExpr,
  LiteralExpr,
  OutputStmt,
  Program,
  RepeatStmt,
  Stmt,
  StructDecl,
  UnaryExpr,
  VarDecl,
  VarExpr,
  WhileStmt,
} from "./ast";
import { runtimeError } from "./errors";

export const UNINITIALIZED = Symbol("UNINITIALIZED");

export function wrapInt64(val: bigint | number): bigint {
  const n = typeof val === "bigint" ? val : BigInt(Math.trunc(val));
  return BigInt.asIntN(64, n);
}

export function copyRuntimeValue(val: unknown): unknown {
  if (val && typeof val === "object" && typeof val !== "bigint") {
    const copy: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      copy[k] = copyRuntimeValue(v);
    }
    return copy;
  }
  return val;
}

export function formatValue(val: unknown, varType?: string | null): string {
  if (varType === "char") {
    return String.fromCharCode(Number(val));
  }
  if (varType === "boolean" || typeof val === "boolean") {
    return val ? "true" : "false";
  }
  if (varType === "real" || typeof val === "number") {
    const fval = Number(val);
    if (Number.isFinite(fval) && Number.isInteger(fval) && Math.abs(fval) < 1e15) {
      return Math.trunc(fval).toString();
    }
    return fval.toString();
  }
  if (typeof val === "bigint") {
    return val.toString();
  }
  return String(val);
}

export function formatOutput(values: Array<[unknown, string | null]>): string {
  const formattedItems = values.map(([val, t]) => formatValue(val, t));
  return formattedItems.join(" ") + "\n";
}

export class AsyncInputReader {
  private tokens: string[] = [];
  private onRequestInput: () => void;
  private pendingResolver: ((line: string) => void) | null = null;

  constructor(onRequestInput: () => void) {
    this.onRequestInput = onRequestInput;
  }

  feedLine(rawLine: string): void {
    const parts = rawLine.trim().split(/\s+/).filter(Boolean);
    for (const part of parts) {
      this.tokens.push(part);
    }
    if (this.pendingResolver) {
      const resolver = this.pendingResolver;
      this.pendingResolver = null;
      resolver(rawLine);
    }
  }

  cancel(): void {
    if (this.pendingResolver) {
      const resolver = this.pendingResolver;
      this.pendingResolver = null;
      resolver("");
    }
  }

  async nextToken(
    line: number,
    col: number,
    sourceLine: string
  ): Promise<string> {
    while (this.tokens.length === 0) {
      this.onRequestInput();
      const inputStr = await new Promise<string>((resolve) => {
        this.pendingResolver = resolve;
      });
      if (!inputStr && this.tokens.length === 0) {
        throw runtimeError(
          "masukan (input) habis terlalu cepat sebelum semua variabel terbaca.",
          line,
          col,
          sourceLine
        );
      }
    }
    return this.tokens.shift()!;
  }
}

export class Interpreter {
  sourceLines: string[];
  reader: AsyncInputReader;
  stdout: (text: string) => void;
  maxSteps: number;
  steps: number;
  isStopped: boolean;

  aliases: Map<string, string>;
  structs: Map<string, Record<string, string>>;
  varTypes: Map<string, string>;
  env: Map<string, unknown>;

  constructor(
    sourceLines: string[],
    reader: AsyncInputReader,
    stdout: (text: string) => void,
    maxSteps: number = 500_000
  ) {
    this.sourceLines = sourceLines;
    this.reader = reader;
    this.stdout = stdout;
    this.maxSteps = maxSteps;
    this.steps = 0;
    this.isStopped = false;

    this.aliases = new Map();
    this.structs = new Map();
    this.varTypes = new Map();
    this.env = new Map();
  }

  stop(): void {
    this.isStopped = true;
    this.reader.cancel();
  }

  _tickStep(stmt: Stmt): void {
    if (this.isStopped) {
      throw new Error("Execution stopped by user");
    }
    this.steps++;
    if (this.steps > this.maxSteps) {
      throw runtimeError(
        `batas maksimum langkah eksekusi (${this.maxSteps}) terlampaui (kemungkinan perulangan tak berujung).`,
        stmt.line,
        stmt.col,
        this._lineText(stmt.line)
      );
    }
  }

  async _execBlock(stmts: Stmt[]): Promise<void> {
    for (const bodyStmt of stmts) {
      if (this.isStopped) return;
      await this.execStmt(bodyStmt);
    }
  }

  _lineText(lineNo: number): string {
    if (lineNo >= 1 && lineNo <= this.sourceLines.length) {
      return this.sourceLines[lineNo - 1];
    }
    return "";
  }

  resolveType(typeName: string): string {
    let curr = typeName;
    while (this.aliases.has(curr)) {
      curr = this.aliases.get(curr)!;
    }
    return curr;
  }

  makeInitialValue(resolvedType: string): unknown {
    if (this.structs.has(resolvedType)) {
      const structObj: Record<string, unknown> = {};
      const fields = this.structs.get(resolvedType)!;
      for (const [fname, ftype] of Object.entries(fields)) {
        structObj[fname] = this.makeInitialValue(ftype);
      }
      return structObj;
    }
    return UNINITIALIZED;
  }

  async run(program: Program): Promise<void> {
    // Tahap 1: Kumpulkan alias dan struct
    const rawStructs: StructDecl[] = [];
    for (const decl of program.declarations) {
      if (decl._type === "AliasDecl") {
        this.aliases.set(decl.aliasName, decl.targetType);
      } else if (decl._type === "StructDecl") {
        rawStructs.push(decl);
      }
    }

    for (const sdecl of rawStructs) {
      const fieldMap: Record<string, string> = {};
      for (const fdecl of sdecl.fields) {
        const ftype = this.resolveType(fdecl.typeName);
        for (const fname of fdecl.names) {
          fieldMap[fname] = ftype;
        }
      }
      this.structs.set(sdecl.structName, fieldMap);
    }

    // Tahap 2: Siapkan variabel dan hitung nilai konstanta
    for (const decl of program.declarations) {
      if (decl._type === "VarDecl") {
        const rtype = this.resolveType(decl.typeName);
        for (const name of decl.names) {
          this.varTypes.set(name, rtype);
          this.env.set(name, this.makeInitialValue(rtype));
        }
      } else if (decl._type === "ConstDecl") {
        const rtype = this.resolveType(decl.typeName);
        const [val] = this.evalExpr(decl.value);
        const coerced = this._coerceValue(val, rtype);
        this.varTypes.set(decl.name, rtype);
        this.env.set(decl.name, coerced);
      }
    }

    // Tahap 3: Jalankan statement di algoritma
    for (const stmt of program.statements) {
      if (this.isStopped) return;
      await this.execStmt(stmt);
    }
  }

  _coerceValue(val: unknown, targetType: string): unknown {
    if (targetType === "real" && typeof val === "bigint") {
      return Number(val);
    }
    if (
      (targetType === "integer" || targetType === "char") &&
      (typeof val === "bigint" || typeof val === "number")
    ) {
      return wrapInt64(val as bigint | number);
    }
    if (this.structs.has(targetType)) {
      return copyRuntimeValue(val);
    }
    return val;
  }

  _formatLvalueName(expr: Expr): string {
    if (expr._type === "VarExpr") {
      return expr.name;
    }
    if (expr._type === "FieldAccessExpr") {
      return `${this._formatLvalueName(expr.obj)}.${expr.fieldName}`;
    }
    return "variabel";
  }

  _resolveLvalueContainer(
    target: VarExpr | FieldAccessExpr
  ): [Record<string, unknown> | Map<string, unknown>, string, string] {
    if ("name" in target) {
      return [this.env, target.name, this.varTypes.get(target.name)!];
    }

    const fieldAccess = target as FieldAccessExpr;
    const [parentObj, parentKey, parentType] = this._resolveLvalueContainer(
      fieldAccess.obj as VarExpr | FieldAccessExpr
    );
    const structObj =
      parentObj instanceof Map
        ? (parentObj.get(parentKey) as Record<string, unknown>)
        : (parentObj[parentKey] as Record<string, unknown>);

    const fieldType = this.structs.get(parentType)![fieldAccess.fieldName];
    return [structObj, fieldAccess.fieldName, fieldType];
  }

  async execStmt(stmt: Stmt): Promise<void> {
    this._tickStep(stmt);
    if (stmt._type === "AssignStmt") return this.execAssign(stmt);
    if (stmt._type === "InputStmt") return this.execInput(stmt);
    if (stmt._type === "OutputStmt") return this.execOutput(stmt);
    if (stmt._type === "ForStmt") return this.execFor(stmt);
    if (stmt._type === "IfStmt") return this.execIf(stmt);
    if (stmt._type === "WhileStmt") return this.execWhile(stmt);
    if (stmt._type === "RepeatStmt") return this.execRepeat(stmt);

    throw runtimeError(
      "instruksi ini belum dapat dijalankan oleh interpreter.",
      stmt.line,
      stmt.col,
      this._lineText(stmt.line)
    );
  }

  execAssign(stmt: AssignStmt): void {
    const [val] = this.evalExpr(stmt.value);
    const [container, key, targetType] = this._resolveLvalueContainer(stmt.target);
    const coerced = this._coerceValue(val, targetType);
    if (container instanceof Map) {
      container.set(key, coerced);
    } else {
      container[key] = coerced;
    }
  }

  async execInput(stmt: InputStmt): Promise<void> {
    for (const target of stmt.targets) {
      if (this.isStopped) return;
      const rawToken = await this.reader.nextToken(
        target.line,
        target.col,
        this._lineText(target.line)
      );
      if (this.isStopped) return;

      const [container, key, targetType] = this._resolveLvalueContainer(target);
      const label = this._formatLvalueName(target);

      const setVal = (v: unknown) => {
        if (container instanceof Map) {
          container.set(key, v);
        } else {
          container[key] = v;
        }
      };

      if (targetType === "integer") {
        try {
          if (!/^-?\d+$/.test(rawToken)) {
            throw new Error();
          }
          const val = wrapInt64(BigInt(rawToken));
          setVal(val);
        } catch {
          throw runtimeError(
            `masukan '${rawToken}' bukan bilangan bulat (integer) yang valid untuk '${label}'.`,
            target.line,
            target.col,
            this._lineText(target.line)
          );
        }
      } else if (targetType === "real") {
        const val = parseFloat(rawToken);
        if (isNaN(val) || !isFinite(val)) {
          throw runtimeError(
            `masukan '${rawToken}' bukan bilangan riil (real) yang valid untuk '${label}'.`,
            target.line,
            target.col,
            this._lineText(target.line)
          );
        }
        setVal(val);
      } else if (targetType === "string") {
        setVal(rawToken);
      } else if (targetType === "boolean") {
        if (rawToken === "true") {
          setVal(true);
        } else if (rawToken === "false") {
          setVal(false);
        } else {
          throw runtimeError(
            `masukan '${rawToken}' bukan nilai boolean ('true' atau 'false') yang valid untuk '${label}'.`,
            target.line,
            target.col,
            this._lineText(target.line)
          );
        }
      } else if (targetType === "char") {
        if (rawToken.length !== 1) {
          throw runtimeError(
            `masukan '${rawToken}' bukan karakter tunggal (char) yang valid untuk '${label}'.`,
            target.line,
            target.col,
            this._lineText(target.line)
          );
        }
        setVal(wrapInt64(BigInt(rawToken.charCodeAt(0))));
      }
    }
  }

  execOutput(stmt: OutputStmt): void {
    const evaluated: Array<[unknown, string | null]> = [];
    for (const expr of stmt.values) {
      const [val, valType] = this.evalExpr(expr);
      if (valType === "char") {
        const codePoint = Number(val);
        if (codePoint < 0 || codePoint > 0x10ffff) {
          throw runtimeError(
            `nilai kode karakter (${codePoint}) berada di luar rentang karakter ASCII/Unicode yang valid.`,
            expr.line,
            expr.col,
            this._lineText(expr.line)
          );
        }
      }
      evaluated.push([val, valType]);
    }

    this.stdout(formatOutput(evaluated));
  }

  async execFor(stmt: ForStmt): Promise<void> {
    const [startVal] = this.evalExpr(stmt.startExpr);
    const [endVal] = this.evalExpr(stmt.endExpr);

    let curr = wrapInt64(startVal as bigint | number);
    const limit = wrapInt64(endVal as bigint | number);

    let step = 1n;
    if (stmt.stepExpr) {
      const [stepVal] = this.evalExpr(stmt.stepExpr);
      step = wrapInt64(stepVal as bigint | number);
      if (step === 0n) {
        throw runtimeError(
          "nilai langkah (step) pada perulangan 'for' tidak boleh 0.",
          stmt.stepExpr.line,
          stmt.stepExpr.col,
          this._lineText(stmt.stepExpr.line)
        );
      }
    }

    // 'downto' counts down: default -1, and 'step k' means "subtract k" (k > 0).
    if (stmt.descending) {
      if (step < 0n) {
        throw runtimeError(
          "nilai langkah (step) pada perulangan 'for ... downto' harus positif (step menyatakan besar pengurangan setiap putaran).",
          stmt.stepExpr!.line,
          stmt.stepExpr!.col,
          this._lineText(stmt.stepExpr!.line)
        );
      }
      step = -step;
    }

    this.env.set(stmt.varName, curr);
    if (step > 0n) {
      while (curr <= limit) {
        if (this.isStopped) return;
        this._tickStep(stmt);
        this.env.set(stmt.varName, wrapInt64(curr));
        await this._execBlock(stmt.body);
        curr += step;
      }
    } else {
      while (curr >= limit) {
        if (this.isStopped) return;
        this._tickStep(stmt);
        this.env.set(stmt.varName, wrapInt64(curr));
        await this._execBlock(stmt.body);
        curr += step;
      }
    }
  }

  async execIf(stmt: IfStmt): Promise<void> {
    for (const branch of stmt.branches) {
      const [condVal] = this.evalExpr(branch.condition);
      if (Boolean(condVal)) {
        await this._execBlock(branch.body);
        return;
      }
    }
    await this._execBlock(stmt.elseBody);
  }

  async execWhile(stmt: WhileStmt): Promise<void> {
    while (true) {
      if (this.isStopped) return;
      const [condVal] = this.evalExpr(stmt.condition);
      if (!Boolean(condVal)) break;
      this._tickStep(stmt);
      await this._execBlock(stmt.body);
    }
  }

  async execRepeat(stmt: RepeatStmt): Promise<void> {
    while (true) {
      if (this.isStopped) return;
      this._tickStep(stmt);
      await this._execBlock(stmt.body);
      const [condVal] = this.evalExpr(stmt.condition);
      if (Boolean(condVal)) break;
    }
  }

  evalExpr(expr: Expr): [unknown, string] {
    if (expr._type === "LiteralExpr") {
      if (expr.typeName === "integer" || expr.typeName === "char") {
        return [wrapInt64(expr.value as bigint | number), expr.typeName];
      }
      if (expr.typeName === "real") {
        return [Number(expr.value), "real"];
      }
      return [expr.value, expr.typeName];
    }

    if (expr._type === "VarExpr") {
      const val = this.env.has(expr.name)
        ? this.env.get(expr.name)
        : UNINITIALIZED;
      if (val === UNINITIALIZED) {
        throw runtimeError(
          `variabel '${expr.name}' belum diisi nilainya (belum pernah di-assign atau dibaca lewat input).`,
          expr.line,
          expr.col,
          this._lineText(expr.line)
        );
      }
      return [val, this.varTypes.get(expr.name)!];
    }

    if (expr._type === "FieldAccessExpr") {
      const [objVal, objType] = this.evalExpr(expr.obj);
      const structRecord = objVal as Record<string, unknown>;
      const fieldVal =
        structRecord && structRecord[expr.fieldName] !== undefined
          ? structRecord[expr.fieldName]
          : UNINITIALIZED;

      if (fieldVal === UNINITIALIZED) {
        const label = this._formatLvalueName(expr);
        throw runtimeError(
          `field '${label}' belum diisi nilainya (belum pernah di-assign atau dibaca lewat input).`,
          expr.line,
          expr.fieldCol,
          this._lineText(expr.line)
        );
      }
      const fieldType = this.structs.get(objType)![expr.fieldName];
      return [fieldVal, fieldType];
    }

    if (expr._type === "LenExpr") {
      const [val] = this.evalExpr(expr.arg);
      return [wrapInt64(BigInt(String(val).length)), "integer"];
    }

    if (expr._type === "UnaryExpr") {
      const [val, valType] = this.evalExpr(expr.operand);
      if (expr.op === "not") {
        return [!Boolean(val), "boolean"];
      }
      if (expr.op === "+") {
        if (valType === "real") {
          return [Number(val), "real"];
        }
        return [wrapInt64(val as bigint | number), "integer"];
      }
      if (expr.op === "-") {
        if (valType === "real") {
          return [-Number(val), "real"];
        }
        return [wrapInt64(-(val as bigint)), "integer"];
      }
    }

    if (expr._type === "BinaryExpr") {
      const op = expr.op;

      // 1. Short-circuit and, or
      if (op === "and") {
        const [leftVal] = this.evalExpr(expr.left);
        if (!Boolean(leftVal)) {
          return [false, "boolean"];
        }
        const [rightVal] = this.evalExpr(expr.right);
        return [Boolean(rightVal), "boolean"];
      }

      if (op === "or") {
        const [leftVal] = this.evalExpr(expr.left);
        if (Boolean(leftVal)) {
          return [true, "boolean"];
        }
        const [rightVal] = this.evalExpr(expr.right);
        return [Boolean(rightVal), "boolean"];
      }

      const [leftVal, leftType] = this.evalExpr(expr.left);
      const [rightVal, rightType] = this.evalExpr(expr.right);

      // 2. String concatenation (+)
      if (op === "+" && leftType === "string" && rightType === "string") {
        return [String(leftVal) + String(rightVal), "string"];
      }

      // 3. +, -, *
      if (op === "+" || op === "-" || op === "*") {
        const isReal = leftType === "real" || rightType === "real";
        if (isReal) {
          const lNum = Number(leftVal);
          const rNum = Number(rightVal);
          if (op === "+") return [lNum + rNum, "real"];
          if (op === "-") return [lNum - rNum, "real"];
          if (op === "*") return [lNum * rNum, "real"];
        } else {
          const lInt = leftVal as bigint;
          const rInt = rightVal as bigint;
          if (op === "+") return [wrapInt64(lInt + rInt), "integer"];
          if (op === "-") return [wrapInt64(lInt - rInt), "integer"];
          if (op === "*") return [wrapInt64(lInt * rInt), "integer"];
        }
      }

      // 4. Power (^)
      if (op === "^") {
        const isReal = leftType === "real" || rightType === "real";
        if (isReal) {
          const lNum = Number(leftVal);
          const rNum = Number(rightVal);
          if (lNum === 0 && rNum < 0) {
            throw runtimeError(
              "pembagian dengan nol (0 dipangkatkan bilangan negatif) tidak diperbolehkan.",
              expr.line,
              expr.col,
              this._lineText(expr.line)
            );
          }
          if (lNum < 0 && !Number.isInteger(rNum)) {
            throw runtimeError(
              "bilangan negatif dipangkatkan pecahan tidak menghasilkan bilangan riil (real).",
              expr.line,
              expr.col,
              this._lineText(expr.line)
            );
          }
          const resPow = Math.pow(lNum, rNum);
          return [resPow, "real"];
        } else {
          const lInt = leftVal as bigint;
          const rInt = rightVal as bigint;
          if (rInt < 0n) {
            throw runtimeError(
              "pangkat negatif pada bilangan bulat (integer) tidak menghasilkan integer.",
              expr.line,
              expr.col,
              this._lineText(expr.line)
            );
          }
          if (rInt === 0n) {
            return [1n, "integer"];
          }
          // Modular exponentiation modulo 2^64
          let base = BigInt.asUintN(64, lInt);
          let exp = rInt;
          let res = 1n;
          const MOD = 1n << 64n;
          while (exp > 0n) {
            if ((exp & 1n) === 1n) {
              res = (res * base) % MOD;
            }
            base = (base * base) % MOD;
            exp >>= 1n;
          }
          return [wrapInt64(res), "integer"];
        }
      }

      // 5. Division (/)
      if (op === "/") {
        const rNum = Number(rightVal);
        if (rNum === 0) {
          throw runtimeError(
            "pembagian dengan nol (division by zero) tidak diperbolehkan.",
            expr.line,
            expr.col,
            this._lineText(expr.line)
          );
        }
        return [Number(leftVal) / rNum, "real"];
      }

      // 6. div, mod
      if (op === "div" || op === "mod") {
        const lInt = leftVal as bigint;
        const rInt = rightVal as bigint;
        if (rInt === 0n) {
          throw runtimeError(
            "pembagian dengan nol (division by zero) tidak diperbolehkan.",
            expr.line,
            expr.col,
            this._lineText(expr.line)
          );
        }
        const lAbs = lInt < 0n ? -lInt : lInt;
        const rAbs = rInt < 0n ? -rInt : rInt;
        let quotient = lAbs / rAbs;
        if ((lInt < 0n) !== (rInt < 0n)) {
          quotient = -quotient;
        }

        if (op === "div") {
          return [wrapInt64(quotient), "integer"];
        } else {
          const remainder = lInt - quotient * rInt;
          return [wrapInt64(remainder), "integer"];
        }
      }

      // 7. Bitwise: <<, >>, &, |
      if (op === "<<" || op === ">>" || op === "&" || op === "|") {
        const lInt = leftVal as bigint;
        const rInt = rightVal as bigint;
        if (op === "<<") {
          if (rInt < 0n) {
            throw runtimeError(
              "jumlah pergeseran bit (<<) tidak boleh negatif.",
              expr.line,
              expr.col,
              this._lineText(expr.line)
            );
          }
          if (rInt >= 64n) {
            return [0n, "integer"];
          }
          return [wrapInt64(lInt << rInt), "integer"];
        }
        if (op === ">>") {
          if (rInt < 0n) {
            throw runtimeError(
              "jumlah pergeseran bit (>>) tidak boleh negatif.",
              expr.line,
              expr.col,
              this._lineText(expr.line)
            );
          }
          const shift = rInt > 64n ? 64n : rInt;
          return [wrapInt64(lInt >> shift), "integer"];
        }
        if (op === "&") {
          return [wrapInt64(lInt & rInt), "integer"];
        }
        if (op === "|") {
          return [wrapInt64(lInt | rInt), "integer"];
        }
      }

      // 8. Comparisons: <, <=, >, >=, ==, !=
      if (["<", "<=", ">", ">=", "==", "!="].includes(op)) {
        if (op === "<") return [(leftVal as any) < (rightVal as any), "boolean"];
        if (op === "<=") return [(leftVal as any) <= (rightVal as any), "boolean"];
        if (op === ">") return [(leftVal as any) > (rightVal as any), "boolean"];
        if (op === ">=") return [(leftVal as any) >= (rightVal as any), "boolean"];
        if (op === "==") return [leftVal === rightVal, "boolean"];
        if (op === "!=") return [leftVal !== rightVal, "boolean"];
      }
    }

    throw runtimeError(
      "ekspresi gagal dievaluasi.",
      expr.line,
      expr.col,
      this._lineText(expr.line)
    );
  }
}
