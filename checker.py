"""
checker.py
----------
Tahap 3: Semantic Checker (Pemeriksa Kamus & Tipe Data).

APA TUGAS FILE INI?
Memeriksa apakah program masuk akal secara aturan bahasa SEBELUM dijalankan:
1. Apakah semua tipe data (termasuk alias dan struct) di 'kamus' valid?
   Catatan: Deklarasi di dalam 'kamus' boleh ditulis dengan urutan apa saja!
2. Apakah semua variabel, konstanta, dan field struct sudah dideklarasikan?
3. Apakah ada percobaan mengubah nilai konstanta (yang dilarang)?
4. Apakah tipe data pada operasi, fungsi len(), dan assignment sudah cocok?
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
from errors import semantic_error


# Semua tipe data dasar
VALID_BASE_TYPES = {"integer", "real", "string", "boolean", "char"}

# Tipe yang dianggap bilangan bulat (char disimpan sebagai kode integer ASCII/Unicode)
INT_COMPATIBLE = {"integer", "char"}

# Tipe yang bisa dipakai dalam perhitungan matematika umum (+, -, *, /, ^)
NUMERIC_TYPES = {"integer", "real", "char"}


class SemanticChecker:
    """
    Memeriksa pohon AST dan menyimpan tabel simbol:
    - aliases   : nama_alias -> nama_tipe_target
    - structs   : nama_struct -> {nama_field: tipe_field_terurai}
    - variables : nama_var_atau_konstanta -> tipe_terurai
    - constants : himpunan nama konstanta (agar tidak boleh diubah di algoritma)
    """

    def __init__(self, source_lines: list[str]):
        self.source_lines = source_lines
        self.aliases: dict[str, AliasDecl] = {}
        self.raw_structs: dict[str, StructDecl] = {}
        self.structs: dict[str, dict[str, str]] = {}
        self.variables: dict[str, str] = {}
        self.constants: set[str] = set()

    def _line_text(self, line_no: int) -> str:
        if 1 <= line_no <= len(self.source_lines):
            return self.source_lines[line_no - 1]
        return ""

    def check_program(self, program: Program) -> dict[str, str]:
        """
        Memeriksa bagian kamus (menggunakan 2 tahap agar urutan deklarasi bebas),
        lalu memeriksa seluruh statement di bagian algoritma.
        """
        # Tahap 1 Kamus: Kumpulkan semua deklarasi tipe (Alias & Struct) terlebih dahulu
        for decl in program.declarations:
            if isinstance(decl, (AliasDecl, StructDecl)):
                self.register_type_decl(decl)

        # Tahap 2 Kamus: Validasi isi Alias & Struct (urai rantai alias & tipe field struct)
        for alias_name, alias_decl in self.aliases.items():
            self.resolve_type(alias_name, alias_decl.line, alias_decl.target_col)

        for struct_name, struct_decl in self.raw_structs.items():
            self.resolve_struct_fields(struct_name, struct_decl)

        # Pastikan tidak ada struct yang menyimpan dirinya sendiri secara melingkar
        for struct_name, struct_decl in self.raw_structs.items():
            self.check_recursive_struct(struct_name, struct_decl, set())

        # Tahap 3 Kamus: Periksa deklarasi Konstanta dan Variabel
        for decl in program.declarations:
            if isinstance(decl, ConstDecl):
                self.check_const_decl(decl)
            elif isinstance(decl, VarDecl):
                self.check_var_decl(decl)

        # Tahap 4: Periksa seluruh instruksi di bagian algoritma
        for stmt in program.statements:
            self.check_statement(stmt)

        return self.variables

    # =================================================================
    # 1. PENDAFTARAN & PENGURAIAN TIPE (ALIAS & STRUCT)
    # =================================================================

    def register_type_decl(self, decl: AliasDecl | StructDecl) -> None:
        type_name = decl.alias_name if isinstance(decl, AliasDecl) else decl.struct_name
        if type_name in VALID_BASE_TYPES or type_name in self.aliases or type_name in self.raw_structs:
            raise semantic_error(
                f"tipe '{type_name}' sudah pernah dideklarasikan sebelumnya.",
                decl.line,
                decl.col,
                self._line_text(decl.line),
            )
        if isinstance(decl, AliasDecl):
            self.aliases[type_name] = decl
        else:
            self.raw_structs[type_name] = decl

    def resolve_type(self, type_name: str, line: int, col: int) -> str:
        """
        Mengurai nama tipe (misal alias 'bilangan') menjadi tipe aslinya ('integer' atau nama struct).
        Juga mendeteksi jika ada alias yang berputar melingkar (contoh: type a : b dan type b : a).
        """
        visited: set[str] = set()
        curr = type_name
        while curr in self.aliases:
            if curr in visited:
                raise semantic_error(
                    f"deklarasi tipe alias '{type_name}' berputar tanpa ujung (circular alias).",
                    line,
                    col,
                    self._line_text(line),
                )
            visited.add(curr)
            curr = self.aliases[curr].target_type

        if curr in VALID_BASE_TYPES or curr in self.raw_structs:
            return curr

        raise semantic_error(
            f"tipe data '{type_name}' tidak dikenal.",
            line,
            col,
            self._line_text(line),
        )

    def resolve_struct_fields(self, struct_name: str, decl: StructDecl) -> None:
        field_map: dict[str, str] = {}
        for fdecl in decl.fields:
            resolved_field_type = self.resolve_type(
                fdecl.type_name,
                fdecl.line,
                fdecl.type_col,
            )
            cols = fdecl.name_cols if fdecl.name_cols else [fdecl.col] * len(fdecl.names)
            for fname, fcol in zip(fdecl.names, cols):
                if fname in field_map:
                    raise semantic_error(
                        f"field '{fname}' sudah pernah dideklarasikan di dalam struct '{struct_name}'.",
                        fdecl.line,
                        fcol,
                        self._line_text(fdecl.line),
                    )
                field_map[fname] = resolved_field_type
        self.structs[struct_name] = field_map

    def check_recursive_struct(self, current_struct: str, decl: StructDecl, trail: set[str]) -> None:
        if current_struct in trail:
            raise semantic_error(
                f"struct '{current_struct}' tidak boleh memuat dirinya sendiri secara rekursif.",
                decl.line,
                decl.col,
                self._line_text(decl.line),
            )
        new_trail = trail | {current_struct}
        for field_type in self.structs[current_struct].values():
            if field_type in self.raw_structs:
                self.check_recursive_struct(field_type, self.raw_structs[field_type], new_trail)

    # =================================================================
    # 2. CEK DEKLARASI KONSTANTA & VARIABEL DI KAMUS
    # =================================================================

    def check_const_decl(self, decl: ConstDecl) -> None:
        if decl.name in self.variables:
            raise semantic_error(
                f"nama '{decl.name}' sudah pernah dideklarasikan di kamus.",
                decl.line,
                decl.col,
                self._line_text(decl.line),
            )
        resolved_type = self.resolve_type(decl.type_name, decl.line, decl.type_col)
        if resolved_type not in VALID_BASE_TYPES:
            raise semantic_error(
                f"konstanta '{decl.name}' harus bertipe dasar (integer/real/string/boolean/char), "
                f"bukan '{decl.type_name}'.",
                decl.line,
                decl.type_col,
                self._line_text(decl.line),
            )
        self._ensure_const_expr(decl.value, decl.name)
        val_type = self.check_expr(decl.value)
        if not self.is_assign_compatible(resolved_type, val_type):
            raise semantic_error(
                f"tidak dapat mengisi konstanta '{decl.name}' yang bertipe '{resolved_type}' "
                f"dengan nilai bertipe '{val_type}'.",
                decl.line,
                decl.col,
                self._line_text(decl.line),
            )
        self.variables[decl.name] = resolved_type
        self.constants.add(decl.name)

    def _ensure_const_expr(self, expr: Expr, const_name: str) -> None:
        """Pastikan ekspresi konstanta tidak bergantung pada variabel biasa yang belum bernilai."""
        if isinstance(expr, VarExpr):
            if expr.name not in self.constants:
                raise semantic_error(
                    f"nilai konstanta '{const_name}' tidak boleh diambil dari variabel '{expr.name}'.",
                    expr.line,
                    expr.col,
                    self._line_text(expr.line),
                )
        elif isinstance(expr, FieldAccessExpr):
            raise semantic_error(
                f"nilai konstanta '{const_name}' tidak boleh diambil dari field struct.",
                expr.line,
                expr.col,
                self._line_text(expr.line),
            )
        elif isinstance(expr, UnaryExpr):
            self._ensure_const_expr(expr.operand, const_name)
        elif isinstance(expr, BinaryExpr):
            self._ensure_const_expr(expr.left, const_name)
            self._ensure_const_expr(expr.right, const_name)
        elif isinstance(expr, LenExpr):
            self._ensure_const_expr(expr.arg, const_name)

    def check_var_decl(self, decl: VarDecl) -> None:
        resolved_type = self.resolve_type(decl.type_name, decl.line, decl.type_col)
        cols = decl.name_cols if decl.name_cols else [decl.col] * len(decl.names)
        for name, name_col in zip(decl.names, cols):
            if name in self.variables:
                raise semantic_error(
                    f"variabel '{name}' sudah pernah dideklarasikan di kamus.",
                    decl.line,
                    name_col,
                    self._line_text(decl.line),
                )
            self.variables[name] = resolved_type

    def is_assign_compatible(self, target_type: str, value_type: str) -> bool:
        """
        Aturan kecocokan tipe pada pengisian nilai (assignment):
        1. Tipe sama persis (termasuk sesama struct dengan tipe yang sama) -> BOLEH
        2. Variabel 'real' diisi 'integer' -> BOLEH (konversi implisit)
        3. Variabel 'char' diisi 'integer' (atau sebaliknya) -> BOLEH karena char = kode integer
        """
        if target_type == value_type:
            return True
        if target_type == "real" and value_type == "integer":
            return True
        if target_type in INT_COMPATIBLE and value_type in INT_COMPATIBLE:
            return True
        return False

    # =================================================================
    # 3. CEK STATEMENT DI BAGIAN ALGORITMA
    # =================================================================

    def check_statement(self, stmt: Stmt) -> None:
        if isinstance(stmt, AssignStmt):
            self.check_assign(stmt)
        elif isinstance(stmt, InputStmt):
            self.check_input(stmt)
        elif isinstance(stmt, OutputStmt):
            self.check_output(stmt)
        elif isinstance(stmt, ForStmt):
            self.check_for(stmt)
        else:
            raise semantic_error(
                "jenis instruksi belum didukung oleh pemeriksa tipe.",
                stmt.line,
                stmt.col,
                self._line_text(stmt.line),
            )

    def check_assign(self, stmt: AssignStmt) -> None:
        # Cek apakah targetnya adalah konstanta (konstanta tidak boleh diubah!)
        if isinstance(stmt.target, VarExpr) and stmt.target.name in self.constants:
            raise semantic_error(
                f"konstanta '{stmt.target.name}' tidak boleh diubah nilainya.",
                stmt.line,
                stmt.col,
                self._line_text(stmt.line),
            )

        target_type = self.check_expr(stmt.target)
        value_type = self.check_expr(stmt.value)

        if not self.is_assign_compatible(target_type, value_type):
            target_label = self._format_lvalue_name(stmt.target)
            raise semantic_error(
                f"tidak dapat mengisi '{target_label}' yang bertipe '{target_type}' "
                f"dengan nilai bertipe '{value_type}'.",
                stmt.line,
                stmt.col,
                self._line_text(stmt.line),
            )

    def check_input(self, stmt: InputStmt) -> None:
        for target in stmt.targets:
            if isinstance(target, VarExpr) and target.name in self.constants:
                raise semantic_error(
                    f"konstanta '{target.name}' tidak boleh diubah nilainya melalui 'input(...)'.",
                    target.line,
                    target.col,
                    self._line_text(target.line),
                )
            target_type = self.check_expr(target)
            if target_type not in VALID_BASE_TYPES:
                target_label = self._format_lvalue_name(target)
                raise semantic_error(
                    f"instruksi 'input(...)' tidak dapat membaca langsung ke struct '{target_label}' "
                    f"(sebutkan field-nya, misalnya '{target_label}.nama_field').",
                    target.line,
                    target.col,
                    self._line_text(target.line),
                )

    def check_output(self, stmt: OutputStmt) -> None:
        for expr in stmt.values:
            val_type = self.check_expr(expr)
            if val_type not in VALID_BASE_TYPES:
                raise semantic_error(
                    f"instruksi 'output(...)' tidak dapat mencetak struct bertipe '{val_type}' secara langsung "
                    f"(cetak field-nya satu per satu).",
                    expr.line,
                    expr.col,
                    self._line_text(expr.line),
                )

    def check_for(self, stmt: ForStmt) -> None:
        """
        Memeriksa aturan perulangan for:
        1. Variabel pencacah (i) harus sudah dideklarasikan di kamus.
        2. Variabel pencacah (i) bukan konstanta dan harus bertipe 'integer'.
        3. Ekspresi batas awal (init) dan batas akhir (end) harus bertipe 'integer'.
        4. Seluruh statement di dalam badan for harus valid.
        """
        if stmt.var_name not in self.variables:
            raise semantic_error(
                f"variabel pencacah '{stmt.var_name}' pada perulangan 'for' belum dideklarasikan di kamus.",
                stmt.line,
                stmt.var_col,
                self._line_text(stmt.line),
            )
        if stmt.var_name in self.constants:
            raise semantic_error(
                f"konstanta '{stmt.var_name}' tidak boleh dipakai sebagai variabel pencacah 'for'.",
                stmt.line,
                stmt.var_col,
                self._line_text(stmt.line),
            )
        var_type = self.variables[stmt.var_name]
        if var_type != "integer":
            raise semantic_error(
                f"variabel pencacah '{stmt.var_name}' pada 'for' harus bertipe 'integer', "
                f"bukan '{var_type}'.",
                stmt.line,
                stmt.var_col,
                self._line_text(stmt.line),
            )

        start_type = self.check_expr(stmt.start_expr)
        if start_type != "integer":
            raise semantic_error(
                f"nilai awal (init) pada perulangan 'for' harus bertipe 'integer', bukan '{start_type}'.",
                stmt.start_expr.line,
                stmt.start_expr.col,
                self._line_text(stmt.start_expr.line),
            )

        end_type = self.check_expr(stmt.end_expr)
        if end_type != "integer":
            raise semantic_error(
                f"nilai akhir (end) pada perulangan 'for' harus bertipe 'integer', bukan '{end_type}'.",
                stmt.end_expr.line,
                stmt.end_expr.col,
                self._line_text(stmt.end_expr.line),
            )

        if stmt.step_expr is not None:
            step_type = self.check_expr(stmt.step_expr)
            if step_type != "integer":
                raise semantic_error(
                    f"nilai langkah (step) pada perulangan 'for' harus bertipe 'integer', bukan '{step_type}'.",
                    stmt.step_expr.line,
                    stmt.step_expr.col,
                    self._line_text(stmt.step_expr.line),
                )

        for body_stmt in stmt.body:
            self.check_statement(body_stmt)

    def _format_lvalue_name(self, expr: Expr) -> str:
        if isinstance(expr, VarExpr):
            return expr.name
        if isinstance(expr, FieldAccessExpr):
            return f"{self._format_lvalue_name(expr.obj)}.{expr.field_name}"
        return "target"

    # =================================================================
    # 4. CEK TIPE EKSPRESI
    # =================================================================

    def check_var_exists(self, var_node: VarExpr) -> str:
        if var_node.name not in self.variables:
            raise semantic_error(
                f"variabel '{var_node.name}' belum dideklarasikan di kamus.",
                var_node.line,
                var_node.col,
                self._line_text(var_node.line),
            )
        return self.variables[var_node.name]

    def check_field_access(self, expr: FieldAccessExpr) -> str:
        obj_type = self.check_expr(expr.obj)
        if obj_type not in self.structs:
            raise semantic_error(
                f"'{self._format_lvalue_name(expr.obj)}' bertipe '{obj_type}' (bukan struct), "
                f"sehingga tidak memiliki field '{expr.field_name}'.",
                expr.line,
                expr.field_col,
                self._line_text(expr.line),
            )
        struct_fields = self.structs[obj_type]
        if expr.field_name not in struct_fields:
            raise semantic_error(
                f"field '{expr.field_name}' tidak ditemukan pada struct '{obj_type}'.",
                expr.line,
                expr.field_col,
                self._line_text(expr.line),
            )
        return struct_fields[expr.field_name]

    def check_expr(self, expr: Expr) -> str:
        """Menentukan tipe hasil dari sebuah ekspresi sekaligus memvalidasi aturannya."""
        if isinstance(expr, LiteralExpr):
            return expr.type_name

        if isinstance(expr, VarExpr):
            return self.check_var_exists(expr)

        if isinstance(expr, FieldAccessExpr):
            return self.check_field_access(expr)

        if isinstance(expr, LenExpr):
            arg_type = self.check_expr(expr.arg)
            if arg_type != "string":
                raise semantic_error(
                    f"fungsi 'len(...)' hanya menerima argumen bertipe 'string', "
                    f"tetapi ditemukan '{arg_type}'.",
                    expr.line,
                    expr.col,
                    self._line_text(expr.line),
                )
            return "integer"

        if isinstance(expr, UnaryExpr):
            operand_type = self.check_expr(expr.operand)
            if expr.op == "not":
                if operand_type != "boolean":
                    raise semantic_error(
                        f"operator 'not' hanya bisa dipakai pada tipe 'boolean', "
                        f"bukan '{operand_type}'.",
                        expr.line,
                        expr.col,
                        self._line_text(expr.line),
                    )
                return "boolean"

            if operand_type not in NUMERIC_TYPES:
                raise semantic_error(
                    f"operator unary '{expr.op}' hanya bisa dipakai pada angka (integer/real), "
                    f"bukan '{operand_type}'.",
                    expr.line,
                    expr.col,
                    self._line_text(expr.line),
                )
            return "real" if operand_type == "real" else "integer"

        if isinstance(expr, BinaryExpr):
            left_type = self.check_expr(expr.left)
            right_type = self.check_expr(expr.right)
            op = expr.op

            # 1. Operasi logika boolean: and, or
            if op in ("and", "or"):
                if left_type == "boolean" and right_type == "boolean":
                    return "boolean"
                raise semantic_error(
                    f"operator logika '{op}' membutuhkan dua nilai 'boolean', "
                    f"tetapi ditemukan '{left_type}' dan '{right_type}'.",
                    expr.line,
                    expr.col,
                    self._line_text(expr.line),
                )

            # 2. Operasi penjumlahan '+' (angka + angka, atau konkatenasi string + string)
            if op == "+":
                if left_type == "string" and right_type == "string":
                    return "string"
                if left_type in NUMERIC_TYPES and right_type in NUMERIC_TYPES:
                    if left_type == "real" or right_type == "real":
                        return "real"
                    return "integer"
                raise semantic_error(
                    f"operator '+' tidak bisa digunakan antara tipe '{left_type}' dan '{right_type}'.",
                    expr.line,
                    expr.col,
                    self._line_text(expr.line),
                )

            # 3. Operasi '-', '*', '^'
            if op in ("-", "*", "^"):
                if left_type in NUMERIC_TYPES and right_type in NUMERIC_TYPES:
                    if left_type == "real" or right_type == "real":
                        return "real"
                    return "integer"
                raise semantic_error(
                    f"operator '{op}' tidak bisa digunakan antara tipe '{left_type}' dan '{right_type}'.",
                    expr.line,
                    expr.col,
                    self._line_text(expr.line),
                )

            # 4. Operasi '/' SELALU menghasilkan tipe 'real'
            if op == "/":
                if left_type in NUMERIC_TYPES and right_type in NUMERIC_TYPES:
                    return "real"
                raise semantic_error(
                    f"operator '/' hanya bisa digunakan untuk angka (integer/real), "
                    f"bukan '{left_type}' dan '{right_type}'.",
                    expr.line,
                    expr.col,
                    self._line_text(expr.line),
                )

            # 5. Operasi khusus bilangan bulat: div, mod, <<, >>, &, |
            if op in ("div", "mod", "<<", ">>", "&", "|"):
                if left_type in INT_COMPATIBLE and right_type in INT_COMPATIBLE:
                    return "integer"
                raise semantic_error(
                    f"operator '{op}' hanya boleh digunakan pada tipe 'integer', "
                    f"tetapi ditemukan '{left_type}' dan '{right_type}'.",
                    expr.line,
                    expr.col,
                    self._line_text(expr.line),
                )

            # 6. Operasi perbandingan: <, <=, >, >=, ==, !=
            if op in ("<", "<=", ">", ">=", "==", "!="):
                if left_type in NUMERIC_TYPES and right_type in NUMERIC_TYPES:
                    return "boolean"
                if left_type == "string" and right_type == "string":
                    return "boolean"
                if op in ("==", "!=") and left_type == "boolean" and right_type == "boolean":
                    return "boolean"
                raise semantic_error(
                    f"operator perbandingan '{op}' tidak bisa membandingkan tipe '{left_type}' dengan '{right_type}'.",
                    expr.line,
                    expr.col,
                    self._line_text(expr.line),
                )

        raise semantic_error(
            "ekspresi tidak dikenali.",
            expr.line,
            expr.col,
            self._line_text(expr.line),
        )


def check(program: Program, source: str) -> dict[str, str]:
    """Fungsi pembantu untuk menjalankan Semantic Checker."""
    checker = SemanticChecker(source.splitlines())
    return checker.check_program(program)
