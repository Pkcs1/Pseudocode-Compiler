import { Workspace } from "@/components/sandbox/workspace";
import TerminalDemo from "@/components/terminal-demo";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100 dark:bg-neutral-950 dark:text-neutral-100 transition-colors">
      {/* Interactive Pseudocode Sandbox */}
      <Workspace />

      {/* Aceternity UI Terminal Showcase */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <div className="border-t border-neutral-800/80 pt-10">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Aceternity UI Terminal Component
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Komponen terminal interaktif animasi Aceternity UI dengan efek suara mekanik.
            </p>
          </div>
          <TerminalDemo />
        </div>
      </section>
    </div>
  );
}
