"""
tests/test_all.py
-----------------
Kumpulan pengujian otomatis (unit tests) menggunakan modul bawaan 'unittest' Python.
Pada Milestone 1, kita menguji:
1. Contoh program wajib #1 (Jarak) dan #6 (Suhu).
2. Operasi aritmatika integer & real (+, -, *, /, div, mod, ^, tanda kurung, unary -).
3. Wrap-around integer 64-bit.
4. Pesan error Bahasa Indonesia untuk sintaks, kamus/tipe, dan runtime pada M1.
"""

import io
import subprocess
import sys
import unittest
from pathlib import Path

# Pastikan folder utama proyek bisa di-import
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from errors import KATEGORI_RUNTIME, KATEGORI_SEMAN, KATEGORI_SINTAKS, PseudoError
from pseudo import run_source


def execute_program(source: str, input_text: str = "") -> str:
    """Menjalankan kode pseudocode di memori dan mengembalikan teks hasil output-nya."""
    stdin_buf = io.StringIO(input_text)
    stdout_buf = io.StringIO()
    run_source(source, stdin=stdin_buf, stdout=stdout_buf)
    return stdout_buf.getvalue()


class TestMilestone1(unittest.TestCase):
    def test_example_1_jarak(self):
        """Uji contoh wajib #1: program Jarak."""
        ex_dir = ROOT_DIR / "tests" / "examples"
        source = (ex_dir / "jarak.pseudo").read_text(encoding="utf-8")
        inp = (ex_dir / "jarak.in").read_text(encoding="utf-8")
        expected = (ex_dir / "jarak.out").read_text(encoding="utf-8").strip()

        actual = execute_program(source, inp).strip()
        self.assertEqual(actual, expected)

    def test_example_6_suhu(self):
        """Uji contoh wajib #6: program Suhu dengan toleransi 0.01."""
        ex_dir = ROOT_DIR / "tests" / "examples"
        source = (ex_dir / "suhu.pseudo").read_text(encoding="utf-8")
        inp = (ex_dir / "suhu.in").read_text(encoding="utf-8")
        expected_parts = [
            float(x)
            for x in (ex_dir / "suhu.out").read_text(encoding="utf-8").split()
        ]

        actual_out = execute_program(source, inp).strip()
        actual_parts = [float(x) for x in actual_out.split()]
        self.assertEqual(len(actual_parts), len(expected_parts))
        for act, exp in zip(actual_parts, expected_parts):
            self.assertAlmostEqual(act, exp, delta=0.01)

    def test_integer_div_mod_and_power(self):
        """Uji div, mod (termasuk angka negatif ala Go), dan pangkat right-associative."""
        code = """
        // Komentar satu baris harus diabaikan
        program UjiMatematika
        kamus
            a, b, c, d, p : integer
        algoritma
            a = 71 div 21
            b = 71 mod 21
            c = -7 div 2
            d = -7 mod 2
            p = 2 ^ 3 ^ 2
            output(a, b, c, d, p)
        endprogram
        """
        out = execute_program(code).strip()
        self.assertEqual(out, "3 8 -3 -1 512")

    def test_real_formatting_like_go(self):
        """Uji format angka real seperti fmt.Println di Go (314.0 -> 314, 3.14 -> 3.14)."""
        code = """
        program UjiReal
        kamus
            r, luas, keliling : real
        algoritma
            input(r)
            luas = 3.14 * r * r
            keliling = 2 * 3.14 * r
            output(luas)
            output(keliling)
        endprogram
        """
        out_5 = execute_program(code, "5").strip().splitlines()
        self.assertEqual(out_5, ["78.5", "31.400000000000002"])

        out_10 = execute_program(code, "10").strip().splitlines()
        self.assertEqual(out_10, ["314", "62.800000000000004"])

    def test_int64_overflow_wrap_around(self):
        """Uji wrap-around pada batas atas 64-bit signed integer."""
        code = """
        program Overflow
        kamus
            x : integer
        algoritma
            x = 9223372036854775807
            x = x + 1
            output(x)
        endprogram
        """
        out = execute_program(code).strip()
        self.assertEqual(out, "-9223372036854775808")

    def test_error_missing_keywords(self):
        """Uji error jika kamus, algoritma, atau endprogram hilang."""
        for bad_code in [
            "program Tes\n x : integer\nalgoritma\nendprogram",
            "program Tes\nkamus\n x : integer\nendprogram",
            "program Tes\nkamus\n x : integer\nalgoritma\n output(1)",
        ]:
            with self.assertRaises(PseudoError) as ctx:
                execute_program(bad_code)
            self.assertEqual(ctx.exception.category, KATEGORI_SINTAKS)

    def test_error_unexpected_character(self):
        """Uji error karakter tidak dikenal di Lexer."""
        code = """program Tes
kamus
    x : integer
algoritma
    x = 10 @ 2
endprogram"""
        with self.assertRaises(PseudoError) as ctx:
            execute_program(code)
        self.assertEqual(ctx.exception.category, KATEGORI_SINTAKS)
        self.assertEqual(ctx.exception.line, 5)
        formatted = ctx.exception.format_error(code.splitlines())
        self.assertIn("^", formatted)

    def test_error_undeclared_variable_and_unknown_type(self):
        """Uji error variabel belum dideklarasikan & tipe tidak dikenal."""
        code_undecl = """program Tes
kamus
    y : integer
algoritma
    y = 1
    x = y + 1
endprogram"""
        with self.assertRaises(PseudoError) as ctx:
            execute_program(code_undecl)
        self.assertEqual(ctx.exception.category, KATEGORI_SEMAN)
        self.assertEqual(ctx.exception.line, 6)

        code_bad_type = """program Tes
kamus
    x : angka_ajaib
algoritma
endprogram"""
        with self.assertRaises(PseudoError) as ctx2:
            execute_program(code_bad_type)
        self.assertEqual(ctx2.exception.category, KATEGORI_SEMAN)
        self.assertEqual(ctx2.exception.line, 3)

    def test_error_real_assigned_to_integer(self):
        """Uji error memasukkan nilai real ke variabel integer."""
        code = """program Tes
kamus
    x : integer
algoritma
    x = 4 / 5
endprogram"""
        with self.assertRaises(PseudoError) as ctx:
            execute_program(code)
        self.assertEqual(ctx.exception.category, KATEGORI_SEMAN)

    def test_runtime_errors_uninitialized_divzero_input(self):
        """Uji error runtime: variabel belum diisi, bagi nol, input habis, input bukan angka."""
        # 1. Variabel belum diisi
        code_uninit = """program Tes
kamus
    x, y : integer
algoritma
    x = y + 1
endprogram"""
        with self.assertRaises(PseudoError) as ctx1:
            execute_program(code_uninit)
        self.assertEqual(ctx1.exception.category, KATEGORI_RUNTIME)

        # 2. Pembagian dengan nol
        code_divzero = """program Tes
kamus
    x : real
algoritma
    x = 10 / 0
endprogram"""
        with self.assertRaises(PseudoError) as ctx2:
            execute_program(code_divzero)
        self.assertEqual(ctx2.exception.category, KATEGORI_RUNTIME)

        # 3. Input berakhir terlalu cepat
        code_in = """program Tes
kamus
    a, b : integer
algoritma
    input(a, b)
endprogram"""
        with self.assertRaises(PseudoError) as ctx3:
            execute_program(code_in, "42")
        self.assertEqual(ctx3.exception.category, KATEGORI_RUNTIME)

        # 4. Input bukan angka valid
        with self.assertRaises(PseudoError) as ctx4:
            execute_program(code_in, "42 bukan_angka")
        self.assertEqual(ctx4.exception.category, KATEGORI_RUNTIME)

    def test_cli_execution_and_error_exit_code(self):
        """Uji menjalankan python pseudo.py langsung dari command line."""
        jarak_file = ROOT_DIR / "tests" / "examples" / "jarak.pseudo"
        proc = subprocess.run(
            [sys.executable, str(ROOT_DIR / "pseudo.py"), str(jarak_file)],
            input="3 4 5\n",
            text=True,
            capture_output=True,
        )
        self.assertEqual(proc.returncode, 0)
        self.assertEqual(proc.stdout.strip(), "23")

    def test_edge_cases_review_m1(self):
        """Uji kasus-kasus khusus hasil review M1 (pangkat besar, duplikat kamus sebaris, input NaN/Inf, pangkat imajiner)."""
        # 1. Pangkat integer besar tidak membuat hang (modular 2^64)
        code_big_pow = """program PangkatBesar
kamus
    x : integer
algoritma
    x = 2 ^ 1000000
    output(x)
endprogram"""
        self.assertEqual(execute_program(code_big_pow).strip(), "0")

        # 2. Duplikat variabel di baris yang sama menunjuk kolom yang tepat
        code_dup = """program Duplikat
kamus
    a, b, a : integer
algoritma
endprogram"""
        with self.assertRaises(PseudoError) as ctx_dup:
            execute_program(code_dup)
        self.assertEqual(ctx_dup.exception.category, KATEGORI_SEMAN)
        self.assertEqual(ctx_dup.exception.col, 11)

        # 3. Input 'nan' atau 'inf' pada real harus ditolak sebagai bukan angka valid
        code_real_in = """program UjiNan
kamus
    r : real
algoritma
    input(r)
endprogram"""
        for bad_tok in ("nan", "inf", "-inf"):
            with self.assertRaises(PseudoError) as ctx_nan:
                execute_program(code_real_in, bad_tok)
            self.assertEqual(ctx_nan.exception.category, KATEGORI_RUNTIME)

        # 4. Bilangan negatif dipangkatkan pecahan (menghasilkan bilangan kompleks) harus error runtime
        code_complex = """program UjiKompleks
kamus
    r : real
algoritma
    r = (-4.0) ^ 0.5
endprogram"""
        with self.assertRaises(PseudoError) as ctx_comp:
            execute_program(code_complex)
        self.assertEqual(ctx_comp.exception.category, KATEGORI_RUNTIME)


