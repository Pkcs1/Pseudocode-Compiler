"""
parser.py
---------
Tahap 2: Recursive-Descent Parser (Pengurai Tata Bahasa).

APA TUGAS FILE INI?
Menerima daftar Token dari Lexer (lexer.py), memeriksa apakah urutannya sesuai
dengan aturan tata bahasa (grammar) pseudocode Alpro 1, lalu menyusunnya menjadi
pohon struktur program (AST) yang didefinisikan di ast_nodes.py.

Pada Milestone 3, Parser sudah mendukung:
- Deklarasi konstanta : constant PI : real = 3.14
- Deklarasi alias     : type bilangan : integer
- Deklarasi struct    : type date < tanggal : integer ... >
  (Tanda '<' dan '>' dikenali berdasarkan konteks setelah 'type NamaTipe',
   sehingga tidak pernah bentrok dengan operator perbandingan '<' dan '>'!)
- Akses field struct menggunakan titik ('.'), misal: tgl.tanggal
"""

from ast_nodes import (
    AliasDecl,
    AssignStmt,
    BinaryExpr,
    ConstDecl,
    Decl,
    Expr,
    FieldAccessExpr,
    ForStmt,
    InputStmt,
    LenExpr,
    LiteralExpr,
    OutputStmt,
    Program,
    Stmt,
    StructDecl,
    UnaryExpr,
    VarDecl,
    VarExpr,
)
from errors import syntax_error
from lexer import Token


BASE_TYPE_TOKENS = {
    "TYPE_INTEGER",
    "TYPE_REAL",
    "TYPE_STRING",
    "TYPE_BOOLEAN",
    "TYPE_CHAR",
}


