# Pseudocode Interpreter (Alpro 1)

Interpreter berbasis Python untuk menjalankan kode pseudocode sesuai standar perkuliahan **Algoritma dan Pemrograman 1 (Telkom University)**. Tidak memerlukan instalasi library tambahan di luar bawaan Python.

---

## 1. Prasyarat

- **Python 3.10** atau versi yang lebih baru.

Cek versi Python di terminal atau Command Prompt:

```bash
python --version
```

---

## 2. Cara Menjalankan Program

Buat file berekstensi `.pseudo` (misalnya `latihan.pseudo`), lalu jalankan melalui terminal:

```bash
python pseudo.py latihan.pseudo
```

Jika program meminta masukan (`input`), ketik nilai masukan di terminal (dipisahkan dengan spasi atau baris baru) lalu tekan **Enter**.

Untuk mengambil masukan langsung dari file teks:

```bash
python pseudo.py tests/examples/jarak.pseudo < tests/examples/jarak.in
```

---

## 3. Panduan Sintaks Pseudocode

Semua kata kunci (*keywords*) ditulis menggunakan **huruf kecil (lowercase)**. Komentar satu baris dapat ditulis menggunakan `//`.

### Kerangka Program

Setiap program wajib memiliki bagian `program`, `kamus`, `algoritma`, dan ditutup dengan `endprogram`:

```text
program NamaProgram
kamus
    // deklarasi tipe, konstanta, dan variabel
algoritma
    // instruksi program
endprogram
```

### Tipe Data Dasar

| Tipe Data | Contoh Nilai | Keterangan |
| :--- | :--- | :--- |
| `integer` | `10`, `-5`, `0` | Bilangan bulat (64-bit signed) |
| `real` | `3.14`, `0.5` | Bilangan desimal (floating-point) |
| `string` | `"Informatika"` | Teks dalam tanda kutip ganda (`"..."`) |
| `char` | `'A'`, `'k'` | Karakter tunggal dalam tanda kutip satu (`'...'`) |
| `boolean` | `true`, `false` | Nilai logika kebenaran |

### Deklarasi pada Bagian `kamus`

Urutan deklarasi di dalam `kamus` bersifat bebas:

```text
kamus
    // 1. Variabel
    a, b, hasil : integer
    rata_rata : real

    // 2. Konstanta (nilai tetap, tidak dapat diubah di algoritma)
    constant PI : real = 3.14
    constant BONUS : integer <- 10

    // 3. Tipe Alias
    type bilangan : integer

    // 4. Tipe Bentukan (Struct)
    type tanggal_lahir <
        hari, tahun : integer
        bulan : string
    >
    tgl : tanggal_lahir
```

### Instruksi pada Bagian `algoritma`

#### Pengisian Nilai (Assignment)
Dapat menggunakan tanda `=` maupun panah `<-`:

```text
a = 10
b <- a + 5
tgl.hari <- 17
tgl.bulan = "Agustus"
```

#### Masukan dan Keluaran (`input` & `output`)
- `input(...)` membaca nilai yang dipisahkan oleh spasi atau baris baru.
- `output(...)` mencetak nilai ke layar (dipisahkan spasi dan diakhiri baris baru).

```text
input(a, b)
output("Hasil penjumlahan:", a + b)
```

#### Perulangan `for`
Mencacah dari nilai awal (`init`) hingga batas akhir (`end`) secara inklusif. Secara bawaan nilai pencacah bertambah `+1` setiap putaran, atau dapat diatur menggunakan kata kunci opsional `step`:

```text
// Naik +1 setiap putaran
for i = 1 to 5 do
    output(i)
endfor

// Naik sesuai langkah (step) positif
for i <- a to b step k do
    output(i)
endfor

// Hitung mundur dengan step negatif
for i = 10 to 1 step -2 do
    output(i)
endfor
```

### Operator yang Didukung

| Kategori | Operator | Keterangan |
| :--- | :--- | :--- |
| Aritmatika | `+`, `-`, `*`, `/`, `^` | `/` selalu menghasilkan `real`; `^` adalah pangkat |
| Pembagian Bulat | `div`, `mod` | Hasil bagi bulat dan sisa bagi khusus tipe `integer` |
| Perbandingan | `<`, `<=`, `>`, `>=`, `==`, `!=`, `<>` | Menghasilkan nilai `boolean` (`<>` sama dengan `!=`) |
| Logika | `not`, `and`, `or` | Operasi logika untuk tipe `boolean` |
| Bitwise | `<<`, `>>`, `&`, `\|` | Operasi bit khusus tipe `integer` |
| String | `+`, `len(s)` | `+` menggabungkan dua `string`; `len(s)` menghitung panjang karakter |

---

## 4. Contoh Program

```text
program HitungLuasTabung
kamus
    constant PI : real = 3.14
    type tabung <
        jari_jari, tinggi : real
        volume : real
    >
    t : tabung
algoritma
    input(t.jari_jari, t.tinggi)
    t.volume = PI * (t.jari_jari ^ 2) * t.tinggi
    output(t.volume)
endprogram
```

---

## 5. Penjelasan Pesan Error

Jika terdapat kesalahan pada kode, interpreter akan menampilkan nomor baris beserta letak kesalahan dalam bahasa Indonesia:

1. **Kesalahan sintaks** — Penulisan kode tidak sesuai tata bahasa (misalnya lupa menulis `endprogram`, `endfor`, atau tanda titik dua `:` pada `kamus`).
2. **Kesalahan tipe/deklarasi** — Variabel belum terdaftar di `kamus`, mencoba mengubah nilai `constant`, atau memasukkan nilai yang tidak sesuai tipe datanya (seperti mengisi variabel `integer` dengan nilai `real`).
3. **Kesalahan saat program berjalan (runtime)** — Terjadi saat eksekusi berlangsung, seperti pembagian dengan nol (`0`), variabel dipakai sebelum diisi nilai, `step` bernilai `0`, atau masukan dari pengguna tidak sesuai tipe variabel.

---

## 6. Struktur Proyek & Pengujian

- `pseudo.py` — Program utama (CLI) untuk menjalankan file `.pseudo`.
- `lexer.py`, `parser.py`, `ast_nodes.py`, `checker.py`, `interpreter.py`, `errors.py` — Modul internal kompilasi dan eksekusi.
- `tests/examples/` — Kumpulan contoh program `.pseudo` beserta sampel masukan (`.in`) dan keluaran (`.out`).
- `docs/SPEC.md` & `docs/DECISIONS.md` — Dokumentasi teknis spesifikasi tata bahasa (EBNF) dan aturan semantik.

Untuk menjalankan seluruh rangkaian pengujian otomatis (*unit test*):

```bash
python -m unittest discover -s tests -p "test_*.py" -v
```
