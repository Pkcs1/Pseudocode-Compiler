---
name: soal-struktur-data
description: Buat soal Struktur Data (CDK2AAB4) dalam pseudocode — kuis kecil, tugas, kuis besar, atau UTS — lengkap dengan kunci, rubrik 100 poin, dan kunci yang diuji simulasi.
---

# Soal Struktur Data (CDK2AAB4)

Skill ini menghasilkan paket soal Struktur Data untuk kelas Telkom University: soal, kunci jawaban, rubrik, dan data uji. Semua dalam Bahasa Indonesia, memakai notasi pseudocode yang sama dengan slide dan soal-soal sebelumnya di Project "Quiz Kecil".

## Langkah 0 — Baca materi di Project dulu

Sebelum menulis apa pun, baca dokumen Project yang relevan dengan topik yang diminta (Projects → `project_read` / `project_search`). Dokumen acuan yang sudah ada:

| Topik | Dokumen |
|---|---|
| Pointer | `claude/kunci-tugas-pointer.md` |
| ADT (record, konstruktor, getter/setter) | `claude/kunci-tugas-adt-clock.md` |
| SLL dasar & terurut | `claude/kunci-tugas-sll.md`, `claude/kunci-tugas-adt-sll.md` |
| SLL studi kasus (tracing + function) | `claude/soal-uts-strukdat-sll-ular-rakus-2-soal.md` |
| Stack array | `claude/kuis-strukdat-stack-hapus-huruf-i.md`, `claude/soal-strukdat-stack-roblox.md` |
| Gabungan SLL, DLL, Stack, Queue | `claude/soal-3-strukdat-stack-fakta-queen-elizabeth.md`, `claude/soal-uts-strukdat-nadaku-sll-dll-queue-stack.md` |
| Format ujian fakultas | `template-soal-ujian-fakultas-informatika-rev-2020.docx` |

Ambil dari situ: notasi, nama primitif, bentuk header, dan **tema yang sudah dipakai** (Roblox naik gunung, Clean the Superstore, Ular Rakus, NadaKu, Playlist Campur Aduk, Fakta Queen Elizabeth, Apotek Telkomedika). Jangan memakai ulang tema atau data uji yang sama kecuali diminta.

Jika user melampirkan slide atau soal baru, notasi dari lampiran itu yang menang.

Template prompt untuk user ada di `templates/prompt-template.md`.

## Langkah 1 — Pastikan parameter

Parameter yang menentukan bentuk soal (tanyakan hanya yang belum jelas dari permintaan, sekaligus dalam satu pertanyaan):

| Parameter | Pilihan / default |
|---|---|
| Jenis asesmen | kuis kecil (±15 menit, 1 soal) · tugas · kuis besar · UTS/UAS (120 menit) |
| Topik | Pointer · ADT · SLL · DLL · Queue · Stack (boleh gabungan) |
| Tipe soal | PG · tracing/isian (tabel keadaan, gambar list) · tulis pseudocode (procedure/function) |
| Jumlah versi | default 1; kuis kecil biasanya 3 versi berbeda (satu per kelas), setara tingkat kesulitannya |
| Tema / studi kasus | user menentukan, atau usulkan 2–3 tema baru yang dekat dengan mahasiswa |
| Tingkat kesulitan | mudah / sedang / sulit — "lebih mudah" berarti lebih sedikit soal, header diberikan, contoh lebih banyak |
| Format keluaran | DOCX + PDF (template fakultas untuk UTS/kuis besar) · PPTX (kuis kecil di deck slide) · Markdown |

## Langkah 2 — Konvensi notasi (wajib konsisten dalam satu paket)

**Umum (gaya soal UTS terbaru):** `=` assignment, `==` / `!=` perbandingan, `P → next`, `L.first`, `( P → info ).judul`, `allocate( P )`, `deallocate( P )`, `return P`, `NIL`, `while … do … endwhile`, `if … then … else … endif`, `for i = 1 to n do … endfor`, `kamus` / `algoritma`, `endprocedure` / `endfunction`, parameter `in` / `out` / `in/out`.

