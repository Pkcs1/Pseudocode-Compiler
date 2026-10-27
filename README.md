# Pseudocode Alpro 1 Interpreter

Interpreter untuk bahasa **Pseudocode Algoritma dan Pemrograman 1 (Alpro 1)** yang dibangun menggunakan Python murni (*standard library* saja, tanpa dependensi eksternal).

Proyek ini dirancang agar mahasiswa dapat langsung menulis dan menjalankan kode pseudocode sesuai notasi perkuliahan, lengkap dengan **pemeriksaan tipe data & kamus sebelum program jalan (*static type checking*)** serta **pesan kesalahan dalam Bahasa Indonesia** yang mudah dipahami.

---

## Fitur & Status Pengembangan

- [x] **Milestone 1 — Struktur Dasar, Variabel, Input/Output, dan Aritmatika Angka:**
  - Struktur `program ... kamus ... algoritma ... endprogram`
  - Tipe data `integer` (64-bit signed, setara `int64` di Go) dan `real` (`float64`)
  - Deklarasi variabel multi-nama (`a, b, c : integer`)
  - Instruksi `input(...)` (membaca token terpisah spasi/baris baru seperti `fmt.Scan` di Go) dan `output(...)`
  - Operasi aritmatika `+`, `-`, `*`, `/`, `div`, `mod`, dan pangkat `^`
- [x] **Milestone 2 — Tipe `string`, `boolean`, `char`, serta Seluruh Operator (Level 1–9):**
  - Tipe data `string`, `boolean`, dan `char` (representasi kode ASCII/Unicode)
  - Fungsi bawaan `len(s)` untuk menghitung panjang `string`
  - Operator perbandingan (`==`, `!=`, `<>`, `<`, `<=`, `>`, `>=`)
  - Operator logika (`not`, `and`, `or`) dengan evaluasi *short-circuit*
  - Operator bitwise (`<<`, `>>`, `&`, `|`) dengan prioritas setara bahasa Go
- [x] **Milestone 3 — Konstanta (`constant`), Tipe Alias, dan Tipe Bentukan Struct:**
  - Deklarasi konstanta (`constant PI : real = 3.14`)
  - Deklarasi tipe alias (`type bilangan : integer`)
  - Deklarasi tipe bentukan struct (`type date < tanggal : integer ... >`) dengan urutan deklarasi bebas di dalam `kamus`
  - Akses field menggunakan titik (`tgl.tanggal`, termasuk struct bersarang) dan penyalinan nilai struct (*copy semantics*)
  - Dukungan operator pengisian nilai baik menggunakan `=` maupun panah `<-`
- [x] **Milestone 4 — Perulangan `for ... to ... do ... endfor`:**
  - Perulangan pencacah naik `for i = init to end do ... endfor` (batas dievaluasi satu kali di awal, mendukung perulangan bersarang)
- [ ] **Selanjutnya (In Progress):**
  - Perulangan `while ... do ... endwhile` dan `repeat ... until`
  - Percabangan (`if ... then ... else ... endif`, `depend on`)
  - Array & Subprogram (`function`, `procedure`)

Catatan keputusan semantik selengkapnya dapat dilihat di [`docs/DECISIONS.md`](docs/DECISIONS.md).

---

## Persyaratan Sistem

- **Python 3.10+** (tidak memerlukan `pip install` paket tambahan apa pun).

---

## Cara Penggunaan

### 1. Menjalankan File Pseudocode

```bash
python pseudo.py <path_ke_file.pseudo>
```

Contoh menjalankan program yang tersedia di folder `tests/examples/`:

```bash
python pseudo.py tests/examples/tabung_properti.pseudo
```

Masukkan input jari-jari dan tinggi (misalnya `7 10` lalu tekan Enter), maka program akan mencetak luas dinding, luas permukaan, dan volume tabung:

```text
439.6 747.32 1538.6
```

### 2. Daftar Contoh Program (`tests/examples/`)

| File | Fitur yang Dicontohkan |
| :--- | :--- |
| `jarak.pseudo` | Variabel `integer`, operasi aritmatika dasar, `input` & `output` |
| `suhu.pseudo` | Tipe `real`, deklarasi `constant`, konversi implisit `integer` ke `real` |
| `bilangan.pseudo` | Tipe `boolean`, operator `div`, `mod`, perbandingan, dan logika `and` |
| `rahasia.pseudo` | Tipe `char` (kode ASCII) dan operasi bitwise (`>>`, `<<`, `&`, `\|`) |
| `contoh_struktur.pseudo` | Tipe alias (`type bilangan : integer`) dan struct (`type date < ... >`) |
| `tabung_properti.pseudo` | Perhitungan geometri menggunakan `constant` dan field struct (`t.volume`) |
| `cetak_barisan.pseudo` | Perulangan `for j = 1 to n do ... endfor` |
| `renang.pseudo` | Akumulasi nilai di dalam perulangan `for` |

### 3. Contoh Kode Pseudocode (Struct & Perulangan `for`)

```text
program jadwal_renang
kamus
    n, i, waktu, total : integer
algoritma
    input(n)
    total = 0
    for i = 1 to n do
        input(waktu)
        total = total + waktu
    endfor
    output(total)
endprogram
```

### 4. Menjalankan Seluruh Pengujian (*Unit Tests*)

```bash
python -m unittest discover -s tests -p "test_*.py" -v
```

---

## Arsitektur Proyek

Interpreter ini dibagi menjadi 4 tahapan berurutan yang bersih dan terpisah:

```text
File .pseudo ──► [1. Lexer] ──► [2. Parser] ──► [3. Checker] ──► [4. Interpreter]
```

| File | Peran |
| :--- | :--- |
| `pseudo.py` | Pintu masuk utama (*Command-Line Interface* / CLI) yang menghubungkan keempat tahap. |
| `lexer.py` | **Tahap 1 (Lexer):** Memecah teks kode sumber menjadi deretan token berbaris & berkolom. |
| `ast_nodes.py` | Definisi struktur data pohon sintaks abstrak (*Abstract Syntax Tree* / AST). |
| `parser.py` | **Tahap 2 (Parser):** Mengubah deretan token menjadi pohon AST sesuai tata bahasa pseudocode. |
| `checker.py` | **Tahap 3 (Semantic & Type Checker):** Memeriksa kelengkapan deklarasi di `kamus` dan kecocokan tipe data **sebelum** program dieksekusi. |
| `interpreter.py` | **Tahap 4 (Interpreter):** Mengeksekusi pohon AST baris demi baris dan menangani I/O. |
| `errors.py` | Pemformat pesan kesalahan sintaks, tipe/kamus, dan *runtime* dalam Bahasa Indonesia. |
| `docs/DECISIONS.md` | Dokumentasi keputusan desain dan aturan semantik bahasa. |
| `tests/` | Kumpulan *unit test* (`test_all.py`) dan contoh program (`.pseudo`, `.in`, `.out`). |
