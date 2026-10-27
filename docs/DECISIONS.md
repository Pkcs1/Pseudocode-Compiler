# Catatan Keputusan Desain (`DECISIONS.md`)

Dokumen ini mencatat semua keputusan semantik dan aturan perilaku yang diterapkan di dalam interpreter **Pseudocode Alpro 1**, terutama untuk bagian yang ambigu atau berbeda-beda di slide perkuliahan.

## Milestone 1: Struktur Dasar, Variabel, Input/Output, dan Aritmatika Angka

1. **Pembagian `/` vs `div` dan `mod`:**
   - Operator `/` **selalu** menghasilkan pembagian desimal (`real`), bahkan jika kedua operand bertipe `integer` (contoh: `4 / 5` menghasilkan `0.8` bertipe `real`).
   - Operator `div` adalah pembagian bilangan bulat (`integer`) yang membulatkan hasil ke arah nol (*truncate toward zero*, sama seperti pembagian `int` di bahasa Go). Contoh: `-7 div 2 = -3`.
   - Operator `mod` adalah sisa pembagian bulat (`integer`) dengan rumus `a - (a div b) * b` (tanda mengikuti bilangan yang dibagi, sama seperti operator `%` di bahasa Go).

2. **Representasi `integer` 64-bit Signed (Wrap-Around):**
   - Di Python, `int` memiliki presisi tak terbatas. Supaya sesuai dengan spesifikasi kuliah dan bahasa Go (`int64`), setiap nilai `integer` dibungkus (*wrap-around*) ke rentang 64-bit signed (`-9223372036854775808` s.d. `9223372036854775807`).

3. **Konversi Tipe Angka (`integer` dan `real`):**
   - Konversi dari `integer` ke `real` bersifat **otomatis (implisit)**, baik saat dihitung dalam rumus campuran maupun saat disimpan ke variabel `real`.
   - Sebaliknya, memasukkan nilai `real` ke dalam variabel `integer` adalah **error tipe/deklarasi** yang dicegah oleh `checker.py` sebelum program berjalan.

4. **Operator Pangkat (`^`):**
   - Slide Week 2 menyebutkan `^` sebagai XOR bit, sedangkan tabel prioritas operator di Slide Week 3 menyebutkan `^` sebagai operasi pangkat. Sesuai spesifikasi proyek, `^` ditetapkan sebagai **pangkat (power)** yang bersifat *right-associative* (`2 ^ 3 ^ 2 = 2 ^ (3 ^ 2) = 512`).
   - Jika kedua operand bertipe `integer` tetapi pangkatnya bernilai negatif saat dijalankan, interpreter melaporkan error runtime karena hasilnya bukan bilangan bulat.

5. **Pembacaan `input()` seperti `fmt.Scan` di Go:**
   - `input(a, b, ...)` membaca token yang dipisahkan oleh spasi, tab, atau baris baru (*whitespace-separated*) lintas baris dari `stdin`.
   - Jika token habis sebelum semua variabel terbaca, atau teks yang dibaca bukan angka yang valid sesuai tipe variabelnya, interpreter menghentikan eksekusi dengan pesan kesalahan runtime Bahasa Indonesia.

6. **Pencetakan `output()` dan Format Angka `real`:**
   - Semua pemformatan output dipusatkan di satu fungsi `format_output()` di dalam `interpreter.py`: nilai-nilai dipisahkan oleh satu spasi (`" "`) dan diakhiri dengan baris baru (`"\n"`).
   - Nilai `real` dicetak mengikuti perilaku `fmt.Println` untuk `float64` di Go: jika nilainya tepat bilangan bulat (seperti `314.0`), dicetak tanpa `.0` (`314`); jika memiliki pecahan (seperti `3.14` atau `31.400000000000002`), dicetak apa adanya.

7. **Variabel Belum Diisi Nilai ("Belum Diisi"):**
   - Variabel yang sudah dideklarasikan di `kamus` tidak diberi nilai awal `0` secara diam-diam. Jika variabel dipakai di dalam ekspresi sebelum pernah diisi dengan `=` atau `input()`, interpreter melaporkan error runtime bahwa variabel tersebut belum diisi nilainya.

8. **Komentar `//` dan Kutip Pintar (*Smart Quotes*):**
   - Dukungan komentar satu baris `//` diisolasi di satu blok khusus di `lexer.py` agar mudah diubah bila aturan kampus diperbarui.
   - Karakter *smart quotes* (`“`, `”`, `‘`, `’`) dari slide PowerPoint dinormalisasi menjadi kutip lurus (`"` dan `'`) di `lexer.py`.

## Milestone 2: Tipe `string`, `boolean`, `char`, serta Seluruh Operator (Level 1–9)

9. **Representasi Internal `char` sebagai Integer Kode ASCII/Unicode:**
   - Sesuai Slide Week 2 dan spesifikasi proyek, `char` disimpan secara internal sebagai bilangan bulat (`integer` kode ASCII/Unicode, misalnya `'B'` disimpan sebagai `66`).
   - Variabel `char` boleh diisi ekspresi `integer` (contoh pada `program rahasia`: `y1 = ((x1 + x2) mod 4096) >> 6 + 64`) dan boleh terlibat dalam operasi aritmatika/bitwise bilangan bulat.
   - Saat dicetak lewat `output(y1)`, tipe variabelnya dikenali sebagai `char` sehingga yang ditampilkan adalah karakternya (`B`), bukan angkanya (`66`).

