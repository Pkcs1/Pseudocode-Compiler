"""
lexer.py
--------
Tahap 1: Lexer (atau Scanner / Tokenizer).

APA TUGAS FILE INI?
Membaca teks kode pseudocode huruf demi huruf dari awal sampai akhir, lalu
memecahnya menjadi potongan-potongan kecil bernama "Token".

Pada Milestone 2, Lexer sudah mendukung:
- Semua tipe dasar: integer, real, string, boolean, char
- Literal: angka (42, 3.14), string ("hello"), char ('k'), boolean (true, false)
- Fungsi bawaan: len
- Semua operator: +, -, *, /, div, mod, ^, <<, >>, &, |,
                  <, <=, >, >=, ==, !=, <>, not, and, or
"""

from dataclasses import dataclass
from errors import syntax_error


# Daftar kata kunci (keywords) pada Milestone 1 & 2.
# Semua kata kunci bersifat huruf kecil (lowercase) dan case-sensitive.
KEYWORDS = {
    "program": "PROGRAM",
    "kamus": "KAMUS",
    "algoritma": "ALGORITMA",
    "endprogram": "ENDPROGRAM",
    "input": "INPUT",
    "output": "OUTPUT",
    "integer": "TYPE_INTEGER",
    "real": "TYPE_REAL",
    "string": "TYPE_STRING",
    "boolean": "TYPE_BOOLEAN",
    "char": "TYPE_CHAR",
    "true": "BOOL_LIT",
    "false": "BOOL_LIT",
    "div": "DIV",
    "mod": "MOD",
    "not": "NOT",
    "and": "AND",
    "or": "OR",
    "len": "LEN",
    "constant": "CONSTANT",
    "type": "TYPE",
    "for": "FOR",
    "to": "TO",
    "step": "STEP",
    "do": "DO",
    "endfor": "ENDFOR",
}

# Operator dua karakter (harus dicek lebih dulu sebelum operator satu karakter!)
TWO_CHAR_TOKENS = {
    "<-": "ASSIGN",  # Mendukung gaya pengisian nilai '<-' selain '='
    "<<": "SHL",
    ">>": "SHR",
    "<=": "LE",
    ">=": "GE",
    "==": "EQ",
    "!=": "NEQ",
    "<>": "NEQ",  # "<>" artinya sama persis dengan "!="
}

# Simbol / operator satu karakter
SINGLE_CHAR_TOKENS = {
    "+": "PLUS",
    "-": "MINUS",
    "*": "STAR",
    "/": "SLASH",
    "^": "CARET",
    "&": "AMP",
    "|": "PIPE",
    "<": "LT",
    ">": "GT",
    "(": "LPAREN",
    ")": "RPAREN",
    "=": "ASSIGN",
    ":": "COLON",
    ",": "COMMA",
    ".": "DOT",
}


@dataclass
class Token:
    """
    Satu potong kata atau simbol dari kode sumber.
    - type  : jenis token (misal 'IDENTIFIER', 'INT_LIT', 'STRING_LIT', 'PLUS')
    - value : nilai aslinya (misal 'posisi', 42, 'hello', '+')
    - line  : nomor baris tempat token ini berada (dimulai dari 1)
    - col   : nomor kolom tempat token ini dimulai (dimulai dari 1)
    """
    type: str
    value: object
    line: int
    col: int


def normalize_smart_quotes(source: str) -> str:
    """
    Mengubah tanda kutip miring ("smart quotes" hasil copy-paste dari slide PPT)
    menjadi tanda kutip lurus biasa supaya tidak menyebabkan error.
    """
    return (
        source.replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2018", "'")
        .replace("\u2019", "'")
    )


