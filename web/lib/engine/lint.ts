import { Expr, Program, Stmt } from "./ast";
import { RECOVERED_TYPE } from "./parser";

/**
 * Lint pass: finds code that is valid but probably not what the student meant.
 * Produces warnings only — it never blocks running the program.
 */
export interface LintWarning {
  message: string;
  line: number;
  col: number;
}

interface VarUsage {
  kind: "variabel" | "konstanta";
  line: number;
  col: number;
  reads: number;
  writes: number;
  firstRead: { line: number; col: number } | null;
}

function rootName(expr: Expr): string | null {
  if (expr._type === "VarExpr") return expr.name;
  if (expr._type === "FieldAccessExpr") return rootName(expr.obj);
  return null;
}

function isBoolLiteral(expr: Expr, value: boolean): boolean {
  return (
    expr._type === "LiteralExpr" &&
    expr.typeName === "boolean" &&
    expr.value === value
  );
}

/** Value of an integer literal like `9` or `-3`, otherwise null. */
function intLiteral(expr: Expr | null | undefined): bigint | null {
  if (!expr) return null;
  if (expr._type === "LiteralExpr" && expr.typeName === "integer") {
    return BigInt(expr.value as bigint);
  }
  if (expr._type === "UnaryExpr" && (expr.op === "-" || expr.op === "+")) {
    const inner = intLiteral(expr.operand);
    if (inner === null) return null;
    return expr.op === "-" ? -inner : inner;
  }
  return null;
}

function sameLvalue(a: Expr, b: Expr): boolean {
  if (a._type === "VarExpr" && b._type === "VarExpr") return a.name === b.name;
  if (a._type === "FieldAccessExpr" && b._type === "FieldAccessExpr") {
    return a.fieldName === b.fieldName && sameLvalue(a.obj, b.obj);
  }
  return false;
}

