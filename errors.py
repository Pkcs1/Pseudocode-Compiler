"""
errors.py
---------
File ini bertugas mengurus semua pesan error di interpreter kita.

KENAPA FILE INI ADA?
Supaya kalau pemrogram membuat kesalahan (salah ketik sintaks, lupa deklarasi
variabel di kamus, atau membagi angka dengan nol), program TIDAK menampilkan
"Python Traceback" yang membingungkan. Sebagai gantinya, kita tampilkan pesan
bahasa Indonesia yang ramah lengkap dengan nomor baris dan tanda panah (^).

Tiga kategori kesalahan sesuai spesifikasi:
1. kesalahan sintaks (dari Lexer atau Parser)
2. kesalahan tipe/deklarasi (dari Semantic Checker)
3. kesalahan saat program berjalan (dari Interpreter)
"""

KATEGORI_SINTAKS = "kesalahan sintaks"
KATEGORI_SEMAN = "kesalahan tipe/deklarasi"
KATEGORI_RUNTIME = "kesalahan saat program berjalan"


class PseudoError(Exception):
    """
    Class dasar untuk semua error yang terjadi di dalam kode pseudocode.
    Menyimpan kategori error, pesan penjelasan, nomor baris, nomor kolom,
    dan isi teks baris kode yang bermasalah.
    """

    def __init__(
        self,
        category: str,
        message: str,
        line: int,
        col: int = 1,
        source_line: str = "",
    ):
        super().__init__(message)
        self.category = category
        self.message = message
        self.line = line
        self.col = max(1, col)
        self.source_line = source_line

    def format_error(self, source_lines: list[str] | None = None) -> str:
        """
        Mengubah data error menjadi teks rapi yang siap ditampilkan ke layar.
        Contoh hasil:
        Error (baris 7) [kesalahan tipe/deklarasi]: variabel 'x' belum dideklarasikan di kamus.
           7 |    x = y + 1
                     ^
        """
        # Ambil baris kode asli jika belum disimpan di dalam objek error
        line_text = self.source_line
        if not line_text and source_lines and 1 <= self.line <= len(source_lines):
            line_text = source_lines[self.line - 1]

        header = f"Error (baris {self.line}) [{self.category}]: {self.message}"
        if not line_text and source_lines is not None and not source_lines:
            return header

        # Ganti karakter tab (\t) menjadi 4 spasi supaya posisi tanda panah (^)
        # tidak meleset kalau kode sumber memakai tab.
        expanded_line = ""
        pointer_col = 1
        for idx, ch in enumerate(line_text, start=1):
            if ch == "\t":
                expanded_line += "    "
                if idx < self.col:
                    pointer_col += 4
            else:
                expanded_line += ch
                if idx < self.col:
                    pointer_col += 1
        if self.col > len(line_text):
            pointer_col += self.col - len(line_text) - 1

        prefix = f"{self.line:4d} | "
        caret_spaces = " " * (len(prefix) + max(0, pointer_col - 1))
        return f"{header}\n{prefix}{expanded_line}\n{caret_spaces}^"


def syntax_error(message: str, line: int, col: int = 1, source_line: str = "") -> PseudoError:
    """Membuat error untuk kesalahan penulisan kode (Lexer / Parser)."""
    return PseudoError(KATEGORI_SINTAKS, message, line, col, source_line)


def semantic_error(message: str, line: int, col: int = 1, source_line: str = "") -> PseudoError:
    """Membuat error untuk kesalahan aturan kamus atau ketidakcocokan tipe data (Checker)."""
    return PseudoError(KATEGORI_SEMAN, message, line, col, source_line)


def runtime_error(message: str, line: int, col: int = 1, source_line: str = "") -> PseudoError:
    """Membuat error yang terjadi saat program sedang dijalankan (Interpreter)."""
    return PseudoError(KATEGORI_RUNTIME, message, line, col, source_line)
