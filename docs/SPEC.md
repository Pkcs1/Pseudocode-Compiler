# Spesifikasi Bahasa Pseudocode Alpro 1 (`SPEC.md`)

Dokumen ini menjelaskan aturan sintaks dan semantik bahasa pseudocode **Algoritma dan Pemrograman 1 (Telkom University)** yang didukung oleh interpreter ini (cakupan penuh materi Minggu 1 s.d. Minggu 15).

---

## 1. Struktur Dasar Program

Setiap program wajib memiliki kerangka utama berikut (semua kata kunci wajib huruf kecil / *lowercase*):

```text
program NamaProgram
kamus
    <deklarasi variabel / konstanta / alias / struct>
algoritma
    <instruksi-instruksi program>
endprogram
```

---

## 2. Tipe Data Dasar & Literal

| Tipe Data | Contoh Literal | Keterangan |
|---|---|---|
| `integer` | `42`, `-5`, `0` | Bilangan bulat 64-bit signed (wrap-around saat overflow, seperti `int64` di Go). |
| `real` | `3.14`, `-0.5` | Bilangan desimal floating-point (IEEE-754 64-bit). |
| `string` | `"hello"`, `"Informatika"` | Untaian karakter dalam tanda petik ganda (`"`). |
| `char` | `'k'`, `'A'` | Karakter tunggal dalam tanda petik satu (`'`). Disimpan secara internal sebagai kode integer ASCII/Unicode. |
| `boolean` | `true`, `false` | Nilai kebenaran logika. |

---

## 3. Deklarasi di Bagian `kamus` (Urutan Bebas)

Deklarasi di dalam `kamus` dapat ditulis dalam urutan apa saja:

1. **Variabel:**
   ```text
   a, b, c : integer
   tgl : date
   ```
2. **Konstanta:**
   ```text
   constant PI : real = 3.14
   constant BONUS : integer <- 10
   ```
3. **Tipe Bentukan — Alias:**
   ```text
   type bilangan : integer
   ```
4. **Tipe Bentukan — Struct (Record):**
   ```text
   type date <
       tanggal : integer
       bulan : string
       tahun, kode : integer
   >
   ```
   Field di dalam struct diakses menggunakan tanda titik (`.`), misalnya `tgl.tanggal` atau bertingkat seperti `paket.tgl_kirim.tahun`.

---

## 4. Instruksi (Statements) di Bagian `algoritma`

1. **Pengisian Nilai (Assignment):**
   Mendukung tanda `=` maupun panah `<-`:
   ```text
   posisi = posisi0 + (kecepatan * waktu)
   tgl.tanggal <- 10
   ```
2. **Masukan (`input`):**
   Membaca token yang dipisahkan spasi/baris baru dari `stdin` (seperti `fmt.Scan` di Go):
   ```text
   input(posisi0, kecepatan, waktu)
   input(tgl.bulan, tgl.tahun)
   ```
3. **Keluaran (`output`):**
   Mencetak nilai ekspresi dipisahkan oleh satu spasi dan diakhiri baris baru (`\n`):
   ```text
   output(reamur, fahrenheit, kelvin)
   ```
4. **Komentar:**
   Mendukung komentar satu baris `// ...` serta komentar blok gaya slide kuliah `{ ... }` (dapat satu baris maupun multi-baris).
5. **Perulangan `for` (`for ... to ... [step ...] do ... endfor`):**
   Mencacah dari `init` sampai `end` (inklusif) dengan kenaikan default `+1`, atau sesuai nilai opsional `step k` (mendukung step positif untuk menghitung naik maupun step negatif untuk menghitung mundur). `init`, `end`, dan `step` dievaluasi satu kali di awal:
   ```text
   for j = 1 to n do
       input(x)
       totalJarak = x * 5
       output(totalJarak)
   endfor

   for i <- a to b step k do
       output(i)
   endfor
   ```