**Variasi yang diterima di kunci** (tulis di catatan penilaian): `←` untuk assignment, `P^.next`, `next(P)`/`first(L)`, `Dictionary`/`Algorithm`.

**ADT standar:**

```
{ SLL }
type adr : pointer to elmList
type elmList : < info : infotype, next : adr >
type List : < first : adr >

{ DLL }
type adrDLL : pointer to elmDLL
type elmDLL : < info : infotype, next, prev : adrDLL >
type ListDLL : < first, last : adrDLL >

{ Queue — di kelas diajarkan sebagai linked list mirip DLL }
type Queue : < head, tail : adrDLL >
{ enqueue di tail, dequeue di head }

{ Stack — representasi array }
constant MAXSIZE : integer = 20
type Stack : < info : array [1..MAXSIZE] of infotype, top : integer >
```

**Primitif yang biasanya diberikan di soal:**
- SLL: `createList`, `newElm`/`createElm` (function → adr), `insertFirst`, `insertLast`, `insertAfter`, `deleteFirst`, `deleteLast`, `deleteAfter`, `cari…` (function → adr)
- DLL: `createListDLL`, `newElmDLL`, `deleteFirstDLL`, `deleteLastDLL`
- Queue: `createQueue`, `isEmptyQueue`, `size`, `front`, `enqueue( in/out Q, in P )`, `dequeue( in/out Q, out P )`
- Stack: `createStack( ) → Stack`, `isEmpty`, `isFull`, `peek`, `size`, `push( in/out S, in x )`, `pop( in/out S, in/out x )`

Pointer (materi awal) memakai gaya `←`, `&x`, `*p` dengan alamat ditulis `x100`, `x200`, ….

## Langkah 3 — Pilih pola soal

Pola yang sudah terbukti di kelas. Kombinasikan sesuai waktu.

| Topik | Pola | Contoh di Project |
|---|---|---|
| Pointer | tabel nilai variabel per baris; gambar perubahan memori per blok | Tugas Pointer |
| ADT | konstruktor + validasi, getter/setter, operasi gabungan (add, isEqual) | ADT Clock |
| SLL | lengkapi primitif; insertAscending; cari + hapus dengan kondisi; tracing pemanggilan berturut-turut; function cek (tabrakan) | Ular Rakus, Tugas SLL |
| SLL | pisahkan list jadi dua berdasar kriteria (deleteFirst → insertLast) | pisahArtis |
| DLL | hapus berdasar kunci (4 kasus: satu elemen, first, last, tengah); tukar/naikkan posisi dengan tabel alamat @100–@400 | hapusLagu, naikkan |
| Queue | tracing enqueue/dequeue + isi akhir + gambar head/tail; temukan bug dequeue (tail tidak di-NIL-kan) | Apotek, NadaKu B3 |
| Stack | pop sampai kondisi (tanpa stack bantu); filter dengan stack bantu lalu kembalikan urutan; pindah antar stack sampai penuh/kosong; rotasi top ke bottom | hapusHurufI, Roblox |
| Gabungan | pindah elemen dari satu struktur ke struktur lain (DLL → Queue, Stack → SLL tanpa duplikat) | antreLagu, unduhRiwayat |

**Alokasi waktu acuan:** PG ±1,5 menit/soal · tracing/isian ±10 menit/soal · tulis procedure ±15–30 menit/soal · baca cerita ±5–10 menit. Total estimasi harus ≤ 90% waktu ujian.

**Bobot acuan UTS 120 menit:** A PG 10 × 2 = 20 · B isian 4 × 10 = 40 · C pseudocode 2 × 20 = 40.

## Langkah 4 — Tulis soal

Setiap soal pseudocode memuat:
1. **Cerita singkat** yang menjelaskan untuk apa struktur datanya dipakai.
2. **Kotak kamus + primitif** yang boleh langsung dipakai (mahasiswa tidak perlu menulis ulang isinya).
3. **Header procedure/function** atau setidaknya nama + parameter, plus **I.S. / F.S.**
4. **Aturan tampilan layar** bila ada output — kalimat persis, urutan, kapan pesan muncul.
5. **Contoh masukan → keluaran** yang **berbeda** dari data yang akan ditanyakan, agar tidak membocorkan jawaban.
6. Kasus tepi yang harus ditangani disebut eksplisit atau tersirat di contoh: list/stack/queue kosong, satu elemen, elemen di first/last, data tidak ditemukan, stack penuh.