class TestMilestone2(unittest.TestCase):
    def test_example_2_bilangan(self):
        """Uji contoh wajib #2: program bilangan (65 -> true, -85 -> false)."""
        ex_dir = ROOT_DIR / "tests" / "examples"
        source = (ex_dir / "bilangan.pseudo").read_text(encoding="utf-8")

        self.assertEqual(execute_program(source, "65").strip(), "true")
        self.assertEqual(execute_program(source, "-85").strip(), "false")

    def test_example_4_rahasia(self):
        """Uji contoh wajib #4: program rahasia (-981 21623 983 22152 1127 -> B a i k)."""
        ex_dir = ROOT_DIR / "tests" / "examples"
        source = (ex_dir / "rahasia.pseudo").read_text(encoding="utf-8")
        inp = (ex_dir / "rahasia.in").read_text(encoding="utf-8")
        expected = (ex_dir / "rahasia.out").read_text(encoding="utf-8").strip()

        actual = execute_program(source, inp).strip()
        self.assertEqual(actual, expected)

    def test_string_concat_and_len_and_smart_quotes(self):
        """Uji string concatenation (+), len(s), dan normalisasi smart quotes."""
        code = """
        program UjiString
        kamus
            s1, s2, gabung : string
            panjang : integer
        algoritma
            s1 = “hello”
            s2 = "world"
            gabung = s1 + " " + s2
            panjang = len(s1 + s2)
            output(gabung, panjang)
        endprogram
        """
        self.assertEqual(execute_program(code).strip(), "hello world 10")

    def test_char_literal_and_input_output(self):
        """Uji literal char 'k', operasi integer ke char, dan input/output char."""
        code = """
        program UjiChar
        kamus
            c1, c2, c3 : char
        algoritma
            input(c1)
            c2 = 'k'
            c3 = c1 + 1
            output(c1, c2, c3)
        endprogram
        """
        self.assertEqual(execute_program(code, "A").strip(), "A k B")

    def test_boolean_operators_precedence_and_short_circuit(self):
        """Uji prioritas not, and, or, perbandingan <>, serta evaluasi short-circuit."""
        code = """
        program UjiBool
        kamus
            a, b, c : boolean
            x, belum_diisi : integer
        algoritma
            x = 10
            // <> sama dengan !=
            a = (x <> 10) or (x == 10 and not false)
            // Short-circuit: sisi kanan (belum_diisi == 1 atau 1/0) TIDAK boleh dijalankan!
            b = false and (belum_diisi == 1)
            c = true or (1 / 0 == 1)
            output(a, b, c)
        endprogram
        """
        self.assertEqual(execute_program(code).strip(), "true false true")

    def test_bitwise_operators_and_precedence(self):
        """Uji operator bitwise <<, >>, &, | sesuai contoh Slide Week 2 (71 dan 21)."""
        code = """
        program UjiBitwise
        kamus
            a, b, r_shl, r_shr, r_and, r_or : integer
        algoritma
            a = 71
            b = 21
            r_shl = a << 2
            r_shr = a >> 2
            r_and = a & b
            r_or = a | b
            output(r_shl, r_shr, r_and, r_or)
        endprogram
        """
        self.assertEqual(execute_program(code).strip(), "284 17 5 87")

    def test_error_unterminated_string_and_char(self):
        """Uji error string tidak ditutup tanda petik dan char tidak valid."""
        bad_str = """program Tes
kamus
    s : string
algoritma
    s = "halo dunia
endprogram"""
        with self.assertRaises(PseudoError) as ctx1:
            execute_program(bad_str)
        self.assertEqual(ctx1.exception.category, KATEGORI_SINTAKS)
        self.assertEqual(ctx1.exception.line, 5)

        bad_char = """program Tes
kamus
    c : char
algoritma
    c = 'ab'
endprogram"""
        with self.assertRaises(PseudoError) as ctx2:
            execute_program(bad_char)
        self.assertEqual(ctx2.exception.category, KATEGORI_SINTAKS)


