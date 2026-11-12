/**
 * Content of the /docs page (Pseudocode Alpro 1 language reference), written
 * for complete beginners.
 *
 * Inline text supports `code`, **bold** and *italic*.
 *
 * Keep examples truthful: every `code` block with `output` is a complete
 * program whose output is exactly what the interpreter prints, and every
 * `mistake.error` is the exact message the editor shows for `mistake.wrong`.
 * Verify by running them through `runTestCase` / `inspectSource`.
 */

export interface DocExample {
  code: string;
  /** stdin given to the program (for examples that use input). */
  input?: string;
  /** Exact output of the program. Present only for complete programs. */
  output?: string;
}

export interface DocMistake {
  title: string;
  /** Complete program containing the mistake. */
  wrong: string;
  /** Exact error message shown by the editor (or when running). */
  error: string;
  /** Complete, corrected program. */
  right: string;
  /** Input used when the mistake only shows up while running. */
  input?: string;
  explain: string;
}

export type DocBlock =
  | { kind: "p"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "code"; example: DocExample }
  | { kind: "table"; head: string[]; rows: string[][]; caption?: string }
  | { kind: "list"; items: string[] }
  | { kind: "steps"; items: string[] }
  | { kind: "note"; tone: "info" | "warning" | "tip"; text: string }
  | { kind: "mistake"; mistake: DocMistake };

export interface DocSection {
  id: string;
  group: string;
  title: string;
  summary: string;
  blocks: DocBlock[];
}