Soal tracing memakai data awal yang ditentukan, pemanggilan berturut-turut, dan tabel isian. Tegaskan apakah tiap baris dimulai dari keadaan awal atau melanjutkan baris sebelumnya.

PG: satu jawaban benar, pengecoh berasal dari miskonsepsi nyata (urutan sambung pointer tertukar, `q → next != NIL` di Show, LIFO/FIFO tertukar, lupa memperbarui last/tail). Sebar kunci PG (jangan berpola).

## Langkah 5 — Kunci, rubrik, dan catatan pemeriksa

**Kunci** ditulis lengkap dalam notasi yang sama dengan soal, diikuti tabel data uji (masukan → hasil).

**Rubrik** total 100, dipecah per komponen logika (bukan per baris), mis.:
`header 2 · kamus 1 · penelusuran aman NIL 4 · kasus kosong 2 · kasus first 2 · kasus last 2 · sambung tengah 4 · kosongkan next/prev 1 · panggil primitif 2`.

**Aturan penilaian** (selalu sertakan):
- Tiap komponen: penuh, setengah (logika benar, kekeliruan kecil seperti lupa `endif` atau salah nama field), atau nol.
- **Kesalahan berantai** dipotong sekali; langkah berikutnya dinilai konsisten dengan keadaan yang ditulis mahasiswa.
- Variasi jawaban yang diterima (for vs while, akses langsung `S.top` vs primitif, notasi lain).

**Tabel "Kesalahan umum"**: kesalahan · letak · pemahaman yang keliru. Ambil dari pola miskonsepsi di dokumen acuan.

**Cek materi sumber**: bila slide atau soal yang diberikan user mengandung kekeliruan (mis. contoh list "terurut" yang tidak terurut, Insert_Last tanpa kasus kosong, addClock slide 44), tulis catatan di awal kunci dan nyatakan tafsiran yang dipakai.

## Langkah 6 — Uji kunci dengan simulasi (wajib)

Terjemahkan setiap kunci ke Python memakai kerangka di Lampiran, lalu jalankan semua data uji, contoh di soal, dan jawaban tracing. Paket belum boleh dikirim sebelum semua hasil cocok.

Yang harus diuji:
- Setiap jawaban tracing (isi struktur per baris, top, head/tail, output).
- Setiap procedure kunci pada kasus normal **dan** kasus tepi (kosong, satu elemen, first, last, tidak ditemukan).
- Untuk soal "temukan bug": versi keliru memang gagal (`AttributeError` = akses NIL), versi perbaikan lolos.
- Untuk DLL/Queue: `dll_items` / `queue_items` sekaligus memeriksa konsistensi `prev` dan `last`/`tail`.
- Antar versi (kuis 3 kelas): tingkat kesulitan setara — jumlah langkah tracing dan jumlah kasus tepi sama.

## Langkah 7 — Keluaran

- **UTS / kuis besar**: DOCX dari `template-soal-ujian-fakultas-informatika-rev-2020.docx` (header: jenis ujian, Ganjil TA. 2026/2027, CDK2AAB4 - Struktur Data, durasi, Tim Dosen, PLO, CLO) + PDF; kunci di file terpisah. Gunakan skill docx/pdf.
- **Kuis kecil**: satu soal per slide (gaya deck materi) atau satu halaman; pembahasan di slide tersembunyi / speaker notes. Bila 3 versi, satu file per versi atau satu file berlabel Versi A/B/C.
- Kotak jawaban kosong di bawah soal pseudocode, tabel isian kosong untuk soal tracing.
- Setelah selesai, simpan ringkasan ke Project sebagai `claude/<slug-soal>.md` dengan format yang sama seperti dokumen lain: judul, info file & tanggal, tabel struktur (bagian · isi · nilai · waktu), kunci PG, kunci inti, rubrik singkat, data uji.

