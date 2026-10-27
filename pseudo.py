"""
pseudo.py
---------
Pintu Masuk Utama (Command-Line Interface / CLI) untuk Interpreter Pseudocode Alpro 1.

CARA PAKAI DI TERMINAL:
    python pseudo.py nama_file.pseudo

APA TUGAS FILE INI?
Menghubungkan keempat tahapan menjadi satu alur utuh:
    1. Baca isi file .pseudo
    2. Lexer       (lexer.py)       -> ubah teks jadi Token
    3. Parser      (parser.py)      -> ubah Token jadi pohon AST
    4. Checker     (checker.py)     -> periksa kamus & tipe data SEBELUM jalan
    5. Interpreter (interpreter.py) -> jalankan program dari awal sampai selesai

Jika ada kesalahan di tahap mana pun, tangkap error-nya, tampilkan pesan Bahasa
Indonesia yang rapi tanpa Python traceback, lalu keluar dengan kode status 1.
"""

import sys
from pathlib import Path
from typing import TextIO

from checker import check
from errors import PseudoError
from interpreter import Interpreter
from lexer import normalize_smart_quotes, tokenize
from parser import parse


def run_source(
    source: str,
    stdin: TextIO = sys.stdin,
    stdout: TextIO = sys.stdout,
) -> None:
    """
    Menjalankan kode sumber pseudocode dari tahap Lexer sampai Interpreter.
    Melempar PseudoError jika ditemukan kesalahan sintaks, tipe/kamus, atau runtime.
    """
    normalized_source = normalize_smart_quotes(source)
    source_lines = normalized_source.splitlines()

    # Tahap 1: Lexer
    tokens = tokenize(normalized_source)

    # Tahap 2: Parser
    program = parse(tokens, normalized_source)

    # Tahap 3: Semantic Checker (Wajib dijalankan SEBELUM eksekusi!)
    check(program, normalized_source)

    # Tahap 4: Interpreter
    interpreter = Interpreter(source_lines=source_lines, stdin=stdin, stdout=stdout)
    interpreter.run(program)


def main(argv: list[str] | None = None) -> int:
    if argv is None:
        argv = sys.argv[1:]

    if len(argv) != 1:
        sys.stderr.write("Cara pakai: python pseudo.py <file_program.pseudo>\n")
        return 1

    file_path = Path(argv[0])
    if not file_path.exists() or not file_path.is_file():
        sys.stderr.write(f"Error: file '{file_path}' tidak ditemukan.\n")
        return 1

    try:
        source = file_path.read_text(encoding="utf-8")
    except Exception as exc:
        sys.stderr.write(f"Error: gagal membaca file '{file_path}': {exc}\n")
        return 1

    normalized_source = normalize_smart_quotes(source)
    source_lines = normalized_source.splitlines()

    try:
        run_source(source, stdin=sys.stdin, stdout=sys.stdout)
        return 0
    except PseudoError as err:
        sys.stderr.write(err.format_error(source_lines) + "\n")
        return 1
    except KeyboardInterrupt:
        sys.stderr.write("\nEksekusi program dihentikan oleh pengguna.\n")
        return 1
    except Exception as exc:
        # Jaring pengaman terakhir: jangan pernah tampilkan Python traceback ke pemakai!
        sys.stderr.write(f"Error internal yang tidak terduga: {exc}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
