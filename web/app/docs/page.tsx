import type { Metadata } from "next";
import { DocsView } from "@/components/docs/docs-view";

export const metadata: Metadata = {
  title: "Dokumentasi Pseudocode | Telkom Alpro 1",
  description:
    "Panduan bahasa pseudocode Alpro 1: struktur program, tipe data, input/output, operator, percabangan, dan perulangan.",
};

export default function DocsPage() {
  return <DocsView />;
}