class TestMilestone3(unittest.TestCase):
    def test_example_5_contoh_struktur(self):
        """Uji contoh wajib #5: program contoh_struktur (Maret 2026 -> 20 lalu Maret 2026)."""
        ex_dir = ROOT_DIR / "tests" / "examples"
        source = (ex_dir / "contoh_struktur.pseudo").read_text(encoding="utf-8")
        inp = (ex_dir / "contoh_struktur.in").read_text(encoding="utf-8")
        expected = (ex_dir / "contoh_struktur.out").read_text(encoding="utf-8").strip()

        actual = execute_program(source, inp).strip()
        self.assertEqual(actual, expected)

    def test_slide_tabung_properti(self):
        """Uji contoh Slide Week 4: program TabungProperti dengan constant PI dan struct tabung."""
        ex_dir = ROOT_DIR / "tests" / "examples"
        source = (ex_dir / "tabung_properti.pseudo").read_text(encoding="utf-8")
        inp = (ex_dir / "tabung_properti.in").read_text(encoding="utf-8")
        expected = (ex_dir / "tabung_properti.out").read_text(encoding="utf-8").strip()

        actual = execute_program(source, inp).strip()
        self.assertEqual(actual, expected)

    def test_kamus_any_order_alias_nested_struct_and_copy(self):
        """Uji deklarasi kamus urutan bebas, alias, nested struct, dan penyalinan struct."""
        code = """
        program UjiStructLengkap
        kamus
            // Variabel dideklarasikan SEBELUM tipe struct & alias-nya!
            p1, p2 : paket
            constant PAJAK : desimal = 0.1
            type paket <
                kode : bilangan
                tgl_kirim : date
                biaya : desimal
            >
            type date <
                tanggal, tahun : bilangan
                bulan : string
            >
            type bilangan : integer
            type desimal : real
        algoritma
            p1.kode = 101
            p1.tgl_kirim.tanggal = 15
            p1.tgl_kirim.bulan = "Oktober"
            p1.tgl_kirim.tahun = 2026
            p1.biaya = 50000 + (50000 * PAJAK)

            // Salin struct p1 ke p2, lalu ubah p2 (p1 tidak boleh ikut berubah!)
            p2 = p1
            p2.tgl_kirim.tanggal = 20

            output(p1.kode, p1.tgl_kirim.tanggal, p2.tgl_kirim.tanggal, p1.biaya)
        endprogram
        """
        self.assertEqual(execute_program(code).strip(), "101 15 20 55000")

    def test_error_assign_to_constant(self):
        """Uji error saat mencoba mengubah nilai konstanta dengan '=' maupun 'input()'."""
        code_assign = """program TesKonst
kamus
    constant PI : real = 3.14
algoritma
    PI = 1000.0
endprogram"""
        with self.assertRaises(PseudoError) as ctx1:
            execute_program(code_assign)
        self.assertEqual(ctx1.exception.category, KATEGORI_SEMAN)
        self.assertEqual(ctx1.exception.line, 5)

        code_input = """program TesKonst2
kamus
    constant PI : real = 3.14
algoritma
    input(PI)
endprogram"""
        with self.assertRaises(PseudoError) as ctx2:
            execute_program(code_input, "3.14")
        self.assertEqual(ctx2.exception.category, KATEGORI_SEMAN)

    def test_error_unknown_struct_field_and_uninitialized_field(self):
        """Uji error field struct tidak dikenal (Checker) & field struct belum diisi (Interpreter)."""
        code_unknown_field = """program TesField
kamus
    type date <
        tanggal : integer
        bulan : string
    >
    tgl : date
algoritma
    tgl.hari_libur = 1
endprogram"""
        with self.assertRaises(PseudoError) as ctx1:
            execute_program(code_unknown_field)
        self.assertEqual(ctx1.exception.category, KATEGORI_SEMAN)
        self.assertEqual(ctx1.exception.line, 9)

        code_uninit_field = """program TesFieldBelumDiisi
kamus
    type date <
        tanggal : integer
        bulan : string
    >
    tgl : date
algoritma
    tgl.tanggal = 10
    output(tgl.bulan)
endprogram"""
        with self.assertRaises(PseudoError) as ctx2:
            execute_program(code_uninit_field)
        self.assertEqual(ctx2.exception.category, KATEGORI_RUNTIME)
        self.assertEqual(ctx2.exception.line, 10)

    def test_arrow_assign_operator(self):
        """Uji penggunaan tanda '<-' untuk pengisian nilai (assignment & constant)."""
        code = """
        program UjiPanah
        kamus
            constant BONUS : integer <- 10
            type kotak <
                isi : integer
            >
            k : kotak
            total : integer
        algoritma
            k.isi <- 25
            total <- k.isi + BONUS
            output(total)
        endprogram
        """
        self.assertEqual(execute_program(code).strip(), "35")


if __name__ == "__main__":
    unittest.main()