export const DOC_SECTIONS: DocSection[] = [
  // ======================================================== Mulai di sini
  {
    id: "apa-itu-pseudocode",
    group: "Mulai di Sini",
    title: "Apa Itu Pseudocode?",
    summary: "Penjelasan singkat untuk yang baru pertama kali belajar pemrograman.",
    blocks: [
      {
        kind: "p",
        text: "**Algoritma** adalah urutan langkah untuk menyelesaikan suatu masalah. Contoh sehari-hari: resep masakan. Resep menyebutkan bahan apa saja yang dibutuhkan, lalu langkah-langkah memasaknya secara berurutan.",
      },
      {
        kind: "p",
        text: "**Pseudocode** adalah cara menuliskan algoritma dengan bahasa yang mirip bahasa pemrograman, tetapi lebih sederhana dan mudah dibaca. Pseudocode di sini memakai aturan mata kuliah *Algoritma dan Pemrograman 1*. Bedanya dengan menulis di kertas: compiler ini bisa **memeriksa** tulisan Anda dan **menjalankannya** seperti program sungguhan.",
      },
      {
        kind: "table",
        head: ["Resep masakan", "Program pseudocode"],
        rows: [
          ["Judul resep", "`program NamaProgram`"],
          ["Daftar bahan dan wadahnya", "Bagian `kamus`: daftar variabel (wadah untuk menyimpan data)"],
          ["Langkah-langkah memasak", "Bagian `algoritma`: instruksi yang dijalankan berurutan"],
          ["“Selesai, siap disajikan”", "`endprogram`"],
        ],
      },
      {
        kind: "p",
        text: "Hampir setiap program mengikuti pola yang sama: **ambil masukan → olah → tampilkan hasil**. Misalnya program menghitung luas persegi panjang: minta panjang dan lebar (masukan), kalikan keduanya (olah), lalu tampilkan luasnya (hasil).",
      },
    ],
  },
  {
    id: "program-pertama",
    group: "Mulai di Sini",
    title: "Program Pertama Anda",
    summary: "Langkah demi langkah menulis dan menjalankan program di editor.",
    blocks: [
      {
        kind: "steps",
        items: [
          "Klik **Buka Editor** (atau tombol ← Editor di kiri atas).",
          "Salin program di bawah ini (tombol **Salin**), lalu tempel ke editor.",
          "Tekan tombol **Jalankan** atau `Ctrl + Enter`.",
          "Program akan berhenti dan menunggu masukan. Klik tab **Terminal**, ketik `4 5`, lalu tekan Enter.",
          "Hasilnya muncul di Terminal: `Luas = 20`.",
        ],
      },
      {
        kind: "code",
        example: {
          code: `program LuasPersegiPanjang
kamus
    panjang, lebar, luas : integer
algoritma
    input(panjang, lebar)
    luas <- panjang * lebar
    output("Luas =", luas)
endprogram`,
          input: "4 5",
          output: "Luas = 20",
        },
      },
      {
        kind: "p",
        text: "Mari baca program ini baris per baris:",
      },
      {
        kind: "table",
        head: ["Baris", "Artinya"],
        rows: [
          ["`program LuasPersegiPanjang`", "Memberi nama program."],
          ["`kamus`", "Mulai daftar variabel."],
          ["`panjang, lebar, luas : integer`", "Siapkan tiga wadah bernama `panjang`, `lebar`, dan `luas` untuk menyimpan bilangan bulat."],
          ["`algoritma`", "Mulai langkah-langkah program."],
          ["`input(panjang, lebar)`", "Minta dua angka dari pengguna. Angka pertama masuk ke `panjang`, angka kedua ke `lebar`."],
          ["`luas <- panjang * lebar`", "Hitung panjang × lebar, lalu simpan hasilnya ke `luas`."],
          ["`output(\"Luas =\", luas)`", "Tampilkan teks `Luas =` diikuti isi `luas`."],
          ["`endprogram`", "Program selesai."],
        ],
      },
      {
        kind: "note",
        tone: "tip",
        text: "Jika ada tulisan yang salah, editor langsung memberi **garis bergelombang merah** dan pesan di ujung baris. Lihat bagian *Error & Peringatan* untuk cara membacanya.",
      },
    ],
  },

  // ======================================================== Dasar
  {
    id: "struktur-program",
    group: "Dasar",
    title: "Struktur Program",
    summary: "Kerangka wajib setiap program: program, kamus, algoritma, endprogram.",
    blocks: [
      {
        kind: "p",
        text: "Setiap program **wajib** memiliki empat bagian ini, dengan urutan yang sama:",
      },
      {
        kind: "code",
        example: {
          code: `program NamaProgram
kamus
    { daftar variabel, konstanta, dan tipe }
algoritma
    { langkah-langkah program }
endprogram`,
        },
      },
      {
        kind: "list",
        items: [
          "`program NamaProgram`: baris pertama, berisi nama program. Nama bebas, tetapi tidak boleh ada spasi (pakai `LuasLingkaran` atau `luas_lingkaran`).",
          "`kamus`: tempat mendaftarkan semua variabel yang akan dipakai. Boleh kosong jika program tidak memakai variabel.",
          "`algoritma`: tempat instruksi. Instruksi dijalankan **satu per satu dari atas ke bawah**.",
          "`endprogram`: penutup. Tidak boleh ada kode lagi setelahnya.",
        ],
      },
      { kind: "h3", text: "Aturan penulisan nama" },
      {
        kind: "list",
        items: [
          "Nama (program, variabel, tipe) hanya boleh berisi huruf, angka, dan garis bawah `_`, dan harus diawali huruf atau `_`. Contoh sah: `nilai1`, `total_harga`, `_x`. Tidak sah: `1nilai`, `total harga`, `harga-akhir`.",
          "Huruf besar dan kecil dianggap berbeda: `total` dan `Total` adalah dua nama yang berbeda.",
          "**Kata kunci** (`program`, `if`, `output`, dll.) wajib huruf kecil semua dan tidak bisa dipakai sebagai nama variabel.",
          "Indentasi (spasi di awal baris) tidak wajib, tetapi sangat membantu agar program mudah dibaca. Tekan `Tab` di editor untuk menambah 4 spasi.",
        ],
      },
      {
        kind: "mistake",
        mistake: {
          title: "Kata kunci ditulis dengan huruf besar",
          wrong: `Program Sapa
kamus
algoritma
    output("Halo!")
endprogram`,
          error: "kata kunci harus ditulis dengan huruf kecil: gunakan 'program', bukan 'Program'.",
          right: `program Sapa
kamus
algoritma
    output("Halo!")
endprogram`,
          explain: "Semua kata kunci harus huruf kecil. `Program`, `IF`, atau `Output` tidak dikenali sebagai kata kunci.",
        },
      },
      {
        kind: "mistake",
        mistake: {
          title: "Lupa menutup dengan endprogram",
          wrong: `program Sapa
kamus
algoritma
    output("Halo!")`,
          error: "kata kunci 'endprogram' tidak ditemukan di akhir program.",
          right: `program Sapa
kamus
algoritma
    output("Halo!")
endprogram`,
          explain: "Setiap program harus diakhiri `endprogram`, sama seperti setiap kalimat diakhiri titik.",
        },
      },
    ],
  },
  {
    id: "komentar",
    group: "Dasar",
    title: "Komentar",
    summary: "Catatan di dalam kode yang diabaikan saat program dijalankan.",
    blocks: [
      {
        kind: "p",
        text: "Komentar adalah catatan untuk manusia yang membaca kode, misalnya penjelasan rumus atau pengingat. Komputer melewati komentar sama sekali, jadi Anda bebas menulis apa pun di dalamnya.",
      },
      {
        kind: "list",
        items: [
          "`//` membuat komentar sampai akhir baris.",
          "`{ ... }` membuat komentar yang bisa satu baris atau beberapa baris (gaya yang dipakai di slide kuliah).",
        ],
      },
      {
        kind: "code",
        example: {
          code: `program Komentar
kamus
    harga : integer
algoritma
    // harga dalam rupiah
    harga <- 15000   // komentar juga boleh di akhir baris
    { komentar blok
      bisa beberapa baris }
    output(harga)
endprogram`,
          output: "15000",
        },
      },
      {
        kind: "note",
        tone: "warning",
        text: "Komentar blok yang dibuka dengan `{` wajib ditutup `}`. Jika lupa, seluruh kode sesudahnya ikut dianggap komentar dan editor menandai error di baris pembukanya.",
      },
    ],
  },
  {
    id: "tipe-data",
    group: "Dasar",
    title: "Tipe Data",
    summary: "Jenis-jenis nilai: integer, real, string, char, dan boolean.",
    blocks: [
      {
        kind: "p",
        text: "Setiap nilai punya **tipe**. Tipe menentukan nilai apa yang boleh disimpan dan operasi apa yang bisa dilakukan. Misalnya, angka bisa dikalikan, tetapi teks tidak.",
      },
      {
        kind: "table",
        head: ["Tipe", "Untuk menyimpan", "Contoh nilai", "Contoh pemakaian"],
        rows: [
          ["`integer`", "Bilangan bulat (tanpa koma)", "`42`, `-5`, `0`", "umur, jumlah barang, nomor urut"],
          ["`real`", "Bilangan desimal", "`3.14`, `-0.5`, `2.0`", "tinggi badan, IPK, suhu"],
          ["`string`", "Teks (kumpulan karakter)", '`"Informatika"`, `"A-12"`', "nama, alamat, pesan"],
          ["`char`", "Tepat satu karakter", "`'A'`, `'k'`, `'7'`", "nilai huruf, inisial"],
          ["`boolean`", "Benar atau salah", "`true`, `false`", "lulus/tidak, ganjil/genap"],
        ],
      },
      { kind: "h3", text: "Cara menulis nilainya" },
      {
        kind: "list",
        items: [
          "Bilangan desimal memakai **titik**, bukan koma: `3.14`, bukan `3,14`. Harus ada angka sesudah titik (`3.` tidak sah).",
          'Teks (`string`) diapit tanda petik ganda: `"Halo"`.',
          "Karakter (`char`) diapit tanda petik tunggal dan isinya harus tepat satu: `'A'`. Tulisan `'AB'` tidak sah.",
          "Perhatikan bedanya: `10` adalah angka, sedangkan `\"10\"` adalah teks yang kebetulan berisi angka.",
        ],
      },
      {
        kind: "code",
        example: {
          code: `program TipeData
kamus
    umur : integer
    tinggi : real
    nama : string
    huruf : char
    lulus : boolean
algoritma
    umur <- 19
    tinggi <- 170.5
    nama <- "Sari"
    huruf <- 'B'
    lulus <- true
    output(nama, umur, tinggi, huruf, lulus)
endprogram`,
          output: "Sari 19 170.5 B true",
        },
      },
      { kind: "h3", text: "Mencampur integer dan real" },
      {
        kind: "p",
        text: "Nilai `integer` boleh disimpan ke variabel `real` (misalnya `tinggi <- 170` akan menjadi `170.0`). Sebaliknya **tidak boleh**: nilai desimal tidak muat di variabel bilangan bulat, karena bagian di belakang koma akan hilang.",
      },
      {
        kind: "mistake",
        mistake: {
          title: "Menyimpan hasil desimal ke variabel integer",
          wrong: `program Rata
kamus
    rata : integer
algoritma
    rata <- 7 / 2
    output(rata)
endprogram`,
          error: "tidak dapat mengisi 'rata' yang bertipe 'integer' dengan nilai bertipe 'real'.",
          right: `program Rata
kamus
    rata : real
algoritma
    rata <- 7 / 2
    output(rata)
endprogram`,
          explain: "Operator `/` selalu menghasilkan `real` (`7 / 2` = `3.5`). Ubah tipe variabelnya menjadi `real`, atau pakai `div` jika memang ingin hasil bulat (`7 div 2` = `3`).",
        },
      },
      {
        kind: "mistake",
        mistake: {
          title: "Angka ditulis di dalam tanda petik",
          wrong: `program Nilai
kamus
    nilai : integer
algoritma
    nilai <- "90"
    output(nilai)
endprogram`,
          error: "tidak dapat mengisi 'nilai' yang bertipe 'integer' dengan nilai bertipe 'string'.",
          right: `program Nilai
kamus
    nilai : integer
algoritma
    nilai <- 90
    output(nilai)
endprogram`,
          explain: 'Tanda petik membuat nilainya menjadi teks. `"90"` adalah `string`, sedangkan `90` adalah `integer`.',
        },
      },
    ],
  },

  // ======================================================== Kamus
  {
    id: "variabel",
    group: "Kamus",
    title: "Variabel",
    summary: "Wadah bernama untuk menyimpan nilai, didaftarkan di bagian kamus.",
    blocks: [
      {
        kind: "p",
        text: "Bayangkan variabel sebagai **kotak berlabel**. Labelnya adalah nama variabel, dan isinya adalah nilai. Setiap kotak hanya bisa menyimpan satu jenis barang (sesuai tipenya), dan isinya bisa diganti kapan saja.",
      },
      {
        kind: "p",
        text: "Format deklarasi: `nama : tipe`. Beberapa variabel dengan tipe yang sama boleh ditulis dalam satu baris, dipisahkan koma.",
      },
      {
        kind: "code",
        example: {
          code: `kamus
    a, b, c : integer
    rata_rata : real
    pesan : string`,
        },
      },
      {
        kind: "list",
        items: [
          "Setiap variabel yang dipakai di `algoritma` **wajib** didaftarkan dulu di `kamus`.",
          "Satu nama hanya boleh didaftarkan sekali.",
          "Saat program mulai, variabel masih **kosong**. Isi dulu dengan `<-` atau `input(...)` sebelum isinya dipakai.",
          "Pilih nama yang menjelaskan isinya: `total_harga` lebih mudah dipahami daripada `th` atau `x`.",
        ],
      },
      {
        kind: "mistake",
        mistake: {
          title: "Memakai variabel yang belum didaftarkan",
          wrong: `program Luas
kamus
    sisi : integer
algoritma
    sisi <- 5
    luas <- sisi * sisi
    output(luas)
endprogram`,
          error: "variabel 'luas' belum dideklarasikan di kamus.",
          right: `program Luas
kamus
    sisi, luas : integer
algoritma
    sisi <- 5
    luas <- sisi * sisi
    output(luas)
endprogram`,
          explain: "Variabel `luas` dipakai di `algoritma` tetapi tidak ada di `kamus`. Tambahkan ke daftar variabel.",
        },
      },
      {
        kind: "mistake",
        mistake: {
          title: "Memakai isi variabel sebelum diisi",
          wrong: `program Total
kamus
    total, harga : integer
algoritma
    harga <- 5000
    total <- total + harga
    output(total)
endprogram`,
          error: "variabel 'total' belum diisi nilainya (belum pernah di-assign atau dibaca lewat input).",
          right: `program Total
kamus
    total, harga : integer
algoritma
    harga <- 5000
    total <- 0
    total <- total + harga
    output(total)
endprogram`,
          explain: "`total <- total + harga` membutuhkan isi `total` yang lama, padahal `total` belum pernah diisi. Beri nilai awal dulu, misalnya `total <- 0`. Kesalahan ini baru muncul saat program **dijalankan**.",
        },
      },
    ],
  },
  {
    id: "konstanta",
    group: "Kamus",
    title: "Konstanta",
    summary: "Nilai tetap yang tidak boleh berubah selama program berjalan.",
    blocks: [
      {
        kind: "p",
        text: "Konstanta mirip variabel, tetapi isinya **ditentukan sekali** di `kamus` dan tidak boleh diubah. Cocok untuk nilai yang memang tetap, seperti π, persentase pajak, atau batas maksimum. Kebiasaan yang baik: tulis nama konstanta dengan huruf besar (`PI`, `PAJAK`) agar mudah dibedakan dari variabel.",
      },
      {
        kind: "p",
        text: "Format: `constant NAMA : tipe = nilai` (boleh juga memakai `<-`).",
      },
      {
        kind: "code",
        example: {
          code: `program Lingkaran
kamus
    constant PI : real = 3.14
    r, luas : real
algoritma
    input(r)
    luas <- PI * r * r
    output(luas)
endprogram`,
          input: "10",
          output: "314",
        },
      },
      {
        kind: "note",
        tone: "tip",
        text: "Keuntungan konstanta: jika suatu saat nilainya perlu diganti (misalnya `PI` menjadi `3.14159`), cukup ubah di satu tempat.",
      },
      {
        kind: "mistake",
        mistake: {
          title: "Mengubah isi konstanta",
          wrong: `program Batas
kamus
    constant MAKS : integer = 10
algoritma
    MAKS <- 20
    output(MAKS)
endprogram`,
          error: "konstanta 'MAKS' tidak boleh diubah nilainya.",
          right: `program Batas
kamus
    constant MAKS : integer = 20
algoritma
    output(MAKS)
endprogram`,
          explain: "Isi konstanta hanya ditentukan di `kamus`. Jika nilainya perlu berubah-ubah, pakai variabel biasa.",
        },
      },
    ],
  },
  {
    id: "tipe-bentukan",
    group: "Kamus",
    title: "Tipe Bentukan (Alias & Struct)",
    summary: "Membuat tipe sendiri: nama lain untuk tipe, atau rekaman berisi beberapa data.",
    blocks: [
      { kind: "h3", text: "Alias: nama lain untuk tipe" },
      {
        kind: "p",
        text: "Format: `type nama_baru : tipe_lama`. Alias tidak membuat tipe baru, hanya memberi nama yang lebih bermakna. Misalnya `type rupiah : integer` membuat kode lebih jelas bahwa variabel tersebut menyimpan uang.",
      },
      { kind: "h3", text: "Struct: satu wadah berisi beberapa data" },
      {
        kind: "p",
        text: "Struct (rekaman) mengelompokkan beberapa data yang saling berkaitan menjadi satu. Bayangkan sebuah **formulir**: satu formulir berisi beberapa isian, misalnya tanggal, bulan, dan tahun. Setiap isian disebut **field**.",
      },
      {
        kind: "list",
        items: [
          "Field ditulis di antara `<` dan `>`, **satu deklarasi per baris**.",
          "Untuk mengakses field, pakai tanda titik: `t.tanggal` artinya *field tanggal milik variabel t*.",
          "Urutan di `kamus` bebas: variabel boleh ditulis sebelum tipe struct-nya.",
        ],
      },
      {
        kind: "code",
        example: {
          code: `program Tanggal
kamus
    type bilangan : integer
    type date <
        tanggal, tahun : bilangan
        bulan : string
    >
    t : date
algoritma
    input(t.tanggal, t.bulan, t.tahun)
    output(t.tanggal, t.bulan, t.tahun)
endprogram`,
          input: "17 Agustus 1945",
          output: "17 Agustus 1945",
        },
      },
      {
        kind: "list",
        items: [
          "Struct tidak bisa langsung di-`input` atau di-`output` seluruhnya. Sebutkan field-nya satu per satu, misalnya `output(t.tanggal, t.bulan)`.",
          "Mengisi struct ke struct lain yang setipe (`t2 <- t1`) **menyalin** seluruh isinya. Mengubah `t2` sesudahnya tidak mengubah `t1`.",
        ],
      },
    ],
  },

  // ======================================================== Instruksi
  {
    id: "assignment",
    group: "Instruksi",
    title: "Pengisian Nilai (Assignment)",
    summary: "Menyimpan nilai ke variabel dengan <- atau =.",
    blocks: [
      {
        kind: "p",
        text: "Assignment artinya **memasukkan nilai ke dalam variabel**. Tulis `variabel <- nilai` dan baca sebagai *variabel diisi dengan nilai*. Tanda `=` juga boleh dipakai dan artinya sama.",
      },
      {
        kind: "p",
        text: "Komputer selalu menghitung **sisi kanan dulu**, baru menyimpan hasilnya ke variabel di sisi kiri. Isi lama variabel itu akan tertimpa.",
      },
      {
        kind: "note",
        tone: "info",
        text: "`x <- x + 1` **bukan** persamaan matematika. Artinya: ambil isi `x` sekarang, tambah 1, lalu simpan kembali ke `x`. Jika `x` berisi 5, sesudahnya `x` berisi 6.",
      },
      {
        kind: "code",
        example: {
          code: `program Tukar
kamus
    a, b, temp : integer
algoritma
    a <- 3
    b <- 8
    temp <- a
    a <- b
    b <- temp
    output(a, b)
endprogram`,
          output: "8 3",
        },
      },
      {
        kind: "table",
        caption: "Isi setiap variabel setelah baris dijalankan:",
        head: ["Instruksi", "a", "b", "temp"],
        rows: [
          ["`a <- 3`", "3", "–", "–"],
          ["`b <- 8`", "3", "8", "–"],
          ["`temp <- a`", "3", "8", "3"],
          ["`a <- b`", "**8**", "8", "3"],
          ["`b <- temp`", "8", "**3**", "3"],
        ],
      },
      {
        kind: "p",
        text: "Kenapa perlu `temp`? Jika langsung menulis `a <- b` lalu `b <- a`, isi `a` yang lama (3) sudah tertimpa 8, sehingga keduanya menjadi 8. Variabel `temp` menyimpan isi lama sementara.",
      },
    ],
  },
  {
    id: "input",
    group: "Instruksi",
    title: "Masukan: input(...)",
    summary: "Meminta nilai dari pengguna dan menyimpannya ke variabel.",
    blocks: [
      {
        kind: "p",
        text: "`input(...)` membuat program **berhenti sejenak dan menunggu** pengguna mengetik nilai. Nilai yang diketik disimpan ke variabel di dalam kurung, sesuai urutannya.",
      },
      {
        kind: "code",
        example: {
          code: `program Jumlah
kamus
    a, b : integer
algoritma
    input(a, b)
    output(a + b)
endprogram`,
          input: "5 3",
          output: "8",
        },
      },
      { kind: "h3", text: "Cara nilai dibaca" },
      {
        kind: "p",
        text: "Masukan dipotong-potong berdasarkan **spasi atau baris baru**, lalu diambil satu per satu untuk setiap variabel. Karena itu, ketiga cara mengetik berikut memberi hasil yang **sama** untuk `input(a, b)`:",
      },
      {
        kind: "table",
        head: ["Yang diketik", "Isi a", "Isi b"],
        rows: [
          ["`5 3` (satu baris)", "5", "3"],
          ["`5` Enter `3` (dua baris)", "5", "3"],
          ["`5      3` (banyak spasi)", "5", "3"],
        ],
      },
      {
        kind: "list",
        items: [
          "Nilai yang diketik harus cocok dengan tipe variabelnya. Mengetik `abc` untuk variabel `integer` menghasilkan error.",
          "Untuk struct, baca per field: `input(p.x, p.y)`.",
          "Boleh menulis beberapa `input` terpisah. Setiap `input` mengambil nilai berikutnya yang belum terpakai.",
        ],
      },
      {
        kind: "note",
        tone: "warning",
        text: "Karena dipotong per spasi, `input` ke variabel `string` hanya membaca **satu kata**. Mengetik `Budi Santoso` ke `input(nama)` membuat `nama` berisi `Budi` saja.",
      },
      {
        kind: "note",
        tone: "tip",
        text: "Di tab **Terminal**, ketik masukan lalu tekan Enter saat program menunggu. Di **Test Case**, tulis semua masukan sekaligus di kolom *Input* agar tidak perlu mengetik ulang setiap kali menguji.",
      },
      {
        kind: "mistake",
        mistake: {
          title: "Masukan kurang dari jumlah variabel",
          wrong: `program Jumlah
kamus
    a, b : integer
algoritma
    input(a, b)
    output(a + b)
endprogram`,
          input: "5",
          error: "masukan (input) habis terlalu cepat sebelum semua variabel terbaca.",
          right: `program Jumlah
kamus
    a, b : integer
algoritma
    input(a, b)
    output(a + b)
endprogram`,
          explain: "Program meminta dua nilai (`a` dan `b`) tetapi hanya diberi satu (`5`). Kodenya sudah benar; berikan dua nilai, misalnya `5 3`.",
        },
      },
    ],
  },
  {
    id: "output",
    group: "Instruksi",
    title: "Keluaran: output(...)",
    summary: "Menampilkan teks dan nilai ke layar.",
    blocks: [
      {
        kind: "p",
        text: "`output(...)` menampilkan nilai-nilai di dalam kurung ke layar. Nilai dipisahkan **koma** di dalam kode, dan ditampilkan dengan **satu spasi** di antaranya. Setiap `output` menghasilkan satu baris baru.",
      },
      {
        kind: "code",
        example: {
          code: `program Cetak
kamus
    nama : string
    umur : integer
algoritma
    nama <- "Rina"
    umur <- 20
    output("Nama:", nama)
    output("Umur:", umur, "tahun")
    output("Tahun depan:", umur + 1)
endprogram`,
          output: `Nama: Rina
Umur: 20 tahun
Tahun depan: 21`,
        },
      },
      {
        kind: "p",
        text: "Perhatikan: teks di dalam petik ditampilkan apa adanya, sedangkan nama variabel diganti dengan **isinya**. Ekspresi seperti `umur + 1` dihitung dulu baru ditampilkan.",
      },
      { kind: "h3", text: "Cara setiap tipe ditampilkan" },
      {
        kind: "table",
        head: ["Tipe", "Nilai", "Tampil sebagai"],
        rows: [
          ["`real` bernilai bulat", "`314.0`", "`314` (tanpa `.0`)"],
          ["`real` pecahan", "`10 / 4`", "`2.5`"],
          ["`real` pecahan panjang", "`1 / 3`", "`0.3333333333333333`"],
          ["`char`", "`'A'`", "`A`"],
          ["`boolean`", "`5 > 3`", "`true`"],
        ],
      },
      {
        kind: "mistake",
        mistake: {
          title: "Lupa koma di antara nilai",
          wrong: `program Cetak
kamus
    x : integer
algoritma
    x <- 7
    output("x =" x)
endprogram`,
          error: "diharapkan tanda ')' untuk menutup 'output(...)'.",
          right: `program Cetak
kamus
    x : integer
algoritma
    x <- 7
    output("x =", x)
endprogram`,
          explain: "Setiap nilai di dalam `output` harus dipisahkan koma. Tanpa koma, compiler mengira `output` sudah selesai setelah `\"x =\"` lalu bingung menemukan `x`.",
        },
      },
    ],
  },

  // ======================================================== Ekspresi
  {
    id: "operator",
    group: "Ekspresi",
    title: "Operator",
    summary: "Menghitung, membandingkan, dan menggabungkan nilai.",
    blocks: [
      { kind: "h3", text: "Aritmetika (hitung-hitungan)" },
      {
        kind: "table",
        head: ["Operator", "Arti", "Contoh", "Hasil"],
        rows: [
          ["`+`", "tambah", "`7 + 2`", "`9`"],
          ["`-`", "kurang", "`7 - 2`", "`5`"],
          ["`*`", "kali", "`7 * 2`", "`14`"],
          ["`/`", "bagi, hasilnya **selalu** `real`", "`7 / 2`", "`3.5`"],
          ["`div`", "bagi lalu buang sisanya (hasil bulat)", "`7 div 2`", "`3`"],
          ["`mod`", "sisa pembagian", "`7 mod 2`", "`1`"],
          ["`^`", "pangkat", "`2 ^ 3`", "`8`"],
        ],
      },
      {
        kind: "p",
        text: "**div dan mod** sering dipakai bersama. Bayangkan membagi 7 permen ke 2 anak: setiap anak mendapat `7 div 2` = 3 permen, dan sisa `7 mod 2` = 1 permen.",
      },
      {
        kind: "list",
        items: [
          "Cek genap/ganjil: `n mod 2 == 0` bernilai `true` jika `n` genap.",
          "Ambil digit terakhir: `1234 mod 10` = `4`.",
          "Buang digit terakhir: `1234 div 10` = `123`.",
          "Ubah menit ke jam: `135 div 60` = 2 jam, `135 mod 60` = 15 menit.",
        ],
      },
      { kind: "h3", text: "Perbandingan (hasilnya true/false)" },
      {
        kind: "table",
        head: ["Operator", "Arti", "Contoh", "Hasil"],
        rows: [
          ["`==`", "sama dengan", "`5 == 5`", "`true`"],
          ["`!=` atau `<>`", "tidak sama dengan", "`5 != 3`", "`true`"],
          ["`<`", "kurang dari", "`5 < 3`", "`false`"],
          ["`<=`", "kurang dari atau sama dengan", "`5 <= 5`", "`true`"],
          ["`>`", "lebih dari", "`5 > 3`", "`true`"],
          ["`>=`", "lebih dari atau sama dengan", "`3 >= 5`", "`false`"],
        ],
      },
      {
        kind: "note",
        tone: "warning",
        text: "Untuk **membandingkan** pakai `==` (dua tanda sama dengan). Satu tanda `=` artinya **mengisi** nilai, sama seperti `<-`.",
      },
      { kind: "h3", text: "Logika (menggabungkan kondisi)" },
      {
        kind: "table",
        head: ["Operator", "Arti", "Contoh", "Hasil"],
        rows: [
          ["`and`", "keduanya harus benar", "`(5 > 3) and (2 > 4)`", "`false`"],
          ["`or`", "salah satu cukup benar", "`(5 > 3) or (2 > 4)`", "`true`"],
          ["`not`", "membalik benar/salah", "`not (5 > 3)`", "`false`"],
        ],
      },
      {
        kind: "p",
        text: "Contoh: nilai berada di antara 0 dan 100 ditulis `nilai >= 0 and nilai <= 100`.",
      },
      { kind: "h3", text: "Teks" },
      {
        kind: "list",
        items: [
          '`+` pada dua teks akan **menyambung** keduanya: `"Halo" + " " + "Dunia"` → `Halo Dunia`.',
          '`len(s)` menghitung jumlah karakter teks `s`: `len("Halo")` → `4`.',
        ],
      },
      {
        kind: "code",
        example: {
          code: `program Operator
kamus
    menit : integer
    s : string
algoritma
    menit <- 135
    output(menit div 60, "jam", menit mod 60, "menit")
    output(17 / 5, 17 div 5, 17 mod 5)
    s <- "Halo" + " " + "Dunia"
    output(s, len(s))
endprogram`,
          output: `2 jam 15 menit
3.4 3 2
Halo Dunia 10`,
        },
      },
      {
        kind: "note",
        tone: "info",
        text: "Untuk tingkat lanjut juga tersedia operator bit `<<`, `>>`, `&`, dan `|` (misalnya `5 << 2` → `20`).",
      },
    ],
  },
  {
    id: "prioritas",
    group: "Ekspresi",
    title: "Urutan Perhitungan",
    summary: "Operator mana yang dihitung lebih dulu.",
    blocks: [
      {
        kind: "p",
        text: "Sama seperti di matematika, perkalian dihitung sebelum penjumlahan: `2 + 3 * 4` hasilnya `14`, bukan `20`. Gunakan tanda kurung untuk mengubah urutan: `(2 + 3) * 4` hasilnya `20`.",
      },
      {
        kind: "table",
        head: ["Urutan", "Operator", "Keterangan"],
        rows: [
          ["1 (paling dulu)", "`( )`, `len(...)`", "isi kurung dihitung paling awal"],
          ["2", "`^`", "pangkat; `2 ^ 3 ^ 2` dihitung dari kanan = `2 ^ 9` = `512`"],
          ["3", "`-` di depan angka", "misalnya `-5`"],
          ["4", "`*` `/` `div` `mod`", "dihitung dari kiri ke kanan"],
          ["5", "`+` `-`", "dihitung dari kiri ke kanan"],
          ["6", "`<` `<=` `>` `>=` `==` `!=`", "perbandingan"],
          ["7", "`not`", ""],
          ["8", "`and`", ""],
          ["9 (paling akhir)", "`or`", ""],
        ],
      },
      {
        kind: "note",
        tone: "tip",
        text: "Jika ragu, tambahkan tanda kurung. Kurung yang berlebih tidak membuat program salah, tetapi membuatnya lebih mudah dibaca.",
      },
    ],
  },

  // ======================================================== Kontrol alur
  {
    id: "if",
    group: "Kontrol Alur",
    title: "Percabangan: if",
    summary: "Menjalankan instruksi hanya jika suatu kondisi terpenuhi.",
    blocks: [
      {
        kind: "p",
        text: "Percabangan membuat program bisa **memilih**. Seperti di kehidupan sehari-hari: *jika hujan, bawa payung; jika tidak, pakai topi*. Kondisinya harus bernilai `true` atau `false`, biasanya berupa perbandingan.",
      },
      { kind: "h3", text: "Bentuk 1: if-then (hanya jika benar)" },
      {
        kind: "code",
        example: {
          code: `if nilai >= 75 then
    output("Lulus")
endif`,
        },
      },
      { kind: "h3", text: "Bentuk 2: if-then-else (dua pilihan)" },
      {
        kind: "code",
        example: {
          code: `if n mod 2 == 0 then
    output("Genap")
else
    output("Ganjil")
endif`,
        },
      },
      { kind: "h3", text: "Bentuk 3: else if (banyak pilihan)" },
      {
        kind: "p",
        text: "Kondisi diperiksa **dari atas ke bawah**. Begitu satu kondisi benar, blok itu dijalankan dan sisanya dilewati. Jika tidak ada yang benar, blok `else` yang dijalankan.",
      },
      {
        kind: "code",
        example: {
          code: `program NilaiHuruf
kamus
    n : integer
algoritma
    input(n)
    if n >= 80 then
        output("A")
    else if n >= 70 then
        output("B")
    else if n >= 60 then
        output("C")
    else
        output("D")
    endif
endprogram`,
          input: "75",
          output: "B",
        },
      },
      {
        kind: "p",
        text: "Dengan masukan `75`: kondisi `75 >= 80` salah, lanjut ke `75 >= 70` yang benar, jadi tampil `B` dan pemeriksaan berhenti.",
      },
      {
        kind: "note",
        tone: "warning",
        text: "`else if` harus ditulis **dalam satu baris**. Jika `if` ditaruh di baris baru setelah `else`, itu dianggap `if` baru di dalam `else` dan membutuhkan `endif` sendiri.",
      },
      {
        kind: "mistake",
        mistake: {
          title: "Memakai = untuk membandingkan",
          wrong: `program Cek
kamus
    x : integer
algoritma
    input(x)
    if x = 5 then
        output("lima")
    endif
endprogram`,
          error: "diharapkan kata kunci 'then' sesudah kondisi 'if'.",
          right: `program Cek
kamus
    x : integer
algoritma
    input(x)
    if x == 5 then
        output("lima")
    endif
endprogram`,
          explain: "Satu `=` artinya *mengisi*, bukan *membandingkan*. Untuk memeriksa apakah sama, pakai `==`.",
        },
      },
      {
        kind: "mistake",
        mistake: {
          title: "Lupa menutup dengan endif",
          wrong: `program Cek
kamus
    x : integer
algoritma
    input(x)
    if x > 0 then
        output("positif")
endprogram`,
          error: "kata kunci 'endif' tidak ditemukan untuk menutup percabangan 'if'.",
          right: `program Cek
kamus
    x : integer
algoritma
    input(x)
    if x > 0 then
        output("positif")
    endif
endprogram`,
          explain: "Setiap `if` wajib ditutup `endif`. Editor menandai baris `if` yang belum ditutup.",
        },
      },
    ],
  },
  {
    id: "for",
    group: "Kontrol Alur",
    title: "Perulangan: for",
    summary: "Mengulang sejumlah kali yang sudah diketahui, menghitung naik (to) atau mundur (downto).",
    blocks: [
      {
        kind: "p",
        text: "Pakai `for` jika **jumlah pengulangan sudah diketahui**, misalnya *tampilkan angka 1 sampai 5* atau *baca 10 nilai*. Variabel pencacah (biasanya `i`) otomatis bertambah 1 setiap putaran.",
      },
      {
        kind: "code",
        example: {
          code: `program Kuadrat
kamus
    i : integer
algoritma
    for i <- 1 to 4 do
        output(i, "x", i, "=", i * i)
    endfor
endprogram`,
          output: `1 x 1 = 1
2 x 2 = 4
3 x 3 = 9
4 x 4 = 16`,
        },
      },
      {
        kind: "table",
        caption: "Yang terjadi di setiap putaran:",
        head: ["Putaran", "Isi i", "Yang ditampilkan"],
        rows: [
          ["1", "1", "`1 x 1 = 1`"],
          ["2", "2", "`2 x 2 = 4`"],
          ["3", "3", "`3 x 3 = 9`"],
          ["4", "4", "`4 x 4 = 16`"],
          ["–", "selesai", "karena `i` sudah mencapai 4 (nilai akhir ikut dihitung)"],
        ],
      },
      { kind: "h3", text: "Menghitung mundur: downto" },
      {
        kind: "p",
        text: "`to` menghitung **naik** (i bertambah 1). Untuk menghitung **turun**, ganti `to` dengan `downto`: `i` berkurang 1 setiap putaran. Nilai akhir tetap ikut dihitung.",
      },
      {
        kind: "code",
        example: {
          code: `program HitungMundur
kamus
    i : integer
algoritma
    for i <- 5 downto 1 do
        output(i)
    endfor
    output("Selesai!")
endprogram`,
          output: `5
4
3
2
1
Selesai!`,
        },
      },
      {
        kind: "note",
        tone: "warning",
        text: "`for i <- 5 to 1 do` **tidak** menghitung mundur. Karena 5 sudah lebih besar dari 1, perulangannya tidak berjalan sama sekali. Editor akan memberi peringatan dan menyarankan `downto`.",
      },
      { kind: "h3", text: "Langkah selain 1: step" },
      {
        kind: "p",
        text: "Tambahkan `step` untuk mengubah besar langkah. Pada `to`, step adalah **besar penambahan**. Pada `downto`, step adalah **besar pengurangan**, jadi tetap ditulis positif.",
      },
      {
        kind: "code",
        example: {
          code: `program Loncat
kamus
    i : integer
algoritma
    for i <- 0 to 10 step 5 do
        output("naik", i)
    endfor
    for i <- 10 downto 0 step 5 do
        output("turun", i)
    endfor
endprogram`,
          output: `naik 0
naik 5
naik 10
turun 10
turun 5
turun 0`,
        },
      },
      {
        kind: "table",
        head: ["Kode", "Nilai i berturut-turut"],
        rows: [
          ["`for i <- 1 to 5 do`", "1, 2, 3, 4, 5"],
          ["`for i <- 5 downto 1 do`", "5, 4, 3, 2, 1"],
          ["`for i <- 1 to 9 step 2 do`", "1, 3, 5, 7, 9"],
          ["`for i <- 9 downto 1 step 2 do`", "9, 7, 5, 3, 1"],
          ["`for i <- 5 to 1 do`", "tidak berjalan (5 sudah melewati 1)"],
        ],
      },
      { kind: "h3", text: "Contoh: menjumlahkan beberapa angka" },
      {
        kind: "code",
        example: {
          code: `program JumlahN
kamus
    n, i, x, total : integer
algoritma
    input(n)
    total <- 0
    for i <- 1 to n do
        input(x)
        total <- total + x
    endfor
    output("Total:", total)
endprogram`,
          input: `3
10 20 30`,
          output: "Total: 60",
        },
      },
      {
        kind: "list",
        items: [
          "Pencacah, nilai awal, nilai akhir, dan step harus bertipe `integer`.",
          "Jika nilai awal sudah melewati nilai akhir (misalnya `for i <- 5 to 1`, atau `for i <- 1 downto 5`), badan perulangan tidak dijalankan sama sekali.",
          "Pada `downto`, step harus positif. `step -2` adalah error; tulis `step 2`.",
          "Jangan mengubah isi `i` di dalam perulangan. Editor akan memberi peringatan karena jumlah putaran bisa kacau.",
        ],
      },
      {
        kind: "mistake",
        mistake: {
          title: "Lupa kata kunci do",
          wrong: `program Ulang
kamus
    i : integer
algoritma
    for i <- 1 to 3
        output(i)
    endfor
endprogram`,
          error: "diharapkan kata kunci 'do' sesudah nilai batas akhir (atau 'step') perulangan 'for'.",
          right: `program Ulang
kamus
    i : integer
algoritma
    for i <- 1 to 3 do
        output(i)
    endfor
endprogram`,
          explain: "Baris `for` selalu diakhiri `do`, dan perulangannya ditutup `endfor`.",
        },
      },
    ],
  },
  {
    id: "while",
    group: "Kontrol Alur",
    title: "Perulangan: while",
    summary: "Mengulang selama kondisi masih benar.",
    blocks: [
      {
        kind: "p",
        text: "Pakai `while` jika **jumlah pengulangan belum diketahui**, tetapi Anda tahu kapan harus berhenti. Bacanya: *selama kondisi benar, ulangi*. Kondisi diperiksa **sebelum** setiap putaran, jadi jika sejak awal kondisinya salah, badan perulangan tidak dijalankan sama sekali.",
      },
      {
        kind: "code",
        example: {
          code: `program JumlahDigit
kamus
    n, jumlah : integer
algoritma
    input(n)
    jumlah <- 0
    while n > 0 do
        jumlah <- jumlah + n mod 10
        n <- n div 10
    endwhile
    output(jumlah)
endprogram`,
          input: "1234",
          output: "10",
        },
      },
      {
        kind: "table",
        caption: "Dengan masukan 1234, setiap putaran mengambil digit terakhir lalu membuangnya:",
        head: ["Putaran", "n di awal", "n mod 10", "jumlah", "n div 10"],
        rows: [
          ["1", "1234", "4", "4", "123"],
          ["2", "123", "3", "7", "12"],
          ["3", "12", "2", "9", "1"],
          ["4", "1", "1", "10", "0"],
          ["–", "0", "", "", "berhenti, karena `0 > 0` salah"],
        ],
      },
      {
        kind: "mistake",
        mistake: {
          title: "Perulangan yang tidak pernah berhenti",
          wrong: `program Hitung
kamus
    x : integer
algoritma
    x <- 1
    while x <= 3 do
        output(x)
    endwhile
endprogram`,
          error: "batas maksimum langkah eksekusi (500000) terlampaui (kemungkinan perulangan tak berujung).",
          right: `program Hitung
kamus
    x : integer
algoritma
    x <- 1
    while x <= 3 do
        output(x)
        x <- x + 1
    endwhile
endprogram`,
          explain: "Isi `x` tidak pernah berubah, sehingga `x <= 3` selalu benar dan perulangan berjalan terus. Pastikan ada instruksi di dalam perulangan yang membuat kondisinya suatu saat menjadi salah.",
        },
      },
    ],
  },
  {
    id: "repeat",
    group: "Kontrol Alur",
    title: "Perulangan: repeat-until",
    summary: "Mengulang sampai kondisi menjadi benar (minimal sekali).",
    blocks: [
      {
        kind: "p",
        text: "Bacanya: *ulangi ... sampai kondisi benar*. Bedanya dengan `while`: badan perulangan dijalankan **dulu**, baru kondisinya diperiksa di akhir. Jadi badan perulangan **selalu dijalankan minimal satu kali**. Perulangan **berhenti** saat kondisi bernilai `true`.",
      },
      {
        kind: "p",
        text: "Contoh yang paling cocok: meminta masukan sampai masukannya benar.",
      },
      {
        kind: "code",
        example: {
          code: `program Validasi
kamus
    x : integer
algoritma
    repeat
        input(x)
    until x > 0
    output("Bilangan positif:", x)
endprogram`,
          input: `-3
0
8`,
          output: "Bilangan positif: 8",
        },
      },
      {
        kind: "p",
        text: "Masukan `-3` dan `0` ditolak karena `x > 0` masih salah, sehingga program meminta lagi. Saat masukan `8`, kondisi menjadi benar dan perulangan berhenti. Tidak ada `endrepeat`, karena baris `until` sudah menjadi penutupnya.",
      },
    ],
  },
  {
    id: "memilih-perulangan",
    group: "Kontrol Alur",
    title: "Memilih Perulangan yang Tepat",
    summary: "Kapan memakai for, while, atau repeat-until.",
    blocks: [
      {
        kind: "table",
        head: ["", "for", "while", "repeat-until"],
        rows: [
          ["Pakai jika", "jumlah putaran sudah diketahui", "berhenti berdasarkan kondisi", "berhenti berdasarkan kondisi, minimal jalan sekali"],
          ["Kondisi diperiksa", "otomatis oleh pencacah", "di **awal** putaran", "di **akhir** putaran"],
          ["Bisa jalan 0 kali?", "ya", "ya", "tidak, minimal 1 kali"],
          ["Berhenti saat", "pencacah melewati nilai akhir", "kondisi menjadi `false`", "kondisi menjadi `true`"],
          ["Contoh", "tampilkan 1 sampai 10 (`to`), atau 10 sampai 1 (`downto`)", "jumlahkan digit sebuah angka", "minta masukan sampai valid"],
        ],
      },
    ],
  },

  // ======================================================== Contoh lengkap
  {
    id: "contoh-lengkap",
    group: "Latihan",
    title: "Contoh Program Lengkap",
    summary: "Menggabungkan input, perulangan, percabangan, dan output.",
    blocks: [
      {
        kind: "p",
        text: "Program ini membaca jumlah siswa dan nilai masing-masing, lalu menampilkan rata-rata, nilai tertinggi, dan berapa siswa yang lulus (nilai minimal 75).",
      },
      {
        kind: "code",
        example: {
          code: `program RekapNilai
kamus
    constant BATAS_LULUS : integer = 75
    n, i, nilai, total, tertinggi, lulus : integer
    rata : real
algoritma
    input(n)
    total <- 0
    lulus <- 0
    tertinggi <- 0
    for i <- 1 to n do
        input(nilai)
        total <- total + nilai
        if nilai > tertinggi then
            tertinggi <- nilai
        endif
        if nilai >= BATAS_LULUS then
            lulus <- lulus + 1
        endif
    endfor
    rata <- total / n
    output("Rata-rata:", rata)
    output("Tertinggi:", tertinggi)
    output("Lulus:", lulus, "dari", n, "siswa")
endprogram`,
          input: `4
80 65 90 75`,
          output: `Rata-rata: 77.5
Tertinggi: 90
Lulus: 3 dari 4 siswa`,
        },
      },
      {
        kind: "steps",
        items: [
          "`input(n)` membaca jumlah siswa (4).",
          "Variabel penghitung (`total`, `lulus`, `tertinggi`) diberi nilai awal 0.",
          "`for` diulang 4 kali. Setiap putaran membaca satu nilai, menambahkannya ke `total`, memperbarui `tertinggi` jika nilai ini lebih besar, dan menambah `lulus` jika nilainya minimal 75.",
          "Setelah perulangan, rata-rata dihitung dengan `/` sehingga hasilnya `real` (310 / 4 = 77.5).",
          "Ketiga hasil ditampilkan dengan `output`.",
        ],
      },
      {
        kind: "note",
        tone: "tip",
        text: "Coba ubah program ini sendiri: tambahkan nilai terendah, atau tampilkan *Tidak ada yang lulus* jika `lulus` bernilai 0.",
      },
    ],
  },

  // ======================================================== Alat bantu
  {
    id: "error-peringatan",
    group: "Alat Bantu Editor",
    title: "Error & Peringatan",
    summary: "Cara membaca tanda merah dan kuning di editor.",
    blocks: [
      {
        kind: "p",
        text: "Editor memeriksa kode **saat Anda mengetik**. Jika ada masalah, Anda akan melihat:",
      },
      {
        kind: "list",
        items: [
          "**Garis bergelombang** di bawah bagian yang bermasalah.",
          "**Pesan** di ujung baris yang menjelaskan masalahnya.",
          "**Ikon** di sebelah nomor baris (⊗ untuk error, ⚠ untuk peringatan).",
          "**Daftar semua masalah** di tab **Masalah**. Klik salah satunya untuk langsung menuju barisnya.",
        ],
      },
      {
        kind: "table",
        head: ["Jenis", "Arti", "Contoh"],
        rows: [
          ["**Kesalahan sintaks** (merah)", "Cara menulisnya tidak sesuai aturan. Program belum bisa dijalankan.", "lupa `then`, `endif`, tanda `:`, atau koma"],
          ["**Kesalahan tipe/deklarasi** (merah)", "Tulisannya benar, tetapi maknanya salah. Program belum bisa dijalankan.", "variabel belum didaftarkan, mengisi teks ke variabel angka"],
          ["**Kesalahan saat berjalan** (merah)", "Baru ketahuan ketika program dijalankan.", "pembagian dengan nol, masukan kurang, variabel belum diisi"],
          ["**Peringatan** (kuning)", "Program tetap bisa jalan, tetapi mungkin ada yang keliru.", "variabel tidak pernah dipakai, `while true` yang tidak berhenti"],
        ],
      },
      { kind: "h3", text: "Langkah memperbaiki error" },
      {
        kind: "steps",
        items: [
          "Mulai dari error **paling atas**. Kadang satu kesalahan menyebabkan error lain di bawahnya, dan semuanya hilang setelah yang pertama diperbaiki.",
          "Baca pesannya baik-baik. Pesan biasanya menyebut apa yang **diharapkan** (misalnya *diharapkan kata kunci 'then'*).",
          "Lihat baris yang ditandai **dan baris sebelumnya**. Jika ada yang kurang (seperti `then` atau koma), letaknya bisa di ujung baris sebelumnya.",
          "Perbaiki, lalu lihat apakah tandanya hilang. Pemeriksaan berjalan otomatis setelah Anda berhenti mengetik.",
        ],
      },
    ],
  },
  {
    id: "test-case",
    group: "Alat Bantu Editor",
    title: "Test Case",
    summary: "Menguji program dengan banyak masukan sekaligus.",
    blocks: [
      {
        kind: "p",
        text: "Daripada menjalankan program lalu mengetik masukan berulang-ulang, simpan beberapa pasangan *masukan* dan *keluaran yang diharapkan* sebagai **test case**. Program akan diuji dengan semuanya sekaligus.",
      },
      {
        kind: "steps",
        items: [
          "Klik **+ Kasus** untuk menambah baris.",
          "Isi kolom **Input** dengan semua masukan, persis seperti yang akan diketik di Terminal.",
          "Isi kolom **Output Diharapkan** dengan hasil yang benar.",
          "Klik **Jalankan Tes** (atau `Ctrl + Shift + Enter`) untuk menguji semua kasus, atau ▶ untuk satu kasus saja.",
          "Lihat kolom **Status**: **Lulus** berarti keluaran program sama persis dengan yang diharapkan. **Salah** berarti berbeda; bandingkan kolom *Output Program* dengan *Output Diharapkan*.",
        ],
      },
      {
        kind: "list",
        items: [
          "Spasi di akhir baris dan baris kosong di akhir keluaran diabaikan saat membandingkan.",
          "Kosongkan *Output Diharapkan* jika hanya ingin melihat keluarannya tanpa dibandingkan.",
          "Uji juga kasus-kasus khusus, seperti angka 0, angka negatif, atau nilai tepat di batas (misalnya tepat 75 untuk batas lulus).",
        ],
      },
    ],
  },
  {
    id: "shortcut",
    group: "Alat Bantu Editor",
    title: "Pintasan Keyboard",
    summary: "Tombol cepat di editor.",
    blocks: [
      {
        kind: "table",
        head: ["Tombol", "Fungsi"],
        rows: [
          ["`Ctrl + Enter`", "Jalankan program (atau hentikan jika sedang berjalan)"],
          ["`Ctrl + Shift + Enter`", "Jalankan semua test case"],
          ["`Tab` / `Shift + Tab`", "Tambah / kurangi indentasi 4 spasi"],
          ["`Enter`", "Baris baru dengan indentasi yang sama seperti baris sebelumnya"],
        ],
      },
    ],
  },
  {
    id: "kata-kunci",
    group: "Referensi",
    title: "Daftar Kata Kunci",
    summary: "Kata yang sudah dipakai bahasa dan tidak bisa menjadi nama variabel.",
    blocks: [
      {
        kind: "table",
        head: ["Kelompok", "Kata kunci"],
        rows: [
          ["Struktur", "`program` `kamus` `algoritma` `endprogram`"],
          ["Deklarasi", "`constant` `type`"],
          ["Tipe", "`integer` `real` `string` `char` `boolean`"],
          ["Nilai", "`true` `false`"],
          ["Masukan/Keluaran", "`input` `output`"],
          ["Percabangan", "`if` `then` `else` `endif`"],
          ["Perulangan", "`for` `to` `downto` `step` `do` `endfor` `while` `endwhile` `repeat` `until`"],
          ["Operator", "`div` `mod` `and` `or` `not` `len`"],
        ],
      },
      {
        kind: "p",
        text: "Semua kata kunci ditulis dengan **huruf kecil**.",
      },
    ],
  },
];
