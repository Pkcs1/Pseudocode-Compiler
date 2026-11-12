export type ASTNodeType =
  | "VarDecl"
  | "ConstDecl"
  | "AliasDecl"
  | "StructDecl"
  | "LiteralExpr"
  | "VarExpr"
  | "FieldAccessExpr"
  | "UnaryExpr"
  | "BinaryExpr"
  | "LenExpr"
  | "AssignStmt"
  | "InputStmt"
  | "OutputStmt"
  | "ForStmt"
  | "IfBranch"
  | "IfStmt"
  | "WhileStmt"
  | "RepeatStmt"
  | "Program";

export interface NodeBase {
  _type?: ASTNodeType;
  line: number;
  col: number;
}

export type Decl = VarDecl | ConstDecl | AliasDecl | StructDecl;

export interface VarDecl extends NodeBase {
  _type?: "VarDecl";
  names: string[];
  typeName: string;
  typeCol: number;
  nameCols?: number[];
}

export interface ConstDecl extends NodeBase {
  _type?: "ConstDecl";
  name: string;
  typeName: string;
  value: Expr;
  typeCol: number;
}

export interface AliasDecl extends NodeBase {
  _type?: "AliasDecl";
  aliasName: string;
  targetType: string;
  targetCol: number;
}

export interface StructDecl extends NodeBase {
  _type?: "StructDecl";
  structName: string;
  fields: VarDecl[];
}

export type Expr =
  | LiteralExpr
  | VarExpr
  | FieldAccessExpr
  | UnaryExpr
  | BinaryExpr
  | LenExpr;

export interface LiteralExpr extends NodeBase {
  _type?: "LiteralExpr";
  value: string | number | bigint | boolean;
  typeName: string;
}

export interface VarExpr extends NodeBase {
  _type?: "VarExpr";
  name: string;
}

export interface FieldAccessExpr extends NodeBase {
  _type?: "FieldAccessExpr";
  obj: Expr;
  fieldName: string;
  fieldCol: number;
}

export interface UnaryExpr extends NodeBase {
  _type?: "UnaryExpr";
  op: string;
  operand: Expr;
}

export interface BinaryExpr extends NodeBase {
  _type?: "BinaryExpr";
  left: Expr;
  op: string;
  right: Expr;
}

export interface LenExpr extends NodeBase {
  _type?: "LenExpr";
  arg: Expr;
}

export type Stmt =
  | AssignStmt
  | InputStmt
  | OutputStmt
  | ForStmt
  | IfStmt
  | WhileStmt
  | RepeatStmt;

export interface AssignStmt extends NodeBase {
  _type?: "AssignStmt";
  target: VarExpr | FieldAccessExpr;
  value: Expr;
}

export interface InputStmt extends NodeBase {
  _type?: "InputStmt";
  targets: (VarExpr | FieldAccessExpr)[];
}

export interface OutputStmt extends NodeBase {
  _type?: "OutputStmt";
  values: Expr[];
}

export interface ForStmt extends NodeBase {
  _type?: "ForStmt";
  varName: string;
  startExpr: Expr;
  endExpr: Expr;
  body: Stmt[];
  varCol: number;
  stepExpr?: Expr | null;
}

export interface IfBranch {
  _type?: "IfBranch";
  condition: Expr;
  body: Stmt[];
  line: number;
  col: number;
}

export interface IfStmt extends NodeBase {
  _type?: "IfStmt";
  branches: IfBranch[];
  elseBody: Stmt[];
}

export interface WhileStmt extends NodeBase {
  _type?: "WhileStmt";
  condition: Expr;
  body: Stmt[];
}

export interface RepeatStmt extends NodeBase {
  _type?: "RepeatStmt";
  body: Stmt[];
  condition: Expr;
  untilLine: number;
  untilCol: number;
}

export interface Program extends NodeBase {
  _type?: "Program";
  name: string;
  declarations: Decl[];
  statements: Stmt[];
}