10. **Perbaikan Bug `input()` pada Slide `program rahasia`:**
    - Di Slide Week 2 halaman 18, kode pseudocode tertulis `input(x1,x2,x3,x4)` padahal rumus `y4` menggunakan `x5` dan versi Go di bawahnya menulis `fmt.Scan(&x1,&x2,&x3,&x4,&x5)`. Versi yang benar di `tests/examples/rahasia.pseudo` menggunakan `input(x1, x2, x3, x4, x5)`.

11. **Prioritas Operator Bitwise (`<<`, `>>`, `&`, `|`) Mengikuti Bahasa Go:**
    - `<<`, `>>`, dan `&` berada di Level 4 (setara dengan `*`, `/`, `mod`, `div`), sedangkan `|` berada di Level 5 (setara dengan `+`, `-`).
    - Hal ini memastikan rumus `((x1 + x2) mod 4096) >> 6 + 64` dihitung sebagai `(((x1 + x2) mod 4096) >> 6) + 64`, persis seperti di bahasa Go.

12. **Evaluasi *Short-Circuit* pada `and` dan `or`:**
    - Pada `a and b`, jika `a` bernilai `false`, maka `b` tidak dievaluasi sama sekali.
    - Pada `a or b`, jika `a` bernilai `true`, maka `b` tidak dievaluasi sama sekali.

13. **Operator Perbandingan `<>` dan `!=`:**
    - Keduanya diterima oleh Lexer dan dinormalisasi di Parser menjadi operasi ketidaksamaan (`!=`).
    - Perbandingan `<, <=, >, >=, ==, !=` berlaku untuk sesama angka (`integer`/`real`/`char`) dan sesama `string`. Untuk `boolean`, didukung perbandingan kesamaan `==` dan `!=` (`<>`).

## Milestone 3: Konstanta (`constant`), Tipe Alias (`type ... : ...`), dan Struct (`type ... < ... >`)

14. **Urutan Deklarasi Bebas di dalam `kamus`:**
    - Sesuai spesifikasi (`Declarations inside kamus, any order`), `checker.py` dan `interpreter.py` membaca deklarasi tipe (`AliasDecl` dan `StructDecl`) terlebih dahulu pada tahap pertama sebelum memeriksa/menyiapkan variabel dan konstanta. Dengan demikian, variabel `tgl : date` tetap sah walaupun ditulis di baris atas sebelum `type date < ... >`.

15. **Resolusi Konteks `<` dan `>` pada Struct:**
    - Di Lexer, `<` dan `>` tetap menjadi token `LT` dan `GT`.
    - Di Parser (`parse_type_decl`), tanda `<` setelah `type NamaStruct` dikenali sebagai pembuka blok daftar field struct hingga bertemu token `>` (`GT`). Karena konteks ini hanya muncul di dalam `kamus` sesudah kata kunci `type`, pembatas `<` dan `>` tidak pernah bentrok dengan operator perbandingan `<` dan `>` di dalam ekspresi.

16. **Penyalinan Nilai Struct (*Copy Semantics*):**
    - Saat variabel struct di-assign ke variabel struct lain yang bertipe sama (`tgl2 = tgl1`), seluruh isi dictionary field disalin secara mendalam (`copy_runtime_value`). Mengubah `tgl2.tanggal` sesudahnya tidak akan mengubah `tgl1.tanggal`.

17. **Perbaikan Typo OCR pada Slide `TabungProperti`:**
    - Di Slide Week 4 halaman 13, baris `t.luasDinding = t.tinggi * (2 * P1 * t.jari2)` memuat salah baca OCR `P1` (angka satu) yang seharusnya adalah konstanta `PI`. Pada `tests/examples/tabung_properti.pseudo`, digunakan `PI`.

18. **Dukungan Tanda Pengisian Nilai `<-` dan `=` Sekaligus:**
    - Di slide perkuliahan (misalnya Slide Week 2 halaman 8 pada bagian *Memory/Program*), pengisian nilai terkadang ditulis dengan tanda panah `<-` (`posisi <- posisi0 + kecepatan*waktu`), sedangkan di slide lain ditulis dengan `=`.
    - Lexer mengenali baik `<-` maupun `=` sebagai token `ASSIGN`, sehingga keduanya dapat digunakan untuk pengisian nilai variabel/field struct, deklarasi `constant`, maupun inisialisasi `for`.

## Milestone 4: Perulangan `for i = init to end do ... endfor`

19. **Evaluasi Batas `init` dan `end` pada `for`:**
    - Ekspresi `init` dan `end` dievaluasi **satu kali saja** sebelum perulangan dimulai. Jika variabel yang menjadi pembatas (`end`) diubah di dalam badan `for`, jumlah iterasi tidak ikut berubah.
    - Jika `init > end` (misalnya `for i = 1 to 0 do`), badan perulangan dijalankan `0` kali, namun variabel `i` tetap telah terinisialisasi dengan nilai `init` (seperti `for i = n; i <= m; i++` di bahasa Go pada Slide Week 5&6 halaman 9).
    - Variabel pencacah `i` wajib dideklarasikan di `kamus` dengan tipe `integer` (atau alias yang mengarah ke `integer`).




