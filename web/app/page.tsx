import { Workspace } from "@/components/sandbox/workspace";

export default function Home() {
  return (
    <div className="min-h-dvh flex flex-col bg-[#eef0f4] text-[#0f172a] dark:bg-neutral-950 dark:text-neutral-100 transition-colors">
      <Workspace />
    </div>
  );
}
