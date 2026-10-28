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


class TestMilestone4(unittest.TestCase):
    def test_example_3_renang(self):
        """Uji contoh wajib #3: program Renang (3 50 60 55 -> 250, 300, 275)."""
        ex_dir = ROOT_DIR / "tests" / "examples"
        source = (ex_dir / "renang.pseudo").read_text(encoding="utf-8")
        inp = (ex_dir / "renang.in").read_text(encoding="utf-8")
        expected = (ex_dir / "renang.out").read_text(encoding="utf-8").strip()

        actual = execute_program(source, inp).strip()
        self.assertEqual(actual, expected)

    def test_slide_cetak_barisan(self):
        """Uji contoh Slide Week 5&6: program Cetak_Barisan."""
        ex_dir = ROOT_DIR / "tests" / "examples"
        source = (ex_dir / "cetak_barisan.pseudo").read_text(encoding="utf-8")
        inp = (ex_dir / "cetak_barisan.in").read_text(encoding="utf-8")
        expected = (ex_dir / "cetak_barisan.out").read_text(encoding="utf-8").strip()

        actual = execute_program(source, inp).strip()
        self.assertEqual(actual, expected)

    def test_for_zero_iterations_and_bounds_evaluated_once(self):
        """Uji jika init > end badan for jalan 0 kali, dan batas dievaluasi 1 kali saja."""
        code = """
        program UjiForKhusus
        kamus
            i, n, hitung : integer
        algoritma
            hitung <- 0
            // init (5) > end (1), harus jalan 0 kali!
            for i <- 5 to 1 do
                hitung <- hitung + 100
            endfor

            // n diubah di dalam loop, tetapi batas akhir tetap 3 (dievaluasi sekali di awal)
            n <- 3
            for i = 1 to n do
                hitung <- hitung + 1
                n <- 100
            endfor
            output(hitung)
        endprogram
        """
        self.assertEqual(execute_program(code).strip(), "3")

    def test_error_missing_endfor_and_invalid_counter(self):
        """Uji error lupa endfor (Sintaks) dan variabel counter bukan integer / belum dideklarasikan."""
        code_no_endfor = """program TesFor
kamus
    i : integer
algoritma
    for i = 1 to 5 do
        output(i)
endprogram"""
        with self.assertRaises(PseudoError) as ctx1:
            execute_program(code_no_endfor)
        self.assertEqual(ctx1.exception.category, KATEGORI_SINTAKS)

        code_undecl_counter = """program TesFor2
kamus
    n : integer
algoritma
    for i = 1 to 5 do
        output(1)
    endfor
endprogram"""
        with self.assertRaises(PseudoError) as ctx2:
            execute_program(code_undecl_counter)
        self.assertEqual(ctx2.exception.category, KATEGORI_SEMAN)

        code_real_counter = """program TesFor3
kamus
    i : real
algoritma
    for i = 1 to 5 do
        output(i)
    endfor
endprogram"""
        with self.assertRaises(PseudoError) as ctx3:
            execute_program(code_real_counter)
        self.assertEqual(ctx3.exception.category, KATEGORI_SEMAN)

    def test_for_with_step_up_down_and_errors(self):
        """Uji perulangan for dengan step positif, step negatif, dan error step 0 / bukan integer."""
        code_step_up = """
        program UjiStepNaik
        kamus
            i, a, b, k : integer
        algoritma
            input(a, b, k)
            for i <- a to b step k do
                output(i)
            endfor
        endprogram
        """
        self.assertEqual(
            execute_program(code_step_up, "1 10 3").strip().splitlines(),
            ["1", "4", "7", "10"],
        )

        code_step_down = """
        program UjiStepTurun
        kamus
            i : integer
        algoritma
            for i = 10 to 2 step -3 do
                output(i)
            endfor
        endprogram
        """
        self.assertEqual(
            execute_program(code_step_down).strip().splitlines(),
            ["10", "7", "4"],
        )

        # Step 0 harus menghasilkan runtime error
        code_step_zero = """program TesStepNol
kamus
    i : integer
algoritma
    for i = 1 to 5 step 0 do
        output(i)
    endfor
endprogram"""
        with self.assertRaises(PseudoError) as ctx_zero:
            execute_program(code_step_zero)
        self.assertEqual(ctx_zero.exception.category, KATEGORI_RUNTIME)

        # Step bertipe real harus menghasilkan semantic error
        code_step_real = """program TesStepReal
kamus
    i : integer
algoritma
    for i = 1 to 5 step 1.5 do
        output(i)
    endfor
endprogram"""
        with self.assertRaises(PseudoError) as ctx_real:
            execute_program(code_step_real)
        self.assertEqual(ctx_real.exception.category, KATEGORI_SEMAN)


