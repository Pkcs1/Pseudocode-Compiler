import {
  AliasDecl,
  AssignStmt,
  BinaryExpr,
  ConstDecl,
  Decl,
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
import { PseudoError, semanticError } from "./errors";
import { RECOVERED_TYPE } from "./parser";

/** Type of anything that couldn't be determined (after an earlier error). */
const UNKNOWN = RECOVERED_TYPE;

export interface CheckerWarning {
  message: string;
  line: number;
  col: number;
}

const VALID_BASE_TYPES = new Set([
  "integer",
  "real",
  "string",
  "boolean",
  "char",
]);
const INT_COMPATIBLE = new Set(["integer", "char"]);
const NUMERIC_TYPES = new Set(["integer", "real", "char"]);

export class SemanticChecker {
  sourceLines: string[];
  aliases: Map<string, AliasDecl>;
  rawStructs: Map<string, StructDecl>;
  structs: Map<string, Record<string, string>>;
  variables: Map<string, string>;
  constants: Set<string>;
  /** When true, errors are collected in `errors` instead of being thrown. */
  collectErrors: boolean;
  errors: PseudoError[];
  warnings: CheckerWarning[];

  constructor(sourceLines: string[], options: { collectErrors?: boolean } = {}) {
    this.sourceLines = sourceLines;
    this.collectErrors = options.collectErrors ?? false;
    this.errors = [];
    this.warnings = [];
    this.aliases = new Map();
    this.rawStructs = new Map();
    this.structs = new Map();
    this.variables = new Map();
    this.constants = new Set();
  }

  _lineText(lineNo: number): string {
    if (lineNo >= 1 && lineNo <= this.sourceLines.length) {
      return this.sourceLines[lineNo - 1];
    }
    return "";
  }

  /** Record an error (collect mode) or rethrow it (default). */
  _record(err: unknown): void {
    if (!this.collectErrors || !(err instanceof PseudoError)) throw err;
    this.errors.push(err);
  }

  /** Run one independent check; in collect mode an error doesn't stop the others. */
  _guard(fn: () => void): void {
    try {
      fn();
    } catch (err) {
      this._record(err);
    }
  }

  _warn(message: string, line: number, col: number): void {
    this.warnings.push({ message, line, col });
  }

  checkProgram(program: Program): Record<string, string> {
    // Tahap 1: Kumpulkan tipe (Alias & Struct)
    for (const decl of program.declarations) {
      if (decl._type === "AliasDecl" || decl._type === "StructDecl") {
        this._guard(() => this.registerTypeDecl(decl));
      }
    }

    // Tahap 2: Validasi isi Alias & Struct
    for (const [aliasName, aliasDecl] of this.aliases.entries()) {
      this._guard(() =>
        this.resolveType(aliasName, aliasDecl.line, aliasDecl.targetCol)
      );
    }

    for (const [structName, structDecl] of this.rawStructs.entries()) {
      this._guard(() => this.resolveStructFields(structName, structDecl));
    }

    // Pastikan tidak ada rekursif struct
    for (const [structName, structDecl] of this.rawStructs.entries()) {
      this._guard(() =>
        this.checkRecursiveStruct(structName, structDecl, new Set())
      );
    }

    // Tahap 3: Konstanta dan Variabel
    for (const decl of program.declarations) {
      if (decl._type === "ConstDecl") {
        this._guard(() => this.checkConstDecl(decl));
      } else if (decl._type === "VarDecl") {
        this._guard(() => this.checkVarDecl(decl));
      }
    }

    // Tahap 4: Statement di algoritma
    this._checkBlock(program.statements);

    const res: Record<string, string> = {};
    for (const [k, v] of this.variables.entries()) {
      res[k] = v;
    }
    return res;
  }

  registerTypeDecl(decl: AliasDecl | StructDecl): void {
    const isAlias = "aliasName" in decl;
    const typeName = isAlias ? decl.aliasName : decl.structName;
    if (
      VALID_BASE_TYPES.has(typeName) ||
      this.aliases.has(typeName) ||
      this.rawStructs.has(typeName)
    ) {
      throw semanticError(
        `tipe '${typeName}' sudah pernah dideklarasikan sebelumnya.`,
        decl.line,
        decl.col,
        this._lineText(decl.line)
      );
    }
    if (isAlias) {
      this.aliases.set(typeName, decl as AliasDecl);
    } else {
      this.rawStructs.set(typeName, decl as StructDecl);
    }
  }

  resolveType(typeName: string, line: number, col: number): string {
    if (typeName === UNKNOWN) return UNKNOWN;
    const visited = new Set<string>();
    let curr = typeName;
    while (this.aliases.has(curr)) {
      if (visited.has(curr)) {
        throw semanticError(
          `deklarasi tipe alias '${typeName}' berputar tanpa ujung (circular alias).`,
          line,
          col,
          this._lineText(line)
        );
      }
      visited.add(curr);
      curr = this.aliases.get(curr)!.targetType;
    }

    if (VALID_BASE_TYPES.has(curr) || this.rawStructs.has(curr)) {
      return curr;
    }

    throw semanticError(
      `tipe data '${typeName}' tidak dikenal.`,
      line,
      col,
      this._lineText(line)
    );
  }

  /** resolveType(), but in collect mode an unknown type becomes UNKNOWN. */
  _resolveTypeSafe(typeName: string, line: number, col: number): string {
    try {
      return this.resolveType(typeName, line, col);
    } catch (err) {
      this._record(err);
      return UNKNOWN;
    }
  }

  resolveStructFields(structName: string, decl: StructDecl): void {
    const fieldMap: Record<string, string> = {};
    this.structs.set(structName, fieldMap);
    for (const fdecl of decl.fields) {
      const resolvedFieldType = this._resolveTypeSafe(
        fdecl.typeName,
        fdecl.line,
        fdecl.typeCol
      );
      const cols = fdecl.nameCols ?? fdecl.names.map(() => fdecl.col);
      for (let i = 0; i < fdecl.names.length; i++) {
        const fname = fdecl.names[i];
        const fcol = cols[i];
        if (fieldMap[fname] !== undefined) {
          this._record(
            semanticError(
              `field '${fname}' sudah pernah dideklarasikan di dalam struct '${structName}'.`,
              fdecl.line,
              fcol,
              this._lineText(fdecl.line)
            )
          );
          continue;
        }
        fieldMap[fname] = resolvedFieldType;
      }
    }
  }

  checkRecursiveStruct(
    currentStruct: string,
    decl: StructDecl,
    trail: Set<string>
  ): void {
    if (trail.has(currentStruct)) {
      throw semanticError(
        `struct '${currentStruct}' tidak boleh memuat dirinya sendiri secara rekursif.`,
        decl.line,
        decl.col,
        this._lineText(decl.line)
      );
    }
    const newTrail = new Set(trail);
    newTrail.add(currentStruct);
    const fields = this.structs.get(currentStruct) ?? {};
    for (const fieldType of Object.values(fields)) {
      if (this.rawStructs.has(fieldType)) {
        this.checkRecursiveStruct(
          fieldType,
          this.rawStructs.get(fieldType)!,
          newTrail
        );
      }
    }
  }

  checkConstDecl(decl: ConstDecl): void {
    if (this.variables.has(decl.name)) {
      throw semanticError(
        `nama '${decl.name}' sudah pernah dideklarasikan di kamus.`,
        decl.line,
        decl.col,
        this._lineText(decl.line)
      );
    }
    const resolvedType = this._resolveTypeSafe(
      decl.typeName,
      decl.line,
      decl.typeCol
    );
    // Register first so later uses don't also report "not declared".
    this.variables.set(decl.name, resolvedType);
    this.constants.add(decl.name);
    if (resolvedType !== UNKNOWN && !VALID_BASE_TYPES.has(resolvedType)) {
      throw semanticError(
        `konstanta '${decl.name}' harus bertipe dasar (integer/real/string/boolean/char), bukan '${decl.typeName}'.`,
        decl.line,
        decl.typeCol,
        this._lineText(decl.line)
      );
    }
    this._ensureConstExpr(decl.value, decl.name);
    const valType = this.checkExpr(decl.value);
    if (!this.isAssignCompatible(resolvedType, valType)) {
      throw semanticError(
        `tidak dapat mengisi konstanta '${decl.name}' yang bertipe '${resolvedType}' dengan nilai bertipe '${valType}'.`,
        decl.line,
        decl.col,
        this._lineText(decl.line)
      );
    }
  }

  _ensureConstExpr(expr: Expr, constName: string): void {
    if (expr._type === "VarExpr") {
      if (!this.constants.has(expr.name)) {
        throw semanticError(
          `nilai konstanta '${constName}' tidak boleh diambil dari variabel '${expr.name}'.`,
          expr.line,
          expr.col,
          this._lineText(expr.line)
        );
      }
    } else if (expr._type === "FieldAccessExpr") {
      throw semanticError(
        `nilai konstanta '${constName}' tidak boleh diambil dari field struct.`,
        expr.line,
        expr.col,
        this._lineText(expr.line)
      );
    } else if (expr._type === "UnaryExpr") {
      this._ensureConstExpr(expr.operand, constName);
    } else if (expr._type === "BinaryExpr") {
      this._ensureConstExpr(expr.left, constName);
      this._ensureConstExpr(expr.right, constName);
    } else if (expr._type === "LenExpr") {
      this._ensureConstExpr(expr.arg, constName);
    }
  }

  checkVarDecl(decl: VarDecl): void {
    const resolvedType = this._resolveTypeSafe(
      decl.typeName,
      decl.line,
      decl.typeCol
    );
    const cols = decl.nameCols ?? decl.names.map(() => decl.col);
    for (let i = 0; i < decl.names.length; i++) {
      const name = decl.names[i];
      const nameCol = cols[i];
      if (this.variables.has(name)) {
        this._record(
          semanticError(
            `variabel '${name}' sudah pernah dideklarasikan di kamus.`,
            decl.line,
            nameCol,
            this._lineText(decl.line)
          )
        );
        continue;
      }
      this.variables.set(name, resolvedType);
    }
  }

  isAssignCompatible(targetType: string, valueType: string): boolean {
    if (targetType === UNKNOWN || valueType === UNKNOWN) return true;
    if (targetType === valueType) return true;
    if (targetType === "real" && valueType === "integer") return true;
    if (INT_COMPATIBLE.has(targetType) && INT_COMPATIBLE.has(valueType)) {
      return true;
    }
    return false;
  }

  checkStatement(stmt: Stmt): void {
    if (stmt._type === "AssignStmt") return this.checkAssign(stmt);
    if (stmt._type === "InputStmt") return this.checkInput(stmt);
    if (stmt._type === "OutputStmt") return this.checkOutput(stmt);
    if (stmt._type === "ForStmt") return this.checkFor(stmt);
    if (stmt._type === "IfStmt") return this.checkIf(stmt);
    if (stmt._type === "WhileStmt") return this.checkWhile(stmt);
    if (stmt._type === "RepeatStmt") return this.checkRepeat(stmt);

    throw semanticError(
      "jenis instruksi belum didukung oleh pemeriksa tipe.",
      stmt.line,
      stmt.col,
      this._lineText(stmt.line)
    );
  }

  _checkBlock(stmts: Stmt[]): void {
    for (const bodyStmt of stmts) {
      this._guard(() => this.checkStatement(bodyStmt));
    }
  }

  _checkBooleanCondition(cond: Expr, label: string): void {
    const condType = this.checkExpr(cond);
    if (condType !== "boolean" && condType !== UNKNOWN) {
      throw semanticError(
        `kondisi pada ${label} harus bertipe 'boolean', bukan '${condType}'.`,
        cond.line,
        cond.col,
        this._lineText(cond.line)
      );
    }
  }

  checkAssign(stmt: AssignStmt): void {
    if (stmt.target._type === "VarExpr" && this.constants.has(stmt.target.name)) {
      throw semanticError(
        `konstanta '${stmt.target.name}' tidak boleh diubah nilainya.`,
        stmt.line,
        stmt.col,
        this._lineText(stmt.line)
      );
    }

    const targetType = this.checkExpr(stmt.target);
    const valueType = this.checkExpr(stmt.value);

    if (!this.isAssignCompatible(targetType, valueType)) {
      const targetLabel = this._formatLvalueName(stmt.target);
      throw semanticError(
        `tidak dapat mengisi '${targetLabel}' yang bertipe '${targetType}' dengan nilai bertipe '${valueType}'.`,
        stmt.line,
        stmt.col,
        this._lineText(stmt.line)
      );
    }
  }

  checkInput(stmt: InputStmt): void {
    for (const target of stmt.targets) {
      if (target._type === "VarExpr" && this.constants.has(target.name)) {
        throw semanticError(
          `konstanta '${target.name}' tidak boleh diubah nilainya melalui 'input(...)'.`,
          target.line,
          target.col,
          this._lineText(target.line)
        );
      }
      const targetType = this.checkExpr(target);
      if (targetType !== UNKNOWN && !VALID_BASE_TYPES.has(targetType)) {
        const targetLabel = this._formatLvalueName(target);
        throw semanticError(
          `instruksi 'input(...)' tidak dapat membaca langsung ke struct '${targetLabel}' (sebutkan field-nya, misalnya '${targetLabel}.nama_field').`,
          target.line,
          target.col,
          this._lineText(target.line)
        );
      }
    }
  }

  checkOutput(stmt: OutputStmt): void {
    for (const expr of stmt.values) {
      const valType = this.checkExpr(expr);
      if (valType !== UNKNOWN && !VALID_BASE_TYPES.has(valType)) {
        throw semanticError(
          `instruksi 'output(...)' tidak dapat mencetak struct bertipe '${valType}' secara langsung (cetak field-nya satu per satu).`,
          expr.line,
          expr.col,
          this._lineText(expr.line)
        );
      }
    }
  }

  checkFor(stmt: ForStmt): void {
    if (stmt.varName === UNKNOWN) {
      // Header could not be parsed; the syntax error is already reported.
      this._checkBlock(stmt.body);
      return;
    }
    if (!this.variables.has(stmt.varName)) {
      throw semanticError(
        `variabel pencacah '${stmt.varName}' pada perulangan 'for' belum dideklarasikan di kamus.`,
        stmt.line,
        stmt.varCol,
        this._lineText(stmt.line)
      );
    }
    if (this.constants.has(stmt.varName)) {
      throw semanticError(
        `konstanta '${stmt.varName}' tidak boleh dipakai sebagai variabel pencacah 'for'.`,
        stmt.line,
        stmt.varCol,
        this._lineText(stmt.line)
      );
    }
    const varType = this.variables.get(stmt.varName)!;
    if (varType !== "integer" && varType !== UNKNOWN) {
      throw semanticError(
        `variabel pencacah '${stmt.varName}' pada 'for' harus bertipe 'integer', bukan '${varType}'.`,
        stmt.line,
        stmt.varCol,
        this._lineText(stmt.line)
      );
    }

    const startType = this.checkExpr(stmt.startExpr);
    if (startType !== "integer" && startType !== UNKNOWN) {
      throw semanticError(
        `nilai awal (init) pada perulangan 'for' harus bertipe 'integer', bukan '${startType}'.`,
        stmt.startExpr.line,
        stmt.startExpr.col,
        this._lineText(stmt.startExpr.line)
      );
    }

    const endType = this.checkExpr(stmt.endExpr);
    if (endType !== "integer" && endType !== UNKNOWN) {
      throw semanticError(
        `nilai akhir (end) pada perulangan 'for' harus bertipe 'integer', bukan '${endType}'.`,
        stmt.endExpr.line,
        stmt.endExpr.col,
        this._lineText(stmt.endExpr.line)
      );
    }

    if (stmt.stepExpr) {
      const stepType = this.checkExpr(stmt.stepExpr);
      if (stepType !== "integer" && stepType !== UNKNOWN) {
        throw semanticError(
          `nilai langkah (step) pada perulangan 'for' harus bertipe 'integer', bukan '${stepType}'.`,
          stmt.stepExpr.line,
          stmt.stepExpr.col,
          this._lineText(stmt.stepExpr.line)
        );
      }
    }

    this._checkBlock(stmt.body);
  }

  checkIf(stmt: IfStmt): void {
    for (let idx = 0; idx < stmt.branches.length; idx++) {
      const branch = stmt.branches[idx];
      const label =
        idx === 0 ? "percabangan 'if'" : "percabangan 'else if'";
      this._checkBooleanCondition(branch.condition, label);
      this._checkBlock(branch.body);
    }
    this._checkBlock(stmt.elseBody);
  }

  checkWhile(stmt: WhileStmt): void {
    this._checkBooleanCondition(stmt.condition, "perulangan 'while'");
    this._checkBlock(stmt.body);
  }

  checkRepeat(stmt: RepeatStmt): void {
    this._checkBlock(stmt.body);
    this._checkBooleanCondition(stmt.condition, "perulangan 'repeat-until'");
  }

  _formatLvalueName(expr: Expr): string {
    if (expr._type === "VarExpr") {
      return expr.name;
    }
    if (expr._type === "FieldAccessExpr") {
      return `${this._formatLvalueName(expr.obj)}.${expr.fieldName}`;
    }
    return "target";
  }

  checkVarExists(varNode: VarExpr): string {
    if (!this.variables.has(varNode.name)) {
      throw semanticError(
        `variabel '${varNode.name}' belum dideklarasikan di kamus.`,
        varNode.line,
        varNode.col,
        this._lineText(varNode.line)
      );
    }
    return this.variables.get(varNode.name)!;
  }

  checkFieldAccess(expr: FieldAccessExpr): string {
    const objType = this.checkExpr(expr.obj);
    if (objType === UNKNOWN) return UNKNOWN;
    if (!this.structs.has(objType)) {
      throw semanticError(
        `'${this._formatLvalueName(expr.obj)}' bertipe '${objType}' (bukan struct), sehingga tidak memiliki field '${expr.fieldName}'.`,
        expr.line,
        expr.fieldCol,
        this._lineText(expr.line)
      );
    }
    const structFields = this.structs.get(objType)!;
    if (structFields[expr.fieldName] === undefined) {
      throw semanticError(
        `field '${expr.fieldName}' tidak ditemukan pada struct '${objType}'.`,
        expr.line,
        expr.fieldCol,
        this._lineText(expr.line)
      );
    }
    return structFields[expr.fieldName];
  }

  checkExpr(expr: Expr): string {
    if (expr._type === "LiteralExpr") {
      return expr.typeName;
    }

    if (expr._type === "VarExpr") {
      return this.checkVarExists(expr);
    }

    if (expr._type === "FieldAccessExpr") {
      return this.checkFieldAccess(expr);
    }

    if (expr._type === "LenExpr") {
      const argType = this.checkExpr(expr.arg);
      if (argType !== "string" && argType !== UNKNOWN) {
        throw semanticError(
          `fungsi 'len(...)' hanya menerima argumen bertipe 'string', tetapi ditemukan '${argType}'.`,
          expr.line,
          expr.col,
          this._lineText(expr.line)
        );
      }
      return "integer";
    }

    if (expr._type === "UnaryExpr") {
      const operandType = this.checkExpr(expr.operand);
      if (operandType === UNKNOWN) {
        return expr.op === "not" ? "boolean" : UNKNOWN;
      }
      if (expr.op === "not") {
        if (operandType !== "boolean") {
          throw semanticError(
            `operator 'not' hanya bisa dipakai pada tipe 'boolean', bukan '${operandType}'.`,
            expr.line,
            expr.col,
            this._lineText(expr.line)
          );
        }
        return "boolean";
      }

      if (!NUMERIC_TYPES.has(operandType)) {
        throw semanticError(
          `operator unary '${expr.op}' hanya bisa dipakai pada angka (integer/real), bukan '${operandType}'.`,
          expr.line,
          expr.col,
          this._lineText(expr.line)
        );
      }
      return operandType === "real" ? "real" : "integer";
    }

    if (expr._type === "BinaryExpr") {
      const leftType = this.checkExpr(expr.left);
      const rightType = this.checkExpr(expr.right);
      const op = expr.op;

      if (leftType === UNKNOWN || rightType === UNKNOWN) {
        if (["and", "or", "<", "<=", ">", ">=", "==", "!="].includes(op)) {
          return "boolean";
        }
        if (op === "/") return "real";
        return UNKNOWN;
      }

      // 1. Logika and, or
      if (op === "and" || op === "or") {
        if (leftType === "boolean" && rightType === "boolean") {
          return "boolean";
        }
        throw semanticError(
          `operator logika '${op}' membutuhkan dua nilai 'boolean', tetapi ditemukan '${leftType}' dan '${rightType}'.`,
          expr.line,
          expr.col,
          this._lineText(expr.line)
        );
      }

      // 2. Penjumlahan '+'
      if (op === "+") {
        if (leftType === "string" && rightType === "string") {
          return "string";
        }
        if (NUMERIC_TYPES.has(leftType) && NUMERIC_TYPES.has(rightType)) {
          if (leftType === "real" || rightType === "real") {
            return "real";
          }
          return "integer";
        }
        throw semanticError(
          `operator '+' tidak bisa digunakan antara tipe '${leftType}' dan '${rightType}'.`,
          expr.line,
          expr.col,
          this._lineText(expr.line)
        );
      }

      // 3. '-', '*', '^'
      if (op === "-" || op === "*" || op === "^") {
        if (NUMERIC_TYPES.has(leftType) && NUMERIC_TYPES.has(rightType)) {
          if (leftType === "real" || rightType === "real") {
            return "real";
          }
          return "integer";
        }
        throw semanticError(
          `operator '${op}' tidak bisa digunakan antara tipe '${leftType}' dan '${rightType}'.`,
          expr.line,
          expr.col,
          this._lineText(expr.line)
        );
      }

      // 4. '/' selalu real
      if (op === "/") {
        if (NUMERIC_TYPES.has(leftType) && NUMERIC_TYPES.has(rightType)) {
          return "real";
        }
        throw semanticError(
          `operator '/' hanya bisa digunakan untuk angka (integer/real), bukan '${leftType}' dan '${rightType}'.`,
          expr.line,
          expr.col,
          this._lineText(expr.line)
        );
      }

      // 5. div, mod, <<, >>, &, |
      if (["div", "mod", "<<", ">>", "&", "|"].includes(op)) {
        if (INT_COMPATIBLE.has(leftType) && INT_COMPATIBLE.has(rightType)) {
          return "integer";
        }
        throw semanticError(
          `operator '${op}' hanya boleh digunakan pada tipe 'integer', tetapi ditemukan '${leftType}' dan '${rightType}'.`,
          expr.line,
          expr.col,
          this._lineText(expr.line)
        );
      }

      // 6. <, <=, >, >=, ==, !=
      if (["<", "<=", ">", ">=", "==", "!="].includes(op)) {
        if (NUMERIC_TYPES.has(leftType) && NUMERIC_TYPES.has(rightType)) {
          if ((op === "==" || op === "!=") && (leftType === "real" || rightType === "real")) {
            this._warn(
              `membandingkan bilangan real dengan '${op}' bisa tidak akurat karena pembulatan; pertimbangkan selisih kecil, misalnya |a - b| < 0.0001.`,
              expr.line,
              expr.col
            );
          }
          return "boolean";
        }
        if (leftType === "string" && rightType === "string") {
          return "boolean";
        }
        if ((op === "==" || op === "!=") && leftType === "boolean" && rightType === "boolean") {
          return "boolean";
        }
        throw semanticError(
          `operator perbandingan '${op}' tidak bisa membandingkan tipe '${leftType}' dengan '${rightType}'.`,
          expr.line,
          expr.col,
          this._lineText(expr.line)
        );
      }
    }

    throw semanticError(
      "ekspresi tidak dikenali.",
      expr.line,
      expr.col,
      this._lineText(expr.line)
    );
  }
}

export function check(program: Program, source: string): Record<string, string> {
  const checker = new SemanticChecker(source.split(/\r?\n/));
  return checker.checkProgram(program);
}
