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
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("pseudo-theme");if(t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark");}else{document.documentElement.classList.remove("dark");}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#eef0f4] text-[#0f172a] dark:bg-neutral-950 dark:text-neutral-100 selection:bg-[#5b45ff]/20 dark:selection:bg-sky-400/30 transition-colors">
        {children}
      </body>
    </html>
  );
}