export function lintProgram(program: Program): LintWarning[] {
  const warnings: LintWarning[] = [];
  const usage = new Map<string, VarUsage>();
  const warn = (message: string, line: number, col: number) =>
    warnings.push({ message, line, col });

  // --- Collect declarations -------------------------------------------------
  for (const decl of program.declarations) {
    if (decl._type === "VarDecl") {
      const cols = decl.nameCols ?? decl.names.map(() => decl.col);
      decl.names.forEach((name, i) => {
        if (!usage.has(name)) {
          usage.set(name, {
            kind: "variabel",
            line: decl.line,
            col: cols[i],
            reads: 0,
            writes: 0,
            firstRead: null,
          });
        }
      });
    } else if (decl._type === "ConstDecl") {
      if (!usage.has(decl.name)) {
        usage.set(decl.name, {
          kind: "konstanta",
          line: decl.line,
          col: decl.col,
          reads: 0,
          writes: 1,
          firstRead: null,
        });
      }
    }
  }

  // --- Walk -----------------------------------------------------------------
  const markRead = (expr: Expr): void => {
    switch (expr._type) {
      case "VarExpr":
      case "FieldAccessExpr": {
        const name = rootName(expr);
        const u = name ? usage.get(name) : undefined;
        if (u) {
          u.reads++;
          if (!u.firstRead) u.firstRead = { line: expr.line, col: expr.col };
        }
        return;
      }
      case "UnaryExpr":
        return markRead(expr.operand);
      case "BinaryExpr":
        markRead(expr.left);
        markRead(expr.right);
        return;
      case "LenExpr":
        return markRead(expr.arg);
      default:
        return;
    }
  };

  const markWrite = (target: Expr): void => {
    const name = rootName(target);
    const u = name ? usage.get(name) : undefined;
    if (u) u.writes++;
  };

  // Constant values may reference other constants.
  for (const decl of program.declarations) {
    if (decl._type === "ConstDecl") markRead(decl.value);
  }

  const forCounters: string[] = [];

  const checkEmpty = (body: Stmt[], label: string, line: number, col: number) => {
    if (body.length === 0) {
      warn(`blok ${label} kosong (tidak ada instruksi di dalamnya).`, line, col);
    }
  };

  const walkBlock = (stmts: Stmt[]): void => {
    for (const stmt of stmts) walkStmt(stmt);
  };

  const walkStmt = (stmt: Stmt): void => {
    switch (stmt._type) {
      case "AssignStmt": {
        markRead(stmt.value);
        markWrite(stmt.target);
        const name = rootName(stmt.target);
        if (name && forCounters.includes(name) && stmt.target._type === "VarExpr") {
          warn(
            `variabel pencacah '${name}' diubah di dalam perulangan 'for'; ini bisa membuat jumlah perulangan tidak sesuai harapan.`,
            stmt.line,
            stmt.col
          );
        }
        if (sameLvalue(stmt.target, stmt.value)) {
          warn(
            `mengisi '${name}' dengan dirinya sendiri tidak berpengaruh apa-apa.`,
            stmt.line,
            stmt.col
          );
        }
        return;
      }
      case "InputStmt":
        for (const target of stmt.targets) {
          markWrite(target);
          const name = rootName(target);
          if (name && forCounters.includes(name) && target._type === "VarExpr") {
            warn(
              `variabel pencacah '${name}' diubah lewat 'input(...)' di dalam perulangan 'for'.`,
              target.line,
              target.col
            );
          }
        }
        return;
      case "OutputStmt":
        stmt.values.forEach(markRead);
        return;
      case "ForStmt": {
        if (stmt.varName !== RECOVERED_TYPE) {
          const u = usage.get(stmt.varName);
          if (u) {
            u.writes++;
            u.reads++;
          }
        }
        markRead(stmt.startExpr);
        markRead(stmt.endExpr);
        const startLit = intLiteral(stmt.startExpr);
        const endLit = intLiteral(stmt.endExpr);
        const stepLit = intLiteral(stmt.stepExpr);
        if (stmt.stepExpr) {
          markRead(stmt.stepExpr);
          if (stepLit === BigInt(0)) {
            warn(
              "nilai 'step' 0 membuat perulangan 'for' tidak pernah maju.",
              stmt.stepExpr.line,
              stmt.stepExpr.col
            );
          } else if (stmt.descending && stepLit !== null && stepLit < BigInt(0)) {
            warn(
              `pada 'downto', step menyatakan besar pengurangan dan harus positif: tulis 'step ${-stepLit}', bukan 'step ${stepLit}'.`,
              stmt.stepExpr.line,
              stmt.stepExpr.col
            );
          }
        }
        // Constant bounds that make the loop run zero times.
        const ascending = !stmt.descending && (stepLit === null || stepLit > BigInt(0));
        if (startLit !== null && endLit !== null) {
          if (ascending && startLit > endLit) {
            warn(
              `perulangan ini tidak akan pernah berjalan karena ${startLit} lebih besar dari ${endLit}; gunakan 'downto' untuk menghitung mundur (for ${stmt.varName} <- ${startLit} downto ${endLit} do).`,
              stmt.line,
              stmt.col
            );
          } else if (stmt.descending && startLit < endLit) {
            warn(
              `perulangan ini tidak akan pernah berjalan karena ${startLit} lebih kecil dari ${endLit}; gunakan 'to' untuk menghitung naik.`,
              stmt.line,
              stmt.col
            );
          }
        }
        checkEmpty(stmt.body, "'for'", stmt.line, stmt.col);
        forCounters.push(stmt.varName);
        walkBlock(stmt.body);
        forCounters.pop();
        return;
      }
      case "IfStmt":
        stmt.branches.forEach((branch, idx) => {
          markRead(branch.condition);
          const label = idx === 0 ? "'if'" : "'else if'";
          if (isBoolLiteral(branch.condition, true) || isBoolLiteral(branch.condition, false)) {
            warn(
              `kondisi ${label} selalu bernilai '${branch.condition._type === "LiteralExpr" ? String(branch.condition.value) : ""}', jadi percabangan ini tidak berguna.`,
              branch.condition.line,
              branch.condition.col
            );
          }
          checkEmpty(branch.body, label, branch.line, branch.col);
          walkBlock(branch.body);
        });
        walkBlock(stmt.elseBody);
        return;
      case "WhileStmt":
        markRead(stmt.condition);
        if (isBoolLiteral(stmt.condition, true)) {
          warn(
            "kondisi 'while true' tidak pernah salah, sehingga perulangan tidak akan pernah berhenti.",
            stmt.condition.line,
            stmt.condition.col
          );
        }
        checkEmpty(stmt.body, "'while'", stmt.line, stmt.col);
        walkBlock(stmt.body);
        return;
      case "RepeatStmt":
        checkEmpty(stmt.body, "'repeat'", stmt.line, stmt.col);
        walkBlock(stmt.body);
        markRead(stmt.condition);
        if (isBoolLiteral(stmt.condition, false)) {
          warn(
            "kondisi 'until false' tidak pernah benar, sehingga perulangan tidak akan pernah berhenti.",
            stmt.condition.line,
            stmt.condition.col
          );
        }
        return;
      default:
        return;
    }
  };

  walkBlock(program.statements);

  // --- Usage warnings -------------------------------------------------------
  for (const [name, u] of usage.entries()) {
    if (u.kind === "konstanta") {
      if (u.reads === 0) {
        warn(`konstanta '${name}' dideklarasikan tetapi tidak pernah dipakai.`, u.line, u.col);
      }
      continue;
    }
    if (u.reads === 0 && u.writes === 0) {
      warn(`variabel '${name}' dideklarasikan tetapi tidak pernah dipakai.`, u.line, u.col);
    } else if (u.writes === 0 && u.firstRead) {
      warn(
        `variabel '${name}' dibaca tetapi tidak pernah diberi nilai (lewat '<-' atau 'input').`,
        u.firstRead.line,
        u.firstRead.col
      );
    } else if (u.reads === 0) {
      warn(`nilai variabel '${name}' diisi tetapi tidak pernah dipakai.`, u.line, u.col);
    }
  }

  return warnings;
}
