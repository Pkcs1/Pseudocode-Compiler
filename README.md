# Pseudocode Alpro 1 Interpreter

Interpreter untuk bahasa **Pseudocode Algoritma dan Pemrograman 1 (Alpro 1)** yang dibangun menggunakan Python murni (*standard library* saja, tanpa dependensi eksternal).

Proyek ini dirancang agar mahasiswa dapat langsung menulis dan menjalankan kode pseudocode sesuai notasi perkuliahan, lengkap dengan **pemeriksaan tipe data & kamus sebelum program jalan (*static type checking*)** serta **pesan kesalahan dalam Bahasa Indonesia** yang mudah dipahami.

---

## Fitur & Status Pengembangan

- [x] **Milestone 1 — Struktur Dasar & Angka:**
  - Struktur `program ... kamus ... algoritma ... endprogram`
  - Tipe data `integer` (64-bit signed, setara `int64` di Go) dan `real` (`float64`)
  - Deklarasi konstanta (`constant N : integer = 10`) dan variabel multi-nama (`a, b, c : integer`)
  - Instruksi `input(...)` (membaca token terpisah spasi/baris baru seperti `fmt.Scan` di Go) dan `output(...)`
  - Operasi aritmatika `+`, `-`, `*`, `/`, `div`, `mod`, dan pangkat `^`
- [x] **Milestone 2 — Tipe Lengkap & Semua Operator:**
  - Tipe data `string`, `boolean`, dan `char` (representasi kode ASCII/Unicode)
  - Operator perbandingan (`==`, `!=`, `<>`, `<`, `<=`, `>`, `>=`)
  - Operator logika (`not`, `and`, `or`) dengan evaluasi *short-circuit*
  - Operator bitwise (`<<`, `>>`, `&`, `|`) dengan prioritas setara bahasa Go
- [ ] **Milestone 3 — Percabangan (*Branching*):** `if ... then ... else ... endif`, `depend on`
- [ ] **Milestone 4 — Perulangan (*Looping*):** `for`, `while`, `repeat ... until`
- [ ] **Milestone 5 — Tipe Bentukan & Array:** `type ... < ... >`, array 1D/multi-dimensi
- [ ] **Milestone 6 — Subprogram:** `function` dan `procedure` (parameter `in`, `out`, `in/out`)

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

Contoh menjalankan program yang sudah tersedia di folder `tests/examples/`:

```bash
python pseudo.py tests/examples/jarak.pseudo
```

Masukkan input angka (misalnya `10 5` lalu tekan Enter), maka program akan mencetak:

```text
50
```

### 2. Contoh Kode Pseudocode (`suhu.pseudo`)

```text
program konversi_suhu
kamus
    constant faktor : real = 1.8
    c, f, r, k : real
algoritma
    input(c)
    r = c * 0.8
    f = c * faktor + 32
    k = c + 273.15
    output(r, f, k)
endprogram
```

### 3. Menjalankan Seluruh Pengujian (*Unit Tests*)

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
