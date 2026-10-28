# Interpreter Pseudocode Alpro 1

Interpreter baris perintah (_command-line_) berbasis **Python 3** (hanya menggunakan _standard library_ bawaan Python) untuk menjalankan kode pseudocode.

Proyek ini ditulis dengan gaya kode yang sederhana, mudah dibaca oleh pemula, dan dilengkapi komentar penjelasan dalam bahasa Indonesia.

---

## Cara Pakai

Jalankan file `.pseudo` langsung dari terminal:

```bash
python pseudo.py tests/examples/jarak.pseudo
```

Lalu ketik masukan (input) yang diminta program (misalnya `3 4 5`) dan tekan **Enter**, atau arahkan input dari file `.in`:

```bash
python pseudo.py tests/examples/jarak.pseudo < tests/examples/jarak.in
```

---

## Arsitektur Proyek (1 File per Tahapan)

Setiap kali kamu menjalankan `python pseudo.py program.pseudo`, kode pseudocode kamu diproses melalui tahapan berikut secara berurutan:

1. **`lexer.py` (Tahap 1 — Lexer / Tokenizer)**
   Membaca teks kode sumber huruf demi huruf, menormalisasi _smart quotes_ dari PowerPoint, mengabaikan komentar `//`, dan mengubah teks menjadi daftar `Token`.
2. **`ast_nodes.py` (Definisi Pohon AST)**
   Kumpulan `@dataclass` sederhana sebagai wadah penyimpan struktur program di memori (`Program`, `VarDecl`, `ConstDecl`, `AliasDecl`, `StructDecl`, `AssignStmt`, `InputStmt`, `OutputStmt`, `ForStmt`, dll).
3. **`parser.py` (Tahap 2 — Recursive-Descent Parser)**
   Memeriksa urutan `Token` sesuai tata bahasa (EBNF) dan menyusun pohon AST beserta 9 level prioritas operator.
4. **`checker.py` (Tahap 3 — Semantic Checker)**
   Berjalan **sebelum** program dieksekusi untuk memeriksa kamus & tipe data: memastikan semua variabel sudah dideklarasikan, melarang perubahan nilai konstanta, dan mencegah ketidakcocokan tipe (seperti mengisi variabel `integer` dengan nilai `real`).
5. **`interpreter.py` (Tahap 4 — Interpreter)**
   Menjalankan pohon AST baris demi baris, membaca input dari `stdin` (ala `fmt.Scan` di Go), menghitung ekspresi matematika/logika/bitwise, dan mencetak hasil ke `stdout`.
6. **`errors.py` (Penanganan Pesan Error Bahasa Indonesia)**
   Menampilkan pesan kesalahan yang ramah dengan nomor baris, kategori kesalahan (`kesalahan sintaks`, `kesalahan tipe/deklarasi`, atau `kesalahan saat program berjalan`), dan penunjuk `^` tepat di bawah letak kesalahan—tanpa pernah menampilkan _Python traceback_.

---

## Menjalankan Pengujian Otomatis (Unit Tests)

Untuk menjalankan seluruh unit test (mencakup contoh wajib, skenario error, latihan soal slide Minggu 2–6, dan kasus uji fleksibilitas):

```bash
python -m unittest discover -s tests -p "test_*.py" -v
```

---

## Dokumentasi Tambahan

- [`docs/SPEC.md`](docs/SPEC.md): Spesifikasi lengkap sintaks, tipe data, operator, dan EBNF bahasa pseudocode.
- [`docs/DECISIONS.md`](docs/DECISIONS.md): Catatan keputusan desain dan penyelesaian bagian yang ambigu di slide kuliah.