def tokenize(source: str) -> list[Token]:
    """
    Fungsi utama Lexer: menerima seluruh teks program dan mengembalikan list[Token].
    """
    source = normalize_smart_quotes(source)
    lines = source.splitlines()
    tokens: list[Token] = []

    pos = 0
    length = len(source)
    line = 1
    col = 1

    def current_line_text(line_no: int) -> str:
        if 1 <= line_no <= len(lines):
            return lines[line_no - 1]
        return ""

    while pos < length:
        ch = source[pos]

        # 1. Lewati spasi, tab, dan pindah baris (newline)
        if ch == "\n":
            pos += 1
            line += 1
            col = 1
            continue

        if ch in (" ", "\t", "\r"):
            pos += 1
            col += 1
            continue

        # 2. KOMENTAR SEMENTARA (Diisolasi di satu tempat ini saja!)
        # Slide kuliah belum mendefinisikan sintaks komentar, jadi untuk sementara
        # kita mendukung "//" sampai akhir baris. Kalau nanti aturan kampus berubah,
        # cukup ubah blok "if" yang satu ini.
        if ch == "/" and pos + 1 < length and source[pos + 1] == "/":
            while pos < length and source[pos] != "\n":
                pos += 1
                col += 1
            continue

        # 3. Literal String: diawali dan diakhiri tanda petik dua (")
        if ch == '"':
            start_col = col
            pos += 1
            col += 1
            chars: list[str] = []
            while pos < length and source[pos] not in ('"', "\n", "\r"):
                # Dukungan escape sederhana bila ada \" atau \\ atau \n atau \t
                if source[pos] == "\\" and pos + 1 < length:
                    esc = source[pos + 1]
                    escape_map = {'"': '"', "\\": "\\", "n": "\n", "t": "\t"}
                    if esc in escape_map:
                        chars.append(escape_map[esc])
                        pos += 2
                        col += 2
                        continue
                chars.append(source[pos])
                pos += 1
                col += 1

            if pos >= length or source[pos] != '"':
                raise syntax_error(
                    'string tidak ditutup dengan tanda petik dua (\").',
                    line,
                    start_col,
                    current_line_text(line),
                )
            # Lewati tanda '"' penutup
            pos += 1
            col += 1
            tokens.append(Token("STRING_LIT", "".join(chars), line, start_col))
            continue

        # 4. Literal Karakter (char): diawali dan diakhiri tanda petik tunggal (')
        # Contoh: 'k' -> disimpan nilai kode ASCII/Unicode-nya (ord('k') = 107).
        if ch == "'":
            start_col = col
            pos += 1
            col += 1
            char_buf: list[str] = []
            while pos < length and source[pos] not in ("'", "\n", "\r"):
                if source[pos] == "\\" and pos + 1 < length:
                    esc = source[pos + 1]
                    escape_map = {"'": "'", "\\": "\\", "n": "\n", "t": "\t"}
                    if esc in escape_map:
                        char_buf.append(escape_map[esc])
                        pos += 2
                        col += 2
                        continue
                char_buf.append(source[pos])
                pos += 1
                col += 1

            if pos >= length or source[pos] != "'":
                raise syntax_error(
                    "karakter (char) tidak ditutup dengan tanda petik tunggal (').",
                    line,
                    start_col,
                    current_line_text(line),
                )
            pos += 1
            col += 1
            content = "".join(char_buf)
            if len(content) != 1:
                raise syntax_error(
                    f"literal char harus berisi tepat 1 karakter, bukan '{content}'.",
                    line,
                    start_col,
                    current_line_text(line),
                )
            tokens.append(Token("CHAR_LIT", ord(content), line, start_col))
            continue

        # 5. Angka (Literal Integer atau Real, contoh: 42 atau 3.14)
        if ch.isdigit():
            start_col = col
            num_str = ""
            while pos < length and source[pos].isdigit():
                num_str += source[pos]
                pos += 1
                col += 1

            # Cek apakah ada titik desimal diikuti angka (berarti tipe real)
            if pos < length and source[pos] == ".":
                if pos + 1 < length and source[pos + 1].isdigit():
                    num_str += "."
                    pos += 1
                    col += 1
                    while pos < length and source[pos].isdigit():
                        num_str += source[pos]
                        pos += 1
                        col += 1
                    tokens.append(Token("REAL_LIT", float(num_str), line, start_col))
                else:
                    raise syntax_error(
                        f"angka desimal '{num_str}.' tidak valid (harus ada angka di belakang titik).",
                        line,
                        start_col,
                        current_line_text(line),
                    )
            else:
                tokens.append(Token("INT_LIT", int(num_str), line, start_col))
            continue

        # 6. Kata Kunci (Keyword) atau Nama Variabel/Program (Identifier)
        if ch.isalpha() or ch == "_":
            start_col = col
            ident = ""
            while pos < length and (source[pos].isalnum() or source[pos] == "_"):
                ident += source[pos]
                pos += 1
                col += 1

            token_type = KEYWORDS.get(ident, "IDENTIFIER")
            if token_type == "BOOL_LIT":
                tokens.append(Token("BOOL_LIT", ident == "true", line, start_col))
            else:
                tokens.append(Token(token_type, ident, line, start_col))
            continue

        # 7. Simbol / Operator 2 Karakter (<<, >>, <=, >=, ==, !=, <>)
        if pos + 1 < length and source[pos : pos + 2] in TWO_CHAR_TOKENS:
            two_ch = source[pos : pos + 2]
            tokens.append(Token(TWO_CHAR_TOKENS[two_ch], two_ch, line, col))
            pos += 2
            col += 2
            continue

        # 8. Simbol / Operator 1 Karakter (+, -, *, /, ^, &, |, <, >, (, ), =, :, ,)
        if ch in SINGLE_CHAR_TOKENS:
            tokens.append(Token(SINGLE_CHAR_TOKENS[ch], ch, line, col))
            pos += 1
            col += 1
            continue

        # 9. Jika karakter tidak cocok dengan aturan mana pun di atas, laporkan error!
        raise syntax_error(
            f"karakter '{ch}' tidak dikenal di dalam pseudocode.",
            line,
            col,
            current_line_text(line),
        )

    # Tambahkan penanda akhir file (EOF = End Of File) supaya Parser tahu kapan harus berhenti.
    if tokens:
        last_tok = tokens[-1]
        eof_line = last_tok.line
        eof_col = last_tok.col + len(str(last_tok.value))
    else:
        eof_line = 1
        eof_col = 1
    tokens.append(Token("EOF", None, eof_line, eof_col))
    return tokens
