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
import { PseudoError, syntaxError } from "./errors";
import { KEYWORDS, Token } from "./lexer";

/**
 * Placeholder type name used for AST pieces the parser could not read
 * (after a syntax error). The checker treats it as "unknown" and stays quiet
 * about it, so one syntax error doesn't cascade into many semantic errors.
 */
export const RECOVERED_TYPE = "<?>";

const STMT_START = new Set([
  "INPUT",
  "OUTPUT",
  "FOR",
  "IF",
  "WHILE",
  "REPEAT",
  "IDENTIFIER",
]);
const STMT_ONLY_START = new Set(["INPUT", "OUTPUT", "FOR", "IF", "WHILE", "REPEAT"]);
const DECL_START = new Set(["CONSTANT", "TYPE", "IDENTIFIER"]);
const BLOCK_KEYWORDS = new Set([
  "ENDFOR",
  "ENDIF",
  "ELSE",
  "ENDWHILE",
  "UNTIL",
  "ENDPROGRAM",
  "ALGORITMA",
  "KAMUS",
]);

function recoveredExpr(tok: Token): LiteralExpr {
  return {
    _type: "LiteralExpr",
    value: "",
    typeName: RECOVERED_TYPE,
    line: tok.line,
    col: tok.col,
  };
}

function tokenLength(tok: Token): number {
  if (tok.type === "STRING_LIT") return String(tok.value).length + 2;
  if (tok.type === "CHAR_LIT") return 3;
  if (tok.value === null || tok.value === undefined) return 1;
  return Math.max(1, String(tok.value).length);
}

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
  /** Every syntax error found, in the order encountered. */
  errors: PseudoError[];

  constructor(tokens: Token[], sourceLines: string[]) {
    this.sourceLines = sourceLines;
    this.pos = 0;
    this.errors = [];
    this.tokens = tokens.map((tok) => this._fixKeywordCase(tok));
  }

  /**
   * Keywords must be lowercase. A beginner writing `Program`, `If` or `ENDIF`
   * gets one clear error, and the token is read as the intended keyword so the
   * rest of the program still parses normally (no follow-on errors).
   */
  _fixKeywordCase(tok: Token): Token {
    if (tok.type !== "IDENTIFIER") return tok;
    const word = String(tok.value);
    const lower = word.toLowerCase();
    const kwType = KEYWORDS[lower];
    if (!kwType || lower === word) return tok;
    this.report(
      syntaxError(
        `kata kunci harus ditulis dengan huruf kecil: gunakan '${lower}', bukan '${word}'.`,
        tok.line,
        tok.col,
        this._lineText(tok.line)
      )
    );
    return {
      ...tok,
      type: kwType,
      value: kwType === "BOOL_LIT" ? lower === "true" : lower,
    };
  }

  // ---------------------------------------------------------------------------
  // Error reporting & recovery
  // ---------------------------------------------------------------------------

  _prev(): Token | null {
    return this.pos > 0 ? this.tokens[this.pos - 1] : null;
  }

  /** True when the current token is the first token on its line. */
  _atLineStart(): boolean {
    const prev = this._prev();
    return !prev || this.current().line > prev.line;
  }

  /**
   * Build an error for something that is *missing* at the current position.
   * When the current token already sits on a later line, the missing piece
   * belongs at the end of the previous line, so the error is placed there
   * (the same way VS Code reports "';' expected").
   */
  errorHere(message: string): PseudoError {
    const tok = this.current();
    const prev = this._prev();
    if (prev && tok.line > prev.line) {
      return syntaxError(
        message,
        prev.line,
        prev.col + tokenLength(prev),
        this._lineText(prev.line)
      );
    }
    return syntaxError(message, tok.line, tok.col, this._lineText(tok.line));
  }

  report(err: unknown): void {
    if (!(err instanceof PseudoError)) throw err;
    const dup = this.errors.some((e) => e.line === err.line && e.col === err.col);
    if (!dup) this.errors.push(err);
  }

  /** Like expect(), but records the error and carries on instead of throwing. */
  expectSoft(tokenType: string, errorMsg: string): Token | null {
    if (this.current().type === tokenType) return this.advance();
    this.report(this.errorHere(errorMsg));
    return null;
  }

  /** Expect a closing keyword; if missing, point the error at the opening one. */
  expectClose(tokenType: string, errorMsg: string, openTok: Token): Token | null {
    if (this.current().type === tokenType) return this.advance();
    this.report(
      syntaxError(errorMsg, openTok.line, openTok.col, this._lineText(openTok.line))
    );
    return null;
  }

  /**
   * Panic-mode recovery: skip tokens until the start of a new line that looks
   * like the beginning of a construct (or a block keyword / stop token).
   */
  _synchronize(startPos: number, starters: Set<string>, stopTypes: string[]): void {
    if (this.pos === startPos) this.advance();
    while (this.current().type !== "EOF") {
      const t = this.current().type;
      if (stopTypes.includes(t)) return;
      if (this._atLineStart() && (starters.has(t) || BLOCK_KEYWORDS.has(t))) return;
      this.advance();
    }
  }

  /** Skip the rest of a block header (e.g. up to `do`/`then`) after an error in it. */
  _recoverHeader(err: unknown, headerLine: number, terminator: string | null): void {
    this.report(err);
    while (
      this.current().type !== "EOF" &&
      this.current().line <= headerLine &&
      this.current().type !== terminator
    ) {
      this.advance();
    }
    if (terminator && this.current().type === terminator) this.advance();
  }

  /** Skip every remaining token on (or before) the given line. */
  _skipLine(line: number): void {
    while (this.current().type !== "EOF" && this.current().line <= line) {
      this.advance();
    }
  }

  /** Does the current token look like the start of an algoritma statement? */
  _looksLikeStatement(): boolean {
    const tok = this.current();
    if (STMT_ONLY_START.has(tok.type)) return true;
    if (tok.type === "IDENTIFIER") {
      const next = this.tokens[this.pos + 1];
      return !!next && (next.type === "ASSIGN" || next.type === "DOT");
    }
    return false;
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
    throw this.errorHere(errorMsg);
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
    const prev = this._prev();
    const found =
      typeTok.type === "EOF"
        ? "akhir file"
        : prev && typeTok.line > prev.line
        ? "akhir baris"
        : `'${typeTok.value}'`;
    throw this.errorHere(`diharapkan nama tipe data ${contextMsg}, tetapi ditemukan ${found}.`);
  }

  parseProgram(): Program {
    const firstTok = this.current();
    const progTok = this.expectSoft(
      "PROGRAM",
      "program harus diawali dengan kata kunci 'program'."
    );

    let nameTok: Token | null = null;
    if (progTok) {
      nameTok = this.expectSoft(
        "IDENTIFIER",
        "setelah kata kunci 'program' harus ada nama program."
      );
    } else if (this.current().type === "IDENTIFIER" && this.current().line === firstTok.line) {
      nameTok = this.advance();
    }

    this.expectSoft(
      "KAMUS",
      "kata kunci 'kamus' tidak ditemukan setelah nama program."
    );

    const declarations: Decl[] = [];
    while (!["ALGORITMA", "ENDPROGRAM", "EOF"].includes(this.current().type)) {
      // Forgot 'algoritma'? Stop treating statements as declarations.
      if (this._looksLikeStatement()) break;
      const startPos = this.pos;
      try {
        declarations.push(this.parseDeclaration());
      } catch (err) {
        this.report(err);
        this._synchronize(startPos, DECL_START, ["ALGORITMA", "ENDPROGRAM"]);
      }
    }

    this.expectSoft(
      "ALGORITMA",
      "kata kunci 'algoritma' tidak ditemukan setelah bagian 'kamus'."
    );

    const statements = this._parseBlock(["ENDPROGRAM", "EOF"]);

    this.expectSoft(
      "ENDPROGRAM",
      "kata kunci 'endprogram' tidak ditemukan di akhir program."
    );

    if (this.current().type !== "EOF") {
      const extra = this.current();
      this.report(
        syntaxError(
          `ada kode tak terduga '${extra.value}' sesudah 'endprogram'.`,
          extra.line,
          extra.col,
          this._lineText(extra.line)
        )
      );
    }

    return {
      _type: "Program",
      name: nameTok ? String(nameTok.value) : "",
      declarations,
      statements,
      line: (progTok ?? firstTok).line,
      col: (progTok ?? firstTok).col,
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
    let typeName = RECOVERED_TYPE;
    let typeTok: Token = nameTok;
    let valExpr: Expr = recoveredExpr(nameTok);
    try {
      this.expect(
        "COLON",
        `diharapkan tanda ':' sesudah nama konstanta '${nameTok.value}'.`
      );
      [typeName, typeTok] = this.parseTypeName(
        `untuk konstanta '${nameTok.value}'`
      );
      this.expect(
        "ASSIGN",
        `diharapkan tanda '=' atau '<-' untuk mengisi nilai konstanta '${nameTok.value}'.`
      );
      valExpr = this.parseExpr();
    } catch (err) {
      // Keep the constant (with an unknown type) so later uses don't report
      // "not declared" on top of this syntax error.
      this.report(err);
      this._skipLine(nameTok.line);
      typeName = RECOVERED_TYPE;
      valExpr = recoveredExpr(nameTok);
    }
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
        const startPos = this.pos;
        try {
          fields.push(this.parseVarDecl(true));
        } catch (err) {
          this.report(err);
          this._synchronize(startPos, new Set(["IDENTIFIER"]), [
            "GT",
            "ALGORITMA",
            "ENDPROGRAM",
          ]);
        }
      }

      if (fields.length === 0) {
        this.report(
          syntaxError(
            `struct '${typeName}' harus memiliki minimal satu field di dalam '< ... >'.`,
            nameTok.line,
            nameTok.col,
            this._lineText(nameTok.line)
          )
        );
      }

      this.expectClose(
        "GT",
        `diharapkan tanda '>' untuk menutup deklarasi struct '${typeName}'.`,
        typeKw
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

    let typeName = RECOVERED_TYPE;
    let typeTok: Token = firstId;
    try {
      this.expect(
        "COLON",
        `diharapkan tanda titik dua ':' sesudah daftar ${
          insideStruct ? "field" : "variabel"
        }.`
      );
      [typeName, typeTok] = this.parseTypeName();
    } catch (err) {
      // Keep the names (with an unknown type) so later uses of them don't
      // report "not declared" on top of this syntax error.
      this.report(err);
      this._skipLine(firstId.line);
    }
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
    while (
      !stopTypes.includes(this.current().type) &&
      this.current().type !== "EOF"
    ) {
      const startPos = this.pos;
      try {
        stmts.push(this.parseStatement());
      } catch (err) {
        this.report(err);
        this._synchronize(startPos, STMT_START, stopTypes);
      }
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
    let varTok: Token = { type: "IDENTIFIER", value: RECOVERED_TYPE, line: forTok.line, col: forTok.col };
    let startExpr: Expr = recoveredExpr(forTok);
    let endExpr: Expr = recoveredExpr(forTok);
    let stepExpr: Expr | null = null;
    let descending = false;
    try {
      varTok = this.expect(
        "IDENTIFIER",
        "diharapkan nama variabel pencacah (counter) sesudah kata kunci 'for'."
      );
      this.expect(
        "ASSIGN",
        `diharapkan tanda '=' atau '<-' sesudah variabel '${varTok.value}' pada perulangan 'for'.`
      );
      startExpr = this.parseExpr();
      const next = this.tokens[this.pos + 1];
      if (this.match("DOWNTO")) {
        descending = true;
      } else if (
        this.current().type === "IDENTIFIER" &&
        String(this.current().value).toLowerCase() === "down" &&
        next?.type === "TO"
      ) {
        // Common beginner spelling "down to": explain, then read it as downto.
        const downTok = this.advance();
        this.advance();
        this.report(
          syntaxError(
            "tulis 'downto' sebagai satu kata (tanpa spasi), bukan 'down to'.",
            downTok.line,
            downTok.col,
            this._lineText(downTok.line)
          )
        );
        descending = true;
      } else {
        this.expect(
          "TO",
          "diharapkan kata kunci 'to' atau 'downto' sesudah nilai awal perulangan 'for'."
        );
      }
      endExpr = this.parseExpr();
      if (this.match("STEP")) {
        stepExpr = this.parseExpr();
      }
      this.expect(
        "DO",
        "diharapkan kata kunci 'do' sesudah nilai batas akhir (atau 'step') perulangan 'for'."
      );
    } catch (err) {
      this._recoverHeader(err, forTok.line, "DO");
    }

    const body = this._parseBlock(["ENDFOR", "ENDPROGRAM", "EOF"]);

    this.expectClose(
      "ENDFOR",
      "kata kunci 'endfor' tidak ditemukan untuk menutup perulangan 'for'.",
      forTok
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
      descending,
    };
  }

  /** Parse `<expr> then` (or `do`) of a block header, recovering on error. */
  _parseCondition(headerTok: Token, terminator: string, terminatorMsg: string): Expr {
    let cond: Expr = recoveredExpr(headerTok);
    try {
      cond = this.parseExpr();
      this.expect(terminator, terminatorMsg);
    } catch (err) {
      this._recoverHeader(err, headerTok.line, terminator);
    }
    return cond;
  }

  parseIfStmt(): IfStmt {
    const ifTok = this.expect("IF", "diharapkan 'if'.");
    const firstCond = this._parseCondition(
      ifTok,
      "THEN",
      "diharapkan kata kunci 'then' sesudah kondisi 'if'."
    );
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
        const elifCond = this._parseCondition(
          elifTok,
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

    this.expectClose(
      "ENDIF",
      "kata kunci 'endif' tidak ditemukan untuk menutup percabangan 'if'.",
      ifTok
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
    const condition = this._parseCondition(
      whileTok,
      "DO",
      "diharapkan kata kunci 'do' sesudah kondisi perulangan 'while'."
    );
    const body = this._parseBlock(["ENDWHILE", "ENDPROGRAM", "EOF"]);
    this.expectClose(
      "ENDWHILE",
      "kata kunci 'endwhile' tidak ditemukan untuk menutup perulangan 'while'.",
      whileTok
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
    const untilTok = this.expectClose(
      "UNTIL",
      "kata kunci 'until' tidak ditemukan untuk menutup perulangan 'repeat'.",
      repeatTok
    );
    let condition: Expr = recoveredExpr(untilTok ?? repeatTok);
    if (untilTok) {
      try {
        condition = this.parseExpr();
      } catch (err) {
        this._recoverHeader(err, untilTok.line, null);
      }
    }
    return {
      _type: "RepeatStmt",
      body,
      condition,
      line: repeatTok.line,
      col: repeatTok.col,
      untilLine: (untilTok ?? repeatTok).line,
      untilCol: (untilTok ?? repeatTok).col,
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

    const prev = this._prev();
    const found =
      tok.type === "EOF"
        ? "akhir file"
        : prev && tok.line > prev.line
        ? "akhir baris"
        : `'${tok.value}'`;
    throw this.errorHere(`diharapkan nilai atau ekspresi, tetapi ditemukan ${found}.`);
  }
}

/** Parse and throw the first syntax error (used by the runner). */
export function parse(tokens: Token[], source: string): Program {
  const { program, errors } = parseWithRecovery(tokens, source);
  if (errors.length > 0) throw errors[0];
  return program;
}

/** Parse the whole program, collecting every syntax error instead of stopping at the first. */
export function parseWithRecovery(
  tokens: Token[],
  source: string
): { program: Program; errors: PseudoError[] } {
  const parser = new Parser(tokens, source.split(/\r?\n/));
  const program = parser.parseProgram();
  return { program, errors: parser.errors };
}