class Parser:
    """
    Parser menyimpan daftar token dan indeks posisi token yang sedang dilihat (self.pos).
    """

    def __init__(self, tokens: list[Token], source_lines: list[str]):
        self.tokens = tokens
        self.source_lines = source_lines
        self.pos = 0

    # =================================================================
    # FUNGSI BANTU NAVIGASI TOKEN
    # =================================================================

    def current(self) -> Token:
        """Mengintip token di posisi sekarang tanpa memajukan posisi."""
        return self.tokens[self.pos]

    def advance(self) -> Token:
        """Mengambil token sekarang lalu memajukan posisi ke token berikutnya."""
        tok = self.tokens[self.pos]
        if tok.type != "EOF":
            self.pos += 1
        return tok

    def match(self, *token_types: str) -> Token | None:
        """
        Jika token sekarang cocok dengan salah satu jenis di token_types,
        ambil token tersebut dan majukan posisi. Jika tidak, kembalikan None.
        """
        if self.current().type in token_types:
            return self.advance()
        return None

    def expect(self, token_type: str, error_msg: str) -> Token:
        """
        Wajib menemukan token_type di posisi sekarang.
        Kalau tidak ketemu, langsung lempar pesan kesalahan sintaks Bahasa Indonesia.
        """
        tok = self.current()
        if tok.type == token_type:
            return self.advance()
        raise syntax_error(error_msg, tok.line, tok.col, self._line_text(tok.line))

    def _line_text(self, line_no: int) -> str:
        if 1 <= line_no <= len(self.source_lines):
            return self.source_lines[line_no - 1]
        return ""

    def parse_type_name(self, context_msg: str = "sesudah ':'") -> tuple[str, Token]:
        """Membaca nama tipe data (bisa tipe dasar seperti integer/real atau nama tipe bentukan)."""
        type_tok = self.current()
        if type_tok.type in BASE_TYPE_TOKENS or type_tok.type == "IDENTIFIER":
            self.advance()
            return str(type_tok.value), type_tok
        raise syntax_error(
            f"diharapkan nama tipe data {context_msg}, tetapi ditemukan '{type_tok.value}'.",
            type_tok.line,
            type_tok.col,
            self._line_text(type_tok.line),
        )

    # =================================================================
    # 1. STRUKTUR UTAMA PROGRAM
    # =================================================================

    def parse_program(self) -> Program:
        prog_tok = self.expect(
            "PROGRAM",
            "program harus diawali dengan kata kunci 'program'.",
        )
        name_tok = self.expect(
            "IDENTIFIER",
            "setelah kata kunci 'program' harus ada nama program.",
        )

        self.expect(
            "KAMUS",
            "kata kunci 'kamus' tidak ditemukan setelah nama program.",
        )

        # Baca semua deklarasi di dalam bagian 'kamus' (bisa urutan apa saja) sampai ketemu 'algoritma'
        declarations: list[Decl] = []
        while self.current().type not in ("ALGORITMA", "ENDPROGRAM", "EOF"):
            declarations.append(self.parse_declaration())

        self.expect(
            "ALGORITMA",
            "kata kunci 'algoritma' tidak ditemukan setelah bagian 'kamus'.",
        )

        # Baca semua instruksi/statement sampai ketemu 'endprogram'
        statements: list[Stmt] = []
        while self.current().type not in ("ENDPROGRAM", "EOF"):
            statements.append(self.parse_statement())

        self.expect(
            "ENDPROGRAM",
            "kata kunci 'endprogram' tidak ditemukan di akhir program.",
        )

        # Pastikan tidak ada kode liar sesudah 'endprogram'
        if self.current().type != "EOF":
            extra = self.current()
            raise syntax_error(
                f"ada kode tak terduga '{extra.value}' sesudah 'endprogram'.",
                extra.line,
                extra.col,
                self._line_text(extra.line),
            )

        return Program(
            name=str(name_tok.value),
            declarations=declarations,
            statements=statements,
            line=prog_tok.line,
            col=prog_tok.col,
        )

    # =================================================================
    # 2. DEKLARASI DI BAGIAN KAMUS (Variabel, Konstanta, Alias, Struct)
    # =================================================================

    def parse_declaration(self) -> Decl:
        tok = self.current()

        if tok.type == "CONSTANT":
            return self.parse_const_decl()

        if tok.type == "TYPE":
            return self.parse_type_decl()

        return self.parse_var_decl()

    def parse_const_decl(self) -> ConstDecl:
        """Contoh: constant PI : real = 3.14"""
        const_tok = self.expect("CONSTANT", "diharapkan 'constant'.")
        name_tok = self.expect(
            "IDENTIFIER",
            "diharapkan nama konstanta sesudah kata kunci 'constant'.",
        )
        self.expect(
            "COLON",
            f"diharapkan tanda ':' sesudah nama konstanta '{name_tok.value}'.",
        )
        type_name, type_tok = self.parse_type_name(f"untuk konstanta '{name_tok.value}'")
        self.expect(
            "ASSIGN",
            f"diharapkan tanda '=' atau '<-' untuk mengisi nilai konstanta '{name_tok.value}'.",
        )
        val_expr = self.parse_expr()
        return ConstDecl(
            name=str(name_tok.value),
            type_name=type_name,
            value=val_expr,
            line=const_tok.line,
            col=name_tok.col,
            type_col=type_tok.col,
        )

    def parse_type_decl(self) -> AliasDecl | StructDecl:
        """
        Membedakan deklarasi Alias vs Struct dari konteks token sesudah nama tipe:
        - Jika diikuti ':' -> Alias  (contoh: type bilangan : integer)
        - Jika diikuti '<' -> Struct (contoh: type date < tanggal : integer ... >)
        """
        type_kw = self.expect("TYPE", "diharapkan 'type'.")
        name_tok = self.expect(
            "IDENTIFIER",
            "diharapkan nama tipe baru sesudah kata kunci 'type'.",
        )
        type_name = str(name_tok.value)

        # Kasus 1: Alias (type nama_alias : tipe_target)
        if self.match("COLON"):
            target_type, target_tok = self.parse_type_name(f"untuk tipe alias '{type_name}'")
            return AliasDecl(
                alias_name=type_name,
                target_type=target_type,
                line=type_kw.line,
                col=name_tok.col,
                target_col=target_tok.col,
            )

        # Kasus 2: Struct (type nama_struct < field1 : tipe1 ... >)
        if self.match("LT"):
            fields: list[VarDecl] = []
            while self.current().type not in ("GT", "ALGORITMA", "ENDPROGRAM", "EOF"):
                fields.append(self.parse_var_decl(inside_struct=True))

            if not fields:
                tok = self.current()
                raise syntax_error(
                    f"struct '{type_name}' harus memiliki minimal satu field di dalam '< ... >'.",
                    tok.line,
                    tok.col,
                    self._line_text(tok.line),
                )

            self.expect(
                "GT",
                f"diharapkan tanda '>' untuk menutup deklarasi struct '{type_name}'.",
            )
            return StructDecl(
                struct_name=type_name,
                fields=fields,
                line=type_kw.line,
                col=name_tok.col,
            )

        bad_tok = self.current()
        raise syntax_error(
            f"setelah 'type {type_name}' diharapkan ':' (untuk alias) atau '<' (untuk struct), "
            f"tetapi ditemukan '{bad_tok.value}'.",
            bad_tok.line,
            bad_tok.col,
            self._line_text(bad_tok.line),
        )

    def parse_var_decl(self, inside_struct: bool = False) -> VarDecl:
        """Contoh: a, b, c : integer  atau field di dalam struct."""
        label = "nama field" if inside_struct else "nama variabel atau kata kunci 'algoritma'"
        first_id = self.expect(
            "IDENTIFIER",
            f"diharapkan {label}.",
        )
        names = [str(first_id.value)]
        name_cols = [first_id.col]

        while self.match("COMMA"):
            next_id = self.expect(
                "IDENTIFIER",
                f"diharapkan {'nama field' if inside_struct else 'nama variabel'} sesudah tanda koma ','.",
            )
            names.append(str(next_id.value))
            name_cols.append(next_id.col)

        self.expect(
            "COLON",
            f"diharapkan tanda titik dua ':' sesudah daftar {'field' if inside_struct else 'variabel'}.",
        )

        type_name, type_tok = self.parse_type_name()
        return VarDecl(
            names=names,
            type_name=type_name,
            line=first_id.line,
            col=first_id.col,
            type_col=type_tok.col,
            name_cols=name_cols,
        )

    # =================================================================
    # 3. STATEMENT DI BAGIAN ALGORITMA & LVALUE (Akses Titik)
    # =================================================================

    def parse_lvalue(self) -> VarExpr | FieldAccessExpr:
        """
        Membaca target variabel atau akses field struct bertitik.
        Contoh: posisi   atau   tgl.tanggal   atau   pegawai.tgl_lahir.tahun
        """
        id_tok = self.expect("IDENTIFIER", "diharapkan nama variabel.")
        node: VarExpr | FieldAccessExpr = VarExpr(
            name=str(id_tok.value),
            line=id_tok.line,
            col=id_tok.col,
        )

        while self.match("DOT"):
            field_tok = self.expect(
                "IDENTIFIER",
                "diharapkan nama field sesudah tanda titik '.'.",
            )
            node = FieldAccessExpr(
                obj=node,
                field_name=str(field_tok.value),
                line=id_tok.line,
                col=id_tok.col,
                field_col=field_tok.col,
            )

        return node

    def parse_statement(self) -> Stmt:
        tok = self.current()

        if tok.type == "INPUT":
            return self.parse_input_stmt()

        if tok.type == "OUTPUT":
            return self.parse_output_stmt()

        if tok.type == "FOR":
            return self.parse_for_stmt()

        if tok.type == "IDENTIFIER":
            return self.parse_assign_stmt()

        raise syntax_error(
            f"instruksi tidak dikenal '{tok.value}' di dalam bagian algoritma.",
            tok.line,
            tok.col,
            self._line_text(tok.line),
        )

    def parse_assign_stmt(self) -> AssignStmt:
        target = self.parse_lvalue()
        self.expect(
            "ASSIGN",
            "diharapkan tanda '=' atau '<-' pada instruksi pengisian nilai (assignment).",
        )
        expr = self.parse_expr()
        return AssignStmt(target=target, value=expr, line=target.line, col=target.col)

    def parse_input_stmt(self) -> InputStmt:
        in_tok = self.expect("INPUT", "diharapkan 'input'.")
        self.expect("LPAREN", "diharapkan tanda '(' sesudah 'input'.")

        targets = [self.parse_lvalue()]
        while self.match("COMMA"):
            targets.append(self.parse_lvalue())

        self.expect("RPAREN", "diharapkan tanda ')' untuk menutup 'input(...)'.")
        return InputStmt(targets=targets, line=in_tok.line, col=in_tok.col)

    def parse_output_stmt(self) -> OutputStmt:
        out_tok = self.expect("OUTPUT", "diharapkan 'output'.")
        self.expect("LPAREN", "diharapkan tanda '(' sesudah 'output'.")

        values = [self.parse_expr()]
        while self.match("COMMA"):
            values.append(self.parse_expr())

        self.expect("RPAREN", "diharapkan tanda ')' untuk menutup 'output(...)'.")
        return OutputStmt(values=values, line=out_tok.line, col=out_tok.col)

    def parse_for_stmt(self) -> ForStmt:
        """
        Contoh:
            for i = init to end do
                <statements>
            endfor
        """
        for_tok = self.expect("FOR", "diharapkan 'for'.")
        var_tok = self.expect(
            "IDENTIFIER",
            "diharapkan nama variabel pencacah (counter) sesudah kata kunci 'for'.",
        )
        self.expect(
            "ASSIGN",
            f"diharapkan tanda '=' atau '<-' sesudah variabel '{var_tok.value}' pada perulangan 'for'.",
        )
        start_expr = self.parse_expr()
        self.expect(
            "TO",
            "diharapkan kata kunci 'to' sesudah nilai awal perulangan 'for'.",
        )
        end_expr = self.parse_expr()
        self.expect(
            "DO",
            "diharapkan kata kunci 'do' sesudah nilai batas akhir perulangan 'for'.",
        )

        body: list[Stmt] = []
        while self.current().type not in ("ENDFOR", "ENDPROGRAM", "EOF"):
            body.append(self.parse_statement())

        self.expect(
            "ENDFOR",
            "kata kunci 'endfor' tidak ditemukan untuk menutup perulangan 'for'.",
        )
        return ForStmt(
            var_name=str(var_tok.value),
            start_expr=start_expr,
            end_expr=end_expr,
            body=body,
            line=for_tok.line,
            col=for_tok.col,
            var_col=var_tok.col,
        )

    # =================================================================
    # 4. EKSPRESI & PRIORITAS OPERATOR (Level 9 Terendah s.d. Level 1 Tertinggi)
    # =================================================================

    def parse_expr(self) -> Expr:
        """Titik masuk perhitungan ekspresi (mulai dari prioritas paling rendah: 'or')."""
        return self.parse_or_expr()

    def parse_or_expr(self) -> Expr:
        """Level 9 (terendah): or (kiri ke kanan)."""
        left = self.parse_and_expr()
        while self.current().type == "OR":
            op_tok = self.advance()
            right = self.parse_and_expr()
            left = BinaryExpr(
                left=left,
                op="or",
                right=right,
                line=op_tok.line,
                col=op_tok.col,
            )
        return left

    def parse_and_expr(self) -> Expr:
        """Level 8: and (kiri ke kanan)."""
        left = self.parse_not_expr()
        while self.current().type == "AND":
            op_tok = self.advance()
            right = self.parse_not_expr()
            left = BinaryExpr(
                left=left,
                op="and",
                right=right,
                line=op_tok.line,
                col=op_tok.col,
            )
        return left

    def parse_not_expr(self) -> Expr:
        """Level 7: not (unary)."""
        if self.current().type == "NOT":
            op_tok = self.advance()
            operand = self.parse_not_expr()
            return UnaryExpr(
                op="not",
                operand=operand,
                line=op_tok.line,
                col=op_tok.col,
            )
        return self.parse_compare_expr()

    def parse_compare_expr(self) -> Expr:
        """Level 6: Perbandingan (<, <=, >, >=, ==, !=, <>)."""
        left = self.parse_add_expr()
        if self.current().type in ("LT", "LE", "GT", "GE", "EQ", "NEQ"):
            op_tok = self.advance()
            op_str = "!=" if str(op_tok.value) == "<>" else str(op_tok.value)
            right = self.parse_add_expr()
            return BinaryExpr(
                left=left,
                op=op_str,
                right=right,
                line=op_tok.line,
                col=op_tok.col,
            )
        return left

    def parse_add_expr(self) -> Expr:
        """Level 5: Penjumlahan (+), Pengurangan (-), dan Bitwise OR (|), kiri ke kanan."""
        left = self.parse_mul_expr()
        while self.current().type in ("PLUS", "MINUS", "PIPE"):
            op_tok = self.advance()
            right = self.parse_mul_expr()
            left = BinaryExpr(
                left=left,
                op=str(op_tok.value),
                right=right,
                line=op_tok.line,
                col=op_tok.col,
            )
        return left

    def parse_mul_expr(self) -> Expr:
        """Level 4: *, /, mod, div, <<, >>, &, dikerjakan kiri ke kanan."""
        left = self.parse_unary_expr()
        while self.current().type in ("STAR", "SLASH", "MOD", "DIV", "SHL", "SHR", "AMP"):
            op_tok = self.advance()
            right = self.parse_unary_expr()
            left = BinaryExpr(
                left=left,
                op=str(op_tok.value),
                right=right,
                line=op_tok.line,
                col=op_tok.col,
            )
        return left

    def parse_unary_expr(self) -> Expr:
        """Level 3: Tanda positif/negatif di depan angka/ekspresi (+x atau -x)."""
        if self.current().type in ("PLUS", "MINUS"):
            op_tok = self.advance()
            operand = self.parse_unary_expr()
            return UnaryExpr(
                op=str(op_tok.value),
                operand=operand,
                line=op_tok.line,
                col=op_tok.col,
            )
        return self.parse_power_expr()

    def parse_power_expr(self) -> Expr:
        """
        Level 2: Pangkat (^), right-associative (2 ^ 3 ^ 2 = 2 ^ (3 ^ 2)).
        """
        left = self.parse_primary_expr()
        if self.current().type == "CARET":
            op_tok = self.advance()
            right = self.parse_unary_expr()
            return BinaryExpr(
                left=left,
                op="^",
                right=right,
                line=op_tok.line,
                col=op_tok.col,
            )
        return left

    def parse_primary_expr(self) -> Expr:
        """Level 1 (paling tinggi): Kurung (...), len(...), Literal, atau Variabel/Field Struct."""
        tok = self.current()

        if tok.type == "LPAREN":
            self.advance()
            expr = self.parse_expr()
            self.expect("RPAREN", "diharapkan tanda kurung tutup ')' pada ekspresi.")
            return expr

        if tok.type == "LEN":
            len_tok = self.advance()
            self.expect("LPAREN", "diharapkan tanda '(' sesudah fungsi 'len'.")
            arg = self.parse_expr()
            self.expect("RPAREN", "diharapkan tanda ')' untuk menutup 'len(...)'.")
            return LenExpr(arg=arg, line=len_tok.line, col=len_tok.col)

        if tok.type == "INT_LIT":
            self.advance()
            return LiteralExpr(value=tok.value, type_name="integer", line=tok.line, col=tok.col)

        if tok.type == "REAL_LIT":
            self.advance()
            return LiteralExpr(value=tok.value, type_name="real", line=tok.line, col=tok.col)

        if tok.type == "STRING_LIT":
            self.advance()
            return LiteralExpr(value=tok.value, type_name="string", line=tok.line, col=tok.col)

        if tok.type == "CHAR_LIT":
            self.advance()
            return LiteralExpr(value=tok.value, type_name="char", line=tok.line, col=tok.col)

        if tok.type == "BOOL_LIT":
            self.advance()
            return LiteralExpr(value=tok.value, type_name="boolean", line=tok.line, col=tok.col)

        if tok.type == "IDENTIFIER":
            return self.parse_lvalue()

        raise syntax_error(
            f"diharapkan nilai atau ekspresi, tetapi ditemukan '{tok.value}'.",
            tok.line,
            tok.col,
            self._line_text(tok.line),
        )


def parse(tokens: list[Token], source: str) -> Program:
    """Fungsi pembantu untuk menjalankan Parser."""
    parser = Parser(tokens, source.splitlines())
    return parser.parse_program()