class TestMilestone5(unittest.TestCase):
    def run_example_file(self, filename: str, input_text: str) -> str:
        ex_path = ROOT_DIR / "tests" / "examples" / filename
        source = ex_path.read_text(encoding="utf-8")
        return execute_program(source, input_text).strip()

    def test_latihan_week2(self):
        """Uji seluruh Latihan Soal dari Slide Minggu 2 (No. 1 s.d. 5)."""
        # 1. Persegi Panjang
        self.assertEqual(self.run_example_file("latihan_w2_1_persegi_panjang.pseudo", "2 2"), "8 4")
        self.assertEqual(self.run_example_file("latihan_w2_1_persegi_panjang.pseudo", "70 20"), "180 1400")
        self.assertEqual(self.run_example_file("latihan_w2_1_persegi_panjang.pseudo", "5 46"), "102 230")

        # 2. Lingkaran
        self.assertEqual(
            self.run_example_file("latihan_w2_2_lingkaran.pseudo", "5").splitlines(),
            ["78.5", "31.400000000000002"],
        )
        self.assertEqual(
            self.run_example_file("latihan_w2_2_lingkaran.pseudo", "10").splitlines(),
            ["314", "62.800000000000004"],
        )

        # 3. Fungsi F(x, y)
        self.assertAlmostEqual(
            float(self.run_example_file("latihan_w2_3_fungsi.pseudo", "2 2")),
            27.045454545454547,
            places=12,
        )
        self.assertAlmostEqual(
            float(self.run_example_file("latihan_w2_3_fungsi.pseudo", "70 20")),
            207.00006798096533,
            places=12,
        )
        self.assertAlmostEqual(
            float(self.run_example_file("latihan_w2_3_fungsi.pseudo", "5 46")),
            467.01176470588234,
            places=12,
        )

        # 4. Digit
        self.assertEqual(self.run_example_file("latihan_w2_4_digit.pseudo", "444"), "4 4 4")
        self.assertEqual(self.run_example_file("latihan_w2_4_digit.pseudo", "1"), "0 0 1")
        self.assertEqual(self.run_example_file("latihan_w2_4_digit.pseudo", "546"), "5 4 6")

        # 5. Toko (Keuntungan 5%)
        self.assertEqual(self.run_example_file("latihan_w2_5_toko.pseudo", "1000 2000 3000"), "1050 2100 3150")
        self.assertEqual(self.run_example_file("latihan_w2_5_toko.pseudo", "123 456 135"), "129.15 478.8 141.75")
        self.assertEqual(self.run_example_file("latihan_w2_5_toko.pseudo", "5 7 2"), "5.25 7.35 2.1")

    def test_latihan_week3(self):
        """Uji seluruh Latihan Soal dari Slide Minggu 3 (No. 1 s.d. 4)."""
        # 1. Ganjil
        self.assertEqual(self.run_example_file("latihan_w3_1_ganjil.pseudo", "7"), "true")
        self.assertEqual(self.run_example_file("latihan_w3_1_ganjil.pseudo", "10"), "false")

        # 2. Cumlaude
        self.assertEqual(self.run_example_file("latihan_w3_2_cumlaude.pseudo", "7 520"), "true")
        self.assertEqual(self.run_example_file("latihan_w3_2_cumlaude.pseudo", "10 573"), "false")

        # 3. Digit Terurut (Mengecil)
        self.assertEqual(self.run_example_file("latihan_w3_3_digit_terurut.pseudo", "530"), "true")
        self.assertEqual(self.run_example_file("latihan_w3_3_digit_terurut.pseudo", "555"), "false")

        # 4. Terurut 2 (Membesar atau Mengecil)
        self.assertEqual(self.run_example_file("latihan_w3_4_terurut2.pseudo", "149"), "true")
        self.assertEqual(self.run_example_file("latihan_w3_4_terurut2.pseudo", "555"), "false")
        self.assertEqual(self.run_example_file("latihan_w3_4_terurut2.pseudo", "961"), "true")
        self.assertEqual(self.run_example_file("latihan_w3_4_terurut2.pseudo", "183"), "false")

    def test_latihan_week4(self):
        """Uji seluruh Latihan Soal dari Slide Minggu 4 (No. 1 s.d. 5)."""
        # 1. Transaksi
        self.assertEqual(self.run_example_file("latihan_w4_1_transaksi.pseudo", "Pensil 20 2000"), "40000")

        # 2. Persegi Panjang (Struct)
        self.assertEqual(self.run_example_file("latihan_w4_2_persegi_panjang.pseudo", "10.0 5.0"), "50 30")

        # 3. BMI
        bmi_out = float(self.run_example_file("latihan_w4_3_bmi.pseudo", "Andi 70.0 1.75"))
        self.assertAlmostEqual(bmi_out, 22.86, delta=0.01)

        # 4. Gaji Karyawan
        self.assertEqual(
            self.run_example_file("latihan_w4_4_gaji.pseudo", "Budi 5000000 1000000 500000"),
            "5500000",
        )

        # 5. Investasi Saham
        self.assertEqual(
            self.run_example_file("latihan_w4_5_saham.pseudo", "10000 12000 100"),
            "177600",
        )

    def test_latihan_week5_and_6(self):
        """Uji seluruh Latihan Soal dari Slide Minggu 5 & 6 (No. 1 s.d. 9)."""
        # 1. Cetak Teks
        self.assertEqual(
            self.run_example_file("latihan_w5_1_cetak_teks.pseudo", "3\nHEI").splitlines(),
            ["HEI", "HEI", "HEI"],
        )
        self.assertEqual(self.run_example_file("latihan_w5_1_cetak_teks.pseudo", "0\nhaha"), "")

        # 2. Kue
        self.assertEqual(
            self.run_example_file("latihan_w5_2_kue.pseudo", "2\n100\n150").splitlines(),
            ["1000", "1500"],
        )

        # 3. Perkalian Indeks
        self.assertEqual(
            self.run_example_file("latihan_w5_3_perkalian.pseudo", "5\n3 7 1 4 2").splitlines(),
            ["3", "14", "3", "16", "10"],
        )

        # 4. Olahraga (7 hari)
        inp_olahraga = "2\n1000 1500 2000 1200 1300 1700 1800\n900 1100 1300 1400 1500 1600 1700"
        self.assertEqual(
            self.run_example_file("latihan_w5_4_olahraga.pseudo", inp_olahraga).splitlines(),
            ["10500", "9500"],
        )

        # 5. Sandi
        self.assertEqual(self.run_example_file("latihan_w5_5_sandi.pseudo", "3\n2022 4321 5578"), "22")
        self.assertEqual(self.run_example_file("latihan_w5_5_sandi.pseudo", "3\n1111 2222 3333"), "12")

        # 6. Bidang Persegi
        self.assertEqual(
            self.run_example_file("latihan_w5_6_persegi.pseudo", "3\n5\n4\n7").splitlines(),
            ["25 20", "16 16", "49 28"],
        )

        # 7. Koding (Rata-rata)
        koding_out = float(self.run_example_file("latihan_w5_7_koding.pseudo", "7\n8 5 6 5 4 5 6"))
        self.assertAlmostEqual(koding_out, 5.571, delta=0.01)

        # 8. Faktorial
        self.assertEqual(self.run_example_file("latihan_w5_8_faktorial.pseudo", "5"), "120")
        self.assertEqual(self.run_example_file("latihan_w5_8_faktorial.pseudo", "1"), "1")
        self.assertEqual(self.run_example_file("latihan_w5_8_faktorial.pseudo", "10"), "3628800")

        # 9. Faktor Bilangan
        self.assertEqual(
            self.run_example_file("latihan_w5_9_faktor.pseudo", "5").splitlines(),
            ["1 true", "2 false", "3 false", "4 false", "5 true"],
        )

    def test_flexible_use_cases_outside_slides(self):
        """
        Uji fleksibilitas bahasa di luar soal-soal slide:
        1. 'x<-5' tanpa spasi di dalam ekspresi tetap terbaca sebagai 'x < -5'.
        2. Program tanpa variabel di kamus (kamus kosong).
        3. Struct yang memiliki beberapa field bertipe struct lain (nested geometri) & salinan independen.
        4. Perulangan for bersarang (nested for) dengan variabel pencacah bertipe alias,
           menghitung mundur secara tidak langsung, dan operasi sandi geser karakter (Caesar Cipher).
        """
        # 1. Disambiguasi '<-' sebagai assignment vs '< -' sebagai perbandingan negatif tanpa spasi
        code_arrow_cmp = """
        program UjiFleksibelPanah
        kamus
            x : integer
            status1, status2 : boolean
        algoritma
            x <- -10
            status1 <- x<-5
            status2 <- x<-15 + 2
            output(status1, status2)
        endprogram
        """
        self.assertEqual(execute_program(code_arrow_cmp).strip(), "true false")

        # 2. Kamus kosong (langsung mencetak perhitungan literal & string)
        code_empty_kamus = """
        program KamusKosong
        kamus
        algoritma
            output("Halo" + " " + "Alpro", len("Telkom"), 2 ^ 10)
        endprogram
        """
        self.assertEqual(execute_program(code_empty_kamus).strip(), "Halo Alpro 6 1024")

        # 3. Komposisi struct geometri (struct garis berisi 2 struct titik) + jarak kuadrat
        code_geometry = """
        program GeometriGaris
        kamus
            type koordinat : integer
            type titik <
                x, y : koordinat
            >
            type garis <
                awal, akhir : titik
            >
            g1, g2 : garis
            dx, dy, jarak_kuadrat : koordinat
        algoritma
            g1.awal.x <- 1
            g1.awal.y <- 2
            g1.akhir.x <- 4
            g1.akhir.y <- 6

            // Salin seluruh garis g1 ke g2, lalu geser titik akhir g2
            g2 <- g1
            g2.akhir.x <- 10

            dx <- g1.akhir.x - g1.awal.x
            dy <- g1.akhir.y - g1.awal.y
            jarak_kuadrat <- (dx ^ 2) + (dy ^ 2)
            output(jarak_kuadrat, g1.akhir.x, g2.akhir.x)
        endprogram
        """
        self.assertEqual(execute_program(code_geometry).strip(), "25 4 10")

        # 4. Nested for loop + Caesar Cipher karakter + akumulasi matriks
        code_nested_and_cipher = """
        program UjiNestedDanCipher
        kamus
            type indeks : integer
            baris, kolom, total_sel, geser : indeks
            huruf_awal, huruf_sandi : char
        algoritma
            total_sel <- 0
            for baris <- 1 to 3 do
                for kolom <- 1 to 4 do
                    total_sel <- total_sel + (baris * kolom)
                endfor
            endfor

            // Geser karakter 'Y' sejauh 3 huruf secara melingkar (Y -> Z -> A -> B)
            huruf_awal <- 'Y'
            geser <- 3
            huruf_sandi <- ((huruf_awal - 'A' + geser) mod 26) + 'A'
            output(total_sel, huruf_sandi)
        endprogram
        """
        self.assertEqual(execute_program(code_nested_and_cipher).strip(), "60 B")


if __name__ == "__main__":
    unittest.main()
