# Pseudocode Compiler & Interpreter

Engine compiler dan interpreter berbasis Python untuk menganalisis, memeriksa validitas tipe (*semantic checking*), dan mengeksekusi bahasa *pseudocode* terstruktur. Proyek ini dilengkapi dengan antarmuka baris perintah (CLI), *interactive runner* dengan *streaming* I/O, serta antarmuka web modern (Web IDE).

Inti (*core engine*) dibangun tanpa dependensi eksternal — hanya menggunakan pustaka standar (*standard library*) Python.

---

## Daftar Isi
1. [Fitur Utama](#fitur-utama)
2. [Arsitektur & Pipeline Kompilasi](#arsitektur--pipeline-kompilasi)
3. [Prasyarat](#prasyarat)
4. [Cara Menjalankan](#cara-menjalankan)
   - [1. Command-Line Interface (CLI)](#1-command-line-interface-cli)
   - [2. Interactive Runner & AST Inspector](#2-interactive-runner--ast-inspector)
   - [3. Web IDE (Antarmuka Web)](#3-web-ide-antarmuka-web)
5. [Panduan Sintaks Pseudocode](#panduan-sintaks-pseudocode)
   - [Kerangka Program](#kerangka-program)
   - [Tipe Data Dasar](#tipe-data-dasar)
   - [Deklarasi pada Bagian Kamus](#deklarasi-pada-bagian-kamus)
   - [Instruksi pada Bagian Algoritma](#instruksi-pada-bagian-algoritma)
   - [Struktur Kontrol & Perulangan](#struktur-kontrol--perulangan)
   - [Operator & Tingkat Prioritas](#operator--tingkat-prioritas)
6. [Contoh Program](#contoh-program)
7. [Penanganan & Diagnostik Error](#penanganan--diagnostik-error)
8. [Struktur Proyek](#struktur-proyek)
9. [Pengujian Otomatis (Unit Testing)](#pengujian-otomatis-unit-testing)

---

## Fitur Utama

- **Pipeline Kompilasi Mandiri**: Memisahkan tahapan *Lexer*, *Parser*, *Semantic Checker*, dan *Runtime Interpreter* secara modular.
- **Pengecekan Tipe Statis (Static Semantic Analysis)**: Memvalidasi deklarasi variabel, kesesuaian tipe data, pencegahan modifikasi konstanta (*immutability*), dan integritas *field struct* sebelum kode dieksekusi.
- **Aritmatika Integer 64-bit**: Mengimplementasikan representasi *64-bit signed integer* dengan semantik *wrap-around* saat terjadi *overflow*.
- **I/O Fleksibel**: Pembacaan input multi-nilai berbasis *whitespace* (spasi/baris baru) dan pencetakan keluaran terformat.
- **Struktur Kontrol Lengkap**: Percabangan `if ... then ... else if ... else ... endif` serta perulangan `for` (dengan *step* positif/negatif), `while`, dan `repeat-until`.
- **Tipe Data Bentukan**: Mendukung alias tipe dan tipe bentukan rekaman (*struct*) multi-field.
- **Toleransi Format Teks**: Normalisasi otomatis karakter *smart quotes* (`“`, `”`, `‘`, `’`) serta simbol panah assignment (`<-` dan `←`).
- **Modern Web IDE**: Editor web interaktif berbasis Next.js dengan penyorotan kode, terminal interaktif real-time, visualisasi AST & tabel simbol, serta efek audio mekanik.

---

## Arsitektur & Pipeline Kompilasi

Setiap kode program diproses melalui 4 tahapan berurutan:

```
[ Kode Sumber (.pseudo) ]
           │
           ▼
┌─────────────────────────────────┐
│     1. Lexer (lexer.py)         │  Mengubah teks menjadi aliran Token, melacak nomor baris/kolom,
│                                 │  menormalisasi tanda kutip, dan mengabaikan komentar (// dan { }).
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│     2. Parser (parser.py)       │  Menerapkan Recursive-Descent Parsing dengan 9 tingkat prioritas
│                                 │  operator untuk membangun pohon sintaks abstrak (AST).
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│  3. Checker (checker.py)        │  Analisis Semantik Statis: memastikan semua variabel terdaftar,
│                                 │  menolak mutasi konstanta, dan mencocokkan tipe sebelum eksekusi.
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│ 4. Interpreter (interpreter.py) │  Mengeksekusi AST baris demi baris, mengelola memori runtime,
│                                 │  menangani I/O, serta membungkus nilai integer ke rentang 64-bit.
└────────────────┬────────────────┘
                 ▼
         [ Hasil Eksekusi ]
```

---

## Prasyarat

- **Python 3.10** atau versi lebih baru (wajib untuk *core compiler*).
- **Node.js 18+** & **npm** (opsional, hanya diperlukan jika ingin menjalankan Web IDE).

Periksa versi Python di terminal:

```bash
python --version
```

---

## Cara Menjalankan

### 1. Command-Line Interface (CLI)

Jalankan file berekstensi `.pseudo` menggunakan skrip utama `pseudo.py`:

```bash
python pseudo.py contoh.pseudo
```

Jika program meminta masukan (`input`), ketik nilai di terminal lalu tekan **Enter**. Anda juga dapat mengarahkan masukan dari file teks (*stdin redirection*):

```bash
python pseudo.py contoh.pseudo < input.txt
```

### 2. Interactive Runner & AST Inspector

Compiler menyertakan utilitas `interactive_runner.py` untuk integrasi lingkungan interaktif dan inspeksi struktur internal program.

Melihat tabel token, pohon AST, dan tabel simbol tanpa mengeksekusi program:

```bash
python interactive_runner.py --inspect contoh.pseudo
```

### 3. Web IDE (Antarmuka Web)

Untuk menjalankan antarmuka web interaktif lokal:

```bash
cd web
npm install
npm run dev
```

Buka peramban di `http://localhost:3000` untuk menggunakan editor kode berbasis web, inspektur AST visual, dan terminal interaktif.

---

## Panduan Sintaks Pseudocode

Semua kata kunci (*keywords*) ditulis menggunakan **huruf kecil (lowercase)**. Komentar dapat ditulis menggunakan `// ...` (satu baris) maupun `{ ... }` (satu atau banyak baris).

### Kerangka Program

Setiap program wajib diawali dengan blok `program`, diikuti bagian deklarasi `kamus`, bagian instruksi `algoritma`, dan diakhiri dengan `endprogram`:

```text
program NamaProgram
kamus
    // deklarasi tipe bentukan, konstanta, dan variabel
algoritma
    // instruksi eksekusi program
endprogram
```

### Tipe Data Dasar

| Tipe Data | Contoh Literal | Keterangan |
| :--- | :--- | :--- |
| `integer` | `10`, `-5`, `0` | Bilangan bulat bertanda 64-bit (*signed*) |
| `real` | `3.14`, `-0.5` | Bilangan pecahan / desimal (*floating-point* 64-bit) |
| `string` | `"Halo Dunia"` | Untaian teks dalam tanda petik ganda (`"..."`) |
| `char` | `'A'`, `'9'`, `'\n'` | Karakter tunggal dalam tanda petik tunggal (`'...'`) |
| `boolean` | `true`, `false` | Nilai kebenaran logika |

### Deklarasi pada Bagian `kamus`

Deklarasi di dalam bagian `kamus` bersifat fleksibel (urutan deklarasi bebas):

```text
kamus
    // 1. Deklarasi Variabel
    x, y, total : integer
    panjang, lebar : real
    nama : string
    status : boolean

    // 2. Deklarasi Konstanta (nilai tetap)
    constant PI : real = 3.1415926535
    constant BATAS_MAKS : integer <- 100

    // 3. Tipe Alias
    type bilangan : integer

    // 4. Tipe Bentukan (Struct / Record)
    type Titik <
        x, y : real
    >
    type Mahasiswa <
        id : integer
        nama : string
        ipk : real
    >

    p1 : Titik
    mhs1 : Mahasiswa
```

### Instruksi pada Bagian `algoritma`

#### Pengisian Nilai (Assignment)
Dapat menggunakan operator `=` maupun tanda panah `<-` (atau `←`):

```text
total = 0
x <- 10
p1.x = 2.5
p1.y <- 4.0
```

#### Masukan dan Keluaran (`input` & `output`)
- `input(var1, var2, ...)` membaca token masukan yang dipisahkan oleh *whitespace* (spasi, tab, atau baris baru).
- `output(expr1, expr2, ...)` mencetak nilai ekspresi ke layar yang dipisahkan dengan spasi dan diakhiri dengan baris baru.

```text
input(x, y)
output("Hasil penjumlahan:", x + y)
```

### Struktur Kontrol & Perulangan

#### Percabangan (`if ... then ... else if ... else ... endif`)
Mengevaluasi ekspresi berkondisi `boolean`:

```text
if nilai >= 80 then
    output("Kategori: A")
else if nilai >= 70 then
    output("Kategori: B")
else if nilai >= 60 then
    output("Kategori: C")
else
    output("Kategori: D")
endif
```

#### Perulangan Tercacah (`for`)
Mencacah dari nilai awal hingga batas akhir secara inklusif. Secara bawaan nilai pencacah bertambah `+1`, atau dapat diatur menggunakan kata kunci `step`:

```text
// Menaik dengan interval default (+1)
for i = 1 to 5 do
    output(i)
endfor

// Menaik dengan interval kustom
for i = 0 to 10 step 2 do
    output(i)
endfor

// Menurun dengan step negatif
for i = 10 to 1 step -1 do
    output(i)
endfor
```

#### Perulangan Berbasis Kondisi (`while` & `repeat-until`)
- `while <kondisi> do ... endwhile`: Memeriksa kondisi di awal; berulang **selama** kondisi bernilai `true`.
- `repeat ... until <kondisi>`: Mengeksekusi blok minimal 1 kali; berulang **sampai** kondisi bernilai `true` (pemeriksaan di akhir).

```text
// While loop
while n > 0 do
    output(n)
    n = n - 1
endwhile

// Repeat-until loop
repeat
    cacah = cacah + 1
    output("Iterasi ke-", cacah)
until cacah == 5
```

### Operator & Tingkat Prioritas

Tingkat prioritas operator dievaluasi dari prioritas tertinggi (1) ke terendah (9):

| Tingkat | Kategori | Operator | Asosiatif | Keterangan |
| :---: | :--- | :--- | :---: | :--- |
| **1** | Pengelompokan & Akses | `( )`, `.`, `len()` | Kiri ke Kanan | Prioritas tanda kurung dan akses *field struct* |
| **2** | Unary | `+`, `-`, `not` | Kanan ke Kiri | Tanda bilangan dan negasi logika |
| **3** | Eksponensial | `^` | Kanan ke Kiri | Operasi pangkat |
| **4** | Perkalian & Bitwise | `*`, `/`, `div`, `mod`, `<<`, `>>`, `&` | Kiri ke Kanan | `/` selalu menghasilkan `real`; `div` & `mod` khusus `integer` |
| **5** | Penjumlahan & Bitwise Or | `+`, `-`, `\|` | Kiri ke Kanan | `+` juga berlaku untuk konkatenasi `string` |
| **6** | Perbandingan Relasional | `<`, `<=`, `>`, `>=` | Kiri ke Kanan | Menghasilkan nilai `boolean` |
| **7** | Perbandingan Kesetaraan | `==`, `!=`, `<>` | Kiri ke Kanan | `<>` ekuivalen dengan `!=` |
| **8** | Logika And | `and` | Kiri ke Kanan | Evaluasi *short-circuit* |
| **9** | Logika Or | `or` | Kiri ke Kanan | Evaluasi *short-circuit* |

---

## Contoh Program

### 1. Perhitungan Geometri Tabung (Struct & Konstanta)

```text
program HitungTabung
kamus
    constant PI : real = 3.1415926535
    type Tabung <
        jari_jari : real
        tinggi : real
        volume : real
    >
    t : Tabung
algoritma
    input(t.jari_jari, t.tinggi)
    t.volume = PI * (t.jari_jari ^ 2) * t.tinggi
    output("Volume tabung:", t.volume)
endprogram
```

### 2. Deret Bilangan & Perulangan Kondisional

```text
program DeretAngka
kamus
    batas, total, bil : integer
algoritma
    input(batas)
    total = 0
    bil = 1

    while bil <= batas do
        if bil mod 2 == 0 then
            total = total + bil
        endif
        bil = bil + 1
    endwhile

    output("Jumlah bilangan genap:", total)
endprogram
```

---

## Penanganan & Diagnostik Error

Compiler memvalidasi program dalam tahapan yang ketat dan menghasilkan pesan kesalahan informatif beserta nomor baris dan kolom yang tepat:

1. **Kesalahan Sintaks (*Syntax Error*)**:
   Terjadi pada tahap *Lexer* atau *Parser* saat kode tidak sesuai tata bahasa formal (misalnya simbol tidak valid, string tidak tertutup, atau kata penutup yang hilang seperti `endprogram`, `endif`, `endfor`).
2. **Kesalahan Semantik & Tipe (*Semantic / Type Error*)**:
   Terdeteksi pada tahap *Checker* sebelum eksekusi dimulai:
   - Penggunaan variabel yang belum dideklarasikan di `kamus`.
   - Modifikasi nilai `constant` (baik melalui assignment maupun `input`).
   - Ketidakcocokan tipe (seperti memberikan nilai `real` ke variabel `integer`).
   - Akses *field struct* yang tidak terdefinisi.
3. **Kesalahan Waktu Eksekusi (*Runtime Error*)**:
   Terjadi saat program berjalan di *Interpreter*:
   - Pembagian dengan nol (`/`, `div`, atau `mod` dengan penyebut `0`).
   - Variabel dibaca sebelum pernah diisi nilainya.
   - Nilai masukan pengguna tidak valid atau data pada stream habis.
   - Nilai parameter `step` pada perulangan bernilai `0`.

---

## Struktur Proyek

```text
Pseudocode Compiler/
├── pseudo.py                # Command-Line Interface (CLI) utama
├── interactive_runner.py    # Runner interaktif & inspeksi AST untuk frontend/web
├── lexer.py                 # Analisis leksikal & tokenisasi
├── parser.py                # Recursive-descent parser (pembentukan AST)
├── ast_nodes.py             # Definisi kelas node AST
├── checker.py               # Analisis semantik & verifikasi tipe data
├── interpreter.py           # Runtime engine & eksekusi baris perintah
├── errors.py                # Definisi & pemformatan diagnostik error
├── docs/                    # Dokumentasi spesifikasi bahasa & keputusan semantik
├── tests/                   # Rangkaian pengujian unit test otomatis
│   └── examples/            # File contoh program .pseudo, .in, dan .out
└── web/                     # Aplikasi Web IDE interaktif (Next.js & Tailwind CSS)
```

---

## Pengujian Otomatis (Unit Testing)

Proyek ini dilengkapi dengan cakupan pengujian komprehensif untuk memastikan akurasi leksikal, tata bahasa, penegakan aturan semantik, serta eksekusi runtime.

Jalankan seluruh pengujian dengan modul `unittest` bawaan Python:

```bash
python -m unittest discover -s tests -p "test_*.py" -v
```
