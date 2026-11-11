import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getProjectRoot } from "@/lib/runner";

export interface ExampleProgram {
  id: string;
  title: string;
  category: string;
  filename: string;
  code: string;
  defaultInput?: string;
  expectedOutput?: string;
  description: string;
}

const CATEGORY_MAP: Record<string, { category: string; title: string; desc: string }> = {
  tak: {
    category: "Week 09 & 10 - Percabangan If-Else",
    title: "Tarif Taksi (If / Else If)",
    desc: "Menghitung biaya sewa taksi berdasarkan jenis hari dan jarak tempuh.",
  },
  nilai_mutlak: {
    category: "Week 09 - Percabangan Dasar",
    title: "Nilai Mutlak (|x|)",
    desc: "Mengevaluasi nilai mutlak dari bilangan bulat masukan.",
  },
  genap_while: {
    category: "Week 11 & 12 - Perulangan While",
    title: "Cetak Bilangan Genap (While-Do)",
    desc: "Menampilkan deret bilangan bulat genap hingga mencapai N menggunakan while.",
  },
  barisan_repeat: {
    category: "Week 11 & 12 - Perulangan Repeat-Until",
    title: "Deret Barisan (Repeat-Until)",
    desc: "Menghitung dan mencetak deret kelipatan dengan perulangan repeat-until.",
  },
  faktor: {
    category: "Week 11 & 12 - Komposisi Kontrol",
    title: "Faktor Pembagi Bilangan",
    desc: "Menemukan seluruh faktor pembagi dari suatu bilangan bulat positif.",
  },
  jarak: {
    category: "Week 01 - Input & Output Dasar",
    title: "Jarak Tempuh (v × t)",
    desc: "Contoh wajib #1: menghitung jarak berdasarkan kecepatan dan waktu.",
  },
  bilangan: {
    category: "Week 02 - Operasi Boolean & Tipe",
    title: "Cek Bilangan Positif",
    desc: "Contoh wajib #2: memverifikasi apakah bilangan lebih besar dari nol.",
  },
  rahasia: {
    category: "Week 02 - Tipe Karakter & Sandi",
    title: "Dekripsi Karakter Rahasia",
    desc: "Contoh wajib #4: membaca 5 integer dan mengonversinya menjadi teks karakter.",
  },
  tabung_properti: {
    category: "Week 04 - Tipe Terstruktur (Struct)",
    title: "Volume & Luas Tabung",
    desc: "Contoh tipe bentukan (struct) tabung dan konstanta bilangan real PI.",
  },
  renang: {
    category: "Week 05 & 06 - Perulangan For",
    title: "Waktu Latihan Renang",
    desc: "Contoh wajib #3: perulangan for dengan akumulasi waktu latihan.",
  },
  suhu: {
    category: "Week 01 - Bilangan Real & Aritmatika",
    title: "Konversi Suhu Celcius",
    desc: "Contoh wajib #6: konversi suhu celcius ke fahrenheit dan reamur.",
  },
  cetak_barisan: {
    category: "Week 05 & 06 - Perulangan For",
    title: "Cetak Barisan Angka",
    desc: "Perulangan for pencetakan barisan angka dengan step tertentu.",
  },
  contoh_struktur: {
    category: "Week 04 - Struct & Alias",
    title: "Contoh Struktur & Kamus",
    desc: "Contoh wajib #5: manipulasi struct waktu/tanggal dalam kamus.",
  },
};

export async function GET() {
  const root = getProjectRoot();
  const examplesDir = path.join(root, "tests", "examples");

  if (!fs.existsSync(examplesDir)) {
    return NextResponse.json({ examples: [] });
  }

  const files = fs.readdirSync(examplesDir);
  const pseudoFiles = files.filter((f) => f.endsWith(".pseudo"));

  const examples: ExampleProgram[] = [];

  for (const file of pseudoFiles) {
    const id = file.replace(/\.pseudo$/, "");
    const fullPath = path.join(examplesDir, file);
    const code = fs.readFileSync(fullPath, "utf8");

    const inPath = path.join(examplesDir, `${id}.in`);
    const outPath = path.join(examplesDir, `${id}.out`);

    const defaultInput = fs.existsSync(inPath)
      ? fs.readFileSync(inPath, "utf8").trim()
      : undefined;

    const expectedOutput = fs.existsSync(outPath)
      ? fs.readFileSync(outPath, "utf8").trim()
      : undefined;

    const meta = CATEGORY_MAP[id] || {
      category: id.startsWith("latihan_w2")
        ? "Week 02 - Latihan Soal"
        : id.startsWith("latihan_w3")
        ? "Week 03 - Latihan Soal"
        : id.startsWith("latihan_w4")
        ? "Week 04 - Latihan Soal"
        : id.startsWith("latihan_w5")
        ? "Week 05 & 06 - Latihan Soal"
        : "Contoh Program Lainnya",
      title: id.replace(/_/g, " ").replace(/^latihan w\d+ \d+ /, (m) => m.toUpperCase()),
      desc: `Program pseudocode ${file}`,
    };

    examples.push({
      id,
      title: meta.title,
      category: meta.category,
      filename: file,
      code,
      defaultInput,
      expectedOutput,
      description: meta.desc,
    });
  }

  // Priority order: featured slide examples first, then latihan
  const featuredIds = [
    "tak",
    "nilai_mutlak",
    "genap_while",
    "barisan_repeat",
    "faktor",
    "jarak",
    "bilangan",
    "suhu",
    "tabung_properti",
    "renang",
    "rahasia",
    "contoh_struktur",
    "cetak_barisan",
  ];

  examples.sort((a, b) => {
    const idxA = featuredIds.indexOf(a.id);
    const idxB = featuredIds.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.id.localeCompare(b.id);
  });

  return NextResponse.json({ examples });
}