## Checklist sebelum kirim

- [ ] Notasi seragam di soal, kunci, dan kotak primitif
- [ ] Contoh di soal tidak sama dengan jawaban yang ditanyakan
- [ ] Semua kunci dan tracing lolos simulasi
- [ ] Total poin = 100, estimasi waktu muat
- [ ] Rubrik per komponen + aturan kesalahan berantai + variasi diterima
- [ ] Tabel kesalahan umum
- [ ] Tema dan data belum pernah dipakai di Project
- [ ] Ringkasan disimpan ke Project

---

## Lampiran — Kerangka simulator Python

Versi lengkap dengan uji mandiri ada di `scripts/sim_strukdat.py` (jalankan `python3 scripts/sim_strukdat.py`). Akses field dari NIL memicu `AttributeError`, yang menandai "akses NIL" pada algoritma.

```python
class Elm:                      # elmList / elmDLL
    def __init__(self, info):
        self.info, self.next, self.prev = info, None, None

class ListSLL:                  # List < first >
    def __init__(self): self.first = None
class ListDLL:                  # ListDLL < first, last >
    def __init__(self): self.first = self.last = None
class Queue:                    # Queue < head, tail >
    def __init__(self): self.head = self.tail = None
class Stack:                    # Stack < info[1..MAXSIZE], top >
    def __init__(self, maxsize=20):
        self.info = [None] * (maxsize + 1); self.top = 0; self.max = maxsize

def sll_from(items):
    L = ListSLL(); prev = None
    for x in items:
        p = Elm(x)
        if prev is None: L.first = p
        else: prev.next = p
        prev = p
    return L

def sll_items(L):
    out, p = [], L.first
    while p is not None: out.append(p.info); p = p.next
    return out

def dll_from(items, cls=ListDLL, a='first', b='last'):
    L = cls(); prev = None
    for x in items:
        p = Elm(x); p.prev = prev
        if prev is None: setattr(L, a, p)
        else: prev.next = p
        prev = p
    setattr(L, b, prev)
    return L

def dll_items(L, a='first', b='last'):
    """Isi maju + assert next/prev dan first/last konsisten."""
    fwd, p, last = [], getattr(L, a), None
    while p is not None:
        assert p.prev is last, f"prev salah di {p.info}"
        fwd.append(p.info); last = p; p = p.next
    assert getattr(L, b) is last, "last/tail tidak menunjuk elemen terakhir"
    return fwd

def queue_from(items): return dll_from(items, Queue, 'head', 'tail')
def queue_items(Q):   return dll_items(Q, 'head', 'tail')

def createStack(maxsize=20): return Stack(maxsize)
def isEmpty(S): return S.top == 0
def isFull(S):  return S.top == S.max
def size(S):    return S.top
def peek(S):    return S.info[S.top]
def push(S, x):
    assert not isFull(S), "push ke stack penuh"
    S.top += 1; S.info[S.top] = x
def pop(S):
    assert not isEmpty(S), "pop dari stack kosong"
    x = S.info[S.top]; S.top -= 1; return x
def stack_from(items, maxsize=20):
    S = createStack(maxsize)
    for x in items: push(S, x)
    return S
def stack_items(S): return S.info[1:S.top + 1]       # bottom -> top

def isEmptyQueue(Q): return Q.head is None
def enqueue(Q, p):
    if Q.head is None: Q.head = Q.tail = p
    else: Q.tail.next = p; p.prev = Q.tail; Q.tail = p
def dequeue(Q):
    p = Q.head; Q.head = p.next
    if Q.head is None: Q.tail = None
    else: Q.head.prev = None
    p.next = None; return p
```

Contoh uji (sudah lolos): `hapusHurufI` pada "init giwit diririt" → `nt gwt drrt`, top 11; Queue Pelangi, Hujan, Bintang → deq, enq Laut, deq, deq → `['Laut']`, dequeue di antrean kosong → akses NIL terdeteksi.
