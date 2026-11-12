"use client";

import { X, BookOpen, Copy, Check } from "lucide-react";
import { useState } from "react";

interface CheatsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertCode?: (snippet: string) => void;
}

export function SyntaxCheatsheetModal({
  isOpen,
  onClose,
  onInsertCode,
}: CheatsheetModalProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const sections = [
    {
      title: "Struktur Dasar Program",
      description: "Setiap program pseudocode Alpro 1 harus memiliki 3 blok utama:",
      code: `program NamaProgram
kamus
    x : integer
algoritma
    input(x)
    output("Nilai x =", x)
endprogram`,
    },
    {
      title: "Kamus & Deklarasi Tipe",
      description: "Deklarasi variabel, konstanta, alias, dan tipe bentukan struct:",
      code: `kamus
    constant PI : real <- 3.14
    type Titik : < x : real, y : real >
    type Jam : integer
    
    p : Titik
    waktu : Jam
    nama : string
    isActive : boolean`,
    },
    {
      title: "Input & Output",
      description: "Membaca masukan dari terminal dan mencetak hasil ke layar:",
      code: `input(x)
input(p.x, p.y)
output("Hasilnya adalah:", x + 10)
output(true, "status")`,
    },
    {
      title: "Percabangan (If - Else If - Else)",
      description: "Pengambilan keputusan dengan kondisi boolean:",
      code: `if x > 0 then
    output("Positif")
else if x < 0 then
    output("Negatif")
else
    output("Nol")
endif`,
    },
    {
      title: "Perulangan While - Do",
      description: "Perulangan dengan pemeriksaan kondisi di awal:",
      code: `i <- 1
while i <= 5 do
    output(i)
    i <- i + 1
endwhile`,
    },
    {
      title: "Perulangan Repeat - Until",
      description: "Perulangan dengan pemeriksaan kondisi di akhir (minimal 1 kali):",
      code: `i <- 1
repeat
    output(i)
    i <- i + 1
until i > 5`,
    },
    {
      title: "Perulangan For (Up & Down)",
      description: "Perulangan terhitung dengan pencacah integer:",
      code: `{ Naik }
for i <- 1 to 5 do
    output(i)
endfor

{ Turun dengan step }
for j <- 10 down to 0 step 2 do
    output(j)
endfor`,
    },
    {
      title: "Operator Khusus Alpro",
      description: "Operator aritmatika, perbandingan, dan logika:",
      code: `{ Aritmatika: div (bagi bulat), mod (sisa bagi), ^ (pangkat) }
hasil <- 17 div 3    { hasil = 5 }
sisa  <- 17 mod 3    { sisa = 2 }
kuadrat <- 2 ^ 3     { kuadrat = 8 }

{ Logika: not, and, or, <> (tidak sama dengan) }
if (x > 0) and not (x = 10) then
    output("Valid")
endif`,
    },
  ];

  const handleCopy = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border border-[#e4e4df] bg-[#ffffff] text-[#0f172a] shadow-2xl overflow-hidden dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e5df] bg-[#fbfbfa] dark:border-neutral-800 dark:bg-neutral-900/90">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#5b45ff] dark:text-emerald-400" />
            <h2 className="text-lg font-semibold tracking-tight text-[#0f172a] dark:text-white">
              Sintaks &amp; Panduan Pseudocode (Alpro 1)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748b] hover:text-[#0f172a] hover:bg-[#edeef0] dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <p className="text-sm text-[#475569] dark:text-neutral-400">
            Referensi sintaks resmi yang digunakan dalam perkuliahan Algoritma dan Pemrograman 1. Klik salin atau masukkan ke editor.
          </p>

          <div className="grid grid-cols-1 gap-5">
            {sections.map((sec, idx) => (
              <div
                key={sec.title}
                className="p-4 rounded-xl border border-[#e4e4df] bg-[#fbfbfa] dark:border-neutral-800/80 dark:bg-neutral-950/60 flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#5b45ff] dark:text-emerald-400 text-sm">
                    {sec.title}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(sec.code, idx)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded-md border border-[#e2e2dc] bg-[#ffffff] hover:bg-[#edeef0] text-[#475569] hover:text-[#0f172a] dark:border-neutral-700 dark:bg-neutral-800/80 dark:hover:bg-neutral-700 dark:text-neutral-300 dark:hover:text-white transition-all cursor-pointer"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#16a34a] dark:text-emerald-400" />
                          <span>Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                    {onInsertCode && (
                      <button
                        type="button"
                        onClick={() => {
                          onInsertCode(sec.code);
                          onClose();
                        }}
                        className="px-2.5 py-1 text-xs rounded-md bg-[#ede9fe] border border-[#ddd6fe] text-[#4f46e5] hover:bg-[#ddd6fe] dark:bg-emerald-600/20 dark:border-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-600/30 transition-all cursor-pointer font-medium"
                      >
                        Pakai di Editor
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-[#64748b] dark:text-neutral-400">{sec.description}</p>
                <pre className="p-3 rounded-lg bg-[#ffffff] border border-[#e4e4df] text-[#0f172a] dark:bg-neutral-900 dark:border-neutral-800 dark:text-emerald-300/90 font-mono text-xs overflow-x-auto whitespace-pre">
                  {sec.code}
                </pre>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#e5e5df] bg-[#fbfbfa] dark:border-neutral-800 dark:bg-neutral-900 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-[#ede9fe] text-[#4f46e5] hover:bg-[#ddd6fe] border border-[#ddd6fe] dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
