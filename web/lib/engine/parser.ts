import {
  AliasDecl,
  AssignStmt,
  BinaryExpr,
  ConstDecl,
  Decl,
  Expr,
  FieldAccessExpr,
  ForStmt,
  IfBranch,
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
import { syntaxError } from "./errors";
import { Token } from "./lexer";

const BASE_TYPE_TOKENS = new Set([
  "TYPE_INTEGER",
  "TYPE_REAL",
  "TYPE_STRING",
  "TYPE_BOOLEAN",
  "TYPE_CHAR",
]);

export class Parser {
  tokens: Token[];
  sourceLines: string[];
  pos: number;

  constructor(tokens: Token[], sourceLines: string[]) {
    this.tokens = tokens;
    this.sourceLines = sourceLines;
    this.pos = 0;
  }

  current(): Token {
    return this.tokens[this.pos];
  }

  advance(): Token {
    const tok = this.tokens[this.pos];
    if (tok.type !== "EOF") {
      this.pos++;
    }
    return tok;
  }

  match(...tokenTypes: string[]): Token | null {
    if (tokenTypes.includes(this.current().type)) {
      return this.advance();
    }
    return null;
  }

  expect(tokenType: string, errorMsg: string): Token {
    const tok = this.current();
    if (tok.type === tokenType) {
      return this.advance();
    }
    throw syntaxError(errorMsg, tok.line, tok.col, this._lineText(tok.line));
  }

  _lineText(lineNo: number): string {
    if (lineNo >= 1 && lineNo <= this.sourceLines.length) {
      return this.sourceLines[lineNo - 1];
    }
    return "";
  }

  parseTypeName(contextMsg: string = "sesudah ':'"): [string, Token] {
    const typeTok = this.current();
    if (BASE_TYPE_TOKENS.has(typeTok.type) || typeTok.type === "IDENTIFIER") {
      this.advance();
      return [String(typeTok.value), typeTok];
    }
    throw syntaxError(
      `diharapkan nama tipe data ${contextMsg}, tetapi ditemukan '${typeTok.value}'.`,
      typeTok.line,
      typeTok.col,
      this._lineText(typeTok.line)
    );
  }

  parseProgram(): Program {
    const progTok = this.expect(
      "PROGRAM",
      "program harus diawali dengan kata kunci 'program'."
    );
    const nameTok = this.expect(
      "IDENTIFIER",
      "setelah kata kunci 'program' harus ada nama program."
    );

    this.expect(
      "KAMUS",
      "kata kunci 'kamus' tidak ditemukan setelah nama program."
    );

    const declarations: Decl[] = [];
    while (!["ALGORITMA", "ENDPROGRAM", "EOF"].includes(this.current().type)) {
      declarations.push(this.parseDeclaration());
    }

    this.expect(
      "ALGORITMA",
      "kata kunci 'algoritma' tidak ditemukan setelah bagian 'kamus'."
    );

    const statements: Stmt[] = [];
    while (!["ENDPROGRAM", "EOF"].includes(this.current().type)) {
      statements.push(this.parseStatement());
    }

    this.expect(
      "ENDPROGRAM",
      "kata kunci 'endprogram' tidak ditemukan di akhir program."
    );

    if (this.current().type !== "EOF") {
      const extra = this.current();
      throw syntaxError(
        `ada kode tak terduga '${extra.value}' sesudah 'endprogram'.`,
        extra.line,
        extra.col,
        this._lineText(extra.line)
      );
    }

    return {
      _type: "Program",
      name: String(nameTok.value),
      declarations,
      statements,
      line: progTok.line,
      col: progTok.col,
    };
  }

  parseDeclaration(): Decl {
    const tok = this.current();
    if (tok.type === "CONSTANT") {
      return this.parseConstDecl();
    }
    if (tok.type === "TYPE") {
      return this.parseTypeDecl();
    }
    return this.parseVarDecl();
  }

  parseConstDecl(): ConstDecl {
    const constTok = this.expect("CONSTANT", "diharapkan 'constant'.");
    const nameTok = this.expect(
      "IDENTIFIER",
      "diharapkan nama konstanta sesudah kata kunci 'constant'."
    );
    this.expect(
      "COLON",
      `diharapkan tanda ':' sesudah nama konstanta '${nameTok.value}'.`
    );
    const [typeName, typeTok] = this.parseTypeName(
      `untuk konstanta '${nameTok.value}'`
    );
    this.expect(
      "ASSIGN",
      `diharapkan tanda '=' atau '<-' untuk mengisi nilai konstanta '${nameTok.value}'.`
    );
    const valExpr = this.parseExpr();
    return {
      _type: "ConstDecl",
      name: String(nameTok.value),
      typeName,
      value: valExpr,
      line: constTok.line,
      col: nameTok.col,
      typeCol: typeTok.col,
    };
  }

  parseTypeDecl(): AliasDecl | StructDecl {
    const typeKw = this.expect("TYPE", "diharapkan 'type'.");
    const nameTok = this.expect(
      "IDENTIFIER",
      "diharapkan nama tipe baru sesudah kata kunci 'type'."
    );
    const typeName = String(nameTok.value);

    // Kasus 1: Alias (type nama_alias : tipe_target)
    if (this.match("COLON")) {
      const [targetType, targetTok] = this.parseTypeName(
        `untuk tipe alias '${typeName}'`
      );
      return {
        _type: "AliasDecl",
        aliasName: typeName,
        targetType,
        line: typeKw.line,
        col: nameTok.col,
        targetCol: targetTok.col,
      };
    }

    // Kasus 2: Struct (type nama_struct < field1 : tipe1 ... >)
    if (this.match("LT")) {
      const fields: VarDecl[] = [];
      while (
        !["GT", "ALGORITMA", "ENDPROGRAM", "EOF"].includes(this.current().type)
      ) {
        fields.push(this.parseVarDecl(true));
      }

      if (fields.length === 0) {
        const tok = this.current();
        throw syntaxError(
          `struct '${typeName}' harus memiliki minimal satu field di dalam '< ... >'.`,
          tok.line,
          tok.col,
          this._lineText(tok.line)
        );
      }

      this.expect(
        "GT",
        `diharapkan tanda '>' untuk menutup deklarasi struct '${typeName}'.`
      );
      return {
        _type: "StructDecl",
        structName: typeName,
        fields,
        line: typeKw.line,
        col: nameTok.col,
      };
    }

    const badTok = this.current();
    throw syntaxError(
      `setelah 'type ${typeName}' diharapkan ':' (untuk alias) atau '<' (untuk struct), tetapi ditemukan '${badTok.value}'.`,
      badTok.line,
      badTok.col,
      this._lineText(badTok.line)
    );
  }

  parseVarDecl(insideStruct: boolean = false): VarDecl {
    const label = insideStruct
      ? "nama field"
      : "nama variabel atau kata kunci 'algoritma'";
    const firstId = this.expect("IDENTIFIER", `diharapkan ${label}.`);
    const names = [String(firstId.value)];
    const nameCols = [firstId.col];

    while (this.match("COMMA")) {
      const nextId = this.expect(
        "IDENTIFIER",
        `diharapkan ${
          insideStruct ? "nama field" : "nama variabel"
        } sesudah tanda koma ','.`
      );
      names.push(String(nextId.value));
      nameCols.push(nextId.col);
    }

    this.expect(
      "COLON",
      `diharapkan tanda titik dua ':' sesudah daftar ${
        insideStruct ? "field" : "variabel"
      }.`
    );

    const [typeName, typeTok] = this.parseTypeName();
    return {
      _type: "VarDecl",
      names,
      typeName,
      line: firstId.line,
      col: firstId.col,
      typeCol: typeTok.col,
      nameCols,
    };
  }

  parseLvalue(): VarExpr | FieldAccessExpr {
    const idTok = this.expect("IDENTIFIER", "diharapkan nama variabel.");
    let node: VarExpr | FieldAccessExpr = {
      _type: "VarExpr",
      name: String(idTok.value),
      line: idTok.line,
      col: idTok.col,
    };

    while (this.match("DOT")) {
      const fieldTok = this.expect(
        "IDENTIFIER",
        "diharapkan nama field sesudah tanda titik '.'."
      );
      node = {
        _type: "FieldAccessExpr",
        obj: node,
        fieldName: String(fieldTok.value),
        line: idTok.line,
        col: idTok.col,
        fieldCol: fieldTok.col,
      };
    }

    return node;
  }

  _parseBlock(stopTypes: string[]): Stmt[] {
    const stmts: Stmt[] = [];
    while (!stopTypes.includes(this.current().type)) {
      stmts.push(this.parseStatement());
    }
    return stmts;
  }

  parseStatement(): Stmt {
    const tok = this.current();
    if (tok.type === "INPUT") return this.parseInputStmt();
    if (tok.type === "OUTPUT") return this.parseOutputStmt();
    if (tok.type === "FOR") return this.parseForStmt();
    if (tok.type === "IF") return this.parseIfStmt();
    if (tok.type === "WHILE") return this.parseWhileStmt();
    if (tok.type === "REPEAT") return this.parseRepeatStmt();
    if (tok.type === "IDENTIFIER") return this.parseAssignStmt();

    throw syntaxError(
      `instruksi tidak dikenal '${tok.value}' di dalam bagian algoritma.`,
      tok.line,
      tok.col,
      this._lineText(tok.line)
    );
  }

  parseAssignStmt(): AssignStmt {
    const target = this.parseLvalue();
    this.expect(
      "ASSIGN",
      "diharapkan tanda '=' atau '<-' pada instruksi pengisian nilai (assignment)."
    );
    const expr = this.parseExpr();
    return {
      _type: "AssignStmt",
      target,
      value: expr,
      line: target.line,
      col: target.col,
    };
  }

  parseInputStmt(): InputStmt {
    const inTok = this.expect("INPUT", "diharapkan 'input'.");
    this.expect("LPAREN", "diharapkan tanda '(' sesudah 'input'.");

    const targets: (VarExpr | FieldAccessExpr)[] = [this.parseLvalue()];
    while (this.match("COMMA")) {
      targets.push(this.parseLvalue());
    }

    this.expect("RPAREN", "diharapkan tanda ')' untuk menutup 'input(...)'.");
    return {
      _type: "InputStmt",
      targets,
      line: inTok.line,
      col: inTok.col,
    };
  }

  parseOutputStmt(): OutputStmt {
    const outTok = this.expect("OUTPUT", "diharapkan 'output'.");
    this.expect("LPAREN", "diharapkan tanda '(' sesudah 'output'.");

    const values: Expr[] = [this.parseExpr()];
    while (this.match("COMMA")) {
      values.push(this.parseExpr());
    }

    this.expect("RPAREN", "diharapkan tanda ')' untuk menutup 'output(...)'.");
    return {
      _type: "OutputStmt",
      values,
      line: outTok.line,
      col: outTok.col,
    };
  }

  parseForStmt(): ForStmt {
    const forTok = this.expect("FOR", "diharapkan 'for'.");
    const varTok = this.expect(
      "IDENTIFIER",
      "diharapkan nama variabel pencacah (counter) sesudah kata kunci 'for'."
    );
    this.expect(
      "ASSIGN",
      `diharapkan tanda '=' atau '<-' sesudah variabel '${varTok.value}' pada perulangan 'for'.`
    );
    const startExpr = this.parseExpr();
    this.expect(
      "TO",
      "diharapkan kata kunci 'to' sesudah nilai awal perulangan 'for'."
    );
    const endExpr = this.parseExpr();

    let stepExpr: Expr | null = null;
    if (this.match("STEP")) {
      stepExpr = this.parseExpr();
    }

    this.expect(
      "DO",
      "diharapkan kata kunci 'do' sesudah nilai batas akhir (atau 'step') perulangan 'for'."
    );

    const body = this._parseBlock(["ENDFOR", "ENDPROGRAM", "EOF"]);

    this.expect(
      "ENDFOR",
      "kata kunci 'endfor' tidak ditemukan untuk menutup perulangan 'for'."
    );

    return {
      _type: "ForStmt",
      varName: String(varTok.value),
      startExpr,
      endExpr,
      body,
      line: forTok.line,
      col: forTok.col,
      varCol: varTok.col,
      stepExpr,
    };
  }

  parseIfStmt(): IfStmt {
    const ifTok = this.expect("IF", "diharapkan 'if'.");
    const firstCond = this.parseExpr();
    this.expect("THEN", "diharapkan kata kunci 'then' sesudah kondisi 'if'.");
    const firstBody = this._parseBlock(["ELSE", "ENDIF", "ENDPROGRAM", "EOF"]);
    const branches: IfBranch[] = [
      {
        _type: "IfBranch",
        condition: firstCond,
        body: firstBody,
        line: ifTok.line,
        col: ifTok.col,
      },
    ];
    let elseBody: Stmt[] = [];

    while (this.current().type === "ELSE") {
      const elseTok = this.advance();
      if (this.current().type === "IF" && this.current().line === elseTok.line) {
        const elifTok = this.advance();
        const elifCond = this.parseExpr();
        this.expect(
          "THEN",
          "diharapkan kata kunci 'then' sesudah kondisi 'else if'."
        );
        const elifBody = this._parseBlock([
          "ELSE",
          "ENDIF",
          "ENDPROGRAM",
          "EOF",
        ]);
        branches.push({
          _type: "IfBranch",
          condition: elifCond,
          body: elifBody,
          line: elifTok.line,
          col: elifTok.col,
        });
      } else {
        elseBody = this._parseBlock(["ENDIF", "ENDPROGRAM", "EOF"]);
        break;
      }
    }

    this.expect(
      "ENDIF",
      "kata kunci 'endif' tidak ditemukan untuk menutup percabangan 'if'."
    );

    return {
      _type: "IfStmt",
      branches,
      elseBody,
      line: ifTok.line,
      col: ifTok.col,
    };
  }

  parseWhileStmt(): WhileStmt {
    const whileTok = this.expect("WHILE", "diharapkan 'while'.");
    const condition = this.parseExpr();
    this.expect(
      "DO",
      "diharapkan kata kunci 'do' sesudah kondisi perulangan 'while'."
    );
    const body = this._parseBlock(["ENDWHILE", "ENDPROGRAM", "EOF"]);
    this.expect(
      "ENDWHILE",
      "kata kunci 'endwhile' tidak ditemukan untuk menutup perulangan 'while'."
    );
    return {
      _type: "WhileStmt",
      condition,
      body,
      line: whileTok.line,
      col: whileTok.col,
    };
  }

  parseRepeatStmt(): RepeatStmt {
    const repeatTok = this.expect("REPEAT", "diharapkan 'repeat'.");
    const body = this._parseBlock(["UNTIL", "ENDPROGRAM", "EOF"]);
    const untilTok = this.expect(
      "UNTIL",
      "kata kunci 'until' tidak ditemukan untuk menutup perulangan 'repeat'."
    );
    const condition = this.parseExpr();
    return {
      _type: "RepeatStmt",
      body,
      condition,
      line: repeatTok.line,
      col: repeatTok.col,
      untilLine: untilTok.line,
      untilCol: untilTok.col,
    };
  }

  parseExpr(): Expr {
    return this.parseOrExpr();
  }

  parseOrExpr(): Expr {
    let left = this.parseAndExpr();
    while (this.current().type === "OR") {
      const opTok = this.advance();
      const right = this.parseAndExpr();
      left = {
        _type: "BinaryExpr",
        left,
        op: "or",
        right,
        line: opTok.line,
        col: opTok.col,
      };
    }
    return left;
  }

  parseAndExpr(): Expr {
    let left = this.parseNotExpr();
    while (this.current().type === "AND") {
      const opTok = this.advance();
      const right = this.parseNotExpr();
      left = {
        _type: "BinaryExpr",
        left,
        op: "and",
        right,
        line: opTok.line,
        col: opTok.col,
      };
    }
    return left;
  }

  parseNotExpr(): Expr {
    if (this.current().type === "NOT") {
      const opTok = this.advance();
      const operand = this.parseNotExpr();
      return {
        _type: "UnaryExpr",
        op: "not",
        operand,
        line: opTok.line,
        col: opTok.col,
      };
    }
    return this.parseCompareExpr();
  }

  parseCompareExpr(): Expr {
    const left = this.parseAddExpr();
    if (["LT", "LE", "GT", "GE", "EQ", "NEQ"].includes(this.current().type)) {
      const opTok = this.advance();
      const opStr = String(opTok.value) === "<>" ? "!=" : String(opTok.value);
      const right = this.parseAddExpr();
      return {
        _type: "BinaryExpr",
        left,
        op: opStr,
        right,
        line: opTok.line,
        col: opTok.col,
      };
    }

    // Special case x<-5
    if (this.current().type === "ASSIGN" && String(this.current().value) === "<-") {
      const opTok = this.advance();
      const negFirst: Expr = {
        _type: "UnaryExpr",
        op: "-",
        operand: this.parseUnaryExpr(),
        line: opTok.line,
        col: opTok.col + 1,
      };
      const right = this._continueMulAndAdd(negFirst);
      return {
        _type: "BinaryExpr",
        left,
        op: "<",
        right,
        line: opTok.line,
        col: opTok.col,
      };
    }

    return left;
  }

  _continueMulAndAdd(firstUnary: Expr): Expr {
    let left = firstUnary;
    while (
      ["STAR", "SLASH", "MOD", "DIV", "SHL", "SHR", "AMP"].includes(
        this.current().type
      )
    ) {
      const opTok = this.advance();
      const right = this.parseUnaryExpr();
      left = {
        _type: "BinaryExpr",
        left,
        op: String(opTok.value),
        right,
        line: opTok.line,
        col: opTok.col,
      };
    }
    while (["PLUS", "MINUS", "PIPE"].includes(this.current().type)) {
      const opTok = this.advance();
      const right = this.parseMulExpr();
      left = {
        _type: "BinaryExpr",
        left,
        op: String(opTok.value),
        right,
        line: opTok.line,
        col: opTok.col,
      };
    }
    return left;
  }

  parseAddExpr(): Expr {
    let left = this.parseMulExpr();
    while (["PLUS", "MINUS", "PIPE"].includes(this.current().type)) {
      const opTok = this.advance();
      const right = this.parseMulExpr();
      left = {
        _type: "BinaryExpr",
        left,
        op: String(opTok.value),
        right,
        line: opTok.line,
        col: opTok.col,
      };
    }
    return left;
  }

  parseMulExpr(): Expr {
    let left = this.parseUnaryExpr();
    while (
      ["STAR", "SLASH", "MOD", "DIV", "SHL", "SHR", "AMP"].includes(
        this.current().type
      )
    ) {
      const opTok = this.advance();
      const right = this.parseUnaryExpr();
      left = {
        _type: "BinaryExpr",
        left,
        op: String(opTok.value),
        right,
        line: opTok.line,
        col: opTok.col,
      };
    }
    return left;
  }

  parseUnaryExpr(): Expr {
    if (["PLUS", "MINUS"].includes(this.current().type)) {
      const opTok = this.advance();
      const operand = this.parseUnaryExpr();
      return {
        _type: "UnaryExpr",
        op: String(opTok.value),
        operand,
        line: opTok.line,
        col: opTok.col,
      };
    }
    return this.parsePowerExpr();
  }

  parsePowerExpr(): Expr {
    const left = this.parsePrimaryExpr();
    if (this.current().type === "CARET") {
      const opTok = this.advance();
      const right = this.parseUnaryExpr();
      return {
        _type: "BinaryExpr",
        left,
        op: "^",
        right,
        line: opTok.line,
        col: opTok.col,
      };
    }
    return left;
  }

  parsePrimaryExpr(): Expr {
    const tok = this.current();

    if (tok.type === "LPAREN") {
      this.advance();
      const expr = this.parseExpr();
      this.expect("RPAREN", "diharapkan tanda kurung tutup ')' pada ekspresi.");
      return expr;
    }

    if (tok.type === "LEN") {
      const lenTok = this.advance();
      this.expect("LPAREN", "diharapkan tanda '(' sesudah fungsi 'len'.");
      const arg = this.parseExpr();
      this.expect("RPAREN", "diharapkan tanda ')' untuk menutup 'len(...)'.");
      return {
        _type: "LenExpr",
        arg,
        line: lenTok.line,
        col: lenTok.col,
      };
    }

    if (tok.type === "INT_LIT") {
      this.advance();
      return {
        _type: "LiteralExpr",
        value: tok.value,
        typeName: "integer",
        line: tok.line,
        col: tok.col,
      };
    }

    if (tok.type === "REAL_LIT") {
      this.advance();
      return {
        _type: "LiteralExpr",
        value: tok.value,
        typeName: "real",
        line: tok.line,
        col: tok.col,
      };
    }

    if (tok.type === "STRING_LIT") {
      this.advance();
      return {
        _type: "LiteralExpr",
        value: tok.value,
        typeName: "string",
        line: tok.line,
        col: tok.col,
      };
    }

    if (tok.type === "CHAR_LIT") {
      this.advance();
      return {
        _type: "LiteralExpr",
        value: tok.value,
        typeName: "char",
        line: tok.line,
        col: tok.col,
      };
    }

    if (tok.type === "BOOL_LIT") {
      this.advance();
      return {
        _type: "LiteralExpr",
        value: tok.value,
        typeName: "boolean",
        line: tok.line,
        col: tok.col,
      };
    }

    if (tok.type === "IDENTIFIER") {
      return this.parseLvalue();
    }

    throw syntaxError(
      `diharapkan nilai atau ekspresi, tetapi ditemukan '${tok.value}'.`,
      tok.line,
      tok.col,
      this._lineText(tok.line)
    );
  }
}

export function parse(tokens: Token[], source: string): Program {
  const parser = new Parser(tokens, source.split(/\r?\n/));
  return parser.parseProgram();
}
