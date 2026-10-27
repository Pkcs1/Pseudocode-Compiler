"""
interpreter.py
--------------
Tahap 4: Interpreter (Mesin Penjalan Program).

APA TUGAS FILE INI?
Mengeksekusi pohon struktur program (AST) yang sudah dinyatakan bebas dari
kesalahan kamus/tipe oleh Semantic Checker (checker.py).

Pada Milestone 3, Interpreter sudah mendukung:
- Konstanta (constant PI : real = 3.14)
- Tipe alias (type bilangan : integer)
- Tipe struct (type date < ... >) beserta akses titik (tgl.tanggal)
- Penyalinan struct (assign struct ke struct bertipe sama akan menyalin isinya,
  bukan sekadar berbagi referensi, persis seperti di bahasa Go).
"""

from collections import deque
import math
import sys
from typing import TextIO
from ast_nodes import (
    AliasDecl,
    AssignStmt,
    BinaryExpr,
    ConstDecl,
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
from errors import runtime_error


# Penanda khusus untuk variabel/field yang sudah dideklarasikan di kamus,
# tetapi belum pernah diisi nilai lewat '=' maupun 'input()'.
UNINITIALIZED = object()


def wrap_int64(val: int) -> int:
    """
    Membungkus (wrap-around) bilangan bulat ke rentang 64-bit signed integer
    (-9223372036854775808 s.d. 9223372036854775807), persis seperti tipe int di Go.
    """
    val = int(val) & 0xFFFFFFFFFFFFFFFF
    if val >= 0x8000000000000000:
        val -= 0x10000000000000000
    return val


def copy_runtime_value(val: object) -> object:
    """
    Menyalin nilai variabel. Jika nilainya berupa struct (disimpan sebagai dict),
    buat salinan baru secara mendalam (deep copy) agar perubahan pada variabel baru
    tidak ikut mengubah struct aslinya.
    """
    if isinstance(val, dict):
        return {k: copy_runtime_value(v) for k, v in val.items()}
    return val


def format_value(val: object, var_type: str | None = None) -> str:
    """
    Mengubah satu nilai internal menjadi teks untuk ditampilkan.
    - Tipe 'char' ditampilkan sebagai karakternya (chr(val)).
    - Tipe 'boolean' dicetak 'true' atau 'false'.
    - Tipe 'real' dicetak seperti fmt.Println di Go:
      3.14 -> '3.14', 314.0 -> '314', 31.400000000000002 tetap apa adanya.
    """
    if var_type == "char":
        return chr(int(val))
    if var_type == "boolean" or isinstance(val, bool):
        return "true" if val else "false"
    if var_type == "real" or isinstance(val, float):
        fval = float(val)
        if math.isfinite(fval) and fval.is_integer() and abs(fval) < 1e15:
            return str(int(fval))
        return str(fval)
    return str(val)


def format_output(values: list[tuple[object, str | None]]) -> str:
    """
    SATU FUNGSI TERPUSAT untuk mengatur format keluaran 'output(a, b, c)'.
    Nilai-nilai dipisahkan oleh satu spasi, lalu diakhiri newline.
    """
    formatted_items = [format_value(val, t) for val, t in values]
    return " ".join(formatted_items) + "\n"


class InputReader:
    """
    Pembaca input yang memisahkan masukan berdasarkan spasi/baris baru (whitespace),
    persis seperti fmt.Scan di bahasa Go.
    """

    def __init__(self, stream: TextIO):
        self.stream = stream
        self.tokens: deque[str] = deque()

    def next_token(self, line: int, col: int, source_line: str) -> str:
        while not self.tokens:
            raw_line = self.stream.readline()
            if raw_line == "":
                raise runtime_error(
                    "masukan (input) habis terlalu cepat sebelum semua variabel terbaca.",
                    line,
                    col,
                    source_line,
                )
            for part in raw_line.split():
                self.tokens.append(part)

        return self.tokens.popleft()


class Interpreter:
    """
    Menjalankan instruksi demi instruksi pada AST.
    """

    def __init__(
        self,
        source_lines: list[str],
        stdin: TextIO = sys.stdin,
        stdout: TextIO = sys.stdout,
    ):
        self.source_lines = source_lines
        self.reader = InputReader(stdin)
        self.stdout = stdout

        self.aliases: dict[str, str] = {}
        self.structs: dict[str, dict[str, str]] = {}
        self.var_types: dict[str, str] = {}
        self.env: dict[str, object] = {}

    def _line_text(self, line_no: int) -> str:
        if 1 <= line_no <= len(self.source_lines):
            return self.source_lines[line_no - 1]
        return ""

    def resolve_type(self, type_name: str) -> str:
        curr = type_name
        while curr in self.aliases:
            curr = self.aliases[curr]
        return curr

    def make_initial_value(self, resolved_type: str) -> object:
        """
        Membuat nilai awal saat variabel dideklarasikan di kamus.
        - Untuk tipe dasar: UNINITIALIZED (belum diisi).
        - Untuk struct: dict berisi semua field-nya yang masing-masing UNINITIALIZED.
        """
        if resolved_type in self.structs:
            return {
                fname: self.make_initial_value(ftype)
                for fname, ftype in self.structs[resolved_type].items()
            }
        return UNINITIALIZED

    def run(self, program: Program) -> None:
        """
        Menyiapkan tipe (alias & struct), konstanta, dan variabel dari kamus
        (dalam urutan apa pun), lalu menjalankan semua statement di algoritma.
        """
        # Tahap 1: Kumpulkan semua deklarasi alias dan struct dulu
        raw_structs: list[StructDecl] = []
        for decl in program.declarations:
            if isinstance(decl, AliasDecl):
                self.aliases[decl.alias_name] = decl.target_type
            elif isinstance(decl, StructDecl):
                raw_structs.append(decl)

        for sdecl in raw_structs:
            field_map: dict[str, str] = {}
            for fdecl in sdecl.fields:
                ftype = self.resolve_type(fdecl.type_name)
                for fname in fdecl.names:
                    field_map[fname] = ftype
            self.structs[sdecl.struct_name] = field_map

        # Tahap 2: Siapkan variabel dan hitung nilai konstanta
        for decl in program.declarations:
            if isinstance(decl, VarDecl):
                rtype = self.resolve_type(decl.type_name)
                for name in decl.names:
                    self.var_types[name] = rtype
                    self.env[name] = self.make_initial_value(rtype)
            elif isinstance(decl, ConstDecl):
                rtype = self.resolve_type(decl.type_name)
                val, _ = self.eval_expr(decl.value)
                val = self._coerce_value(val, rtype)
                self.var_types[decl.name] = rtype
                self.env[decl.name] = val

        # Tahap 3: Jalankan semua statement di bagian algoritma
        for stmt in program.statements:
            self.exec_stmt(stmt)

    def _coerce_value(self, val: object, target_type: str) -> object:
        """Menyesuaikan representasi nilai saat disimpan ke tipe target."""
        if target_type == "real" and isinstance(val, int) and not isinstance(val, bool):
            return float(val)
        if target_type in ("integer", "char") and isinstance(val, int) and not isinstance(val, bool):
            return wrap_int64(val)
        if target_type in self.structs:
            return copy_runtime_value(val)
        return val

    # =================================================================
    # 1. BANTUAN AKSES LVALUE (VARIABEL BIASA ATAU FIELD STRUCT)
    # =================================================================

    def _format_lvalue_name(self, expr: Expr) -> str:
        if isinstance(expr, VarExpr):
            return expr.name
        if isinstance(expr, FieldAccessExpr):
            return f"{self._format_lvalue_name(expr.obj)}.{expr.field_name}"
        return "variabel"

    def _resolve_lvalue_container(
        self, target: VarExpr | FieldAccessExpr
    ) -> tuple[dict[str, object], str, str]:
        """
        Mengembalikan (wadah_dict, nama_kunci, tipe_target) untuk diisi oleh '=' atau 'input()'.
        Contoh:
        - Jika target adalah VarExpr('x'), maka wadahnya self.env dan kuncinya 'x'.
        - Jika target adalah FieldAccessExpr(VarExpr('tgl'), 'tanggal'),
          maka wadahnya adalah dict milik 'tgl' dan kuncinya 'tanggal'.
        """
        if isinstance(target, VarExpr):
            return self.env, target.name, self.var_types[target.name]

        # Target adalah FieldAccessExpr (misal tgl.tanggal atau a.b.c)
        parent_dict, parent_key, parent_type = self._resolve_lvalue_container(target.obj)  # type: ignore[arg-type]
        struct_obj = parent_dict[parent_key]
        assert isinstance(struct_obj, dict)
        field_type = self.structs[parent_type][target.field_name]
        return struct_obj, target.field_name, field_type

    # =================================================================
    # 2. EKSEKUSI STATEMENT
    # =================================================================

    def exec_stmt(self, stmt: Stmt) -> None:
        if isinstance(stmt, AssignStmt):
            self.exec_assign(stmt)
        elif isinstance(stmt, InputStmt):
            self.exec_input(stmt)
        elif isinstance(stmt, OutputStmt):
            self.exec_output(stmt)
        elif isinstance(stmt, ForStmt):
            self.exec_for(stmt)
        else:
            raise runtime_error(
                "instruksi ini belum dapat dijalankan oleh interpreter.",
                stmt.line,
                stmt.col,
                self._line_text(stmt.line),
            )

    def exec_assign(self, stmt: AssignStmt) -> None:
        val, _ = self.eval_expr(stmt.value)
        container, key, target_type = self._resolve_lvalue_container(stmt.target)
        container[key] = self._coerce_value(val, target_type)

    def exec_input(self, stmt: InputStmt) -> None:
        for target in stmt.targets:
            raw_token = self.reader.next_token(
                target.line,
                target.col,
                self._line_text(target.line),
            )
            container, key, target_type = self._resolve_lvalue_container(target)
            label = self._format_lvalue_name(target)

            if target_type == "integer":
                try:
                    val = wrap_int64(int(raw_token))
                except ValueError:
                    raise runtime_error(
                        f"masukan '{raw_token}' bukan bilangan bulat (integer) yang valid "
                        f"untuk '{label}'.",
                        target.line,
                        target.col,
                        self._line_text(target.line),
                    )
                container[key] = val

            elif target_type == "real":
                try:
                    val = float(raw_token)
                    if not math.isfinite(val):
                        raise ValueError("nan or inf not allowed")
                except ValueError:
                    raise runtime_error(
                        f"masukan '{raw_token}' bukan bilangan riil (real) yang valid "
                        f"untuk '{label}'.",
                        target.line,
                        target.col,
                        self._line_text(target.line),
                    )
                container[key] = val

            elif target_type == "string":
                container[key] = raw_token

            elif target_type == "boolean":
                if raw_token == "true":
                    container[key] = True
                elif raw_token == "false":
                    container[key] = False
                else:
                    raise runtime_error(
                        f"masukan '{raw_token}' bukan nilai boolean ('true' atau 'false') yang valid "
                        f"untuk '{label}'.",
                        target.line,
                        target.col,
                        self._line_text(target.line),
                    )

            elif target_type == "char":
                if len(raw_token) != 1:
                    raise runtime_error(
                        f"masukan '{raw_token}' bukan karakter tunggal (char) yang valid "
                        f"untuk '{label}'.",
                        target.line,
                        target.col,
                        self._line_text(target.line),
                    )
                container[key] = ord(raw_token)

    def exec_output(self, stmt: OutputStmt) -> None:
        evaluated: list[tuple[object, str | None]] = []
        for expr in stmt.values:
            val, val_type = self.eval_expr(expr)
            if val_type == "char":
                code_point = int(val)
                if code_point < 0 or code_point > 0x10FFFF:
                    raise runtime_error(
                        f"nilai kode karakter ({code_point}) berada di luar rentang karakter ASCII/Unicode yang valid.",
                        expr.line,
                        expr.col,
                        self._line_text(expr.line),
                    )
            evaluated.append((val, val_type))

        self.stdout.write(format_output(evaluated))

    def exec_for(self, stmt: ForStmt) -> None:
        """
        Menjalankan perulangan 'for i = init to end do ... endfor'.
        Aturan sesuai spesifikasi:
        - init dan end dievaluasi SATU KALI saja di awal sebelum perulangan dimulai.
        - i naik +1 setiap putaran, kedua ujung (init dan end) bersifat inklusif.
        - Jika init > end, badan perulangan dijalankan 0 kali.
        """
        start_val, _ = self.eval_expr(stmt.start_expr)
        end_val, _ = self.eval_expr(stmt.end_expr)

        curr = wrap_int64(int(start_val))
        limit = wrap_int64(int(end_val))

        self.env[stmt.var_name] = curr
        while curr <= limit:
            self.env[stmt.var_name] = wrap_int64(curr)
            for body_stmt in stmt.body:
                self.exec_stmt(body_stmt)
            curr += 1

    # =================================================================
    # 3. EVALUASI EKSPRESI (MENGHITUNG NILAI RUMUS)
    # =================================================================

    def eval_expr(self, expr: Expr) -> tuple[object, str]:
        """
        Menghitung nilai ekspresi dan mengembalikan pasangan (nilai, nama_tipe_terurai).
        """
        if isinstance(expr, LiteralExpr):
            if expr.type_name in ("integer", "char"):
                return wrap_int64(int(expr.value)), expr.type_name
            if expr.type_name == "real":
                return float(expr.value), "real"
            return expr.value, expr.type_name

        if isinstance(expr, VarExpr):
            val = self.env.get(expr.name, UNINITIALIZED)
            if val is UNINITIALIZED:
                raise runtime_error(
                    f"variabel '{expr.name}' belum diisi nilainya "
                    f"(belum pernah di-assign atau dibaca lewat input).",
                    expr.line,
                    expr.col,
                    self._line_text(expr.line),
                )
            return val, self.var_types[expr.name]

        if isinstance(expr, FieldAccessExpr):
            obj_val, obj_type = self.eval_expr(expr.obj)
            assert isinstance(obj_val, dict)
            field_val = obj_val.get(expr.field_name, UNINITIALIZED)
            if field_val is UNINITIALIZED:
                label = self._format_lvalue_name(expr)
                raise runtime_error(
                    f"field '{label}' belum diisi nilainya "
                    f"(belum pernah di-assign atau dibaca lewat input).",
                    expr.line,
                    expr.field_col,
                    self._line_text(expr.line),
                )
            field_type = self.structs[obj_type][expr.field_name]
            return field_val, field_type

        if isinstance(expr, LenExpr):
            val, _ = self.eval_expr(expr.arg)
            return wrap_int64(len(str(val))), "integer"

        if isinstance(expr, UnaryExpr):
            val, val_type = self.eval_expr(expr.operand)
            if expr.op == "not":
                return (not bool(val)), "boolean"
            if expr.op == "+":
                if val_type == "real":
                    return float(val), "real"
                return wrap_int64(int(val)), "integer"
            if expr.op == "-":
                if val_type == "real":
                    return -float(val), "real"
                return wrap_int64(-int(val)), "integer"

        if isinstance(expr, BinaryExpr):
            op = expr.op

            # 1. Evaluasi SHORT-CIRCUIT untuk 'and' dan 'or'
            if op == "and":
                left_val, _ = self.eval_expr(expr.left)
                if not bool(left_val):
                    return False, "boolean"
                right_val, _ = self.eval_expr(expr.right)
                return bool(right_val), "boolean"

            if op == "or":
                left_val, _ = self.eval_expr(expr.left)
                if bool(left_val):
                    return True, "boolean"
                right_val, _ = self.eval_expr(expr.right)
                return bool(right_val), "boolean"

            left_val, left_type = self.eval_expr(expr.left)
            right_val, right_type = self.eval_expr(expr.right)

            # 2. Konkatenasi String (+)
            if op == "+" and left_type == "string" and right_type == "string":
                return str(left_val) + str(right_val), "string"

            # 3. Penjumlahan, Pengurangan, Perkalian Angka
            if op in ("+", "-", "*"):
                is_real = (left_type == "real") or (right_type == "real")
                if is_real:
                    l_num = float(left_val)
                    r_num = float(right_val)
                    if op == "+":
                        return l_num + r_num, "real"
                    if op == "-":
                        return l_num - r_num, "real"
                    if op == "*":
                        return l_num * r_num, "real"
                else:
                    l_int = int(left_val)
                    r_int = int(right_val)
                    if op == "+":
                        return wrap_int64(l_int + r_int), "integer"
                    if op == "-":
                        return wrap_int64(l_int - r_int), "integer"
                    if op == "*":
                        return wrap_int64(l_int * r_int), "integer"

            # 4. Pangkat (^)
            if op == "^":
                is_real = (left_type == "real") or (right_type == "real")
                if is_real:
                    l_num = float(left_val)
                    r_num = float(right_val)
                    if l_num == 0.0 and r_num < 0.0:
                        raise runtime_error(
                            "pembagian dengan nol (0 dipangkatkan bilangan negatif) tidak diperbolehkan.",
                            expr.line,
                            expr.col,
                            self._line_text(expr.line),
                        )
                    try:
                        res_pow = l_num ** r_num
                    except OverflowError:
                        res_pow = float("inf") if l_num >= 0 or r_num.is_integer() else float("nan")
                    if isinstance(res_pow, complex):
                        raise runtime_error(
                            "bilangan negatif dipangkatkan pecahan tidak menghasilkan bilangan riil (real).",
                            expr.line,
                            expr.col,
                            self._line_text(expr.line),
                        )
                    return float(res_pow), "real"
                l_int = int(left_val)
                r_int = int(right_val)
                if r_int < 0:
                    raise runtime_error(
                        "pangkat negatif pada bilangan bulat (integer) tidak menghasilkan integer.",
                        expr.line,
                        expr.col,
                        self._line_text(expr.line),
                    )
                if r_int == 0:
                    return 1, "integer"
                res = pow(l_int & 0xFFFFFFFFFFFFFFFF, r_int, 1 << 64)
                return wrap_int64(res), "integer"

            # 5. Pembagian '/' (SELALU pembagian real/desimal)
            if op == "/":
                r_num = float(right_val)
                if r_num == 0.0:
                    raise runtime_error(
                        "pembagian dengan nol (division by zero) tidak diperbolehkan.",
                        expr.line,
                        expr.col,
                        self._line_text(expr.line),
                    )
                return float(left_val) / r_num, "real"

            # 6. Pembagian bulat 'div' dan sisa bagi 'mod' (ala Go)
            if op in ("div", "mod"):
                l_int = int(left_val)
                r_int = int(right_val)
                if r_int == 0:
                    raise runtime_error(
                        "pembagian dengan nol (division by zero) tidak diperbolehkan.",
                        expr.line,
                        expr.col,
                        self._line_text(expr.line),
                    )
                quotient = abs(l_int) // abs(r_int)
                if (l_int < 0) ^ (r_int < 0):
                    quotient = -quotient

                if op == "div":
                    return wrap_int64(quotient), "integer"
                else:
                    remainder = l_int - (quotient * r_int)
                    return wrap_int64(remainder), "integer"

            # 7. Operasi Bitwise: <<, >>, &, |
            if op in ("<<", ">>", "&", "|"):
                l_int = int(left_val)
                r_int = int(right_val)
                if op == "<<":
                    if r_int < 0:
                        raise runtime_error(
                            "jumlah pergeseran bit (<<) tidak boleh negatif.",
                            expr.line,
                            expr.col,
                            self._line_text(expr.line),
                        )
                    if r_int >= 64:
                        return 0, "integer"
                    return wrap_int64(l_int << r_int), "integer"
                if op == ">>":
                    if r_int < 0:
                        raise runtime_error(
                            "jumlah pergeseran bit (>>) tidak boleh negatif.",
                            expr.line,
                            expr.col,
                            self._line_text(expr.line),
                        )
                    return wrap_int64(l_int >> min(r_int, 64)), "integer"
                if op == "&":
                    return wrap_int64(l_int & r_int), "integer"
                if op == "|":
                    return wrap_int64(l_int | r_int), "integer"

            # 8. Operasi Perbandingan: <, <=, >, >=, ==, !=
            if op in ("<", "<=", ">", ">=", "==", "!="):
                if op == "<":
                    return bool(left_val < right_val), "boolean"
                if op == "<=":
                    return bool(left_val <= right_val), "boolean"
                if op == ">":
                    return bool(left_val > right_val), "boolean"
                if op == ">=":
                    return bool(left_val >= right_val), "boolean"
                if op == "==":
                    return bool(left_val == right_val), "boolean"
                if op == "!=":
                    return bool(left_val != right_val), "boolean"

        raise runtime_error(
            "ekspresi gagal dievaluasi.",
            expr.line,
            expr.col,
            self._line_text(expr.line),
        )
