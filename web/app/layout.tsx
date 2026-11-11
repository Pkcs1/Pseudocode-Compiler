import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pseudocode Compiler & Interactive Sandbox | Telkom Alpro 1",
  description:
    "Web-based compiler, interactive terminal runner, and syntax inspector for Telkom University Algoritma dan Pemrograman 1 (Alpro 1) Pseudocode.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100 selection:bg-emerald-500/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