6. **Percabangan (`if ... then ... [else if ... then ...] [else ...] endif`):**
   Mendukung bentuk `if-then`, `if-then-else`, rantai `else if` (satu `endif` penutup), maupun `if` bersarang di dalam blok `else` (masing-masing ditutup `endif`). Seluruh ekspresi kondisi wajib bertipe `boolean`:
   ```text
   if ikk < 2.00 then
       output("Poor")
   else if 2.00 <= ikk and ikk <= 2.75 then
       output("Fair")
   else
       output("Good")
   endif
   ```
7. **Perulangan `while` (`while ... do ... endwhile`):**
   Mengevaluasi kondisi (`boolean`) di awal setiap iterasi. Badan perulangan dijalankan berulang kali selama kondisi bernilai `true` (bisa 0 kali jika kondisi awal `false`):
   ```text
   while xi mod 2 == 0 do
       total <- total + xi
       input(xi)
   endwhile
   ```
8. **Perulangan `repeat-until` (`repeat ... until ...`):**
   Menjalankan badan perulangan minimal 1 kali, lalu mengevaluasi kondisi berhenti (`boolean`) di akhir setiap iterasi hingga kondisi bernilai `true`:
   ```text
   repeat
       iterasi <- iterasi + 1
       output(iterasi)
   until iterasi == n
   ```
9. **Komposisi Struktur Kontrol:**
   Seluruh instruksi percabangan (`if`) dan perulangan (`for`, `while`, `repeat-until`) dapat disarang (*nested*) secara bebas satu sama lain.

---

## 5. Operator & Tabel Prioritas (Tertinggi ke Terendah)

| Level | Operator | Asosiativitas | Keterangan |
|---|---|---|---|
| **1** | `( )`, `len(s)` | — | Pengelompokan kurung & fungsi bawaan panjang string |
| **2** | `^` | Kanan ke kiri | Pangkat (*power*, contoh `2 ^ 3 ^ 2 = 512`) |
| **3** | `+`, `-` (unary) | Kanan ke kiri | Positif / negatif unary (contoh `-5`) |
| **4** | `*`, `/`, `mod`, `div`, `<<`, `>>`, `&` | Kiri ke kanan | Kali, bagi real, sisa bagi, bagi bulat, geser bit, bitwise AND |
| **5** | `+`, `-`, `\|` | Kiri ke kanan | Tambah (atau konkatenasi string), kurang, bitwise OR |
| **6** | `<`, `<=`, `>`, `>=`, `==`, `!=`, `<>` | Non-asosiatif | Perbandingan (`<>` sama dengan `!=`) |
| **7** | `not` | Kanan ke kiri | Negasi logika boolean |
| **8** | `and` | Kiri ke kanan | DAN logika (*short-circuit*) |
| **9** | `or` | Kiri ke kanan | ATAU logika (*short-circuit*) |

---

## 6. Tata Bahasa Formal (EBNF)

```ebnf
program        = "program" IDENTIFIER
                 "kamus" { declaration }
                 "algoritma" { statement }
                 "endprogram" EOF ;

declaration    = const_decl | type_decl | var_decl ;
const_decl     = "constant" IDENTIFIER ":" type_name ( "=" | "<-" ) expr ;
type_decl      = "type" IDENTIFIER ( ":" type_name | "<" var_decl { var_decl } ">" ) ;
var_decl       = id_list ":" type_name ;
id_list        = IDENTIFIER { "," IDENTIFIER } ;
type_name      = "integer" | "real" | "string" | "boolean" | "char" | IDENTIFIER ;

statement      = assign_stmt | input_stmt | output_stmt | for_stmt | if_stmt | while_stmt | repeat_stmt ;
assign_stmt    = lvalue ( "=" | "<-" ) expr ;
input_stmt     = "input" "(" lvalue { "," lvalue } ")" ;
output_stmt    = "output" "(" expr { "," expr } ")" ;
for_stmt       = "for" IDENTIFIER ( "=" | "<-" ) expr "to" expr [ "step" expr ] "do" { statement } "endfor" ;
if_stmt        = "if" expr "then" { statement } { "else" "if" expr "then" { statement } } [ "else" { statement } ] "endif" ;
while_stmt     = "while" expr "do" { statement } "endwhile" ;
repeat_stmt    = "repeat" { statement } "until" expr ;
lvalue         = IDENTIFIER { "." IDENTIFIER } ;
```
