"""
ast_nodes.py
------------
Definisi kotak-kotak penyimpan struktur program (AST = Abstract Syntax Tree).

APA TUGAS FILE INI?
Menyediakan class data sederhana (menggunakan @dataclass) untuk mewakili
setiap bagian dari program pseudocode setelah dibaca oleh Parser.

Pada Milestone 3, AST sudah dilengkapi node untuk:
- ConstDecl       : deklarasi konstanta (constant PI : real = 3.14)
- AliasDecl       : deklarasi tipe alias (type bilangan : integer)
- StructDecl      : deklarasi tipe bentukan struct (type date < ... >)
- FieldAccessExpr : akses field struct dengan titik (tgl.tanggal)
"""

from dataclasses import dataclass


# =====================================================================
# 1. NODE DEKLARASI (Bagian 'kamus')
# =====================================================================

class Decl:
    """Class induk penanda untuk semua jenis deklarasi di bagian kamus."""
    line: int
    col: int


@dataclass
class VarDecl(Decl):
    """
    Mewakili satu baris deklarasi variabel (atau satu baris field di dalam struct).
    Contoh: posisi, posisi0 : integer
    - names      : ['posisi', 'posisi0']
    - name_cols  : kolom masing-masing nama variabel (agar tanda '^' akurat)
    - type_name  : 'integer'
    """
    names: list[str]
    type_name: str
    line: int
    col: int
    type_col: int = 1
    name_cols: list[int] | None = None


@dataclass
class ConstDecl(Decl):
    """
    Mewakili deklarasi nilai tetap (konstanta) di bagian kamus.
    Contoh: constant PI : real = 3.14
    """
    name: str
    type_name: str
    value: "Expr"
    line: int
    col: int
    type_col: int = 1


@dataclass
class AliasDecl(Decl):
    """
    Mewakili deklarasi nama tipe baru (alias) di bagian kamus.
    Contoh: type bilangan : integer
    """
    alias_name: str
    target_type: str
    line: int
    col: int
    target_col: int = 1


@dataclass
class StructDecl(Decl):
    """
    Mewakili deklarasi tipe bentukan struktur/record di bagian kamus.
    Contoh:
        type date <
            tanggal : integer
            bulan : string
            tahun : integer
        >
    """
    struct_name: str
    fields: list[VarDecl]
    line: int
    col: int


# =====================================================================
# 2. NODE EKSPRESI (Rumus / Nilai yang bisa dihitung)
# =====================================================================

class Expr:
    """Class induk penanda untuk semua jenis ekspresi."""
    line: int
    col: int


@dataclass
class LiteralExpr(Expr):
    """
    Mewakili nilai mentah (literal) langsung di dalam kode.
    Contoh: 42 (integer), 3.14 (real), "hello" (string), 'k' (char), true (boolean).
    """
    value: object
    type_name: str
    line: int
    col: int


@dataclass
class VarExpr(Expr):
    """
    Mewakili pemakaian variabel atau konstanta di dalam ekspresi atau target input/assign.
    Contoh: kecepatan
    """
    name: str
    line: int
    col: int


@dataclass
class FieldAccessExpr(Expr):
    """
    Mewakili akses field pada struct menggunakan tanda titik ('.').
    Contoh: tgl.tanggal (obj = VarExpr('tgl'), field_name = 'tanggal')
    Bisa juga bertingkat: pegawai.tgl_lahir.tahun
    """
    obj: Expr
    field_name: str
    line: int
    col: int
    field_col: int = 1


@dataclass
class UnaryExpr(Expr):
    """
    Mewakili operasi 1 operand di depan (unary +, -, atau not).
    Contoh: -5, not status
    """
    op: str
    operand: Expr
    line: int
    col: int


@dataclass
class BinaryExpr(Expr):
    """
    Mewakili operasi 2 operand (kiri op kanan).
    Contoh: kecepatan * waktu, celcius * 9 / 5, a and b, s1 + s2
    """
    left: Expr
    op: str
    right: Expr
    line: int
    col: int


@dataclass
class LenExpr(Expr):
    """
    Mewakili pemanggilan fungsi bawaan len(s) untuk menghitung panjang string.
    Contoh: len("hello") -> menghasilkan 5 (bertipe integer).
    """
    arg: Expr
    line: int
    col: int


# =====================================================================
# 3. NODE STATEMENT (Instruksi di bagian 'algoritma')
# =====================================================================

class Stmt:
    """Class induk penanda untuk semua jenis instruksi/statement."""
    line: int
    col: int


@dataclass
class AssignStmt(Stmt):
    """
    Mewakili instruksi pengisian nilai (assignment).
    Target bisa berupa variabel biasa (VarExpr) atau field struct (FieldAccessExpr).
    Contoh: posisi = 10   atau   tgl.tanggal = tgl.tanggal + 10
    """
    target: VarExpr | FieldAccessExpr
    value: Expr
    line: int
    col: int


@dataclass
class InputStmt(Stmt):
    """
    Mewakili instruksi pembacaan masukan dari pengguna.
    Contoh: input(posisi0, kecepatan)   atau   input(tgl.bulan, tgl.tahun)
    """
    targets: list[VarExpr | FieldAccessExpr]
    line: int
    col: int


@dataclass
class OutputStmt(Stmt):
    """
    Mewakili instruksi pencetakan keluaran ke layar.
    Contoh: output(reamur, fahrenheit, kelvin)
    """
    values: list[Expr]
    line: int
    col: int


@dataclass
class ForStmt(Stmt):
    """
    Mewakili instruksi perulangan for-to-do-endfor.
    Contoh:
        for j = 1 to n do
            ...
        endfor
    """
    var_name: str
    start_expr: Expr
    end_expr: Expr
    body: list[Stmt]
    line: int
    col: int
    var_col: int = 1


# =====================================================================
# 4. NODE UTAMA PROGRAM
# =====================================================================

@dataclass
class Program:
    """
    Mewakili satu file program pseudocode utuh dari 'program' sampai 'endprogram'.
    """
    name: str
    declarations: list[Decl]
    statements: list[Stmt]
    line: int
    col: int
